/**
 * POST /api/recommendations
 * 根據 AI 分析結果與身材數據，呼叫 Claude 產生「為你量身推薦」結構化 JSON
 * Accepts lang: 'zh' | 'en' to control output language.
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

// ── API key ───────────────────────────────────────────────────────────────────
function getApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return process.env.ANTHROPIC_API_KEY.trim()
  try {
    const content = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8')
    const match   = content.match(/^ANTHROPIC_API_KEY=(.+)$/m)
    const key     = match?.[1]?.trim()
    if (key) return key
  } catch { /* ignore */ }
  throw new Error('ANTHROPIC_API_KEY not set')
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface RecommendationsResult {
  pattern_adjustments: string[]
  fabric: {
    primary:     string
    alternative: string
    avoid:       string
  }
  colors: Array<{ hex: string; name: string }>
  color_notes: string[]
  style_variants: Array<{ occasion: string; description: string }>
  shopping_list: Array<{ item: string; qty: string; price_ntd: number }>
  production: {
    difficulty:  number   // 1–4
    hours_min:   number
    hours_max:   number
    cost_ntd:    number
    retail_ntd:  number
  }
  mood_patterns: Array<{ code: string; name: string; similarity: number }>
}

// ── System prompts ────────────────────────────────────────────────────────────
const SYSTEM_ZH = `你是專業服裝設計顧問，精通版型打版（Armstrong 體系）與材料學。
根據 AI 服裝分析結果以及使用者身材，產生個人化裁縫建議，以 JSON 輸出。
只回傳 JSON，不加任何前置說明或 markdown code fence。`

const SYSTEM_EN = `You are a professional garment design consultant, expert in pattern making (Armstrong system) and textile science.
Based on AI garment analysis results and the user's body measurements, generate personalized sewing recommendations as JSON.
Return only JSON, with no preamble or markdown code fence.`

function buildUserPrompt(
  analysis: Record<string, unknown>,
  measurements: Record<string, number>,
  lang: 'zh' | 'en',
): string {
  const isEn = lang === 'en'
  const unknown = isEn ? 'unknown' : '未知'

  const chest  = measurements.chest  ? `${(measurements.chest  / 10).toFixed(1)} cm` : unknown
  const waist  = measurements.waist  ? `${(measurements.waist  / 10).toFixed(1)} cm` : unknown
  const hips   = measurements.hips   ? `${(measurements.hips   / 10).toFixed(1)} cm` : unknown
  const height = measurements.height ? `${(measurements.height / 10).toFixed(1)} cm` : unknown

  const topDesign  = (analysis.closest_freesewing_patterns as any[])?.[0]?.design ?? unknown
  const fabric     = (analysis.fabric as any)?.primary?.name ?? unknown
  const silhouette = (analysis.cut as any)?.silhouette ?? unknown
  const garment    = (analysis as any)?.garment_type_detail ?? (analysis as any)?.garment_category ?? (isEn ? 'garment' : '服裝')
  const difficulty = (analysis as any)?.difficulty_estimate ?? 2

  if (isEn) {
    return `User measurements: chest ${chest}, waist ${waist}, hips ${hips}, height ${height}

AI-analyzed garment:
- Style: ${garment}
- Silhouette: ${silhouette}
- Primary fabric: ${fabric}
- Recommended pattern: ${topDesign}
- Original analysis difficulty: ${difficulty}/4

Output personalized recommendations using the JSON schema below. All text descriptions must be in English:

{
  "pattern_adjustments": [
    "Pattern modification note for this body (2–5 items, e.g. 'Add 1.5 cm to chest width', 'Deepen waist dart by 0.5 cm')"
  ],
  "fabric": {
    "primary":     "Best fabric for this style (name + weight, e.g. Cotton poplin 130g/m²)",
    "alternative": "Alternative choice (with brief reason)",
    "avoid":       "Fabric to avoid (with reason)"
  },
  "colors": [
    { "hex": "#RRGGBB", "name": "Color name in English" }
  ],
  "color_notes": [
    "Color pairing advice (1–2 items)"
  ],
  "style_variants": [
    { "occasion": "Work", "description": "Specific styling suggestion" },
    { "occasion": "Date", "description": "Specific styling suggestion" },
    { "occasion": "Casual", "description": "Specific styling suggestion" }
  ],
  "shopping_list": [
    { "item": "Material name", "qty": "Quantity with unit", "price_ntd": number }
  ],
  "production": {
    "difficulty": ${difficulty},
    "hours_min":  number,
    "hours_max":  number,
    "cost_ntd":   material cost estimate (integer NTD),
    "retail_ntd": comparable retail price estimate in Taiwan (integer NTD)
  },
  "mood_patterns": [
    {
      "code":       "Mood Fabrics or commercial pattern code (e.g. MDF163, Simplicity 1234…)",
      "name":       "Pattern name in English",
      "similarity": similarity percentage (integer 0–100)
    }
  ]
}

Rules:
- colors: provide 4–5 colors, choose realistic fabric swatch colors with correct hex values
- shopping_list: include main fabric, lining (if any), thread, zipper/buttons/elastic (per style), other notions; 4–7 items total
- mood_patterns: list 2–4 real commercial patterns, similarity based on style match
- production.cost_ntd is material cost only (no labor); retail_ntd is comparable style price in Taiwan
- All text descriptions must be in English`
  }

  return `使用者身材：胸圍 ${chest}、腰圍 ${waist}、臀圍 ${hips}、身高 ${height}

AI 分析到的服裝：
- 款式：${garment}
- 廓形：${silhouette}
- 主布：${fabric}
- 推薦版型：${topDesign}
- 原始分析難度：${difficulty}/4

請依照以下 JSON schema 輸出個人化建議：

{
  "pattern_adjustments": [
    "針對此身材的版型修改說明（2–5 條，如「胸寬 +1.5 cm」「腰省縫份加深 0.5 cm」）"
  ],
  "fabric": {
    "primary":     "最適合此款式的布料（中文名稱＋克重，例：棉質府綢 130g/m²）",
    "alternative": "替代選擇（附簡短理由）",
    "avoid":       "應避免的材質（附理由）"
  },
  "colors": [
    { "hex": "#RRGGBB", "name": "顏色中文名" }
  ],
  "color_notes": [
    "配色建議說明（1–2 條）"
  ],
  "style_variants": [
    { "occasion": "上班版", "description": "具體搭配建議" },
    { "occasion": "約會版", "description": "具體搭配建議" },
    { "occasion": "日常版", "description": "具體搭配建議" }
  ],
  "shopping_list": [
    { "item": "材料名稱", "qty": "數量（含單位）", "price_ntd": 數字 }
  ],
  "production": {
    "difficulty": ${difficulty},
    "hours_min":  數字,
    "hours_max":  數字,
    "cost_ntd":   材料總成本估算（整數 NTD）,
    "retail_ntd": 市售相近款式零售價估算（整數 NTD）
  },
  "mood_patterns": [
    {
      "code":       "Mood Fabrics 或知名樣板代號（如 MDF163、Simplicity 1234…）",
      "name":       "版型英文名稱",
      "similarity": 相似度百分比（整數 0–100）
    }
  ]
}

規則：
- colors 提供 4–5 個顏色，選擇真實可用的布料色票，hex 要正確
- shopping_list 包含主布、副布（如有）、縫線、拉鍊/鈕釦/鬆緊帶（視款式）、其他輔料；共 4–7 項
- mood_patterns 列出 2–4 個真實存在的商業版型，similarity 根據款式相似度估算
- production.cost_ntd 是材料成本（不含工時）；retail_ntd 是台灣市售相近款式價格
- 所有文字說明用繁體中文`
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { analysis: Record<string, unknown>; measurements?: Record<string, number>; lang?: 'zh' | 'en' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid request format' }, { status: 400 })
  }

  const { analysis, measurements = {}, lang = 'zh' } = body
  if (!analysis) return NextResponse.json({ detail: 'Missing analysis' }, { status: 400 })

  try {
    const client = new Anthropic({ apiKey: getApiKey() })
    const message = await client.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 2000,
      system:     lang === 'en' ? SYSTEM_EN : SYSTEM_ZH,
      messages: [{
        role:    'user',
        content: buildUserPrompt(analysis, measurements, lang),
      }],
    })

    let raw = ((message.content[0] as { type: string; text: string }).text ?? '').trim()

    // Strip possible code fence
    if (raw.startsWith('```')) {
      const parts = raw.split('```')
      raw = parts[1] ?? parts[0]
      if (raw.startsWith('json')) raw = raw.slice(4).trim()
    }

    const result = JSON.parse(raw) as RecommendationsResult
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ detail: msg }, { status: 502 })
  }
}
