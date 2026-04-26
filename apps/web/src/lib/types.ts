/**
 * lib/types.ts — 全域共用型別定義
 * 對齊 DB schema + pattern-engine API 回傳格式
 */

// ─── 身材測量值（FreeSewing standard keys，單位 cm，前端顯示用）───────────────
export interface Measurements {
  chest?: number
  waist?: number
  hips?: number
  neck?: number
  seat?: number
  hpsToWaistBack?: number
  shoulderToWrist?: number
  shoulderWidth?: number
  highBust?: number
  biceps?: number
  wrist?: number
  inseam?: number
  [key: string]: number | undefined
}

// ─── 身材檔案 ─────────────────────────────────────────────────────────────────
export interface BodyProfile {
  id: string
  user_id: string
  label: string
  measurements: Measurements   // 前端顯示用 cm；送 API 時轉 mm
  source: 'manual' | 'photo_estimate' | 'import'
  is_default: boolean
  created_at: string
}

// ─── AI 分析結果 ──────────────────────────────────────────────────────────────
export interface FabricInfo {
  name: string
  composition_estimate: string
  drape: number          // 0–10
  thickness: number      // 0–10
  translucency: number   // 0–10
  stretch: number        // 0–10
}

export interface GarmentAnalysis {
  fabric: {
    primary: FabricInfo
    secondary: FabricInfo | null
  }
  cut: {
    silhouette: string
    construction_lines: string[]
    darts: number
    ease_estimate: string
  }
  components: {
    collar: string | null
    sleeves: string | null
    pockets: string | null
    closures: string | null
  }
  closest_freesewing_patterns: Array<{
    design: string
    confidence: number
    suggested_options: Record<string, unknown>
  }>
  silhouette_tags: string[]
  craft_recommendations: {
    seam_allowance_mm: number
    pressing_notes: string
    thread_color: string
  }
}

// ─── 版型 ─────────────────────────────────────────────────────────────────────
export interface PatternCatalogItem {
  id: string
  fs_design_id: string
  name: string
  family: string
  gender_hint: string
  difficulty: number
  thumbnail_url?: string
}

export interface PatternInstance {
  id: string
  design: string
  svg?: string
  renderProps?: object
  logs: object
  created_at: string
}

// ─── API 請求 / 回應 ──────────────────────────────────────────────────────────
export interface DraftRequest {
  user_id: string
  design: string
  body_profile_id: string
  options?: Record<string, unknown>
  sa?: number
  paperless?: boolean
  render_mode?: 'svg' | 'props'
  gender?: 'cisFemale' | 'cisMale'
}

export interface ApiError {
  error: string
  detail?: string
}
