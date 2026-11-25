// js/world-map.js

import { ITEMS } from '../data/items-recipes.js';
import { ANIMAL_TYPES } from '../data/skills-actions.js';
import { NPCS } from '../data/npcs-quests.js';
import { renderAvatarSVG, renderNpcAvatarSVG, renderChibiPlayerSVG, renderChibiNpcSVG } from './avatar-svg.js';
import { updatePlayerPresence } from './db.js';
import { soundFX } from './sound-fx.js';

const MAP_W = 960;
const MAP_H = 720;
const PLAYER_RADIUS = 15;
const ONLINE_TIMEOUT_MS = 10 * 60 * 1000;
const REMOTE_MOVE_SPEED = 180;
const REMOTE_ACTION_MAX_DELAY_MS = 5000;
const REMOTE_ACTION_ARRIVAL_RADIUS = 8;
const FARM_BED_POSITION = { x: 210, y: 215 };

export function toDayTimelineMinutes(rawMins) {
  const mins = Number(rawMins);
  if (!Number.isFinite(mins)) return 360;
  if (mins >= 1440) return mins; // Preserve already-linearized late-night times.
  if (mins >= 0 && mins < 360) return mins + 1440;
  return Math.max(360, mins);
}

/**
 * 依據單日時間軸連續插值計算天空光影。
 */
export function getSkyLightingForMinutes(rawMins) {
  const m = toDayTimelineMinutes(rawMins);
  const stops = [
    [360, 251, 146, 60, 0.26],
    [480, 254, 240, 138, 0.08],
    [720, 255, 255, 255, 0.00],
    [930, 245, 158, 11, 0.18],
    [1035, 234, 88, 12, 0.38],
    [1100, 109, 40, 217, 0.44],
    [1170, 15, 23, 58, 0.54],
    [1440, 10, 16, 44, 0.60],
    [1560, 8, 12, 36, 0.65]
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    const [m0, r0, g0, b0, a0] = stops[i];
    const [m1, r1, g1, b1, a1] = stops[i + 1];
    if (m >= m0 && m <= m1) {
      const t = (m - m0) / (m1 - m0 || 1);
      const r = Math.round(r0 + (r1 - r0) * t);
      const g = Math.round(g0 + (g1 - g0) * t);
      const b = Math.round(b0 + (b1 - b0) * t);
      const a = +(a0 + (a1 - a0) * t).toFixed(3);
      return { r, g, b, a, rgba: `rgba(${r}, ${g}, ${b}, ${a})` };
    }
  }
  return { r: 8, g: 12, b: 36, a: 0.65, rgba: 'rgba(8, 12, 36, 0.65)' };
}

const svgImageCache = new Map();
function getCachedAvatarImage(cacheKey, svgMarkup) {
  if (svgImageCache.has(cacheKey)) {
    return svgImageCache.get(cacheKey);
  }
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup);
  svgImageCache.set(cacheKey, img);
  return img;
}

const mapBgCache = new Map();
function getMapBgImage(mapId) {
  if (mapBgCache.has(mapId)) {
    return mapBgCache.get(mapId);
  }
  const candidates = [
    `./assets/map_${mapId}.jpg`,
    `./assets/map_${mapId}.jpeg`,
    `./assets/map_${mapId}.png`,
    `./assets/map_${mapId}.webp`
  ];
  let idx = 0;
  const img = new Image();
  img.dataset.failedAll = '0';
  img.src = candidates[idx];
  img.onerror = () => {
    idx++;
    if (idx < candidates.length) {
      img.src = candidates[idx];
    } else {
      img.dataset.failedAll = '1';
    }
  };
  mapBgCache.set(mapId, img);
  return img;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = typeof r === 'number'
    ? { tl: r, tr: r, br: r, bl: r }
    : { tl: 0, tr: 0, br: 0, bl: 0, ...r };
  ctx.beginPath();
  ctx.moveTo(x + rad.tl, y);
  ctx.lineTo(x + w - rad.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad.tr);
  ctx.lineTo(x + w, y + h - rad.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad.br, y + h);
  ctx.lineTo(x + rad.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad.bl);
  ctx.lineTo(x, y + rad.tl);
  ctx.quadraticCurveTo(x, y, x + rad.tl, y);
  ctx.closePath();
}

function resolveCircleAABB(circle, box) {
  const closestX = Math.max(box.x, Math.min(circle.x, box.x + box.w));
  const closestY = Math.max(box.y, Math.min(circle.y, box.y + box.h));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= circle.r * circle.r) return false;

  const dist = Math.sqrt(distSq);
  if (dist > 0.0001) {
    const overlap = circle.r - dist;
    circle.x += (dx / dist) * overlap;
    circle.y += (dy / dist) * overlap;
  } else {
    const leftPen = Math.abs(circle.x - box.x);
    const rightPen = Math.abs(box.x + box.w - circle.x);
    const topPen = Math.abs(circle.y - box.y);
    const bottomPen = Math.abs(box.y + box.h - circle.y);
    const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
    if (minPen === leftPen) circle.x = box.x - circle.r;
    else if (minPen === rightPen) circle.x = box.x + box.w + circle.r;
    else if (minPen === topPen) circle.y = box.y - circle.r;
    else circle.y = box.y + box.h + circle.r;
  }
  return true;
}

const TOOL_TIER_STYLES = {
  wood: { name: '木製', head: '#a16207', edge: '#fde68a', shaft: '#78350f', glow: null },
  stone: { name: '石製', head: '#78716c', edge: '#e7e5e4', shaft: '#78350f', glow: null },
  copper: { name: '紅銅', head: '#ea580c', edge: '#fed7aa', shaft: '#78350f', glow: 'rgba(251, 146, 60, 0.35)' },
  iron: { name: '精鐵', head: '#64748b', edge: '#f1f5f9', shaft: '#5c3317', glow: 'rgba(226, 232, 240, 0.4)' },
  gold: { name: '黃金', head: '#eab308', edge: '#fef9c3', shaft: '#5c3317', glow: 'rgba(250, 204, 21, 0.45)' },
  gem: { name: '藍寶', head: '#0284c7', edge: '#bae6fd', shaft: '#3b1e0b', glow: 'rgba(56, 189, 248, 0.55)' }
};

const TOOL_CATEGORY_NAMES = {
  watering_can: '澆水器',
  pickaxe: '十字鎬',
  axe: '伐木斧',
  hoe: '開墾鋤',
  fishing_rod: '釣魚竿',
  trowel: '趕海鏟',
  harvest: '採集籃',
  brush: '軟毛刷'
};

function detectPlayerToolTier(player, category) {
  if (!player) return 'wood';
  const tierOrder = ['wood', 'stone', 'copper', 'iron', 'gold', 'gem'];
  let bestIdx = 0;

  const checkToken = (value) => {
    if (!value) return;
    const text = String(value).toLowerCase();
    if (/gem|sapphire|crystal|mithril|star|藍寶|水晶|星輝/.test(text)) bestIdx = Math.max(bestIdx, 5);
    else if (/gold|golden|黃金|純金/.test(text)) bestIdx = Math.max(bestIdx, 4);
    else if (/iron|steel|精鐵|鋼/.test(text)) bestIdx = Math.max(bestIdx, 3);
    else if (/copper|bronze|紅銅|青銅/.test(text)) bestIdx = Math.max(bestIdx, 2);
    else if (/stone|石製|石鎬|石斧|石鋤|石墜|石/.test(text)) bestIdx = Math.max(bestIdx, 1);
  };

  checkToken(player.tools?.[category]);
  checkToken(player.equipment?.[category]);
  if (typeof player.tools?.[category] === 'number') {
    bestIdx = Math.max(bestIdx, Math.min(5, player.tools[category]));
  }

  const keywordMap = {
    watering_can: /water|can|澆水/,
    pickaxe: /pickaxe|pick|鎬/,
    axe: /(^|_)axe|hatchet|斧/,
    hoe: /hoe|鋤/,
    fishing_rod: /rod|釣竿/,
    trowel: /shovel|trowel|鏟/,
    brush: /brush|刷/
  };
  const keyword = keywordMap[category];
  if (keyword && player.inventory) {
    const entries = Array.isArray(player.inventory)
      ? player.inventory.map(item => [item.itemId || item.id, item.count || 0])
      : Object.entries(player.inventory);
    for (const [id, count] of entries) {
      if (Number(count) > 0 && keyword.test(String(id).toLowerCase())) {
        checkToken(id);
      }
    }
  }

  return tierOrder[bestIdx] || 'wood';
}

export const SUB_MAPS = {
  farm: {
    id: 'farm',
    name: '農場農田',
    icon: '🌾',
    outerColor: '#4f7f3e',
    spawnX: 330,
    spawnY: 310,
    exits: [
      { id: 'to_town', x: 885, y: 265, w: 75, h: 95, arrow: '➡️', label: '往村莊廣場', targetMap: 'town', spawnX: 85, spawnY: 375 },
      { id: 'to_ranch', x: 425, y: 660, w: 135, h: 60, arrow: '⬇️', label: '往牧場畜舍', targetMap: 'ranch', spawnX: 500, spawnY: 85 }
    ],
    houses: [
      { id: 'family_house', name: '🏡 家族農舍', x: 95, y: 55, w: 245, h: 155 }
    ],
    wallBoxes: [
      { x: 0, y: 0, w: 960, h: 65 },
      { x: 0, y: 0, w: 75, h: 720 },
      { x: 890, y: 0, w: 70, h: 260 },
      { x: 890, y: 365, w: 70, h: 355 },
      { x: 0, y: 655, w: 420, h: 65 },
      { x: 565, y: 655, w: 395, h: 65 },
      { x: 205, y: 240, w: 68, h: 60 }
    ]
  },

  ranch: {
    id: 'ranch',
    name: '牧場畜舍',
    icon: '🐄',
    outerColor: '#548540',
    spawnX: 500,
    spawnY: 165,
    exits: [
      { id: 'to_farm', x: 435, y: 0, w: 135, h: 60, arrow: '⬆️', label: '回農場農田', targetMap: 'farm', spawnX: 490, spawnY: 620 },
      { id: 'to_town', x: 895, y: 365, w: 65, h: 115, arrow: '➡️', label: '往村莊廣場', targetMap: 'town', spawnX: 85, spawnY: 420 }
    ],
    houses: [
      { id: 'red_barn', name: '🐄 紅頂大穀倉', x: 80, y: 70, w: 270, h: 195 }
    ],
    wallBoxes: [
      { x: 0, y: 0, w: 430, h: 65 },
      { x: 575, y: 0, w: 385, h: 65 },
      { x: 0, y: 0, w: 75, h: 720 },
      { x: 890, y: 0, w: 70, h: 360 },
      { x: 890, y: 485, w: 70, h: 235 },
      { x: 0, y: 655, w: 960, h: 65 }
    ]
  },

  town: {
    id: 'town',
    name: '山海小鎮廣場',
    icon: '🏘️',
    outerColor: '#4f7f3e',
    spawnX: 480,
    spawnY: 365,
    exits: [
      { id: 'to_farm', x: 0, y: 315, w: 60, h: 115, arrow: '⬅️', label: '往農場／牧場', targetMap: 'farm', spawnX: 845, spawnY: 312 },
      { id: 'to_mountain', x: 295, y: 0, w: 115, h: 60, arrow: '⬆️', label: '往深山礦坑', targetMap: 'mountain', spawnX: 485, spawnY: 620 },
      { id: 'to_beach', x: 435, y: 660, w: 125, h: 60, arrow: '⬇️', label: '往海邊漁港', targetMap: 'beach', spawnX: 435, spawnY: 85 }
    ],
    houses: [
      { id: 'house_grandma', name: '🍲 陳阿嬤的家', x: 90, y: 100, w: 225, h: 165 },
      { id: 'house_mayor', name: '🏛️ 王村長宅邸', x: 390, y: 45, w: 235, h: 180 },
      { id: 'house_lin', name: '💎 林老闆珍寶閣', x: 620, y: 130, w: 225, h: 165 },
      { id: 'house_fang', name: '🏥 小芳姊診所', x: 135, y: 435, w: 215, h: 170 },
      { id: 'house_smithy', name: '⚒️ 大宇打鐵鋪', x: 660, y: 440, w: 215, h: 175 }
    ],
    wallBoxes: [
      { x: 0, y: 0, w: 290, h: 65 },
      { x: 415, y: 0, w: 545, h: 65 },
      { x: 0, y: 0, w: 65, h: 310 },
      { x: 0, y: 435, w: 65, h: 285 },
      { x: 885, y: 0, w: 75, h: 720 },
      { x: 0, y: 655, w: 430, h: 65 },
      { x: 565, y: 655, w: 395, h: 65 }
    ]
  },

  beach: {
    id: 'beach',
    name: '海邊漁港',
    icon: '🎣',
    outerColor: '#437949',
    spawnX: 435,
    spawnY: 130,
    exits: [
      { id: 'to_town', x: 370, y: 0, w: 125, h: 60, arrow: '⬆️', label: '回村莊廣場', targetMap: 'town', spawnX: 495, spawnY: 620 }
    ],
    houses: [
      { id: 'house_hai', name: '⚓ 海伯船長屋', x: 95, y: 75, w: 270, h: 190 }
    ],
    wallBoxes: [
      { x: 0, y: 0, w: 365, h: 65 },
      { x: 500, y: 0, w: 460, h: 65 },
      { x: 0, y: 0, w: 75, h: 720 },
      { x: 0, y: 660, w: 960, h: 60 },
      { x: 645, y: 0, w: 315, h: 315 },
      { x: 620, y: 445, w: 340, h: 275 },
      { x: 865, y: 315, w: 95, h: 130 }
    ]
  },

  mountain: {
    id: 'mountain',
    name: '深山林地與礦坑',
    icon: '⛰️',
    outerColor: '#37673c',
    spawnX: 485,
    spawnY: 600,
    exits: [
      { id: 'to_town', x: 420, y: 660, w: 135, h: 60, arrow: '⬇️', label: '回村莊廣場', targetMap: 'town', spawnX: 355, spawnY: 85 }
    ],
    houses: [
      { id: 'mine_cave', name: '⛏️ 深山古礦坑', x: 575, y: 55, w: 295, h: 215 }
    ],
    wallBoxes: [
      { x: 0, y: 0, w: 960, h: 70 },
      { x: 0, y: 0, w: 80, h: 720 },
      { x: 880, y: 0, w: 80, h: 720 },
      { x: 0, y: 655, w: 415, h: 65 },
      { x: 560, y: 655, w: 400, h: 65 },
      { x: 80, y: 70, w: 240, h: 175 }
    ]
  }
};

class WorldMapController {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.rafId = null;
    this.lastFrameTime = 0;

    this.roomId = null;
    this.village = null;
    this.players = [];
    this.meId = null;
    this.settings = {
      controlMode: 'dual',
      joystickSide: 'left',
      moveSpeed: 'normal'
    };
    this.callbacks = {};

    this.currentMapId = 'town';
    this.localPos = { x: 480, y: 365, initialized: false };
    this.remotePositions = new Map();
    this.remoteLocations = new Map();
    this.remoteActionAnimations = new Map();
    this.walkTarget = null;
    this.walkPhase = 0;

    // 動態粒子與特效系統（揚塵、沙灘腳印、煙囪白煙、海鷗、角色頭頂飄字）
    this.dustTimer = 0;
    this.dustParticles = [];
    this.footprintTimer = 0;
    this.footprintStep = 0;
    this.footprints = [];
    this.smokeTimer = 0;
    this.smokeParticles = [];
    this.floatingTexts = [];
    this.seagulls = [
      { x: 640, y: 150, vx: 38, vy: 8, phase: 0 },
      { x: 810, y: 260, vx: -34, vy: 11, phase: 2.1 },
      { x: 720, y: 490, vx: 32, vy: -9, phase: 4.3 }
    ];

    this.mapFadeAlpha = 0;
    this.mapBannerText = '';
    this.mapBannerTimer = 0;
    this.previewMinutes = null;
    this.activeActionAnim = null;
    this.passOutAnimation = null;

    this.joyVec = { x: 0, y: 0 };
    this.joyActive = false;
    this.joyPointerId = null;

    this.lastSyncTime = 0;
    this.dirtySync = false;
    this.positionSyncErrorShown = false;
    this.actionSyncErrorShown = false;
    this.lastSyncedPos = { x: 0, y: 0 };
    this.pendingSyncTimer = null;

    this.nearestInteractable = null;
    this.interactables = [];
    this.colliders = [];
  }

  /**
   * 在角色頭頂產生即時飄字（如 +150 元、💧 水分充足、❤️ 好感UP）
   */
  spawnFloatingText(text, color = '#fef08a') {
    if (!text) return;
    const stackOffset = this.floatingTexts.length * 22;
    this.floatingTexts.push({
      text: String(text).slice(0, 64),
      color,
      x: this.localPos.x + (Math.random() - 0.5) * 14,
      y: this.localPos.y - 68 - stackOffset,
      vy: -36,
      alpha: 1.25
    });
  }

  playActionAnimation(opts = {}) {
    return new Promise((resolve) => {
      if (!this.canvas) {
        resolve();
        return;
      }

      const category = opts.toolCategory || 'harvest';
      const tier = opts.tier || detectPlayerToolTier(opts.player, category);
      const tierInfo = TOOL_TIER_STYLES[tier] || TOOL_TIER_STYLES.wood;
      const toolTitle = `${tierInfo.name}${TOOL_CATEGORY_NAMES[category] || '工具'}`;
      const durationMs = Number.isFinite(opts.duration) && opts.duration > 0 ? opts.duration : 1150;
      const startedAt = Date.now();
      const posX = Math.round(this.localPos.x);
      const posY = Math.round(this.localPos.y);
      const actionAnimation = {
        category,
        location: this.currentMapId,
        startedAt,
        expiresAt: startedAt + durationMs,
        posX,
        posY
      };

      this.walkTarget = null;
      this.joyActive = false;
      this.joyPointerId = null;
      this.joyVec = { x: 0, y: 0 };
      const joyKnob = document.getElementById('virtual-joy-knob');
      if (joyKnob) joyKnob.style.transform = 'translate(0px, 0px)';
      this.activeActionAnim = {
        x: typeof opts.x === 'number' ? opts.x : this.localPos.x,
        y: typeof opts.y === 'number' ? opts.y : this.localPos.y,
        category,
        tier,
        tierInfo,
        toolTitle,
        label: opts.label || toolTitle,
        elapsed: 0,
        duration: durationMs / 1000,
        particles: [],
        particleTimer: 0,
        lastSoundTick: -1,
        resolve
      };
      this.syncActionPresence(actionAnimation);
    });
  }

  syncActionPresence(actionAnimation) {
    if (!this.roomId || !this.meId) return;
    if (this.pendingSyncTimer) {
      clearTimeout(this.pendingSyncTimer);
      this.pendingSyncTimer = null;
    }
    this.lastSyncTime = performance.now();
    this.lastSyncedPos = { x: actionAnimation.posX, y: actionAnimation.posY };
    this.dirtySync = false;
    updatePlayerPresence(this.roomId, this.meId, {
      actionAnimation,
      posX: actionAnimation.posX,
      posY: actionAnimation.posY,
      location: actionAnimation.location
    }).then(() => {
      this.actionSyncErrorShown = false;
    }).catch(err => {
      console.error(err);
      if (!this.actionSyncErrorShown) {
        this.actionSyncErrorShown = true;
        this.callbacks.onActionSyncError?.();
      }
    });
  }

  setPreviewMinutes(mins) {
    this.previewMinutes = typeof mins === 'number' ? mins : null;
  }

  /**
   * 取得目前畫面顯示的分鐘數，包含歇息動畫中的預覽時間。
   */
  getDisplayMinutes() {
    if (typeof this.previewMinutes === 'number') {
      return toDayTimelineMinutes(this.previewMinutes);
    }
    const me = this.players.find(p => p.id === this.meId);
    const raw = typeof me?.effectiveTime === 'number' ? me.effectiveTime : (me?.personalTime ?? 360);
    return toDayTimelineMinutes(raw);
  }

  /**
   * 判斷居民是否已過 18:00 回家休息。
   */
  isNpcOffWork(mins = this.getDisplayMinutes()) {
    return toDayTimelineMinutes(mins) >= 1080;
  }

  mount(containerEl, context) {
    this.unmount();

    if (this.meId && this.meId !== context.me.id) {
      this.localPos.initialized = false;
    }
    this.roomId = context.roomId;
    this.village = context.village;
    this.players = context.players;
    this.meId = context.me.id;
    this.settings = context.settings;
    this.callbacks = context.callbacks;

    const me = context.me;
    if (!this.localPos.initialized) {
      const startMapId = SUB_MAPS[me.location] ? me.location : 'town';
      const mapDef = SUB_MAPS[startMapId];
      this.currentMapId = startMapId;

      if (typeof me.posX === 'number' && typeof me.posY === 'number' && me.posX <= MAP_W && me.posY <= MAP_H) {
        this.localPos.x = me.posX;
        this.localPos.y = me.posY;
      } else {
        this.localPos.x = mapDef.spawnX;
        this.localPos.y = mapDef.spawnY;
      }
      this.lastSyncedPos = { x: Math.round(this.localPos.x), y: Math.round(this.localPos.y) };
      this.localPos.initialized = true;
    }

    getMapBgImage(this.currentMapId);

    const showJoystick = this.settings.controlMode === 'dual' || this.settings.controlMode === 'joystick';
    const isRightJoy = this.settings.joystickSide === 'right';

    containerEl.innerHTML = `
      <div id="world-map-wrapper" class="relative w-full h-full rounded-3xl overflow-hidden border-2 border-amber-800/40 shadow-inner bg-emerald-800 select-none" style="touch-action: none;">
        <canvas id="village-canvas" class="w-full h-full block"></canvas>

        <!-- 頂部目前區域與在線家人分布列 -->
        <div id="map-region-pills" aria-label="目前區域與在線家人分布" class="absolute top-2 left-2 right-2 flex gap-1 overflow-x-auto no-scrollbar pointer-events-auto"></div>

        <!-- 漁港專屬：魚餌快速切換條 -->
        <div id="map-bait-bar" class="hidden absolute top-11 left-2 bg-sky-950/85 text-white px-2.5 py-1.5 rounded-2xl text-[11px] flex items-center gap-1.5 backdrop-blur-xs border border-sky-400/40">
          <span class="font-bold">🪱 魚餌：</span>
          <select id="map-bait-select" class="bg-sky-800 text-white font-bold rounded-lg px-1.5 py-0.5 border border-sky-500 text-[11px]">
            <option value="">不用餌</option>
            <option value="worm_bait">蚯蚓餌</option>
            <option value="shrimp_bait">南極蝦餌</option>
            <option value="lure_bait">發光路亞餌</option>
          </select>
        </div>

        <!-- 虛擬搖桿 -->
        ${showJoystick ? `
          <div id="virtual-joy-zone" class="absolute bottom-3 ${isRightJoy ? 'right-3' : 'left-3'} w-28 h-28 rounded-full bg-black/25 border-2 border-white/65 backdrop-blur-2xs flex items-center justify-center">
            <div id="virtual-joy-knob" class="w-11 h-11 rounded-full bg-amber-50/95 shadow-md border-2 border-emerald-600 pointer-events-none transition-transform duration-75"></div>
          </div>
        ` : ''}

        <!-- 情境互動主按鈕 -->
        <button id="map-interact-btn" class="absolute bottom-4 ${isRightJoy && showJoystick ? 'left-3' : 'right-3'} max-w-[215px] px-4 py-3 rounded-2xl font-black text-xs shadow-lg border-2 transition-all flex items-center gap-2 bg-stone-800/75 text-stone-300 border-stone-500">
          <span id="map-interact-icon" class="text-lg">👣</span>
          <span id="map-interact-label" class="truncate">探索小鎮中...</span>
        </button>
      </div>
    `;

    this.canvas = document.getElementById('village-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', this.handleResize);

    this.renderRegionPills();
    this.rebuildMapEntities();
    this.bindInputEvents();

    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }

  updateData(village, players, settings, me) {
    if (me && me.id !== this.meId) {
      this.meId = me.id;
      const startMapId = SUB_MAPS[me.location] ? me.location : 'town';
      const mapDef = SUB_MAPS[startMapId];
      this.currentMapId = startMapId;

      if (typeof me.posX === 'number' && typeof me.posY === 'number' && me.posX <= MAP_W && me.posY <= MAP_H) {
        this.localPos.x = me.posX;
        this.localPos.y = me.posY;
      } else {
        this.localPos.x = mapDef.spawnX;
        this.localPos.y = mapDef.spawnY;
      }

      this.localPos.initialized = true;
      this.lastSyncedPos = { x: Math.round(this.localPos.x), y: Math.round(this.localPos.y) };
      this.walkTarget = null;
      this.joyVec = { x: 0, y: 0 };
      this.joyActive = false;
      this.joyPointerId = null;
    }

    this.village = village;
    this.players = players;
    if (settings) this.settings = settings;
    const localPlayer = this.players.find(player => player.id === this.meId);
    if (!this.passOutAnimation && (localPlayer?.readyToSleep || localPlayer?.isSleeping)) {
      this.currentMapId = 'farm';
      this.localPos.x = FARM_BED_POSITION.x;
      this.localPos.y = FARM_BED_POSITION.y;
      this.walkTarget = null;
      this.joyActive = false;
      this.joyVec = { x: 0, y: 0 };
    }
    this.renderRegionPills();
    this.rebuildMapEntities();
  }

  unmount() {
    if (this.activeActionAnim) {
      const activeAction = this.activeActionAnim;
      this.activeActionAnim = null;
      activeAction.resolve?.();
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.pendingSyncTimer) {
      clearTimeout(this.pendingSyncTimer);
      this.pendingSyncTimer = null;
    }
    window.removeEventListener('resize', this.handleResize);
    this.canvas = null;
    this.ctx = null;
  }

  handleResize = () => {
    this.resizeCanvas();
  };

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = rect.width;
    this.viewH = rect.height;
  }

  renderRegionPills() {
    const bar = document.getElementById('map-region-pills');
    if (!bar) return;

    bar.innerHTML = Object.values(SUB_MAPS).map(m => {
      const isCurrent = m.id === this.currentMapId;
      const count = this.players.filter(p => {
        const isOnline = p.id === this.meId || (Date.now() - (p.lastActiveAt || 0) <= ONLINE_TIMEOUT_MS);
        const loc = p.id === this.meId ? this.currentMapId : (p.location || 'town');
        return isOnline && loc === m.id;
      }).length;

      return `
        <span aria-current="${isCurrent ? 'location' : 'false'}" class="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-black shadow-xs border backdrop-blur-xs ${
          isCurrent
            ? 'bg-emerald-700 text-white border-amber-300'
            : 'bg-amber-50/95 text-stone-800 border-amber-300'
        }">
          ${m.icon} ${m.name} (${count})
        </span>
      `;
    }).join('');
  }

  isAtSleepSpot() {
    return this.currentMapId === 'farm' &&
      Math.hypot(this.localPos.x - FARM_BED_POSITION.x, this.localPos.y - FARM_BED_POSITION.y) <= 64;
  }

  isLocalSleepLocked() {
    const me = this.players.find(player => player.id === this.meId);
    return Boolean(this.passOutAnimation || me?.readyToSleep || me?.isSleeping);
  }

  beginPassOutAnimation(duration = 2600) {
    const startedAt = Date.now();
    const animation = {
      location: this.currentMapId,
      posX: Math.round(this.localPos.x),
      posY: Math.round(this.localPos.y),
      startedAt,
      expiresAt: startedAt + duration
    };
    let resolve;
    const completed = new Promise(done => { resolve = done; });
    this.passOutAnimation = { ...animation, duration, resolve };
    this.walkTarget = null;
    this.joyActive = false;
    this.joyPointerId = null;
    this.joyVec = { x: 0, y: 0 };
    return { ...animation, duration, completed };
  }

  finishPassOutAnimation() {
    const animation = this.passOutAnimation;
    this.passOutAnimation = null;
    const me = this.players.find(player => player.id === this.meId);
    const isSleeping = Boolean(me?.readyToSleep || me?.isSleeping);
    const x = isSleeping ? FARM_BED_POSITION.x : 265;
    const y = isSleeping ? FARM_BED_POSITION.y : 225;
    this.currentMapId = 'farm';
    this.localPos.x = x;
    this.localPos.y = y;
    this.walkTarget = null;
    this.dustParticles = [];
    this.footprints = [];
    if (me) {
      me.location = 'farm';
      me.posX = x;
      me.posY = y;
    }
    this.mapFadeAlpha = 0.85;
    this.mapBannerText = '🌾 農場農田';
    this.mapBannerTimer = 2.2;
    this.renderRegionPills();
    this.rebuildMapEntities();
    animation?.resolve?.();
  }

  cancelPassOutAnimation() {
    const animation = this.passOutAnimation;
    this.passOutAnimation = null;
    animation?.resolve?.();
  }

  prepareForSleep() {
    this.currentMapId = 'farm';
    this.localPos.x = FARM_BED_POSITION.x;
    this.localPos.y = FARM_BED_POSITION.y;
    this.walkTarget = null;
    this.joyActive = false;
    this.joyPointerId = null;
    this.joyVec = { x: 0, y: 0 };
    this.rebuildMapEntities();
    return { location: 'farm', posX: FARM_BED_POSITION.x, posY: FARM_BED_POSITION.y };
  }

  setLocalSleepWaiting(ready) {
    const me = this.players.find(player => player.id === this.meId);
    if (me) {
      me.readyToSleep = ready;
      me.isSleeping = ready;
      if (ready) {
        me.location = 'farm';
        me.posX = FARM_BED_POSITION.x;
        me.posY = FARM_BED_POSITION.y;
      }
    }
  }

  teleportLocalPlayer(targetMapId, x, y) {
    if (!SUB_MAPS[targetMapId]) return;
    const me = this.players.find(player => player.id === this.meId);
    if (me) {
      me.location = targetMapId;
      me.posX = x;
      me.posY = y;
      me.readyToSleep = false;
      me.isSleeping = false;
    }
    this.switchToMap(targetMapId, x, y);
  }

  switchToMap(targetMapId, spawnX, spawnY) {
    const mapDef = SUB_MAPS[targetMapId];
    if (!mapDef || this.isLocalSleepLocked()) return;

    this.currentMapId = targetMapId;
    this.localPos.x = spawnX ?? mapDef.spawnX;
    this.localPos.y = spawnY ?? mapDef.spawnY;
    this.walkTarget = null;
    this.dustParticles = [];
    this.footprints = [];
    this.smokeParticles = [];
    this.mapFadeAlpha = 0.85;
    this.mapBannerText = `${mapDef.icon} ${mapDef.name}`;
    this.mapBannerTimer = 2.2;

    this.renderRegionPills();
    this.rebuildMapEntities();
    this.syncPositionNow(true);
  }

  rebuildMapEntities() {
    if (!this.village) return;
    const mapDef = SUB_MAPS[this.currentMapId] || SUB_MAPS.town;
    const boxes = [...(mapDef.wallBoxes || [])];
    const items = [];

    for (const h of mapDef.houses || []) {
      boxes.push({ x: h.x, y: h.y, w: h.w, h: h.h });
    }

    if (this.currentMapId === 'farm') {
      items.push({
        id: 'family_bed',
        type: 'sleep',
        x: FARM_BED_POSITION.x,
        y: FARM_BED_POSITION.y,
        radius: 64,
        icon: '🛏️',
        label: '😴 上床睡覺'
      });
      items.push({
        id: 'farm_house_door',
        type: 'quests',
        x: 265,
        y: 225,
        radius: 52,
        icon: '🏡',
        label: '農舍布告與村莊委託'
      });
      items.push({
        id: 'farm_rest',
        type: 'rest_bench',
        x: 225,
        y: 325,
        radius: 48,
        icon: '🪑',
        label: '井邊長椅歇息'
      });

      const plots = this.village.farmPlots || [];
      plots.forEach((plot, idx) => {
        const col = idx % 4;
        const row = Math.floor(idx / 4);
        const px = 395 + col * 82;
        const py = 240 + row * 82;

        let label = `開墾 #${idx + 1} 荒地`;
        let icon = '⛏️';
        if (plot.cleared && !plot.cropId) {
          label = `播種 #${idx + 1} 空田`;
          icon = '🌱';
        } else if (plot.cropId) {
          const crop = ITEMS[plot.cropId];
          const seed = Object.values(ITEMS).find(i => i.cropId === plot.cropId);
          const ready = plot.daysGrown >= (seed?.growDays || 2);
          label = ready ? `採收 ${crop?.name}` : `澆水 ${crop?.name}`;
          icon = ready ? '✨' : '💧';
        }

        items.push({
          id: `plot_${idx}`,
          type: 'farm_plot',
          plotIndex: idx,
          x: px,
          y: py,
          radius: 48,
          icon,
          label
        });
      });
    } else if (this.currentMapId === 'ranch') {
      items.push({
        id: 'ranch_adopt',
        type: 'adopt_animal',
        x: 235,
        y: 280,
        radius: 58,
        icon: '🐣',
        label: '穀倉櫃台領養動物'
      });

      const livestock = this.village.livestock || [];
      livestock.forEach((ani, idx) => {
        const ax = 335 + (idx % 3) * 115;
        const ay = 365 + Math.floor(idx / 3) * 95;
        const def = ANIMAL_TYPES[ani.type];
        items.push({
          id: `ani_${ani.id}`,
          type: 'ranch_animal',
          animalId: ani.id,
          x: ax,
          y: ay,
          radius: 54,
          icon: def?.icon || '🐔',
          label: ani.productReady ? `收穫 ${ani.nickname}` : `照顧 ${ani.nickname}`
        });
      });
    } else if (this.currentMapId === 'town') {
      items.push(
        { id: 'town_kitchen', type: 'kitchen', x: 205, y: 280, radius: 54, icon: '🍲', label: '陳阿嬤大廚房' },
        { id: 'town_board', type: 'quests', x: 565, y: 245, radius: 54, icon: '📜', label: '村長委託布告欄' },
        { id: 'town_smithy', type: 'smithy', x: 675, y: 545, radius: 56, icon: '⚒️', label: '大宇打鐵鋪' },
        { id: 'town_scratch', type: 'scratch', x: 435, y: 465, radius: 54, icon: '🎟️', label: '過年刮刮樂攤' },
        {id: 'town_rest',type: 'rest_bench',x: 615,y: 455,radius: 52,icon: '🪑',label: '廣場長椅歇息'},
      );

      const townNpcs = {
        grandma_chen: { x: 295, y: 310 },
        mayor_wang: { x: 475, y: 255 },
        boss_lin: { x: 735, y: 315 },
        vet_fang: { x: 350, y: 550 },
        peddler_cai: { x: 565, y: 465 }
      };

      for (const [npcId, spot] of Object.entries(townNpcs)) {
        const npc = NPCS[npcId];
        if (!npc) continue;
        if (npc.appearDays && !npc.appearDays.includes(this.village.day)) continue;
        items.push({
          id: `npc_${npcId}`,
          type: 'npc',
          npcId,
          x: spot.x,
          y: spot.y,
          radius: 56,
          icon: npc.icon,
          label: `與 ${npc.name} 對話`
        });
      }
    } else if (this.currentMapId === 'beach') {
      const hai = NPCS.captain_hai;
      if (hai) {
        items.push({
          id: 'npc_captain_hai',
          type: 'npc',
          npcId: 'captain_hai',
          x: 385,
          y: 315,
          radius: 56,
          icon: hai.icon,
          label: `與 ${hai.name} 對話`
        });
      }
      items.push(
        { id: 'sea_fish', type: 'fish', x: 800, y: 385, radius: 64, icon: '🎣', label: '碼頭盡頭釣魚' },
        { id: 'sea_comb', type: 'mountain_act', actionId: 'beach_combing', x: 475, y: 530, radius: 64, icon: '🦀', label: '潮間帶趕海' }
      );
    } else if (this.currentMapId === 'mountain') {
      items.push(
        { id: 'mt_mine', type: 'mountain_act', actionId: 'mine_ore', x: 675, y: 295, radius: 64, icon: '⛏️', label: '古礦坑挖礦' },
        { id: 'mt_wood', type: 'mountain_act', actionId: 'chop_wood', x: 315, y: 285, radius: 64, icon: '🪓', label: '檜木林伐木' },
        { id: 'mt_bush', type: 'mountain_act', actionId: 'bush_treasure', x: 345, y: 465, radius: 60, icon: '🌿', label: '草叢尋寶' }
      );
    }

    this.colliders = boxes;
    this.interactables = items;
  }

  bindInputEvents() {
    const joyZone = document.getElementById('virtual-joy-zone');
    const joyKnob = document.getElementById('virtual-joy-knob');
    const interactBtn = document.getElementById('map-interact-btn');

    if (joyZone && joyKnob) {
      const maxRadius = 36;
      const updateJoy = (clientX, clientY) => {
        if (this.activeActionAnim || this.isLocalSleepLocked()) return;
        const rect = joyZone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxRadius) {
          dx = (dx / dist) * maxRadius;
          dy = (dy / dist) * maxRadius;
        }
        joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.joyVec.x = dx / maxRadius;
        this.joyVec.y = dy / maxRadius;
        this.walkTarget = null;
      };

      joyZone.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (this.activeActionAnim || this.isLocalSleepLocked()) return;
        this.joyActive = true;
        this.joyPointerId = e.pointerId;
        joyZone.setPointerCapture(e.pointerId);
        updateJoy(e.clientX, e.clientY);
      });

      joyZone.addEventListener('pointermove', (e) => {
        if (!this.joyActive || e.pointerId !== this.joyPointerId) return;
        updateJoy(e.clientX, e.clientY);
      });

      const resetJoy = (e) => {
        if (e.pointerId !== this.joyPointerId) return;
        this.joyActive = false;
        this.joyPointerId = null;
        this.joyVec = { x: 0, y: 0 };
        joyKnob.style.transform = 'translate(0px, 0px)';
        this.syncPositionNow(false);
      };
      joyZone.addEventListener('pointerup', resetJoy);
      joyZone.addEventListener('pointercancel', resetJoy);
    }

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.activeActionAnim || this.isLocalSleepLocked()) return;
      if (this.settings.controlMode === 'joystick') return;
      const rect = this.canvas.getBoundingClientRect();
      const clickScreenX = e.clientX - rect.left;
      const clickScreenY = e.clientY - rect.top;

      const cam = this.getCameraOffset();
      const worldX = Math.max(20, Math.min(MAP_W - 20, clickScreenX + cam.x));
      const worldY = Math.max(20, Math.min(MAP_H - 20, clickScreenY + cam.y));

      let clickedTarget = null;
      const npcAtHome = this.isNpcOffWork();
      for (const obj of this.interactables) {
        if (obj.type === 'npc' && npcAtHome) continue;
        if (Math.hypot(worldX - obj.x, worldY - obj.y) <= obj.radius) {
          clickedTarget = obj;
          break;
        }
      }

      this.walkTarget = {
        x: clickedTarget ? clickedTarget.x : worldX,
        y: clickedTarget ? clickedTarget.y + 24 : worldY,
        autoInteract: clickedTarget
      };
    });

    interactBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.passOutAnimation) return;
      if (this.isLocalSleepLocked()) {
        this.callbacks.onCancelSleep?.();
        return;
      }
      if (this.nearestInteractable && this.callbacks.onInteract) {
        this.callbacks.onInteract(this.nearestInteractable);
      }
    });

    const baitSel = document.getElementById('map-bait-select');
    if (baitSel && this.callbacks.onBaitChange) {
      baitSel.value = this.callbacks.getSelectedBait?.() || '';
      baitSel.addEventListener('change', (e) => {
        this.callbacks.onBaitChange(e.target.value);
      });
    }
  }

  syncPositionNow(force = false) {
    if (!this.roomId || !this.meId) return;

    const curX = Math.round(this.localPos.x);
    const curY = Math.round(this.localPos.y);
    const movedDist = Math.hypot(curX - this.lastSyncedPos.x, curY - this.lastSyncedPos.y);

    if (!force && movedDist < 35) {
      this.dirtySync = false;
      return;
    }

    const now = performance.now();
    const elapsed = now - this.lastSyncTime;
    if (!force && elapsed < 2500) {
      if (!this.pendingSyncTimer) {
        this.pendingSyncTimer = setTimeout(() => {
          this.pendingSyncTimer = null;
          this.syncPositionNow(false);
        }, 2500 - elapsed + 50);
      }
      return;
    }

    if (this.pendingSyncTimer) {
      clearTimeout(this.pendingSyncTimer);
      this.pendingSyncTimer = null;
    }

    this.lastSyncTime = now;
    this.dirtySync = false;
    this.lastSyncedPos = { x: curX, y: curY };

    updatePlayerPresence(this.roomId, this.meId, {
      posX: curX,
      posY: curY,
      location: this.currentMapId
    }).then(() => {
      this.positionSyncErrorShown = false;
    }).catch(err => {
      console.error(err);
      if (err.code === 'permission-denied' && !this.positionSyncErrorShown) {
        this.positionSyncErrorShown = true;
        this.callbacks.onMovementSyncError?.();
      }
    });
  }

  getCameraOffset() {
    const vw = this.viewW || 360;
    const vh = this.viewH || 420;
    const camX = vw >= MAP_W ? (MAP_W - vw) / 2 : Math.max(0, Math.min(MAP_W - vw, this.localPos.x - vw / 2));
    const camY = vh >= MAP_H ? (MAP_H - vh) / 2 : Math.max(0, Math.min(MAP_H - vh, this.localPos.y - vh / 2));
    return { x: camX, y: camY };
  }

  loop = (now) => {
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    this.update(dt, now);
    this.render(now);

    this.rafId = requestAnimationFrame(this.loop);
  };

  update(dt, now) {
    if (this.isNpcOffWork() && this.walkTarget?.autoInteract?.type === 'npc') {
      this.walkTarget = null;
    }

    if (this.activeActionAnim) {
      const action = this.activeActionAnim;
      action.elapsed += dt;
      const progress = Math.min(1, action.elapsed / action.duration);

      const soundStep = Math.floor(action.elapsed / 0.38);
      if (soundStep !== action.lastSoundTick) {
        action.lastSoundTick = soundStep;
        soundFX.playDiceTick();
      }

      action.particleTimer += dt;
      if (action.particleTimer >= 0.07) {
        action.particleTimer = 0;
        if (action.category === 'watering_can') {
          for (let i = 0; i < 2; i++) {
            action.particles.push({
              x: action.x - 16 + (Math.random() - 0.5) * 10,
              y: action.y - 22,
              vx: -12 + (Math.random() - 0.5) * 18,
              vy: 55 + Math.random() * 35,
              size: 2.6 + Math.random() * 1.5,
              color: Math.random() > 0.4 ? '#38bdf8' : '#bae6fd',
              alpha: 0.95
            });
          }
        } else if (['pickaxe', 'axe', 'hoe', 'trowel'].includes(action.category)) {
          const particleColor = action.category === 'pickaxe'
            ? (Math.random() > 0.4 ? '#facc15' : '#fb923c')
            : action.category === 'axe'
              ? (Math.random() > 0.5 ? '#d97706' : '#fef3c7')
              : '#78350f';
          action.particles.push({
            x: action.x + (Math.random() - 0.5) * 14,
            y: action.y - 4,
            vx: (Math.random() - 0.5) * 85,
            vy: -45 - Math.random() * 45,
            size: 2.8 + Math.random() * 2,
            color: particleColor,
            alpha: 1
          });
        } else {
          action.particles.push({
            x: action.x + (Math.random() - 0.5) * 24,
            y: action.y - 10,
            vx: (Math.random() - 0.5) * 24,
            vy: -28 - Math.random() * 20,
            size: 3,
            color: '#fde047',
            alpha: 0.95
          });
        }
      }

      for (let i = action.particles.length - 1; i >= 0; i--) {
        const particle = action.particles[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        if (action.category !== 'watering_can') particle.vy += 160 * dt;
        particle.alpha -= dt * 1.6;
        if (particle.alpha <= 0) action.particles.splice(i, 1);
      }

      if (progress >= 1) {
        this.activeActionAnim = null;
        action.resolve?.();
      }
    }

    if (this.mapFadeAlpha > 0) {
      this.mapFadeAlpha = Math.max(0, this.mapFadeAlpha - dt * 2.4);
    }
    if (this.mapBannerTimer > 0) {
      this.mapBannerTimer = Math.max(0, this.mapBannerTimer - dt);
    }

    // 更新頭頂即時飄字
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 0.72;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }

    // 廣場陳阿嬤煙囪白煙粒子
    if (this.currentMapId === 'town') {
      this.smokeTimer += dt;
      if (this.smokeTimer >= 0.45) {
        this.smokeTimer = 0;
        this.smokeParticles.push({
          x: 142 + (Math.random() - 0.5) * 6,
          y: 112,
          vx: 8 + Math.random() * 8,
          vy: -20 - Math.random() * 8,
          size: 5,
          alpha: 0.65
        });
      }
    }
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const s = this.smokeParticles[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.size += dt * 7;
      s.alpha -= dt * 0.35;
      if (s.alpha <= 0) this.smokeParticles.splice(i, 1);
    }

    // 海邊海鷗盤旋飛行
    if (this.currentMapId === 'beach') {
      for (const g of this.seagulls) {
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.phase += dt * 7;
        if (g.x > 930) { g.x = 930; g.vx = -Math.abs(g.vx); }
        if (g.x < 460) { g.x = 460; g.vx = Math.abs(g.vx); }
        if (g.y > 580) { g.y = 580; g.vy = -Math.abs(g.vy); }
        if (g.y < 110) { g.y = 110; g.vy = Math.abs(g.vy); }
      }
    }

    const sleepLocked = this.isLocalSleepLocked();
    if (sleepLocked) {
      this.localPos.x = FARM_BED_POSITION.x;
      this.localPos.y = FARM_BED_POSITION.y;
      this.walkTarget = null;
      this.joyActive = false;
      this.joyPointerId = null;
      this.joyVec = { x: 0, y: 0 };
    }

    const speed = this.settings.moveSpeed === 'fast' ? 245 : 180;
    let vx = 0;
    let vy = 0;

    if (!sleepLocked && !this.activeActionAnim && this.joyActive && (Math.abs(this.joyVec.x) > 0.08 || Math.abs(this.joyVec.y) > 0.08)) {
      vx = this.joyVec.x * speed;
      vy = this.joyVec.y * speed;
    } else if (!sleepLocked && !this.activeActionAnim && this.walkTarget) {
      const dx = this.walkTarget.x - this.localPos.x;
      const dy = this.walkTarget.y - this.localPos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        vx = (dx / dist) * speed;
        vy = (dy / dist) * speed;
      } else {
        const autoObj = this.walkTarget.autoInteract;
        this.walkTarget = null;
        this.syncPositionNow(false);
        if (autoObj && this.callbacks.onInteract) {
          this.callbacks.onInteract(autoObj);
        }
      }
    }

    if (vx !== 0 || vy !== 0) {
      const prevX = this.localPos.x;
      const prevY = this.localPos.y;

      this.localPos.x = Math.max(20, Math.min(MAP_W - 20, this.localPos.x + vx * dt));
      this.localPos.y = Math.max(20, Math.min(MAP_H - 20, this.localPos.y + vy * dt));

      const circle = { x: this.localPos.x, y: this.localPos.y + 8, r: PLAYER_RADIUS };
      let hitWall = false;
      for (const box of this.colliders) {
        if (resolveCircleAABB(circle, box)) {
          hitWall = true;
        }
      }
      if (!this.isNpcOffWork()) {
        for (const obj of this.interactables) {
          if (obj.type === 'npc' && resolveCircleAABB(circle, { x: obj.x - 14, y: obj.y - 14, w: 28, h: 28 })) {
            hitWall = true;
          }
        }
      }
      this.localPos.x = circle.x;
      this.localPos.y = circle.y - 8;

      if (hitWall && this.walkTarget && Math.hypot(this.localPos.x - prevX, this.localPos.y - prevY) < 0.4) {
        const autoObj = this.walkTarget.autoInteract;
        this.walkTarget = null;
        if (autoObj && Math.hypot(this.localPos.x - autoObj.x, this.localPos.y - autoObj.y) <= autoObj.radius + 14) {
          this.callbacks.onInteract?.(autoObj);
        }
      }

      this.walkPhase += dt * 12;
      this.dirtySync = true;

      // 海邊沙灘留下左右交替淡出腳印；其他地面冒出跑動煙塵
      const onSand = this.currentMapId === 'beach' && this.localPos.x > 260 && this.localPos.x < 620;
      if (onSand) {
        this.footprintTimer += dt;
        if (this.footprintTimer >= 0.22) {
          this.footprintTimer = 0;
          this.footprintStep++;
          const angle = Math.atan2(vy, vx);
          const sideOffset = (this.footprintStep % 2 === 0 ? 5 : -5);
          this.footprints.push({
            x: this.localPos.x - Math.sin(angle) * sideOffset,
            y: this.localPos.y + 20 + Math.cos(angle) * sideOffset,
            angle,
            alpha: 0.55
          });
        }
      } else {
        this.dustTimer += dt;
        if (this.dustTimer >= 0.16) {
          this.dustTimer = 0;
          this.dustParticles.push({
            x: this.localPos.x + (Math.random() - 0.5) * 10,
            y: this.localPos.y + 18,
            vx: -vx * 0.12 + (Math.random() - 0.5) * 14,
            vy: -12 - Math.random() * 10,
            alpha: 0.75,
            size: 4 + Math.random() * 3
          });
        }
      }

      const mapDef = SUB_MAPS[this.currentMapId];
      for (const ex of mapDef?.exits || []) {
        if (
          this.localPos.x >= ex.x &&
          this.localPos.x <= ex.x + ex.w &&
          this.localPos.y >= ex.y &&
          this.localPos.y <= ex.y + ex.h
        ) {
          this.switchToMap(ex.targetMap, ex.spawnX, ex.spawnY);
          return;
        }
      }

      if (now - this.lastSyncTime > 4000) {
        this.syncPositionNow(false);
      }
    } else {
      this.walkPhase = 0;
      if (this.dirtySync) {
        this.syncPositionNow(false);
      }
    }

    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= dt * 1.6;
      p.size += dt * 4;
      if (p.alpha <= 0) this.dustParticles.splice(i, 1);
    }

    for (let i = this.footprints.length - 1; i >= 0; i--) {
      this.footprints[i].alpha -= dt * 0.24;
      if (this.footprints[i].alpha <= 0) this.footprints.splice(i, 1);
    }

    for (const p of this.players) {
      if (p.id === this.meId) continue;
      const location = p.location || 'town';
      const targetX = typeof p.posX === 'number' ? p.posX : 480;
      const targetY = typeof p.posY === 'number' ? p.posY : 365;
      if (this.remoteLocations.get(p.id) !== location) {
        this.remoteLocations.set(p.id, location);
        this.remotePositions.set(p.id, { x: targetX, y: targetY });
        continue;
      }
      const cur = this.remotePositions.get(p.id) || { x: targetX, y: targetY };
      const dx = targetX - cur.x;
      const dy = targetY - cur.y;
      const distance = Math.hypot(dx, dy);
      const step = REMOTE_MOVE_SPEED * dt;
      if (distance <= step) {
        cur.x = targetX;
        cur.y = targetY;
      } else if (distance > 0) {
        cur.x += (dx / distance) * step;
        cur.y += (dy / distance) * step;
      }
      this.remotePositions.set(p.id, cur);
    }

    let closest = null;
    let minDist = Infinity;
    const npcAtHome = this.isNpcOffWork();
    for (const obj of this.interactables) {
      if (obj.type === 'npc' && npcAtHome) continue;
      const d = Math.hypot(this.localPos.x - obj.x, this.localPos.y - obj.y);
      if (obj.type === 'sleep' && d <= obj.radius) {
        minDist = d;
        closest = obj;
      } else if (closest?.type !== 'sleep' && d <= obj.radius && d < minDist) {
        minDist = d;
        closest = obj;
      }
    }
    this.nearestInteractable = closest;

    const btn = document.getElementById('map-interact-btn');
    const iconEl = document.getElementById('map-interact-icon');
    const labelEl = document.getElementById('map-interact-label');
    if (btn && iconEl && labelEl) {
      const isRightJoy = this.settings.joystickSide === 'right' && (this.settings.controlMode === 'dual' || this.settings.controlMode === 'joystick');
      const mapDef = SUB_MAPS[this.currentMapId];
      if (this.passOutAnimation) {
        btn.className = `absolute bottom-4 ${isRightJoy ? 'left-3' : 'right-3'} max-w-[215px] px-4 py-3 rounded-2xl font-black text-xs shadow-lg border-2 transition-all flex items-center gap-2 bg-stone-700/90 text-amber-100 border-amber-300`;
        iconEl.textContent = '💫';
        labelEl.textContent = '體力耗盡，家人正扛你回家…';
      } else if (this.isLocalSleepLocked()) {
        btn.className = `absolute bottom-4 ${isRightJoy ? 'left-3' : 'right-3'} max-w-[215px] px-4 py-3 rounded-2xl font-black text-xs shadow-xl border-2 transition-all flex items-center gap-2 bg-amber-600 active:bg-amber-700 text-white border-amber-200`;
        iconEl.textContent = '☀️';
        labelEl.textContent = '暫時起床（取消等待）';
      } else if (closest?.type === 'sleep') {
        btn.className = `absolute bottom-4 ${isRightJoy ? 'left-3' : 'right-3'} max-w-[215px] px-4 py-3 rounded-2xl font-black text-xs shadow-xl border-2 transition-all flex items-center gap-2 bg-indigo-600 active:bg-indigo-700 text-white border-amber-300 scale-105`;
        iconEl.textContent = closest.icon;
        labelEl.textContent = closest.label;
      } else if (closest) {
        btn.className = `absolute bottom-4 ${isRightJoy ? 'left-3' : 'right-3'} max-w-[215px] px-4 py-3 rounded-2xl font-black text-xs shadow-xl border-2 transition-all flex items-center gap-2 bg-emerald-600 active:bg-emerald-700 text-white border-amber-300 scale-105`;
        iconEl.textContent = closest.icon;
        labelEl.textContent = closest.label;
      } else {
        btn.className = `absolute bottom-4 ${isRightJoy ? 'left-3' : 'right-3'} max-w-[200px] px-3.5 py-2.5 rounded-2xl font-bold text-xs shadow-md border transition-all flex items-center gap-1.5 bg-stone-800/75 text-stone-200 border-stone-500`;
        iconEl.textContent = mapDef?.icon || '👣';
        labelEl.textContent = `目前：${mapDef?.name || '小鎮'}`;
      }
    }

    const sleepNavLabel = document.getElementById('sleep-nav-label');
    const sleepNavButton = document.getElementById('btn-nav-sleep');
    if (sleepNavLabel && sleepNavButton) {
      const passingOut = Boolean(this.passOutAnimation);
      const waiting = !passingOut && this.isLocalSleepLocked();
      const label = passingOut
        ? '昏倒中'
        : waiting
        ? '暫時起床'
        : this.isAtSleepSpot()
          ? '上床睡覺'
          : '回家睡覺';
      const icon = passingOut ? '💫' : waiting ? '☀️' : this.isAtSleepSpot() ? '😴' : '🏡';
      const iconSpan = sleepNavButton.querySelector('span');
      if (sleepNavLabel.textContent !== label) sleepNavLabel.textContent = label;
      if (iconSpan && iconSpan.textContent !== icon) iconSpan.textContent = icon;
      sleepNavButton.classList.toggle('bg-indigo-50', !passingOut && !waiting && this.isAtSleepSpot());
      sleepNavButton.classList.toggle('bg-amber-50', waiting);
      const title = passingOut
        ? '體力耗盡，家人正將你扛回農舍'
        : waiting
        ? '在農舍床鋪取消等待'
        : this.isAtSleepSpot()
          ? '在家族農舍上床睡覺'
          : '回到農場家族農舍才能睡覺';
      if (sleepNavButton.title !== title) sleepNavButton.title = title;
    }

    const baitBar = document.getElementById('map-bait-bar');
    if (baitBar) {
      baitBar.classList.toggle('hidden', this.currentMapId !== 'beach');
    }
  }

  render(now) {
    if (!this.ctx || !this.village) return;
    const ctx = this.ctx;
    const mapDef = SUB_MAPS[this.currentMapId] || SUB_MAPS.town;
    const cam = this.getCameraOffset();

    // 1. 外圍森林樹冠框
    this.drawOuterForestFrame(ctx, mapDef);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // 2. 俯瞰水彩底圖
    const bgImg = getMapBgImage(mapDef.id);
    if (bgImg.complete && bgImg.naturalWidth > 0 && bgImg.dataset.failedAll !== '1') {
      ctx.drawImage(bgImg, 0, 0, MAP_W, MAP_H);
    } else {
      ctx.fillStyle = '#a7e8b5';
      ctx.fillRect(0, 0, MAP_W, MAP_H);
    }

    // 3. 地標動態細節（紅燈籠、鐵匠爐火、煙囪白煙、燈塔光束）
    this.drawLandmarkAnimations(ctx, mapDef, now);

    // 4. 出入口路牌與房屋名牌
    this.drawMapExits(ctx, mapDef, now);
    this.drawHouseLabels(ctx, mapDef);

    // 5. 沙灘腳印
    for (const fp of this.footprints) {
      ctx.save();
      ctx.translate(fp.x, fp.y);
      ctx.rotate(fp.angle);
      ctx.fillStyle = `rgba(133, 77, 39, ${Math.max(0, fp.alpha)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. 點擊尋路光圈
    if (this.walkTarget) {
      const pulse = 11 + Math.sin(now * 0.008) * 3;
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.walkTarget.x, this.walkTarget.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 7. 農田作物、牧場動物、村民 NPC（含委託 ！ 氣泡）與設施
    this.drawInteractables(ctx, now);

    // 8. 腳下揚塵
    for (const p of this.dustParticles) {
      ctx.fillStyle = `rgba(255, 250, 235, ${Math.max(0, p.alpha)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 9. 在線家人角色（依 Y 軸前後排序）
    const renderChars = [];
    const renderNow = Date.now();
    for (const p of this.players) {
      const isMe = p.id === this.meId;
      const isOnline = isMe || (Date.now() - (p.lastActiveAt || 0) <= ONLINE_TIMEOUT_MS);
      const passOut = isMe ? this.passOutAnimation : p.passOutAnimation;
      const isBeingCarried = Boolean(
        passOut && (isMe || passOut.expiresAt > renderNow) && passOut.location === this.currentMapId
      );
      const pLoc = isMe
        ? this.currentMapId
        : isBeingCarried
          ? passOut.location
          : (p.location || 'town');
      if (!isOnline || pLoc !== this.currentMapId) continue;

      const pos = isMe
        ? this.localPos
        : isBeingCarried
          ? { x: passOut.posX, y: passOut.posY }
          : (this.remotePositions.get(p.id) || { x: mapDef.spawnX, y: mapDef.spawnY });
      const targetX = typeof p.posX === 'number' ? p.posX : 480;
      const targetY = typeof p.posY === 'number' ? p.posY : 365;
      const isMoving = !isMe && Math.hypot(targetX - pos.x, targetY - pos.y) > 4;
      renderChars.push({ player: p, x: pos.x, y: pos.y, isMe, isMoving, passOut: isBeingCarried ? passOut : null });
    }
    renderChars.sort((a, b) => a.y - b.y);

    let sleepingIndex = 0;
    for (const item of renderChars) {
      if (item.passOut) {
        this.drawPassOutCharacter(ctx, item.player, item.x, item.y, item.passOut);
      } else if (item.player.readyToSleep || item.player.isSleeping) {
        const bedX = 140 + (sleepingIndex % 5) * 145;
        const bedY = 220 + Math.floor(sleepingIndex / 5) * 68;
        this.drawSleepingPlayer(ctx, item.player, bedX, bedY, now);
        sleepingIndex++;
      } else {
        this.drawPlayerCharacter(ctx, item.player, item.x, item.y, item.isMe, item.isMoving);
      }
      if (!item.isMe && !item.player.readyToSleep && !item.player.isSleeping) {
        this.drawRemoteActionIndicator(ctx, item.player, item.x, item.y, now);
      }
    }

    // 10. 海邊盤旋海鷗
    if (this.currentMapId === 'beach') {
      this.drawSeagulls(ctx);
    }

    this.drawActiveActionAnim(ctx, now);

    // 11. 角色頭頂即時飄字（Floating Text）
    this.drawFloatingTexts(ctx);

    // 12. 日夜光影與雨雪／螢火蟲／春櫻粒子
    this.drawAtmosphere(ctx, now);

    ctx.restore();

    // 13. 右上角半透明小雷達（Mini-map）
    this.drawMiniMap(ctx, mapDef, cam, now);

    // 14. 切換地圖淡入過場與橫幅
    if (this.mapFadeAlpha > 0) {
      ctx.fillStyle = `rgba(28, 25, 23, ${this.mapFadeAlpha})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
    if (this.mapBannerTimer > 0 && this.mapBannerText) {
      const alpha = Math.min(1, this.mapBannerTimer * 1.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(120, 53, 15, 0.92)';
      roundRectPath(ctx, this.viewW / 2 - 95, 48, 190, 32, 16);
      ctx.fill();
      ctx.strokeStyle = '#fcd34d';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.mapBannerText, this.viewW / 2, 64);
      ctx.restore();
    }
  }

  drawActiveActionAnim(ctx, now) {
    const action = this.activeActionAnim;
    if (!action) return;

    const progress = Math.min(1, action.elapsed / action.duration);
    const { x, y, category, tierInfo, toolTitle, label } = action;

    ctx.save();
    ctx.strokeStyle = category === 'watering_can' ? 'rgba(56, 189, 248, 0.85)' : 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 26 + Math.sin(now * 0.015) * 3, 0, Math.PI * 2);
    ctx.stroke();

    for (const particle of action.particles) {
      ctx.globalAlpha = Math.max(0, particle.alpha);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.shadowColor = tierInfo.glow || 'transparent';
    ctx.shadowBlur = tierInfo.glow ? 9 : 0;
    if (category === 'watering_can') {
      const tilt = -0.58 + Math.sin(now * 0.016) * 0.14;
      ctx.translate(x + 12, y - 34);
      ctx.rotate(tilt);

      ctx.strokeStyle = tierInfo.head;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(4, -6, 11, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();

      ctx.fillStyle = tierInfo.head;
      ctx.strokeStyle = '#3b1e0b';
      ctx.lineWidth = 2;
      roundRectPath(ctx, -11, -7, 22, 18, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = tierInfo.edge;
      ctx.fillRect(-7, -3, 14, 3);

      ctx.strokeStyle = tierInfo.head;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-10, 4);
      ctx.lineTo(-24, -5);
      ctx.stroke();

      ctx.fillStyle = tierInfo.edge;
      ctx.beginPath();
      ctx.arc(-25, -6, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (['pickaxe', 'axe', 'hoe', 'trowel'].includes(category)) {
      const swing = Math.sin(now * 0.02) * 0.72 - 0.25;
      ctx.translate(x + 16, y - 16);
      ctx.rotate(swing);

      ctx.fillStyle = tierInfo.shaft;
      ctx.strokeStyle = '#2a160a';
      ctx.lineWidth = 1.8;
      roundRectPath(ctx, -3, -28, 6, 34, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = tierInfo.head;
      if (category === 'pickaxe') {
        ctx.beginPath();
        ctx.moveTo(-19, -22);
        ctx.quadraticCurveTo(0, -32, 19, -22);
        ctx.quadraticCurveTo(0, -25, -19, -22);
        ctx.fill();
        ctx.stroke();
      } else if (category === 'axe') {
        ctx.beginPath();
        ctx.moveTo(-2, -28);
        ctx.lineTo(-17, -33);
        ctx.quadraticCurveTo(-20, -23, -17, -14);
        ctx.lineTo(-2, -19);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        roundRectPath(ctx, -15, -29, 18, 8, 3);
        ctx.fill();
        ctx.stroke();
      }
    } else if (category === 'fishing_rod') {
      const rodTilt = -0.45 + Math.sin(now * 0.01) * 0.08;
      ctx.translate(x - 18, y - 18);
      ctx.rotate(rodTilt);
      ctx.strokeStyle = tierInfo.head;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(28, -24);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(28, -24);
      ctx.lineTo(36, 16);
      ctx.stroke();
    } else if (category === 'brush') {
      const stroke = Math.sin(now * 0.018) * 0.5;
      ctx.translate(x + 16, y - 18);
      ctx.rotate(stroke - 0.4);
      ctx.strokeStyle = tierInfo.shaft;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -23);
      ctx.lineTo(0, 7);
      ctx.stroke();
      ctx.fillStyle = tierInfo.edge;
      ctx.strokeStyle = tierInfo.head;
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, -8, 4, 16, 10, 4);
      ctx.fill();
      ctx.stroke();
    } else {
      const bob = Math.sin(now * 0.018) * 4;
      ctx.translate(x, y - 24 + bob);
      ctx.fillStyle = '#b45309';
      ctx.strokeStyle = '#3b1e0b';
      ctx.lineWidth = 2;
      roundRectPath(ctx, -14, -6, 28, 16, 6);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -6, 10, Math.PI, 0);
      ctx.stroke();
    }
    ctx.restore();

    const barW = 110;
    const barH = 11;
    const barX = x - barW / 2;
    const barY = y - 62;

    ctx.fillStyle = 'rgba(42, 22, 10, 0.9)';
    roundRectPath(ctx, x - 75, barY - 18, 150, 15, 6);
    ctx.fill();
    ctx.fillStyle = tierInfo.edge;
    ctx.font = 'bold 9.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${toolTitle}・${label} ${Math.round(progress * 100)}%`, x, barY - 10.5, 146);

    roundRectPath(ctx, barX, barY, barW, barH, 5.5);
    ctx.fillStyle = '#2b160a';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const fillW = Math.max(4, (barW - 4) * progress);
    roundRectPath(ctx, barX + 2, barY + 2, fillW, barH - 4, 3.5);
    ctx.fillStyle = category === 'watering_can' ? '#38bdf8' : '#22c55e';
    ctx.fill();
    ctx.restore();
  }

  drawRemoteActionIndicator(ctx, player, x, y, now) {
    const action = player.actionAnimation;
    if (!action || action.location !== this.currentMapId) return;

    const actionId = `${action.startedAt}:${action.category}`;
    let playback = this.remoteActionAnimations.get(player.id);
    if (playback?.id !== actionId) {
      const duration = Number(action.expiresAt) - Number(action.startedAt);
      const delay = Date.now() - Number(action.startedAt);
      if (
        !Number.isFinite(duration) ||
        duration <= 0 ||
        !Number.isFinite(delay) ||
        delay > REMOTE_ACTION_MAX_DELAY_MS
      ) return;

      const hasTargetPosition = Number.isFinite(action.posX) && Number.isFinite(action.posY);
      const distance = hasTargetPosition
        ? Math.hypot(action.posX - x, action.posY - y)
        : 0;
      playback = {
        id: actionId,
        targetX: hasTargetPosition ? action.posX : null,
        targetY: hasTargetPosition ? action.posY : null,
        arrivalDeadline: now + (distance / REMOTE_MOVE_SPEED) * 1000 + 1000,
        duration,
        expiresAt: null
      };
      this.remoteActionAnimations.set(player.id, playback);
    }

    if (playback.expiresAt === null) {
      if (playback.targetX !== null) {
        const distance = Math.hypot(playback.targetX - x, playback.targetY - y);
        if (distance > REMOTE_ACTION_ARRIVAL_RADIUS) {
          if (now > playback.arrivalDeadline) playback.expiresAt = now;
          return;
        }
      }
      playback.expiresAt = now + playback.duration;
    }
    if (playback.expiresAt <= now) return;

    const icons = {
      watering_can: '🪣',
      pickaxe: '⛏️',
      axe: '🪓',
      hoe: '🪏',
      trowel: '🪏',
      brush: '🧹',
      fishing_rod: '🎣',
      harvest: '🌾'
    };
    const icon = icons[action.category] || '✨';
    const remaining = playback.expiresAt - now;

    ctx.save();
    ctx.globalAlpha = Math.min(1, remaining / 180);
    ctx.translate(x + 24, y - 78 + Math.sin(now * 0.012) * 2);
    ctx.rotate(Math.sin(now * 0.018) * 0.28);
    ctx.fillStyle = 'rgba(28, 25, 23, 0.82)';
    ctx.strokeStyle = action.category === 'watering_can' ? '#38bdf8' : '#facc15';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, -13, -13, 26, 26, 9);
    ctx.fill();
    ctx.stroke();
    ctx.font = '17px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 0, 0);
    ctx.restore();
  }

  // 動態地標特效（疊加在水彩底圖上方）
  drawLandmarkAnimations(ctx, mapDef, now) {
    if (mapDef.id === 'town') {
      // 1. 廣場上方搖曳的過年紅燈籠串
      ctx.save();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(310, 290);
      ctx.quadraticCurveTo(485, 318, 660, 290);
      ctx.stroke();

      for (let lx = 345; lx <= 625; lx += 46) {
        const sway = Math.sin(now * 0.004 + lx) * 2.5;
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.ellipse(lx + sway, 307, 7, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.fillRect(lx - 3.5 + sway, 297, 7, 2.5);
        ctx.fillRect(lx - 3.5 + sway, 315, 7, 2.5);
      }
      ctx.restore();

      // 2. 陳阿嬤廚房煙囪冒出的白煙
      for (const s of this.smokeParticles) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, s.alpha)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. 大宇打鐵鋪爐火暖橘光暈閃爍
      const firePulse = 0.28 + Math.sin(now * 0.012) * 0.12;
      const fireGrad = ctx.createRadialGradient(768, 548, 4, 768, 548, 46);
      fireGrad.addColorStop(0, `rgba(251, 146, 60, ${firePulse + 0.25})`);
      fireGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.arc(768, 548, 46, 0, Math.PI * 2);
      ctx.fill();
    } else if (mapDef.id === 'beach') {
      // 白色燈塔旋轉光束
      ctx.save();
      const lx = 345;
      const ly = 128;
      const sweepAngle = 0.45 + Math.sin(now * 0.0014) * 0.65;
      ctx.translate(lx, ly);
      ctx.rotate(sweepAngle);

      const beamGrad = ctx.createLinearGradient(0, 0, 380, 0);
      beamGrad.addColorStop(0, 'rgba(254, 249, 195, 0.52)');
      beamGrad.addColorStop(1, 'rgba(254, 249, 195, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(380, -68);
      ctx.lineTo(380, 68);
      ctx.lineTo(0, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawSeagulls(ctx) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (const g of this.seagulls) {
      const flap = Math.sin(g.phase) * 5;
      ctx.beginPath();
      ctx.moveTo(g.x - 10, g.y + flap);
      ctx.quadraticCurveTo(g.x - 5, g.y - 5, g.x, g.y);
      ctx.quadraticCurveTo(g.x + 5, g.y - 5, g.x + 10, g.y + flap);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFloatingTexts(ctx) {
    ctx.save();
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, Math.min(1, ft.alpha));
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#3b1e0b';
      ctx.strokeText(ft.text, ft.x, ft.y, 300);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y, 300);
    }
    ctx.restore();
  }

  // 右上角半透明小雷達（Mini-map）
  drawMiniMap(ctx, mapDef, cam, now) {
    const mmW = 108;
    const mmH = 81;
    const mmX = this.viewW - mmW - 10;
    const mmY = 42;
    const scaleX = mmW / MAP_W;
    const scaleY = mmH / MAP_H;

    ctx.save();
    // 雷達外框
    roundRectPath(ctx, mmX, mmY, mmW, mmH, 10);
    ctx.fillStyle = 'rgba(42, 22, 10, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.clip();

    // 縮圖地景底圖
    const bgImg = getMapBgImage(mapDef.id);
    if (bgImg.complete && bgImg.naturalWidth > 0 && bgImg.dataset.failedAll !== '1') {
      ctx.globalAlpha = 0.65;
      ctx.drawImage(bgImg, mmX, mmY, mmW, mmH);
      ctx.globalAlpha = 1;
    }

    // 出口位置標記（黃色小區塊）
    ctx.fillStyle = 'rgba(253, 224, 71, 0.75)';
    for (const ex of mapDef.exits || []) {
      ctx.fillRect(mmX + ex.x * scaleX, mmY + ex.y * scaleY, Math.max(4, ex.w * scaleX), Math.max(4, ex.h * scaleY));
    }

    // 村民 NPC 光點（暖橘色）
    ctx.fillStyle = '#fb923c';
    const npcAtHome = this.isNpcOffWork();
    for (const obj of this.interactables) {
      if (obj.type === 'npc') {
        if (npcAtHome) continue;
        ctx.beginPath();
        ctx.arc(mmX + obj.x * scaleX, mmY + obj.y * scaleY, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 同張地圖上的其他家人（天藍色光點）
    for (const p of this.players) {
      if (p.id === this.meId) continue;
      const isOnline = Date.now() - (p.lastActiveAt || 0) <= ONLINE_TIMEOUT_MS;
      if (!isOnline || (p.location || 'town') !== this.currentMapId) continue;
      const pos = this.remotePositions.get(p.id) || { x: mapDef.spawnX, y: mapDef.spawnY };
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(mmX + pos.x * scaleX, mmY + pos.y * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 自己（閃爍翠綠光點＋白邊）
    const mePulse = 3.2 + Math.sin(now * 0.008) * 0.7;
    ctx.fillStyle = '#22c55e';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(mmX + this.localPos.x * scaleX, mmY + this.localPos.y * scaleY, mePulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 目前螢幕視野框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mmX + Math.max(0, cam.x) * scaleX,
      mmY + Math.max(0, cam.y) * scaleY,
      Math.min(MAP_W, this.viewW) * scaleX,
      Math.min(MAP_H, this.viewH) * scaleY
    );

    ctx.restore();
  }

  drawOuterForestFrame(ctx, mapDef) {
    ctx.fillStyle = mapDef.outerColor;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    ctx.fillStyle = 'rgba(22, 101, 52, 0.45)';
    for (let x = -20; x < this.viewW + 40; x += 48) {
      ctx.beginPath();
      ctx.arc(x, 12, 34, 0, Math.PI * 2);
      ctx.arc(x + 24, this.viewH - 12, 36, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(74, 222, 128, 0.16)';
    for (let x = 0; x < this.viewW + 40; x += 64) {
      ctx.beginPath();
      ctx.arc(x + 12, 22, 22, 0, Math.PI * 2);
      ctx.arc(x, this.viewH - 22, 24, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawMapExits(ctx, mapDef, now) {
    const pulse = Math.sin(now * 0.005) * 3;
    for (const ex of mapDef.exits || []) {
      const cx = ex.x + ex.w / 2;
      const cy = ex.y + ex.h / 2;
      const badgeW = 96;
      const badgeX = Math.max(8, Math.min(MAP_W - badgeW - 8, cx - badgeW / 2));

      ctx.fillStyle = 'rgba(254, 240, 138, 0.38)';
      roundRectPath(ctx, ex.x + 4, ex.y + 4, ex.w - 8, ex.h - 8, 12);
      ctx.fill();

      ctx.fillStyle = 'rgba(28, 25, 23, 0.85)';
      roundRectPath(ctx, badgeX, cy - 12 + pulse * 0.4, badgeW, 24, 10);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${ex.arrow} ${ex.label}`, badgeX + badgeW / 2, cy + pulse * 0.4);
    }
  }

  drawHouseLabels(ctx, mapDef) {
    for (const h of mapDef.houses || []) {
      ctx.save();
      if (this.isNpcOffWork()) {
        const glow = ctx.createRadialGradient(
          h.x + h.w * 0.5, h.y + h.h * 0.65, 6,
          h.x + h.w * 0.5, h.y + h.h * 0.65, 58
        );
        glow.addColorStop(0, 'rgba(253, 224, 71, 0.36)');
        glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(h.x + h.w * 0.5, h.y + h.h * 0.65, 58, 0, Math.PI * 2);
        ctx.fill();
      }

      const labelW = 118;
      const lx = h.x + h.w / 2 - labelW / 2;
      const ly = Math.max(8, h.y - 10);
      ctx.fillStyle = 'rgba(120, 53, 15, 0.92)';
      roundRectPath(ctx, lx, ly, labelW, 22, 10);
      ctx.fill();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#fffbeb';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(h.name, h.x + h.w / 2, ly + 11);
      ctx.restore();
    }
  }

  drawFarmPlotSprite(ctx, plot, x, y, now) {
    const w = 64;
    const h = 64;
    const left = x - w / 2;
    const top = y - h / 2;

    roundRectPath(ctx, left, top, w, h, 14);
    if (!plot.cleared) {
      ctx.fillStyle = 'rgba(163, 177, 138, 0.88)';
    } else if (plot.isWatered) {
      ctx.fillStyle = '#6b3e26';
    } else {
      ctx.fillStyle = '#9c6644';
    }
    ctx.fill();
    ctx.strokeStyle = plot.isWatered ? '#38bdf8' : '#582f0e';
    ctx.lineWidth = plot.isWatered ? 2.5 : 2;
    ctx.stroke();

    if (!plot.cleared) {
      ctx.strokeStyle = '#3a5a40';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      [[-10, 6], [6, 12], [0, -6]].forEach(([ox, oy]) => {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy + 6);
        ctx.lineTo(x + ox - 5, y + oy - 6);
        ctx.moveTo(x + ox, y + oy + 6);
        ctx.lineTo(x + ox, y + oy - 8);
        ctx.moveTo(x + ox, y + oy + 6);
        ctx.lineTo(x + ox + 5, y + oy - 6);
        ctx.stroke();
      });
      return;
    }

    ctx.strokeStyle = plot.isWatered ? 'rgba(42, 22, 10, 0.55)' : 'rgba(110, 66, 36, 0.5)';
    ctx.lineWidth = 2.5;
    [-15, 0, 15].forEach(oy => {
      ctx.beginPath();
      ctx.moveTo(left + 10, y + oy);
      ctx.lineTo(left + w - 10, y + oy);
      ctx.stroke();
    });

    if (!plot.cropId) return;

    const crop = ITEMS[plot.cropId];
    const seed = Object.values(ITEMS).find(i => i.cropId === plot.cropId);
    const growDays = seed?.growDays || 2;
    const isReady = plot.daysGrown >= growDays;

    if (plot.daysGrown <= 0) {
      [[-12, -6], [12, 8], [0, -14]].forEach(([ox, oy]) => {
        ctx.fillStyle = '#84cc16';
        ctx.beginPath();
        ctx.ellipse(x + ox - 4, y + oy, 5, 2.8, -0.4, 0, Math.PI * 2);
        ctx.ellipse(x + ox + 4, y + oy, 5, 2.8, 0.4, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (!isReady) {
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(x - 10, y + 4, 11, 0, Math.PI * 2);
      ctx.arc(x + 10, y + 4, 11, 0, Math.PI * 2);
      ctx.arc(x, y - 5, 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(x - 4, y - 6, 7, 0, Math.PI * 2);
      ctx.arc(x + 5, y - 2, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      this.drawMatureCropByType(ctx, plot.cropId, crop?.name || '', x, y);
      const sparkle = 0.6 + Math.sin(now * 0.008 + x) * 0.4;
      ctx.fillStyle = `rgba(250, 204, 21, ${sparkle})`;
      ctx.beginPath();
      ctx.arc(x + 18, y - 18, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    const bob = Math.sin(now * 0.006 + x) * 2.5;
    if (isReady) {
      this.drawStatusBubble(ctx, x, top - 10 + bob, '✨', '#fef08a', '#ca8a04');
    } else if (!plot.isWatered) {
      this.drawStatusBubble(ctx, x, top - 10 + bob, '💧', '#e0f2fe', '#0284c7');
    }
  }

  drawMatureCropByType(ctx, cropId, cropName, x, y) {
    const key = `${cropId}_${cropName}`;
    if (/tomato|strawberry|chili|watermelon|番茄|草莓|辣椒/.test(key)) {
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.arc(x, y - 2, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      [[-9, 3], [9, 2], [0, -8], [-2, 10]].forEach(([ox, oy]) => {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, 6.5, 0, Math.PI * 2);
        ctx.fill();
      });
      return;
    }
    if (/rice|wheat|corn|pineapple|sweet_potato|稻|麥|玉米|鳳梨|地瓜/.test(key)) {
      ctx.fillStyle = '#65a30d';
      ctx.fillRect(x - 12, y - 4, 24, 16);
      ctx.fillStyle = '#facc15';
      [[-10, -6], [0, -10], [10, -6]].forEach(([ox, oy]) => {
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, 5.5, 11, ox * 0.02, 0, Math.PI * 2);
        ctx.fill();
      });
      return;
    }
    if (/radish|turnip|carrot|taro|蘿蔔|芋頭/.test(key)) {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(x - 6, y - 12, 5, 10, -0.3, 0, Math.PI * 2);
      ctx.ellipse(x + 6, y - 12, 5, 10, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 11, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(x - 9, y + 2, 12, 0, Math.PI * 2);
    ctx.arc(x + 9, y + 2, 12, 0, Math.PI * 2);
    ctx.arc(x, y - 5, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bbf7d0';
    ctx.beginPath();
    ctx.arc(x, y - 3, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  drawStatusBubble(ctx, x, y, iconText, bgColor, borderColor, textColor = '#78350f') {
    ctx.save();
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.8;
    roundRectPath(ctx, x - 13, y - 13, 26, 22, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(iconText, x, y - 2);
    ctx.restore();
  }

  drawInteractables(ctx, now) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const me = this.players.find(p => p.id === this.meId);
    const canClaimPopularGift = Boolean(
      me?.traits?.includes('popular') &&
      !me?.popularGiftUsedToday &&
      Object.keys(me?.dailyNpcChatUsed || {}).length === 0
    );
    const activeQuests = this.village.quests || this.village.dailyQuests || [];

    for (const obj of this.interactables) {
      if (obj.type === 'npc' && this.isNpcOffWork()) continue;
      const isHighlighted = this.nearestInteractable?.id === obj.id;

      if (isHighlighted) {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius * 0.72, 0, Math.PI * 2);
        ctx.fill();
      }

      if (obj.type === 'farm_plot') {
        const plot = this.village.farmPlots[obj.plotIndex];
        if (plot) this.drawFarmPlotSprite(ctx, plot, obj.x, obj.y, now);
      } else if (obj.type === 'npc') {
        ctx.fillStyle = 'rgba(42, 24, 12, 0.28)';
        ctx.beginPath();
        ctx.ellipse(obj.x, obj.y + 22, 16, 6.5, 0, 0, Math.PI * 2);
        ctx.fill();

        const img = getCachedAvatarImage(`chibi_npc_${obj.npcId}`, renderChibiNpcSVG(obj.npcId));
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, obj.x - 26, obj.y - 42, 52, 64);
        }

        const npc = NPCS[obj.npcId];
        ctx.fillStyle = '#4a2c18';
        roundRectPath(ctx, obj.x - 32, obj.y - 60, 64, 17, 7);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(npc?.name || '', obj.x, obj.y - 51.5);

        // 檢查該村民是否有待辦委託（！金色驚嘆號）與人氣王禮物（🎁）
        const hasNpcQuest = activeQuests.some(q => q.npcId === obj.npcId && !q.completed);
        const bob = Math.sin(now * 0.006 + obj.x) * 2.5;
        if (hasNpcQuest && canClaimPopularGift) {
          this.drawStatusBubble(ctx, obj.x - 15, obj.y - 74 + bob, '！', '#fef08a', '#b45309', '#b91c1c');
          this.drawStatusBubble(ctx, obj.x + 15, obj.y - 74 + bob, '🎁', '#fef08a', '#d97706');
        } else if (hasNpcQuest) {
          this.drawStatusBubble(ctx, obj.x, obj.y - 74 + bob, '！', '#fef08a', '#b45309', '#b91c1c');
        } else if (canClaimPopularGift) {
          this.drawStatusBubble(ctx, obj.x, obj.y - 74 + bob, '🎁', '#fef08a', '#d97706');
        }
      } else {
        ctx.fillStyle = 'rgba(255, 251, 235, 0.95)';
        roundRectPath(ctx, obj.x - 24, obj.y - 24, 48, 48, 15);
        ctx.fill();
        ctx.strokeStyle = 'rgba(180, 83, 9, 0.45)';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.font = '25px sans-serif';
        ctx.fillText(obj.icon, obj.x, obj.y - 2);

        ctx.fillStyle = 'rgba(28, 25, 23, 0.85)';
        roundRectPath(ctx, obj.x - 42, obj.y + 20, 84, 15, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(obj.label.slice(0, 7), obj.x, obj.y + 28);

        if (obj.type === 'ranch_animal') {
          const ani = (this.village.livestock || []).find(a => a.id === obj.animalId);
          if (ani?.productReady) {
            const bob = Math.sin(now * 0.006 + obj.x) * 2.5;
            this.drawStatusBubble(ctx, obj.x, obj.y - 32 + bob, '✨', '#fef08a', '#ca8a04');
          }
        }
      }
    }
  }

  drawPlayerCharacter(ctx, player, x, y, isMe, isMovingOverride = false) {
    const isMoving = isMe ? this.walkPhase > 0 : isMovingOverride;
    const walkPhase = isMe
      ? this.walkPhase
      : performance.now() * 0.012 + player.id.length;
    const bobOffset = isMoving ? Math.abs(Math.sin(walkPhase)) * 4 : Math.sin(performance.now() * 0.004) * 1.2;
    const walkFrame = !isMoving ? 0 : (Math.sin(walkPhase) >= 0 ? 1 : 2);

    ctx.fillStyle = 'rgba(42, 24, 12, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 22, 16, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const key = `chibi_player_${player.id}_${walkFrame}_${JSON.stringify(player.avatarConfig || {})}`;
    const img = getCachedAvatarImage(key, renderChibiPlayerSVG(player.avatarConfig, walkFrame));
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x - 27, y - 44 - bobOffset, 54, 66);
    }

    ctx.fillStyle = isMe ? '#14532d' : '#4a2c18';
    roundRectPath(ctx, x - 34, y - 63 - bobOffset, 68, 17, 8);
    ctx.fill();
    ctx.strokeStyle = isMe ? '#fde047' : '#d97706';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fffbeb';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.name || '村民', x, y - 54.5 - bobOffset);
  }

  drawSleepingPlayer(ctx, player, x, y, now) {
    ctx.save();
    const breath = Math.sin(now * 0.003 + x) * 1.5;

    ctx.fillStyle = 'rgba(42, 24, 12, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 23, 60, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8b5a2b';
    roundRectPath(ctx, x - 58, y - 13, 116, 44, 9);
    ctx.fill();
    ctx.strokeStyle = '#5b371b';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#fef3c7';
    roundRectPath(ctx, x - 51, y - 9, 35, 18, 8);
    ctx.fill();
    ctx.strokeStyle = '#d6b985';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#bf7541';
    roundRectPath(ctx, x - 12, y - 11 + breath, 62, 33, 12);
    ctx.fill();
    ctx.strokeStyle = '#8b4b2b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 229, 185, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 5 + breath);
    ctx.quadraticCurveTo(x + 12, y + 1 + breath, x + 3, y + 8 + breath);
    ctx.moveTo(x + 22, y - 5 + breath);
    ctx.quadraticCurveTo(x + 32, y + 1 + breath, x + 23, y + 8 + breath);
    ctx.stroke();

    const sleepingAvatar = { ...(player.avatarConfig || {}), eyes: 'chill' };
    const portrait = getCachedAvatarImage(
      `sleep_portrait_${player.id}_${JSON.stringify(sleepingAvatar)}`,
      renderAvatarSVG(sleepingAvatar, 100)
    );
    if (portrait.complete && portrait.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x - 34, y - 1 + breath, 17, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(portrait, 12, 10, 76, 76, x - 51, y - 18 + breath, 34, 34);
      ctx.restore();
    }

    ctx.strokeStyle = '#3f2a22';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 39, y - 2 + breath);
    ctx.quadraticCurveTo(x - 36, y + 1 + breath, x - 33, y - 2 + breath);
    ctx.moveTo(x - 29, y - 2 + breath);
    ctx.quadraticCurveTo(x - 26, y + 1 + breath, x - 23, y - 2 + breath);
    ctx.stroke();

    ctx.fillStyle = 'rgba(254, 252, 232, 0.92)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(player.name || '村民', x, y + 42);

    const bubblePhase = (now * 0.00055 + x * 0.01) % 1;
    ctx.globalAlpha = 1 - bubblePhase;
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Zzz', x + 39, y - 18 - bubblePhase * 25);
    ctx.restore();
  }

  drawPassOutCharacter(ctx, player, x, y, animation) {
    ctx.save();
    const currentTime = Date.now();
    const progress = Math.max(0, Math.min(1, (currentTime - animation.startedAt) / (animation.expiresAt - animation.startedAt)));
    const bob = Math.sin(currentTime * 0.018) * 2;
    const travel = progress * 70;
    const alpha = progress > 0.82 ? 1 - (progress - 0.82) / 0.18 : 1;
    ctx.globalAlpha = alpha;
    ctx.translate(x + travel, y + bob);

    ctx.fillStyle = 'rgba(42, 24, 12, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 24, 66, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8b5a2b';
    roundRectPath(ctx, -62, 4, 124, 9, 4);
    ctx.fill();
    ctx.strokeStyle = '#5b371b';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (const helperX of [-48, 48]) {
      ctx.fillStyle = '#256d55';
      roundRectPath(ctx, helperX - 10, -14, 20, 33, 8);
      ctx.fill();
      ctx.fillStyle = '#f2c7a5';
      ctx.beginPath();
      ctx.arc(helperX, -22, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5b371b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = '#f2c7a5';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(helperX + (helperX < 0 ? 8 : -8), -7);
      ctx.lineTo(helperX < 0 ? -31 : 31, 7);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(0, 1);
    ctx.rotate(-0.35);
    const avatar = getCachedAvatarImage(
      `passout_chibi_${player.id}_${JSON.stringify(player.avatarConfig || {})}`,
      renderChibiPlayerSVG(player.avatarConfig, 0)
    );
    if (avatar.complete && avatar.naturalWidth > 0) {
      ctx.drawImage(avatar, -23, -38, 46, 56);
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(120, 53, 15, 0.94)';
    roundRectPath(ctx, -101, -68, 202, 25, 12);
    ctx.fill();
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fffbeb';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💫 凌晨 02:00 體力耗盡！', 0, -55.5);
    ctx.restore();
  }

  drawAtmosphere(ctx, now) {
    const mins = this.getDisplayMinutes();
    const sky = getSkyLightingForMinutes(mins);

    if (this.village.season === 'spring') {
      ctx.fillStyle = 'rgba(251, 207, 232, 0.85)';
      const t = now * 0.04;
      for (let i = 0; i < 18; i++) {
        const px = (i * 89 + Math.sin(t * 0.04 + i) * 35 + t * 0.6) % MAP_W;
        const py = (i * 67 + t) % MAP_H;
        ctx.beginPath();
        ctx.ellipse(px, py, 4, 2.5, t * 0.03 + i, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = sky.rgba;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    if (mins >= 1110) {
      const fireflyFactor = Math.min(1, (mins - 1110) / 60);
      for (let i = 0; i < 16; i++) {
        const fx = (i * 113 + Math.sin(now * 0.0015 + i) * 28) % MAP_W;
        const fy = (i * 79 + Math.cos(now * 0.0012 + i) * 22) % MAP_H;
        const glow = (0.35 + Math.sin(now * 0.006 + i * 2) * 0.35) * fireflyFactor;
        ctx.fillStyle = `rgba(190, 242, 100, ${Math.max(0, glow)})`;
        ctx.beginPath();
        ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const weather = this.village.weather;
    if (['plum_rain', 'thunderstorm', 'typhoon'].includes(weather)) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      const t = now * 0.4;
      for (let i = 0; i < 45; i++) {
        const rx = (i * 73 + t * 0.5) % MAP_W;
        const ry = (i * 53 + t) % MAP_H;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 6, ry + 14);
        ctx.stroke();
      }
    } else if (weather === 'cold_wave') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      const t = now * 0.08;
      for (let i = 0; i < 35; i++) {
        const sx = (i * 97 + Math.sin(t * 0.05 + i) * 20) % MAP_W;
        const sy = (i * 61 + t) % MAP_H;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export const worldMap = new WorldMapController();