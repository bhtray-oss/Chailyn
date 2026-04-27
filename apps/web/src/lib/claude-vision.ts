/**
 * claude-vision.ts — 呼叫 Anthropic Claude Vision 分析服裝照片
 * 伺服器端工具，僅供 Next.js API routes 使用
 */
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

/**
 * 讀取 ANTHROPIC_API_KEY：
 * 優先順序：process.env → .env.local（直接讀檔，避免 shell 空值蓋掉）
 */
function getApiKey(): string {
  // 1. process.env 有值（且非空字串）
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return process.env.ANTHROPIC_API_KEY.trim()
  }
  // 2. 直接從 .env.local 讀取（cwd = apps/web/）
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    const content = fs.readFileSync(envPath, 'utf-8')
    const match   = content.match(/^ANTHROPIC_API_KEY=(.+)$/m)
    const key     = match?.[1]?.trim()
    if (key) return key
  } catch {
    // 檔案不存在，繼續往下拋錯
  }
  throw new Error(
    'ANTHROPIC_API_KEY 未設定。\n' +
    '請在 apps/web/.env.local 加入：\n' +
    'ANTHROPIC_API_KEY=sk-ant-...\n' +
    '（前往 https://console.anthropic.com/keys 取得）'
  )
}

const SYSTEM_PROMPT = `你是專業服裝打版師與材料分析師，精通 Patternmaking for Fashion Design（Helen Joseph-Armstrong）書中的版型術語與工藝標準。
請檢視圖中服裝並以 JSON 輸出詳細分析結果。
只回傳 JSON，不加任何前置說明或 markdown code fence。
若某項資訊無法從圖判讀，回傳 null 並在 reasoning 欄說明。`

const USER_PROMPT = `請分析這件服裝的版型結構與材質特徵，以下列 JSON schema 輸出：

{
  "fabric": {
    "primary": {
      "name": "布料名稱（中文，例：棉質府綢、羊毛混紡、針織棉）",
      "composition_estimate": "成分估計（例：棉80%/聚酯20%）",
      "weight": "light | medium | heavy",
      "drape": 0,
      "thickness": 0,
      "translucency": 0,
      "stretch": 0,
      "stretch_pct_estimate": 0
    },
    "secondary": null
  },
  "cut": {
    "silhouette": "下列之一：sheath | shift | box_fit | princess | panel | empire | tent | a_line | trapeze | oversized | fitted | semi_fitted | straight | bias_cut",
    "fit_ease": "fitted | semi_fitted | relaxed | oversized",
    "waist_treatment": "dart | seam | elastic | drawstring | none",
    "construction_lines": [],
    "darts_count": 0,
    "stylelines": []
  },
  "components": {
    "collar": {
      "type": "basic_shirt_collar | convertible | notched_lapel | shawl_collar | peter_pan | flat_collar | sailor | mandarin | stand_collar | turtleneck | mock_neck | cowl | hood | crew_neck | v_neck | scoop_neck | square_neck | off_shoulder | strapless | halter | none",
      "height_cm": null,
      "description": ""
    },
    "sleeves": {
      "type": "set_in | tailored_two_piece | bishop | puff_cap | puff_hem | bell | lantern | leg_of_mutton | cap_sleeve | petal | kimono | raglan | drop_shoulder | dolman | sleeveless | tank | spaghetti",
      "length": "sleeveless | cap | short | elbow | three_quarter | long",
      "cuff_type": "basic_shirt_cuff | french_cuff | contoured | roll_up | ribbed | elastic | open | none",
      "description": ""
    },
    "pockets": {
      "type": "patch | welt | double_welt | bound | in_seam | flap | cargo | kangaroo | none",
      "count": 0,
      "location": ""
    },
    "closures": {
      "type": "button_front | button_back | double_breasted | zipper_center_back | zipper_side | zipper_fly | invisible_zipper | wrap_tie | elastic_waist | hook_eye | snap | drawstring | lace_up | none",
      "button_count": null,
      "description": ""
    }
  },
  "garment_category": "top | bottom | outerwear | lingerie | block | dress",
  "garment_type_detail": "更具體的款式描述",
  "skirt_type": null,
  "pant_type": null,
  "closest_freesewing_patterns": [
    {
      "design": "aaron | bella | bibi | brian | carlita | carlton | huey | lily | paco | sandy | simon | simone | teagan | titan | waralee",
      "confidence": 0.0,
      "reasoning": "為何匹配的說明",
      "suggested_options": {}
    }
  ],
  "silhouette_tags": [],
  "craft_recommendations": {
    "seam_allowance_mm": 10,
    "pressing_notes": "",
    "thread_color": "",
    "interfacing_needed": false,
    "lining_suggested": false,
    "notions": []
  },
  "difficulty_estimate": 1,
  "reasoning": ""
}

判斷規則：
- silhouette 依 Armstrong 定義：sheath=雙省合身; shift=單省半合身; box_fit=無省寬鬆; princess=縱向分割無腰省
- 針織布（stretch>1）優先考慮 teagan/aaron/bibi；梭織合身優先 simon/simone/bella
- 有缺角駁領且有結構感→ carlton；連帽+羅紋→ huey
- 圍裹裙→ sandy；圍裹褲→ waralee；鬆緊腰褲→ paco
- difficulty_estimate：1=初學者; 2=入門; 3=中級; 4=高級（含裡布/駁領/複雜工藝）`

export async function analyzeGarmentPhoto(
  imageBuffer: Buffer,
  mediaType: string,
): Promise<Record<string, unknown>> {
  const apiKey = getApiKey()
  const client = new Anthropic({ apiKey })
  const b64 = imageBuffer.toString('base64')

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: b64,
            },
          },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
  })

  let rawText = (message.content[0] as { type: string; text: string }).text.trim()

  // 移除可能的 code fence
  if (rawText.startsWith('```')) {
    const parts = rawText.split('```')
    rawText = parts[1] ?? parts[0]
    if (rawText.startsWith('json')) rawText = rawText.slice(4).trim()
  }

  return JSON.parse(rawText) as Record<string, unknown>
}
