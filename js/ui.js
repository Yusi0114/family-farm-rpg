// 畫面渲染、地點切換、動態跑馬燈、彈窗與按鈕事件綁定
// js/ui.js

import { GAME_CONSTANTS, STATS, CLASSES, TRAITS } from '../data/classes-traits.js';
import { ITEM_CATEGORIES, ITEMS, COOKING_RECIPES, SEASON_TRENDS } from '../data/items-recipes.js';
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

import { AVATAR_OPTIONS, getDefaultAvatarConfig, renderAvatarSVG } from './avatar-svg.js';
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
  allocateFreeStatPoint
} from './game-logic.js';

// ============================================================================
// 一、 全域狀態與工具函式
// ============================================================================

const state = {
  roomId: localStorage.getItem('farm_room_id') || '2027HAPPY',
  playerId: localStorage.getItem('farm_player_id') || null,
  village: null,
  players: [],
  activeTab: 'action',
  warehouseCategory: 'all',
  selectedBait: '',
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

/**
 * 統一包裝所有遊戲動作：處理錯誤提示、觸發 d20 擲骰動畫、顯示升級提示
 */
async function runAction(actionFn, options = {}) {
  try {
    const res = await actionFn();
    if (!res) return;

    if (res.check && !options.skipDice) {
      await showDiceAnimation(res.check, res.message, res.levelUpNotes);
    } else {
      if (res.message) showToast(res.message, 'success');
      if (res.levelUpNotes?.length) {
        res.levelUpNotes.forEach(note => showToast(note, 'success'));
      }
    }
  } catch (err) {
    console.error(err);
    showToast(err.message || '操作發生錯誤', 'error');
  }
}

// ============================================================================
// 二、 登入房間、角色認領與紙娃娃創角器
// ============================================================================

async function connectToRoom(roomIdInput, autoLoginPlayerId = null) {
  const cleanRoom = roomIdInput.trim().toUpperCase();
  if (!cleanRoom) {
    showToast('請輸入家庭房間代碼！', 'error');
    return;
  }

  state.roomId = cleanRoom;
  localStorage.setItem('farm_room_id', cleanRoom);

  const badge = document.getElementById('room-status-badge');
  badge.textContent = '連線至村莊中...';

  if (state.unsubRoom) state.unsubRoom();

  try {
    await initOrGetRoom(cleanRoom);
    state.unsubRoom = subscribeRoom(
      cleanRoom,
      (villageData) => {
        state.village = villageData;
        if (getMe()) renderGameScreen();
      },
      (playersList) => {
        state.players = playersList;
        renderLoginPlayerCards();
        if (autoLoginPlayerId && playersList.some(p => p.id === autoLoginPlayerId)) {
          enterGameAsPlayer(autoLoginPlayerId);
        } else if (getMe()) {
          renderGameScreen();
        }
      }
    );
    badge.textContent = `已連線房間：${cleanRoom}`;
  } catch (err) {
    console.error(err);
    badge.textContent = '連線失敗，請檢查 Firebase 設定';
    showToast('無法連線至 Firebase，請確認 js/firebase-config.js 金鑰已填寫正確', 'error');
  }
}

function renderLoginPlayerCards() {
  const container = document.getElementById('existing-players-list');
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
    return `
      <button data-login-player="${p.id}" class="bg-white active:bg-emerald-50 border border-stone-200 rounded-2xl p-2.5 flex items-center gap-2.5 text-left shadow-xs transition">
        ${renderAvatarSVG(p.avatarConfig, 46)}
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-stone-300'}"></span>
            <span class="font-black text-sm text-stone-800 truncate">${escapeHtml(p.name)}</span>
          </div>
          <div class="text-[11px] text-stone-500 font-medium mt-0.5">${cls?.icon || ''} ${cls?.name || ''} · Lv.${p.level || 1}</div>
        </div>
      </button>
    `;
  }).join('');

  container.querySelectorAll('[data-login-player]').forEach(btn => {
    btn.addEventListener('click', () => enterGameAsPlayer(btn.dataset.loginPlayer));
  });
}

function enterGameAsPlayer(playerId) {
  state.playerId = playerId;
  localStorage.setItem('farm_player_id', playerId);

  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('game-view').classList.remove('hidden');

  updatePlayerPresence(state.roomId, playerId);
  if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
  state.heartbeatTimer = setInterval(() => {
    if (state.roomId && state.playerId) {
      updatePlayerPresence(state.roomId, state.playerId);
    }
  }, 60 * 1000);

  renderGameScreen();
}

// 創角表單暫存狀態
let draftChar = null;

function openCreateCharModal() {
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
    const created = await createPlayer(state.roomId, draftChar);
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
}

function renderTopHud(village, me) {
  const seasonObj = GAME_CONSTANTS.SEASONS.find(s => s.id === village.season) || GAME_CONSTANTS.SEASONS[0];
  const weatherObj = WEATHER_TYPES[village.weather] || WEATHER_TYPES.sunny;
  const timeInfo = formatPersonalTime(me.personalTime);
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
      <div class="font-black ${timeInfo.isLate ? 'text-red-600 animate-pulse' : 'text-stone-700'}">
        ⏰ ${timeInfo.text} ${timeInfo.isLate ? '(晚睡警示)' : ''}
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
        <button id="btn-switch-user" class="text-[10px] text-stone-400 underline ml-1">換人</button>
      </div>
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
  const loc = LOCATIONS[me.location] || LOCATIONS.farm;
  const companions = state.players.filter(
    p => p.id !== me.id && p.location === loc.id && (Date.now() - (p.lastActiveAt || 0) <= ONLINE_TIMEOUT_MS)
  );

  let sceneBodyHtml = '';

  if (loc.id === 'farm') {
    sceneBodyHtml = renderFarmScene(village, me);
  } else if (loc.id === 'ranch') {
    sceneBodyHtml = renderRanchScene(village, me);
  } else if (loc.id === 'town') {
    sceneBodyHtml = renderTownScene(village, me);
  } else if (loc.id === 'beach') {
    sceneBodyHtml = renderBeachScene(village, me);
  } else if (loc.id === 'mountain') {
    sceneBodyHtml = renderMountainScene(village, me);
  }

  container.innerHTML = `
    <!-- 地點情境卡片 -->
    <div class="rounded-3xl p-4 bg-gradient-to-br ${loc.bgGradient} border border-stone-200/80 shadow-xs">
      <div class="flex items-start justify-between gap-2">
        <div>
          <h2 class="text-lg font-black text-stone-800">${loc.icon} ${loc.name}</h2>
          <p class="text-xs text-stone-600 mt-0.5 leading-relaxed">${loc.desc}</p>
        </div>
      </div>
      ${companions.length ? `
        <div class="mt-2.5 pt-2 border-t border-black/5 flex items-center gap-2 text-xs font-bold text-emerald-900">
          <span>👥 同行家人：</span>
          ${companions.map(c => `<span class="inline-flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-full">${renderAvatarSVG(c.avatarConfig, 18)} ${escapeHtml(c.name)}</span>`).join('')}
        </div>
      ` : ''}
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
                <span class="w-9 h-9 rounded-full ${npc.badgeBg} flex items-center justify-center text-xl shrink-0">${npc.icon}</span>
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
    runAction(() => actionFish(state.roomId, me.id, state.selectedBait || null));
  });
  document.getElementById('btn-action-comb')?.addEventListener('click', () => {
    runAction(() => actionForageOrMine(state.roomId, me.id, 'beach_combing'));
  });

  // 深山行動
  container.querySelectorAll('[data-mountain-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      runAction(() => actionForageOrMine(state.roomId, me.id, btn.dataset.mountainAct));
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
  const container = document.getElementById('main-content');
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
                  <span class="font-black text-xs text-stone-800">${npc?.icon} ${qDef.title}</span>
                  <span class="text-[11px] font-black text-emerald-700">💰 +${qDef.reward.money}元</span>
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

function openSeedPickerModal(village, me, plotIndex) {
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
      runAction(() => actionFarmPlot(state.roomId, me.id, plotIndex, btn.dataset.plantSeed), { skipDice: true });
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
    <p class="text-xs text-stone-500">材料自動從隨身背包與共用大箱子扣除，失敗也會做成家常大雜燴不浪費！</p>
    <div class="space-y-2">
      ${COOKING_RECIPES.map(rec => {
        const resItem = ITEMS[rec.resultId];
        const ingText = rec.ingredients.map(i => `${ITEMS[i.itemId]?.name}x${i.count}`).join(' + ');
        const canCook = rec.ingredients.every(i => getTotalItemCount(me, village.warehouse, i.itemId) >= i.count);

        return `
          <div class="p-3 rounded-2xl border ${canCook ? 'bg-orange-50/50 border-orange-300' : 'bg-stone-50 border-stone-200'}">
            <div class="flex items-center justify-between">
              <span class="font-black text-sm text-stone-800">${resItem?.icon} ${resItem?.name}</span>
              <span class="text-[11px] font-bold text-emerald-700">⚡+${resItem?.staminaRestore} · 烹飪Lv.${rec.skillReq}</span>
            </div>
            <div class="text-[11px] text-stone-600 mt-1">材料：${ingText}</div>
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
  const strangeCnt = getTotalItemCount(me, village.warehouse, 'strange_stone');
  const roughCnt = getTotalItemCount(me, village.warehouse, 'rough_ore_gem');

  const html = `
    <div class="space-y-3">
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
          <button data-smelt="copper_bar" class="p-2 rounded-xl bg-white border border-slate-300 text-xs font-bold">🧱 銅錠<br><span class="text-[10px]">Lv.1</span></button>
          <button data-smelt="iron_bar" class="p-2 rounded-xl bg-white border border-slate-300 text-xs font-bold">🔩 鐵錠<br><span class="text-[10px]">Lv.4</span></button>
          <button data-smelt="gold_bar" class="p-2 rounded-xl bg-white border border-slate-300 text-xs font-bold">🥇 金錠<br><span class="text-[10px]">Lv.7</span></button>
        </div>
      </div>
    </div>
  `;
  openGenericModal('⚒️ 鐵匠與珠寶鑑定爐', html);

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
    { id: 'worm_bait', desc: '海帶芽 x1 → 蚯蚓餌 x3 (Lv.1)' },
    { id: 'shrimp_bait', desc: '海帶芽 x1 + 溪哥 x1 → 南極蝦餌 x3 (Lv.4)' },
    { id: 'lure_bait', desc: '銅錠 x1 + 新鮮小管 x1 → 發光路亞餌 x2 (Lv.7)' }
  ];
  openGenericModal('🪱 漁夫手工製作魚餌', `
    <div class="space-y-2">
      ${baits.map(b => `
        <button data-craft-bait="${b.id}" class="w-full p-3 rounded-2xl bg-sky-50 border border-sky-200 active:bg-sky-100 text-left">
          <div class="font-black text-sm text-sky-950">${ITEMS[b.id].icon} ${ITEMS[b.id].name}</div>
          <div class="text-xs text-sky-800 mt-0.5">${b.desc}</div>
        </button>
      `).join('')}
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
      <span class="text-3xl">${npc.icon}</span>
      <div>
        <div class="font-black text-sm text-stone-900">${npc.name} · ${npc.title}</div>
        <p class="text-xs text-stone-700 mt-0.5">${npc.roleDesc}</p>
      </div>
    </div>

    <!-- 聊天按鈕（人氣王每日領小禮物） -->
    <button id="btn-npc-chat" class="w-full py-2.5 rounded-xl bg-amber-500 active:bg-amber-600 text-white font-black text-xs shadow-xs">
      💬 寒暄聊天 ${me.traits?.includes('popular') && !me.dailyNpcChatUsed?.[npcId] ? '（🌻人氣王今日可領小禮物！）' : ''}
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
  document.getElementById('btn-npc-chat').addEventListener('click', () => {
    runAction(() => actionChatNpc(state.roomId, me.id, npcId), { skipDice: true });
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
  const html = `
    <div class="text-center space-y-3">
      <div class="p-4 rounded-3xl bg-gradient-to-br from-red-600 to-amber-600 text-white shadow-md">
        <div class="text-xs font-bold opacity-90">🧧 新春限定・每人每日限刮一張</div>
        <div class="text-xl font-black mt-1">頭獎 5,000 元 ＋ 台灣藍寶！</div>
        <div class="text-xs mt-1">每張花費公款 ${SCRATCH_CARD_COST} 元</div>
      </div>

      <div id="scratch-card-area" class="h-28 rounded-2xl border-2 border-dashed border-amber-400 flex items-center justify-center p-4 ${
        me.scratchUsedToday ? 'bg-stone-100 text-stone-500' : 'scratch-foil text-stone-800 cursor-pointer'
      }">
        <span class="font-black text-base">
          ${me.scratchUsedToday ? '今日已刮過囉，明天請早！' : '👆 點擊這裡用力刮開銀漆！'}
        </span>
      </div>
    </div>
  `;
  openGenericModal('🎟️ 陳阿嬤的過年刮刮樂攤', html);

  if (!me.scratchUsedToday) {
    document.getElementById('scratch-card-area').addEventListener('click', async () => {
      try {
        const res = await actionScratchCard(state.roomId, me.id);
        const area = document.getElementById('scratch-card-area');
        area.classList.remove('scratch-foil', 'cursor-pointer');
        area.classList.add('bg-amber-50');
        area.innerHTML = `
          <div>
            <div class="text-xs font-bold text-red-600">🎲 幸運骰結果：【${res.roll}】</div>
            <div class="font-black text-sm text-stone-800 mt-1">${res.reward.label}</div>
          </div>
        `;
      } catch (err) {
        showToast(err.message, 'error');
      }
    }, { once: true });
  }
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
    await goToSleepAndMaybeAdvanceDay(state.roomId, me.id, state.players, false);
    showToast('已上床休息！', 'info');
  });

  document.getElementById('btn-force-sleep')?.addEventListener('click', async () => {
    closeGenericModal();
    await goToSleepAndMaybeAdvanceDay(state.roomId, me.id, state.players, true);
    showToast('已為全村關燈並結算進入新的一天！', 'success');
  });
}

// ============================================================================
// 九、 D&D d20 擲骰動畫演出與頁面初始化
// ============================================================================

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

    let ticks = 0;
    const interval = setInterval(() => {
      diceNum.textContent = Math.floor(Math.random() * 20) + 1;
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

      if (check.isCritSuccess) {
        badgeEl.className = 'inline-block px-3 py-1 rounded-full text-xs font-black mt-2 bg-amber-400 text-stone-900';
        badgeEl.textContent = '🌟 大成功（Natural 20）！';
      } else if (check.isCritFail) {
        badgeEl.className = 'inline-block px-3 py-1 rounded-full text-xs font-black mt-2 bg-red-600 text-white';
        badgeEl.textContent = '💥 大失敗（Natural 1）！';
      } else if (check.isSuccess) {
        badgeEl.className = 'inline-block px-3 py-1 rounded-full text-xs font-black mt-2 bg-emerald-600 text-white';
        badgeEl.textContent = '✅ 檢定成功！';
      } else {
        badgeEl.className = 'inline-block px-3 py-1 rounded-full text-xs font-black mt-2 bg-stone-500 text-white';
        badgeEl.textContent = '😅 差了一點（未達難度）';
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

function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const active = btn.dataset.tab === tabName;
    btn.className = active
      ? 'nav-btn flex flex-col items-center justify-center py-1 rounded-xl text-emerald-700 bg-emerald-50 font-bold'
      : 'nav-btn flex flex-col items-center justify-center py-1 rounded-xl text-stone-500';
  });
  renderGameScreen();
}

// ============================================================================
// 十、 啟動綁定
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const roomInput = document.getElementById('room-code-input');
  roomInput.value = state.roomId;

  document.getElementById('btn-load-room').addEventListener('click', () => {
    connectToRoom(roomInput.value, null);
  });

  document.getElementById('btn-open-create-char').addEventListener('click', openCreateCharModal);
  document.getElementById('btn-close-create-char').addEventListener('click', () => {
    document.getElementById('create-char-modal').classList.add('hidden');
  });
  document.getElementById('btn-submit-create-char').addEventListener('click', handleSubmitCreateChar);
  document.getElementById('btn-close-generic-modal').addEventListener('click', closeGenericModal);

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

  // 自動連線上次進入的家庭房間
  if (state.roomId) {
    connectToRoom(state.roomId, state.playerId);
  }
});