// 6 位村民對話、季節委託模板、布告欄小委託題庫
// data/npcs-quests.js

// 六位台灣小鎮 NPC
export const NPCS = {
  grandma_chen: {
    id: 'grandma_chen',
    name: '陳阿嬤',
    title: '雜貨店老闆娘',
    icon: '👵',
    badgeBg: 'bg-amber-200',
    roleDesc: '販售種子、調味料、麵線、珍珠、生肉排與每日刮刮樂',
    favoriteItems: ['old_soup', 'scallion_egg', 'sweet_potato_porridge', 'bok_choy', 'sweet_potato_leaves'],
    favoriteCategories: ['crop'],
    popularGifts: [
      { itemId: 'seasoning', count: 2, text: '阿嬤塞給你兩包調味料：「拿去煮老湯給大家喝！」' },
      { itemId: 'seed_bok_choy', count: 2, text: '阿嬤笑眯眯地給你兩包小白菜種子：「加減種喔！」' },
      { itemId: 'egg', count: 2, text: '阿嬤偷偷塞給你兩顆自家母雞下的土雞蛋！' }
    ],
    greetings: [
      '「早安呀！今天精神真不錯，要一起出門忙農活嗎？」',
      '「呷飽未？今天田裡收成好不好啊？」',
      '「要買鹽巴、醬油還是麵線？阿嬤算你們便宜一點啦！」',
      '「過年到了，要不要來刮一張刮刮樂試試手氣？」'
    ]
  },
  captain_hai: {
    id: 'captain_hai',
    name: '海伯',
    title: '漁港老船長',
    icon: '⚓',
    badgeBg: 'bg-sky-200',
    roleDesc: '高價收購新鮮魚類與海產，販售各類魚餌',
    favoriteItems: ['grouper', 'bluefin_tuna', 'mud_crab', 'squid_vermicelli', 'lobster'],
    favoriteCategories: ['fish'],
    popularGifts: [
      { itemId: 'worm_bait', count: 3, text: '海伯豪爽地分你三份蚯蚓餌：「去港邊大顯身手吧！」' },
      { itemId: 'wakame', count: 2, text: '海伯把剛曬好的新鮮海帶芽送給你！' },
      { itemId: 'strange_stone', count: 1, text: '海伯神秘兮兮地遞給你一顆從漁網裡撈到的奇怪石頭！' }
    ],
    greetings: [
      '「今天海象不錯，晚上退潮時海邊小管應該不少喔！」',
      '「釣魚講究的是耐心跟感知，別急著拉竿！」'
    ]
  },
  boss_lin: {
    id: 'boss_lin',
    name: '林老闆',
    title: '山產珠寶商',
    icon: '🧐',
    badgeBg: 'bg-purple-200',
    roleDesc: '高價收購木材、礦錠、草藥與鑑定後的寶石',
    favoriteItems: ['taiwan_blue_sapphire', 'cats_eye', 'agate', 'antrodia', 'grilled_steak', 'fried_chicken_cutlet'],
    favoriteCategories: ['forage_ore'],
    popularGifts: [
      { itemId: 'copper_ore', count: 2, text: '林老闆隨手送你兩塊成色不錯的銅礦石！' },
      { itemId: 'rough_ore_gem', count: 1, text: '林老闆：「這顆原石我看你順眼，送你拿去給鐵匠磨磨看！」' }
    ],
    greetings: [
      '「挖到原石千萬別當普通石頭丟掉，找鐵匠鑑定過身價翻十倍！」',
      '「最近山裡濕氣重，聽說深山老樹上長出了珍貴的牛樟芝。」'
    ]
  },
  vet_fang: {
    id: 'vet_fang',
    name: '小芳姊',
    title: '牧場獸醫',
    icon: '🩺',
    badgeBg: 'bg-pink-200',
    roleDesc: '販售雞、鴨、牛、羊、水鹿幼崽與基礎飼料',
    favoriteItems: ['milk', 'wool', 'pineapple_cake', 'bubble_milk_tea', 'strawberry'],
    favoriteCategories: ['ranch'],
    popularGifts: [
      { itemId: 'basic_feed', count: 3, text: '小芳姊笑著遞給你三包特製牧場飼料！' },
      { itemId: 'milk', count: 1, text: '小芳姊送你一瓶剛擠好的濃醇鮮奶補充體力！' }
    ],
    greetings: [
      '「動物跟人一樣，每天餵飽、陪牠們講講話，產出來的蛋跟奶品質才會好喔！」',
      '「天氣冷的時候別忘了去牧場看看牠們有沒有著涼。」'
    ]
  },
  mayor_wang: {
    id: 'mayor_wang',
    name: '王村長',
    title: '小鎮大家長',
    icon: '🎖️',
    badgeBg: 'bg-emerald-200',
    roleDesc: '發布「季節全村委託」（完成後全體永久加能力點）',
    favoriteItems: ['spring_tea', 'pomelo', 'daikon_rib_soup', 'mushroom_chicken_soup', 'ginger_duck'],
    favoriteCategories: ['cooking'],
    popularGifts: [
      { itemId: 'herbal_tea', count: 1, text: '王村長：「辛苦啦！這杯青草茶拿去解解渴！」' },
      { itemId: 'stone', count: 5, text: '王村長把村公所多餘的建材碎石交給你拿去修繕農場。' }
    ],
    greetings: [
      '「早安！一早就看到你這麼有幹勁，村子交給你們真是太放心了！」',
      '「全家人齊心協力把農場經營起來，咱們村子越來越熱鬧了！」',
      '「布告欄跟季節委託就拜託大家啦，完成後全村人都能一起變強！」'
    ]
  },
  peddler_cai: {
    id: 'peddler_cai',
    name: '行腳商人阿財',
    title: '神秘巡迴商隊',
    icon: '🎒',
    badgeBg: 'bg-indigo-200',
    appearDays: [7, 14], // 每季第 7、14 天出現
    roleDesc: '每季第 7、14 天現身！高價收購頂級成品並販售稀有物資',
    favoriteItems: ['taiwan_blue_sapphire', 'antrodia_tonic', 'formosan_salmon', 'bubble_milk_tea', 'deer_antler'],
    favoriteCategories: ['cooking', 'forage_ore', 'fish'],
    popularGifts: [
      { itemId: 'shrimp_bait', count: 2, text: '阿財眨眨眼，送你兩份外地帶來的南極蝦餌！' },
      { itemId: 'rough_ore_gem', count: 1, text: '阿財：「見面就是有緣，這顆原石算我贊助你們的！」' }
    ],
    greetings: [
      '「嘿嘿，我阿財只在每季第 7 天跟第 14 天經過這裡，有好貨快拿出來交易！」',
      '「不管什麼頂級料理或寶石，我這裡開的價錢絕對比市集公道！」'
    ]
  }
};

// 四季全村委託（數量會依「近 3 日在線人數」動態乘算，完成後全體成員含離線者永久 +1 能力點）
export const SEASONAL_QUESTS = {
  spring: {
    id: 'sq_spring_lighthouse',
    season: 'spring',
    title: '春季全村委託：修復海邊老燈塔',
    desc: '老燈塔的線路與鏡座年久失修，全村一起湊齊建材與熱湯慰勞工程，指引漁船安全返航！',
    // perPlayerCount 會乘上近3日活躍人數（最少算 1 人）
    requirements: [
      { itemId: 'acacia_wood', perPlayerCount: 4, minCount: 6 },
      { itemId: 'copper_bar', perPlayerCount: 1, minCount: 2 },
      { itemId: 'old_soup', perPlayerCount: 1, minCount: 2 }
    ],
    finalCheck: { stat: 'physique', skill: 'smithing', dc: 12, label: '組裝燈塔鏡座檢定' },
    rewardStat: 'physique',
    rewardStatName: '體魄',
    // 第 11 天若還沒湊齊，村民上門保底交換
    rescueBarter: {
      npcId: 'captain_hai',
      dialogue: '「我看你們還在忙著湊修燈塔的銅錠吧？我船艙裡剛好有兩塊備用銅錠，你們拿 8 根相思木跟 1 碗老湯來跟我換！」',
      giveItemId: 'copper_bar',
      giveCount: 2,
      costItems: [{ itemId: 'acacia_wood', count: 8 }, { itemId: 'old_soup', count: 1 }]
    }
  },
  summer: {
    id: 'sq_summer_typhoon_wall',
    season: 'summer',
    title: '夏季全村委託：加固溪邊防颱堤防',
    desc: '夏日午後雷雨頻繁，全村必須趕在季節結束前加固堤防，並準備小管麵線給巡守隊補充體力！',
    requirements: [
      { itemId: 'stone', perPlayerCount: 5, minCount: 8 },
      { itemId: 'watermelon', perPlayerCount: 1, minCount: 2 },
      { itemId: 'squid_vermicelli', perPlayerCount: 1, minCount: 2 }
    ],
    finalCheck: { stat: 'perception', skill: 'foraging', dc: 13, label: '勘查堤防滲水點檢定' },
    rewardStat: 'perception',
    rewardStatName: '感知',
    rescueBarter: {
      npcId: 'grandma_chen',
      dialogue: '「聽說你們還缺新鮮小管煮麵線？阿嬤冰庫剛好有留兩尾，拿 10 顆碎石跟 2 份炒青菜來換吧！」',
      giveItemId: 'squid',
      giveCount: 2,
      costItems: [{ itemId: 'stone', count: 10 }, { itemId: 'stir_fried_veggies', count: 2 }]
    }
  },
  autumn: {
    id: 'sq_autumn_feast',
    season: 'autumn',
    title: '秋季全村委託：籌辦中秋豐收流水席',
    desc: '秋高氣爽豐收季！準備一桌澎湃的台灣料理與秋蟹，邀請鄰村商隊前來交流！',
    requirements: [
      { itemId: 'rice', perPlayerCount: 2, minCount: 3 },
      { itemId: 'mud_crab', perPlayerCount: 1, minCount: 2 },
      { itemId: 'mushroom_chicken_soup', perPlayerCount: 1, minCount: 2 }
    ],
    finalCheck: { stat: 'charisma', skill: 'commerce', dc: 14, label: '流水席迎賓交涉檢定' },
    rewardStat: 'charisma',
    rewardStatName: '魅力',
    rescueBarter: {
      npcId: 'captain_hai',
      dialogue: '「秋蟹難抓對吧？海伯籠子裡剛好抓到兩隻肥紅蟳，拿 4 條溪哥或台灣鯛再貼 200 元公款就讓給你們！」',
      giveItemId: 'mud_crab',
      giveCount: 2,
      costItems: [{ itemId: 'tilapia', count: 3 }],
      costMoney: 200
    }
  },
  winter: {
    id: 'sq_winter_banquet',
    season: 'winter',
    title: '冬季全村委託：除夕圍爐暖冬大團圓',
    desc: '歲末寒冬迎新年！全村齊心準備暖呼呼的蘿蔔排骨湯、時蔬與精緻礦石工藝品共度除夕！',
    requirements: [
      { itemId: 'daikon_rib_soup', perPlayerCount: 1, minCount: 2 },
      { itemId: 'cabbage', perPlayerCount: 2, minCount: 3 },
      { itemId: 'agate', perPlayerCount: 1, minCount: 1 }
    ],
    finalCheck: { stat: 'knowledge', skill: 'cooking', dc: 14, label: '圍爐總鋪師掌勺檢定' },
    rewardStat: 'knowledge',
    rewardStatName: '知識',
    rescueBarter: {
      npcId: 'boss_lin',
      dialogue: '「聽村長說你們過年圍爐禮盒還差一顆紅紋瑪瑙？我店裡剛好有一顆，拿 15 顆碎石跟 2 碗老湯跟我換吧！」',
      giveItemId: 'agate',
      giveCount: 1,
      costItems: [{ itemId: 'stone', count: 15 }, { itemId: 'old_soup', count: 2 }]
    }
  }
};

// 無時間限制：全村傳奇大工程（供大玩特玩型家人長期累積目標）
export const LEGENDARY_PROJECT = {
  id: 'legendary_crown',
  title: '鎮村傳奇工程：打造「山海傳家冠」',
  desc: '集結全村最高手藝打造象徵風調雨順的傳家寶冠！無時間限制，隨時可分批投入材料。',
  requirements: [
    { itemId: 'taiwan_blue_sapphire', count: 2 },
    { itemId: 'gold_bar', count: 4 },
    { itemId: 'wool', count: 5 },
    { itemId: 'antrodia_tonic', count: 2 }
  ],
  finalCheck: { stat: 'knowledge', skill: 'smithing', dc: 17, label: '傳奇珠寶鑲嵌儀式' },
  rewardDesc: '全村解鎖「豐年祭慶典狀態」（所有人檢定永久 +1）與榮譽稱號！'
};

// 村莊布告欄無期限小委託題庫（支援動態過濾與四種任務型態輪替）
// type: 'delivery'(繳交物資) | 'check'(現場檢定幫忙，免交物資) | 'craft_quality'(加工與料理) | 'errand'(跑腿交涉)
export const BULLETIN_QUEST_POOL = [
  // --- 繳交物資型 (delivery) ---
  {
    id: 'bq_old_soup_craving',
    type: 'delivery',
    title: '阿嬤的古早味解饞',
    npcId: 'grandma_chen',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 1,
    desc: '陳阿嬤突然很懷念海帶芽蛋花湯的滋味，幫她送兩碗過去吧！',
    reqItems: [{ itemId: 'old_soup', count: 2 }],
    reward: { money: 360, villageXp: 40, skill: 'cooking', skillXp: 35 }
  },
  {
    id: 'bq_spring_greens',
    type: 'delivery',
    title: '春日山野時蔬採購',
    npcId: 'grandma_chen',
    seasons: ['spring'],
    minVillageLv: 1,
    desc: '春天到了，雜貨店想進一批新鮮的野生山蘇與小白菜。',
    reqItems: [{ itemId: 'birds_nest_fern', count: 3 }, { itemId: 'bok_choy', count: 3 }],
    reward: { money: 340, villageXp: 35, skill: 'foraging', skillXp: 30, bonusItem: { itemId: 'seed_tomato', count: 2 } }
  },
  {
    id: 'bq_summer_herbal_tea',
    type: 'delivery',
    title: '礦坑消暑救火隊',
    npcId: 'boss_lin',
    seasons: ['summer'],
    minVillageLv: 1,
    desc: '夏天礦坑裡又悶又熱，林老闆想買幾杯青草茶給大家降火氣。',
    reqItems: [{ itemId: 'herbal_tea', count: 3 }],
    reward: { money: 350, villageXp: 40, skill: 'cooking', skillXp: 30, bonusItem: { itemId: 'rough_ore_gem', count: 1 } }
  },
  {
    id: 'bq_night_snack',
    type: 'delivery',
    title: '港邊宵夜邪惡組合',
    npcId: 'captain_hai',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 3,
    desc: '海伯晚上守船嘴饞，點名要吃夜市酥脆炸雞排配手搖珍珠奶茶！',
    reqItems: [{ itemId: 'fried_chicken_cutlet', count: 2 }, { itemId: 'bubble_milk_tea', count: 1 }],
    reward: { money: 880, villageXp: 65, skill: 'cooking', skillXp: 55, bonusItem: { itemId: 'shrimp_bait', count: 2 } }
  },
  {
    id: 'bq_autumn_pomelo',
    type: 'delivery',
    title: '中秋柚子帽大賽',
    npcId: 'mayor_wang',
    seasons: ['autumn'],
    minVillageLv: 4,
    desc: '村公所要舉辦剝柚子大賽，急需幾顆飽滿多汁的麻豆文旦！',
    reqItems: [{ itemId: 'pomelo', count: 3 }],
    reward: { money: 920, villageXp: 70, skill: 'farming', skillXp: 60 }
  },
  {
    id: 'quest_dusk_bream',
    type: 'delivery',
    title: '🌇 黃昏晚餐加菜',
    npcId: 'grandma_chen',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 1,
    desc: '阿嬤今晚想煮鮮魚湯，傍晚去海邊幫我釣幾尾「夕陽赤鯮」回來吧！',
    reqItems: [{ itemId: 'sunset_bream', count: 2 }],
    reward: { money: 520, villageXp: 45, skill: 'fishing', skillXp: 35, favor: 12 }
  },
  {
    id: 'quest_night_squid_fest',
    type: 'delivery',
    title: '🌙 漁火夜釣小管',
    npcId: 'captain_hai',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 1,
    desc: '入夜後漁港燈火一亮，小管就會靠過來！帶「夜光小管」來給海伯瞧瞧。',
    reqItems: [{ itemId: 'night_squid', count: 2 }],
    reward: { money: 720, villageXp: 55, skill: 'fishing', skillXp: 45, favor: 15 }
  },
  {
    id: 'quest_grilled_squid_snack',
    type: 'delivery',
    title: '🍢 村長的宵夜嘴饞',
    npcId: 'mayor_wang',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 2,
    desc: '晚上巡邏完肚子好餓，聽說大廚房剛研發出「炭烤夜光小管」，能幫我烤一份嗎？',
    reqItems: [{ itemId: 'grilled_night_squid', count: 1 }],
    reward: { money: 780, villageXp: 60, skill: 'cooking', skillXp: 50, favor: 18 }
  },
  {
    id: 'quest_starlight_grouper',
    type: 'delivery',
    title: '🐡 團圓宴的傳說魚王',
    npcId: 'mayor_wang',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 5,
    desc: '過年圍爐就缺一條鎮桌大菜！深夜帶路亞餌去碼頭挑戰「星斑龍膽石斑」吧！',
    reqItems: [{ itemId: 'starlight_grouper', count: 1 }],
    reward: { money: 1350, villageXp: 100, skill: 'fishing', skillXp: 80, favor: 25 }
  },
  {
    id: 'quest_glowing_conch',
    type: 'delivery',
    title: '🐚 珍寶閣的夜光海螺',
    npcId: 'boss_lin',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 2,
    desc: '聽說夜晚退潮時的潮間帶能撿到會發光的「夜光蠑螺」，我出高價收購！',
    reqItems: [{ itemId: 'glowing_conch', count: 2 }],
    reward: { money: 550, villageXp: 45, skill: 'foraging', skillXp: 40, favor: 14 }
  },
  {
    id: 'quest_firefly_herb',
    type: 'delivery',
    title: '🌿 夜間採集螢光藥草',
    npcId: 'vet_fang',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 2,
    desc: '入夜後深山草叢裡的「螢光仙草葉」藥效最好，能幫我採一些回診所嗎？',
    reqItems: [{ itemId: 'firefly_herb', count: 2 }],
    reward: { money: 480, villageXp: 40, skill: 'foraging', skillXp: 40, favor: 14 }
  },
  {
    id: 'bq_winter_ginger_duck',
    type: 'delivery',
    title: '寒流牧場暖胃應援',
    npcId: 'vet_fang',
    seasons: ['winter'],
    minVillageLv: 4,
    desc: '寒流來襲，小芳姊在牧場值夜班冷到發抖，送鍋薑母鴨過去暖身吧！',
    reqItems: [{ itemId: 'ginger_duck', count: 2 }],
    reward: { money: 680, villageXp: 60, skill: 'cooking', skillXp: 50, bonusItem: { itemId: 'basic_feed', count: 4 } }
  },

  // --- 現場檢定幫忙型 (check：免交物資，走到指定地點骰骰子即可) ---
  {
    id: 'bq_check_fix_net',
    type: 'check',
    title: '漁港修網大作戰（免交材料）',
    npcId: 'captain_hai',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 1,
    desc: '海伯的漁網打結了！只要前往「海邊漁港」消耗體力並通過感知檢定就能幫忙理順。',
    targetLocation: 'beach',
    staminaCost: 12,
    check: { stat: 'perception', skill: 'fishing', dc: 11 },
    reward: { money: 320, villageXp: 35, skill: 'fishing', skillXp: 35, bonusItem: { itemId: 'wakame', count: 2 } }
  },
  {
    id: 'bq_check_scare_birds',
    type: 'check',
    title: '驅趕偷吃飼料的海鳥（免交材料）',
    npcId: 'vet_fang',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 1,
    desc: '一群海鳥跑來牧場偷吃飼料！前往「牧場畜舍」展現你的氣勢把牠們趕走吧。',
    targetLocation: 'ranch',
    staminaCost: 10,
    check: { stat: 'charisma', skill: 'ranching', dc: 10 },
    reward: { money: 280, villageXp: 30, skill: 'ranching', skillXp: 30, bonusItem: { itemId: 'egg', count: 2 } }
  },
  {
    id: 'bq_check_reinforce_arch',
    type: 'check',
    title: '廣場牌樓除鏽加固（免交材料）',
    npcId: 'mayor_wang',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 2,
    desc: '村莊廣場的迎賓牌樓螺絲鬆動了，前往「村莊廣場」幫忙敲打加固！',
    targetLocation: 'town',
    staminaCost: 15,
    check: { stat: 'physique', skill: 'smithing', dc: 13 },
    reward: { money: 480, villageXp: 45, skill: 'smithing', skillXp: 45 }
  },

  // --- 指定加工型 (craft_quality) ---
  {
    id: 'bq_craft_agate',
    type: 'craft_quality',
    title: '珠寶店櫥窗展示品',
    npcId: 'boss_lin',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 2,
    desc: '林老闆想在櫥窗擺一顆鑑定過的「紅紋瑪瑙」吸引外地遊客。',
    reqItems: [{ itemId: 'agate', count: 1 }, { itemId: 'copper_bar', count: 1 }],
    reward: { money: 520, villageXp: 50, skill: 'smithing', skillXp: 45 }
  },
  {
    id: 'bq_craft_steak_dinner',
    type: 'craft_quality',
    title: '鎮上慶功頂級牛排餐',
    npcId: 'boss_lin',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 5,
    desc: '林老闆談成了一筆大生意，重金徵求兩份「頂級香煎牛排」慶祝！',
    reqItems: [{ itemId: 'grilled_steak', count: 2 }],
    reward: { money: 1100, villageXp: 80, skill: 'cooking', skillXp: 70 }
  },

  // --- 跑腿交涉型 (errand：在村莊廣場消耗體力進行魅力交涉) ---
  {
    id: 'bq_errand_gossip',
    type: 'errand',
    title: '幫海伯送鮮魚給陳阿嬤',
    npcId: 'captain_hai',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 1,
    desc: '海伯出海忙不過來，請你在「村莊廣場」順便陪陳阿嬤聊聊天、順道促進兩家店合作。',
    targetLocation: 'town',
    staminaCost: 10,
    check: { stat: 'charisma', skill: 'commerce', dc: 11 },
    reward: { money: 340, villageXp: 35, skill: 'commerce', skillXp: 40, bonusItem: { itemId: 'old_soup', count: 1 } }
  },
  {
    id: 'bq_errand_sponsor',
    type: 'errand',
    title: '向行腳商爭取村莊贊助金',
    npcId: 'mayor_wang',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    minVillageLv: 3,
    desc: '在「村莊廣場」發揮你的三寸不爛之舌，說服商隊捐助小鎮建設基金！',
    targetLocation: 'town',
    staminaCost: 12,
    check: { stat: 'charisma', skill: 'commerce', dc: 14 },
    reward: { money: 750, villageXp: 60, skill: 'commerce', skillXp: 60 }
  }
];

// d20 骰出 20（大成功）與 1（大失敗）的全村趣味廣播句庫
export const DICE_FLAVOR_LOGS = {
  critSuccess: [
    '神乎其技！簡直有如神助，連路過的村民都忍不住拍手叫好！',
    '手感火燙！完美無瑕的操作，產出直接大爆發！',
    '吉星高照！今天的幸運之神完全站在你這邊！'
  ],
  critFail: [
    '一個手滑差點閃到腰，雖然沒成功但逗笑了旁邊所有人！',
    '用力過猛結果工具卡住，灰頭土臉地爬了起來（還好工具沒壞）。',
    '分心想著晚餐要吃什麼，結果手忙腳亂搞砸了這次行動！'
  ]
};