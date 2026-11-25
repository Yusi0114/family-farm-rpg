// 作物、漁獲、礦石、老湯與家常菜食譜、商人季節行情
// data/items-recipes.js

export const ITEM_CATEGORIES = {
  crop: { id: 'crop', name: '農產蔬果', icon: '🥬' },
  forage_ore: { id: 'forage_ore', name: '山海採集與礦石', icon: '💎' },
  fish: { id: 'fish', name: '漁獲海產', icon: '🐟' },
  ranch: { id: 'ranch', name: '畜牧產品', icon: '🥚' },
  cooking: { id: 'cooking', name: '料理與釀造', icon: '🍲' },
  supply: { id: 'supply', name: '種子、食材與資材', icon: '🛒' },
  tool: { id: 'tool', name: '工具與特殊道具', icon: '🛠️' }
};

export const ITEMS = {
  // ================= 商店採買：種子與食材原料 =================
  seasoning: { id: 'seasoning', name: '廚房調味料組', icon: '🧂', category: 'supply', buyPrice: 20, sellPrice: 10, desc: '鹽巴、醬油、米酒與胡椒，家常菜必備' },
  vermicelli: { id: 'vermicelli', name: '手工麵線', icon: '🍜', category: 'supply', buyPrice: 35, sellPrice: 15, desc: '煮小管麵線的靈魂主食' },
  tapioca_pearls: { id: 'tapioca_pearls', name: '黑糖珍珠', icon: '🧋', category: 'supply', buyPrice: 30, sellPrice: 15, desc: '煮珍珠奶茶專用粉圓' },
  raw_chicken: { id: 'raw_chicken', name: '生鮮雞肉', icon: '🍗', category: 'supply', buyPrice: 60, sellPrice: 30, desc: '可做香菇雞湯或炸雞排' },
  pork_ribs: { id: 'pork_ribs', name: '精選排骨', icon: '🍖', category: 'supply', buyPrice: 70, sellPrice: 35, desc: '熬煮蘿蔔排骨湯的食材' },
  raw_steak: { id: 'raw_steak', name: '厚切生牛排', icon: '🥩', category: 'supply', buyPrice: 150, sellPrice: 75, desc: '高級肉品，適合香煎牛排' },
  raw_lamb: { id: 'raw_lamb', name: '帶骨生羊排', icon: '🍖', category: 'supply', buyPrice: 140, sellPrice: 70, desc: '適合煎烤成迷迭香羊排' },
  raw_pork_chop: { id: 'raw_pork_chop', name: '帶骨厚切豬排', icon: '🥓', category: 'supply', buyPrice: 90, sellPrice: 45, desc: '可做厚切豬排或切丁做滷肉飯' },
  basic_feed: { id: 'basic_feed', name: '牧場基礎飼料', icon: '🌾', category: 'supply', buyPrice: 25, sellPrice: 10, desc: '餵飽牧場動物維持親密度' },
  worm_bait: { id: 'worm_bait', name: '初階蚯蚓餌', icon: '🪱', category: 'supply', buyPrice: 20, sellPrice: 10, desc: '釣魚基本魚餌' },
  shrimp_bait: { id: 'shrimp_bait', name: '中階南極蝦餌', icon: '🦐', category: 'supply', buyPrice: 60, sellPrice: 30, desc: '提高中階魚類出現機率' },
  lure_bait: { id: 'lure_bait', name: '高階發光路亞餌', icon: '✨', category: 'supply', buyPrice: 150, sellPrice: 75, desc: '吸引稀有魚王並降低檢定難度' },

  // ================= 種子（對應可種植季節） =================
  seed_bok_choy: { id: 'seed_bok_choy', name: '小白菜種子', icon: '🌱', category: 'supply', buyPrice: 20, sellPrice: 10, cropId: 'bok_choy', seasons: ['spring', 'autumn', 'winter'], growDays: 2, skillReq: 1 },
  seed_sweet_potato_leaves: { id: 'seed_sweet_potato_leaves', name: '地瓜葉苗', icon: '🌱', category: 'supply', buyPrice: 20, sellPrice: 10, cropId: 'sweet_potato_leaves', seasons: ['spring', 'summer', 'autumn'], growDays: 2, skillReq: 1 },
  seed_scallion: { id: 'seed_scallion', name: '三星蔥苗', icon: '🌱', category: 'supply', buyPrice: 25, sellPrice: 12, cropId: 'scallion', seasons: ['spring', 'autumn', 'winter'], growDays: 2, skillReq: 1 },
  seed_tomato: { id: 'seed_tomato', name: '牛番茄種子', icon: '🌱', category: 'supply', buyPrice: 35, sellPrice: 15, cropId: 'tomato', seasons: ['spring', 'summer', 'autumn'], growDays: 3, skillReq: 2 },
  seed_spring_tea: { id: 'seed_spring_tea', name: '高山茶樹苗', icon: '🌱', category: 'supply', buyPrice: 80, sellPrice: 40, cropId: 'spring_tea', seasons: ['spring'], growDays: 4, skillReq: 7 },
  seed_strawberry: { id: 'seed_strawberry', name: '大湖草莓苗', icon: '🌱', category: 'supply', buyPrice: 90, sellPrice: 45, cropId: 'strawberry', seasons: ['spring', 'winter'], growDays: 4, skillReq: 7 },
  seed_mango: { id: 'seed_mango', name: '愛文芒果苗', icon: '🌱', category: 'supply', buyPrice: 65, sellPrice: 30, cropId: 'mango', seasons: ['summer'], growDays: 4, skillReq: 4 },
  seed_watermelon: { id: 'seed_watermelon', name: '大西瓜種子', icon: '🌱', category: 'supply', buyPrice: 60, sellPrice: 30, cropId: 'watermelon', seasons: ['summer'], growDays: 4, skillReq: 4 },
  seed_pineapple: { id: 'seed_pineapple', name: '金鑽鳳梨苗', icon: '🌱', category: 'supply', buyPrice: 70, sellPrice: 35, cropId: 'pineapple', seasons: ['summer'], growDays: 4, skillReq: 4 },
  seed_rice: { id: 'seed_rice', name: '水稻秧苗', icon: '🌱', category: 'supply', buyPrice: 30, sellPrice: 15, cropId: 'rice', seasons: ['autumn'], growDays: 3, skillReq: 2 },
  seed_sweet_potato: { id: 'seed_sweet_potato', name: '台農地瓜苗', icon: '🌱', category: 'supply', buyPrice: 30, sellPrice: 15, cropId: 'sweet_potato', seasons: ['autumn', 'winter'], growDays: 3, skillReq: 2 },
  seed_pomelo: { id: 'seed_pomelo', name: '麻豆文旦苗', icon: '🌱', category: 'supply', buyPrice: 95, sellPrice: 45, cropId: 'pomelo', seasons: ['autumn'], growDays: 4, skillReq: 7 },
  seed_cabbage: { id: 'seed_cabbage', name: '高山高麗菜苗', icon: '🌱', category: 'supply', buyPrice: 45, sellPrice: 20, cropId: 'cabbage', seasons: ['winter'], growDays: 3, skillReq: 4 },
  seed_daikon: { id: 'seed_daikon', name: '白蘿蔔種子', icon: '🌱', category: 'supply', buyPrice: 40, sellPrice: 20, cropId: 'daikon', seasons: ['winter'], growDays: 3, skillReq: 4 },

  // ================= 收成農作物 =================
  bok_choy: { id: 'bok_choy', name: '小白菜', icon: '🥬', category: 'crop', sellPrice: 45, staminaRestore: 8 },
  sweet_potato_leaves: { id: 'sweet_potato_leaves', name: '地瓜葉', icon: '🌿', category: 'crop', sellPrice: 45, staminaRestore: 8 },
  scallion: { id: 'scallion', name: '三星蔥', icon: '🧅', category: 'crop', sellPrice: 55, staminaRestore: 8 },
  tomato: { id: 'tomato', name: '牛番茄', icon: '🍅', category: 'crop', sellPrice: 80, staminaRestore: 12 },
  spring_tea: { id: 'spring_tea', name: '高山春茶葉', icon: '🍃', category: 'crop', sellPrice: 210, staminaRestore: 10 },
  strawberry: { id: 'strawberry', name: '大湖草莓', icon: '🍓', category: 'crop', sellPrice: 230, staminaRestore: 18 },
  mango: { id: 'mango', name: '愛文芒果', icon: '🥭', category: 'crop', sellPrice: 165, staminaRestore: 18 },
  watermelon: { id: 'watermelon', name: '大西瓜', icon: '🍉', category: 'crop', sellPrice: 155, staminaRestore: 20 },
  pineapple: { id: 'pineapple', name: '金鑽鳳梨', icon: '🍍', category: 'crop', sellPrice: 175, staminaRestore: 16 },
  rice: { id: 'rice', name: '飽滿稻米', icon: '🌾', category: 'crop', sellPrice: 75, staminaRestore: 10 },
  sweet_potato: { id: 'sweet_potato', name: '黃金地瓜', icon: '🍠', category: 'crop', sellPrice: 75, staminaRestore: 14 },
  pomelo: { id: 'pomelo', name: '麻豆文旦', icon: '🍈', category: 'crop', sellPrice: 240, staminaRestore: 18 },
  cabbage: { id: 'cabbage', name: '清甜高麗菜', icon: '🥬', category: 'crop', sellPrice: 115, staminaRestore: 14 },
  daikon: { id: 'daikon', name: '白玉蘿蔔', icon: '🥕', category: 'crop', sellPrice: 105, staminaRestore: 12 },

  // ================= 採集、海邊趕海、礦石與鑑定寶石 =================
  wakame: { id: 'wakame', name: '新鮮海帶芽', icon: '🌿', category: 'forage_ore', sellPrice: 30, staminaRestore: 6, desc: '海邊趕海採集，煮老湯的必備食材' },
  birds_nest_fern: { id: 'birds_nest_fern', name: '野生山蘇', icon: '🌱', category: 'forage_ore', sellPrice: 35, staminaRestore: 8 },
  wild_mushroom: { id: 'wild_mushroom', name: '深山香菇', icon: '🍄', category: 'forage_ore', sellPrice: 75, staminaRestore: 10 },
  antrodia: { id: 'antrodia', name: '野生牛樟芝', icon: '🪵', category: 'forage_ore', sellPrice: 320, staminaRestore: 15, desc: '深山極品藥材' },
  acacia_wood: { id: 'acacia_wood', name: '相思木', icon: '🪵', category: 'forage_ore', sellPrice: 20 },
  hinoki_wood: { id: 'hinoki_wood', name: '台灣檜木', icon: '🌲', category: 'forage_ore', sellPrice: 85 },
  stone: { id: 'stone', name: '碎石', icon: '🪨', category: 'forage_ore', sellPrice: 15 },
  copper_ore: { id: 'copper_ore', name: '銅礦石', icon: '🟫', category: 'forage_ore', sellPrice: 40 },
  iron_ore: { id: 'iron_ore', name: '鐵礦石', icon: '⬛', category: 'forage_ore', sellPrice: 75 },
  gold_ore: { id: 'gold_ore', name: '金礦石', icon: '🟨', category: 'forage_ore', sellPrice: 160 },
  copper_bar: { id: 'copper_bar', name: '精煉銅錠', icon: '🧱', category: 'forage_ore', sellPrice: 110 },
  iron_bar: { id: 'iron_bar', name: '精煉鐵錠', icon: '🔩', category: 'forage_ore', sellPrice: 200 },
  gold_bar: { id: 'gold_bar', name: '純金金錠', icon: '🥇', category: 'forage_ore', sellPrice: 420 },
  strange_stone: { id: 'strange_stone', name: '奇怪的石頭', icon: '🪨', category: 'forage_ore', sellPrice: 25, isUnidentified: true, desc: '海邊或釣魚撿到的神秘石頭，需交給鐵匠鑑定' },
  rough_ore_gem: { id: 'rough_ore_gem', name: '混濁的原石', icon: '🔮', category: 'forage_ore', sellPrice: 50, isUnidentified: true, desc: '礦坑挖出的原石，鐵匠鑑定後價值連城' },
  agate: { id: 'agate', name: '紅紋瑪瑙', icon: '🟠', category: 'forage_ore', sellPrice: 180 },
  white_quartz: { id: 'white_quartz', name: '通透白水晶', icon: '🤍', category: 'forage_ore', sellPrice: 210 },
  cats_eye: { id: 'cats_eye', name: '貓眼石', icon: '🟢', category: 'forage_ore', sellPrice: 380 },
  taiwan_blue_sapphire: { id: 'taiwan_blue_sapphire', name: '頂級台灣藍寶', icon: '💎', category: 'forage_ore', sellPrice: 680 },
  glowing_conch: { id: 'glowing_conch', name: '夜光蠑螺', icon: '🐚', category: 'forage_ore', sellPrice: 210, staminaRestore: 12, desc: '夜晚退潮時才會在潮間帶發出微光' },
  firefly_herb: { id: 'firefly_herb', name: '螢光仙草葉', icon: '🌿', category: 'forage_ore', sellPrice: 180, staminaRestore: 12, desc: '夜間在深山草叢裡閃著微光的藥草' },
  moon_reishi: { id: 'moon_reishi', name: '月華紫靈芝', icon: '🍄', category: 'forage_ore', sellPrice: 360, staminaRestore: 15, desc: '只在月光下生長的稀有紫靈芝' },
  pearl_oyster: { id: 'pearl_oyster', name: '珍珠貝', icon: '🦪', category: 'forage_ore', sellPrice: 260, staminaRestore: 10, desc: '珊瑚礁潮間帶偶爾能找到的珍貝' },
  rare_seastar: { id: 'rare_seastar', name: '稀有海星', icon: '⭐', category: 'forage_ore', sellPrice: 420, desc: '色彩斑斕的離島海星' },
  ancient_coin: { id: 'ancient_coin', name: '古代金幣', icon: '🪙', category: 'forage_ore', sellPrice: 600, desc: '石陣中出土的古代貨幣' },
  treasure_map_fragment: { id: 'treasure_map_fragment', name: '藏寶圖碎片', icon: '🗺️', category: 'forage_ore', sellPrice: 80, desc: '漂流瓶中發現的手繪藏寶線索' },
  diamond: { id: 'diamond', name: '鑽石', icon: '💎', category: 'forage_ore', sellPrice: 950 },

  // ================= 漁獲海產 =================
  chub: { id: 'chub', name: '溪哥', icon: '🐟', category: 'fish', sellPrice: 40, staminaRestore: 8 },
  tilapia: { id: 'tilapia', name: '台灣鯛（吳郭魚）', icon: '🐟', category: 'fish', sellPrice: 55, staminaRestore: 10 },
  milkfish: { id: 'milkfish', name: '虱目魚', icon: '🐟', category: 'fish', sellPrice: 70, staminaRestore: 12 },
  squid: { id: 'squid', name: '新鮮小管', icon: '🦑', category: 'fish', sellPrice: 110, staminaRestore: 12, desc: '夜晚海邊或夜釣容易捕獲' },
  grouper: { id: 'grouper', name: '龍虎石斑', icon: '🐠', category: 'fish', sellPrice: 180, staminaRestore: 15 },
  hairtail: { id: 'hairtail', name: '白帶魚', icon: '🐡', category: 'fish', sellPrice: 160, staminaRestore: 14 },
  mud_crab: { id: 'mud_crab', name: '肥美紅蟳', icon: '🦀', category: 'fish', sellPrice: 240, staminaRestore: 18 },
  lobster: { id: 'lobster', name: '野生大龍蝦', icon: '🦞', category: 'fish', sellPrice: 390, staminaRestore: 22 },
  bluefin_tuna: { id: 'bluefin_tuna', name: '黑鮪魚', icon: '🦈', category: 'fish', sellPrice: 520, staminaRestore: 25 },
  formosan_salmon: { id: 'formosan_salmon', name: '櫻花鉤吻鮭', icon: '👑', category: 'fish', sellPrice: 850, staminaRestore: 30 },
  night_squid: { id: 'night_squid', name: '夜光小管', icon: '🦑', category: 'fish', sellPrice: 210, staminaRestore: 18, desc: '入夜後在漁港燈火旁出沒' },
  moon_ribbonfish: { id: 'moon_ribbonfish', name: '月光白帶魚', icon: '🐟', category: 'fish', sellPrice: 280, staminaRestore: 22, desc: '月色映照海面時較容易釣起' },
  dusk_cuttlefish: { id: 'dusk_cuttlefish', name: '晚霞花枝', icon: '🦑', category: 'fish', sellPrice: 230, staminaRestore: 20, desc: '黃昏時分在港灣覓食的花枝' },
  sunset_bream: { id: 'sunset_bream', name: '夕陽赤鯮', icon: '🐟', category: 'fish', sellPrice: 260, staminaRestore: 20, desc: '只在夕陽染紅海面時活躍' },
  starlight_grouper: { id: 'starlight_grouper', name: '星斑龍膽石斑', icon: '🐠', category: 'fish', sellPrice: 900, staminaRestore: 32, desc: '深夜才會現身的傳說魚王' },
  rainbow_wrasse: { id: 'rainbow_wrasse', name: '七彩蘇眉魚', icon: '🐠', category: 'fish', sellPrice: 680, staminaRestore: 28, desc: '珊瑚礁離島限定漁獲' },
  coral_grouper: { id: 'coral_grouper', name: '珊瑚石斑', icon: '🐟', category: 'fish', sellPrice: 560, staminaRestore: 25, desc: '珊瑚礁離島限定漁獲' },

  // ================= 畜牧產品 =================
  egg: { id: 'egg', name: '土雞蛋', icon: '🥚', category: 'ranch', sellPrice: 40, staminaRestore: 10 },
  duck_egg: { id: 'duck_egg', name: '新鮮鴨蛋', icon: '🥚', category: 'ranch', sellPrice: 55, staminaRestore: 12 },
  milk: { id: 'milk', name: '濃醇鮮奶', icon: '🥛', category: 'ranch', sellPrice: 95, staminaRestore: 18 },
  wool: { id: 'wool', name: '蓬鬆羊毛', icon: '🧶', category: 'ranch', sellPrice: 160 },
  deer_antler: { id: 'deer_antler', name: '珍貴鹿茸', icon: '🦌', category: 'ranch', sellPrice: 350 },

  // ================= 烹飪與釀造料理 =================
  mystery_stew: { id: 'mystery_stew', name: '勉強能吃的家常大雜燴', icon: '🥘', category: 'cooking', sellPrice: 25, staminaRestore: 18, desc: '烹飪檢定失敗時的安慰產物，雖然賣相不好但能填飽肚子' },
  old_soup: { id: 'old_soup', name: '老湯（海帶芽蛋花湯）', icon: '🍲', category: 'cooking', sellPrice: 130, staminaRestore: 38, buff: { type: 'warm', desc: '暖胃舒暢' }, desc: '家傳經典湯品，海帶芽與蛋花的鮮甜完美融合' },
  fried_egg: { id: 'fried_egg', name: '香煎荷包蛋', icon: '🍳', category: 'cooking', sellPrice: 75, staminaRestore: 22 },
  scallion_egg: { id: 'scallion_egg', name: '三星蔥花蛋', icon: '🍳', category: 'cooking', sellPrice: 145, staminaRestore: 35 },
  tomato_egg: { id: 'tomato_egg', name: '番茄炒蛋', icon: '🍅', category: 'cooking', sellPrice: 175, staminaRestore: 42 },
  stir_fried_veggies: { id: 'stir_fried_veggies', name: '蒜香炒青菜', icon: '🥬', category: 'cooking', sellPrice: 105, staminaRestore: 28 },
  sweet_potato_porridge: { id: 'sweet_potato_porridge', name: '古早味地瓜稀飯', icon: '🥣', category: 'cooking', sellPrice: 110, staminaRestore: 32 },
  herbal_tea: { id: 'herbal_tea', name: '消暑青草茶', icon: '🍵', category: 'cooking', sellPrice: 80, staminaRestore: 25, buff: { type: 'cool_down', desc: '消除夏季炎熱懲罰' } },
  squid_vermicelli: { id: 'squid_vermicelli', name: '鮮甜小管麵線', icon: '🍜', category: 'cooking', sellPrice: 260, staminaRestore: 58, buff: { type: 'fishing_bonus', value: 1, desc: '今日釣魚檢定 +1' } },
  mushroom_chicken_soup: { id: 'mushroom_chicken_soup', name: '深山香菇雞湯', icon: '🍲', category: 'cooking', sellPrice: 240, staminaRestore: 55, buff: { type: 'warm', desc: '溫暖身心，免疫寒流' } },
  fish_soup: { id: 'fish_soup', name: '薑絲鮮魚湯', icon: '🍲', category: 'cooking', sellPrice: 165, staminaRestore: 45 },
  daikon_rib_soup: { id: 'daikon_rib_soup', name: '白玉蘿蔔排骨湯', icon: '🍲', category: 'cooking', sellPrice: 280, staminaRestore: 60 },
  fried_chicken_cutlet: { id: 'fried_chicken_cutlet', name: '夜市酥脆炸雞排', icon: '🍗', category: 'cooking', sellPrice: 160, staminaRestore: 48 },
  braised_pork_rice: { id: 'braised_pork_rice', name: '手切香濃滷肉飯', icon: '🍚', category: 'cooking', sellPrice: 270, staminaRestore: 62 },
  bubble_milk_tea: { id: 'bubble_milk_tea', name: '手搖珍珠奶茶', icon: '🧋', category: 'cooking', sellPrice: 420, staminaRestore: 50, buff: { type: 'speed', desc: '幸福感滿點，今日行動時間減半' } },
  pineapple_cake: { id: 'pineapple_cake', name: '金鑽鳳梨酥禮盒', icon: '🍍', category: 'cooking', sellPrice: 330, staminaRestore: 40 },
  grilled_steak: { id: 'grilled_steak', name: '頂級香煎牛排', icon: '🥩', category: 'cooking', sellPrice: 360, staminaRestore: 75, buff: { type: 'all_check', value: 1, desc: '精力充沛，今日全能力檢定 +1' } },
  roast_lamb_chops: { id: 'roast_lamb_chops', name: '嫩煎迷迭香羊排', icon: '🍖', category: 'cooking', sellPrice: 340, staminaRestore: 72, buff: { type: 'warm', desc: '全身暖呼呼，免疫寒流' } },
  thick_pork_chop: { id: 'thick_pork_chop', name: '古早味厚切豬排', icon: '🥓', category: 'cooking', sellPrice: 210, staminaRestore: 55 },
  ginger_duck: { id: 'ginger_duck', name: '圍爐暖身薑母鴨', icon: '🍲', category: 'cooking', sellPrice: 220, staminaRestore: 68, buff: { type: 'warm', desc: '冬季進補神品，體力上限暫時 +15' } },
  antrodia_tonic: { id: 'antrodia_tonic', name: '極品牛樟芝補湯', icon: '👑', category: 'cooking', sellPrice: 650, staminaRestore: 90, buff: { type: 'all_check', value: 2, desc: '元氣大補，今日全能力檢定 +2' } },
  grilled_night_squid: { id: 'grilled_night_squid', name: '炭烤夜光小管', icon: '🍢', category: 'cooking', sellPrice: 480, staminaRestore: 55, desc: '【夜市招牌】整尾夜光小管刷上醬汁炭烤，鮮甜彈牙、香氣四溢。' },
  pan_fried_ribbonfish: { id: 'pan_fried_ribbonfish', name: '香煎月光白帶魚', icon: '🍱', category: 'cooking', sellPrice: 620, staminaRestore: 65, desc: '【海港家常】魚皮煎得金黃酥脆、魚肉細嫩多汁，配白飯能連吃三碗。' },
  five_spice_cuttlefish: { id: 'five_spice_cuttlefish', name: '五味晚霞花枝', icon: '🥗', category: 'cooking', sellPrice: 540, staminaRestore: 58, desc: '【辦桌冷盤】川燙晚霞花枝與赤鯮片淋上酸甜五味醬，開胃又爽口。' },
  steamed_starlight_grouper: { id: 'steamed_starlight_grouper', name: '清蒸星斑龍膽石斑', icon: '🍲', category: 'cooking', sellPrice: 1180, staminaRestore: 95, desc: '【年菜主秀】僅用蔥薑與米酒清蒸深夜魚王，膠質滿滿、全村讚不絕口！' },
  moon_herb_tea: { id: 'moon_herb_tea', name: '螢光仙草靈芝茶', icon: '🍵', category: 'cooking', sellPrice: 680, staminaRestore: 85, desc: '【夜貓補氣】以螢光仙草葉搭配月華紫靈芝慢火熬煮，喝完精神百倍。' },

  // ================= 工具與特殊道具 =================
  wood_hoe: { id: 'wood_hoe', name: '木製開墾鋤', icon: '🪓', category: 'tool', toolCategory: 'hoe', tier: 'wood', bonus: 0, sellPrice: 0, desc: '村莊發放的基礎木鋤，用來開墾農場荒地。' },
  wood_watering_can: { id: 'wood_watering_can', name: '木製澆水器', icon: '🪣', category: 'tool', toolCategory: 'watering_can', tier: 'wood', bonus: 0, sellPrice: 0, desc: '村莊發放的基礎木桶澆水器，用來灌溉農田作物。' },
  wood_pickaxe: { id: 'wood_pickaxe', name: '木製十字鎬', icon: '⛏️', category: 'tool', toolCategory: 'pickaxe', tier: 'wood', bonus: 0, sellPrice: 0, desc: '村莊發放的基礎木鎬，可前往深山古礦坑挖掘基礎礦石。' },
  wood_axe: { id: 'wood_axe', name: '木製伐木斧', icon: '🪓', category: 'tool', toolCategory: 'axe', tier: 'wood', bonus: 0, sellPrice: 0, desc: '村莊發放的基礎木斧，可在檜木林砍伐木材與採菇。' },
  wood_fishing_rod: { id: 'wood_fishing_rod', name: '木製釣魚竿', icon: '🎣', category: 'tool', toolCategory: 'fishing_rod', tier: 'wood', bonus: 0, sellPrice: 0, desc: '村莊發放的竹木釣竿，可在海邊碼頭拋竿垂釣。' },
  wood_trowel: { id: 'wood_trowel', name: '木製趕海鏟', icon: '🥄', category: 'tool', toolCategory: 'trowel', tier: 'wood', bonus: 0, sellPrice: 0, desc: '村莊發放的木柄小鏟，適合在海邊潮間帶翻石趕海。' },
  stone_hoe: { id: 'stone_hoe', name: '石製開墾鋤', icon: '🪓', category: 'tool', toolCategory: 'hoe', tier: 'stone', bonus: 1, sellPrice: 0, desc: '沉穩耐用的石鋤頭，開墾荒地檢定 +1。' },
  stone_axe: { id: 'stone_axe', name: '石製伐木斧', icon: '🪓', category: 'tool', toolCategory: 'axe', tier: 'stone', bonus: 1, sellPrice: 0, desc: '綁上鋒利石刃的伐木斧，伐木採集檢定 +1。' },
  stone_pickaxe: { id: 'stone_pickaxe', name: '石製十字鎬', icon: '⛏️', category: 'tool', toolCategory: 'pickaxe', tier: 'stone', bonus: 1, sellPrice: 0, desc: '以堅硬花崗岩打磨而成的石鎬，挖礦檢定 +1，更容易敲出銅礦與鐵礦。' },
  stone_watering_can: { id: 'stone_watering_can', name: '石製澆水器', icon: '🪣', category: 'tool', toolCategory: 'watering_can', tier: 'stone', bonus: 1, sellPrice: 0, desc: '石陶燒製的蓄水壺，出水均勻且更有份量。' },
  stone_fishing_rod: { id: 'stone_fishing_rod', name: '石墜釣魚竿', icon: '🎣', category: 'tool', toolCategory: 'fishing_rod', tier: 'stone', bonus: 1, sellPrice: 0, desc: '加裝打磨石墜的釣竿，拋投更穩、釣魚檢定 +1。' },
  stone_trowel: { id: 'stone_trowel', name: '石製趕海鏟', icon: '🥄', category: 'tool', toolCategory: 'trowel', tier: 'stone', bonus: 1, sellPrice: 0, desc: '石刃小鏟，撬開礁岩縫隙不費力，趕海檢定 +1。' },
  fishing_rod: { id: 'fishing_rod', name: '竹製釣魚竿', icon: '🎣', category: 'tool', toolCategory: 'fishing_rod', tier: 'wood', bonus: 0, sellPrice: 0 },
  fancy_ledger: { id: 'fancy_ledger', name: '商人精緻帳本', icon: '📒', category: 'tool', sellPrice: 0 }
};

export const STARTER_WOOD_TOOLS = [
  'wood_hoe',
  'wood_watering_can',
  'wood_pickaxe',
  'wood_axe',
  'wood_fishing_rod',
  'wood_trowel'
];

export const TOOL_FORGE_RECIPES = [
  { resultId: 'stone_pickaxe', fromId: 'wood_pickaxe', toolCategory: 'pickaxe', costMoney: 50, materials: [{ itemId: 'acacia_wood', count: 3 }, { itemId: 'stone', count: 6 }] },
  { resultId: 'stone_axe', fromId: 'wood_axe', toolCategory: 'axe', costMoney: 50, materials: [{ itemId: 'acacia_wood', count: 3 }, { itemId: 'stone', count: 5 }] },
  { resultId: 'stone_hoe', fromId: 'wood_hoe', toolCategory: 'hoe', costMoney: 40, materials: [{ itemId: 'acacia_wood', count: 3 }, { itemId: 'stone', count: 5 }] },
  { resultId: 'stone_watering_can', fromId: 'wood_watering_can', toolCategory: 'watering_can', costMoney: 40, materials: [{ itemId: 'acacia_wood', count: 2 }, { itemId: 'stone', count: 5 }] },
  { resultId: 'stone_fishing_rod', fromId: 'wood_fishing_rod', toolCategory: 'fishing_rod', costMoney: 50, materials: [{ itemId: 'acacia_wood', count: 4 }, { itemId: 'stone', count: 3 }] },
  { resultId: 'stone_trowel', fromId: 'wood_trowel', toolCategory: 'trowel', costMoney: 40, materials: [{ itemId: 'acacia_wood', count: 2 }, { itemId: 'stone', count: 4 }] }
];

export const COOKING_RECIPES = [
  // 初階 (Lv.1 - Lv.3)
  { id: 'recipe_old_soup', resultId: 'old_soup', skillReq: 1, dc: 10, ingredients: [{ itemId: 'wakame', count: 1 }, { itemId: 'egg', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_fried_egg', resultId: 'fried_egg', skillReq: 1, dc: 8, ingredients: [{ itemId: 'egg', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_stir_veggies', resultId: 'stir_fried_veggies', skillReq: 1, dc: 8, ingredients: [{ itemId: 'bok_choy', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_stir_sweet_leaves', resultId: 'stir_fried_veggies', skillReq: 1, dc: 8, ingredients: [{ itemId: 'sweet_potato_leaves', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_scallion_egg', resultId: 'scallion_egg', skillReq: 2, dc: 10, ingredients: [{ itemId: 'scallion', count: 1 }, { itemId: 'egg', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_tomato_egg', resultId: 'tomato_egg', skillReq: 2, dc: 10, ingredients: [{ itemId: 'tomato', count: 1 }, { itemId: 'egg', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_porridge', resultId: 'sweet_potato_porridge', skillReq: 2, dc: 9, ingredients: [{ itemId: 'sweet_potato', count: 1 }] },
  { id: 'recipe_herbal_tea', resultId: 'herbal_tea', skillReq: 2, dc: 9, ingredients: [{ itemId: 'birds_nest_fern', count: 1 }] },

  // 中階 (Lv.4 - Lv.6)
  { id: 'recipe_squid_vermicelli', resultId: 'squid_vermicelli', skillReq: 4, dc: 13, ingredients: [{ itemId: 'squid', count: 1 }, { itemId: 'vermicelli', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_fish_soup', resultId: 'fish_soup', skillReq: 4, dc: 12, ingredients: [{ itemId: 'tilapia', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_fried_chicken', resultId: 'fried_chicken_cutlet', skillReq: 4, dc: 12, ingredients: [{ itemId: 'raw_chicken', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_thick_pork', resultId: 'thick_pork_chop', skillReq: 4, dc: 12, ingredients: [{ itemId: 'raw_pork_chop', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_mushroom_chicken', resultId: 'mushroom_chicken_soup', skillReq: 5, dc: 13, ingredients: [{ itemId: 'wild_mushroom', count: 1 }, { itemId: 'raw_chicken', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_daikon_rib', resultId: 'daikon_rib_soup', skillReq: 5, dc: 13, ingredients: [{ itemId: 'daikon', count: 1 }, { itemId: 'pork_ribs', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_braised_pork', resultId: 'braised_pork_rice', skillReq: 5, dc: 13, ingredients: [{ itemId: 'rice', count: 1 }, { itemId: 'raw_pork_chop', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_pineapple_cake', resultId: 'pineapple_cake', skillReq: 6, dc: 14, ingredients: [{ itemId: 'pineapple', count: 1 }, { itemId: 'egg', count: 1 }] },

  // 高階 (Lv.7 - Lv.10)
  { id: 'recipe_bubble_tea', resultId: 'bubble_milk_tea', skillReq: 7, dc: 15, ingredients: [{ itemId: 'spring_tea', count: 1 }, { itemId: 'milk', count: 1 }, { itemId: 'tapioca_pearls', count: 1 }] },
  { id: 'recipe_ginger_duck', resultId: 'ginger_duck', skillReq: 7, dc: 15, ingredients: [{ itemId: 'duck_egg', count: 2 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_grilled_steak', resultId: 'grilled_steak', skillReq: 8, dc: 16, ingredients: [{ itemId: 'raw_steak', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_lamb_chops', resultId: 'roast_lamb_chops', skillReq: 8, dc: 16, ingredients: [{ itemId: 'raw_lamb', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_antrodia_tonic', resultId: 'antrodia_tonic', skillReq: 9, dc: 17, ingredients: [{ itemId: 'antrodia', count: 1 }, { itemId: 'raw_chicken', count: 1 }, { itemId: 'seasoning', count: 1 }] },
  { id: 'recipe_grilled_night_squid', resultId: 'grilled_night_squid', skillReq: 4, dc: 14, ingredients: [{ itemId: 'night_squid', count: 1 }] },
  { id: 'recipe_pan_fried_ribbonfish', resultId: 'pan_fried_ribbonfish', skillReq: 5, dc: 14, ingredients: [{ itemId: 'moon_ribbonfish', count: 1 }] },
  { id: 'recipe_five_spice_cuttlefish', resultId: 'five_spice_cuttlefish', skillReq: 6, dc: 15, ingredients: [{ itemId: 'dusk_cuttlefish', count: 1 }, { itemId: 'sunset_bream', count: 1 }] },
  { id: 'recipe_steamed_starlight_grouper', resultId: 'steamed_starlight_grouper', skillReq: 9, dc: 18, ingredients: [{ itemId: 'starlight_grouper', count: 1 }] },
  { id: 'recipe_moon_herb_tea', resultId: 'moon_herb_tea', skillReq: 8, dc: 16, ingredients: [{ itemId: 'firefly_herb', count: 2 }, { itemId: 'moon_reishi', count: 1 }] }
];

// 季節高價收購趨勢（對應商品類別或特定 ID 賣出時價格倍率）
export const SEASON_TRENDS = {
  spring: {
    label: '春季高價收購：新鮮葉菜、茶葉與家常料理',
    bonusCategories: ['crop'],
    bonusItems: ['old_soup', 'scallion_egg', 'stir_fried_veggies', 'spring_tea', 'strawberry'],
    multiplier: 1.3
  },
  summer: {
    label: '夏季高價收購：消暑飲品、熱帶水果與小管海產',
    bonusCategories: ['fish'],
    bonusItems: ['herbal_tea', 'bubble_milk_tea', 'mango', 'watermelon', 'pineapple', 'squid_vermicelli'],
    multiplier: 1.3
  },
  autumn: {
    label: '秋季高價收購：秋蟹海產、文旦與在地米食',
    bonusCategories: ['fish', 'crop'],
    bonusItems: ['mud_crab', 'pomelo', 'rice', 'sweet_potato', 'braised_pork_rice'],
    multiplier: 1.3
  },
  winter: {
    label: '冬季高價收購：進補熱湯、肉排大餐與鑑定寶石',
    bonusCategories: ['cooking', 'forage_ore'],
    bonusItems: ['ginger_duck', 'mushroom_chicken_soup', 'daikon_rib_soup', 'grilled_steak', 'taiwan_blue_sapphire', 'wool'],
    multiplier: 1.35
  }
};