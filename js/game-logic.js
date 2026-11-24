// 農田生長、體力與晚睡懲罰、刮刮樂、在線睡覺換日結算
// js/game-logic.js

import {
  doc,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

import { db } from './firebase-config.js';
import { runGameTransaction, prependLog } from './db.js';
import { rollD20, performSkillCheck } from './dice-engine.js';
import { GAME_CONSTANTS, STATS, CLASSES } from '../data/classes-traits.js';
import { ITEMS, COOKING_RECIPES, SEASON_TRENDS } from '../data/items-recipes.js';
import {
  SKILL_XP_THRESHOLDS,
  PERSONAL_XP_THRESHOLDS,
  LIFE_SKILLS,
  WEATHER_TYPES,
  LOCATION_ACTIONS,
  FISHING_POOL,
  FORAGING_POOLS,
  APPRAISAL_POOL,
  ANIMAL_TYPES,
  SCRATCH_CARD_COST,
  SCRATCH_REWARDS
} from '../data/skills-actions.js';
import {
  NPCS,
  SEASONAL_QUESTS,
  LEGENDARY_PROJECT,
  BULLETIN_QUEST_POOL
} from '../data/npcs-quests.js';

// ============================================================================
// 一、 基礎通用輔助函式（體力、時間、經驗升級、背包與倉庫存取）
// ============================================================================

export function getBackpackCapacity(player) {
  const bonus = player.traits?.includes('miser') ? 6 : 0;
  return GAME_CONSTANTS.BASE_BACKPACK_SLOTS + bonus;
}

export function getTotalItemCount(player, warehouse, itemId) {
  const inBag = (player.inventory || []).find(i => i.itemId === itemId)?.count || 0;
  const inBox = warehouse?.[itemId] || 0;
  return inBag + inBox;
}

/**
 * 扣除體力並推進個人時鐘（處理四季氣候、料理 Buff 與工作狂透支）
 */
function consumeStaminaAndTime(player, village, baseStamina, baseMinutes, isOutdoor = false) {
  let staminaCost = baseStamina;
  const weather = WEATHER_TYPES[village.weather];
  const buffs = player.dailyBuffs || [];

  if (isOutdoor) {
    if (weather?.staminaMod) staminaCost += weather.staminaMod;
    if (village.season === 'summer') {
      const hasCoolDown = buffs.some(b => b.type === 'cool_down');
      if (!hasCoolDown) staminaCost += 1;
    }
    if (village.season === 'winter') {
      staminaCost += 1;
    }
  }
  staminaCost = Math.max(1, staminaCost);

  const isWorkaholic = player.traits?.includes('workaholic');
  if (player.stamina < staminaCost) {
    if (!isWorkaholic) {
      throw new Error(`體力不足（需要 ${staminaCost} 點）！可以先吃點料理補充體力，或上床睡覺喔！`);
    }
    if (player.stamina - staminaCost < -40) {
      throw new Error('已經透支到極限了，快上床睡覺休息吧！');
    }
  }

  let minutesCost = baseMinutes;
  if (buffs.some(b => b.type === 'speed')) {
    minutesCost = Math.max(10, Math.round(minutesCost * 0.5));
  }

  return {
    nextStamina: player.stamina - staminaCost,
    nextPersonalTime: (player.personalTime || 360) + minutesCost,
    staminaSpent: staminaCost
  };
}

/**
 * 發放個人經驗與生活技能經驗（支援本職 100%、跨職 50% 與特性加成）
 */
function grantExperience(player, skillId, baseSkillXp, basePersonalXp = 15) {
  const notes = [];
  const nextSkills = JSON.parse(JSON.stringify(player.skills || {}));

  // 1. 生活技能熟練度（本職 100%，跨職 50%）
  if (skillId && nextSkills[skillId]) {
    const classDef = CLASSES[player.mainClass];
    const isMainSkill = classDef?.relatedSkill === skillId;
    let rate = isMainSkill ? GAME_CONSTANTS.MAIN_CLASS_XP_RATE : GAME_CONSTANTS.CROSS_CLASS_XP_RATE;
    if (player.traits?.includes('work_master')) {
      rate += 0.25; // 工作達人：所有生活技能經驗 +25%
    }

    const gainedSkillXp = Math.max(1, Math.round(baseSkillXp * rate));
    const sk = nextSkills[skillId];
    sk.xp += gainedSkillXp;

    while (sk.level < 10 && sk.xp >= SKILL_XP_THRESHOLDS[sk.level]) {
      sk.xp -= SKILL_XP_THRESHOLDS[sk.level];
      sk.level += 1;
      notes.push(`🎉【${LIFE_SKILLS[skillId]?.name}】提升至 Lv.${sk.level}！`);
    }
  }

  // 2. 個人等級經驗（模範生 +25%）
  let personalRate = player.traits?.includes('model_student') ? 1.25 : 1.0;
  let nextLevel = player.level || 1;
  let nextXp = (player.xp || 0) + Math.max(1, Math.round(basePersonalXp * personalRate));
  let nextFreePoints = player.freeStatPoints || 0;

  while (nextLevel < 10 && nextXp >= PERSONAL_XP_THRESHOLDS[nextLevel]) {
    nextXp -= PERSONAL_XP_THRESHOLDS[nextLevel];
    nextLevel += 1;
    let statNote = '';
    if (nextLevel % 3 === 0) {
      nextFreePoints += 1;
      statNote = '（獲得 1 點自由能力點！）';
    }
    notes.push(`⭐ 個人等級升至 Lv.${nextLevel}！${statNote}`);
  }

  return {
    skills: nextSkills,
    level: nextLevel,
    xp: nextXp,
    freeStatPoints: nextFreePoints,
    levelUpNotes: notes
  };
}

/**
 * 增加全村發展經驗與等級
 */
function grantVillageXp(village, amount) {
  let lv = village.villageLevel || 1;
  let xp = (village.villageXp || 0) + amount;
  let leveledUp = false;
  while (lv < 10 && xp >= lv * 200) {
    xp -= lv * 200;
    lv += 1;
    leveledUp = true;
  }
  return { villageLevel: lv, villageXp: xp, leveledUp };
}

/**
 * 獲得物品：優先放入個人背包，若背包已滿自動轉送進共用大倉庫
 */
function giveItemsSmart(player, warehouse, itemId, count) {
  const nextInv = JSON.parse(JSON.stringify(player.inventory || []));
  const nextBox = { ...(warehouse || {}) };
  const cap = getBackpackCapacity(player);

  const existing = nextInv.find(i => i.itemId === itemId);
  if (existing) {
    existing.count += count;
    return { inventory: nextInv, warehouse: nextBox, sentToBox: false };
  }

  if (nextInv.length < cap) {
    nextInv.push({ itemId, count });
    return { inventory: nextInv, warehouse: nextBox, sentToBox: false };
  }

  // 背包滿格時自動收入家裡無限共用箱
  nextBox[itemId] = (nextBox[itemId] || 0) + count;
  return { inventory: nextInv, warehouse: nextBox, sentToBox: true };
}

/**
 * 消耗材料：優先扣隨身背包，不足再扣共用大倉庫
 */
function consumeItemsSmart(player, warehouse, reqList) {
  const nextInv = JSON.parse(JSON.stringify(player.inventory || []));
  const nextBox = { ...(warehouse || {}) };

  for (const req of reqList) {
    const total = getTotalItemCount(player, warehouse, req.itemId);
    if (total < req.count) {
      const name = ITEMS[req.itemId]?.name || req.itemId;
      throw new Error(`材料不足：需要「${name} x${req.count}」（目前共有 ${total} 個）`);
    }

    let remaining = req.count;
    const bagIdx = nextInv.findIndex(i => i.itemId === req.itemId);
    if (bagIdx !== -1) {
      const take = Math.min(nextInv[bagIdx].count, remaining);
      nextInv[bagIdx].count -= take;
      remaining -= take;
      if (nextInv[bagIdx].count <= 0) nextInv.splice(bagIdx, 1);
    }
    if (remaining > 0) {
      nextBox[req.itemId] = (nextBox[req.itemId] || 0) - remaining;
      if (nextBox[req.itemId] <= 0) delete nextBox[req.itemId];
    }
  }

  return { inventory: nextInv, warehouse: nextBox };
}

function pickWeighted(pool) {
  const total = pool.reduce((s, item) => s + (item.weight || 1), 0);
  let r = Math.random() * total;
  for (const item of pool) {
    r -= item.weight || 1;
    if (r <= 0) return item;
  }
  return pool[0];
}

// ============================================================================
// 二、 農場與牧場行動（開墾、播種、澆水、收成、餵養動物）
// ============================================================================

export async function actionFarmPlot(roomId, playerId, plotIndex, seedId = null) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const plots = JSON.parse(JSON.stringify(village.farmPlots || []));
    const plot = plots[plotIndex];
    if (!plot) throw new Error('找不到該塊農田');

    const isFarmer = player.mainClass === 'farmer';

    // 1. 開墾荒廢農地
    if (!plot.cleared) {
      const actionCfg = LOCATION_ACTIONS.farm.find(a => a.id === 'clear_land');
      const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, actionCfg.stamina, actionCfg.minutes, true);
      const check = performSkillCheck(player, village, actionCfg);

      let resultMsg = '';
      let inv = player.inventory;
      let box = village.warehouse;

      if (check.isSuccess) {
        plot.cleared = true;
        plot.isWatered = Boolean(WEATHER_TYPES[village.weather]?.autoWater);
        const dropItem = Math.random() < 0.5 ? 'acacia_wood' : 'stone';
        const dropCount = check.isCritSuccess ? 4 : 2;
        ({ inventory: inv, warehouse: box } = giveItemsSmart(player, box, dropItem, dropCount));
        resultMsg = `成功開墾第 ${plotIndex + 1} 號荒地，順手清出了 ${ITEMS[dropItem].name} x${dropCount}！`;
      } else {
        resultMsg = `揮汗清理雜草與石塊，還差一點就能開墾完成！`;
      }

      const xpRes = grantExperience(player, 'farming', check.isSuccess ? 40 : 20, 18);
      const logLine = `🌾 ${player.name} 開墾農地（d20=${check.roll}+${check.totalMod}=${check.totalScore} vs DC${check.effectiveDC}）：${resultMsg}`;

      return {
        villageUpdates: {
          farmPlots: plots,
          warehouse: box,
          activityLogs: prependLog(village.activityLogs, logLine, check.isCritSuccess)
        },
        playerUpdates: {
          stamina: nextStamina,
          personalTime: nextPersonalTime,
          inventory: inv,
          skills: xpRes.skills,
          level: xpRes.level,
          xp: xpRes.xp,
          freeStatPoints: xpRes.freeStatPoints
        },
        payload: { check, message: resultMsg, levelUpNotes: xpRes.levelUpNotes }
      };
    }

    // 2. 空地播種
    if (!plot.cropId) {
      if (!seedId) throw new Error('請先選擇要播種的種子！');
      const seedDef = ITEMS[seedId];
      if (!seedDef || !seedDef.cropId) throw new Error('無效的種子');

      const farmingLv = player.skills?.farming?.level || 1;
      if (farmingLv < (seedDef.skillReq || 1)) {
        throw new Error(`需要農耕 Lv.${seedDef.skillReq} 才能種植「${seedDef.name}」`);
      }
      if (!seedDef.seasons.includes(village.season)) {
        throw new Error(`「${seedDef.name}」不適合在目前季節種植！`);
      }

      // 農夫被動：25% 機率不耗體力
      const freeStam = isFarmer && Math.random() < 0.25;
      const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, freeStam ? 0 : 5, 20, true);
      const { inventory: inv, warehouse: box } = consumeItemsSmart(player, village.warehouse, [{ itemId: seedId, count: 1 }]);

      plot.cropId = seedDef.cropId;
      plot.daysGrown = 0;
      plot.isWatered = Boolean(WEATHER_TYPES[village.weather]?.autoWater);
      plot.qualityBonus = isFarmer || village.season === 'autumn';

      const xpRes = grantExperience(player, 'farming', 15, 10);
      const cropName = ITEMS[seedDef.cropId]?.name;
      const msg = `在 ${plotIndex + 1} 號田種下了「${cropName}」${freeStam ? '（農夫專精不耗體力！）' : ''}`;

      return {
        villageUpdates: {
          farmPlots: plots,
          warehouse: box,
          activityLogs: prependLog(village.activityLogs, `🌱 ${player.name} ${msg}`, false)
        },
        playerUpdates: {
          stamina: nextStamina,
          personalTime: nextPersonalTime,
          inventory: inv,
          skills: xpRes.skills,
          level: xpRes.level,
          xp: xpRes.xp,
          freeStatPoints: xpRes.freeStatPoints
        },
        payload: { message: msg, levelUpNotes: xpRes.levelUpNotes }
      };
    }

    // 3. 成熟採收
    const seedEntry = Object.values(ITEMS).find(i => i.cropId === plot.cropId);
    const growDays = seedEntry?.growDays || 2;
    const cropDef = ITEMS[plot.cropId];

    if (plot.daysGrown >= growDays) {
      const actionCfg = LOCATION_ACTIONS.farm.find(a => a.id === 'tend_crops');
      const freeStam = isFarmer && Math.random() < 0.25;
      const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, freeStam ? 0 : 6, 25, true);
      const check = performSkillCheck(player, village, actionCfg);

      let yieldCount = 1;
      if (check.isCritSuccess) yieldCount = 3;
      else if (check.isSuccess && (isFarmer || plot.qualityBonus)) yieldCount = 2;

      const { inventory: inv, warehouse: box, sentToBox } = giveItemsSmart(player, village.warehouse, plot.cropId, yieldCount);
      const vXp = grantVillageXp(village, 15);
      const xpRes = grantExperience(player, 'farming', check.isCritSuccess ? 50 : 28, 15);

      // 重置田地
      plot.cropId = null;
      plot.daysGrown = 0;
      plot.isWatered = Boolean(WEATHER_TYPES[village.weather]?.autoWater);
      plot.qualityBonus = false;

      const msg = `採收了「${cropDef.name} x${yieldCount}」${sentToBox ? '（背包滿已自動存入共用倉庫）' : ''}`;
      const logLine = `🌾 ${player.name} 採收農作物（d20=${check.roll}+${check.totalMod}=${check.totalScore}）：${msg}`;

      return {
        villageUpdates: {
          farmPlots: plots,
          warehouse: box,
          villageLevel: vXp.villageLevel,
          villageXp: vXp.villageXp,
          activityLogs: prependLog(village.activityLogs, logLine, check.isCritSuccess)
        },
        playerUpdates: {
          stamina: nextStamina,
          personalTime: nextPersonalTime,
          inventory: inv,
          skills: xpRes.skills,
          level: xpRes.level,
          xp: xpRes.xp,
          freeStatPoints: xpRes.freeStatPoints
        },
        payload: { check, message: msg, levelUpNotes: xpRes.levelUpNotes }
      };
    }

    // 4. 澆水照料
    if (plot.isWatered) {
      throw new Error(`這塊田的「${cropDef.name}」今天已經澆過水了（成長進度 ${plot.daysGrown}/${growDays} 天）`);
    }

    const freeStam = isFarmer && Math.random() < 0.25;
    const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, freeStam ? 0 : 5, 15, true);
    plot.isWatered = true;
    const xpRes = grantExperience(player, 'farming', 15, 8);
    const msg = `替 ${plotIndex + 1} 號田的「${cropDef.name}」澆了水（${plot.daysGrown}/${growDays} 天）`;

    return {
      villageUpdates: {
        farmPlots: plots,
        activityLogs: prependLog(village.activityLogs, `💧 ${player.name} ${msg}`, false)
      },
      playerUpdates: {
        stamina: nextStamina,
        personalTime: nextPersonalTime,
        skills: xpRes.skills,
        level: xpRes.level,
        xp: xpRes.xp,
        freeStatPoints: xpRes.freeStatPoints
      },
      payload: { message: msg, levelUpNotes: xpRes.levelUpNotes }
    };
  });
}

export async function actionRanchCare(roomId, playerId, animalId) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const livestock = JSON.parse(JSON.stringify(village.livestock || []));
    const animal = livestock.find(a => a.id === animalId);
    if (!animal) throw new Error('找不到該隻動物');

    const animalDef = ANIMAL_TYPES[animal.type];
    const isShepherd = player.mainClass === 'shepherd';
    const actionCfg = LOCATION_ACTIONS.ranch[0];

    const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, actionCfg.stamina, actionCfg.minutes, false);
    let inv = player.inventory;
    let box = village.warehouse;
    const notes = [];

    // 若今天還沒餵食，消耗 1 份基礎飼料
    if (!animal.fedToday) {
      ({ inventory: inv, warehouse: box } = consumeItemsSmart(player, box, [{ itemId: 'basic_feed', count: 1 }]));
      animal.fedToday = true;
      notes.push('餵食了基礎飼料');
    }

    const check = performSkillCheck(player, village, actionCfg);
    const intimacyGain = (check.isSuccess ? 6 : 3) * (isShepherd ? 2 : 1);
    animal.intimacy = Math.min(100, (animal.intimacy || 0) + intimacyGain);
    notes.push(`親密度 +${intimacyGain}（目前 ${animal.intimacy}）`);

    // 若畜產已成熟，順便收集
    if (animal.productReady) {
      let prodCount = 1;
      if (check.isCritSuccess || (isShepherd && animal.intimacy >= 50 && Math.random() < 0.4)) {
        prodCount = 2;
      }
      ({ inventory: inv, warehouse: box } = giveItemsSmart(player, box, animalDef.productId, prodCount));
      animal.productReady = false;
      animal.daysSinceProduce = 0;
      notes.push(`收穫了「${ITEMS[animalDef.productId].name} x${prodCount}」！`);
    }

    const xpRes = grantExperience(player, 'ranching', check.isCritSuccess ? 45 : 25, 14);
    const msg = `照顧了「${animal.nickname}（${animalDef.name}）」：${notes.join('，')}`;

    return {
      villageUpdates: {
        livestock,
        warehouse: box,
        activityLogs: prependLog(village.activityLogs, `🐄 ${player.name} ${msg}`, check.isCritSuccess)
      },
      playerUpdates: {
        stamina: nextStamina,
        personalTime: nextPersonalTime,
        inventory: inv,
        skills: xpRes.skills,
        level: xpRes.level,
        xp: xpRes.xp,
        freeStatPoints: xpRes.freeStatPoints
      },
      payload: { check, message: msg, levelUpNotes: xpRes.levelUpNotes }
    };
  });
}

export async function actionBuyAnimal(roomId, playerId, animalType) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const def = ANIMAL_TYPES[animalType];
    if (!def) throw new Error('無效的動物種類');

    const ranchingLv = player.skills?.ranching?.level || 1;
    if (ranchingLv < def.skillReq) {
      throw new Error(`需要畜牧 Lv.${def.skillReq} 才能飼養「${def.name}」`);
    }

    const isMerchant = player.mainClass === 'merchant';
    const finalPrice = isMerchant ? Math.round(def.buyPrice * 0.85) : def.buyPrice;
    if ((village.sharedMoney || 0) < finalPrice) {
      throw new Error(`全村公款不足（需要 ${finalPrice} 元）`);
    }

    const livestock = JSON.parse(JSON.stringify(village.livestock || []));
    const newAnimal = {
      id: 'ani_' + Date.now(),
      type: animalType,
      nickname: `${def.name}#${livestock.length + 1}`,
      intimacy: 10,
      fedToday: false,
      daysSinceProduce: 0,
      productReady: false
    };
    livestock.push(newAnimal);

    const msg = `從小芳姊那裡領養了一隻「${def.name}」（花費公款 ${finalPrice} 元）！`;
    return {
      villageUpdates: {
        sharedMoney: village.sharedMoney - finalPrice,
        livestock,
        activityLogs: prependLog(village.activityLogs, `🐣 ${player.name} ${msg}`, true)
      },
      playerUpdates: {},
      payload: { message: msg }
    };
  });
}

// ============================================================================
// 三、 海邊釣魚（含魚餌與漁夫被動）與山海採集挖礦
// ============================================================================

export async function actionFish(roomId, playerId, baitId = null) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    if (WEATHER_TYPES[village.weather]?.lockOutdoor) {
      throw new Error('🌪️ 外面正值狂風暴雨颱風天，港邊已封閉無法出海釣魚！');
    }

    const actionCfg = { ...LOCATION_ACTIONS.beach.find(a => a.id === 'go_fishing') };
    const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, actionCfg.stamina, actionCfg.minutes, true);

    let inv = player.inventory;
    let box = village.warehouse;
    let baitBonus = 0;
    let rarityBoost = 1;

    if (baitId) {
      ({ inventory: inv, warehouse: box } = consumeItemsSmart(player, box, [{ itemId: baitId, count: 1 }]));
      if (baitId === 'worm_bait') { baitBonus = 1; rarityBoost = 1.2; }
      if (baitId === 'shrimp_bait') { baitBonus = 2; rarityBoost = 1.6; }
      if (baitId === 'lure_bait') { baitBonus = 3; rarityBoost = 2.2; }
    }

    // 篩選符合釣魚等級的魚種並計算權重
    const fishLv = player.skills?.fishing?.level || 1;
    const isNight = (player.personalTime || 360) >= 1080; // 18:00 後
    const isFisher = player.mainClass === 'fisher';
    const isThunderAfternoon = village.weather === 'thunderstorm' && (player.personalTime || 360) >= 840;

    const candidates = FISHING_POOL.filter(f => fishLv >= f.minSkill).map(f => {
      let w = isNight && f.nightBonusWeight ? f.nightBonusWeight : f.weight;
      if (f.seasonBonus === village.season) w *= 1.5;
      if (f.minSkill >= 4) {
        w *= rarityBoost;
        if (isFisher) w *= 1.35;
        if (isThunderAfternoon) w *= 1.4;
      }
      return { ...f, weight: w };
    });

    const targetFish = pickWeighted(candidates);
    actionCfg.dc = Math.max(7, targetFish.dc - baitBonus);

    const check = performSkillCheck(player, village, actionCfg);
    let msg = '';
    let caughtId = null;
    let caughtCount = 0;

    if (check.isSuccess) {
      caughtId = targetFish.itemId;
      caughtCount = check.isCritSuccess ? 2 : 1;
      ({ inventory: inv, warehouse: box } = giveItemsSmart(player, box, caughtId, caughtCount));
      msg = `成功釣起了「${ITEMS[caughtId].name} x${caughtCount}」！`;
    } else if (!check.isCritFail) {
      // 失敗不空手：撈到海帶芽
      caughtId = 'wakame';
      caughtCount = 1;
      ({ inventory: inv, warehouse: box } = giveItemsSmart(player, box, 'wakame', 1));
      msg = `魚兒脫鉤跑掉了，但魚鉤勾起了一把「新鮮海帶芽」！`;
    } else {
      msg = `用力過猛把釣線纏成了死結，空手而歸！`;
    }

    const xpRes = grantExperience(player, 'fishing', check.isCritSuccess ? 55 : check.isSuccess ? 32 : 15, 15);
    const logLine = `🎣 ${player.name} 在漁港釣魚（d20=${check.roll}+${check.totalMod}=${check.totalScore} vs DC${check.effectiveDC}）：${msg}`;

    return {
      villageUpdates: {
        warehouse: box,
        activityLogs: prependLog(village.activityLogs, logLine, check.isCritSuccess || check.isCritFail)
      },
      playerUpdates: {
        stamina: nextStamina,
        personalTime: nextPersonalTime,
        inventory: inv,
        skills: xpRes.skills,
        level: xpRes.level,
        xp: xpRes.xp,
        freeStatPoints: xpRes.freeStatPoints
      },
      payload: { check, message: msg, levelUpNotes: xpRes.levelUpNotes }
    };
  });
}

export async function actionCraftBait(roomId, playerId, baitId) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    if (player.mainClass !== 'fisher') {
      throw new Error('只有「漁夫」職業懂得如何手工製作魚餌（其他職業可向海伯購買）！');
    }

    const fishLv = player.skills?.fishing?.level || 1;
    const recipes = {
      worm_bait: { reqLv: 1, req: [{ itemId: 'wakame', count: 1 }], outCount: 3 },
      shrimp_bait: { reqLv: 4, req: [{ itemId: 'wakame', count: 1 }, { itemId: 'chub', count: 1 }], outCount: 3 },
      lure_bait: { reqLv: 7, req: [{ itemId: 'copper_bar', count: 1 }, { itemId: 'squid', count: 1 }], outCount: 2 }
    };
    const r = recipes[baitId];
    if (!r) throw new Error('無效的魚餌配方');
    if (fishLv < r.reqLv) throw new Error(`需要釣魚 Lv.${r.reqLv} 才能製作「${ITEMS[baitId].name}」`);

    const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, 5, 20, false);
    let { inventory: inv, warehouse: box } = consumeItemsSmart(player, village.warehouse, r.req);
    ({ inventory: inv, warehouse: box } = giveItemsSmart({ ...player, inventory: inv }, box, baitId, r.outCount));

    const xpRes = grantExperience(player, 'fishing', 20, 10);
    const msg = `發揮漁夫手藝自製了「${ITEMS[baitId].name} x${r.outCount}」！`;

    return {
      villageUpdates: {
        warehouse: box,
        activityLogs: prependLog(village.activityLogs, `🪱 ${player.name} ${msg}`, false)
      },
      playerUpdates: {
        stamina: nextStamina,
        personalTime: nextPersonalTime,
        inventory: inv,
        skills: xpRes.skills,
        level: xpRes.level,
        xp: xpRes.xp,
        freeStatPoints: xpRes.freeStatPoints
      },
      payload: { message: msg, levelUpNotes: xpRes.levelUpNotes }
    };
  });
}

export async function actionForageOrMine(roomId, playerId, actionId) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    if (WEATHER_TYPES[village.weather]?.lockOutdoor) {
      throw new Error('🌪️ 颱風警報發布中，海邊與深山皆已封閉禁止進入！');
    }

    const allActions = [...LOCATION_ACTIONS.beach, ...LOCATION_ACTIONS.mountain];
    const actionCfg = allActions.find(a => a.id === actionId);
    if (!actionCfg) throw new Error('無效的採集行動');

    if (actionCfg.classOnly && player.mainClass !== actionCfg.classOnly) {
      throw new Error('只有「採集者」具備在深山草叢尋寶的直覺！');
    }

    const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, actionCfg.stamina, actionCfg.minutes, true);
    const check = performSkillCheck(player, village, actionCfg);
    const isForager = player.mainClass === 'forager';
    const forageLv = player.skills?.foraging?.level || 1;
    const isNight = (player.personalTime || 360) >= 1080;

    let inv = player.inventory;
    let box = village.warehouse;
    let msg = '';

    if (actionId === 'bush_treasure') {
      // 草叢尋寶：什麼都有（種子、原石、零錢、食材）
      if (check.isSuccess) {
        const treasurePool = [
          { itemId: 'rough_ore_gem', weight: 25 },
          { itemId: 'strange_stone', weight: 25 },
          { itemId: 'wild_mushroom', weight: 20 },
          { itemId: 'seed_tomato', weight: 15 },
          { itemId: 'egg', weight: 15 }
        ];
        const picked = pickWeighted(treasurePool);
        const cnt = check.isCritSuccess ? 2 : 1;
        ({ inventory: inv, warehouse: box } = giveItemsSmart(player, box, picked.itemId, cnt));
        const bonusMoney = check.isCritSuccess ? 120 : 40;
        msg = `在草叢裡翻出了「${ITEMS[picked.itemId].name} x${cnt}」與散落的 ${bonusMoney} 元零錢！`;
        village.sharedMoney = (village.sharedMoney || 0) + bonusMoney;
      } else {
        ({ inventory: inv, warehouse: box } = giveItemsSmart(player, box, 'birds_nest_fern', 1));
        msg = `在草叢翻找半天，只拔到一把「野生山蘇」。`;
      }
    } else {
      const rawPool = FORAGING_POOLS[actionId] || FORAGING_POOLS.chop_wood;
      const validPool = rawPool.filter(i => forageLv >= i.minSkill).map(i => ({
        ...i,
        weight: isNight && i.nightBonusWeight ? i.nightBonusWeight : i.weight
      }));

      if (check.isSuccess) {
        const picked = pickWeighted(validPool);
        let cnt = 1 + (isForager ? 1 : 0);
        if (check.isCritSuccess) cnt *= 2;
        ({ inventory: inv, warehouse: box } = giveItemsSmart(player, box, picked.itemId, cnt));
        msg = `採集獲得「${ITEMS[picked.itemId].name} x${cnt}」！`;
      } else if (!check.isCritFail) {
        const fallbackId = actionId === 'beach_combing' ? 'wakame' : actionId === 'mine_ore' ? 'stone' : 'acacia_wood';
        ({ inventory: inv, warehouse: box } = giveItemsSmart(player, box, fallbackId, 1));
        msg = `收穫不多，只撿回「${ITEMS[fallbackId].name} x1」。`;
      } else {
        msg = `在山林裡踩滑跌了一跤，什麼都沒帶回來！`;
      }
    }

    const xpRes = grantExperience(player, 'foraging', check.isCritSuccess ? 50 : check.isSuccess ? 30 : 14, 15);
    const logLine = `🪓 ${player.name} 執行【${actionCfg.name.split('（')[0]}】（d20=${check.roll}+${check.totalMod}=${check.totalScore} vs DC${check.effectiveDC}）：${msg}`;

    return {
      villageUpdates: {
        sharedMoney: village.sharedMoney,
        warehouse: box,
        activityLogs: prependLog(village.activityLogs, logLine, check.isCritSuccess)
      },
      playerUpdates: {
        stamina: nextStamina,
        personalTime: nextPersonalTime,
        inventory: inv,
        skills: xpRes.skills,
        level: xpRes.level,
        xp: xpRes.xp,
        freeStatPoints: xpRes.freeStatPoints
      },
      payload: { check, message: msg, levelUpNotes: xpRes.levelUpNotes }
    };
  });
}

// ============================================================================
// 四、 村莊大廚房（烹飪老湯與家常菜）＆ 鐵匠爐（打磨工具、鑑定原石、熔煉）
// ============================================================================

export async function actionCookRecipe(roomId, playerId, recipeId) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const recipe = COOKING_RECIPES.find(r => r.id === recipeId);
    if (!recipe) throw new Error('找不到該道食譜');

    const cookLv = player.skills?.cooking?.level || 1;
    if (cookLv < recipe.skillReq) {
      throw new Error(`需要烹飪與釀造 Lv.${recipe.skillReq} 才能料理「${ITEMS[recipe.resultId].name}」`);
    }

    const actionCfg = { ...LOCATION_ACTIONS.town.find(a => a.id === 'open_kitchen'), dc: recipe.dc };
    const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, actionCfg.stamina, actionCfg.minutes, false);
    let { inventory: inv, warehouse: box } = consumeItemsSmart(player, village.warehouse, recipe.ingredients);

    const check = performSkillCheck(player, village, actionCfg);
    const isChef = player.mainClass === 'chef';
    let msg = '';

    if (check.isSuccess) {
      let outCount = 1;
      if (check.isCritSuccess || (isChef && Math.random() < 0.25)) {
        outCount = 2;
      }
      ({ inventory: inv, warehouse: box } = giveItemsSmart({ ...player, inventory: inv }, box, recipe.resultId, outCount));
      msg = `香噴噴出爐！成功烹飪出「${ITEMS[recipe.resultId].name} x${outCount}」！`;
    } else {
      // 失敗不浪費食材：變成勉強能吃的家常大雜燴
      ({ inventory: inv, warehouse: box } = giveItemsSmart({ ...player, inventory: inv }, box, 'mystery_stew', 1));
      msg = `火候沒控制好煮糊了，變成「勉強能吃的家常大雜燴 x1」（還是能回體力喔）！`;
    }

    const xpRes = grantExperience(player, 'cooking', check.isCritSuccess ? 55 : check.isSuccess ? 32 : 15, 16);
    const logLine = `🍲 ${player.name} 下廚料理（d20=${check.roll}+${check.totalMod}=${check.totalScore} vs DC${check.effectiveDC}）：${msg}`;

    return {
      villageUpdates: {
        warehouse: box,
        activityLogs: prependLog(village.activityLogs, logLine, check.isCritSuccess)
      },
      playerUpdates: {
        stamina: nextStamina,
        personalTime: nextPersonalTime,
        inventory: inv,
        skills: xpRes.skills,
        level: xpRes.level,
        xp: xpRes.xp,
        freeStatPoints: xpRes.freeStatPoints
      },
      payload: { check, message: msg, levelUpNotes: xpRes.levelUpNotes }
    };
  });
}

export async function actionSmithing(roomId, playerId, mode, targetId = null) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const smithLv = player.skills?.smithing?.level || 1;
    const isBlacksmith = player.mainClass === 'blacksmith';

    // 模式 1：打磨保養全村工具
    if (mode === 'sharpen') {
      if (!isBlacksmith && smithLv < 3) {
        throw new Error('需要鐵匠本職或鍛造 Lv.3 以上才能打磨保養全村工具！');
      }
      if (village.toolsSharpenedToday) {
        throw new Error('今天全村的工具已經打磨得亮晶晶了！');
      }

      const actionCfg = LOCATION_ACTIONS.town.find(a => a.id === 'sharpen_tools');
      const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, actionCfg.stamina, actionCfg.minutes, false);
      const xpRes = grantExperience(player, 'smithing', 35, 15);
      const msg = '細心打磨保養了全村的農具、斧頭與釣竿，今日全村工作檢定 +1！';

      return {
        villageUpdates: {
          toolsSharpenedToday: true,
          activityLogs: prependLog(village.activityLogs, `✨ ${player.name} ${msg}`, true)
        },
        playerUpdates: {
          stamina: nextStamina,
          personalTime: nextPersonalTime,
          skills: xpRes.skills,
          level: xpRes.level,
          xp: xpRes.xp,
          freeStatPoints: xpRes.freeStatPoints
        },
        payload: { message: msg, levelUpNotes: xpRes.levelUpNotes }
      };
    }

    // 模式 2：鑑定怪石或原石
    if (mode === 'appraise') {
      const oreId = targetId || (getTotalItemCount(player, village.warehouse, 'rough_ore_gem') > 0 ? 'rough_ore_gem' : 'strange_stone');
      const poolRaw = APPRAISAL_POOL[oreId];
      if (!poolRaw) throw new Error('請選擇「奇怪的石頭」或「混濁的原石」進行鑑定');

      const actionCfg = LOCATION_ACTIONS.town.find(a => a.id === 'appraise_ore');
      const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, actionCfg.stamina, actionCfg.minutes, false);
      let { inventory: inv, warehouse: box } = consumeItemsSmart(player, village.warehouse, [{ itemId: oreId, count: 1 }]);

      const check = performSkillCheck(player, village, actionCfg);
      // 鐵匠或大成功提高稀有寶石權重
      const weightedPool = poolRaw.map((entry, idx) => ({
        ...entry,
        weight: (isBlacksmith || check.isCritSuccess) && idx >= 2 ? entry.weight * 1.8 : entry.weight
      }));

      const result = check.isCritFail ? poolRaw[0] : pickWeighted(weightedPool);
      ({ inventory: inv, warehouse: box } = giveItemsSmart({ ...player, inventory: inv }, box, result.itemId, 1));

      const xpRes = grantExperience(player, 'smithing', 38, 18);
      const msg = `敲開了「${ITEMS[oreId].name}」：${result.label}（獲得 ${ITEMS[result.itemId].name}）`;

      return {
        villageUpdates: {
          warehouse: box,
          activityLogs: prependLog(village.activityLogs, `🔮 ${player.name} 鑑定原石：${msg}`, result.itemId === 'taiwan_blue_sapphire')
        },
        playerUpdates: {
          stamina: nextStamina,
          personalTime: nextPersonalTime,
          inventory: inv,
          skills: xpRes.skills,
          level: xpRes.level,
          xp: xpRes.xp,
          freeStatPoints: xpRes.freeStatPoints
        },
        payload: { check, message: msg, levelUpNotes: xpRes.levelUpNotes }
      };
    }

    // 模式 3：熔煉金屬礦錠
    if (mode === 'smelt') {
      const smeltMap = {
        copper_bar: { reqLv: 1, oreId: 'copper_ore', oreCount: 3 },
        iron_bar: { reqLv: 4, oreId: 'iron_ore', oreCount: 3 },
        gold_bar: { reqLv: 7, oreId: 'gold_ore', oreCount: 3 }
      };
      const recipe = smeltMap[targetId || 'copper_bar'];
      if (!recipe) throw new Error('無效的熔煉目標');
      if (smithLv < recipe.reqLv) throw new Error(`需要鍛造 Lv.${recipe.reqLv} 才能熔煉「${ITEMS[targetId].name}」`);

      const actionCfg = LOCATION_ACTIONS.town.find(a => a.id === 'smelt_ore');
      const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, actionCfg.stamina, actionCfg.minutes, false);
      let { inventory: inv, warehouse: box } = consumeItemsSmart(player, village.warehouse, [{ itemId: recipe.oreId, count: recipe.oreCount }]);

      const check = performSkillCheck(player, village, actionCfg);
      const outCount = check.isCritSuccess ? 2 : 1;
      ({ inventory: inv, warehouse: box } = giveItemsSmart({ ...player, inventory: inv }, box, targetId || 'copper_bar', outCount));

      const xpRes = grantExperience(player, 'smithing', 32, 15);
      const msg = `成功熔煉出「${ITEMS[targetId || 'copper_bar'].name} x${outCount}」！`;

      return {
        villageUpdates: {
          warehouse: box,
          activityLogs: prependLog(village.activityLogs, `🔥 ${player.name} ${msg}`, check.isCritSuccess)
        },
        playerUpdates: {
          stamina: nextStamina,
          personalTime: nextPersonalTime,
          inventory: inv,
          skills: xpRes.skills,
          level: xpRes.level,
          xp: xpRes.xp,
          freeStatPoints: xpRes.freeStatPoints
        },
        payload: { check, message: msg, levelUpNotes: xpRes.levelUpNotes }
      };
    }

    throw new Error('未知的鍛造操作');
  });
}

// ============================================================================
// 五、 村莊商業（雜貨採買、商人議價賣貨、NPC 聊天人氣王送禮、每日刮刮樂）
// ============================================================================

export async function actionBuyFromShop(roomId, playerId, itemId, quantity = 1) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const itemDef = ITEMS[itemId];
    if (!itemDef || !itemDef.buyPrice) throw new Error('該商品目前未開放購買');

    const isMerchant = player.mainClass === 'merchant';
    const commerceLv = player.skills?.commerce?.level || 1;
    let discount = isMerchant ? 0.85 : 1.0;
    if (commerceLv >= 7) discount -= 0.1;

    const unitPrice = Math.max(1, Math.round(itemDef.buyPrice * discount));
    const totalCost = unitPrice * quantity;

    if ((village.sharedMoney || 0) < totalCost) {
      throw new Error(`全村公款不足（需要 ${totalCost} 元，目前公款 ${village.sharedMoney || 0} 元）`);
    }

    const { inventory: inv, warehouse: box } = giveItemsSmart(player, village.warehouse, itemId, quantity);
    const msg = `採買了「${itemDef.name} x${quantity}」（花費公款 ${totalCost} 元${discount < 1 ? '，已享商業折扣' : ''}）`;

    return {
      villageUpdates: {
        sharedMoney: village.sharedMoney - totalCost,
        warehouse: box,
        activityLogs: prependLog(village.activityLogs, `🛒 ${player.name} ${msg}`, false)
      },
      playerUpdates: { inventory: inv },
      payload: { message: msg }
    };
  });
}

export async function actionSellToNpc(roomId, playerId, npcId, itemId, quantity = 1, negotiate = false) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const npc = NPCS[npcId];
    const itemDef = ITEMS[itemId];
    if (!npc || !itemDef || !itemDef.sellPrice) throw new Error('無法出售該物品');

    // 行腳商人阿財只在每季第 7、14 天出現
    if (npc.appearDays && !npc.appearDays.includes(village.day)) {
      throw new Error(`${npc.name}今天不在村裡（每季第 7、14 天才會現身）！`);
    }

    let { inventory: inv, warehouse: box } = consumeItemsSmart(player, village.warehouse, [{ itemId, count: quantity }]);

    // 計算基礎倍率（季節趨勢 + NPC 偏好）
    let multiplier = 1.0;
    const trend = SEASON_TRENDS[village.season];
    if (trend && (trend.bonusItems.includes(itemId) || trend.bonusCategories.includes(itemDef.category))) {
      multiplier *= trend.multiplier;
    }
    if (npc.favoriteItems.includes(itemId)) {
      multiplier *= 1.25;
    } else if (npc.favoriteCategories.includes(itemDef.category)) {
      multiplier *= 1.1;
    }

    let check = null;
    let xpRes = null;
    let timeUpdates = {};

    if (negotiate) {
      const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, 5, 20, false);
      timeUpdates = { stamina: nextStamina, personalTime: nextPersonalTime };
      check = performSkillCheck(player, village, { stat: 'charisma', skill: 'commerce', dc: 12, isOutdoor: false });

      if (check.isCritSuccess) multiplier *= 1.5;
      else if (check.isSuccess) multiplier *= 1.25;
      else multiplier *= 0.95;

      xpRes = grantExperience(player, 'commerce', check.isCritSuccess ? 45 : 25, 14);
    }

    const totalEarned = Math.max(1, Math.round(itemDef.sellPrice * quantity * multiplier));
    const msg = `賣給【${npc.name}】「${itemDef.name} x${quantity}」，為全村賺進 ${totalEarned} 元公款！`;

    return {
      villageUpdates: {
        sharedMoney: (village.sharedMoney || 0) + totalEarned,
        warehouse: box,
        activityLogs: prependLog(village.activityLogs, `💰 ${player.name} ${msg}`, check?.isCritSuccess)
      },
      playerUpdates: {
        ...timeUpdates,
        inventory: inv,
        ...(xpRes ? { skills: xpRes.skills, level: xpRes.level, xp: xpRes.xp, freeStatPoints: xpRes.freeStatPoints } : {})
      },
      payload: { check, message: msg, levelUpNotes: xpRes?.levelUpNotes || [] }
    };
  });
}

export async function actionChatNpc(roomId, playerId, npcId) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const npc = NPCS[npcId];
    if (!npc) throw new Error('找不到該位村民');
    if (npc.appearDays && !npc.appearDays.includes(village.day)) {
      throw new Error(`${npc.name}今天不在村裡喔！`);
    }

    const greeting = npc.greetings[Math.floor(Math.random() * npc.greetings.length)];
    const isPopular = player.traits?.includes('popular');
    const usedMap = { ...(player.dailyNpcChatUsed || {}) };
    let inv = player.inventory;
    let box = village.warehouse;
    let giftText = '';

    // 特性「人氣王」：每天首次與該村民聊天獲得小禮物
    if (isPopular && !usedMap[npcId] && npc.popularGifts?.length) {
      usedMap[npcId] = true;
      const gift = npc.popularGifts[Math.floor(Math.random() * npc.popularGifts.length)];
      ({ inventory: inv, warehouse: box } = giveItemsSmart(player, box, gift.itemId, gift.count));
      giftText = `\n🌻【人氣王觸發】${gift.text}（獲得 ${ITEMS[gift.itemId].name} x${gift.count}）`;
    }

    const msg = `${npc.name}：${greeting}${giftText}`;
    return {
      villageUpdates: giftText
        ? {
            warehouse: box,
            activityLogs: prependLog(village.activityLogs, `🌻 ${player.name} 發揮人氣王魅力，從${npc.name}那裡收到了小禮物！`, false)
          }
        : null,
      playerUpdates: {
        dailyNpcChatUsed: usedMap,
        inventory: inv
      },
      payload: { message: msg }
    };
  });
}

export async function actionScratchCard(roomId, playerId) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    if (player.scratchUsedToday) {
      throw new Error('每人每天限刮一張刮刮樂，明天再來試手氣吧！');
    }
    if ((village.sharedMoney || 0) < SCRATCH_CARD_COST) {
      throw new Error(`全村公款不足 ${SCRATCH_CARD_COST} 元，無法購買刮刮樂！`);
    }

    let roll = rollD20();
    // 感知高者微幅提升運氣（不超過 20）
    if ((player.stats?.perception || 0) >= 3 && roll > 1 && roll < 20) {
      roll += 1;
    }

    const reward = SCRATCH_REWARDS.find(r => roll >= r.minRoll && roll <= r.maxRoll) || SCRATCH_REWARDS[1];
    let inv = player.inventory;
    let box = village.warehouse;

    if (reward.itemId && reward.count > 0) {
      ({ inventory: inv, warehouse: box } = giveItemsSmart(player, box, reward.itemId, reward.count));
    }

    const netMoney = (village.sharedMoney || 0) - SCRATCH_CARD_COST + (reward.money || 0);
    const msg = `🎟️ 刮刮樂幸運骰擲出【${roll}】！${reward.label}`;

    return {
      villageUpdates: {
        sharedMoney: netMoney,
        warehouse: box,
        activityLogs: prependLog(village.activityLogs, `${player.name} ${msg}`, Boolean(reward.broadcast))
      },
      playerUpdates: {
        scratchUsedToday: true,
        inventory: inv
      },
      payload: { roll, reward, message: msg }
    };
  });
}

// ============================================================================
// 六、 委託系統（季節委託＋村民保底交換、布告欄小委託、鎮村傳奇工程）
// ============================================================================

export async function contributeSeasonalQuest(roomId, playerId) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const sq = JSON.parse(JSON.stringify(village.seasonalQuest));
    if (!sq || sq.completed) throw new Error('本季全村委託已經完成了！');
    if (sq.itemsDelivered) throw new Error('所有物資皆已湊齊，請直接執行最終現場檢定！');

    let inv = player.inventory;
    let box = village.warehouse;
    const contributedNotes = [];

    for (const req of sq.requirements) {
      const needed = req.targetCount - req.currentCount;
      if (needed <= 0) continue;

      const available = getTotalItemCount({ ...player, inventory: inv }, box, req.itemId);
      if (available > 0) {
        const give = Math.min(needed, available);
        ({ inventory: inv, warehouse: box } = consumeItemsSmart({ ...player, inventory: inv }, box, [{ itemId: req.itemId, count: give }]));
        req.currentCount += give;
        contributedNotes.push(`${ITEMS[req.itemId].name} x${give}`);
      }
    }

    if (contributedNotes.length === 0) {
      throw new Error('背包與共用倉庫中目前沒有本季委託需要的物資喔！');
    }

    sq.itemsDelivered = sq.requirements.every(r => r.currentCount >= r.targetCount);
    const msg = `向本季全村委託投入了：${contributedNotes.join('、')}${sq.itemsDelivered ? '（物資全數湊齊，可進行最終檢定了！）' : ''}`;

    return {
      villageUpdates: {
        seasonalQuest: sq,
        warehouse: box,
        activityLogs: prependLog(village.activityLogs, `📦 ${player.name} ${msg}`, sq.itemsDelivered)
      },
      playerUpdates: { inventory: inv },
      payload: { message: msg }
    };
  });
}

export async function executeRescueBarter(roomId, playerId) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const sq = JSON.parse(JSON.stringify(village.seasonalQuest));
    const template = SEASONAL_QUESTS[village.season];
    if (!sq?.rescueBarterActive || sq.rescueBarterUsed) {
      throw new Error('目前沒有可執行的村民保底交換');
    }

    const barter = template.rescueBarter;
    if (barter.costMoney && (village.sharedMoney || 0) < barter.costMoney) {
      throw new Error(`全村公款不足 ${barter.costMoney} 元`);
    }

    let { inventory: inv, warehouse: box } = consumeItemsSmart(player, village.warehouse, barter.costItems);
    ({ inventory: inv, warehouse: box } = giveItemsSmart({ ...player, inventory: inv }, box, barter.giveItemId, barter.giveCount));

    sq.rescueBarterUsed = true;
    const npcName = NPCS[barter.npcId]?.name || '熱心村民';
    const msg = `透過【${npcName}】的保底交換，順利換到了「${ITEMS[barter.giveItemId].name} x${barter.giveCount}」！`;

    return {
      villageUpdates: {
        sharedMoney: (village.sharedMoney || 0) - (barter.costMoney || 0),
        seasonalQuest: sq,
        warehouse: box,
        activityLogs: prependLog(village.activityLogs, `🤝 ${player.name} ${msg}`, true)
      },
      playerUpdates: { inventory: inv },
      payload: { message: msg }
    };
  });
}

/**
 * 完成本季全村委託最終檢定：成功後「全村所有成員（含離線者）」永久獲得 +1 能力點！
 */
export async function completeSeasonalQuestCheck(roomId, playerId, allPlayersSnapshot) {
  const roomRef = doc(db, 'rooms', roomId);

  return await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) throw new Error('找不到房間');
    const village = roomSnap.data();

    const sq = JSON.parse(JSON.stringify(village.seasonalQuest));
    const template = SEASONAL_QUESTS[village.season];
    if (!sq || sq.completed) throw new Error('本季委託已完成！');
    if (!sq.itemsDelivered) throw new Error('請先湊齊所有委託物資！');

    const latestPlayers = [];
    for (const p of allPlayersSnapshot) {
      const pRef = doc(db, 'rooms', roomId, 'players', p.id);
      const pSnap = await tx.get(pRef);
      if (pSnap.exists()) latestPlayers.push({ id: pSnap.id, ref: pRef, ...pSnap.data() });
    }

    const me = latestPlayers.find(p => p.id === playerId);
    if (!me) throw new Error('找不到玩家資料');

    const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(me, village, 12, 40, false);
    const check = performSkillCheck(me, village, {
      stat: template.finalCheck.stat,
      skill: template.finalCheck.skill,
      dc: template.finalCheck.dc,
      isOutdoor: false
    });

    if (!check.isSuccess) {
      const failMsg = `執行【${template.finalCheck.label}】差了一點點（d20=${check.roll}+${check.totalMod}=${check.totalScore} vs DC${check.effectiveDC}），物資完好無損，隨時可再挑戰！`;
      tx.update(roomRef, { activityLogs: prependLog(village.activityLogs, `⚠️ ${me.name} ${failMsg}`, false) });
      tx.update(me.ref, { stamina: nextStamina, personalTime: nextPersonalTime, lastActiveAt: Date.now() });
      return { check, message: failMsg, levelUpNotes: [] };
    }

    // 檢定成功！全村所有成員（含離線者）永久 +1 對應基礎能力
    const rewardStat = template.rewardStat;
    for (const member of latestPlayers) {
      const nextStats = { ...(member.stats || {}) };
      nextStats[rewardStat] = (nextStats[rewardStat] || 0) + 1;
      const nextMaxStam = GAME_CONSTANTS.BASE_STAMINA + (nextStats.physique || 0) * GAME_CONSTANTS.STAMINA_PER_PHYSIQUE;

      const memberUpdates = {
        stats: nextStats,
        maxStamina: nextMaxStam
      };
      if (member.id === me.id) {
        memberUpdates.stamina = nextStamina;
        memberUpdates.personalTime = nextPersonalTime;
        memberUpdates.lastActiveAt = Date.now();
      }
      tx.update(member.ref, memberUpdates);
    }

    sq.completed = true;
    const vXp = grantVillageXp(village, 120);
    const successMsg = `🎊【${template.title}】圓滿達成！全村所有成員（含離線家人）永久獲得「${template.rewardStatName} +1」！`;

    tx.update(roomRef, {
      seasonalQuest: sq,
      villageLevel: vXp.villageLevel,
      villageXp: vXp.villageXp,
      activityLogs: prependLog(village.activityLogs, successMsg, true)
    });

    return { check, message: successMsg, levelUpNotes: [] };
  });
}

/**
 * 推進或完成布告欄無期限小委託（支援繳交物資型 & 現場檢定幫忙型）
 */
export async function interactBulletinQuest(roomId, playerId, questIndex) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const board = JSON.parse(JSON.stringify(village.bulletinQuests || []));
    const entry = board[questIndex];
    if (!entry) throw new Error('找不到該則布告欄委託');

    const questDef = BULLETIN_QUEST_POOL.find(q => q.id === entry.id);
    if (!questDef) throw new Error('委託資料異常');

    let inv = player.inventory;
    let box = village.warehouse;
    let timeUpdates = {};
    let check = null;
    let completed = false;
    let progressNote = '';

    if (questDef.type === 'delivery' || questDef.type === 'craft_quality') {
      const progress = { ...(entry.progress || {}) };
      let contributedAny = false;

      for (const req of questDef.reqItems) {
        const cur = progress[req.itemId] || 0;
        const need = req.count - cur;
        if (need <= 0) continue;

        const avail = getTotalItemCount({ ...player, inventory: inv }, box, req.itemId);
        if (avail > 0) {
          const give = Math.min(need, avail);
          ({ inventory: inv, warehouse: box } = consumeItemsSmart({ ...player, inventory: inv }, box, [{ itemId: req.itemId, count: give }]));
          progress[req.itemId] = cur + give;
          contributedAny = true;
        }
      }

      if (!contributedAny) {
        throw new Error('背包與共用倉庫中目前沒有這張委託需要的物品喔！');
      }

      entry.progress = progress;
      completed = questDef.reqItems.every(r => (progress[r.itemId] || 0) >= r.count);
      progressNote = completed ? '湊齊並完成了委託！' : '投入了部分委託物資！';
    } else {
      // 現場檢定幫忙型 (check) 或跑腿交涉型 (errand)
      if (questDef.targetLocation && player.location !== questDef.targetLocation) {
        throw new Error(`請先切換地點前往指定場所再執行此委託！`);
      }
      const { nextStamina, nextPersonalTime } = consumeStaminaAndTime(player, village, questDef.staminaCost || 10, 30, false);
      timeUpdates = { stamina: nextStamina, personalTime: nextPersonalTime };
      check = performSkillCheck(player, village, { ...questDef.check, isOutdoor: false });

      if (!check.isSuccess) {
        const failMsg = `嘗試執行布告欄委託【${questDef.title}】但未達標（d20=${check.roll}+${check.totalMod}=${check.totalScore} vs DC${check.effectiveDC}），下次再試！`;
        return {
          villageUpdates: { activityLogs: prependLog(village.activityLogs, `📋 ${player.name} ${failMsg}`, false) },
          playerUpdates: timeUpdates,
          payload: { check, message: failMsg, levelUpNotes: [] }
        };
      }
      completed = true;
      progressNote = '順利通過現場檢定，完成了委託！';
    }

    let nextMoney = village.sharedMoney || 0;
    let vXp = { villageLevel: village.villageLevel || 1, villageXp: village.villageXp || 0 };
    let xpRes = null;

    if (completed) {
      board.splice(questIndex, 1); // 移除已完成委託，隔天早上自動補新題目
      nextMoney += questDef.reward.money || 0;
      vXp = grantVillageXp(village, questDef.reward.villageXp || 30);
      xpRes = grantExperience(player, questDef.reward.skill, questDef.reward.skillXp || 30, 18);

      if (questDef.reward.bonusItem) {
        ({ inventory: inv, warehouse: box } = giveItemsSmart(
          { ...player, inventory: inv },
          box,
          questDef.reward.bonusItem.itemId,
          questDef.reward.bonusItem.count
        ));
      }
    }

    const msg = `布告欄委託【${questDef.title}】：${progressNote}${completed ? `（全村獲得 ${questDef.reward.money} 元公款！）` : ''}`;
    return {
      villageUpdates: {
        bulletinQuests: board,
        sharedMoney: nextMoney,
        villageLevel: vXp.villageLevel,
        villageXp: vXp.villageXp,
        warehouse: box,
        activityLogs: prependLog(village.activityLogs, `📋 ${player.name} ${msg}`, completed)
      },
      playerUpdates: {
        ...timeUpdates,
        inventory: inv,
        ...(xpRes ? { skills: xpRes.skills, level: xpRes.level, xp: xpRes.xp, freeStatPoints: xpRes.freeStatPoints } : {})
      },
      payload: { check, message: msg, levelUpNotes: xpRes?.levelUpNotes || [] }
    };
  });
}

export async function contributeLegendaryProject(roomId, playerId) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    if (village.legendaryCompleted) throw new Error('鎮村傳奇工程「山海傳家冠」已經打造完成囉！');

    const progress = { ...(village.legendaryProgress || {}) };
    let inv = player.inventory;
    let box = village.warehouse;
    const notes = [];

    for (const req of LEGENDARY_PROJECT.requirements) {
      const cur = progress[req.itemId] || 0;
      const need = req.count - cur;
      if (need <= 0) continue;

      const avail = getTotalItemCount({ ...player, inventory: inv }, box, req.itemId);
      if (avail > 0) {
        const give = Math.min(need, avail);
        ({ inventory: inv, warehouse: box } = consumeItemsSmart({ ...player, inventory: inv }, box, [{ itemId: req.itemId, count: give }]));
        progress[req.itemId] = cur + give;
        notes.push(`${ITEMS[req.itemId].name} x${give}`);
      }
    }

    if (notes.length === 0) throw new Error('目前沒有傳奇工程所需的稀有材料喔！');

    const allReady = LEGENDARY_PROJECT.requirements.every(r => (progress[r.itemId] || 0) >= r.count);
    let completed = false;
    let check = null;

    if (allReady) {
      check = performSkillCheck(player, village, { ...LEGENDARY_PROJECT.finalCheck, isOutdoor: false });
      if (check.isSuccess) completed = true;
    }

    const msg = completed
      ? `👑 全村轟動！【${LEGENDARY_PROJECT.title}】正式完工！全村永久獲得「豐年祭慶典」檢定 +1 祝福！`
      : `為【${LEGENDARY_PROJECT.title}】投入了珍貴材料：${notes.join('、')}`;

    return {
      villageUpdates: {
        legendaryProgress: progress,
        legendaryCompleted: completed,
        warehouse: box,
        activityLogs: prependLog(village.activityLogs, msg, true)
      },
      playerUpdates: { inventory: inv },
      payload: { check, message: msg }
    };
  });
}

// ============================================================================
// 七、 食用料理回體力、背包與共用倉庫整理、分配自由能力點
// ============================================================================

export async function eatFoodItem(roomId, playerId, itemId, fromWarehouse = false) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const itemDef = ITEMS[itemId];
    if (!itemDef || !itemDef.staminaRestore) throw new Error('這個物品不能直接食用喔！');

    const nextInv = JSON.parse(JSON.stringify(player.inventory || []));
    const nextBox = { ...(village.warehouse || {}) };

    if (fromWarehouse) {
      if ((nextBox[itemId] || 0) <= 0) throw new Error('共用倉庫中沒有這道食物');
      nextBox[itemId] -= 1;
      if (nextBox[itemId] <= 0) delete nextBox[itemId];
    } else {
      const idx = nextInv.findIndex(i => i.itemId === itemId);
      if (idx === -1) throw new Error('隨身背包中沒有這道食物');
      nextInv[idx].count -= 1;
      if (nextInv[idx].count <= 0) nextInv.splice(idx, 1);
    }

    let restore = itemDef.staminaRestore;
    // 冬季吃熱湯與進補料理效果翻倍
    if (village.season === 'winter' && itemDef.buff?.type === 'warm') {
      restore = Math.round(restore * 1.5);
    }

    const nextStamina = Math.min(player.maxStamina, player.stamina + restore);
    const nextBuffs = [...(player.dailyBuffs || [])];
    let curedCold = false;

    if (itemDef.buff) {
      if (!nextBuffs.some(b => b.type === itemDef.buff.type && b.desc === itemDef.buff.desc)) {
        nextBuffs.push(itemDef.buff);
      }
      if (itemDef.buff.type === 'warm' && player.isSick) {
        curedCold = true;
      }
    }

    const msg = `享用了「${itemDef.name}」，回復 ${restore} 點體力！${itemDef.buff ? `（獲得狀態：${itemDef.buff.desc}）` : ''}${curedCold ? '【小感冒痊癒了！】' : ''}`;

    return {
      villageUpdates: fromWarehouse ? { warehouse: nextBox } : null,
      playerUpdates: {
        stamina: nextStamina,
        inventory: nextInv,
        dailyBuffs: nextBuffs,
        isSick: curedCold ? false : player.isSick
      },
      payload: { message: msg }
    };
  });
}

export async function transferWarehouseItem(roomId, playerId, itemId, count, toWarehouse = true) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const nextInv = JSON.parse(JSON.stringify(player.inventory || []));
    const nextBox = { ...(village.warehouse || {}) };

    if (toWarehouse) {
      const idx = nextInv.findIndex(i => i.itemId === itemId);
      if (idx === -1) throw new Error('背包內找不到該物品');
      const moveCount = Math.min(count, nextInv[idx].count);
      nextInv[idx].count -= moveCount;
      if (nextInv[idx].count <= 0) nextInv.splice(idx, 1);
      nextBox[itemId] = (nextBox[itemId] || 0) + moveCount;
    } else {
      const avail = nextBox[itemId] || 0;
      if (avail <= 0) throw new Error('共用倉庫中沒有該物品');
      const moveCount = Math.min(count, avail);
      const cap = getBackpackCapacity(player);
      const existing = nextInv.find(i => i.itemId === itemId);
      if (!existing && nextInv.length >= cap) {
        throw new Error(`隨身背包已滿（上限 ${cap} 格），請先清空或存入其他物品！`);
      }
      nextBox[itemId] -= moveCount;
      if (nextBox[itemId] <= 0) delete nextBox[itemId];
      if (existing) existing.count += moveCount;
      else nextInv.push({ itemId, count: moveCount });
    }

    return {
      villageUpdates: { warehouse: nextBox },
      playerUpdates: { inventory: nextInv },
      payload: { message: '物品移動完成' }
    };
  });
}

export async function depositAllToWarehouse(roomId, playerId) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    const nextInv = [];
    const nextBox = { ...(village.warehouse || {}) };
    let movedCount = 0;

    for (const item of player.inventory || []) {
      if (ITEMS[item.itemId]?.category === 'tool') {
        nextInv.push(item); // 專屬工具保留在身上
      } else {
        nextBox[item.itemId] = (nextBox[item.itemId] || 0) + item.count;
        movedCount += item.count;
      }
    }

    if (movedCount === 0) throw new Error('背包裡沒有可存入倉庫的物資（隨身工具會自動保留）');

    return {
      villageUpdates: { warehouse: nextBox },
      playerUpdates: { inventory: nextInv },
      payload: { message: `一鍵將 ${movedCount} 件物資全部存入共用大倉庫！` }
    };
  });
}

export async function allocateFreeStatPoint(roomId, playerId, statKey) {
  return await runGameTransaction(roomId, playerId, (village, player) => {
    if ((player.freeStatPoints || 0) <= 0) throw new Error('目前沒有可分配的自由能力點');
    if (!STATS[statKey]) throw new Error('無效的能力項目');

    const nextStats = { ...(player.stats || {}) };
    nextStats[statKey] = (nextStats[statKey] || 0) + 1;
    const nextMaxStam = GAME_CONSTANTS.BASE_STAMINA + (nextStats.physique || 0) * GAME_CONSTANTS.STAMINA_PER_PHYSIQUE;

    return {
      playerUpdates: {
        stats: nextStats,
        freeStatPoints: player.freeStatPoints - 1,
        maxStamina: nextMaxStam,
        stamina: statKey === 'physique' ? player.stamina + 10 : player.stamina
      },
      payload: { message: `已將「${STATS[statKey].name}」提升至 +${nextStats[statKey]}！` }
    };
  });
}