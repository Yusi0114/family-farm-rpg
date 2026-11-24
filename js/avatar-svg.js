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
    { id: 'sweater', name: '暖暖針織毛衣' }
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