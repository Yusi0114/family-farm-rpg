// 七大職業、四大能力加成、特性清單
// data/classes-traits.js

export const GAME_CONSTANTS = {
  DAYS_PER_SEASON: 14,
  SEASONS: [
    { id: 'spring', name: '春', icon: '🌸', desc: '暖濕回春，葉菜與茶葉生長旺盛' },
    { id: 'summer', name: '夏', icon: '☀️', desc: '炎熱盛夏，白天戶外體力消耗 +1，夜晚海邊活躍' },
    { id: 'autumn', name: '秋', icon: '🍁', desc: '秋高氣爽，農牧產品高品質機率提升' },
    { id: 'winter', name: '冬', icon: '❄️', desc: '濕冷進補，戶外體力消耗 +1，熱湯與進補料理效果翻倍' }
  ],
  BASE_STAMINA: 80,
  STAMINA_PER_PHYSIQUE: 10,
  STARTING_FREE_STAT_POINTS: 4,
  MAX_STARTING_STAT: 2,
  BASE_BACKPACK_SLOTS: 12,
  MAIN_CLASS_CHECK_BONUS: 2,
  MAIN_CLASS_XP_RATE: 1.0,
  CROSS_CLASS_XP_RATE: 0.5,
  // 啟動資金：基礎 400 元 + 每位成員 300 元
  calcStartingMoney: (playerCount) => 400 + Math.max(1, playerCount) * 300
};

export const STATS = {
  physique: {
    id: 'physique',
    name: '體魄',
    icon: '💪',
    desc: '影響農耕、伐木挖礦檢定，每點增加 10 點每日體力上限'
  },
  knowledge: {
    id: 'knowledge',
    name: '知識',
    icon: '📖',
    desc: '影響烹飪釀造、鍛造與原石鑑定檢定，提升成品品質'
  },
  perception: {
    id: 'perception',
    name: '感知',
    icon: '👁️',
    desc: '影響釣魚、海邊趕海與草叢尋寶檢定，提升稀有物發現率'
  },
  charisma: {
    id: 'charisma',
    name: '魅力',
    icon: '✨',
    desc: '影響畜牧照顧與商人議價交涉檢定，提高委託額外報酬'
  }
};

export const CLASSES = {
  farmer: {
    id: 'farmer',
    name: '農夫',
    icon: '🌾',
    primaryStat: 'physique',
    relatedSkill: 'farming',
    checkBonus: 2,
    startingItem: { itemId: 'stone_hoe', count: 1 },
    passiveId: 'green_thumb',
    passiveName: '土地眷顧',
    passiveDesc: '農耕檢定 +2；耕種時有 25% 機率不消耗體力，作物高品質機率提升'
  },
  shepherd: {
    id: 'shepherd',
    name: '牧羊人',
    icon: '🐑',
    primaryStat: 'charisma',
    relatedSkill: 'ranching',
    checkBonus: 2,
    startingItem: { itemId: 'egg', count: 3 },
    passiveId: 'animal_whisperer',
    passiveName: '動物之友',
    passiveDesc: '畜牧檢定 +2；照顧動物親密度雙倍成長，動物產出高品質機率提升'
  },
  fisher: {
    id: 'fisher',
    name: '漁夫',
    icon: '🎣',
    primaryStat: 'perception',
    relatedSkill: 'fishing',
    checkBonus: 2,
    startingItem: { itemId: 'fishing_rod', count: 1 },
    passiveId: 'tide_reader',
    passiveName: '潮汐直覺',
    passiveDesc: '釣魚檢定 +2；稀有魚機率提升、可預覽水域魚種機率，且可自行製作魚餌'
  },
  forager: {
    id: 'forager',
    name: '採集者',
    icon: '🪓',
    primaryStat: 'physique',
    relatedSkill: 'foraging',
    checkBonus: 2,
    startingItem: { itemId: 'stone_axe', count: 1 },
    passiveId: 'bush_scavenger',
    passiveName: '山海尋寶人',
    passiveDesc: '採集檢定 +2；伐木與挖礦材料產量 +1，解鎖專屬「草叢尋寶」行動'
  },
  chef: {
    id: 'chef',
    name: '廚師 / 釀造師',
    icon: '🍳',
    primaryStat: 'knowledge',
    relatedSkill: 'cooking',
    checkBonus: 2,
    startingItem: { itemId: 'seasoning', count: 5 },
    passiveId: 'hearty_cooking',
    passiveName: '總鋪師手藝',
    passiveDesc: '烹飪釀造檢定 +2；料理回復體力 +25%，製作時有 25% 機率額外多產出一份'
  },
  blacksmith: {
    id: 'blacksmith',
    name: '鐵匠 / 珠寶匠',
    icon: '⚒️',
    primaryStat: 'knowledge',
    relatedSkill: 'smithing',
    checkBonus: 2,
    startingItem: { itemId: 'stone_pickaxe', count: 1 },
    passiveId: 'gem_appraiser',
    passiveName: '匠魂與慧眼',
    passiveDesc: '鍛造與鑑定檢定 +2；鑑定出高價寶石機率提升，可每日幫全村打磨保養工具'
  },
  merchant: {
    id: 'merchant',
    name: '商人',
    icon: '💰',
    primaryStat: 'charisma',
    relatedSkill: 'commerce',
    checkBonus: 2,
    startingItem: { itemId: 'fancy_ledger', count: 1 },
    passiveId: 'silver_tongue',
    passiveName: '生財有道',
    passiveDesc: '商業交涉檢定 +2；向村民賣貨更容易高價成交，雜貨店採買享 85 折，每日可打聽行情'
  }
};

export const TRAITS = {
  model_student: {
    id: 'model_student',
    name: '模範生',
    icon: '🎓',
    desc: '個人等級經驗值獲取效率 +25%（更快獲得自由能力點）'
  },
  work_master: {
    id: 'work_master',
    name: '工作達人',
    icon: '🔥',
    desc: '所有生活技能（含本職與跨職學習）的經驗獲取效率 +25%'
  },
  workaholic: {
    id: 'workaholic',
    name: '工作狂',
    icon: '⚡',
    desc: '體力歸零後仍可「透支體力」繼續工作，但檢定會受到 -3 疲勞減值（小心超過 00:00 晚睡）'
  },
  miser: {
    id: 'miser',
    name: '小氣鬼',
    icon: '🎒',
    desc: '隨身背包容量永久 +6 格（外出採集、釣魚不易滿包）'
  },
  popular: {
    id: 'popular',
    name: '人氣王',
    icon: '🌻',
    desc: '每天首次與村民聊天時，必定獲得一份隨機實用小禮物'
  }
};