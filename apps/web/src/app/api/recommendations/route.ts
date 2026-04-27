/**
 * POST /api/recommendations
 * 根據 AI 分析結果與身材數據，呼叫 Claude 產生「為你量身推薦」結構化 JSON
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

// ── API key (same fallback logic as claude-vision.ts) ────────────────────────
function getApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return process.env.ANTHROPIC_API_KEY.trim()
  try {
    const content = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8')
    const match   = content.match(/^ANTHROPIC_API_KEY=(.+)$/m)
    const key     = match?.[1]?.trim()
    if (key) return key
  } catch { /* ignore */ }
  throw new Error('ANTHROPIC_API_KEY 未設定')
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

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM = `你是專業服裝設計顧問，精通版型打版（Armstrong 體系）與材料學。
根據 AI 服裝分析結果以及使用者身材，產生個人化裁縫建議，以 JSON 輸出。
只回傳 JSON，不加任何前置說明或 markdown code fence。`

function buildUserPrompt(analysis: Record<string, unknown>, measurements: Record<string, number>): string {
  const chest = measurements.chest  ? `${(measurements.chest  / 10).toFixed(1)} cm` : '未知'
  const waist = measurements.waist  ? `${(measurements.waist  / 10).toFixed(1)} cm` : '未知'
  const hips  = measurements.hips   ? `${(measurements.hips   / 10).toFixed(1)} cm` : '未知'
  const height = measurements.height ? `${(measurements.height / 10).toFixed(1)} cm` : '未知'

  const topDesign = (analysis.closest_freesewing_patterns as any[])?.[0]?.design ?? '未知'
  const fabric    = (analysis.fabric as any)?.primary?.name ?? '未知'
  const silhouette = (analysis.cut as any)?.silhouette ?? '未知'
  const garment   = (analysis as any)?.garment_type_detail ?? (analysis as any)?.garment_category ?? '服裝'
  const difficulty = (analysis as any)?.difficulty_estimate ?? 2

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
  let body: { analysis: Record<string, unknown>; measurements?: Record<string, number> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ detail: '請求格式錯誤' }, { status: 400 })
  }

  const { analysis, measurements = {} } = body
  if (!analysis) return NextResponse.json({ detail: '缺少 analysis' }, { status: 400 })

  try {
    const client = new Anthropic({ apiKey: getApiKey() })
    const message = await client.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 2000,
      system:     SYSTEM,
      messages: [{
        role:    'user',
        content: buildUserPrompt(analysis, measurements),
      }],
    })

    let raw = ((message.content[0] as { type: string; text: string }).text ?? '').trim()

    // 移除可能的 code fence
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
