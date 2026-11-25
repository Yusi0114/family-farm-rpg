// 簡化版 D&D 檢定：1d20 + 能力 + 本職 + 道具 vs DC
// js/dice-engine.js

import { CLASSES, STATS } from '../data/classes-traits.js';
import { LIFE_SKILLS, WEATHER_TYPES } from '../data/skills-actions.js';
import { DICE_FLAVOR_LOGS } from '../data/npcs-quests.js';

export function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

/**
 * 計算玩家執行某項檢定時的總加值、目標難度 DC 與預估成功率
 * @param {Object} player 玩家資料
 * @param {Object} villageState 全村狀態
 * @param {Object} actionConfig { stat, skill, dc, isOutdoor }
 */
export function calculateCheckModifiers(player, villageState, actionConfig) {
  const breakdown = [];
  let totalMod = 0;

  // 1. 基礎能力加值
  const statKey = actionConfig.stat;
  const statVal = player.stats?.[statKey] || 0;
  if (statVal !== 0) {
    totalMod += statVal;
    breakdown.push({ label: `${STATS[statKey]?.name || statKey}`, value: statVal });
  }

  // 2. 主職業本職加值 (+2)
  const playerClass = CLASSES[player.mainClass];
  if (playerClass && playerClass.relatedSkill === actionConfig.skill) {
    totalMod += playerClass.checkBonus;
    breakdown.push({ label: `${playerClass.name}專精`, value: playerClass.checkBonus });
  }

  const toolBonus = Number(actionConfig.toolBonus) || 0;
  if (toolBonus !== 0) {
    totalMod += toolBonus;
    breakdown.push({ label: '工具加值', value: toolBonus });
  }

  // 3. 生活技能熟練度階梯加值 (Lv.4 +1, Lv.7 +2, Lv.10 +3)
  const skillLevel = player.skills?.[actionConfig.skill]?.level || 1;
  const skillTierBonus = Math.floor((skillLevel - 1) / 3);
  if (skillTierBonus > 0) {
    totalMod += skillTierBonus;
    breakdown.push({ label: `${LIFE_SKILLS[actionConfig.skill]?.name}Lv.${skillLevel}`, value: skillTierBonus });
  }

  // 4. 鐵匠每日打磨保養增益 (+1)
  const toolSkills = ['farming', 'foraging', 'fishing', 'smithing'];
  if (villageState?.toolsSharpenedToday && toolSkills.includes(actionConfig.skill)) {
    totalMod += 1;
    breakdown.push({ label: '鐵匠打磨工具', value: 1 });
  }

  // 5. 當日料理增益 (all_check / fishing_bonus)
  const buffs = player.dailyBuffs || [];
  for (const buff of buffs) {
    if (buff.type === 'all_check' && buff.value) {
      totalMod += buff.value;
      breakdown.push({ label: '進補大餐', value: buff.value });
    } else if (buff.type === 'fishing_bonus' && actionConfig.skill === 'fishing') {
      totalMod += buff.value;
      breakdown.push({ label: '小管麵線精力', value: buff.value });
    } else if (
      buff.type === 'family_meal' &&
      Number.isFinite(buff.expiresAt) &&
      (player.personalTime || 360) < buff.expiresAt
    ) {
      totalMod += 1;
      breakdown.push({ label: '家人圍爐', value: 1 });
    }
  }

  // 6. 鎮村傳奇工程完成慶典 (+1)
  if (villageState?.legendaryCompleted) {
    totalMod += 1;
    breakdown.push({ label: '豐年祭慶典', value: 1 });
  }

  const villageCheckBonus = villageState?.villageBonuses?.check || 0;
  if (villageCheckBonus) {
    totalMod += villageCheckBonus;
    breakdown.push({ label: '山海博物誌收藏獎勵', value: villageCheckBonus });
  }

  // 7. 負面狀態：工作狂透支疲勞 (-3)
  if (player.stamina <= 0 && player.traits?.includes('workaholic')) {
    totalMod -= 3;
    breakdown.push({ label: '工作狂透支疲勞', value: -3 });
  }

  // 8. 負面狀態：寒流小感冒 (-1)
  if (player.isSick) {
    totalMod -= 1;
    breakdown.push({ label: '小感冒不適', value: -1 });
  }

  // 計算天氣對 DC 的影響（如綿綿細雨戶外採集/挖礦 DC +1）
  let effectiveDC = actionConfig.dc || 10;
  const weather = WEATHER_TYPES[villageState?.weather];
  if (actionConfig.isOutdoor && weather?.dcMod) {
    effectiveDC += weather.dcMod;
  }

  // 計算 1~20 中有幾個骰面會成功（20 必勝、1 必敗）
  let winningFaces = 0;
  for (let face = 1; face <= 20; face++) {
    if (face === 20) {
      winningFaces++;
    } else if (face === 1) {
      // 必敗
    } else if (face + totalMod >= effectiveDC) {
      winningFaces++;
    }
  }
  const successChance = Math.round((winningFaces / 20) * 100);

  return {
    totalMod,
    breakdown,
    effectiveDC,
    successChance
  };
}

/**
 * 執行一次完整的 D&D d20 檢定
 */
export function performSkillCheck(player, villageState, actionConfig) {
  const { totalMod, breakdown, effectiveDC, successChance } = calculateCheckModifiers(
    player,
    villageState,
    actionConfig
  );

  const roll = rollD20();
  const totalScore = roll + totalMod;
  const isCritSuccess = roll === 20;
  const isCritFail = roll === 1;
  const isSuccess = isCritSuccess ? true : isCritFail ? false : totalScore >= effectiveDC;

  let flavorText = '';
  if (isCritSuccess) {
    const pool = DICE_FLAVOR_LOGS.critSuccess;
    flavorText = pool[Math.floor(Math.random() * pool.length)];
  } else if (isCritFail) {
    const pool = DICE_FLAVOR_LOGS.critFail;
    flavorText = pool[Math.floor(Math.random() * pool.length)];
  }

  return {
    roll,
    totalMod,
    totalScore,
    effectiveDC,
    successChance,
    isCritSuccess,
    isCritFail,
    isSuccess,
    breakdown,
    flavorText
  };
}