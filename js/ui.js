// 畫面渲染、地點切換、動態跑馬燈、彈窗與按鈕事件綁定
// js/ui.js

import { soundFX } from './sound-fx.js';
import { getSkyLightingForMinutes, toDayTimelineMinutes, worldMap } from './world-map.js';
import { GAME_CONSTANTS, STATS, CLASSES, TRAITS } from '../data/classes-traits.js';
import { ITEM_CATEGORIES, ITEMS, COOKING_RECIPES, SEASON_TRENDS, TOOL_FORGE_RECIPES } from '../data/items-recipes.js';
import {
  SKILL_XP_THRESHOLDS,
  PERSONAL_XP_THRESHOLDS,
  LIFE_SKILLS,
  WEATHER_TYPES,
  LOCATIONS,
  LOCATION_ACTIONS,
  FISHING_POOL,
  ANIMAL_TYPES,
  SCRATCH_CARD_COST
} from '../data/skills-actions.js';
import { NPCS, SEASONAL_QUESTS, LEGENDARY_PROJECT, BULLETIN_QUEST_POOL } from '../data/npcs-quests.js';
import { auth } from './firebase-config.js';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

import { AVATAR_OPTIONS, getDefaultAvatarConfig, renderAvatarSVG, renderNpcAvatarSVG } from './avatar-svg.js';
import { calculateCheckModifiers } from './dice-engine.js';
import {
  subscribeRoom,
  initOrGetRoom,
  createPlayer,
  updatePlayerPresence,
  goToSleepAndMaybeAdvanceDay
} from './db.js';
import {
  getBackpackCapacity,
  getTotalItemCount,
  actionFarmPlot,
  actionRanchCare,
  actionBuyAnimal,
  actionFish,
  actionCraftBait,
  actionForageOrMine,
  actionCookRecipe,
  actionSmithing,
  actionBuyFromShop,
  actionSellToNpc,
  actionChatNpc,
  actionScratchCard,
  contributeSeasonalQuest,
  executeRescueBarter,
  completeSeasonalQuestCheck,
  interactBulletinQuest,
  contributeLegendaryProject,
  eatFoodItem,
  transferWarehouseItem,
  depositAllToWarehouse,
  allocateFreeStatPoint,
  actionRestFastForward,
  buildStarterToolsState,
  actionForgeTool
} from './game-logic.js';

// ============================================================================
// 一、 全域狀態與工具函式
// ============================================================================

const state = {
  roomId: localStorage.getItem('farm_room_id') || '2027HAPPY',
  playerId: localStorage.getItem('farm_player_id') || null,
  user: null,
  village: null,
  players: [],
  activeTab: 'action',
  warehouseCategory: 'all',
  selectedBait: '',
  settings: JSON.parse(localStorage.getItem('farm_user_settings') || 'null') || {
    controlMode: 'dual',
    joystickSide: 'left',
    moveSpeed: 'normal'
  },
  isConnecting: false,
  isActionBusy: false,
  passiveMinutesElapsed: 0,
  lastSyncedPersonalTime: null,
  passiveClockTimer: null,
  unsubRoom: null,
  heartbeatTimer: null
};

const ONLINE_TIMEOUT_MS = 10 * 60 * 1000;

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPersonalTime(totalMins = 360) {
  const isLate = totalMins > 1440;
  const normalized = totalMins % 1440;
  const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mm = String(normalized % 60).padStart(2, '0');
  return {
    text: `${isLate ? '隔日 ' : ''}${hh}:${mm}`,
    isLate
  };
}

function getMe() {
  return state.players.find(p => p.id === state.playerId) || null;
}

function resetLocalPersonalClock() {
  state.passiveMinutesElapsed = 0;
  state.lastSyncedPersonalTime = 360;
  const me = getMe();
  if (me) {
    me.personalTime = 360;
    me.effectiveTime = 360;
  }
}

function getEffectivePersonalTime(player) {
  if (!player) return 360;
  const base = toDayTimelineMinutes(player.personalTime ?? 360);
  if (player.id !== state.playerId) return base;
  if (player.isSleeping) return base;
  const maxPassive = Math.max(0, 1560 - base);
  return base + Math.min(state.passiveMinutesElapsed, maxPassive);
}

function formatGameTime(totalMins) {
  const m = Math.floor(totalMins) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function startPassiveClockTimer() {
  if (state.passiveClockTimer) clearInterval(state.passiveClockTimer);

  state.passiveClockTimer = setInterval(() => {
    if (
      document.visibilityState !== 'visible' ||
      document.getElementById('game-view').classList.contains('hidden') ||
      !state.playerId ||
      !state.village
    ) return;

    const me = getMe();
    if (!me) return;

    if (me.isSleeping) return;

    const base = toDayTimelineMinutes(me.personalTime ?? 360);
    const maxPassive = Math.max(0, 1560 - base);
    state.passiveMinutesElapsed = Math.min(state.passiveMinutesElapsed + 1, maxPassive);
    const effMins = getEffectivePersonalTime(me);
    me.effectiveTime = effMins;

    const clockEl = document.getElementById('hud-clock-text');
    if (clockEl) clockEl.textContent = formatGameTime(effMins);
  }, 10 * 1000);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  const colorMap = {
    info: 'bg-stone-800 text-white border-stone-600',
    success: 'bg-emerald-700 text-white border-emerald-500',
    error: 'bg-red-600 text-white border-red-400'
  };
  el.className = `px-4 py-2.5 rounded-2xl shadow-lg border text-xs font-bold text-center transition-all duration-300 ${colorMap[type] || colorMap.info}`;
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

function setAuthFeedback(message) {
  const feedback = document.getElementById('auth-login-feedback');
  if (!feedback) return;

  feedback.textContent = message;
  feedback.className = 'mt-2 break-words text-center text-[11px] font-bold text-red-700';
  feedback.classList.toggle('hidden', !message);
}

function getGoogleAuthErrorMessage(err) {
  const host = window.location.hostname;
  if (err?.name === 'SecurityError') {
    return '瀏覽器封鎖了登入暫存，請使用一般瀏覽器視窗並允許網站儲存登入狀態。';
  }
  const messages = {
    'auth/unauthorized-domain': `網站網域「${host}」未加入 Firebase Authentication 的授權網域。`,
    'auth/operation-not-allowed': 'Firebase 尚未啟用 Google 登入 Provider。',
    'auth/network-request-failed': '網路連線失敗，請檢查網路後重試。',
    'auth/redirect-cancelled-by-user': '登入流程已取消。',
    'auth/popup-closed-by-user': 'Google 登入視窗已關閉，尚未完成登入。',
    'auth/popup-blocked': '瀏覽器封鎖了 Google 登入視窗，請允許此網站開啟彈出式視窗後重試。'
  };
  const code = err?.code || 'auth/unknown';
  return `${messages[code] || 'Google 登入失敗，請檢查 Firebase Authentication 設定。'}（${code}）`;
}

async function signOutGoogleAccount() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error(err);
    showToast(err.message || '登出失敗', 'error');
  }
}

/**
 * 統一包裝所有遊戲動作：處理錯誤提示、觸發 d20 擲骰動畫、顯示升級提示
 */
async function runAction(actionFn, options = {}) {
  if (state.isActionBusy) return;
  state.isActionBusy = true;

  try {
    const animation = options.animation;
    if (animation && worldMap.canvas && typeof worldMap.playActionAnimation === 'function') {
      const me = getMe();
      const staminaCost = getAdjustedActionStaminaCost(animation);
      const isWorkaholic = me?.traits?.includes('workaholic');
      const canAffordAnimation = !me
        || me.stamina >= staminaCost
        || (isWorkaholic && me.stamina - staminaCost >= -40);

      if (canAffordAnimation) {
        await worldMap.playActionAnimation({ ...animation, player: me });
      }
    }

    const res = await actionFn();
    if (!res) return;

    if (res.message && worldMap.canvas && typeof worldMap?.spawnFloatingText === 'function') {
      const m = res.message;
      const isFail = res.check && !res.check.isSuccess;
      const color = isFail
        ? '#fca5a5'
        : (m.includes('元') || m.includes('公款')) ? '#fde047'
        : m.includes('澆水') ? '#7dd3fc'
        : (m.includes('好感') || m.includes('禮物')) ? '#fda4af'
        : '#86efac';
      const shortText = m.replace(/^[^：]+：/, '').split('！')[0].slice(0, 18);
      worldMap.spawnFloatingText(shortText, color);
    }

    if (res.check && !options.skipDice) {
      await showDiceAnimation(res.check, res.message, res.levelUpNotes);
    } else {
      if (res.message && (res.message.includes('元') || res.message.includes('公款')) && typeof soundFX !== 'undefined') {
        soundFX.playCoin();
      }
      if (res.message) showToast(res.message, 'success');
      if (res.levelUpNotes?.length) {
        res.levelUpNotes.forEach(note => showToast(note, 'success'));
      }
    }
    return res;
  } catch (err) {
    console.error(err);
    showToast(err.message || '操作發生錯誤', 'error');
    return null;
  } finally {
    state.isActionBusy = false;
  }
}

function getAdjustedActionStaminaCost(animation) {
  let cost = animation.staminaCost || 0;
  if (animation.isOutdoor) {
    const weather = WEATHER_TYPES[state.village?.weather];
    if (weather?.staminaMod) cost += weather.staminaMod;
    if (state.village?.season === 'summer' && !getMe()?.dailyBuffs?.some(buff => buff.type === 'cool_down')) cost += 1;
    if (state.village?.season === 'winter') cost += 1;
  }
  return Math.max(1, cost);
}

function renderIngredientStatus(ingredients, player, warehouse) {
  return ingredients.map(ingredient => {
    const item = ITEMS[ingredient.itemId];
    const ownedCount = getTotalItemCount(player, warehouse, ingredient.itemId);
    const enough = ownedCount >= ingredient.count;
    return `
      <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold ${
        enough ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
      }">
        ${item?.icon || '📦'} ${item?.name || ingredient.itemId} ${ownedCount}/${ingredient.count}
      </span>
    `;
  }).join('');
}

// ============================================================================
// 二、 登入房間、角色認領與紙娃娃創角器
// ============================================================================

async function connectToRoom(roomIdInput, autoLoginPlayerId = null) {
  if (state.isConnecting) return;
  if (!state.user) {
    showToast('請先使用 Google 帳號登入，再進入村莊！', 'error');
    return;
  }
  const cleanRoom = roomIdInput.trim().toUpperCase();
  if (!cleanRoom) {
    showToast('請輸入家庭房間代碼！', 'error');
    return;
  }

  state.isConnecting = true;
  state.roomId = cleanRoom;
  localStorage.setItem('farm_room_id', cleanRoom);

  const badge = document.getElementById('room-status-badge');
  if (badge) badge.textContent = '連線至村莊中...';

  if (state.unsubRoom) {
    state.unsubRoom();
    state.unsubRoom = null;
  }

  try {
    await initOrGetRoom(cleanRoom);
    if (document.visibilityState === 'hidden') {
      if (badge) badge.textContent = '背景中，已暫停連線';
      return;
    }

    state.unsubRoom = subscribeRoom(
      cleanRoom,
      (villageData) => {
        const prevDay = state.village?.day;
        const prevSeason = state.village?.season;
        state.village = villageData;

        if (prevDay !== undefined && (villageData.day !== prevDay || villageData.season !== prevSeason)) {
          resetLocalPersonalClock();
          if (typeof soundFX !== 'undefined') soundFX.playRooster();
        }
        if (getMe()) renderGameScreen();
      },
      (playersList) => {
        state.players = playersList;
        const meNow = playersList.find(p => p.id === state.playerId);
        if (meNow && meNow.ownerUid !== state.user?.uid) {
          state.playerId = null;
          localStorage.removeItem('farm_player_id');
        }
        if (meNow && typeof meNow.personalTime === 'number') {
          const incomingTimeline = toDayTimelineMinutes(meNow.personalTime);
          if (state.lastSyncedPersonalTime === null || incomingTimeline > state.lastSyncedPersonalTime) {
            state.lastSyncedPersonalTime = incomingTimeline;
            state.passiveMinutesElapsed = 0;
          } else if (incomingTimeline < state.lastSyncedPersonalTime) {
            meNow.personalTime = state.lastSyncedPersonalTime;
          }
          meNow.effectiveTime = getEffectivePersonalTime(meNow);
        }
        renderLoginPlayerCards();
        if (autoLoginPlayerId && playersList.some(
          p => p.id === autoLoginPlayerId && p.ownerUid === state.user?.uid
        )) {
          if (state.playerId !== autoLoginPlayerId || document.getElementById('game-view').classList.contains('hidden')) {
            enterGameAsPlayer(autoLoginPlayerId);
          } else if (getMe()?.ownerUid === state.user?.uid) {
            renderGameScreen();
          }
        } else if (getMe()?.ownerUid === state.user?.uid) {
          renderGameScreen();
        }
      }
    );
    if (badge) badge.textContent = `已連線房間：${cleanRoom}`;
  } catch (err) {
    console.error(err);
    if (badge) badge.textContent = '連線失敗，請檢查 Firebase 設定';
    showToast('無法連線至 Firebase，請確認設定是否正確', 'error');
  } finally {
    state.isConnecting = false;
  }
}

function renderLoginPlayerCards() {
  const container = document.getElementById('existing-players-list');
  if (!state.user) {
    container.innerHTML = `
      <div class="col-span-2 text-center py-6 bg-white/70 rounded-2xl border border-stone-200 text-xs text-stone-500">
        請先使用自己的 Google 帳號登入，再選擇或建立角色。
      </div>
    `;
    return;
  }
  if (!state.players.length) {
    container.innerHTML = `
      <div class="col-span-2 text-center py-6 bg-white/70 rounded-2xl border border-stone-200 text-xs text-stone-500">
        這個村莊還沒有居民，點擊下方按鈕建立第一位村民吧！
      </div>
    `;
    return;
  }

  container.innerHTML = state.players.map(p => {
    const cls = CLASSES[p.mainClass];
    const isOnline = Date.now() - (p.lastActiveAt || 0) <= ONLINE_TIMEOUT_MS;
    const canControl = p.ownerUid === state.user.uid;
    const ownershipStatus = canControl
      ? '你的角色'
      : p.ownerUid
        ? '由其他帳號管理'
        : '需管理員設定所有者';
    return `
      <button ${canControl ? `data-login-player="${p.id}"` : 'disabled'} class="bg-white ${canControl ? 'active:bg-emerald-50' : 'opacity-65'} border border-stone-200 rounded-2xl p-2.5 flex items-center gap-2.5 text-left shadow-xs transition">
        ${renderAvatarSVG(p.avatarConfig, 46)}
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-stone-300'}"></span>
            <span class="font-black text-sm text-stone-800 truncate">${escapeHtml(p.name)}</span>
          </div>
          <div class="text-[11px] text-stone-500 font-medium mt-0.5">${cls?.icon || ''} ${cls?.name || ''} · Lv.${p.level || 1}</div>
          <div class="text-[10px] ${canControl ? 'text-emerald-700' : 'text-amber-700'} font-bold mt-0.5">${ownershipStatus}</div>
        </div>
      </button>
    `;
  }).join('');

  container.querySelectorAll('[data-login-player]').forEach(btn => {
    btn.addEventListener('click', () => enterGameAsPlayer(btn.dataset.loginPlayer));
  });
}

function enterGameAsPlayer(playerId) {
  const player = state.players.find(p => p.id === playerId);
  if (!state.user || !player || player.ownerUid !== state.user.uid) {
    showToast('這個角色尚未指派給你的 Google 帳號，無法操作。', 'error');
    return;
  }
  if (state.playerId !== playerId) {
    state.passiveMinutesElapsed = 0;
    state.lastSyncedPersonalTime = null;
  }
  state.playerId = playerId;
  localStorage.setItem('farm_player_id', playerId);

  const me = getMe();
  if (me) {
    const starterCheck = buildStarterToolsState(me);
    if (starterCheck.changed) {
      me.inventory = starterCheck.inventory;
      me.tools = starterCheck.tools;
      updatePlayerPresence(state.roomId, me.id, {
        inventory: starterCheck.inventory,
        tools: starterCheck.tools
      }).catch(err => {
        console.error(err);
        showToast('補發基礎工具失敗，請檢查網路連線並重新登入', 'error');
      });
    }
  }

  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('game-view').classList.remove('hidden');

  updatePlayerPresence(state.roomId, playerId).catch(err => {
    console.error(err);
    showToast(err.message || '角色狀態同步失敗，請檢查網路連線', 'error');
  });
  startPassiveClockTimer();
  if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
  state.heartbeatTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && state.roomId && state.playerId) {
      const curMe = getMe();
      if (!curMe) return;
      updatePlayerPresence(state.roomId, state.playerId, {
        personalTime: getEffectivePersonalTime(curMe)
      }).catch(err => {
        console.error(err);
        showToast('同步個人時間失敗，請檢查網路連線', 'error');
      });
    }
  }, 3 * 60 * 1000);

  renderGameScreen();
}

// 創角表單暫存狀態
let draftChar = null;

function openCreateCharModal() {
  if (!state.user) {
    showToast('請先使用 Google 帳號登入，再建立角色。', 'error');
    return;
  }
  if (!state.village) {
    showToast('請先點擊「進入村莊」連線房間！', 'error');
    return;
  }

  draftChar = {
    name: '',
    avatarConfig: getDefaultAvatarConfig(),
    mainClass: 'farmer',
    traits: ['work_master'],
    stats: { physique: 1, knowledge: 1, perception: 1, charisma: 1 }
  };

  renderCreateCharForm();
  document.getElementById('create-char-modal').classList.remove('hidden');
}

function renderCreateCharForm() {
  const body = document.getElementById('create-char-body');
  const usedPoints = Object.values(draftChar.stats).reduce((a, b) => a + b, 0);
  const remainPoints = GAME_CONSTANTS.STARTING_FREE_STAT_POINTS - usedPoints;

  const avatarCategories = [
    { key: 'bgColor', label: '背景底色', list: AVATAR_OPTIONS.bgColors },
    { key: 'skinTone', label: '膚色', list: AVATAR_OPTIONS.skinTones },
    { key: 'hairStyle', label: '髮型', list: AVATAR_OPTIONS.hairStyles },
    { key: 'hairColor', label: '髮色', list: AVATAR_OPTIONS.hairColors },
    { key: 'eyes', label: '表情眼神', list: AVATAR_OPTIONS.eyes },
    { key: 'outfit', label: '服裝造型', list: AVATAR_OPTIONS.outfits },
    { key: 'accessory', label: '頭飾配件', list: AVATAR_OPTIONS.accessories }
  ];

  body.innerHTML = `
    <!-- 1. 紙娃娃即時預覽與名字 -->
    <div class="flex items-center gap-4 bg-amber-50 p-3 rounded-2xl border border-amber-200">
      <div id="draft-avatar-preview">${renderAvatarSVG(draftChar.avatarConfig, 84)}</div>
      <div class="flex-1 space-y-2">
        <label class="block text-xs font-bold text-stone-700">村民暱稱（如：爸爸、小美）</label>
        <input id="draft-name-input" type="text" maxlength="10" value="${escapeHtml(draftChar.name)}" placeholder="輸入你的稱呼"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-bold text-sm focus:outline-none focus:border-emerald-500" />
        <button type="button" id="btn-random-avatar" class="text-xs font-bold text-amber-800 bg-amber-200/80 px-2.5 py-1 rounded-lg">
          🎲 隨機搭配造型
        </button>
      </div>
    </div>

    <!-- 2. 紙娃娃部位切換 -->
    <div class="space-y-2">
      <div class="text-xs font-black text-stone-700">🎨 自訂紙娃娃外觀</div>
      <div class="grid grid-cols-1 gap-1.5 bg-stone-50 p-2.5 rounded-2xl border border-stone-200">
        ${avatarCategories.map(cat => {
          const curVal = draftChar.avatarConfig[cat.key];
          const curObj = cat.list.find(x => x.id === curVal) || cat.list[0];
          return `
            <div class="flex items-center justify-between text-xs py-0.5">
              <span class="font-bold text-stone-600 w-20">${cat.label}</span>
              <div class="flex items-center gap-2">
                <button type="button" data-av-prev="${cat.key}" class="w-7 h-7 rounded-lg bg-white border border-stone-300 font-bold">◀</button>
                <span class="w-24 text-center font-bold text-stone-800">${curObj.name}</span>
                <button type="button" data-av-next="${cat.key}" class="w-7 h-7 rounded-lg bg-white border border-stone-300 font-bold">▶</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- 3. 選擇主職業（享本職 +2 與專屬被動，其他技能仍可跨職無上限學習） -->
    <div class="space-y-2">
      <div class="text-xs font-black text-stone-700">🛠️ 選擇主職業（其他領域仍可跨職學習）</div>
      <div class="grid grid-cols-1 gap-1.5">
        ${Object.values(CLASSES).map(cls => {
          const selected = draftChar.mainClass === cls.id;
          return `
            <button type="button" data-pick-class="${cls.id}" class="p-2.5 rounded-xl border text-left transition ${selected ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-500' : 'border-stone-200 bg-white'}">
              <div class="flex items-center justify-between">
                <span class="font-black text-sm text-stone-800">${cls.icon} ${cls.name}</span>
                <span class="text-[11px] font-bold text-emerald-700">主屬性：${STATS[cls.primaryStat].name}</span>
              </div>
              <p class="text-[11px] text-stone-600 mt-1 leading-snug">${cls.passiveDesc}</p>
            </button>
          `;
        }).join('')}
      </div>
    </div>

    <!-- 4. 四大基礎能力配點（總共 4 點，單項最高 2 點） -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-stone-700">📊 分配初始能力點（單項上限 +2）</span>
        <span class="text-xs font-black px-2 py-0.5 rounded-full ${remainPoints === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-200 text-amber-900'}">
          剩餘點數：${remainPoints}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        ${Object.values(STATS).map(st => {
          const val = draftChar.stats[st.id];
          return `
            <div class="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs text-stone-800">${st.icon} ${st.name}</span>
                <div class="flex items-center gap-1.5">
                  <button type="button" data-stat-dec="${st.id}" class="w-6 h-6 rounded-md bg-white border border-stone-300 font-black text-xs">-</button>
                  <span class="font-black text-sm w-5 text-center text-emerald-700">+${val}</span>
                  <button type="button" data-stat-inc="${st.id}" class="w-6 h-6 rounded-md bg-white border border-stone-300 font-black text-xs">+</button>
                </div>
              </div>
              <p class="text-[10px] text-stone-500 mt-1 leading-tight">${st.desc}</p>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- 5. 選擇個性特性（最多可選 2 項） -->
    <div class="space-y-2">
      <div class="text-xs font-black text-stone-700">🌟 選擇天賦特性（可複選最多 2 項）</div>
      <div class="space-y-1.5">
        ${Object.values(TRAITS).map(tr => {
          const active = draftChar.traits.includes(tr.id);
          return `
            <button type="button" data-toggle-trait="${tr.id}" class="w-full p-2.5 rounded-xl border text-left transition ${active ? 'border-amber-500 bg-amber-50' : 'border-stone-200 bg-white'}">
              <div class="font-bold text-xs text-stone-800">${tr.icon} ${tr.name} ${active ? '✅' : ''}</div>
              <div class="text-[11px] text-stone-600 mt-0.5">${tr.desc}</div>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // 綁定表單互動事件
  document.getElementById('draft-name-input').addEventListener('input', (e) => {
    draftChar.name = e.target.value;
  });

  document.getElementById('btn-random-avatar').addEventListener('click', () => {
    for (const cat of avatarCategories) {
      const rand = cat.list[Math.floor(Math.random() * cat.list.length)];
      draftChar.avatarConfig[cat.key] = rand.id;
    }
    renderCreateCharForm();
  });

  body.querySelectorAll('[data-av-prev], [data-av-next]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.avPrev || btn.dataset.avNext;
      const dir = btn.dataset.avNext ? 1 : -1;
      const list = avatarCategories.find(c => c.key === key).list;
      const idx = list.findIndex(x => x.id === draftChar.avatarConfig[key]);
      const nextIdx = (idx + dir + list.length) % list.length;
      draftChar.avatarConfig[key] = list[nextIdx].id;
      renderCreateCharForm();
    });
  });

  body.querySelectorAll('[data-pick-class]').forEach(btn => {
    btn.addEventListener('click', () => {
      draftChar.mainClass = btn.dataset.pickClass;
      renderCreateCharForm();
    });
  });

  body.querySelectorAll('[data-stat-inc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.statInc;
      const used = Object.values(draftChar.stats).reduce((a, b) => a + b, 0);
      if (used < GAME_CONSTANTS.STARTING_FREE_STAT_POINTS && draftChar.stats[k] < GAME_CONSTANTS.MAX_STARTING_STAT) {
        draftChar.stats[k] += 1;
        renderCreateCharForm();
      }
    });
  });

  body.querySelectorAll('[data-stat-dec]').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.statDec;
      if (draftChar.stats[k] > 0) {
        draftChar.stats[k] -= 1;
        renderCreateCharForm();
      }
    });
  });

  body.querySelectorAll('[data-toggle-trait]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tid = btn.dataset.toggleTrait;
      const idx = draftChar.traits.indexOf(tid);
      if (idx !== -1) {
        draftChar.traits.splice(idx, 1);
      } else if (draftChar.traits.length < 2) {
        draftChar.traits.push(tid);
      } else {
        showToast('最多只能選擇 2 項特性喔！', 'info');
      }
      renderCreateCharForm();
    });
  });
}

async function handleSubmitCreateChar() {
  if (!state.user) {
    showToast('請先使用 Google 帳號登入，再建立角色。', 'error');
    return;
  }
  if (!draftChar.name.trim()) {
    showToast('請幫你的村民取一個暱稱！', 'error');
    return;
  }
  const used = Object.values(draftChar.stats).reduce((a, b) => a + b, 0);
  if (used < GAME_CONSTANTS.STARTING_FREE_STAT_POINTS) {
    showToast(`還有 ${GAME_CONSTANTS.STARTING_FREE_STAT_POINTS - used} 點能力點數尚未分配喔！`, 'error');
    return;
  }

  try {
    const created = await createPlayer(state.roomId, draftChar, state.user.uid);
    state.players = [...state.players, created];
    renderLoginPlayerCards();
    document.getElementById('create-char-modal').classList.add('hidden');
    showToast(`歡迎 ${created.name} 加入村莊！公款 +300 元`, 'success');
    enterGameAsPlayer(created.id);
  } catch (err) {
    showToast(err.message || '建立角色失敗', 'error');
  }
}

// ============================================================================
// 三、 主遊戲四區塊畫面渲染
// ============================================================================

function renderGameScreen() {
  const village = state.village;
  const me = getMe();
  if (!village || !me) return;

  renderTopHud(village, me);
  renderLocationBar(me);
  renderActivityTicker(village);
  updateNavBadges(village, me);

  if (state.activeTab === 'action') renderActionTab(village, me);
  else if (state.activeTab === 'bag') renderBagTab(village, me);
  else if (state.activeTab === 'quests') renderQuestsTab(village, me);
  else if (state.activeTab === 'character') renderCharacterTab(village, me);

  if (!document.getElementById('quest-board-modal')?.classList.contains('hidden')) {
    renderQuestsTab(village, me);
  }
}

function renderTopHud(village, me) {
  const seasonObj = GAME_CONSTANTS.SEASONS.find(s => s.id === village.season) || GAME_CONSTANTS.SEASONS[0];
  const weatherObj = WEATHER_TYPES[village.weather] || WEATHER_TYPES.sunny;
  const effectiveTime = typeof worldMap.previewMinutes === 'number'
    ? worldMap.getDisplayMinutes()
    : getEffectivePersonalTime(me);
  const timeInfo = formatPersonalTime(effectiveTime);
  const stamPct = Math.max(0, Math.min(100, Math.round((me.stamina / me.maxStamina) * 100)));

  const onlinePlayers = state.players.filter(
    p => p.id === me.id || (Date.now() - (p.lastActiveAt || 0) <= ONLINE_TIMEOUT_MS)
  );

  const hud = document.getElementById('top-hud');
  hud.innerHTML = `
    <div class="flex items-center justify-between gap-2">
      <!-- 左：季節天數與天氣 -->
      <button id="btn-weather-info" class="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl text-left">
        <span class="text-base">${seasonObj.icon}</span>
        <div>
          <div class="text-xs font-black text-stone-800">${seasonObj.name} Day ${village.day}/14</div>
          <div class="text-[10px] font-bold text-stone-600">${weatherObj.icon} ${weatherObj.name}</div>
        </div>
      </button>

      <!-- 右：共用公款與在線家人頭像 -->
      <div class="flex items-center gap-2">
        <div class="text-right">
          <div class="text-xs font-black text-amber-700">💰 ${(village.sharedMoney || 0).toLocaleString()}</div>
          <div class="text-[10px] font-bold text-stone-500">村莊 Lv.${village.villageLevel || 1}</div>
        </div>
        <div class="flex -space-x-1.5">
          ${onlinePlayers.map(p => `
            <div class="relative" title="${escapeHtml(p.name)}${p.isSleeping ? '（已睡覺）' : ''}">
              ${renderAvatarSVG(p.avatarConfig, 28)}
              <span class="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none">
                ${p.isSleeping ? '💤' : '🟢'}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- 第二排：個人時鐘、體力條與異常狀態 -->
    <div class="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-stone-100 text-xs">
      <div class="flex items-center gap-1 font-black ${timeInfo.isLate ? 'text-red-600 animate-pulse' : 'text-stone-700'}">
        <button id="btn-hud-rest-time" title="點擊免費歇息調整時段" class="px-2 py-0.5 rounded-lg bg-amber-50 font-black text-xs text-stone-800 active:scale-95 transition">
          🕒 <span id="hud-clock-text">${formatGameTime(effectiveTime)}</span> 🪑
        </button>
        ${timeInfo.isLate ? '<span>(晚睡警示)</span>' : ''}
      </div>

      <div class="flex-1 max-w-[170px] flex items-center gap-1.5">
        <span class="font-bold text-[11px] ${me.stamina <= 0 ? 'text-red-600' : 'text-emerald-700'}">⚡ ${me.stamina}/${me.maxStamina}</span>
        <div class="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
          <div class="h-full ${me.stamina <= 0 ? 'bg-red-500' : 'bg-emerald-500'} transition-all" style="width: ${stamPct}%"></div>
        </div>
      </div>

      <div class="flex items-center gap-1">
        ${me.isSick ? '<span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">🤧感冒</span>' : ''}
        ${village.toolsSharpenedToday ? '<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">✨磨刀</span>' : ''}
        <button id="btn-toggle-mute" class="text-sm px-1" title="切換音效">${soundFX.isMuted() ? '🔇' : '🔊'}</button>
        <button id="btn-open-settings" class="text-xs font-bold px-1.5 py-0.5 rounded-lg bg-stone-100 text-stone-700">⚙️設定</button>
        <button id="btn-switch-user" class="text-[10px] text-stone-400 underline ml-1">換角色</button>
      </div>
    </div>

    <div class="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-stone-100">
      <div class="min-w-0 truncate text-[10px] font-medium text-stone-500" title="${escapeHtml(state.user?.email || '')}">
        🔐 Google 帳號：${escapeHtml(state.user?.email || '登入中')}
      </div>
      <button id="btn-game-sign-out" class="shrink-0 rounded-lg bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-600 active:bg-red-100 active:text-red-700">
        登出
      </button>
    </div>
  `;

  document.getElementById('btn-weather-info').addEventListener('click', () => {
    const tomorrow = WEATHER_TYPES[village.tomorrowWeather];
    const trend = SEASON_TRENDS[village.season];
    openGenericModal(`${seasonObj.icon} ${seasonObj.name}季情報與氣象預報`, `
      <div class="space-y-3 text-sm">
        <div class="p-3 rounded-2xl bg-sky-50 border border-sky-200">
          <div class="font-black text-sky-900">今日天氣：${weatherObj.icon} ${weatherObj.name}</div>
          <p class="text-xs text-sky-800 mt-1">${weatherObj.desc}</p>
          <div class="mt-2 pt-2 border-t border-sky-200 text-xs font-bold text-sky-700">
            🔭 明日預報：${tomorrow?.icon || ''} ${tomorrow?.name || '晴朗'}
          </div>
        </div>
        <div class="p-3 rounded-2xl bg-amber-50 border border-amber-200">
          <div class="font-black text-amber-900">📈 本季市場收購趨勢</div>
          <p class="text-xs text-amber-800 mt-1">${trend?.label || ''}</p>
        </div>
        <div class="p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-600">
          🏠 家庭房間代碼：<span class="font-black text-stone-800">${state.roomId}</span>
        </div>
      </div>
    `);
  });

  document.getElementById('btn-switch-user').addEventListener('click', () => {
    document.getElementById('game-view').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
  });

  document.getElementById('btn-toggle-mute').addEventListener('click', () => {
    soundFX.toggleMute();
    renderTopHud(village, me);
  });

  document.getElementById('btn-open-settings').addEventListener('click', openSettingsModal);
  document.getElementById('btn-hud-rest-time')?.addEventListener('click', openRestTimeModal);
  document.getElementById('btn-game-sign-out').addEventListener('click', signOutGoogleAccount);
}

function renderLocationBar(me) {
  const bar = document.getElementById('location-bar');
  bar.innerHTML = Object.values(LOCATIONS).map(loc => {
    const isHere = me.location === loc.id;
    const herePlayers = state.players.filter(
      p => p.location === loc.id && (Date.now() - (p.lastActiveAt || 0) <= ONLINE_TIMEOUT_MS)
    );

    return `
      <button data-goto-loc="${loc.id}" class="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition ${
        isHere
          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
          : 'bg-white text-stone-700 border-stone-200 active:bg-stone-100'
      }">
        <span>${loc.icon} ${loc.name.slice(0, 4)}</span>
        ${herePlayers.length ? `
          <span class="flex -space-x-1 ml-0.5">
            ${herePlayers.map(p => renderAvatarSVG(p.avatarConfig, 18)).join('')}
          </span>
        ` : ''}
      </button>
    `;
  }).join('');

  bar.querySelectorAll('[data-goto-loc]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetLoc = btn.dataset.gotoLoc;
      if (targetLoc !== me.location) {
        await updatePlayerPresence(state.roomId, me.id, { location: targetLoc });
      }
      if (state.activeTab !== 'action') {
        switchTab('action');
      }
    });
  });
}

function renderActivityTicker(village) {
  const logs = village.activityLogs || [];
  const latest = logs[0]?.text || '歡迎來到小鎮！';
  document.getElementById('ticker-latest').textContent = latest;
}

function updateNavBadges(village, me) {
  const statDot = document.getElementById('stat-badge-dot');
  if ((me.freeStatPoints || 0) > 0) statDot.classList.remove('hidden');
  else statDot.classList.add('hidden');

  const questDot = document.getElementById('quest-badge-dot');
  if (village.seasonalQuest && !village.seasonalQuest.completed) questDot.classList.remove('hidden');
  else questDot.classList.add('hidden');

  const sleepLabel = document.getElementById('sleep-nav-label');
  sleepLabel.textContent = me.isSleeping ? '已睡覺' : '睡覺';
}

// ============================================================================
// 四、 分頁 1：行動主畫面（依目前所在地點動態呈現）
// ============================================================================

function renderActionTab(village, me) {
  const container = document.getElementById('main-content');
  const locBar = document.getElementById('location-bar');

  // 經典模式保留地點按鈕，其餘模式改用 2D 搖桿小鎮
  if (state.settings.controlMode !== 'classic') {
    if (locBar) locBar.classList.add('hidden');

    // 保留已掛載的 Canvas，避免資料更新時中斷角色移動
    if (document.getElementById('village-canvas')) {
      worldMap.updateData(village, state.players, state.settings, me);
      return;
    }

    worldMap.mount(container, {
      roomId: state.roomId,
      village,
      players: state.players,
      me,
      settings: state.settings,
      callbacks: {
        getSelectedBait: () => state.selectedBait,
        onBaitChange: (val) => { state.selectedBait = val; },
        onMovementSyncError: () => showToast('角色位置同步遭拒；請確認 Firebase 已部署角色所有權規則。', 'error'),
        onActionSyncError: () => showToast('角色動作同步失敗，請檢查網路連線。', 'error'),
        onInteract: (obj) => {
          const curVillage = state.village;
          const curMe = getMe();
          if (!curVillage || !curMe) return;

          if (obj.type === 'farm_plot') {
            const plot = curVillage.farmPlots[obj.plotIndex];
            if (plot.cleared && !plot.cropId) openSeedPickerModal(curVillage, curMe, obj.plotIndex, obj);
            else {
              const seed = Object.values(ITEMS).find(item => item.cropId === plot.cropId);
              const isReady = plot.cropId && plot.daysGrown >= (seed?.growDays || 2);
              const animation = !plot.cleared
                ? { toolCategory: 'hoe', label: '開墾荒地', staminaCost: 15, isOutdoor: true }
                : isReady
                  ? { toolCategory: 'harvest', label: '採收作物', staminaCost: 6, isOutdoor: true }
                  : { toolCategory: 'watering_can', label: '澆灌農田', staminaCost: 5, isOutdoor: true };
              runAction(() => actionFarmPlot(state.roomId, curMe.id, obj.plotIndex), {
                animation: { ...animation, x: obj.x, y: obj.y }
              });
            }
          } else if (obj.type === 'adopt_animal') {
            openAdoptAnimalModal(curVillage, curMe);
          } else if (obj.type === 'ranch_animal') {
            runAction(() => actionRanchCare(state.roomId, curMe.id, obj.animalId), {
              animation: { toolCategory: 'brush', label: '照料動物', staminaCost: 8, x: obj.x, y: obj.y }
            });
          } else if (obj.type === 'kitchen') {
            openKitchenModal(curVillage, curMe);
          } else if (obj.type === 'smithy') {
            openSmithyModal(curVillage, curMe);
          } else if (obj.type === 'scratch') {
            openScratchModal(curVillage, curMe);
          } else if (obj.type === 'quests') {
            openQuestBoardModal();
          } else if (obj.type === 'rest_bench') {
            openRestTimeModal();
          } else if (obj.type === 'npc') {
            openNpcModal(curVillage, curMe, obj.npcId);
          } else if (obj.type === 'fish') {
            runAction(() => actionFish(state.roomId, curMe.id, state.selectedBait || null, getEffectivePersonalTime(curMe)), {
              animation: { toolCategory: 'fishing_rod', label: '港邊釣魚', staminaCost: 10, isOutdoor: true, x: obj.x, y: obj.y }
            });
          } else if (obj.type === 'mountain_act') {
            const toolCategory = obj.actionId === 'mine_ore'
              ? 'pickaxe'
              : obj.actionId === 'chop_wood'
                ? 'axe'
                : obj.actionId === 'beach_combing' ? 'trowel' : 'harvest';
            const actionConfig = [...LOCATION_ACTIONS.beach, ...LOCATION_ACTIONS.mountain]
              .find(action => action.id === obj.actionId);
            runAction(() => actionForageOrMine(state.roomId, curMe.id, obj.actionId, getEffectivePersonalTime(curMe)), {
              animation: {
                toolCategory,
                label: obj.label,
                staminaCost: actionConfig?.stamina || 10,
                isOutdoor: true,
                x: obj.x,
                y: obj.y
              }
            });
          }
        }
      }
    });
    return;
  }

  // 經典快速按鈕模式（長輩友善免走動）
  worldMap.unmount();
  if (locBar) locBar.classList.remove('hidden');

  const loc = LOCATIONS[me.location] || LOCATIONS.farm;
  let sceneBodyHtml = '';
  if (loc.id === 'farm') sceneBodyHtml = renderFarmScene(village, me);
  else if (loc.id === 'ranch') sceneBodyHtml = renderRanchScene(village, me);
  else if (loc.id === 'town') sceneBodyHtml = renderTownScene(village, me);
  else if (loc.id === 'beach') sceneBodyHtml = renderBeachScene(village, me);
  else if (loc.id === 'mountain') sceneBodyHtml = renderMountainScene(village, me);

  container.innerHTML = `
    <div class="rounded-3xl p-4 bg-gradient-to-br ${loc.bgGradient} border border-stone-200/80 shadow-xs">
      <h2 class="text-lg font-black text-stone-800">${loc.icon} ${loc.name}</h2>
      <p class="text-xs text-stone-600 mt-0.5 leading-relaxed">${loc.desc}</p>
    </div>
    ${sceneBodyHtml}
  `;
  bindSceneEvents(village, me);
}

// --- 地點 1：農場農田 ---
function renderFarmScene(village, me) {
  const plots = village.farmPlots || [];
  return `
    <div class="bg-white rounded-3xl p-3.5 border border-stone-200 shadow-xs">
      <div class="flex items-center justify-between mb-2.5">
        <span class="text-xs font-black text-stone-700">🌱 全村共用農田（點擊格子互動）</span>
        <span class="text-[11px] text-stone-500">農耕 Lv.${me.skills?.farming?.level || 1}</span>
      </div>
      <div class="grid grid-cols-3 gap-2">
        ${plots.map((plot, idx) => {
          if (!plot.cleared) {
            return `
              <button data-plot-idx="${idx}" class="aspect-square rounded-2xl bg-stone-100 border-2 border-dashed border-stone-300 active:bg-stone-200 p-2 flex flex-col items-center justify-center text-center">
                <span class="text-xl">🪨🌿</span>
                <span class="text-[11px] font-bold text-stone-600 mt-1">荒廢農地</span>
                <span class="text-[10px] text-stone-400">點擊開墾</span>
              </button>
            `;
          }
          if (!plot.cropId) {
            return `
              <button data-plot-idx="${idx}" class="aspect-square rounded-2xl bg-amber-50/80 border border-amber-300 active:bg-amber-100 p-2 flex flex-col items-center justify-center text-center">
                <span class="text-xl">🟫</span>
                <span class="text-[11px] font-bold text-amber-900 mt-1">空田 #${idx + 1}</span>
                <span class="text-[10px] text-amber-700">點擊播種</span>
              </button>
            `;
          }
          const cropDef = ITEMS[plot.cropId];
          const seedDef = Object.values(ITEMS).find(i => i.cropId === plot.cropId);
          const growDays = seedDef?.growDays || 2;
          const isReady = plot.daysGrown >= growDays;

          return `
            <button data-plot-idx="${idx}" class="aspect-square rounded-2xl border-2 p-1.5 flex flex-col items-center justify-center text-center relative transition ${
              isReady
                ? 'bg-emerald-100 border-emerald-500 animate-crit-pulse'
                : plot.isWatered
                  ? 'bg-sky-50 border-sky-300'
                  : 'bg-orange-50 border-orange-300'
            }">
              <span class="absolute top-1 right-1.5 text-xs">${isReady ? '✨' : plot.isWatered ? '💧' : '🏜️'}</span>
              <span class="text-2xl">${cropDef?.icon || '🌱'}</span>
              <span class="text-[11px] font-black text-stone-800 mt-0.5 truncate w-full">${cropDef?.name || ''}</span>
              <span class="text-[10px] font-bold ${isReady ? 'text-emerald-700' : 'text-stone-500'}">
                ${isReady ? '可採收！' : `${plot.daysGrown}/${growDays}天`}
              </span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// --- 地點 2：牧場畜舍 ---
function renderRanchScene(village, me) {
  const livestock = village.livestock || [];
  return `
    <div class="bg-white rounded-3xl p-3.5 border border-stone-200 shadow-xs space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-stone-700">🐄 牧場動物列表（點擊餵食與收穫）</span>
        <button id="btn-open-adopt" class="px-2.5 py-1 rounded-xl bg-amber-500 text-white text-xs font-bold shadow-xs">
          + 領養動物
        </button>
      </div>

      <div class="space-y-2">
        ${livestock.map(ani => {
          const def = ANIMAL_TYPES[ani.type];
          return `
            <button data-animal-id="${ani.id}" class="w-full p-3 rounded-2xl border text-left flex items-center justify-between transition ${
              ani.productReady ? 'bg-amber-50 border-amber-400' : 'bg-stone-50 border-stone-200 active:bg-stone-100'
            }">
              <div class="flex items-center gap-3">
                <span class="text-3xl">${def?.icon || '🐔'}</span>
                <div>
                  <div class="font-black text-sm text-stone-800">
                    ${escapeHtml(ani.nickname)} <span class="text-xs font-normal text-stone-500">(${def?.name})</span>
                  </div>
                  <div class="text-[11px] text-stone-600 mt-0.5">
                    ❤️ 親密度 ${ani.intimacy || 0} · ${ani.fedToday ? '✅ 今日已餵食' : '🌾 待餵飼料'}
                  </div>
                </div>
              </div>
              <div class="text-right">
                ${ani.productReady
                  ? `<span class="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-xs font-black">收穫${ITEMS[def.productId]?.icon}</span>`
                  : `<span class="px-2.5 py-1 rounded-xl bg-white border border-stone-300 text-stone-700 text-xs font-bold">照料</span>`
                }
              </div>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// --- 地點 3：村莊廣場 ---
function renderTownScene(village, me) {
  return `
    <!-- 村莊設施快捷入口 -->
    <div class="grid grid-cols-3 gap-2">
      <button id="btn-open-kitchen" class="p-3 rounded-2xl bg-orange-100 border border-orange-300 active:bg-orange-200 flex flex-col items-center text-center">
        <span class="text-2xl">🍲</span>
        <span class="text-xs font-black text-orange-950 mt-1">村莊大廚房</span>
        <span class="text-[10px] text-orange-800">老湯與家常菜</span>
      </button>
      <button id="btn-open-smithy" class="p-3 rounded-2xl bg-slate-100 border border-slate-300 active:bg-slate-200 flex flex-col items-center text-center">
        <span class="text-2xl">⚒️</span>
        <span class="text-xs font-black text-slate-900 mt-1">鐵匠珠寶爐</span>
        <span class="text-[10px] text-slate-700">磨刀/鑑定/熔煉</span>
      </button>
      <button id="btn-open-scratch" class="p-3 rounded-2xl bg-red-100 border border-red-300 active:bg-red-200 flex flex-col items-center text-center relative">
        ${!me.scratchUsedToday ? '<span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-600 animate-ping"></span>' : ''}
        <span class="text-2xl">🎟️</span>
        <span class="text-xs font-black text-red-900 mt-1">過年刮刮樂</span>
        <span class="text-[10px] text-red-700">${me.scratchUsedToday ? '今日已刮過' : '每日限一張'}</span>
      </button>
    </div>

    <!-- 六位村民 NPC 互動列表 -->
    <div class="bg-white rounded-3xl p-3.5 border border-stone-200 shadow-xs space-y-2">
      <div class="text-xs font-black text-stone-700">🗣️ 小鎮居民（點擊聊天、買東西或議價賣貨）</div>
      <div class="grid grid-cols-2 gap-2">
        ${Object.values(NPCS).map(npc => {
          const isAbsent = npc.appearDays && !npc.appearDays.includes(village.day);
          return `
            <button data-npc-id="${npc.id}" class="p-2.5 rounded-2xl border text-left transition ${
              isAbsent ? 'bg-stone-100 border-stone-200 opacity-60' : 'bg-amber-50/50 border-amber-200 active:bg-amber-100'
            }">
              <div class="flex items-center gap-2">
                ${renderNpcAvatarSVG(npc.id, 40)}
                <div class="min-w-0">
                  <div class="font-black text-xs text-stone-800 truncate">${npc.name}</div>
                  <div class="text-[10px] text-stone-500 truncate">${isAbsent ? '第7/14天現身' : npc.title}</div>
                </div>
              </div>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// --- 地點 4：海邊漁港 ---
function renderBeachScene(village, me) {
  const fishAction = LOCATION_ACTIONS.beach.find(a => a.id === 'go_fishing');
  const combAction = LOCATION_ACTIONS.beach.find(a => a.id === 'beach_combing');
  const fishMod = calculateCheckModifiers(me, village, fishAction);
  const combMod = calculateCheckModifiers(me, village, combAction);
  const isFisher = me.mainClass === 'fisher';
  const fishLv = me.skills?.fishing?.level || 1;

  const baits = ['worm_bait', 'shrimp_bait', 'lure_bait'];

  return `
    <!-- 魚餌選擇器 -->
    <div class="bg-white rounded-3xl p-3.5 border border-stone-200 shadow-xs space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-stone-700">🪱 選擇釣魚魚餌（自動取用背包或倉庫）</span>
        ${isFisher ? '<button id="btn-open-craft-bait" class="text-[11px] font-bold text-sky-700 underline">漁夫自製魚餌</button>' : ''}
      </div>
      <div class="grid grid-cols-4 gap-1.5">
        <button data-pick-bait="" class="p-2 rounded-xl border text-center text-xs font-bold ${state.selectedBait === '' ? 'bg-sky-600 text-white border-sky-600' : 'bg-stone-50 text-stone-700 border-stone-200'}">
          不用餌<br><span class="text-[10px] opacity-80">免費</span>
        </button>
        ${baits.map(bid => {
          const cnt = getTotalItemCount(me, village.warehouse, bid);
          const active = state.selectedBait === bid;
          return `
            <button data-pick-bait="${bid}" class="p-2 rounded-xl border text-center text-xs font-bold ${active ? 'bg-sky-600 text-white border-sky-600' : 'bg-stone-50 text-stone-700 border-stone-200'}">
              ${ITEMS[bid].icon} ${ITEMS[bid].name.slice(2, 5)}<br>
              <span class="text-[10px] opacity-80">庫存 ${cnt}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>

    <!-- 海邊行動按鈕 -->
    <div class="space-y-2">
      <button id="btn-action-fish" class="w-full p-3.5 rounded-2xl bg-sky-600 active:bg-sky-700 text-white shadow-sm flex items-center justify-between">
        <div class="text-left">
          <div class="font-black text-sm">🎣 港邊拋竿釣魚</div>
          <div class="text-[11px] text-sky-100 mt-0.5">加值 +${fishMod.totalMod} · 基準成功率 ${fishMod.successChance}%</div>
        </div>
        <div class="text-right text-xs font-bold bg-sky-700/80 px-2.5 py-1 rounded-xl">
          ⚡-${fishAction.stamina} / +${fishAction.minutes}分
        </div>
      </button>

      <button id="btn-action-comb" class="w-full p-3.5 rounded-2xl bg-teal-600 active:bg-teal-700 text-white shadow-sm flex items-center justify-between">
        <div class="text-left">
          <div class="font-black text-sm">🦀 潮間帶趕海（海帶芽/怪石/夜抓小管）</div>
          <div class="text-[11px] text-teal-100 mt-0.5">加值 +${combMod.totalMod} · 成功率 ${combMod.successChance}%</div>
        </div>
        <div class="text-right text-xs font-bold bg-teal-700/80 px-2.5 py-1 rounded-xl">
          ⚡-${combAction.stamina} / +${combAction.minutes}分
        </div>
      </button>
    </div>

    <!-- 漁夫專屬被動：預覽目前水域魚種 -->
    ${isFisher ? `
      <div class="bg-sky-50 rounded-2xl p-3 border border-sky-200 text-xs">
        <div class="font-black text-sky-900 mb-1">👁️【漁夫潮汐直覺】目前水域可釣魚種：</div>
        <div class="flex flex-wrap gap-1.5">
          ${FISHING_POOL.filter(f => fishLv >= f.minSkill).map(f => `
            <span class="px-2 py-0.5 rounded-full bg-white border border-sky-200 text-sky-900 font-bold text-[11px]">
              ${ITEMS[f.itemId].icon} ${ITEMS[f.itemId].name} (DC${f.dc})
            </span>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

// --- 地點 5：深山林地與礦坑 ---
function renderMountainScene(village, me) {
  const actions = LOCATION_ACTIONS.mountain;
  return `
    <div class="space-y-2.5">
      ${actions.map(act => {
        const locked = act.classOnly && me.mainClass !== act.classOnly;
        const mod = calculateCheckModifiers(me, village, act);
        return `
          <button data-mountain-act="${act.id}" ${locked ? 'disabled' : ''} class="w-full p-3.5 rounded-2xl border shadow-xs flex items-center justify-between transition ${
            locked
              ? 'bg-stone-100 border-stone-200 text-stone-400 opacity-70'
              : 'bg-white border-stone-200 active:bg-emerald-50 text-stone-800'
          }">
            <div class="text-left">
              <div class="font-black text-sm">${act.icon} ${act.name}</div>
              <div class="text-[11px] text-stone-500 mt-0.5">
                ${locked ? '🔒 僅限「採集者」主職業執行' : `加值 +${mod.totalMod} vs DC${mod.effectiveDC} · 成功率 ${mod.successChance}%`}
              </div>
            </div>
            <div class="text-right text-xs font-bold bg-stone-100 text-stone-700 px-2.5 py-1 rounded-xl shrink-0">
              ⚡-${act.stamina} / +${act.minutes}分
            </div>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function bindSceneEvents(village, me) {
  const container = document.getElementById('main-content');

  // 農田格子點擊
  container.querySelectorAll('[data-plot-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.plotIdx);
      const plot = village.farmPlots[idx];
      if (plot.cleared && !plot.cropId) {
        openSeedPickerModal(village, me, idx);
      } else {
        runAction(() => actionFarmPlot(state.roomId, me.id, idx));
      }
    });
  });

  // 牧場動物點擊 & 領養按鈕
  container.querySelectorAll('[data-animal-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      runAction(() => actionRanchCare(state.roomId, me.id, btn.dataset.animalId));
    });
  });
  document.getElementById('btn-open-adopt')?.addEventListener('click', () => openAdoptAnimalModal(village, me));

  // 村莊廣場設施 & NPC
  document.getElementById('btn-open-kitchen')?.addEventListener('click', () => openKitchenModal(village, me));
  document.getElementById('btn-open-smithy')?.addEventListener('click', () => openSmithyModal(village, me));
  document.getElementById('btn-open-scratch')?.addEventListener('click', () => openScratchModal(village, me));
  container.querySelectorAll('[data-npc-id]').forEach(btn => {
    btn.addEventListener('click', () => openNpcModal(village, me, btn.dataset.npcId));
  });

  // 海邊魚餌與釣魚趕海
  container.querySelectorAll('[data-pick-bait]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedBait = btn.dataset.pickBait;
      renderActionTab(village, me);
    });
  });
  document.getElementById('btn-open-craft-bait')?.addEventListener('click', () => openCraftBaitModal(village, me));
  document.getElementById('btn-action-fish')?.addEventListener('click', () => {
    runAction(() => actionFish(state.roomId, me.id, state.selectedBait || null, getEffectivePersonalTime(me)));
  });
  document.getElementById('btn-action-comb')?.addEventListener('click', () => {
    runAction(() => actionForageOrMine(state.roomId, me.id, 'beach_combing', getEffectivePersonalTime(me)));
  });

  // 深山行動
  container.querySelectorAll('[data-mountain-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      runAction(() => actionForageOrMine(state.roomId, me.id, btn.dataset.mountainAct, getEffectivePersonalTime(me)));
    });
  });
}

// ============================================================================
// 五、 分頁 2：背包與分類共用大倉庫
// ============================================================================

function renderBagTab(village, me) {
  const container = document.getElementById('main-content');
  const cap = getBackpackCapacity(me);
  const inv = me.inventory || [];
  const box = village.warehouse || {};

  const boxEntries = Object.entries(box).filter(([id, cnt]) => {
    if (cnt <= 0 || !ITEMS[id]) return false;
    if (state.warehouseCategory === 'all') return true;
    return ITEMS[id].category === state.warehouseCategory;
  });

  container.innerHTML = `
    <!-- 1. 個人隨身背包 -->
    <div class="bg-white rounded-3xl p-3.5 border border-stone-200 shadow-xs space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-stone-800">🎒 隨身背包（${inv.length} / ${cap} 格）</span>
        <button id="btn-deposit-all" class="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-bold">
          一鍵全存共用箱
        </button>
      </div>

      ${inv.length === 0
        ? '<p class="text-xs text-stone-400 text-center py-3">隨身背包空空的</p>'
        : `<div class="space-y-1.5">
            ${inv.map(entry => {
              const def = ITEMS[entry.itemId];
              if (!def) return '';
              return `
                <div class="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-lg">${def.icon}</span>
                    <div class="truncate">
                      <span class="font-bold text-stone-800">${def.name}</span>
                      <span class="text-stone-500 font-black ml-1">x${entry.count}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    ${def.staminaRestore ? `<button data-eat-bag="${entry.itemId}" class="px-2 py-1 rounded-lg bg-amber-500 text-white font-bold text-[11px]">吃(+${def.staminaRestore})</button>` : ''}
                    ${def.category !== 'tool' ? `<button data-to-box="${entry.itemId}" class="px-2 py-1 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-[11px]">存箱</button>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>`
      }
    </div>

    <!-- 2. 全村無限共用大倉庫（自帶分類） -->
    <div class="bg-white rounded-3xl p-3.5 border border-stone-200 shadow-xs space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-stone-800">📦 全村共用大箱子（無限格數・無限堆疊）</span>
      </div>

      <!-- 分類標籤列 -->
      <div class="flex gap-1 overflow-x-auto no-scrollbar pb-1">
        <button data-box-cat="all" class="px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${state.warehouseCategory === 'all' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'}">全部</button>
        ${Object.values(ITEM_CATEGORIES).filter(c => c.id !== 'tool').map(cat => `
          <button data-box-cat="${cat.id}" class="px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${state.warehouseCategory === cat.id ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'}">
            ${cat.icon} ${cat.name}
          </button>
        `).join('')}
      </div>

      ${boxEntries.length === 0
        ? '<p class="text-xs text-stone-400 text-center py-4">此分類目前沒有庫存物品</p>'
        : `<div class="space-y-1.5">
            ${boxEntries.map(([id, cnt]) => {
              const def = ITEMS[id];
              return `
                <div class="flex items-center justify-between p-2 rounded-xl bg-amber-50/40 border border-stone-200 text-xs">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-lg">${def.icon}</span>
                    <div class="truncate">
                      <span class="font-bold text-stone-800">${def.name}</span>
                      <span class="text-emerald-700 font-black ml-1">x${cnt}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    ${def.staminaRestore ? `<button data-eat-box="${id}" class="px-2 py-1 rounded-lg bg-amber-500 text-white font-bold text-[11px]">直接吃(+${def.staminaRestore})</button>` : ''}
                    <button data-from-box="${id}" class="px-2 py-1 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold text-[11px]">領出1個</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>`
      }
    </div>
  `;

  document.getElementById('btn-deposit-all').addEventListener('click', () => {
    runAction(() => depositAllToWarehouse(state.roomId, me.id), { skipDice: true });
  });

  container.querySelectorAll('[data-box-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.warehouseCategory = btn.dataset.boxCat;
      renderBagTab(village, me);
    });
  });

  container.querySelectorAll('[data-eat-bag]').forEach(btn => {
    btn.addEventListener('click', () => runAction(() => eatFoodItem(state.roomId, me.id, btn.dataset.eatBag, false), { skipDice: true }));
  });
  container.querySelectorAll('[data-eat-box]').forEach(btn => {
    btn.addEventListener('click', () => runAction(() => eatFoodItem(state.roomId, me.id, btn.dataset.eatBox, true), { skipDice: true }));
  });
  container.querySelectorAll('[data-to-box]').forEach(btn => {
    btn.addEventListener('click', () => runAction(() => transferWarehouseItem(state.roomId, me.id, btn.dataset.toBox, 1, true), { skipDice: true }));
  });
  container.querySelectorAll('[data-from-box]').forEach(btn => {
    btn.addEventListener('click', () => runAction(() => transferWarehouseItem(state.roomId, me.id, btn.dataset.fromBox, 1, false), { skipDice: true }));
  });
}

// ============================================================================
// 六、 分頁 3：委託系統（季節委託＋保底交換、布告欄小委託、傳奇工程）
// ============================================================================

function renderQuestsTab(village, me) {
  const container = document.getElementById('quest-board-body') || document.getElementById('main-content');
  if (!container) return;

  const sq = village.seasonalQuest;
  const sqTemplate = SEASONAL_QUESTS[village.season];
  const board = village.bulletinQuests || [];
  const legProg = village.legendaryProgress || {};

  container.innerHTML = `
    <!-- 1. 季節全村委託（完成後全體永久加能力點） -->
    <div class="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-4 border-2 border-amber-300 shadow-xs space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black">本季限時（剩 ${15 - village.day} 天）</span>
        <span class="text-xs font-black text-amber-900">獎勵：全體 ${sqTemplate.rewardStatName} +1</span>
      </div>
      <h3 class="font-black text-base text-stone-800">${sqTemplate.title}</h3>
      <p class="text-xs text-stone-600 leading-relaxed">${sqTemplate.desc}</p>

      <!-- 物資需求進度 -->
      <div class="space-y-1.5 bg-white/80 p-2.5 rounded-2xl border border-amber-200">
        ${(sq?.requirements || []).map(req => {
          const def = ITEMS[req.itemId];
          const done = req.currentCount >= req.targetCount;
          return `
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold ${done ? 'text-emerald-700 line-through' : 'text-stone-800'}">${def?.icon} ${def?.name}</span>
              <span class="font-black ${done ? 'text-emerald-700' : 'text-amber-800'}">${req.currentCount} / ${req.targetCount} ${done ? '✅' : ''}</span>
            </div>
          `;
        }).join('')}
      </div>

      <!-- 第 11 天村民上門保底交換 -->
      ${sq?.rescueBarterActive && !sq?.rescueBarterUsed && !sq?.completed ? `
        <div class="p-3 rounded-2xl bg-sky-100 border border-sky-300 space-y-2">
          <div class="text-xs font-black text-sky-900">🤝 热心村民上門幫忙（保底交換）</div>
          <p class="text-[11px] text-sky-800 leading-relaxed">${sqTemplate.rescueBarter.dialogue}</p>
          <button id="btn-rescue-barter" class="w-full py-2 rounded-xl bg-sky-600 text-white font-bold text-xs shadow-xs">
            執行以物易物交換
          </button>
        </div>
      ` : ''}

      ${sq?.completed
        ? '<div class="text-center py-2 font-black text-sm text-emerald-700 bg-emerald-100 rounded-xl">🎊 本季委託已圓滿完成！</div>'
        : sq?.itemsDelivered
          ? `<button id="btn-sq-final-check" class="w-full py-2.5 rounded-xl bg-red-600 active:bg-red-700 text-white font-black text-sm shadow-sm">
              🎲 執行【${sqTemplate.finalCheck.label}】(DC ${sqTemplate.finalCheck.dc})
            </button>`
          : `<button id="btn-sq-contribute" class="w-full py-2.5 rounded-xl bg-amber-600 active:bg-amber-700 text-white font-black text-sm shadow-sm">
              📦 投入背包與倉庫中的委託物資
            </button>`
      }
    </div>

    <!-- 2. 村莊布告欄無期限小委託 -->
    <div class="bg-white rounded-3xl p-3.5 border border-stone-200 shadow-xs space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-stone-800">📋 村莊布告欄（無時間限制・解完隔日刷新）</span>
      </div>

      ${board.length === 0
        ? '<p class="text-xs text-stone-400 text-center py-3">今日布告欄委託已全數清空，明天早上會貼出新委託！</p>'
        : board.map((entry, idx) => {
            const qDef = BULLETIN_QUEST_POOL.find(q => q.id === entry.id);
            if (!qDef) return '';
            const npc = NPCS[qDef.npcId];
            const isCheckType = qDef.type === 'check' || qDef.type === 'errand';

            return `
              <div class="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="inline-flex items-center gap-1.5 font-black text-xs text-stone-800">
                    ${npc ? renderNpcAvatarSVG(npc.id, 28) : ''}
                    <span>${qDef.title}</span>
                  </span>
                  <span class="text-[11px] font-black text-emerald-700">💰 +${qDef.reward.money}元${qDef.reward.favor ? ` · 💗 +${qDef.reward.favor}` : ''}</span>
                </div>
                <p class="text-[11px] text-stone-600 leading-relaxed">${qDef.desc}</p>

                ${isCheckType
                  ? `<div class="text-[11px] font-bold text-indigo-700">
                      📍 地點：${LOCATIONS[qDef.targetLocation]?.name} · 檢定 DC ${qDef.check.dc}（消耗 ${qDef.staminaCost} 體力）
                    </div>`
                  : `<div class="flex flex-wrap gap-1.5">
                      ${qDef.reqItems.map(r => {
                        const cur = entry.progress?.[r.itemId] || 0;
                        return `<span class="px-2 py-0.5 rounded-lg bg-white border border-stone-200 text-[11px] font-bold">
                          ${ITEMS[r.itemId]?.icon} ${ITEMS[r.itemId]?.name} ${cur}/${r.count}
                        </span>`;
                      }).join('')}
                    </div>`
                }

                <button data-bq-idx="${idx}" class="w-full py-2 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs">
                  ${isCheckType ? '🎲 現場執行幫忙檢定' : '📦 投入物資 / 交付委託'}
                </button>
              </div>
            `;
          }).join('')
      }
    </div>

    <!-- 3. 無時間限制：全村傳奇大工程 -->
    <div class="bg-purple-50/70 rounded-3xl p-4 border border-purple-200 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-purple-900">👑 ${LEGENDARY_PROJECT.title}</span>
        <span class="text-[10px] font-bold text-purple-700">永久無期限</span>
      </div>
      <p class="text-[11px] text-purple-800 leading-relaxed">${LEGENDARY_PROJECT.desc}</p>
      <div class="grid grid-cols-2 gap-1.5">
        ${LEGENDARY_PROJECT.requirements.map(r => {
          const cur = legProg[r.itemId] || 0;
          return `
            <div class="px-2.5 py-1.5 rounded-xl bg-white border border-purple-200 text-[11px] flex justify-between font-bold">
              <span>${ITEMS[r.itemId]?.icon} ${ITEMS[r.itemId]?.name}</span>
              <span class="text-purple-800">${cur}/${r.count}</span>
            </div>
          `;
        }).join('')}
      </div>
      ${village.legendaryCompleted
        ? '<div class="text-center font-black text-xs text-purple-800 py-1">✨ 豐年祭慶典已啟動（全村檢定永久 +1）</div>'
        : `<button id="btn-legendary-contrib" class="w-full py-2 rounded-xl bg-purple-700 text-white font-bold text-xs">
            投入珍貴材料推進傳奇工程
          </button>`
      }
    </div>
  `;

  document.getElementById('btn-sq-contribute')?.addEventListener('click', () => {
    runAction(() => contributeSeasonalQuest(state.roomId, me.id), { skipDice: true });
  });
  document.getElementById('btn-rescue-barter')?.addEventListener('click', () => {
    runAction(() => executeRescueBarter(state.roomId, me.id), { skipDice: true });
  });
  document.getElementById('btn-sq-final-check')?.addEventListener('click', () => {
    runAction(() => completeSeasonalQuestCheck(state.roomId, me.id, state.players));
  });
  container.querySelectorAll('[data-bq-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      runAction(() => interactBulletinQuest(state.roomId, me.id, Number(btn.dataset.bqIdx)));
    });
  });
  document.getElementById('btn-legendary-contrib')?.addEventListener('click', () => {
    runAction(() => contributeLegendaryProject(state.roomId, me.id));
  });

  decoratePinnedNotices(container);
}

// ============================================================================
// 七、 分頁 4：角色卡片與七大生活技能（支援跨職無上限升級）
// ============================================================================

function renderCharacterTab(village, me) {
  const container = document.getElementById('main-content');
  const cls = CLASSES[me.mainClass];
  const nextPersonalXp = PERSONAL_XP_THRESHOLDS[me.level || 1] || 9999;

  container.innerHTML = `
    <!-- 角色名片 -->
    <div class="bg-white rounded-3xl p-4 border border-stone-200 shadow-xs flex items-center gap-3.5">
      ${renderAvatarSVG(me.avatarConfig, 72)}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <h3 class="font-black text-lg text-stone-800 truncate">${escapeHtml(me.name)}</h3>
          <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">Lv.${me.level || 1}</span>
        </div>
        <div class="text-xs font-bold text-stone-600 mt-0.5">${cls?.icon} 主職業：${cls?.name}</div>
        <div class="text-[11px] text-stone-500 mt-1">個人經驗：${me.xp || 0} / ${nextPersonalXp}</div>
        <div class="flex flex-wrap gap-1 mt-1.5">
          ${(me.traits || []).map(tid => `
            <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
              ${TRAITS[tid]?.icon} ${TRAITS[tid]?.name}
            </span>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- 四大基礎能力 -->
    <div class="bg-white rounded-3xl p-3.5 border border-stone-200 shadow-xs space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-stone-800">📊 基礎能力點數</span>
        ${(me.freeStatPoints || 0) > 0
          ? `<span class="px-2 py-0.5 rounded-full bg-amber-400 text-stone-900 text-xs font-black animate-pulse">可分配點數：${me.freeStatPoints}</span>`
          : '<span class="text-[11px] text-stone-400">每升3級或完成季節委託增加</span>'
        }
      </div>
      <div class="grid grid-cols-2 gap-2">
        ${Object.values(STATS).map(st => {
          const val = me.stats?.[st.id] || 0;
          return `
            <div class="p-2.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-stone-700">${st.icon} ${st.name}</div>
                <div class="text-base font-black text-emerald-700">+${val}</div>
              </div>
              ${(me.freeStatPoints || 0) > 0 ? `
                <button data-add-stat="${st.id}" class="w-8 h-8 rounded-xl bg-amber-500 active:bg-amber-600 text-white font-black text-base shadow-xs">+</button>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- 七大生活技能熟練度（跨職無上限學習） -->
    <div class="bg-white rounded-3xl p-3.5 border border-stone-200 shadow-xs space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-stone-800">📚 七大生活技能（全領域皆可跨職無上限學習）</span>
      </div>
      <div class="space-y-2">
        ${Object.values(LIFE_SKILLS).map(sk => {
          const skData = me.skills?.[sk.id] || { level: 1, xp: 0 };
          const isMain = cls?.relatedSkill === sk.id;
          const nextReq = SKILL_XP_THRESHOLDS[skData.level] || 9999;
          const pct = Math.min(100, Math.round((skData.xp / nextReq) * 100));

          return `
            <div class="p-2.5 rounded-2xl border ${isMain ? 'bg-emerald-50/50 border-emerald-200' : 'bg-stone-50 border-stone-200'}">
              <div class="flex items-center justify-between text-xs">
                <span class="font-black text-stone-800">
                  ${sk.icon} ${sk.name}
                  ${isMain ? '<span class="ml-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px]">本職 +2 / 100%經驗</span>' : '<span class="ml-1 text-[10px] text-stone-400">跨職 50%經驗</span>'}
                </span>
                <span class="font-black text-emerald-700">Lv.${skData.level}</span>
              </div>
              <div class="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden my-1.5">
                <div class="h-full bg-emerald-500" style="width: ${pct}%"></div>
              </div>
              <div class="text-[10px] text-stone-500">
                經驗 ${skData.xp}/${nextReq} · 解鎖：${sk.unlocks[skData.level >= 7 ? 7 : skData.level >= 4 ? 4 : skData.level >= 2 && sk.unlocks[2] ? 2 : 1]}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('[data-add-stat]').forEach(btn => {
    btn.addEventListener('click', () => {
      runAction(() => allocateFreeStatPoint(state.roomId, me.id, btn.dataset.addStat), { skipDice: true });
    });
  });
}

// ============================================================================
// 八、 互動彈窗（播種、NPC 買賣聊天、大廚房、鐵匠爐、刮刮樂、睡覺結算）
// ============================================================================

function openGenericModal(title, bodyHtml) {
  document.getElementById('generic-modal-title').textContent = title;
  document.getElementById('generic-modal-body').innerHTML = bodyHtml;
  document.getElementById('generic-modal').classList.remove('hidden');
}

function closeGenericModal() {
  document.getElementById('generic-modal').classList.add('hidden');
}

function openSeedPickerModal(village, me, plotIndex, actionPosition = null) {
  const seeds = Object.values(ITEMS).filter(i => i.cropId);
  const html = `
    <p class="text-xs text-stone-500">選擇要種在第 ${plotIndex + 1} 號田的種子（自動取用背包或共用倉庫）：</p>
    <div class="space-y-2">
      ${seeds.map(s => {
        const count = getTotalItemCount(me, village.warehouse, s.id);
        const inSeason = s.seasons.includes(village.season);
        return `
          <button data-plant-seed="${s.id}" ${count <= 0 || !inSeason ? 'disabled' : ''} class="w-full p-3 rounded-2xl border flex items-center justify-between text-left ${
            count > 0 && inSeason ? 'bg-white border-emerald-300 active:bg-emerald-50' : 'bg-stone-100 border-stone-200 opacity-50'
          }">
            <div>
              <div class="font-black text-sm text-stone-800">${s.icon} ${s.name}</div>
              <div class="text-[11px] text-stone-500">生長期 ${s.growDays} 天 · 需農耕 Lv.${s.skillReq} ${!inSeason ? '（非當季）' : ''}</div>
            </div>
            <span class="text-xs font-black text-emerald-700">庫存 ${count}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
  openGenericModal(`🌱 選擇播種作物（#${plotIndex + 1}）`, html);

  document.getElementById('generic-modal-body').querySelectorAll('[data-plant-seed]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeGenericModal();
      runAction(() => actionFarmPlot(state.roomId, me.id, plotIndex, btn.dataset.plantSeed), {
        skipDice: true,
        animation: {
          toolCategory: 'hoe',
          label: '播種',
          staminaCost: 5,
          isOutdoor: true,
          x: actionPosition?.x,
          y: actionPosition?.y
        }
      });
    });
  });
}

function openAdoptAnimalModal(village, me) {
  const html = `
    <p class="text-xs text-stone-500">向牧場獸醫小芳姊領養動物（使用全村公款，商人享 85 折）：</p>
    <div class="space-y-2">
      ${Object.values(ANIMAL_TYPES).map(ani => `
        <button data-buy-ani="${ani.id}" class="w-full p-3 rounded-2xl bg-white border border-amber-200 active:bg-amber-50 flex items-center justify-between text-left">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">${ani.icon}</span>
            <div>
              <div class="font-black text-sm text-stone-800">${ani.name}</div>
              <div class="text-[11px] text-stone-500">每 ${ani.prodDays} 天產出 ${ITEMS[ani.productId]?.name} · 需畜牧 Lv.${ani.skillReq}</div>
            </div>
          </div>
          <span class="font-black text-xs text-amber-800">💰 ${ani.buyPrice} 元</span>
        </button>
      `).join('')}
    </div>
  `;
  openGenericModal('🐣 領養牧場動物', html);

  document.getElementById('generic-modal-body').querySelectorAll('[data-buy-ani]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeGenericModal();
      runAction(() => actionBuyAnimal(state.roomId, me.id, btn.dataset.buyAni), { skipDice: true });
    });
  });
}

function openKitchenModal(village, me) {
  const html = `
    <p class="text-xs text-stone-500">材料數量為背包＋共用倉庫現有數／需求數；綠色代表足夠，紅色代表不足。失敗也會做成家常大雜燴，不浪費食材！</p>
    <div class="space-y-2">
      ${COOKING_RECIPES.map(rec => {
        const resItem = ITEMS[rec.resultId];
        const canCook = rec.ingredients.every(i => getTotalItemCount(me, village.warehouse, i.itemId) >= i.count);

        return `
          <div class="p-3 rounded-2xl border ${canCook ? 'bg-orange-50/50 border-orange-300' : 'bg-stone-50 border-stone-200'}">
            <div class="flex items-center justify-between">
              <span class="font-black text-sm text-stone-800">${resItem?.icon} ${resItem?.name}</span>
              <span class="text-[11px] font-bold text-emerald-700">⚡+${resItem?.staminaRestore} · 烹飪Lv.${rec.skillReq}</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-1.5">
              ${renderIngredientStatus(rec.ingredients, me, village.warehouse)}
            </div>
            <button data-cook-rec="${rec.id}" ${!canCook ? 'disabled' : ''} class="mt-2 w-full py-1.5 rounded-xl text-xs font-black ${
              canCook ? 'bg-orange-600 active:bg-orange-700 text-white' : 'bg-stone-200 text-stone-400'
            }">
              ${canCook ? `🍳 下廚料理 (DC ${rec.dc})` : '材料不足'}
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;
  openGenericModal('🍲 村莊大廚房', html);

  document.getElementById('generic-modal-body').querySelectorAll('[data-cook-rec]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeGenericModal();
      runAction(() => actionCookRecipe(state.roomId, me.id, btn.dataset.cookRec));
    });
  });
}

function openSmithyModal(village, me) {
  if (!village || !me) return;
  const getBagCount = (itemId) => Array.isArray(me.inventory)
    ? me.inventory.find(item => (item.itemId || item.id) === itemId)?.count || 0
    : Number(me.inventory?.[itemId] || 0);
  const getAvailableCount = (itemId) => getBagCount(itemId) + Number(village.warehouse?.[itemId] || 0);
  const strangeCnt = getAvailableCount('strange_stone');
  const roughCnt = getAvailableCount('rough_ore_gem');
  const smeltRecipes = [
    { id: 'copper_bar', oreId: 'copper_ore', level: 1, icon: '🧱', name: '銅錠' },
    { id: 'iron_bar', oreId: 'iron_ore', level: 4, icon: '🔩', name: '鐵錠' },
    { id: 'gold_bar', oreId: 'gold_ore', level: 7, icon: '🥇', name: '金錠' }
  ];

  const html = `
    <div class="space-y-3">
      <!-- 0. 工具鍛造升級 -->
      <div class="p-3 rounded-2xl bg-stone-800 text-amber-100 border border-amber-400 space-y-2">
        <div>
          <div class="font-black text-sm">🔥 大宇師傅的熔爐工坊</div>
          <p class="text-[11px] text-amber-200/85 mt-0.5">收集相思木與碎石，將木製工具升級成石製工具。材料可使用背包或共用倉庫；綠色代表足夠，紅色代表不足。</p>
          <div class="text-[11px] font-black text-yellow-300 mt-1">村莊公款：💰 ${(village.sharedMoney || 0).toLocaleString()} 元</div>
        </div>
        ${TOOL_FORGE_RECIPES.map(recipe => {
          const targetItem = ITEMS[recipe.resultId];
          const fromItem = ITEMS[recipe.fromId];
          const alreadyOwned = getBagCount(recipe.resultId) > 0 || me.tools?.[recipe.toolCategory] === recipe.resultId;
          const hasFromTool = getBagCount(recipe.fromId) > 0;
          const hasAllMaterials = recipe.materials.every(material => getAvailableCount(material.itemId) >= material.count);
          const hasMoney = (village.sharedMoney || 0) >= recipe.costMoney;
          const canForge = !alreadyOwned && hasFromTool && hasAllMaterials && hasMoney;
          const materialBadges = recipe.materials.map(material => {
            const count = getAvailableCount(material.itemId);
            const item = ITEMS[material.itemId];
            const enough = count >= material.count;
            return `<span class="px-1.5 py-0.5 rounded-md font-bold ${enough ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}">
              ${item?.icon || '📦'} ${item?.name || material.itemId} ${count}/${material.count}
            </span>`;
          }).join(' ');

          return `
            <div class="p-2.5 rounded-xl bg-white text-stone-800 flex items-center justify-between gap-2">
              <div class="min-w-0 space-y-1">
                <div class="font-black text-xs">${targetItem?.icon || '⚒️'} ${targetItem?.name || recipe.resultId}
                  <span class="px-1 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900">檢定 +${targetItem?.bonus || 0}</span>
                </div>
                <div class="text-[10px] text-stone-600">${materialBadges}</div>
                <div class="text-[10px] font-bold ${hasMoney ? 'text-amber-800' : 'text-red-700'}">💰 ${recipe.costMoney} 元 · 前置工具：${fromItem?.name || recipe.fromId} ${hasFromTool ? '✓' : '（背包缺少）'}</div>
              </div>
              <button
                data-forge-id="${recipe.resultId}"
                ${!canForge ? 'disabled' : ''}
                class="shrink-0 px-3 py-2 rounded-xl font-black text-xs border ${
                  alreadyOwned
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : canForge
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-stone-200 text-stone-400 border-stone-300'
                }"
              >
                ${alreadyOwned ? '✅ 已擁有' : '鍛造升級'}
              </button>
            </div>
          `;
        }).join('')}
      </div>

      <!-- 1. 打磨全村工具 -->
      <div class="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5">
        <div class="font-black text-sm text-amber-950">✨ 打磨保養全村工具</div>
        <p class="text-xs text-amber-800">讓全村今天使用農具、斧頭、魚竿時檢定 +1（每日限一次）。</p>
        <button id="btn-smith-sharpen" ${village.toolsSharpenedToday ? 'disabled' : ''} class="w-full py-2 rounded-xl font-bold text-xs ${
          village.toolsSharpenedToday ? 'bg-stone-200 text-stone-500' : 'bg-amber-600 text-white'
        }">
          ${village.toolsSharpenedToday ? '✅ 今日全村工具已保養完成' : '執行工具打磨保養'}
        </button>
      </div>

      <!-- 2. 原石與怪石鑑定 -->
      <div class="p-3 rounded-2xl bg-purple-50 border border-purple-200 space-y-2">
        <div class="font-black text-sm text-purple-950">🔮 鑑定原石與奇怪石頭</div>
        <div class="grid grid-cols-2 gap-2">
          <button data-appraise="strange_stone" ${strangeCnt <= 0 ? 'disabled' : ''} class="p-2.5 rounded-xl font-bold text-xs border ${
            strangeCnt > 0 ? 'bg-white border-purple-300 text-purple-900' : 'bg-stone-100 text-stone-400'
          }">
            🪨 鑑定奇怪石頭<br><span class="text-[10px]">庫存 ${strangeCnt}</span>
          </button>
          <button data-appraise="rough_ore_gem" ${roughCnt <= 0 ? 'disabled' : ''} class="p-2.5 rounded-xl font-bold text-xs border ${
            roughCnt > 0 ? 'bg-white border-purple-300 text-purple-900' : 'bg-stone-100 text-stone-400'
          }">
            🔮 鑑定混濁原石<br><span class="text-[10px]">庫存 ${roughCnt}</span>
          </button>
        </div>
      </div>

      <!-- 3. 熔煉金屬礦錠 -->
      <div class="p-3 rounded-2xl bg-slate-100 border border-slate-300 space-y-2">
        <div class="font-black text-sm text-slate-900">🔥 熔煉金屬礦錠（需 3 顆原礦）</div>
        <div class="grid grid-cols-3 gap-1.5">
          ${smeltRecipes.map(recipe => {
            const ownedCount = getAvailableCount(recipe.oreId);
            const canSmelt = ownedCount >= 3;
            const ore = ITEMS[recipe.oreId];
            return `
              <button data-smelt="${recipe.id}" ${!canSmelt ? 'disabled' : ''} class="p-2 rounded-xl border text-xs font-bold ${
                canSmelt ? 'bg-white border-slate-300 text-slate-900' : 'bg-red-50 border-red-200 text-red-700'
              }">
                ${recipe.icon} ${recipe.name}<br>
                <span class="text-[10px]">Lv.${recipe.level}</span><br>
                <span class="text-[10px] ${canSmelt ? 'text-emerald-700' : 'text-red-700'}">${ore?.name || recipe.oreId} ${ownedCount}/3</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  openGenericModal('⚒️ 鐵匠與珠寶鑑定爐', html);

  document.getElementById('generic-modal-body').querySelectorAll('[data-forge-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const result = await runAction(
        () => actionForgeTool(state.roomId, me.id, btn.dataset.forgeId),
        { skipDice: true }
      );
      if (!result?.forgeState) return;

      const currentMe = getMe();
      if (!currentMe || !state.village) return;
      currentMe.inventory = result.forgeState.inventory;
      currentMe.tools = result.forgeState.tools;
      state.village.sharedMoney = result.forgeState.sharedMoney;
      state.village.warehouse = result.forgeState.warehouse;
      openSmithyModal(state.village, currentMe);
    });
  });

  document.getElementById('btn-smith-sharpen')?.addEventListener('click', () => {
    closeGenericModal();
    runAction(() => actionSmithing(state.roomId, me.id, 'sharpen'), { skipDice: true });
  });
  document.getElementById('generic-modal-body').querySelectorAll('[data-appraise]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeGenericModal();
      runAction(() => actionSmithing(state.roomId, me.id, 'appraise', btn.dataset.appraise));
    });
  });
  document.getElementById('generic-modal-body').querySelectorAll('[data-smelt]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeGenericModal();
      runAction(() => actionSmithing(state.roomId, me.id, 'smelt', btn.dataset.smelt));
    });
  });
}

function openCraftBaitModal(village, me) {
  const baits = [
    { id: 'worm_bait', desc: '蚯蚓餌 x3 (Lv.1)', ingredients: [{ itemId: 'wakame', count: 1 }] },
    { id: 'shrimp_bait', desc: '南極蝦餌 x3 (Lv.4)', ingredients: [{ itemId: 'wakame', count: 1 }, { itemId: 'chub', count: 1 }] },
    { id: 'lure_bait', desc: '發光路亞餌 x2 (Lv.7)', ingredients: [{ itemId: 'copper_bar', count: 1 }, { itemId: 'squid', count: 1 }] }
  ];
  openGenericModal('🪱 漁夫手工製作魚餌', `
    <div class="space-y-2">
      <p class="text-[11px] text-stone-500">材料數量為背包＋共用倉庫現有數／需求數；綠色代表足夠，紅色代表不足。</p>
      ${baits.map(b => {
        const canCraft = b.ingredients.every(ingredient =>
          getTotalItemCount(me, village.warehouse, ingredient.itemId) >= ingredient.count
        );
        return `
        <button data-craft-bait="${b.id}" ${!canCraft ? 'disabled' : ''} class="w-full p-3 rounded-2xl border text-left ${
          canCraft ? 'bg-sky-50 border-sky-200 active:bg-sky-100' : 'bg-red-50 border-red-200 opacity-80'
        }">
          <div class="font-black text-sm text-sky-950">${ITEMS[b.id].icon} ${ITEMS[b.id].name}</div>
          <div class="text-xs text-sky-800 mt-0.5">${b.desc}</div>
          <div class="mt-2 flex flex-wrap gap-1.5">${renderIngredientStatus(b.ingredients, me, village.warehouse)}</div>
        </button>
      `; }).join('')}
    </div>
  `);
  document.getElementById('generic-modal-body').querySelectorAll('[data-craft-bait]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeGenericModal();
      runAction(() => actionCraftBait(state.roomId, me.id, btn.dataset.craftBait), { skipDice: true });
    });
  });
}

function openNpcModal(village, me, npcId) {
  const npc = NPCS[npcId];
  if (!npc) return;

  // 可出售的物資（從背包與倉庫彙整）
  const sellableMap = {};
  (me.inventory || []).forEach(i => { sellableMap[i.itemId] = (sellableMap[i.itemId] || 0) + i.count; });
  Object.entries(village.warehouse || {}).forEach(([id, c]) => { sellableMap[id] = (sellableMap[id] || 0) + c; });

  const sellableList = Object.entries(sellableMap).filter(([id, cnt]) => cnt > 0 && ITEMS[id]?.sellPrice > 0);

  // 該 NPC 販售的商品
  let shopItems = [];
  if (npcId === 'grandma_chen') {
    shopItems = Object.values(ITEMS).filter(i => i.buyPrice > 0 && !['basic_feed', 'worm_bait', 'shrimp_bait', 'lure_bait'].includes(i.id));
  } else if (npcId === 'captain_hai') {
    shopItems = ['worm_bait', 'shrimp_bait', 'lure_bait'].map(id => ITEMS[id]);
  } else if (npcId === 'vet_fang') {
    shopItems = [ITEMS.basic_feed];
  }

  const html = `
    <div class="p-3 rounded-2xl ${npc.badgeBg} flex items-center gap-3">
      ${renderNpcAvatarSVG(npc.id, 52)}
      <div>
        <div class="font-black text-sm text-stone-900">${npc.name} · ${npc.title}</div>
        <p class="text-xs text-stone-700 mt-0.5">${npc.roleDesc}</p>
        <p class="text-[11px] font-bold text-rose-700 mt-1">💗 好感度：${me.npcFavor?.[npcId] || 0}</p>
      </div>
    </div>

    <!-- 聊天按鈕（人氣王每日限向一人領小禮物） -->
    <button id="btn-npc-chat" class="w-full py-2.5 rounded-xl bg-amber-500 active:bg-amber-600 text-white font-black text-xs shadow-xs">
      💬 寒暄聊天 ${me.traits?.includes('popular')
        ? ((me.popularGiftUsedToday || Object.keys(me.dailyNpcChatUsed || {}).length > 0)
            ? '（今日人氣王禮物已領取）'
            : '（🌻人氣王今日可領 1 份小禮物！）')
        : ''}
    </button>

    <!-- 出售與交涉議價區 -->
    <div class="space-y-1.5">
      <div class="text-xs font-black text-stone-700">💰 出售物資給${npc.name}（⭐為高價偏好）</div>
      ${sellableList.length === 0
        ? '<p class="text-xs text-stone-400 py-2">目前背包與倉庫沒有可出售的物資</p>'
        : `<div class="max-h-44 overflow-y-auto space-y-1.5 pr-1">
            ${sellableList.map(([id, cnt]) => {
              const def = ITEMS[id];
              const isFav = npc.favoriteItems.includes(id) || npc.favoriteCategories.includes(def.category);
              return `
                <div class="p-2 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                  <div class="min-w-0">
                    <span class="font-bold">${def.icon} ${def.name}</span>
                    <span class="text-stone-500">x${cnt}</span>
                    ${isFav ? '<span class="ml-1 text-[10px] font-black text-red-600">⭐高價</span>' : ''}
                  </div>
                  <div class="flex gap-1 shrink-0">
                    <button data-sell-direct="${id}" class="px-2 py-1 rounded-lg bg-white border border-stone-300 font-bold text-[11px]">賣1個</button>
                    <button data-sell-neg="${id}" class="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px]">🎲議價賣</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>`
      }
    </div>

    <!-- 採買商品區 -->
    ${shopItems.length ? `
      <div class="space-y-1.5 pt-2 border-t border-stone-200">
        <div class="text-xs font-black text-stone-700">🛒 向${npc.name}採買（公款 ${village.sharedMoney} 元）</div>
        <div class="max-h-44 overflow-y-auto space-y-1.5 pr-1">
          ${shopItems.map(item => `
            <div class="p-2 rounded-xl bg-amber-50/40 border border-amber-200 flex items-center justify-between text-xs">
              <div>
                <div class="font-bold text-stone-800">${item.icon} ${item.name}</div>
                <div class="text-[10px] text-stone-500">單價 ${item.buyPrice} 元</div>
              </div>
              <div class="flex gap-1">
                <button data-buy-one="${item.id}" class="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold text-[11px]">買 1</button>
                <button data-buy-three="${item.id}" class="px-2.5 py-1 rounded-lg bg-amber-700 text-white font-bold text-[11px]">買 3</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  openGenericModal(`🏘️ 與 ${npc.name} 互動`, html);

  const modalBody = document.getElementById('generic-modal-body');
  document.getElementById('btn-npc-chat').addEventListener('click', async () => {
    try {
      const res = await actionChatNpc(state.roomId, me.id, npcId);
      if (res?.isDialogue) {
        closeGenericModal();
        showNpcDialogueModal(res, village, me);
      }
    } catch (err) {
      showToast(err.message || '對話發生錯誤', 'error');
    }
  });
  modalBody.querySelectorAll('[data-sell-direct]').forEach(btn => {
    btn.addEventListener('click', () => runAction(() => actionSellToNpc(state.roomId, me.id, npcId, btn.dataset.sellDirect, 1, false), { skipDice: true }));
  });
  modalBody.querySelectorAll('[data-sell-neg]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeGenericModal();
      runAction(() => actionSellToNpc(state.roomId, me.id, npcId, btn.dataset.sellNeg, 1, true));
    });
  });
  modalBody.querySelectorAll('[data-buy-one]').forEach(btn => {
    btn.addEventListener('click', () => runAction(() => actionBuyFromShop(state.roomId, me.id, btn.dataset.buyOne, 1), { skipDice: true }));
  });
  modalBody.querySelectorAll('[data-buy-three]').forEach(btn => {
    btn.addEventListener('click', () => runAction(() => actionBuyFromShop(state.roomId, me.id, btn.dataset.buyThree, 3), { skipDice: true }));
  });
}

function openScratchModal(village, me) {
  const overlay = document.getElementById('generic-modal');
  const titleEl = document.getElementById('generic-modal-title');
  const bodyEl = document.getElementById('generic-modal-body');
  if (!overlay || !bodyEl) return;

  if (titleEl) titleEl.textContent = '🎟️ 陳阿嬤的過年刮刮樂攤';

  const alreadyUsed = Boolean(me.scratchUsedToday);

  bodyEl.innerHTML = `
    <div class="text-center space-y-3 select-none">
      <div style="background: linear-gradient(135deg, #dc2626, #d97706);" class="p-3.5 rounded-3xl bg-red-600 text-white shadow-md border-2 border-amber-300">
        <div class="text-xs font-bold opacity-95">🧧 新春限定・每人每日限刮一張</div>
        <div class="text-lg font-black mt-0.5">頭獎 5,000 元 ＋ 台灣藍寶！</div>
        <div class="text-[11px] mt-0.5 text-amber-100">每張花費公款 ${SCRATCH_CARD_COST} 元（需一鼓作氣刮開 60%）</div>
      </div>

      <div id="scratch-card-wrapper" class="relative w-full h-36 rounded-2xl border-2 border-dashed border-amber-500 overflow-hidden shadow-inner bg-amber-50">
        <div id="scratch-prize-layer" style="background: radial-gradient(circle at center, #fffbeb 0%, #fde68a 100%);" class="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
          ${alreadyUsed
            ? `
              <div class="text-2xl mb-1">🧧</div>
              <div class="font-black text-stone-700 text-sm">今日已刮過囉，明天請早！</div>
              <div class="text-[11px] text-stone-500 mt-0.5">睡覺換日後即可再來試手氣</div>
            `
            : `
              <div class="text-xs font-black text-red-700 tracking-wider">✨ 幸運大獎即將揭曉 ✨</div>
              <div class="text-base font-black text-amber-950 mt-1">繼續刮開銀漆！</div>
              <div class="text-[11px] text-amber-800 mt-0.5">刮滿 60% 自動開獎</div>
            `
          }
        </div>

        ${!alreadyUsed ? `
          <canvas id="scratch-canvas" width="320" height="144" style="touch-action: none;" class="absolute inset-0 w-full h-full cursor-pointer"></canvas>
          <canvas id="scratch-fx-canvas" width="320" height="144" class="absolute inset-0 w-full h-full pointer-events-none"></canvas>
        ` : ''}
      </div>

      <div class="space-y-1.5">
        <div class="w-full h-2.5 rounded-full bg-stone-200 overflow-hidden border border-stone-300">
          <div id="scratch-progress-bar" style="width: ${alreadyUsed ? '100' : '0'}%;" class="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-100"></div>
        </div>
        <div id="scratch-status-text" class="text-xs font-bold text-stone-700">
          ${alreadyUsed ? '✅ 今日幸運刮刮樂已完成' : '👆 按住銀漆不放，一鼓作氣刮開 60% 以上！'}
        </div>
      </div>
    </div>
  `;

  overlay.classList.remove('hidden');

  if (alreadyUsed) return;

  const wrapper = document.getElementById('scratch-card-wrapper');
  const canvas = document.getElementById('scratch-canvas');
  const fxCanvas = document.getElementById('scratch-fx-canvas');
  const prizeLayer = document.getElementById('scratch-prize-layer');
  const progressBar = document.getElementById('scratch-progress-bar');
  const statusText = document.getElementById('scratch-status-text');
  if (!wrapper || !canvas || !fxCanvas || !prizeLayer || !progressBar || !statusText) return;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const fxCtx = fxCanvas.getContext('2d');
  if (!ctx || !fxCtx) {
    showToast('此裝置無法啟動畫布刮刮樂，請重新載入頁面再試。', 'error');
    return;
  }

  let isScratching = false;
  let isUnlocked = false;
  let lastPt = null;
  let moveSampleCounter = 0;
  let lastTickSoundTime = 0;
  let flakes = [];
  let fxRafId = null;

  function paintSilverFoil() {
    ctx.globalCompositeOperation = 'source-over';
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#94a3b8');
    grad.addColorStop(0.28, '#e2e8f0');
    grad.addColorStop(0.55, '#cbd5e1');
    grad.addColorStop(0.82, '#f1f5f9');
    grad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.5;
    for (let i = -canvas.height; i < canvas.width + canvas.height; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - 40, canvas.height);
      ctx.stroke();
    }

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪙 按住不放・一鼓作氣刮開 60%', canvas.width / 2, canvas.height / 2 - 8);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('（中途放開未滿 60% 會重新塗上銀漆喔！）', canvas.width / 2, canvas.height / 2 + 14);
  }

  function getClearedPercentage() {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let cleared = 0;
    let total = 0;
    for (let i = 3; i < imgData.length; i += 16) {
      total++;
      if (imgData[i] < 128) cleared++;
    }
    return total > 0 ? Math.round((cleared / total) * 100) : 0;
  }

  function spawnSilverFlakes(x, y, count = 6, isCelebration = false) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = isCelebration ? (60 + Math.random() * 140) : (25 + Math.random() * 65);
      flakes.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (isCelebration ? 60 : 25),
        size: isCelebration ? (3 + Math.random() * 3.5) : (2 + Math.random() * 2.5),
        rot: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 10,
        alpha: 1,
        color: isCelebration
          ? (Math.random() > 0.5 ? '#facc15' : '#fb7185')
          : (Math.random() > 0.4 ? '#f8fafc' : '#94a3b8')
      });
    }
    if (!fxRafId) {
      let lastT = performance.now();
      const stepFlakes = (now) => {
        if (!document.getElementById('scratch-fx-canvas')) {
          fxRafId = null;
          return;
        }
        const dt = Math.min(0.05, (now - lastT) / 1000);
        lastT = now;

        fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
        for (let i = flakes.length - 1; i >= 0; i--) {
          const f = flakes[i];
          f.vy += 320 * dt;
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.rot += f.vRot * dt;
          f.alpha -= dt * 1.9;
          if (f.alpha <= 0) {
            flakes.splice(i, 1);
            continue;
          }
          fxCtx.save();
          fxCtx.globalAlpha = f.alpha;
          fxCtx.translate(f.x, f.y);
          fxCtx.rotate(f.rot);
          fxCtx.fillStyle = f.color;
          fxCtx.fillRect(-f.size / 2, -f.size / 2, f.size, f.size * 0.65);
          fxCtx.restore();
        }

        if (flakes.length > 0) {
          fxRafId = requestAnimationFrame(stepFlakes);
        } else {
          fxRafId = null;
        }
      };
      fxRafId = requestAnimationFrame(stepFlakes);
    }
  }

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function eraseAt(pt) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 44;

    ctx.beginPath();
    if (lastPt) {
      ctx.moveTo(lastPt.x, lastPt.y);
      ctx.lineTo(pt.x, pt.y);
    } else {
      ctx.arc(pt.x, pt.y, 22, 0, Math.PI * 2);
    }
    ctx.stroke();
    lastPt = pt;

    spawnSilverFlakes(pt.x, pt.y, 5, false);

    const now = performance.now();
    if (now - lastTickSoundTime > 95 && typeof soundFX !== 'undefined') {
      lastTickSoundTime = now;
      soundFX.playDiceTick();
    }
  }

  async function unlockPrize() {
    if (isUnlocked) return;
    isUnlocked = true;
    isScratching = false;

    progressBar.style.width = '100%';
    statusText.className = 'text-xs font-black text-emerald-700';
    statusText.textContent = '🎉 成功刮開 60%！正在揭曉幸運獎項...';

    canvas.classList.add('scratch-foil-dissolve');
    spawnSilverFlakes(canvas.width / 2, canvas.height / 2, 36, true);

    prizeLayer.innerHTML = `
      <div class="text-2xl animate-bounce">🎲</div>
      <div class="font-black text-amber-900 text-sm mt-1">幸運骰子滾動開獎中...</div>
    `;

    try {
      const res = await actionScratchCard(state.roomId, me.id);
      const rollNum = res?.check?.roll ?? res?.roll ?? '★';
      const msg = res?.message || '恭喜獲得新春好禮！';

      if (typeof soundFX !== 'undefined') {
        if (Number(rollNum) >= 18) soundFX.playCritSuccess();
        else soundFX.playCoin();
      }

      prizeLayer.innerHTML = `
        <div class="text-xs font-black text-red-600">🎲 幸運骰結果：【${escapeHtml(rollNum)}】</div>
        <div class="text-sm font-black text-stone-900 mt-1 leading-snug px-2">${escapeHtml(msg)}</div>
      `;
      statusText.textContent = '✅ 獎金與道具已自動存入村莊公款／倉庫！';
    } catch (err) {
      isUnlocked = false;
      canvas.classList.remove('scratch-foil-dissolve');
      paintSilverFoil();
      progressBar.style.width = '0%';
      statusText.className = 'text-xs font-bold text-red-600';
      statusText.textContent = `⚠️ ${err.message || '無法刮開，請稍後再試'}`;
      showToast(err.message || '刮刮樂發生錯誤', 'error');
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (isUnlocked) return;
    isScratching = true;
    lastPt = null;
    moveSampleCounter = 0;
    canvas.setPointerCapture(e.pointerId);

    const pt = getCanvasPos(e);
    eraseAt(pt);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isScratching || isUnlocked) return;
    e.preventDefault();

    const pt = getCanvasPos(e);
    eraseAt(pt);

    moveSampleCounter++;
    if (moveSampleCounter % 3 === 0) {
      const pct = getClearedPercentage();
      const displayPct = Math.min(100, pct);
      progressBar.style.width = `${displayPct}%`;
      statusText.className = 'text-xs font-black text-amber-800';
      statusText.textContent = `🔥 正在刮除：${displayPct}% / 目標 60%（別鬆手！）`;

      if (pct >= 60) {
        unlockPrize();
      }
    }
  });

  const handleRelease = () => {
    if (!isScratching || isUnlocked) return;
    isScratching = false;
    lastPt = null;

    const pct = getClearedPercentage();
    if (pct >= 60) {
      unlockPrize();
      return;
    }

    wrapper.classList.remove('animate-scratch-shake');
    void wrapper.offsetWidth;
    wrapper.classList.add('animate-scratch-shake');

    paintSilverFoil();
    progressBar.style.width = '0%';
    statusText.className = 'text-xs font-bold text-red-600';
    statusText.textContent = `😅 差一點（只刮了 ${pct}%）！必須一次刮滿 60%，銀漆已重新塗好！`;
  };

  canvas.addEventListener('pointerup', handleRelease);
  canvas.addEventListener('pointercancel', handleRelease);

  paintSilverFoil();
}

function openSleepModal(village, me) {
  const now = Date.now();
  const activePlayers = state.players.filter(
    p => p.id === me.id || (now - (p.lastActiveAt || 0) <= ONLINE_TIMEOUT_MS)
  );
  const hasAFK = state.players.some(
    p => !p.isSleeping && (now - (p.lastActiveAt || 0) > ONLINE_TIMEOUT_MS)
  );

  const html = `
    <p class="text-xs text-stone-600 leading-relaxed">
      只要<strong>目前在線的家人</strong>全都上床睡覺，系統就會立刻進行換日結算（作物成長、出貨與氣候更新）！
    </p>
    <div class="space-y-1.5">
      ${activePlayers.map(p => `
        <div class="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            ${renderAvatarSVG(p.avatarConfig, 26)}
            <span class="font-bold text-stone-800">${escapeHtml(p.name)}</span>
          </div>
          <span class="font-black ${p.isSleeping ? 'text-indigo-600' : 'text-emerald-600'}">
            ${p.isSleeping ? '💤 已上床睡覺' : '🏃 活動中'}
          </span>
        </div>
      `).join('')}
    </div>

    <button id="btn-confirm-sleep" class="w-full py-3 rounded-2xl bg-indigo-600 active:bg-indigo-700 text-white font-black text-sm shadow-sm">
      🛏️ 上床睡覺（準備迎接明天）
    </button>

    ${hasAFK ? `
      <button id="btn-force-sleep" class="w-full py-2 rounded-xl bg-stone-200 text-stone-700 font-bold text-xs">
        💡 幫掛機超過 10 分鐘的家人關燈（強制換日）
      </button>
    ` : ''}
  `;
  openGenericModal('🌙 結束今日行程', html);

  document.getElementById('btn-confirm-sleep').addEventListener('click', async () => {
    closeGenericModal();
    const previousDay = state.village?.day;
    await goToSleepAndMaybeAdvanceDay(
      state.roomId,
      me.id,
      state.players,
      false,
      getEffectivePersonalTime(me)
    );
    if (previousDay !== undefined && state.village?.day !== previousDay) {
      resetLocalPersonalClock();
      renderGameScreen();
    }
    showToast('已上床休息！', 'info');
  });

  document.getElementById('btn-force-sleep')?.addEventListener('click', async () => {
    closeGenericModal();
    const previousDay = state.village?.day;
    await goToSleepAndMaybeAdvanceDay(
      state.roomId,
      me.id,
      state.players,
      true,
      getEffectivePersonalTime(me)
    );
    if (previousDay !== undefined && state.village?.day !== previousDay) {
      resetLocalPersonalClock();
      renderGameScreen();
    }
    showToast('已為全村關燈並結算進入新的一天！', 'success');
  });
}

// ============================================================================
// 九、 D&D d20 擲骰動畫演出與頁面初始化
// ============================================================================

/**
 * 根據 NPC 的台詞內容，產生對應的玩家回覆按鈕文字
 */
function getPlayerReplyForNpc(greeting = '', hasGift = false) {
  if (hasGift) {
    return '🎁 開心收下並結束對話 ▶';
  }
  if (greeting.includes('早安')) {
    return '早安！今天也一起加油 ▶';
  }
  if (greeting.includes('呷飽')) {
    return '呷飽囉！正要去忙呢 ▶';
  }
  if (greeting.includes('刮刮樂') || greeting.includes('手氣')) {
    return '好呀，我來試試手氣！▶';
  }
  if (greeting.includes('便宜') || greeting.includes('公道') || greeting.includes('交易')) {
    return '太好了，那就拜託您了！▶';
  }
  if (greeting.includes('耐心') || greeting.includes('講究')) {
    return '受教了，謝謝指導！▶';
  }
  if (greeting.includes('提醒') || greeting.includes('著涼') || greeting.includes('別忘')) {
    return '好的，謝謝提醒！▶';
  }
  if (greeting.includes('加油') || greeting.includes('齊心') || greeting.includes('委託')) {
    return '沒問題，大家一起加油！▶';
  }
  if (greeting.includes('海象') || greeting.includes('小管') || greeting.includes('原石') || greeting.includes('牛樟芝') || greeting.includes('照顧')) {
    return '沒問題，我這就去看看！▶';
  }
  return '沒問題，先去忙囉！▶';
}

function showNpcDialogueModal(dialogueData, village, me) {
  const npc = NPCS[dialogueData.npcId];
  if (!npc) return;

  const overlay = document.getElementById('rpg-dialogue-overlay');
  const avatarEl = document.getElementById('rpg-npc-avatar');
  const nameEl = document.getElementById('rpg-npc-name');
  const titleEl = document.getElementById('rpg-npc-title');
  const textEl = document.getElementById('rpg-dialogue-text');
  const giftBox = document.getElementById('rpg-gift-box');
  const giftDesc = document.getElementById('rpg-gift-desc');
  const giftBadge = document.getElementById('rpg-gift-item-badge');
  const againBtn = document.getElementById('btn-rpg-chat-again');
  const closeBtn = document.getElementById('btn-rpg-close');
  const hasGift = Boolean(dialogueData.giftInfo);

  avatarEl.innerHTML = renderNpcAvatarSVG(npc.id, 88);
  nameEl.textContent = npc.name;
  titleEl.textContent = npc.title;
  textEl.textContent = dialogueData.greeting;
  closeBtn.textContent = getPlayerReplyForNpc(dialogueData.greeting, hasGift);

  if (hasGift) {
    const itemDef = ITEMS[dialogueData.giftInfo.itemId];
    giftDesc.textContent = dialogueData.giftInfo.text;
    giftBadge.textContent = `🎁 獲得：${itemDef?.icon || ''} ${itemDef?.name || ''} × ${dialogueData.giftInfo.count}`;
    giftBox.classList.remove('hidden');
    if (worldMap.canvas) {
      worldMap.spawnFloatingText(`🎁 獲得 ${itemDef?.name || '小禮物'} ×${dialogueData.giftInfo.count}`, '#fde047');
    }
  } else {
    giftDesc.textContent = '';
    giftBadge.textContent = '';
    giftBox.classList.add('hidden');
    if (worldMap.canvas) worldMap.spawnFloatingText('💬 聊天愉快！', '#fda4af');
  }

  overlay.classList.remove('hidden');

  againBtn.onclick = async () => {
    const activeMe = getMe() || me;
    againBtn.disabled = true;
    try {
      const nextRes = await actionChatNpc(state.roomId, activeMe.id, npc.id);
      if (nextRes?.isDialogue) {
        showNpcDialogueModal(nextRes, state.village || village, activeMe);
      }
    } catch (err) {
      showToast(err.message || '對話發生錯誤', 'error');
    } finally {
      againBtn.disabled = false;
    }
  };

  closeBtn.onclick = () => {
    overlay.classList.add('hidden');
  };
}

function showDiceAnimation(check, resultMessage, levelUpNotes = []) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('dice-overlay');
    const diceBox = document.getElementById('dice-box');
    const diceNum = document.getElementById('dice-number');
    const formulaEl = document.getElementById('dice-formula');
    const badgeEl = document.getElementById('dice-badge');
    const resultEl = document.getElementById('dice-result-text');
    const lvBox = document.getElementById('dice-levelup-box');
    const closeBtn = document.getElementById('btn-close-dice');

    overlay.classList.remove('hidden');
    diceBox.classList.add('animate-dice-spin');
    badgeEl.className = 'inline-block px-3 py-1 rounded-full text-xs font-black mt-2 bg-stone-100 text-stone-600';
    badgeEl.textContent = '擲骰判定中...';
    formulaEl.textContent = `目標難度 DC ${check.effectiveDC}（總加值 ${check.totalMod >= 0 ? '+' : ''}${check.totalMod}）`;
    resultEl.textContent = '命運的 20 面骰正在滾動...';
    lvBox.classList.add('hidden');

    // 擲骰過程中先顯示等待文字，避免提前出現結果按鈕
    closeBtn.className = 'mt-4 w-full py-2.5 rounded-xl bg-stone-400 text-white font-bold text-sm';
    closeBtn.textContent = '擲骰判定中...';
    closeBtn.disabled = true;

    let ticks = 0;
    const interval = setInterval(() => {
      diceNum.textContent = Math.floor(Math.random() * 20) + 1;
      soundFX.playDiceTick();
      ticks++;
      if (ticks >= 8) {
        clearInterval(interval);
        finishDice();
      }
    }, 75);

    function finishDice() {
      diceBox.classList.remove('animate-dice-spin');
      diceNum.textContent = check.roll;
      formulaEl.textContent = `1d20 (${check.roll}) ${check.totalMod >= 0 ? '+' : ''}${check.totalMod} = ${check.totalScore} vs DC ${check.effectiveDC}`;
      closeBtn.disabled = false;

      if (check.isCritSuccess) {
        soundFX.playCritSuccess();
        badgeEl.className = 'inline-block px-3 py-1 rounded-full text-xs font-black mt-2 bg-amber-400 text-stone-900';
        badgeEl.textContent = '🌟 大成功（Natural 20）！';
        closeBtn.className = 'mt-4 w-full py-2.5 rounded-xl bg-amber-600 active:bg-amber-700 text-white font-black text-sm';
        closeBtn.textContent = '太棒了！大豐收（點擊繼續）';
      } else if (check.isCritFail) {
        soundFX.playFail(true);
        badgeEl.className = 'inline-block px-3 py-1 rounded-full text-xs font-black mt-2 bg-red-600 text-white';
        badgeEl.textContent = '💥 大失敗（Natural 1）！';
        closeBtn.className = 'mt-4 w-full py-2.5 rounded-xl bg-stone-700 active:bg-stone-800 text-white font-bold text-sm';
        closeBtn.textContent = '哎呀真糗（點擊繼續）';
      } else if (check.isSuccess) {
        soundFX.playSuccess();
        badgeEl.className = 'inline-block px-3 py-1 rounded-full text-xs font-black mt-2 bg-emerald-600 text-white';
        badgeEl.textContent = '✅ 檢定成功！';
        closeBtn.className = 'mt-4 w-full py-2.5 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white font-bold text-sm';
        closeBtn.textContent = '太好了（點擊繼續）';
      } else {
        soundFX.playFail(false);
        badgeEl.className = 'inline-block px-3 py-1 rounded-full text-xs font-black mt-2 bg-stone-500 text-white';
        badgeEl.textContent = '😅 差了一點（未達難度）';
        closeBtn.className = 'mt-4 w-full py-2.5 rounded-xl bg-stone-700 active:bg-stone-800 text-white font-bold text-sm';
        closeBtn.textContent = '沒關係，下次再來（點擊繼續）';
      }

      resultEl.textContent = `${check.flavorText ? check.flavorText + ' ' : ''}${resultMessage || ''}`;

      if (levelUpNotes?.length) {
        lvBox.innerHTML = levelUpNotes.join('<br>');
        lvBox.classList.remove('hidden');
      }
    }

    closeBtn.onclick = () => {
      clearInterval(interval);
      overlay.classList.add('hidden');
      resolve();
    };
  });
}

function openSettingsModal() {
  const modal = document.getElementById('settings-modal');

  const syncButtons = () => {
    modal.querySelectorAll('[data-set-mode]').forEach(btn => {
      const active = state.settings.controlMode === btn.dataset.setMode;
      btn.className = active
        ? 'p-2.5 rounded-xl border-2 border-emerald-600 bg-emerald-50 text-left'
        : 'p-2.5 rounded-xl border border-stone-200 bg-white text-left';
    });
    modal.querySelectorAll('[data-set-side]').forEach(btn => {
      const active = state.settings.joystickSide === btn.dataset.setSide;
      btn.className = active
        ? 'py-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 text-emerald-900 font-black'
        : 'py-2 rounded-xl border border-stone-200 bg-white text-stone-600 font-bold';
    });
    modal.querySelectorAll('[data-set-speed]').forEach(btn => {
      const active = state.settings.moveSpeed === btn.dataset.setSpeed;
      btn.className = active
        ? 'py-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 text-emerald-900 font-black'
        : 'py-2 rounded-xl border border-stone-200 bg-white text-stone-600 font-bold';
    });

    const soundBtn = document.getElementById('btn-setting-sound');
    const isMuted = soundFX.isMuted();
    soundBtn.textContent = isMuted ? '🔇 目前：靜音' : '🔊 目前：開啟';
    soundBtn.className = isMuted
      ? 'px-4 py-1.5 rounded-xl font-black text-xs bg-stone-300 text-stone-700'
      : 'px-4 py-1.5 rounded-xl font-black text-xs bg-emerald-600 text-white';
  };

  const saveAndRefresh = () => {
    localStorage.setItem('farm_user_settings', JSON.stringify(state.settings));
    syncButtons();
    worldMap.unmount();
    renderGameScreen();
  };

  modal.querySelectorAll('[data-set-mode]').forEach(btn => {
    btn.onclick = () => {
      state.settings.controlMode = btn.dataset.setMode;
      saveAndRefresh();
    };
  });
  modal.querySelectorAll('[data-set-side]').forEach(btn => {
    btn.onclick = () => {
      state.settings.joystickSide = btn.dataset.setSide;
      saveAndRefresh();
    };
  });
  modal.querySelectorAll('[data-set-speed]').forEach(btn => {
    btn.onclick = () => {
      state.settings.moveSpeed = btn.dataset.setSpeed;
      saveAndRefresh();
    };
  });

  document.getElementById('btn-setting-sound').onclick = () => {
    soundFX.toggleMute();
    const me = getMe();
    if (state.village && me) renderTopHud(state.village, me);
    syncButtons();
  };

  syncButtons();
  modal.classList.remove('hidden');
}

function openQuestBoardModal() {
  const modal = document.getElementById('quest-board-modal');
  const closeBtn = document.getElementById('btn-close-quest-board');
  if (!modal || !state.village || !getMe()) return;

  renderQuestsTab(state.village, getMe());
  modal.classList.remove('hidden');

  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.add('hidden');
  }
  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  };
}

function decoratePinnedNotices(container) {
  if (!container || container.id !== 'quest-board-body') return;

  const root = container.children.length === 1 && container.firstElementChild.children.length > 1
    ? container.firstElementChild
    : container;

  Array.from(root.children).forEach((el, idx) => {
    const hasButton = Boolean(el.querySelector('button'));
    if (idx === 0 && !hasButton) {
      el.className = 'mb-2 px-3.5 py-2 rounded-xl bg-amber-950/75 border border-amber-400/50 text-amber-100 text-xs font-bold text-center shadow-inner';
      return;
    }
    el.classList.add('pinned-notice');
    if (!el.querySelector('.board-pin')) {
      const pin = document.createElement('span');
      pin.className = `board-pin pin-color-${idx % 3}`;
      el.prepend(pin);
    }
  });
}

function switchTab(tabName) {
  if (tabName === 'quests') {
    openQuestBoardModal();
    return;
  }

  if (tabName !== 'action') {
    worldMap.unmount();
    document.getElementById('location-bar')?.classList.remove('hidden');
  }
  state.activeTab = tabName;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const active = btn.dataset.tab === tabName;
    btn.className = active
      ? 'nav-btn flex flex-col items-center justify-center py-1 rounded-xl text-emerald-700 bg-emerald-50 font-bold'
      : 'nav-btn flex flex-col items-center justify-center py-1 rounded-xl text-stone-500';
  });
  renderGameScreen();
}

function openRestTimeModal() {
  const me = getMe();
  const overlay = document.getElementById('generic-modal');
  const titleEl = document.getElementById('generic-modal-title');
  const bodyEl = document.getElementById('generic-modal-body');
  if (!me || !overlay || !bodyEl) return;

  if (me.isSleeping) {
    showToast('🛌 你已經上床休息等待換日了，無法再調整時間喔！', 'info');
    return;
  }

  if (titleEl) titleEl.textContent = '🪑 涼亭歇息・調整個人時段';

  const curMins = getEffectivePersonalTime(me);
  const presets = [
    { label: '☀️ 正午時分', timeStr: '12:00', mins: 720, desc: '陽光充足，適合農作與採集' },
    { label: '🌇 黃昏夕陽', timeStr: '17:00', mins: 1020, desc: '橘紅晚霞，釣魚與採集加成 +1' },
    { label: '🌙 燈籠夜晚', timeStr: '19:30', mins: 1170, desc: '村民已回家休息、紅燈籠亮起、夜釣加成 +2' },
    { label: '🦉 靜謐深夜', timeStr: '22:00', mins: 1320, desc: '夜深人靜，適合挑戰深夜魚王' }
  ];

  const plusOneHourMins = Math.min(1430, curMins + 60);
  const canPlusHour = curMins < 1430 && plusOneHourMins > curMins;

  bodyEl.innerHTML = `
    <div class="space-y-3 text-xs">
      <div class="p-3 rounded-2xl bg-amber-100/80 border border-amber-400 text-center space-y-1">
        <div class="text-[11px] font-bold text-amber-900">目前個人時間（每 10 秒自然前進 1 分鐘・不可逆轉）</div>
        <div class="text-2xl font-black text-stone-900">🕒 ${formatGameTime(curMins)}</div>
        <div class="text-[11px] text-emerald-800 font-bold">✨ 歇息快轉完全免費，不消耗任何體力！</div>
      </div>

      <div class="space-y-2">
        <div class="font-black text-stone-700">選擇想前往的今日時段：</div>
        <div class="grid grid-cols-1 gap-2">
          ${presets.map(p => {
            const passed = curMins >= p.mins;
            return `
              <button
                data-rest-mins="${p.mins}"
                ${passed ? 'disabled' : ''}
                class="p-2.5 rounded-xl border text-left flex items-center justify-between transition ${
                  passed
                    ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                    : 'bg-white active:bg-amber-100 border-amber-400 text-stone-800 shadow-2xs'
                }"
              >
                <div>
                  <div class="font-black text-sm">${p.label}（${p.timeStr}）</div>
                  <div class="text-[11px] opacity-80">${passed ? '今日已過此時段（無法倒轉時間）' : p.desc}</div>
                </div>
                <span class="px-2.5 py-1 rounded-lg font-black text-[11px] ${passed ? 'bg-stone-200 text-stone-400' : 'bg-emerald-600 text-white'}">
                  ${passed ? '已過' : '歇息前往'}
                </span>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <button
        id="btn-rest-plus-hour"
        ${!canPlusHour ? 'disabled' : ''}
        class="w-full py-2.5 rounded-xl font-black text-xs border transition ${
          canPlusHour
            ? 'bg-amber-600 active:bg-amber-700 text-white border-amber-400 shadow-xs'
            : 'bg-stone-200 text-stone-400 border-stone-300 cursor-not-allowed'
        }"
      >
        ${canPlusHour ? `⏩ 小憩 1 小時（跳至 ${formatGameTime(plusOneHourMins)}・免費）` : '🌙 已接近深夜（請準備就寢）'}
      </button>
    </div>
  `;

  const applyFastForward = async (targetMins) => {
    const startMins = getEffectivePersonalTime(me);
    if (targetMins <= startMins) {
      showToast('時間只能往前推進，不能倒轉回去喔！', 'info');
      return;
    }

    try {
      const res = await actionRestFastForward(state.roomId, me.id, targetMins, startMins);
      const actualStart = res?.fromMins ?? startMins;
      const actualEnd = res?.toMins ?? targetMins;
      state.passiveMinutesElapsed = 0;
      state.lastSyncedPersonalTime = actualEnd;
      const currentMe = getMe();
      if (currentMe) {
        currentMe.personalTime = actualEnd;
        currentMe.effectiveTime = actualEnd;
      }
      overlay.classList.add('hidden');

      if (state.activeTab !== 'action') {
        switchTab('action');
      }

      await playGenshinClockTransition(actualStart, actualEnd);

      if (res?.message) {
        const curfewNote = actualStart < 1080 && actualEnd >= 1080
          ? '（18:00 已過，村民們都回家休息囉）'
          : '';
        showToast(`${res.message}${curfewNote}`, 'success');
        if (worldMap.canvas) worldMap.spawnFloatingText(`🪑 歇息至 ${formatGameTime(actualEnd)}`, '#fde047');
      }
      renderGameScreen();
    } catch (err) {
      console.error(err);
      showToast(err.message || '調整時段失敗', 'error');
    }
  };

  bodyEl.querySelectorAll('[data-rest-mins]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = Number(btn.dataset.restMins);
      if (mins > getEffectivePersonalTime(me)) applyFastForward(mins);
    });
  });

  document.getElementById('btn-rest-plus-hour')?.addEventListener('click', () => {
    const currentMins = getEffectivePersonalTime(me);
    if (currentMins < 1430) {
      applyFastForward(Math.min(1430, currentMins + 60));
    }
  });

  overlay.classList.remove('hidden');
}

function ensureTimeDialModal() {
  let modal = document.getElementById('time-dial-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'time-dial-modal';
    modal.className = 'hidden fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="w-full max-w-sm rounded-3xl border-2 border-amber-300/80 bg-stone-950/80 p-6 text-center shadow-2xl">
        <div class="text-xs font-black tracking-[0.3em] text-amber-200">歇息時光流轉中</div>
        <div class="mt-1 text-[11px] text-stone-200">村莊正隨時間迎接新的晨昏</div>
        <canvas id="time-dial-canvas" width="220" height="220" class="mx-auto my-4 h-[220px] w-[220px]"></canvas>
        <div id="time-dial-digital" class="font-mono text-4xl font-black tracking-wider text-amber-100">06:00</div>
        <div id="time-dial-period" class="mt-2 text-sm font-bold text-amber-200">🌅 清晨時分</div>
        <button id="time-dial-close" disabled class="mt-5 w-full rounded-xl bg-stone-600 py-2.5 text-sm font-black text-stone-300">
          時光流轉中…
        </button>
      </div>
    `;
    document.body.appendChild(modal);
  }
  return modal;
}

function playGenshinClockTransition(fromMins, toMins) {
  return new Promise((resolve, reject) => {
    const modal = ensureTimeDialModal();
    const canvas = modal.querySelector('#time-dial-canvas');
    const digitalEl = modal.querySelector('#time-dial-digital');
    const periodEl = modal.querySelector('#time-dial-period');
    const closeBtn = modal.querySelector('#time-dial-close');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !digitalEl || !periodEl || !closeBtn || !ctx) {
      reject(new Error('無法載入歇息時鐘動畫'));
      return;
    }

    const start = toDayTimelineMinutes(fromMins);
    const end = Math.max(start, toDayTimelineMinutes(toMins));
    const duration = Math.max(1800, Math.min(3000, 1400 + (end - start) * 2.4));
    let isAnimating = true;
    let didFinish = false;
    let lastTickStep = Math.floor(start / 15);

    closeBtn.disabled = true;
    closeBtn.className = 'mt-5 w-full rounded-xl bg-stone-600 py-2.5 text-sm font-black text-stone-300';
    closeBtn.textContent = '⏳ 時間調整中，請稍候…';

    const finishAndClose = () => {
      if (isAnimating || didFinish) return;
      didFinish = true;
      worldMap.setPreviewMinutes(null);
      modal.classList.add('hidden');
      modal.style.backgroundColor = '';
      resolve();
    };

    modal.onclick = (event) => {
      if (event.target === modal && !isAnimating) finishAndClose();
    };
    closeBtn.onclick = () => {
      if (!isAnimating) finishAndClose();
    };
    modal.style.backgroundColor = '';
    modal.classList.remove('hidden');

    const drawDial = (curMins) => {
      const { width, height } = canvas;
      const cx = width / 2;
      const cy = height / 2;
      const outerR = 96;
      const innerR = 72;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.fillStyle = '#2b160a';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fbbf24';
      ctx.stroke();

      const dialGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, innerR);
      dialGrad.addColorStop(0, '#fffbeb');
      dialGrad.addColorStop(1, '#ebd4a7');
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.fillStyle = dialGrad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#b45309';
      ctx.stroke();

      const to24HourAngle = (mins) => ((mins - 720) / 1440) * Math.PI * 2 - Math.PI / 2;
      const startAngle = to24HourAngle(start);
      const currentAngle = to24HourAngle(curMins);
      const minuteAngle = ((curMins % 60) / 60) * Math.PI * 2 - Math.PI / 2;

      if (curMins > start) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, innerR - 2, startAngle, currentAngle, false);
        ctx.closePath();
        ctx.fillStyle = 'rgba(245, 158, 11, 0.36)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, innerR - 2, startAngle, currentAngle, false);
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();
      }

      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
        const isMajor = i % 6 === 0;
        const r1 = innerR - (isMajor ? 11 : 6);
        const r2 = innerR - 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
        ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
        ctx.strokeStyle = isMajor ? '#92400e' : 'rgba(146, 64, 14, 0.45)';
        ctx.lineWidth = isMajor ? 2.5 : 1.3;
        ctx.stroke();
      }

      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☀️', cx, cy - outerR + 12);
      ctx.fillText('🌇', cx + outerR - 12, cy);
      ctx.fillText('🌙', cx, cy + outerR - 12);
      ctx.fillText('🌅', cx - outerR + 12, cy);

      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(minuteAngle) * 10, cy - Math.sin(minuteAngle) * 10);
      ctx.lineTo(cx + Math.cos(minuteAngle) * (innerR - 12), cy + Math.sin(minuteAngle) * (innerR - 12));
      ctx.stroke();

      ctx.strokeStyle = '#3b1e0b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(currentAngle) * 8, cy - Math.sin(currentAngle) * 8);
      ctx.lineTo(cx + Math.cos(currentAngle) * (innerR - 24), cy + Math.sin(currentAngle) * (innerR - 24));
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#451a03';
      ctx.stroke();
      ctx.restore();
    };

    const startTime = performance.now();
    const animate = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const currentMins = start + (end - start) * eased;
      drawDial(currentMins);

      worldMap.setPreviewMinutes(currentMins);
      const sky = getSkyLightingForMinutes(currentMins);
      modal.style.backgroundColor = `rgba(${sky.r}, ${sky.g}, ${sky.b}, ${Math.min(0.68, sky.a + 0.28)})`;

      const clockEl = document.getElementById('hud-clock-text');
      if (clockEl) clockEl.textContent = formatGameTime(currentMins);
      digitalEl.textContent = formatGameTime(currentMins);
      periodEl.textContent =
        currentMins < 540 ? '🌅 清晨時分' :
        currentMins < 1020 ? '☀️ 晴朗白天' :
        currentMins < 1080 ? '🌇 黃昏夕陽' :
        currentMins < 1140 ? '🏠 18:00 居民回家' :
        currentMins < 1440 ? '🌙 燈籠夜晚' : '🦉 深夜時分';

      const tickStep = Math.floor(currentMins / 15);
      if (tickStep > lastTickStep) {
        lastTickStep = tickStep;
        soundFX.playDiceTick();
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
        return;
      }

      isAnimating = false;
      soundFX.playSuccess();
      closeBtn.disabled = false;
      closeBtn.className = 'mt-5 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-black text-white';
      closeBtn.textContent = '✨ 時間調整完成（點擊返回）';
      setTimeout(finishAndClose, 700);
    };

    requestAnimationFrame(animate);
  });
}

// ============================================================================
// 十、 啟動綁定
// ============================================================================

function handleAuthStateChange(user) {
  const previousUid = state.user?.uid;
  const accountChanged = Boolean(user && previousUid && previousUid !== user.uid);
  state.user = user;
  setAuthFeedback('');

  const loginButton = document.getElementById('btn-google-login');
  const accountStatus = document.getElementById('auth-account-status');
  document.getElementById('btn-open-create-char').disabled = !user;
  loginButton.classList.toggle('hidden', Boolean(user));
  accountStatus.classList.toggle('hidden', !user);

  if (user) {
    document.getElementById('auth-account-email').textContent = user.email || 'Google 帳號已登入';
    document.getElementById('auth-account-uid').textContent = user.uid;
  }

  if (!user || accountChanged) {
    if (state.unsubRoom) {
      state.unsubRoom();
      state.unsubRoom = null;
    }
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
    if (state.passiveClockTimer) {
      clearInterval(state.passiveClockTimer);
      state.passiveClockTimer = null;
    }
    worldMap.unmount();
    state.playerId = null;
    state.village = null;
    state.players = [];
    document.getElementById('game-view').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');

    if (previousUid || accountChanged) {
      localStorage.removeItem('farm_player_id');
    }
  }

  renderLoginPlayerCards();
  if (!user) {
    const badge = document.getElementById('room-status-badge');
    if (badge) badge.textContent = '請先使用 Google 帳號登入';
    return;
  }

  if (!state.unsubRoom) {
    connectToRoom(state.roomId, localStorage.getItem('farm_player_id'));
    return;
  }

  const savedPlayerId = localStorage.getItem('farm_player_id');
  if (savedPlayerId && state.players.some(
    p => p.id === savedPlayerId && p.ownerUid === user.uid
  )) {
    enterGameAsPlayer(savedPlayerId);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('pointerdown', () => soundFX.unlock(), { once: true });

  const roomInput = document.getElementById('room-code-input');
  roomInput.value = state.roomId;

  document.getElementById('btn-google-login').addEventListener('click', async () => {
    const button = document.getElementById('btn-google-login');
    button.disabled = true;
    button.textContent = '正在開啟 Google 登入…';
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error(err);
      setAuthFeedback(getGoogleAuthErrorMessage(err));
      showToast(getGoogleAuthErrorMessage(err), 'error');
      button.disabled = false;
      button.textContent = '🔐 使用 Google 帳號登入';
    }
  });

  document.getElementById('btn-google-logout').addEventListener('click', async () => {
    await signOutGoogleAccount();
  });

  document.getElementById('btn-load-room').addEventListener('click', () => {
    connectToRoom(roomInput.value, null);
  });

  document.getElementById('btn-open-create-char').addEventListener('click', openCreateCharModal);
  document.getElementById('btn-close-create-char').addEventListener('click', () => {
    document.getElementById('create-char-modal').classList.add('hidden');
  });
  document.getElementById('btn-submit-create-char').addEventListener('click', handleSubmitCreateChar);
  document.getElementById('btn-close-generic-modal').addEventListener('click', closeGenericModal);
  document.getElementById('btn-close-settings').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('btn-nav-sleep').addEventListener('click', () => {
    if (state.village && getMe()) openSleepModal(state.village, getMe());
  });

  document.getElementById('activity-ticker').addEventListener('click', () => {
    const logs = state.village?.activityLogs || [];
    openGenericModal('📢 全村即時動態與擲骰紀錄', `
      <div class="space-y-2">
        ${logs.map(l => `
          <div class="p-2.5 rounded-xl text-xs leading-relaxed ${l.highlight ? 'bg-amber-50 border border-amber-200 font-bold text-stone-800' : 'bg-stone-50 text-stone-600'}">
            ${escapeHtml(l.text)}
          </div>
        `).join('')}
      </div>
    `);
  });

  onAuthStateChanged(auth, handleAuthStateChange, err => {
    console.error(err);
    const message = getGoogleAuthErrorMessage(err);
    setAuthFeedback(message);
    showToast(message, 'error');
  });

  // 手機鎖屏或切換到其他 App 時自動斷開即時監聽，切回畫面時再恢復連線
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (state.unsubRoom) {
        state.unsubRoom();
        state.unsubRoom = null;
      }
    } else if (document.visibilityState === 'visible' && state.roomId && !state.unsubRoom) {
      connectToRoom(state.roomId, state.playerId);
    }
  });
});