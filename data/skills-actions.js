// 七大生活技能 Lv.1-10 解鎖表、各地點行動與 DC 難度
// data/skills-actions.js

// 升級所需經驗值表 (Lv.1 -> Lv.10)
export const SKILL_XP_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];
export const PERSONAL_XP_THRESHOLDS = [0, 150, 350, 600, 900, 1300, 1800, 2400, 3100, 4000];

// 七大生活技能定義與解鎖說明
export const LIFE_SKILLS = {
  farming: {
    id: 'farming',
    name: '農耕',
    icon: '🌾',
    stat: 'physique',
    unlocks: {
      1: '可種植小白菜、地瓜葉、三星蔥；開墾荒廢農地',
      2: '解鎖牛番茄、水稻、台農地瓜',
      4: '解鎖愛文芒果、大西瓜、金鑽鳳梨、高麗菜、白蘿蔔；可建造簡易灑水器',
      7: '解鎖高山茶樹、大湖草莓、麻豆文旦；可建造溫室大棚'
    }
  },
  ranching: {
    id: 'ranching',
    name: '畜牧',
    icon: '🐄',
    stat: 'charisma',
    unlocks: {
      1: '可飼養台灣土雞（產雞蛋）、菜鴨（產鴨蛋）',
      4: '可飼養乳牛（產鮮奶）；解鎖動物按摩刷（大幅提升親密度）',
      7: '可飼養綿羊（產羊毛）、台灣水鹿（採收鹿茸）；解鎖自動餵食槽'
    }
  },
  fishing: {
    id: 'fishing',
    name: '釣魚',
    icon: '🎣',
    stat: 'perception',
    unlocks: {
      1: '可釣起溪哥、台灣鯛、虱目魚；漁夫可自製蚯蚓餌',
      3: '夜間可釣起夜光小管',
      4: '可釣起龍虎石斑、白帶魚、紅蟳；黃昏可遇見夕陽赤鯮與晚霞花枝；漁夫可自製南極蝦餌',
      5: '夜間可釣起月光白帶魚',
      7: '可釣起黑鮪魚、野生大龍蝦、傳說櫻花鉤吻鮭；漁夫可自製發光路亞餌',
      9: '深夜可挑戰傳說魚王「星斑龍膽石斑」'
    }
  },
  foraging: {
    id: 'foraging',
    name: '採集',
    icon: '🪓',
    stat: 'physique',
    unlocks: {
      1: '海邊趕海（海帶芽、奇怪的石頭）、砍相思木、採山蘇、敲碎石與銅礦',
      3: '夜間可在潮間帶撿到夜光蠑螺',
      4: '砍伐台灣檜木、採深山香菇與夜間螢光仙草葉、挖掘鐵礦與混濁的原石',
      7: '採集極品牛樟芝與月華紫靈芝、挖掘金礦、深山秘境尋寶'
    }
  },
  cooking: {
    id: 'cooking',
    name: '烹飪與釀造',
    icon: '🍲',
    stat: 'knowledge',
    unlocks: {
      1: '解鎖老湯（海帶芽蛋花湯）、蔥蛋、番茄炒蛋、炒青菜、地瓜稀飯、青草茶',
      4: '解鎖小管麵線、炭烤夜光小管、炸雞排、香菇雞湯、排骨湯、魚湯、滷肉飯、鳳梨酥',
      5: '解鎖香煎月光白帶魚',
      6: '解鎖五味晚霞花枝',
      7: '解鎖珍珠奶茶、薑母鴨、香煎牛排、迷迭香羊排、厚切豬排、牛樟芝補湯',
      8: '解鎖螢光仙草靈芝茶',
      9: '解鎖清蒸星斑龍膽石斑'
    }
  },
  smithing: {
    id: 'smithing',
    name: '鍛造與珠寶鑑定',
    icon: '⚒️',
    stat: 'knowledge',
    unlocks: {
      1: '每日免費幫隊友打磨保養工具、熔煉銅錠、鑑定奇怪的石頭與初階原石',
      4: '熔煉鐵錠、升級全村工具至鋼鐵級、鑑定貓眼石與台灣藍寶',
      7: '熔煉純金金錠、升級全村工具至鑽石級、鍛造傳奇飾品'
    }
  },
  commerce: {
    id: 'commerce',
    name: '商業交涉',
    icon: '💰',
    stat: 'charisma',
    unlocks: {
      1: '向村莊村民議價高價出售物資、雜貨店採買折扣',
      4: '議價大成功時觸發「整批溢價收購」、行腳商人特殊交易',
      7: '向村民買賣享有最高議價加成與批發優惠'
    }
  }
};

// 台灣特色天氣系統
export const WEATHER_TYPES = {
  sunny: {
    id: 'sunny',
    name: '晴朗好天氣',
    icon: '☀️',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    weight: 45,
    desc: '風和日麗，適合全村出動工作！',
    staminaMod: 0,
    dcMod: 0
  },
  cloudy: {
    id: 'cloudy',
    name: '陰天微風',
    icon: '⛅',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    weight: 25,
    desc: '氣候涼爽舒適，戶外行動體力消耗 -1。',
    staminaMod: -1,
    dcMod: 0
  },
  plum_rain: {
    id: 'plum_rain',
    name: '綿綿細雨',
    icon: '🌧️',
    seasons: ['spring', 'summer', 'autumn'],
    weight: 18,
    desc: '全村農田已自動澆水！但戶外採集與挖礦地面濕滑（DC +1）。',
    autoWater: true,
    staminaMod: 0,
    dcMod: 1
  },
  thunderstorm: {
    id: 'thunderstorm',
    name: '午後雷陣雨',
    icon: '⛈️',
    seasons: ['summer'],
    weight: 15,
    desc: '農田自動澆水；14:00 後海邊大魚活躍，但深山挖礦小心打雷！',
    autoWater: true,
    staminaMod: 0,
    dcMod: 0
  },
  typhoon_warning: {
    id: 'typhoon_warning',
    name: '颱風警報（明日襲來）',
    icon: '🌀',
    seasons: ['summer', 'autumn'],
    weight: 7,
    desc: '氣象局發布警報！明天颱風登陸將無法出海與進山，請趕快搶收成熟作物！',
    staminaMod: 0,
    dcMod: 0
  },
  typhoon: {
    id: 'typhoon',
    name: '狂風暴雨（颱風天）',
    icon: '🌪️',
    seasons: [], // 僅由前一天的 typhoon_warning 觸發
    weight: 0,
    desc: '狂風暴雨！農田自動澆水，海邊與深山暫時封閉。',
    autoWater: true,
    lockOutdoor: true,
    staminaMod: 0,
    dcMod: 0
  },
  cold_wave: {
    id: 'cold_wave',
    name: '強烈寒流來襲',
    icon: '🥶',
    seasons: ['winter'],
    weight: 15,
    desc: '氣溫驟降，戶外體力消耗 +2！睡前若沒吃熱湯或進補料理，隔天會小感冒。',
    staminaMod: 2,
    dcMod: 0
  }
};

// 各地點定義
export const LOCATIONS = {
  farm: {
    id: 'farm',
    name: '農場農田',
    icon: '🌾',
    bgGradient: 'from-emerald-100 to-lime-50',
    desc: '全村賴以為生的肥沃土地，旁邊還有幾塊等著開墾的荒地。'
  },
  ranch: {
    id: 'ranch',
    name: '牧場畜舍',
    icon: '🐄',
    bgGradient: 'from-amber-100 to-yellow-50',
    desc: '雞鴨成群、牛羊悠閒吃草的溫馨牧場，記得每天來餵飼料與摸摸牠們。'
  },
  town: {
    id: 'town',
    name: '村莊廣場',
    icon: '🏘️',
    bgGradient: 'from-orange-100 to-amber-50',
    desc: '熱鬧的小鎮中心，雜貨店、布告欄、鐵匠爐、村莊廚房與刮刮樂攤位都在這裡！'
  },
  beach: {
    id: 'beach',
    name: '海邊漁港',
    icon: '🎣',
    bgGradient: 'from-sky-100 to-cyan-50',
    desc: '海風徐徐的漁港與潮間帶，白天可釣魚與撿海帶芽，夜晚有機會抓到新鮮小管！'
  },
  house_interior: {
    id: 'house_interior',
    name: '家族農舍',
    icon: '🏡',
    bgGradient: 'from-amber-100 to-orange-50',
    desc: '家人共用的溫暖農舍，有床鋪、衣櫃與家族圍爐餐桌。'
  },
  coral_island: {
    id: 'coral_island',
    name: '珊瑚礁離島',
    icon: '🏝️',
    bgGradient: 'from-cyan-100 to-teal-50',
    desc: '搭乘修復完成的遠洋漁船前往，探索石陣、礁岩與深水漁場。'
  },
  mountain: {
    id: 'mountain',
    name: '深山林地與礦坑',
    icon: '⛰️',
    bgGradient: 'from-stone-200 to-emerald-50',
    desc: '蘊藏豐富木材、野生香菇與神秘礦脈的山林，採集者還能在草叢裡翻找寶物。'
  }
};

// 各地點可執行的行動清單
export const LOCATION_ACTIONS = {
  farm: [
    { id: 'tend_crops', name: '照料農田（耕作/澆水/採收）', icon: '🌱', stamina: 8, minutes: 30, skill: 'farming', stat: 'physique', dc: 8, xp: 25, isOutdoor: true },
    { id: 'clear_land', name: '開墾荒廢農地（擴充田地）', icon: '⛏️', stamina: 15, minutes: 60, skill: 'farming', stat: 'physique', dc: 12, xp: 40, isOutdoor: true }
  ],
  ranch: [
    { id: 'care_animals', name: '餵食與安撫動物（收集畜產）', icon: '🥚', stamina: 8, minutes: 30, skill: 'ranching', stat: 'charisma', dc: 10, xp: 25, isOutdoor: false }
  ],
  town: [
    { id: 'open_kitchen', name: '使用村莊大廚房（烹飪料理）', icon: '🍲', stamina: 6, minutes: 30, skill: 'cooking', stat: 'knowledge', dc: 10, xp: 30, isOutdoor: false },
    { id: 'appraise_ore', name: '鑑定原石與怪石', icon: '🔮', stamina: 8, minutes: 30, skill: 'smithing', stat: 'knowledge', dc: 11, xp: 35, isOutdoor: false },
    { id: 'smelt_ore', name: '熔煉金屬礦錠', icon: '🔥', stamina: 10, minutes: 40, skill: 'smithing', stat: 'knowledge', dc: 10, xp: 30, isOutdoor: false },
    { id: 'sharpen_tools', name: '打磨保養全村工具（每日一次）', icon: '✨', stamina: 10, minutes: 30, skill: 'smithing', stat: 'knowledge', dc: 10, xp: 35, isOutdoor: false }
  ],
  beach: [
    { id: 'go_fishing', name: '港邊拋竿釣魚', icon: '🎣', stamina: 10, minutes: 40, skill: 'fishing', stat: 'perception', dc: 10, xp: 30, isOutdoor: true },
    { id: 'beach_combing', name: '潮間帶趕海（採海帶芽/撿怪石）', icon: '🦀', stamina: 8, minutes: 30, skill: 'foraging', stat: 'perception', dc: 8, xp: 25, isOutdoor: true }
  ],
  mountain: [
    { id: 'chop_wood', name: '山林伐木與採菇', icon: '🪓', stamina: 10, minutes: 40, skill: 'foraging', stat: 'physique', dc: 9, xp: 28, isOutdoor: true },
    { id: 'mine_ore', name: '深入礦坑挖礦（含原石）', icon: '⛏️', stamina: 12, minutes: 45, skill: 'foraging', stat: 'physique', dc: 11, xp: 32, isOutdoor: true },
    { id: 'bush_treasure', name: '草叢尋寶（採集者專屬直覺）', icon: '🌿', stamina: 10, minutes: 30, skill: 'foraging', stat: 'perception', dc: 11, xp: 35, isOutdoor: true, classOnly: 'forager' }
  ]
};

// 釣魚掉落池（依技能等級、時段、魚餌權重抽取）
export const FISHING_POOL = [
  { itemId: 'chub', minSkill: 1, weight: 35, dc: 9 },
  { itemId: 'tilapia', minSkill: 1, weight: 30, dc: 10 },
  { itemId: 'milkfish', minSkill: 2, weight: 25, dc: 11 },
  { itemId: 'squid', minSkill: 1, weight: 20, dc: 11, nightBonusWeight: 35 }, // 18:00 後出現率大增
  { itemId: 'strange_stone', minSkill: 1, weight: 10, dc: 10 },
  { itemId: 'hairtail', minSkill: 4, weight: 20, dc: 13 },
  { itemId: 'grouper', minSkill: 4, weight: 18, dc: 13 },
  { itemId: 'sunset_bream', minSkill: 4, weight: 13, dc: 14, timeWindow: 'dusk' },
  { itemId: 'dusk_cuttlefish', minSkill: 4, weight: 12, dc: 14, timeWindow: 'dusk' },
  { itemId: 'night_squid', minSkill: 3, weight: 16, dc: 13, timeWindow: 'night' },
  { itemId: 'moon_ribbonfish', minSkill: 5, weight: 10, dc: 15, timeWindow: 'night' },
  { itemId: 'mud_crab', minSkill: 5, weight: 15, dc: 14, seasonBonus: 'autumn' },
  { itemId: 'lobster', minSkill: 7, weight: 10, dc: 16 },
  { itemId: 'bluefin_tuna', minSkill: 8, weight: 8, dc: 17 },
  { itemId: 'formosan_salmon', minSkill: 9, weight: 4, dc: 18 },
  { itemId: 'starlight_grouper', minSkill: 9, weight: 3, dc: 19, timeWindow: 'night' }
];

// 採集掉落池
export const FORAGING_POOLS = {
  beach_combing: [
    { itemId: 'wakame', minSkill: 1, weight: 55 },
    { itemId: 'strange_stone', minSkill: 1, weight: 25 },
    { itemId: 'squid', minSkill: 1, weight: 15, nightBonusWeight: 30 },
    { itemId: 'mud_crab', minSkill: 4, weight: 10 },
    { itemId: 'glowing_conch', minSkill: 3, weight: 14, timeWindow: 'night' }
  ],
  chop_wood: [
    { itemId: 'acacia_wood', minSkill: 1, weight: 55 },
    { itemId: 'birds_nest_fern', minSkill: 1, weight: 25 },
    { itemId: 'wild_mushroom', minSkill: 3, weight: 20 },
    { itemId: 'hinoki_wood', minSkill: 4, weight: 18 },
    { itemId: 'antrodia', minSkill: 7, weight: 6 },
    { itemId: 'firefly_herb', minSkill: 4, weight: 14, timeWindow: 'night' },
    { itemId: 'moon_reishi', minSkill: 7, weight: 7, timeWindow: 'night' }
  ],
  mine_ore: [
    { itemId: 'stone', minSkill: 1, weight: 45 },
    { itemId: 'copper_ore', minSkill: 1, weight: 35 },
    { itemId: 'rough_ore_gem', minSkill: 1, weight: 15 },
    { itemId: 'iron_ore', minSkill: 4, weight: 25 },
    { itemId: 'gold_ore', minSkill: 7, weight: 12 }
  ]
};

// 原石與怪石鑑定結果池
export const APPRAISAL_POOL = {
  strange_stone: [
    { itemId: 'stone', weight: 30, label: '只是顆普通的鵝卵石' },
    { itemId: 'copper_ore', weight: 30, label: '裡面包著閃亮的銅礦！' },
    { itemId: 'agate', weight: 25, label: '磨開後竟然是溫潤的紅紋瑪瑙！' },
    { itemId: 'white_quartz', weight: 15, label: '裡面藏著晶瑩剔透的白水晶！' }
  ],
  rough_ore_gem: [
    { itemId: 'agate', weight: 30, label: '鑑定出漂亮的紅紋瑪瑙！' },
    { itemId: 'white_quartz', weight: 30, label: '鑑定出通透白水晶！' },
    { itemId: 'cats_eye', weight: 25, label: '光芒流轉！是稀有的貓眼石！' },
    { itemId: 'taiwan_blue_sapphire', weight: 15, label: '全村轟動！竟然開出了頂級台灣藍寶！' }
  ]
};

// 牧場動物類型定義
export const ANIMAL_TYPES = {
  chicken: { id: 'chicken', name: '台灣土雞', icon: '🐔', buyPrice: 200, skillReq: 1, productId: 'egg', prodDays: 1 },
  duck: { id: 'duck', name: '菜鴨', icon: '🦆', buyPrice: 280, skillReq: 2, productId: 'duck_egg', prodDays: 1 },
  cow: { id: 'cow', name: '乳牛', icon: '🐄', buyPrice: 650, skillReq: 4, productId: 'milk', prodDays: 2 },
  sheep: { id: 'sheep', name: '綿羊', icon: '🐑', buyPrice: 900, skillReq: 7, productId: 'wool', prodDays: 3 },
  deer: { id: 'deer', name: '台灣水鹿', icon: '🦌', buyPrice: 1400, skillReq: 8, productId: 'deer_antler', prodDays: 4 }
};

// 每日刮刮樂獎勵表（每人每天限一張，花費 100 元）
export const SCRATCH_CARD_COST = 100;
export const SCRATCH_REWARDS = [
  { minRoll: 1, maxRoll: 1, label: '銘謝惠顧（獲得空氣一包）', money: 0, itemId: null, count: 0, broadcast: true },
  { minRoll: 2, maxRoll: 7, label: '安慰獎：現金 100 元（剛好回本！）', money: 100, itemId: null, count: 0, broadcast: false },
  { minRoll: 8, maxRoll: 13, label: '小確幸：現金 150 元 ＋ 調味料組', money: 150, itemId: 'seasoning', count: 2, broadcast: false },
  { minRoll: 14, maxRoll: 17, label: '三獎：現金 400 元 ＋ 混濁的原石', money: 400, itemId: 'rough_ore_gem', count: 1, broadcast: false },
  { minRoll: 18, maxRoll: 19, label: '二獎：現金 1,200 元 ＋ 新鮮小管 x2', money: 1200, itemId: 'squid', count: 2, broadcast: true },
  { minRoll: 20, maxRoll: 20, label: '🧧 大紅包頭獎！現金 5,000 元 ＋ 頂級台灣藍寶！', money: 5000, itemId: 'taiwan_blue_sapphire', count: 1, broadcast: true }
];