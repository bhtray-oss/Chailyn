/**
 * garment-i18n.ts
 * Shared translation helpers for garment analysis data.
 * Used by analyze/page.tsx, history/page.tsx, recommendations/page.tsx.
 */

// ── CJK detection ─────────────────────────────────────────────────────────────
export const hasCJK = (s: string): boolean => /[一-鿿㐀-䶿]/.test(s)

// ── Enum label maps ────────────────────────────────────────────────────────────
export const SILHOUETTE_LABEL: Record<string, { zh: string; en: string }> = {
  sheath:    { zh: '合身直筒', en: 'Sheath' },
  shift:     { zh: '半合身',   en: 'Shift' },
  box_fit:   { zh: '箱型',     en: 'Box Fit' },
  princess:  { zh: '公主線',   en: 'Princess' },
  panel:     { zh: '縱向拼接', en: 'Panel' },
  empire:    { zh: '高腰線',   en: 'Empire' },
  tent:      { zh: '帳篷型',   en: 'Tent' },
  a_line:    { zh: 'A字形',    en: 'A-Line' },
  trapeze:   { zh: '梯形',     en: 'Trapeze' },
  bias_cut:  { zh: '斜裁',     en: 'Bias Cut' },
  wrap:      { zh: '交疊式',   en: 'Wrap' },
  pleated:   { zh: '褶裙',     en: 'Pleated' },
  oversized: { zh: '廓形',     en: 'Oversized' },
  straight:  { zh: '直筒',     en: 'Straight' },
  fitted:    { zh: '合身',     en: 'Fitted' },
}

export const EASE_LABEL: Record<string, { zh: string; en: string }> = {
  fitted:      { zh: '合身',   en: 'Fitted' },
  semi_fitted: { zh: '半合身', en: 'Semi-Fitted' },
  relaxed:     { zh: '寬鬆',   en: 'Relaxed' },
  oversized:   { zh: '超寬鬆', en: 'Oversized' },
}

export const WAIST_LABEL: Record<string, { zh: string; en: string }> = {
  dart:      { zh: '腰省',   en: 'Dart' },
  seam:      { zh: '腰縫',   en: 'Seam' },
  elastic:   { zh: '鬆緊帶', en: 'Elastic' },
  drawstring:{ zh: '束繩',   en: 'Drawstring' },
  none:      { zh: '無腰部處理', en: 'None' },
}

export const COLLAR_LABEL: Record<string, { zh: string; en: string }> = {
  none:               { zh: '無領',     en: 'Collarless' },
  crew_neck:          { zh: '圓領',     en: 'Crew Neck' },
  v_neck:             { zh: 'V領',      en: 'V-Neck' },
  scoop_neck:         { zh: '船領',     en: 'Scoop Neck' },
  square_neck:        { zh: '方領',     en: 'Square Neck' },
  turtleneck:         { zh: '高領',     en: 'Turtleneck' },
  mock_neck:          { zh: '半高領',   en: 'Mock Neck' },
  cowl:               { zh: '堆堆領',   en: 'Cowl Neck' },
  mandarin:           { zh: '中式立領', en: 'Mandarin' },
  stand_collar:       { zh: '立領',     en: 'Stand Collar' },
  peter_pan:          { zh: '娃娃領',   en: 'Peter Pan' },
  flat_collar:        { zh: '平領',     en: 'Flat Collar' },
  sailor:             { zh: '水手領',   en: 'Sailor' },
  shawl_collar:       { zh: '青果領',   en: 'Shawl Collar' },
  notched_lapel:      { zh: '西裝領',   en: 'Notched Lapel' },
  basic_shirt_collar: { zh: '襯衫領',   en: 'Shirt Collar' },
  convertible:        { zh: '翻折領',   en: 'Convertible' },
  hood:               { zh: '連帽',     en: 'Hood' },
  strapless:          { zh: '無肩帶',   en: 'Strapless' },
  halter:             { zh: '掛脖',     en: 'Halter' },
  off_shoulder:       { zh: '一字領',   en: 'Off-Shoulder' },
}

export const SLEEVE_LABEL: Record<string, { zh: string; en: string }> = {
  sleeveless:         { zh: '無袖',         en: 'Sleeveless' },
  tank:               { zh: '背心袖',       en: 'Tank' },
  cap_sleeve:         { zh: '帽袖',         en: 'Cap Sleeve' },
  set_in:             { zh: '裝袖',         en: 'Set-In' },
  raglan:             { zh: '插肩袖',       en: 'Raglan' },
  drop_shoulder:      { zh: '落肩',         en: 'Drop Shoulder' },
  dolman:             { zh: '蝙蝠袖',       en: 'Dolman' },
  kimono:             { zh: '和服袖',       en: 'Kimono' },
  bishop:             { zh: '主教袖',       en: 'Bishop' },
  bell:               { zh: '喇叭袖',       en: 'Bell Sleeve' },
  puff_cap:           { zh: '泡泡帽袖',     en: 'Puff Cap Sleeve' },
  puff_hem:           { zh: '袖口泡泡袖',   en: 'Puff-Hem Sleeve' },
  lantern:            { zh: '燈籠袖',       en: 'Lantern Sleeve' },
  tailored_two_piece: { zh: '兩片袖',       en: 'Tailored 2-Piece' },
  wide_strap:         { zh: '寬肩帶',       en: 'Wide Strap' },
  spaghetti:          { zh: '細肩帶',       en: 'Spaghetti Strap' },
}

export const SLEEVE_LENGTH_LABEL: Record<string, { zh: string; en: string }> = {
  sleeveless:    { zh: '無袖',   en: 'Sleeveless' },
  cap:           { zh: '帽袖',   en: 'Cap' },
  short:         { zh: '短袖',   en: 'Short' },
  elbow:         { zh: '肘袖',   en: 'Elbow' },
  three_quarter: { zh: '七分',   en: '¾' },
  long:          { zh: '長袖',   en: 'Long' },
}

/** Render an API enum code as a human-readable label. */
export function prettyLabel(
  code: string | undefined | null,
  map: Record<string, { zh: string; en: string }>,
  lang: 'zh' | 'en',
): string {
  if (!code) return '—'
  const entry = map[code.toLowerCase()]
  if (entry) return entry[lang]
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Chinese silhouette tag → English (for legacy records) ─────────────────────
const ZH_TAG_EN: Record<string, string> = {
  '直筒': 'Straight', '合身直筒': 'Sheath', '半合身': 'Shift',
  '箱型': 'Box Fit', '公主線': 'Princess', '縱向拼接': 'Panel',
  '高腰線': 'Empire', '帳篷型': 'Tent', 'A字形': 'A-Line', 'A字': 'A-Line',
  '梯形': 'Trapeze', '斜裁': 'Bias Cut', '交疊式': 'Wrap',
  '褶裙': 'Pleated', '廓形': 'Oversized', '合身': 'Fitted',
  '寬鬆': 'Relaxed', '超寬鬆': 'Oversized', '無袖': 'Sleeveless',
  '短袖': 'Short Sleeve', '長袖': 'Long Sleeve', '七分袖': '¾ Sleeve',
  '高腰': 'High Waist', '自然腰': 'Natural Waist', '低腰': 'Low Waist',
  '不對稱下擺': 'Asymmetric Hem', '不對稱': 'Asymmetric',
  '燈籠袖': 'Lantern Sleeve', '泡泡袖': 'Puff Sleeve',
  '荷葉邊': 'Ruffle', '蕾絲': 'Lace', '刺繡': 'Embroidery',
  '拼色': 'Color Block', '條紋': 'Stripe', '格紋': 'Plaid',
  '公主線縫': 'Princess Seams', '縱向分割': 'Vertical Panel',
}

/** Translate a silhouette tag (handles Chinese legacy strings and enum codes). */
export function translateTag(
  tag: string,
  lang: 'zh' | 'en',
): string {
  if (!tag) return tag
  if (lang === 'zh') return tag
  // Already English?
  if (!hasCJK(tag)) return tag
  // Direct lookup
  if (ZH_TAG_EN[tag]) return ZH_TAG_EN[tag]
  // Try matching any key as substring
  for (const [zh, en] of Object.entries(ZH_TAG_EN)) {
    if (tag.includes(zh)) return en
  }
  return tag
}

/** Build a sleeve display string from type + length, avoiding duplication. */
export function formatSleeve(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sleevesObj: any,
  lang: 'zh' | 'en',
): string | null {
  if (!sleevesObj || typeof sleevesObj !== 'object') {
    return typeof sleevesObj === 'string' ? sleevesObj : null
  }
  const type   = sleevesObj.type   as string | undefined
  const length = sleevesObj.length as string | undefined

  const typeLabel = type   ? prettyLabel(type,   SLEEVE_LABEL,        lang) : null
  const lenLabel  = length ? prettyLabel(length, SLEEVE_LENGTH_LABEL, lang) : null

  if (!typeLabel) return lenLabel
  // Avoid duplication: "Sleeveless Sleeveless"
  if (lenLabel && lenLabel.toLowerCase() !== typeLabel.toLowerCase()) {
    return `${typeLabel} · ${lenLabel}`
  }
  return typeLabel
}

/** Read a bilingual field: tries `field_en`/`field_zh` first, then base field. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function biField(obj: any, field: string, lang: 'zh' | 'en'): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined
  const variant = obj[`${field}_${lang}`]
  if (variant && typeof variant === 'string') return variant
  const base = obj[field]
  if (base && typeof base === 'string') return base
  return undefined
}

// ── Fibre map (longest-first) ─────────────────────────────────────────────────
export const FIBRE_MAP: [string, string][] = [
  ['美麗諾羊毛', 'Merino Wool'], ['醋酸纖維', 'Acetate'],
  ['聚酯纖維', 'Polyester'],    ['彈性纖維', 'Elastane'],
  ['彈力纖維', 'Elastane'],     ['彈力素材', 'Elastane'],
  ['人造絲',   'Rayon'],        ['莫代爾',   'Modal'],
  ['天絲',     'Tencel'],       ['銅氨絲',   'Cupro'],
  ['嫘縈',     'Rayon'],        ['黏膠纖維', 'Viscose'],      ['金屬纖維', 'Metallic Fiber'],
  ['黏膠',     'Viscose'],      ['粘膠',     'Viscose'],
  ['錦綸',     'Nylon'],
  ['尼龍',     'Nylon'],        ['氨綸',     'Spandex'],
  ['聚酯',     'Polyester'],    ['羊毛',     'Wool'],
  ['蠶絲',     'Silk'],         ['亞麻',     'Linen'],
  ['棉質',     'Cotton'],       ['純棉',     'Cotton'],
  ['棉',       'Cotton'],       ['麻',       'Linen'],
  ['絲',       'Silk'],         ['緞',       'Satin'],
  ['綢',       'Silk'],         ['其他',     'Other'],
]

export function fibreEN(zh: string): string {
  for (const [key, val] of FIBRE_MAP) {
    if (zh.includes(key)) return val
  }
  return zh
}

function compSegment(norm: string): string {
  const parts = norm.split(/[/／；;、·+]/).map(s => s.trim()).filter(Boolean)
  return parts.map(part => {
    const mA = part.match(/^([一-鿿㐀-䶿]+)\s*(\d+(?:\.\d+)?%?)$/)
    if (mA) { const en = fibreEN(mA[1]); return mA[2] ? `${mA[2]} ${en}` : en }
    const mB = part.match(/^(\d+(?:\.\d+)?%?)\s*([一-鿿㐀-䶿]+)$/)
    if (mB) { const en = fibreEN(mB[2]); return mB[1] ? `${mB[1]} ${en}` : en }
    if (hasCJK(part)) return fibreEN(part)
    return part
  }).join(' / ')
}

/** Translate Chinese composition strings to English. */
export function translateComposition(raw: string): string {
  if (!raw || !hasCJK(raw)) return raw
  const norm = raw.replace(/％/g, '%').replace(/（/g, '(').replace(/）/g, ')')
  if (norm.includes('或')) {
    return norm.split('或').map(s => compSegment(s.trim())).join(' or ')
  }
  return compSegment(norm)
}

// Entries sorted longest-first — do NOT reorder
export const FABRIC_NAME_MAP: [string, string][] = [
  ['中厚羊毛混紡',     'Medium-weight Wool Blend'],
  ['棉質斜紋布或混紡府綢', 'Cotton Twill or Blended Poplin'],
  ['棉質斜紋布',       'Cotton Twill'],
  ['棉質府綢',         'Cotton Poplin'],
  ['棉質平紋布',       'Cotton Plain Weave'],
  ['混紡府綢',         'Blended Poplin'],
  ['混紡斜紋',         'Blended Twill'],
  ['雙面緞面布',       'Double-faced Satin'],
  ['杜邦緞',           'Dupont Satin'],
  ['絲緞',             'Silk Satin'],
  ['緞面布',           'Satin Fabric'],
  ['羅紋針織棉',       'Cotton Rib Knit'],
  ['聚酯混紡平織布',   'Polyester Blend Woven'],
  ['聚酯仿毛料',       'Polyester Faux Wool'],
  ['針織棉',           'Jersey Cotton'],
  ['彈力棉',           'Stretch Cotton'],
  ['純棉布',           'Cotton Fabric'],
  ['羊毛混紡',         'Wool Blend'],
  ['羊毛呢',           'Wool Boucle'],
  ['精紡羊毛',         'Fine Wool'],
  ['棉麻混紡',         'Cotton-Linen Blend'],
  ['亞麻布',           'Linen Fabric'],
  ['絲質雪紡',         'Silk Chiffon'],
  ['印花雪紡',         'Printed Chiffon'],
  ['薄型喬其紗',       'Light Georgette'],
  ['喬其紗',           'Georgette'],
  ['雪紡',             'Chiffon'],
  ['仿毛料',           'Faux Wool'],
  ['緞面',             'Satin'],
  ['絲絨',             'Velvet'],
  ['針織布',           'Jersey Knit'],
  ['羅紋',             'Rib Knit'],
  ['彈力布',           'Stretch Fabric'],
  ['平紋布',           'Plain Weave'],
  ['平織布',           'Plain Weave'],
  ['斜紋布',           'Twill'],
  ['府綢',             'Poplin'],
  ['帆布',             'Canvas'],
  ['牛仔布',           'Denim'],
  ['面料',             'Fabric'],
  ['布料',             'Fabric'],
  ['薄型',             'Lightweight'],
  ['重磅',             'Heavyweight'],
  ['棉質',             'Cotton'],
  ['羊毛',             'Wool'],
  ['亞麻',             'Linen'],
  ['絲質',             'Silk'],
  ['混紡',             'Blend'],
]

/** Translate Chinese fabric names for legacy records. */
export function translateFabricName(raw: string): string {
  if (!raw || !hasCJK(raw)) return raw
  let result = raw
  result = result.replace(/（[^）]*）/g, m => hasCJK(m) ? '' : m)
  result = result.replace(/／/g, ' / ')
  for (const [zh, en] of FABRIC_NAME_MAP) {
    // Pad with spaces so adjacent translated words don't merge (e.g. "HeavyweightCotton")
    result = result.split(zh).join(` ${en} `)
  }
  for (const [key, val] of FIBRE_MAP) {
    result = result.replace(new RegExp(key, 'g'), ` ${val} `)
  }
  return result
    .replace(/或/g, ' or ')
    .replace(/及|和/g, ' & ')
    // Strip any CJK characters that couldn't be translated
    .replace(/[一-鿿㐀-䶿]+/g, '')
    // Normalise spaces around slashes and clean up multi-spaces
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
