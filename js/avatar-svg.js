// 紙娃娃 SVG 向量圖層生成器（膚色、髮型、服裝、配件）
// js/avatar-svg.js

export const AVATAR_OPTIONS = {
  bgColors: [
    { id: 'warm_yellow', name: '暖陽黃', hex: '#FEF08A' },
    { id: 'sage_green', name: '青草綠', hex: '#BBF7D0' },
    { id: 'sky_blue', name: '晴空藍', hex: '#BAE6FD' },
    { id: 'festive_red', name: '過年紅', hex: '#FECACA' },
    { id: 'lavender', name: '芋頭紫', hex: '#E9D5FF' },
    { id: 'peach', name: '蜜桃粉', hex: '#FED7AA' }
  ],
  skinTones: [
    { id: 'fair', name: '白皙', hex: '#FDE6D8', shadow: '#F3C6B0' },
    { id: 'natural', name: '自然', hex: '#F5CBA7', shadow: '#E0AC84' },
    { id: 'warm', name: '健康', hex: '#E5B289', shadow: '#C99268' },
    { id: 'tan', name: '小麥', hex: '#C68B59', shadow: '#A66E40' }
  ],
  hairColors: [
    { id: 'black', name: '烏黑', hex: '#27272A' },
    { id: 'dark_brown', name: '深棕', hex: '#451A03' },
    { id: 'chestnut', name: '栗子', hex: '#78350F' },
    { id: 'auburn', name: '紅棕', hex: '#9A3412' },
    { id: 'gold', name: '亞麻金', hex: '#D97706' },
    { id: 'silver', name: '銀白', hex: '#9CA3AF' }
  ],
  hairStyles: [
    { id: 'short', name: '清爽短髮' },
    { id: 'bob', name: '齊耳鮑伯' },
    { id: 'ponytail', name: '元氣馬尾' },
    { id: 'bun', name: '丸子包頭' },
    { id: 'curly', name: '蓬鬆捲髮' },
    { id: 'parted', name: '文青中分' }
  ],
  eyes: [
    { id: 'happy', name: '開心笑眼' },
    { id: 'dot', name: '呆萌豆豆眼' },
    { id: 'glasses', name: '斯文眼鏡' },
    { id: 'wink', name: '俏皮眨眼' },
    { id: 'determined', name: '幹勁滿滿' },
    { id: 'chill', name: '悠閒瞇眼' }
  ],
  outfits: [
    { id: 'overalls', name: '農夫吊帶褲' },
    { id: 'apron', name: '總鋪師圍裙' },
    { id: 'vest', name: '漁夫多袋背心' },
    { id: 'smith_gear', name: '鐵匠工作服' },
    { id: 'festive_red', name: '過年喜氣唐裝' },
    { id: 'sweater', name: '暖暖針織毛衣' },
    { id: 'tang_suit', name: '🧧 過年紅唐裝' },
    { id: 'cape', name: '🧣 冒險小披風' }
  ],
  accessories: [
    { id: 'none', name: '無配件' },
    { id: 'straw_hat', name: '田園草帽' },
    { id: 'chef_hat', name: '高聳廚師帽' },
    { id: 'beanie', name: '保暖毛帽' },
    { id: 'hairpin', name: '小花髮夾' },
    { id: 'chick', name: '頭頂小雞' }
  ]
};

export function getDefaultAvatarConfig() {
  return {
    bgColor: 'warm_yellow',
    skinTone: 'natural',
    hairColor: 'dark_brown',
    hairStyle: 'short',
    eyes: 'happy',
    outfit: 'overalls',
    accessory: 'none'
  };
}

export function renderAvatarSVG(config = {}, size = 80) {
  const cfg = { ...getDefaultAvatarConfig(), ...config };
  const bg = AVATAR_OPTIONS.bgColors.find(x => x.id === cfg.bgColor)?.hex || '#FEF08A';
  const skin = AVATAR_OPTIONS.skinTones.find(x => x.id === cfg.skinTone) || AVATAR_OPTIONS.skinTones[1];
  const hair = AVATAR_OPTIONS.hairColors.find(x => x.id === cfg.hairColor)?.hex || '#451A03';

  // 後髮層（馬尾、包頭、長捲髮底）
  let backHairSVG = '';
  if (cfg.hairStyle === 'ponytail') {
    backHairSVG = `<path d="M68,36 Q88,38 85,64 Q78,56 68,52 Z" fill="${hair}" />`;
  } else if (cfg.hairStyle === 'bun') {
    backHairSVG = `<circle cx="50" cy="18" r="12" fill="${hair}" />`;
  } else if (cfg.hairStyle === 'curly') {
    backHairSVG = `
      <circle cx="26" cy="48" r="11" fill="${hair}" />
      <circle cx="74" cy="48" r="11" fill="${hair}" />
      <circle cx="28" cy="62" r="10" fill="${hair}" />
      <circle cx="72" cy="62" r="10" fill="${hair}" />
    `;
  } else if (cfg.hairStyle === 'bob') {
    backHairSVG = `<rect x="24" y="34" width="52" height="34" rx="14" fill="${hair}" />`;
  }

  // 服裝層
  let outfitSVG = '';
  switch (cfg.outfit) {
    case 'overalls':
      outfitSVG = `
        <path d="M22,98 C22,76 78,76 78,98 Z" fill="#FACC15" />
        <path d="M32,78 L68,78 L72,98 L28,98 Z" fill="#2563EB" />
        <rect x="34" y="75" width="6" height="14" fill="#1D4ED8" />
        <rect x="60" y="75" width="6" height="14" fill="#1D4ED8" />
        <circle cx="37" cy="85" r="2" fill="#FDE047" />
        <circle cx="63" cy="85" r="2" fill="#FDE047" />
      `;
      break;
    case 'apron':
      outfitSVG = `
        <path d="M22,98 C22,76 78,76 78,98 Z" fill="#FB923C" />
        <path d="M34,76 L66,76 L70,98 L30,98 Z" fill="#FFFFFF" />
        <line x1="36" y1="76" x2="36" y2="84" stroke="#CBD5E1" stroke-width="2" />
        <line x1="64" y1="76" x2="64" y2="84" stroke="#CBD5E1" stroke-width="2" />
      `;
      break;
    case 'vest':
      outfitSVG = `
        <path d="M22,98 C22,76 78,76 78,98 Z" fill="#E0F2FE" />
        <path d="M28,77 L44,77 L44,98 L25,98 Z" fill="#65A30D" />
        <path d="M56,77 L72,77 L75,98 L56,98 Z" fill="#65A30D" />
      `;
      break;
    case 'smith_gear':
      outfitSVG = `
        <path d="M22,98 C22,76 78,76 78,98 Z" fill="#475569" />
        <path d="M35,77 L65,77 L68,98 L32,98 Z" fill="#78350F" />
        <line x1="35" y1="77" x2="65" y2="95" stroke="#92400E" stroke-width="3" />
      `;
      break;
    case 'festive_red':
      outfitSVG = `
        <path d="M22,98 C22,76 78,76 78,98 Z" fill="#DC2626" />
        <path d="M40,75 L50,83 L60,75" fill="none" stroke="#FACC15" stroke-width="3" />
        <line x1="50" y1="83" x2="50" y2="98" stroke="#FACC15" stroke-width="2.5" />
        <line x1="45" y1="89" x2="55" y2="89" stroke="#FACC15" stroke-width="2" />
      `;
      break;
    case 'tang_suit':
      outfitSVG = `
        <path d="M22,98 C22,76 78,76 78,98 Z" fill="#1E293B" />
        <path d="M31,76 Q50,70 69,76 L72,98 L28,98 Z" fill="#DC2626" stroke="#7F1D1D" stroke-width="1.5" />
        <path d="M41,76 L50,83 L59,76" fill="none" stroke="#FACC15" stroke-width="2.5" />
        <line x1="50" y1="82" x2="50" y2="97" stroke="#FACC15" stroke-width="2" />
        <circle cx="47" cy="87" r="1.5" fill="#FDE68A" />
        <circle cx="53" cy="92" r="1.5" fill="#FDE68A" />
      `;
      break;
    case 'cape':
      outfitSVG = `
        <path d="M27,76 Q50,68 73,76 L80,98 L20,98 Z" fill="#B91C1C" stroke="#450A0A" stroke-width="1.5" />
        <path d="M32,77 Q50,71 68,77 L70,98 L30,98 Z" fill="#15803D" />
        <path d="M37,78 L63,78 L66,98 L34,98 Z" fill="#166534" />
        <path d="M42,77 Q50,84 58,77" fill="none" stroke="#DC2626" stroke-width="3" />
        <circle cx="50" cy="82" r="2.5" fill="#FACC15" stroke="#854D0E" stroke-width="1" />
      `;
      break;
    default: // sweater
      outfitSVG = `
        <path d="M22,98 C22,76 78,76 78,98 Z" fill="#10B981" />
        <path d="M38,75 Q50,82 62,75" fill="none" stroke="#059669" stroke-width="4" />
      `;
  }

  // 表情層
  let eyesSVG = '';
  switch (cfg.eyes) {
    case 'dot':
      eyesSVG = `
        <circle cx="40" cy="49" r="2.8" fill="#1F2937" />
        <circle cx="60" cy="49" r="2.8" fill="#1F2937" />
        <path d="M46,58 Q50,61 54,58" fill="none" stroke="#9A3412" stroke-width="2" stroke-linecap="round" />
      `;
      break;
    case 'glasses':
      eyesSVG = `
        <circle cx="40" cy="49" r="2.5" fill="#1F2937" />
        <circle cx="60" cy="49" r="2.5" fill="#1F2937" />
        <rect x="32" y="43" width="15" height="11" rx="3" fill="none" stroke="#1E293B" stroke-width="2" />
        <rect x="53" y="43" width="15" height="11" rx="3" fill="none" stroke="#1E293B" stroke-width="2" />
        <line x1="47" y1="48" x2="53" y2="48" stroke="#1E293B" stroke-width="2" />
        <path d="M46,59 Q50,62 54,59" fill="none" stroke="#9A3412" stroke-width="2" stroke-linecap="round" />
      `;
      break;
    case 'wink':
      eyesSVG = `
        <circle cx="40" cy="49" r="3" fill="#1F2937" />
        <path d="M56,49 Q60,45 64,49" fill="none" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round" />
        <path d="M45,58 Q50,64 55,58 Z" fill="#F87171" />
      `;
      break;
    case 'determined':
      eyesSVG = `
        <circle cx="40" cy="50" r="2.8" fill="#1F2937" />
        <circle cx="60" cy="50" r="2.8" fill="#1F2937" />
        <line x1="35" y1="43" x2="44" y2="46" stroke="#1F2937" stroke-width="2.2" stroke-linecap="round" />
        <line x1="65" y1="43" x2="56" y2="46" stroke="#1F2937" stroke-width="2.2" stroke-linecap="round" />
        <path d="M45,59 Q50,62 55,59" fill="none" stroke="#9A3412" stroke-width="2" stroke-linecap="round" />
      `;
      break;
    case 'chill':
      eyesSVG = `
        <line x1="35" y1="49" x2="44" y2="49" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round" />
        <line x1="56" y1="49" x2="65" y2="49" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round" />
        <path d="M46,58 Q50,62 54,58" fill="none" stroke="#9A3412" stroke-width="2" stroke-linecap="round" />
      `;
      break;
    default: // happy
      eyesSVG = `
        <path d="M36,50 Q40,44 44,50" fill="none" stroke="#1F2937" stroke-width="2.6" stroke-linecap="round" />
        <path d="M56,50 Q60,44 64,50" fill="none" stroke="#1F2937" stroke-width="2.6" stroke-linecap="round" />
        <path d="M45,57 Q50,64 55,57 Z" fill="#FB7185" />
      `;
  }

  // 前髮瀏海層
  let frontHairSVG = '';
  if (cfg.hairStyle === 'parted') {
    frontHairSVG = `
      <path d="M26,44 C26,22 50,20 50,32 C50,20 74,22 74,44 C70,34 56,34 50,38 C44,34 30,34 26,44 Z" fill="${hair}" />
    `;
  } else if (cfg.hairStyle === 'curly') {
    frontHairSVG = `
      <path d="M25,44 C24,20 76,20 75,44 C68,36 60,40 50,36 C40,40 32,36 25,44 Z" fill="${hair}" />
    `;
  } else {
    frontHairSVG = `
      <path d="M26,45 C25,20 75,20 74,45 C66,36 56,38 50,36 C42,39 34,36 26,45 Z" fill="${hair}" />
    `;
  }

  // 頭飾層
  let accessorySVG = '';
  switch (cfg.accessory) {
    case 'straw_hat':
      accessorySVG = `
        <ellipse cx="50" cy="26" rx="36" ry="7" fill="#FDE047" stroke="#CA8A04" stroke-width="1.5" />
        <path d="M32,26 C32,12 68,12 68,26 Z" fill="#FACC15" />
        <rect x="32" y="22" width="36" height="3.5" fill="#EF4444" />
      `;
      break;
    case 'chef_hat':
      accessorySVG = `
        <circle cx="38" cy="15" r="9" fill="#FFFFFF" />
        <circle cx="50" cy="12" r="11" fill="#FFFFFF" />
        <circle cx="62" cy="15" r="9" fill="#FFFFFF" />
        <rect x="34" y="18" width="32" height="9" rx="2" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.5" />
      `;
      break;
    case 'beanie':
      accessorySVG = `
        <path d="M27,31 C27,13 73,13 73,31 Z" fill="#EF4444" />
        <rect x="25" y="27" width="50" height="7" rx="3.5" fill="#B91C1C" />
        <circle cx="50" cy="11" r="5" fill="#FEF08A" />
      `;
      break;
    case 'hairpin':
      accessorySVG = `
        <circle cx="67" cy="33" r="4.5" fill="#F472B6" />
        <circle cx="67" cy="33" r="2" fill="#FDE047" />
      `;
      break;
    case 'chick':
      accessorySVG = `
        <circle cx="50" cy="16" r="7" fill="#FDE047" />
        <circle cx="48" cy="15" r="1" fill="#1F2937" />
        <polygon points="50,16 54,17 50,18" fill="#F97316" />
      `;
      break;
  }

  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="rounded-full shrink-0 shadow-sm border-2 border-white" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="${bg}" />
      ${backHairSVG}
      <!-- 脖子與耳朵 -->
      <rect x="43" y="64" width="14" height="15" rx="4" fill="${skin.shadow}" />
      <circle cx="27" cy="50" r="5" fill="${skin.hex}" />
      <circle cx="73" cy="50" r="5" fill="${skin.hex}" />
      <!-- 衣服 -->
      ${outfitSVG}
      <!-- 臉型 -->
      <rect x="28" y="26" width="44" height="44" rx="21" fill="${skin.hex}" />
      <!-- 腮紅 -->
      <ellipse cx="35" cy="54" rx="4" ry="2.2" fill="#FDA4AF" opacity="0.65" />
      <ellipse cx="65" cy="54" rx="4" ry="2.2" fill="#FDA4AF" opacity="0.65" />
      <!-- 表情與前髮 -->
      ${eyesSVG}
      ${frontHairSVG}
      ${accessorySVG}
    </svg>
  `;
}

// ================= 六位小鎮 NPC 固定角色立繪生成器 =================

export function renderNpcAvatarSVG(npcId, size = 64) {
    let content = '';

    switch (npcId) {
      case 'grandma_chen': // 陳阿嬤：銀白包頭捲髮、老花眼鏡、慈祥笑眼、紅圍巾與針織衫
        content = `
          <rect width="100" height="100" fill="#FDE68A" />
          <!-- 銀白髮髻 -->
          <circle cx="50" cy="19" r="13" fill="#D1D5DB" />
          <circle cx="30" cy="36" r="9" fill="#E5E7EB" />
          <circle cx="70" cy="36" r="9" fill="#E5E7EB" />
          <!-- 脖子與針織上衣 -->
          <rect x="43" y="64" width="14" height="14" rx="4" fill="#DFA882" />
          <path d="M20,98 C20,76 80,76 80,98 Z" fill="#B45309" />
          <!-- 過年紅圍巾 -->
          <path d="M32,74 Q50,84 68,74 L65,84 Q50,92 35,84 Z" fill="#DC2626" />
          <rect x="54" y="80" width="9" height="18" rx="3" fill="#B91C1C" />
          <!-- 臉型與慈祥皺紋 -->
          <rect x="28" y="27" width="44" height="43" rx="20" fill="#F3C6A5" />
          <ellipse cx="35" cy="55" rx="4.5" ry="2.5" fill="#FDA4AF" opacity="0.6" />
          <ellipse cx="65" cy="55" rx="4.5" ry="2.5" fill="#FDA4AF" opacity="0.6" />
          <!-- 銀白瀏海 -->
          <path d="M26,44 C26,22 74,22 74,44 C64,34 36,34 26,44 Z" fill="#E5E7EB" />
          <!-- 笑眼與圓框眼鏡 -->
          <path d="M35,49 Q40,44 45,49" fill="none" stroke="#374151" stroke-width="2.4" stroke-linecap="round" />
          <path d="M55,49 Q60,44 65,49" fill="none" stroke="#374151" stroke-width="2.4" stroke-linecap="round" />
          <circle cx="40" cy="49" r="8" fill="none" stroke="#78350F" stroke-width="1.8" />
          <circle cx="60" cy="49" r="8" fill="none" stroke="#78350F" stroke-width="1.8" />
          <line x1="48" y1="49" x2="52" y2="49" stroke="#78350F" stroke-width="1.8" />
          <path d="M44,58 Q50,65 56,58 Z" fill="#FB7185" />
        `;
        break;

      case 'captain_hai': // 海伯：古銅膚色、白鬍子、海軍藍船長服與金錨船長帽
        content = `
          <rect width="100" height="100" fill="#BAE6FD" />
          <rect x="43" y="64" width="14" height="14" rx="4" fill="#A66E40" />
          <!-- 海軍藍船長外套 -->
          <path d="M20,98 C20,76 80,76 80,98 Z" fill="#1E3A8A" />
          <path d="M42,76 L50,92 L58,76 Z" fill="#FFFFFF" />
          <circle cx="36" cy="86" r="2.2" fill="#FACC15" />
          <circle cx="64" cy="86" r="2.2" fill="#FACC15" />
          <!-- 臉型 -->
          <rect x="28" y="28" width="44" height="42" rx="20" fill="#C68B59" />
          <!-- 豪邁白鬍子 -->
          <path d="M28,52 C28,72 72,72 72,52 C66,58 58,56 50,56 C42,56 34,58 28,52 Z" fill="#F3F4F6" />
          <path d="M38,56 Q50,51 62,56 Q56,61 50,59 Q44,61 38,56 Z" fill="#E5E7EB" />
          <!-- 爽朗笑眼 -->
          <path d="M35,47 Q40,42 45,47" fill="none" stroke="#1F2937" stroke-width="2.6" stroke-linecap="round" />
          <path d="M55,47 Q60,42 65,47" fill="none" stroke="#1F2937" stroke-width="2.6" stroke-linecap="round" />
          <!-- 船長大盤帽 -->
          <ellipse cx="50" cy="27" rx="32" ry="7" fill="#172554" />
          <path d="M24,26 C24,10 76,10 76,26 Z" fill="#FFFFFF" stroke="#1E3A8A" stroke-width="1.5" />
          <rect x="27" y="23" width="46" height="4" fill="#1E3A8A" />
          <circle cx="50" cy="18" r="3.5" fill="#FACC15" />
        `;
        break;

      case 'boss_lin': // 林老闆：油頭、單片金邊眼鏡、小鬍子與深紫珠寶商背心
        content = `
          <rect width="100" height="100" fill="#E9D5FF" />
          <rect x="43" y="64" width="14" height="14" rx="4" fill="#DFA882" />
          <!-- 紳士背心與藍寶領結 -->
          <path d="M20,98 C20,76 80,76 80,98 Z" fill="#581C87" />
          <path d="M40,76 L50,96 L60,76 Z" fill="#FFFFFF" />
          <polygon points="50,78 46,84 50,90 54,84" fill="#0284C7" />
          <!-- 臉型 -->
          <rect x="28" y="27" width="44" height="43" rx="20" fill="#F5CBA7" />
          <!-- 俐落旁分油頭 -->
          <path d="M26,44 C25,18 75,18 74,44 C68,31 46,29 36,35 C31,38 28,41 26,44 Z" fill="#1F2937" />
          <!-- 精明眼神與單片金框眼鏡 -->
          <circle cx="40" cy="49" r="2.6" fill="#1F2937" />
          <circle cx="60" cy="49" r="2.6" fill="#1F2937" />
          <circle cx="60" cy="49" r="8.5" fill="none" stroke="#D97706" stroke-width="2" />
          <path d="M68,51 Q73,62 71,72" fill="none" stroke="#D97706" stroke-width="1.2" stroke-dasharray="2,2" />
          <!-- 紳士八字鬍 -->
          <path d="M43,58 Q50,55 57,58" fill="none" stroke="#374151" stroke-width="2.2" stroke-linecap="round" />
          <path d="M45,62 Q50,65 55,62" fill="none" stroke="#9A3412" stroke-width="1.8" stroke-linecap="round" />
        `;
        break;

      case 'vet_fang': // 小芳姊：栗色高馬尾、白大褂、聽診器與愛心髮夾
        content = `
          <rect width="100" height="100" fill="#FBCFE8" />
          <!-- 栗色高馬尾 -->
          <path d="M66,30 Q89,32 86,62 Q77,54 67,48 Z" fill="#78350F" />
          <rect x="43" y="64" width="14" height="14" rx="4" fill="#F3C6B0" />
          <!-- 獸醫白袍與聽診器 -->
          <path d="M20,98 C20,76 80,76 80,98 Z" fill="#FFFFFF" />
          <path d="M40,76 L50,94 L60,76 Z" fill="#6EE7B7" />
          <path d="M37,76 C37,90 63,90 63,76" fill="none" stroke="#475569" stroke-width="2.5" />
          <circle cx="50" cy="88" r="3.5" fill="#94A3B8" stroke="#334155" stroke-width="1.2" />
          <!-- 臉型 -->
          <rect x="28" y="27" width="44" height="43" rx="20" fill="#FDE6D8" />
          <ellipse cx="35" cy="54" rx="4" ry="2.2" fill="#FDA4AF" opacity="0.7" />
          <ellipse cx="65" cy="54" rx="4" ry="2.2" fill="#FDA4AF" opacity="0.7" />
          <!-- 溫柔大眼與笑容 -->
          <circle cx="40" cy="49" r="3" fill="#1F2937" />
          <circle cx="60" cy="49" r="3" fill="#1F2937" />
          <circle cx="41" cy="48" r="1" fill="#FFFFFF" />
          <circle cx="61" cy="48" r="1" fill="#FFFFFF" />
          <path d="M45,57 Q50,63 55,57 Z" fill="#FB7185" />
          <!-- 瀏海與小紅十字髮夾 -->
          <path d="M26,44 C26,20 74,20 74,44 C64,34 52,38 50,35 C46,38 34,34 26,44 Z" fill="#78350F" />
          <rect x="64" y="31" width="8" height="3" rx="1" fill="#EF4444" />
          <rect x="66.5" y="28.5" width="3" height="8" rx="1" fill="#EF4444" />
        `;
        break;

      case 'mayor_wang': // 王村長：花白頭髮、濃眉大鬍子、西裝領帶與村長榮譽徽章
        content = `
          <rect width="100" height="100" fill="#A7F3D0" />
          <rect x="43" y="64" width="14" height="14" rx="4" fill="#DFA882" />
          <!-- 體面西裝與紅領帶 -->
          <path d="M20,98 C20,76 80,76 80,98 Z" fill="#065F46" />
          <path d="M41,76 L50,94 L59,76 Z" fill="#FFFFFF" />
          <polygon points="50,77 47,82 50,95 53,82" fill="#DC2626" />
          <!-- 金色村長徽章 -->
          <circle cx="65" cy="86" r="4.5" fill="#FACC15" stroke="#B45309" stroke-width="1.2" />
          <!-- 臉型 -->
          <rect x="28" y="27" width="44" height="43" rx="20" fill="#F5CBA7" />
          <!-- 花白短髮 -->
          <path d="M26,43 C26,19 74,19 74,43 C66,33 34,33 26,43 Z" fill="#6B7280" />
          <!-- 濃眉與親切眼神 -->
          <line x1="34" y1="42" x2="44" y2="43" stroke="#4B5563" stroke-width="3" stroke-linecap="round" />
          <line x1="66" y1="42" x2="56" y2="43" stroke="#4B5563" stroke-width="3" stroke-linecap="round" />
          <path d="M36,49 Q40,45 44,49" fill="none" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round" />
          <path d="M56,49 Q60,45 64,49" fill="none" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round" />
          <!-- 招牌八字大鬍子 -->
          <path d="M38,57 Q50,51 62,57 Q56,62 50,59 Q44,62 38,57 Z" fill="#6B7280" />
        `;
        break;

      default: // peddler_cai 行腳商人阿財：頭巾、俏皮眨眼、旅人背帶與金幣吊飾
        content = `
          <rect width="100" height="100" fill="#C7D2FE" />
          <rect x="43" y="64" width="14" height="14" rx="4" fill="#C99268" />
          <!-- 旅人服裝與行囊背帶 -->
          <path d="M20,98 C20,76 80,76 80,98 Z" fill="#0D9488" />
          <line x1="34" y1="76" x2="66" y2="98" stroke="#78350F" stroke-width="5" />
          <circle cx="50" cy="87" r="4" fill="#FACC15" />
          <!-- 臉型 -->
          <rect x="28" y="27" width="44" height="43" rx="20" fill="#E5B289" />
          <!-- 俏皮眨眼與露齒笑 -->
          <circle cx="40" cy="49" r="2.8" fill="#1F2937" />
          <path d="M55,49 Q60,44 65,49" fill="none" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round" />
          <path d="M44,57 Q50,65 56,57 Z" fill="#FFFFFF" stroke="#9A3412" stroke-width="1.5" />
          <!-- 橘黃色行腳頭巾 -->
          <path d="M26,38 C26,18 74,18 74,38 Z" fill="#EA580C" />
          <rect x="26" y="33" width="48" height="6" rx="2" fill="#FACC15" />
          <polygon points="73,35 83,31 80,41" fill="#EA580C" />
        `;
    }

    return `
      <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="rounded-full shrink-0 shadow-sm border-2 border-white" xmlns="http://www.w3.org/2000/svg">
        ${content}
      </svg>
    `;
}

// ================= 二頭身 Q 版小人全身生成器（透明背景，供 2D 地圖使用） =================

function normalizeChibiConfig(cfg = {}) {
  const rawSkin = typeof cfg.skin === 'string' && cfg.skin.startsWith('#') ? cfg.skin : null;
  const rawHair = typeof cfg.hairColor === 'string' && cfg.hairColor.startsWith('#') ? cfg.hairColor : null;
  const skinTone = AVATAR_OPTIONS.skinTones.find(tone => tone.id === cfg.skinTone);
  const hairColor = AVATAR_OPTIONS.hairColors.find(color => color.id === cfg.hairColor);
  const outfitColors = {
    overalls: '#2563eb',
    apron: '#b45309',
    vest: '#1e3a8a',
    smith_gear: '#57534e',
    festive_red: '#dc2626',
    sweater: '#7c3aed',
    tang_suit: '#dc2626',
    cape: '#15803d'
  };

  return {
    skin: cfg.skinColor || rawSkin || skinTone?.hex || '#f5cba7',
    hairColor: rawHair || hairColor?.hex || '#5c3a21',
    hairStyle: cfg.hairStyle || cfg.hair || 'short',
    outfit: cfg.outfit || cfg.clothes || 'overalls',
    outfitColor: cfg.outfitColor || cfg.clothesColor || outfitColors[cfg.outfit] || '#2563eb',
    hat: cfg.hat || cfg.accessory || 'none'
  };
}

/**
 * 渲染玩家二頭身 Q 版全身小人（viewBox 100x120，背景全透明）
 * @param {object} config 玩家紙娃娃設定
 * @param {number} walkFrame 0=待機, 1=左腳跨步, 2=右腳跨步
 */
export function renderChibiPlayerSVG(config = {}, walkFrame = 0) {
  const c = normalizeChibiConfig(config);
  const leftLegY = walkFrame === 1 ? -4 : walkFrame === 2 ? 2 : 0;
  const rightLegY = walkFrame === 2 ? -4 : walkFrame === 1 ? 2 : 0;
  const leftArmRot = walkFrame === 1 ? -18 : walkFrame === 2 ? 16 : 0;
  const rightArmRot = walkFrame === 2 ? 18 : walkFrame === 1 ? -16 : 0;
  const capeSway = walkFrame === 1 ? -3 : walkFrame === 2 ? 3 : 0;

  let backHair = '';
  if (['long', 'ponytail', 'twintails', 'curly', 'bun'].includes(c.hairStyle)) {
    backHair = `
      <path d="M24,42 C20,64 26,76 34,76 L66,76 C74,76 80,64 76,42 Z" fill="${c.hairColor}" stroke="#3e2723" stroke-width="2.5" />
    `;
  }

  let backCape = '';
  if (c.outfit === 'cape') {
    backCape = `
      <path d="M31,70 L${21 + capeSway},99 Q50,104 ${79 + capeSway},99 L69,70 Z" fill="#b91c1c" stroke="#450a0a" stroke-width="2.4" stroke-linejoin="round" />
    `;
  }

  let hatLayer = '';
  if (c.hat === 'straw_hat' || c.hat === 'sunhat') {
    hatLayer = `
      <ellipse cx="50" cy="24" rx="34" ry="8" fill="#facc15" stroke="#854d0e" stroke-width="2.2" />
      <path d="M30,23 C30,10 70,10 70,23 Z" fill="#fde047" stroke="#854d0e" stroke-width="2.2" />
      <rect x="31" y="19" width="38" height="4" rx="2" fill="#dc2626" />
    `;
  } else if (c.hat === 'chef_hat') {
    hatLayer = `
      <path d="M31,24 C27,15 35,10 41,15 C44,6 56,6 59,15 C67,10 75,15 69,24 Z" fill="#ffffff" stroke="#3e2723" stroke-width="2.2" />
      <rect x="31" y="22" width="38" height="6" rx="2" fill="#e5e7eb" stroke="#3e2723" stroke-width="1.8" />
    `;
  } else if (c.hat === 'beanie' || c.hat === 'cap') {
    hatLayer = `
      <path d="M27,26 C27,11 73,11 73,26 Z" fill="#dc2626" stroke="#450a0a" stroke-width="2.2" />
      <ellipse cx="50" cy="25" rx="23" ry="5" fill="#b91c1c" stroke="#450a0a" stroke-width="2" />
      ${c.hat === 'beanie' ? '<circle cx="50" cy="12" r="4" fill="#facc15" />' : ''}
    `;
  } else if (['hairpin', 'ribbon', 'flower', 'chick'].includes(c.hat)) {
    hatLayer = c.hat === 'chick'
      ? `
        <ellipse cx="50" cy="20" rx="10" ry="8" fill="#facc15" stroke="#854d0e" stroke-width="1.8" />
        <circle cx="47" cy="19" r="1" fill="#292524" />
        <circle cx="53" cy="19" r="1" fill="#292524" />
        <path d="M49,22 L53,23 L49,24 Z" fill="#f97316" />
      `
      : `
        <circle cx="68" cy="22" r="6" fill="#fb7185" stroke="#881337" stroke-width="2" />
        <circle cx="68" cy="22" r="2.5" fill="#fef08a" />
      `;
  }

  let torsoSvg = '';
  if (c.outfit === 'tang_suit') {
    torsoSvg = `
      <rect x="35" y="86" width="30" height="11" rx="4" fill="#1e293b" stroke="#3e2723" stroke-width="2.2" />
      <rect x="34" y="70" width="32" height="20" rx="7" fill="#dc2626" stroke="#7f1d1d" stroke-width="2.4" />
      <path d="M41,70 L50,76 L59,70" fill="none" stroke="#facc15" stroke-width="2.4" stroke-linecap="round" />
      <line x1="50" y1="75" x2="50" y2="90" stroke="#facc15" stroke-width="1.8" />
      <line x1="45" y1="79" x2="55" y2="79" stroke="#facc15" stroke-width="2" stroke-linecap="round" />
      <line x1="45" y1="84" x2="55" y2="84" stroke="#facc15" stroke-width="2" stroke-linecap="round" />
    `;
  } else if (c.outfit === 'cape') {
    torsoSvg = `
      <rect x="35" y="70" width="30" height="26" rx="8" fill="#15803d" stroke="#3e2723" stroke-width="2.4" />
      <rect x="35" y="86" width="30" height="4" fill="#78350f" />
      <rect x="47" y="85" width="6" height="6" rx="1" fill="#facc15" />
      <path d="M32,70 Q50,82 68,70 L65,78 Q50,87 35,78 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="2" />
      <circle cx="50" cy="78" r="2.8" fill="#facc15" stroke="#854d0e" stroke-width="1.2" />
    `;
  } else if (c.outfit === 'dress' || c.outfit === 'apron') {
    torsoSvg = `
      <path d="M35,70 L65,70 L71,97 L29,97 Z" fill="${c.outfitColor}" stroke="#3e2723" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M39,72 L61,72 L64,95 L36,95 Z" fill="#fffbeb" opacity="0.88" />
    `;
  } else {
    torsoSvg = `
      <rect x="35" y="70" width="30" height="24" rx="8" fill="#fef08a" stroke="#3e2723" stroke-width="2.5" />
      <path d="M36,78 L64,78 L66,97 L52,97 L52,90 L48,90 L48,97 L34,97 Z" fill="${c.outfitColor}" stroke="#3e2723" stroke-width="2.4" stroke-linejoin="round" />
      <rect x="39" y="70" width="5" height="10" fill="${c.outfitColor}" stroke="#3e2723" stroke-width="1.8" />
      <rect x="56" y="70" width="5" height="10" fill="${c.outfitColor}" stroke="#3e2723" stroke-width="1.8" />
      <circle cx="41.5" cy="79" r="1.8" fill="#facc15" />
      <circle cx="58.5" cy="79" r="1.8" fill="#facc15" />
    `;
  }

  return `
    <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
      ${backHair}
      ${backCape}

      <g transform="translate(0, ${leftLegY})">
        <rect x="37" y="94" width="10" height="14" rx="4" fill="${c.skin}" stroke="#3e2723" stroke-width="2.2" />
        <ellipse cx="41" cy="109" rx="7.5" ry="4.8" fill="#78350f" stroke="#3e2723" stroke-width="2.2" />
      </g>
      <g transform="translate(0, ${rightLegY})">
        <rect x="53" y="94" width="10" height="14" rx="4" fill="${c.skin}" stroke="#3e2723" stroke-width="2.2" />
        <ellipse cx="59" cy="109" rx="7.5" ry="4.8" fill="#78350f" stroke="#3e2723" stroke-width="2.2" />
      </g>

      <g transform="rotate(${leftArmRot}, 34, 74)">
        <rect x="25" y="71" width="10" height="19" rx="5" fill="${c.skin}" stroke="#3e2723" stroke-width="2.2" />
      </g>
      <g transform="rotate(${rightArmRot}, 66, 74)">
        <rect x="65" y="71" width="10" height="19" rx="5" fill="${c.skin}" stroke="#3e2723" stroke-width="2.2" />
      </g>

      ${torsoSvg}

      <rect x="24" y="18" width="52" height="50" rx="23" fill="${c.skin}" stroke="#3e2723" stroke-width="2.8" />

      <ellipse cx="33" cy="52" rx="5" ry="2.8" fill="#fda4af" opacity="0.75" />
      <ellipse cx="67" cy="52" rx="5" ry="2.8" fill="#fda4af" opacity="0.75" />
      <circle cx="39" cy="45" r="3.4" fill="#292524" />
      <circle cx="61" cy="45" r="3.4" fill="#292524" />
      <circle cx="40.2" cy="43.8" r="1.2" fill="#ffffff" />
      <circle cx="62.2" cy="43.8" r="1.2" fill="#ffffff" />
      <path d="M45,54 Q50,60 55,54" fill="none" stroke="#7c2d12" stroke-width="2.5" stroke-linecap="round" />

      <path d="M23,41 C22,15 78,15 77,41 C68,29 56,34 50,30 C44,34 32,29 23,41 Z" fill="${c.hairColor}" stroke="#3e2723" stroke-width="2.5" stroke-linejoin="round" />

      ${hatLayer}
    </svg>
  `;
}

    /**
     * 渲染六位村民 NPC 的二頭身 Q 版全身小人（透明背景）
     */
    export function renderChibiNpcSVG(npcId) {
        const presets = {
          grandma_chen: {
            skin: '#f3c6a5',
            hair: '#e5e7eb',
            topColor: '#b45309',
            bottomColor: '#78350f',
            extraHead: `
              <circle cx="50" cy="13" r="11" fill="#d1d5db" stroke="#3e2723" stroke-width="2.2" />
              <circle cx="39" cy="45" r="7.5" fill="none" stroke="#78350f" stroke-width="1.8" />
              <circle cx="61" cy="45" r="7.5" fill="none" stroke="#78350f" stroke-width="1.8" />
              <line x1="46.5" y1="45" x2="53.5" y2="45" stroke="#78350f" stroke-width="1.8" />
            `,
            extraBody: `<path d="M34,71 Q50,81 66,71 L63,81 Q50,88 37,81 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.6" />`
          },
          captain_hai: {
            skin: '#c68b59',
            hair: '#f3f4f6',
            topColor: '#1e3a8a',
            bottomColor: '#172554',
            extraHead: `
              <ellipse cx="50" cy="21" rx="31" ry="6.5" fill="#172554" />
              <path d="M27,20 C27,8 73,8 73,20 Z" fill="#ffffff" stroke="#1e3a8a" stroke-width="2.2" />
              <circle cx="50" cy="14" r="3.2" fill="#facc15" />
              <path d="M30,49 C30,68 70,68 70,49 C62,55 38,55 30,49 Z" fill="#f3f4f6" stroke="#4b5563" stroke-width="1.8" />
            `,
            extraBody: `<circle cx="43" cy="80" r="2" fill="#facc15" /><circle cx="57" cy="80" r="2" fill="#facc15" />`
          },
          boss_lin: {
            skin: '#f5cba7',
            hair: '#1f2937',
            topColor: '#581c87',
            bottomColor: '#3b0764',
            extraHead: `
              <circle cx="61" cy="45" r="8" fill="none" stroke="#d97706" stroke-width="2" />
              <path d="M43,54 Q50,51 57,54" fill="none" stroke="#374151" stroke-width="2.2" stroke-linecap="round" />
            `,
            extraBody: `<polygon points="50,72 46,79 50,86 54,79" fill="#0284c7" />`
          },
          vet_fang: {
            skin: '#fde6d8',
            hair: '#78350f',
            topColor: '#ffffff',
            bottomColor: '#10b981',
            extraHead: `
              <path d="M68,24 Q88,26 84,54 Q76,46 68,40 Z" fill="#78350f" stroke="#3e2723" stroke-width="2" />
              <rect x="63" y="25" width="8" height="3" rx="1" fill="#ef4444" />
              <rect x="65.5" y="22.5" width="3" height="8" rx="1" fill="#ef4444" />
            `,
            extraBody: `<path d="M38,71 C38,85 62,85 62,71" fill="none" stroke="#475569" stroke-width="2.4" />`
          },
          mayor_wang: {
            skin: '#f5cba7',
            hair: '#6b7280',
            topColor: '#065f46',
            bottomColor: '#022c22',
            extraHead: `
              <path d="M38,54 Q50,48 62,54 Q56,59 50,56 Q44,59 38,54 Z" fill="#6b7280" />
            `,
            extraBody: `
              <polygon points="50,71 47,76 50,91 53,76" fill="#dc2626" />
              <circle cx="60" cy="80" r="3.8" fill="#facc15" stroke="#b45309" stroke-width="1.2" />
            `
          },
          peddler_cai: {
            skin: '#e5b289',
            hair: '#451a03',
            topColor: '#0d9488',
            bottomColor: '#78350f',
            extraHead: `
              <path d="M25,31 C25,13 75,13 75,31 Z" fill="#ea580c" stroke="#431407" stroke-width="2.2" />
              <rect x="25" y="27" width="50" height="5" rx="2" fill="#facc15" />
            `,
            extraBody: `<line x1="36" y1="71" x2="64" y2="95" stroke="#78350f" stroke-width="4.5" />`
          }
        };

        const p = presets[npcId] || presets.peddler_cai;

        return `
          <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
            <rect x="37" y="94" width="10" height="14" rx="4" fill="${p.skin}" stroke="#3e2723" stroke-width="2.2" />
            <ellipse cx="41" cy="109" rx="7.5" ry="4.8" fill="#451a03" stroke="#3e2723" stroke-width="2.2" />
            <rect x="53" y="94" width="10" height="14" rx="4" fill="${p.skin}" stroke="#3e2723" stroke-width="2.2" />
            <ellipse cx="59" cy="109" rx="7.5" ry="4.8" fill="#451a03" stroke="#3e2723" stroke-width="2.2" />

            <rect x="25" y="71" width="10" height="19" rx="5" fill="${p.skin}" stroke="#3e2723" stroke-width="2.2" />
            <rect x="65" y="71" width="10" height="19" rx="5" fill="${p.skin}" stroke="#3e2723" stroke-width="2.2" />

            <rect x="34" y="70" width="32" height="26" rx="9" fill="${p.topColor}" stroke="#3e2723" stroke-width="2.5" />
            <rect x="35" y="88" width="30" height="9" rx="4" fill="${p.bottomColor}" stroke="#3e2723" stroke-width="2" />
            ${p.extraBody || ''}

            <rect x="24" y="18" width="52" height="50" rx="23" fill="${p.skin}" stroke="#3e2723" stroke-width="2.8" />
            <ellipse cx="33" cy="52" rx="4.5" ry="2.5" fill="#fda4af" opacity="0.65" />
            <ellipse cx="67" cy="52" rx="4.5" ry="2.5" fill="#fda4af" opacity="0.65" />
            <circle cx="39" cy="45" r="3.2" fill="#292524" />
            <circle cx="61" cy="45" r="3.2" fill="#292524" />
            <path d="M45,55 Q50,60 55,55" fill="none" stroke="#7c2d12" stroke-width="2.4" stroke-linecap="round" />

            <path d="M23,40 C22,15 78,15 77,40 C67,29 33,29 23,40 Z" fill="${p.hair}" stroke="#3e2723" stroke-width="2.5" />
            ${p.extraHead || ''}
          </svg>
        `;
    }
