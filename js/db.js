// 資料庫讀寫、onSnapshot 即時監聽、防搶衝突 Transaction
// js/db.js

import {
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

import { db } from './firebase-config.js';
import { GAME_CONSTANTS, CLASSES } from '../data/classes-traits.js';
import { ITEMS } from '../data/items-recipes.js';
import { WEATHER_TYPES, ANIMAL_TYPES } from '../data/skills-actions.js';
import { SEASONAL_QUESTS, LEGENDARY_PROJECT, BULLETIN_QUEST_POOL } from '../data/npcs-quests.js';

const ONLINE_TIMEOUT_MS = 10 * 60 * 1000; // 10 分鐘內有操作視為「在線」
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * 訂閱房間共用狀態與全體村民資料
 */
export function subscribeRoom(roomId, onVillageUpdate, onPlayersUpdate) {
  const roomRef = doc(db, 'rooms', roomId);
  const playersCol = collection(db, 'rooms', roomId, 'players');

  const unsubRoom = onSnapshot(roomRef, (snap) => {
    if (snap.exists()) {
      onVillageUpdate(snap.data());
    }
  });

  const unsubPlayers = onSnapshot(playersCol, (snap) => {
    const players = [];
    snap.forEach((d) => players.push({ id: d.id, ...d.data() }));
    players.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    onPlayersUpdate(players);
  });

  return () => {
    unsubRoom();
    unsubPlayers();
  };
}

/**
 * 初始化或取得家庭房間
 */
export async function initOrGetRoom(roomId) {
  const roomRef = doc(db, 'rooms', roomId);
  const snap = await getDoc(roomRef);
  if (snap.exists()) {
    return snap.data();
  }

  // 建立初始農場格子（6 格已開墾、6 格荒廢待開墾）
  const farmPlots = [];
  for (let i = 0; i < 12; i++) {
    farmPlots.push({
      index: i,
      cleared: i < 6,
      cropId: null,
      daysGrown: 0,
      isWatered: false,
      qualityBonus: false
    });
  }

  // 初始季節委託（春）
  const initialSeasonalQuest = buildSeasonalQuestState('spring', 1);
  // 初始布告欄 3 則小委託
  const initialBulletin = pickNewBulletinQuests('spring', 1, [], []);

  const initialVillage = {
    roomId,
    season: 'spring',
    day: 1,
    weather: 'sunny',
    tomorrowWeather: 'cloudy',
    sharedMoney: 400, // 基礎 400，每位村民加入再 +300
    villageLevel: 1,
    villageXp: 0,
    toolsSharpenedToday: false,
    legendaryCompleted: false,
    legendaryProgress: {},
    seasonalQuest: initialSeasonalQuest,
    bulletinQuests: initialBulletin,
    recentQuestIds: initialBulletin.map(q => q.id),
    farmPlots,
    livestock: [
      {
        id: 'starter_chicken_1',
        type: 'chicken',
        nickname: '小花雞',
        intimacy: 10,
        fedToday: false,
        daysSinceProduce: 0,
        productReady: true
      }
    ],
    warehouse: {
      seed_bok_choy: 4,
      seed_sweet_potato_leaves: 4,
      seasoning: 6,
      basic_feed: 6,
      worm_bait: 4
    },
    activityLogs: [
      {
        time: Date.now(),
        text: '🎉 歡迎來到家族合作農場！大家齊心協力把小鎮經營起來吧！',
        highlight: true
      }
    ],
    createdAt: Date.now()
  };

  await setDoc(roomRef, initialVillage);
  return initialVillage;
}

/**
 * 建立新角色（同時替全村公款 +300 啟動資金）
 */
export async function createPlayer(roomId, playerInput) {
  const roomRef = doc(db, 'rooms', roomId);
  const playerId = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const playerRef = doc(db, 'rooms', roomId, 'players', playerId);

  const physique = playerInput.stats.physique || 0;
  const maxStamina = GAME_CONSTANTS.BASE_STAMINA + physique * GAME_CONSTANTS.STAMINA_PER_PHYSIQUE;

  // 七大生活技能皆從 Lv.1 起跳，支援跨職無上限學習
  const skills = {
    farming: { level: 1, xp: 0 },
    ranching: { level: 1, xp: 0 },
    fishing: { level: 1, xp: 0 },
    foraging: { level: 1, xp: 0 },
    cooking: { level: 1, xp: 0 },
    smithing: { level: 1, xp: 0 },
    commerce: { level: 1, xp: 0 }
  };

  const classDef = CLASSES[playerInput.mainClass];
  const startingInventory = [];
  if (classDef?.startingItem) {
    startingInventory.push({ ...classDef.startingItem });
  }

  const newPlayer = {
    id: playerId,
    name: playerInput.name.trim(),
    avatarConfig: playerInput.avatarConfig,
    mainClass: playerInput.mainClass,
    traits: playerInput.traits || [],
    stats: playerInput.stats,
    freeStatPoints: 0,
    level: 1,
    xp: 0,
    skills,
    stamina: maxStamina,
    maxStamina,
    personalTime: 360, // 06:00 起床（以分鐘計算）
    location: 'farm',
    isSleeping: false,
    isSick: false,
    scratchUsedToday: false,
    dailyNpcChatUsed: {},
    dailyBuffs: [],
    inventory: startingInventory,
    lastActiveAt: Date.now(),
    createdAt: Date.now()
  };

  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) throw new Error('找不到該家庭房間');
    const village = roomSnap.data();

    const updatedMoney = (village.sharedMoney || 0) + 300;
    const logs = prependLog(
      village.activityLogs,
      `👋 新村民「${newPlayer.name}（${classDef?.name}）」加入村莊！全村公款增加 300 元。`,
      true
    );

    tx.set(playerRef, newPlayer);
    tx.update(roomRef, {
      sharedMoney: updatedMoney,
      activityLogs: logs
    });
  });

  return newPlayer;
}

/**
 * 更新玩家在線心跳與當前地點
 */
export async function updatePlayerPresence(roomId, playerId, extraFields = {}) {
  if (!roomId || !playerId) return;
  const playerRef = doc(db, 'rooms', roomId, 'players', playerId);
  await updateDoc(playerRef, {
    lastActiveAt: Date.now(),
    ...extraFields
  });
}

/**
 * 安全執行多人防搶衝突交易（Transaction）
 * updateCallback(village, player) 需回傳 { villageUpdates, playerUpdates }
 */
export async function runGameTransaction(roomId, playerId, updateCallback) {
  const roomRef = doc(db, 'rooms', roomId);
  const playerRef = doc(db, 'rooms', roomId, 'players', playerId);

  return await runTransaction(db, async (tx) => {
    const [roomSnap, playerSnap] = await Promise.all([tx.get(roomRef), tx.get(playerRef)]);
    if (!roomSnap.exists() || !playerSnap.exists()) {
      throw new Error('資料讀取失敗，請重新整理頁面');
    }

    const village = roomSnap.data();
    const player = { id: playerSnap.id, ...playerSnap.data() };

    const result = await updateCallback(village, player);
    if (!result) return null;

    if (result.villageUpdates) {
      tx.update(roomRef, result.villageUpdates);
    }
    if (result.playerUpdates) {
      tx.update(playerRef, {
        ...result.playerUpdates,
        lastActiveAt: Date.now()
      });
    }
    return result.payload || true;
  });
}

/**
 * 切換玩家上床睡覺狀態；若在線玩家全數睡覺則自動執行換日結算
 */
export async function goToSleepAndMaybeAdvanceDay(roomId, playerId, allPlayersSnapshot, forceAFK = false) {
  const roomRef = doc(db, 'rooms', roomId);
  const now = Date.now();

  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) return;
    const village = roomSnap.data();

    // 讀取最新所有玩家狀態
    const latestPlayers = [];
    for (const p of allPlayersSnapshot) {
      const pRef = doc(db, 'rooms', roomId, 'players', p.id);
      const pSnap = await tx.get(pRef);
      if (pSnap.exists()) {
        latestPlayers.push({ id: pSnap.id, ref: pRef, ...pSnap.data() });
      }
    }

    const me = latestPlayers.find(p => p.id === playerId);
    if (!me) return;
    me.isSleeping = true;
    me.lastActiveAt = now;
    tx.update(me.ref, { isSleeping: true, lastActiveAt: now });

    // 判斷誰是「目前在線玩家」（10 分鐘內有操作）
    const activePlayers = latestPlayers.filter(
      p => p.id === playerId || (now - (p.lastActiveAt || 0) <= ONLINE_TIMEOUT_MS)
    );

    const allActiveSleeping = activePlayers.every(p => p.isSleeping);

    if (allActiveSleeping || forceAFK) {
      const { villageUpdates, playerUpdatesList, summaryLog } = computeNextDayState(
        village,
        latestPlayers,
        now
      );

      villageUpdates.activityLogs = prependLog(village.activityLogs, summaryLog, true);
      tx.update(roomRef, villageUpdates);

      for (const pu of playerUpdatesList) {
        tx.update(pu.ref, pu.updates);
      }
    } else {
      const waitingNames = activePlayers.filter(p => !p.isSleeping).map(p => p.name).join('、');
      const logs = prependLog(
        village.activityLogs,
        `🛏️ ${me.name} 已上床休息（等待在線家人：${waitingNames}）`,
        false
      );
      tx.update(roomRef, { activityLogs: logs });
    }
  });
}

// ================= 內部輔助與換日結算演算法 =================

export function prependLog(existingLogs = [], text, highlight = false) {
  const next = [{ time: Date.now(), text, highlight }, ...existingLogs];
  return next.slice(0, 30);
}

function buildSeasonalQuestState(season, recentActiveCount) {
  const template = SEASONAL_QUESTS[season];
  const factor = Math.max(1, recentActiveCount);
  const requirements = template.requirements.map(req => ({
    itemId: req.itemId,
    targetCount: Math.max(req.minCount, req.perPlayerCount * factor),
    currentCount: 0
  }));

  return {
    questId: template.id,
    season,
    requirements,
    itemsDelivered: false,
    completed: false,
    rescueBarterActive: false,
    rescueBarterUsed: false
  };
}

function pickNewBulletinQuests(season, villageLevel, currentIds = [], recentIds = []) {
  const candidates = BULLETIN_QUEST_POOL.filter(q =>
    q.seasons.includes(season) &&
    q.minVillageLv <= villageLevel &&
    !currentIds.includes(q.id) &&
    !recentIds.includes(q.id)
  );

  const pool = candidates.length >= 3
    ? candidates
    : BULLETIN_QUEST_POOL.filter(q => q.seasons.includes(season) && !currentIds.includes(q.id));

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map(q => ({
    id: q.id,
    progress: {} // 紀錄已繳交材料數量
  }));
}

function rollWeatherForSeason(season, prevWeather) {
  if (prevWeather === 'typhoon_warning') return 'typhoon';
  const pool = Object.values(WEATHER_TYPES).filter(w => w.seasons.includes(season) && w.weight > 0);
  const totalWeight = pool.reduce((sum, w) => sum + w.weight, 0);
  let r = Math.random() * totalWeight;
  for (const w of pool) {
    r -= w.weight;
    if (r <= 0) return w.id;
  }
  return 'sunny';
}

function computeNextDayState(village, allPlayers, now) {
  const seasonOrder = ['spring', 'summer', 'autumn', 'winter'];
  let nextDay = (village.day || 1) + 1;
  let nextSeason = village.season || 'spring';
  let seasonChanged = false;

  if (nextDay > GAME_CONSTANTS.DAYS_PER_SEASON) {
    nextDay = 1;
    const idx = seasonOrder.indexOf(nextSeason);
    nextSeason = seasonOrder[(idx + 1) % seasonOrder.length];
    seasonChanged = true;
  }

  // 推進天氣
  const todayWeather = village.tomorrowWeather || rollWeatherForSeason(nextSeason, village.weather);
  const tomorrowWeather = rollWeatherForSeason(nextSeason, todayWeather);
  const weatherDef = WEATHER_TYPES[todayWeather];
  const isRaining = Boolean(weatherDef?.autoWater);
  const isTyphoon = todayWeather === 'typhoon';

  // 更新農田生長
  const nextPlots = (village.farmPlots || []).map(plot => {
    if (!plot.cleared || !plot.cropId) {
      return { ...plot, isWatered: isRaining };
    }
    let nextGrown = plot.daysGrown + (plot.isWatered ? 1 : 0);
    // 颱風天戶外未收成作物有 50% 機率受損倒退 1 天成長
    if (isTyphoon && Math.random() < 0.5) {
      nextGrown = Math.max(0, nextGrown - 1);
    }
    return {
      ...plot,
      daysGrown: nextGrown,
      isWatered: isRaining // 若今天下雨自動幫全村澆水
    };
  });

  // 更新牧場動物
  const nextLivestock = (village.livestock || []).map(animal => {
    const def = ANIMAL_TYPES[animal.type];
    const nextDays = animal.fedToday ? (animal.daysSinceProduce || 0) + 1 : animal.daysSinceProduce || 0;
    const ready = animal.productReady || (def && nextDays >= def.prodDays);
    return {
      ...animal,
      fedToday: false,
      daysSinceProduce: ready ? 0 : nextDays,
      productReady: ready,
      intimacy: animal.fedToday ? animal.intimacy : Math.max(0, (animal.intimacy || 0) - 2)
    };
  });

  // 計算近 3 日活躍人數
  const recentActiveCount = allPlayers.filter(
    p => now - (p.lastActiveAt || 0) <= THREE_DAYS_MS
  ).length;

  // 處理季節委託（換季重置 or 第 11 天村民上門保底交換）
  let nextSeasonalQuest = { ...village.seasonalQuest };
  let rescueNotice = '';
  if (seasonChanged) {
    nextSeasonalQuest = buildSeasonalQuestState(nextSeason, recentActiveCount);
  } else if (nextDay === 11 && !nextSeasonalQuest.completed && !nextSeasonalQuest.itemsDelivered) {
    nextSeasonalQuest.rescueBarterActive = true;
    rescueNotice = '｜村民上門打聽委託進度並提出保底交換！';
  }

  // 補足布告欄小委託至 3 則
  let nextBulletin = [...(village.bulletinQuests || [])];
  let recentIds = [...(village.recentQuestIds || [])];
  if (seasonChanged) {
    nextBulletin = pickNewBulletinQuests(nextSeason, village.villageLevel || 1, [], recentIds);
    recentIds = [...nextBulletin.map(q => q.id), ...recentIds].slice(0, 8);
  } else if (nextBulletin.length < 3) {
    const needed = 3 - nextBulletin.length;
    const added = pickNewBulletinQuests(
      nextSeason,
      village.villageLevel || 1,
      nextBulletin.map(q => q.id),
      recentIds
    ).slice(0, needed);
    nextBulletin = [...nextBulletin, ...added];
    recentIds = [...added.map(q => q.id), ...recentIds].slice(0, 8);
  }

  // 重置每位玩家的隔日狀態（處理晚睡懲罰 & 寒流小感冒）
  const wasColdWave = village.weather === 'cold_wave';
  const playerUpdatesList = allPlayers.map(p => {
    const maxStam = GAME_CONSTANTS.BASE_STAMINA + (p.stats?.physique || 0) * GAME_CONSTANTS.STAMINA_PER_PHYSIQUE;
    const sleptLate = (p.personalTime || 360) > 1440; // 超過 00:00
    const nextStamina = sleptLate ? Math.floor(maxStam * 0.75) : maxStam;

    const hadWarmBuff = (p.dailyBuffs || []).some(b => b.type === 'warm');
    const caughtCold = wasColdWave && !hadWarmBuff;

    return {
      ref: p.ref,
      updates: {
        maxStamina: maxStam,
        stamina: nextStamina,
        personalTime: 360, // 06:00
        isSleeping: false,
        isSick: caughtCold,
        scratchUsedToday: false,
        dailyNpcChatUsed: {},
        dailyBuffs: []
      }
    };
  });

  const seasonName = GAME_CONSTANTS.SEASONS.find(s => s.id === nextSeason)?.name || nextSeason;
  const summaryLog = `🐓 天亮了！進入【${seasonName} Day ${nextDay}】，今日天氣：${weatherDef?.icon} ${weatherDef?.name}${rescueNotice}`;

  return {
    villageUpdates: {
      season: nextSeason,
      day: nextDay,
      weather: todayWeather,
      tomorrowWeather,
      toolsSharpenedToday: false,
      seasonalQuest: nextSeasonalQuest,
      bulletinQuests: nextBulletin,
      recentQuestIds: recentIds,
      farmPlots: nextPlots,
      livestock: nextLivestock
    },
    playerUpdatesList,
    summaryLog
  };
}