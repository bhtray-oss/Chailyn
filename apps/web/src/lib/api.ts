/**
 * lib/api.ts — 統一 API 呼叫層
 * 所有前端 fetch 呼叫都走這裡，方便統一處理 error / token
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.detail ?? err.error ?? 'API error')
  }
  return res.json()
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUserResponse {
  id:               string
  email:            string
  display_name:     string
  role:             string
  subscription_tier: string
}

export interface AuthTokenResponse {
  access_token:  string
  token_type:    string
  expires_in:    number
  user:          AuthUserResponse
}

export const authApi = {
  /** Called by AuthContext directly via fetch('/api/auth/login') — kept for completeness */
  login: (email: string, password: string) =>
    request<AuthTokenResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, displayName: string) =>
    request<AuthTokenResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName }),
    }),

  getUser: (userId: string) =>
    request<AuthUserResponse>(`/auth/user/${userId}`),

  /** Get current user from Bearer token */
  me: (accessToken: string) =>
    request<AuthUserResponse>('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
}

// ─── Body Profiles ────────────────────────────────────────────────────────────
export const profileApi = {
  list: (userId: string, includeHistory = false) =>
    request(`/profiles/${userId}${includeHistory ? '?include_history=true' : ''}`),

  get: (profileId: string) =>
    request(`/profiles/detail/${profileId}`),

  create: (
    userId: string,
    label: string,
    measurements: Record<string, number>,
    notes?: string,
  ) =>
    request('/profiles/', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, label, measurements, notes: notes ?? null }),
    }),

  /** 更新：後端建新版本，回傳 new_profile_id */
  update: (profileId: string, measurements: Record<string, number>, notes?: string, label?: string) =>
    request(`/profiles/${profileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ measurements, notes: notes ?? null, label: label ?? null }),
    }),
}

// ─── Draft Parameters ─────────────────────────────────────────────────────────
export interface OptionEntry {
  value: string | number | boolean
  source: 'ai' | 'default'
  choices: string[]
}

export interface DraftParamsAlternative {
  design: string
  confidence: number
  description_zh: string
}

export interface DraftParamsResponse {
  design: string
  confidence: number
  alternatives: DraftParamsAlternative[]
  options: Record<string, OptionEntry>
  armstrong: Record<string, number | string>
  reasoning: string[]
  warning?: string
}

// ─── Analyses ─────────────────────────────────────────────────────────────────
export const analysisApi = {
  uploadPhoto: async (userId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(
      `${API_BASE}/analyses/upload?user_id=${userId}`,
      { method: 'POST', body: form }
    )
    if (!res.ok) throw new Error('Upload failed')
    return res.json()
  },

  analyze: (photoId: string, userId: string) =>
    request<{ result: import('./types').GarmentAnalysis }>('/analyses/analyze', {
      method: 'POST',
      body: JSON.stringify({ photo_id: photoId, user_id: userId }),
    }),

  get: (analysisId: string) =>
    request(`/analyses/${analysisId}`),

  getDraftParams: async (
    analysisId: string,
    profileId: string,
    design?: string,
  ): Promise<DraftParamsResponse> => {
    const params = new URLSearchParams({ profile_id: profileId })
    if (design) params.set('design', design)
    const res = await fetch(`${API_BASE}/analyses/${analysisId}/draft-params?${params}`)
    if (!res.ok) throw new Error(`draft-params failed: ${res.status}`)
    return res.json()
  },
}

// ─── Analysis Jobs（非同步輪詢） ───────────────────────────────────────────────
export type JobStatus = 'pending' | 'running' | 'done' | 'failed'

export interface AnalysisJob {
  job_id:      string
  status:      JobStatus
  result?:     import('./types').GarmentAnalysis
  error?:      string
  analysis_id?: string
  created_at:  string
  started_at?: string
  finished_at?: string
}

export const jobApi = {
  /** 建立非同步分析 Job，立即回傳 job_id */
  create: (photoId: string, userId: string) =>
    request<{ job_id: string; status: JobStatus }>('/analyses/jobs', {
      method: 'POST',
      body: JSON.stringify({ photo_id: photoId, user_id: userId }),
    }),

  /** 查詢 Job 狀態（前端每 1 秒輪詢一次） */
  poll: (jobId: string) =>
    request<AnalysisJob>(`/analyses/jobs/${jobId}`),

  /**
   * 輪詢直到完成或失敗，回傳最終 Job。
   * intervalMs  輪詢間隔（ms），預設 1000（1 秒，讓結果盡快呈現）
   * timeoutMs   最長等待時間（ms），預設 120000（2 分鐘）
   */
  waitUntilDone: async (
    jobId: string,
    onUpdate?: (job: AnalysisJob) => void,
    intervalMs = 1000,
    timeoutMs  = 120_000,
  ): Promise<AnalysisJob> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const job = await jobApi.poll(jobId)
      onUpdate?.(job)
      if (job.status === 'done' || job.status === 'failed') return job
      await new Promise(r => setTimeout(r, intervalMs))
    }
    throw new Error('TIMEOUT')
  },
}

// ─── Analysis History ─────────────────────────────────────────────────────────
export interface AnalysisHistoryItem {
  job_id:       string
  photo_id:     string
  status:       string
  result:       import('./types').GarmentAnalysis
  analysis_id:  string
  created_at:   string
  finished_at:  string
  mime_type:    string
  file_size_kb: number
  visibility:   'public' | 'private'
}

export const historyApi = {
  /** 列出使用者所有已完成的分析 */
  list: (userId: string) =>
    request<AnalysisHistoryItem[]>(`/analyses/user/${userId}`),

  /** 照片縮圖 URL（直接給 <img src> 用） */
  photoUrl: (photoId: string) =>
    `${API_BASE}/analyses/photo/${photoId}`,

  /** 刪除一筆分析記錄 */
  delete: (jobId: string, userId: string) =>
    request(`/analyses/jobs/${jobId}?user_id=${userId}`, { method: 'DELETE' }),

  /** 切換分析可見性 */
  setVisibility: (photoId: string, userId: string, visibility: 'public' | 'private') =>
    request<{ photo_id: string; visibility: string }>(
      `/analyses/photo/${photoId}/visibility`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility, user_id: userId }),
      },
    ),
}

// ─── Patterns ─────────────────────────────────────────────────────────────────
export interface CatalogItem {
  id:             string
  source:         string          // 'freesewing' | 'mood_fabrics'
  fs_design_id:   string | null
  name:           string
  family:         string | null
  gender_hint:    string | null
  difficulty:     number | null
  garment_type:   string | null
  fabric_weight:  string | null
  description_zh: string | null
  description_en: string | null
  tags:           string[] | null
  season:         string[] | null
  skill_notes_zh: string | null
  download_url:   string | null
  thumbnail_url:  string | null
  is_active:      boolean
}

export const patternApi = {
  listDesigns: () =>
    request<{ designs: string[] }>('/patterns/designs'),

  listCatalog: (params?: { family?: string; source?: string }) => {
    const qs = new URLSearchParams()
    if (params?.family) qs.set('family', params.family)
    if (params?.source) qs.set('source', params.source)
    const q = qs.toString()
    return request<CatalogItem[]>(`/patterns/catalog/list${q ? `?${q}` : ''}`)
  },

  draft: (params: {
    userId: string
    design: string
    bodyProfileId: string
    options?: Record<string, unknown>
    sa?: number
    paperless?: boolean
    renderMode?: 'svg' | 'props'
    gender?: string
    aiSourcePhotoId?: string
    aiConfidence?: number
  }) =>
    request('/patterns/draft', {
      method: 'POST',
      body: JSON.stringify({
        user_id: params.userId,
        design: params.design,
        body_profile_id: params.bodyProfileId,
        options: params.options ?? {},
        sa: params.sa ?? 10,
        paperless: params.paperless ?? false,
        render_mode: params.renderMode ?? 'svg',
        gender: params.gender ?? 'cisFemale',
        ai_source_photo_id: params.aiSourcePhotoId,
        ai_confidence: params.aiConfidence,
      }),
    }),

  sample: (params: {
    design: string
    mode: 'option' | 'measurement' | 'models'
    measurements?: Record<string, number>
    sampleOption?: string
    sampleMeasurement?: string
    gender?: string
  }) =>
    request('/patterns/sample', {
      method: 'POST',
      body: JSON.stringify({
        design: params.design,
        mode: params.mode,
        measurements: params.measurements ?? {},
        sample_option: params.sampleOption,
        sample_measurement: params.sampleMeasurement,
        gender: params.gender ?? 'cisFemale',
      }),
    }),

  getInstance: (instanceId: string) =>
    request(`/patterns/${instanceId}`),

  /** Redraft：基於現有版本重新打版 */
  redraft: (params: {
    instanceId: string
    userId: string
    bodyProfileId?: string
    options?: Record<string, unknown>
    sa?: number
    paperless?: boolean
    renderMode?: 'svg' | 'props'
    gender?: string
    title?: string
    notes?: string
  }) =>
    request('/patterns/redraft', {
      method: 'POST',
      body: JSON.stringify({
        instance_id:     params.instanceId,
        user_id:         params.userId,
        body_profile_id: params.bodyProfileId,
        options:         params.options,
        sa:              params.sa,
        paperless:       params.paperless,
        render_mode:     params.renderMode ?? 'svg',
        gender:          params.gender ?? 'cisFemale',
        title:           params.title,
        notes:           params.notes,
      }),
    }),

  /** 使用者衣櫃（所有版型最新版） */
  listUserPatterns: (userId: string) =>
    request<WardrobeItem[]>(`/patterns/user/${userId}`),

  /** 版本鏈歷程 */
  getHistory: (instanceId: string) =>
    request<{ design: string; user_id: string; versions: VersionEntry[] }>(
      `/patterns/history/${instanceId}`
    ),
}

export interface WardrobeItem {
  id:               string
  design:           string
  version:          number
  title:            string | null
  notes:            string | null
  options_snapshot: Record<string, unknown>
  sa:               number
  paperless:        boolean
  created_at:       string
  parent_instance_id: string | null
  created_by_ai:    boolean
  ai_confidence:    number | null
  total_versions:   number
  has_svg:          boolean
}

// ─── DXF 匯出 ─────────────────────────────────────────────────────────────────
export const dxfApi = {
  /** 觸發下載 DXF，不經 request()，直接操作 window */
  download: async (instanceId: string, filename?: string) => {
    const res = await fetch(`${API_BASE}/patterns/dxf/${instanceId}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail ?? 'DXF 匯出失敗')
    }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename ?? `pattern_${instanceId.slice(0, 8)}.dxf`
    a.click()
    URL.revokeObjectURL(url)
  },
}

// ─── BOM ─────────────────────────────────────────────────────────────────────
export interface BomItem {
  id:        string
  category:  string
  name_zh:   string
  name_en:   string | null
  qty_value: number
  qty_unit:  string
  width_mm:  number | null
  notes:     string | null
}

export interface BomResponse {
  instance_id: string
  groups:      Record<string, BomItem[]>
  total:       number
}

export const bomApi = {
  get:      (instanceId: string) => request<BomResponse>(`/bom/${instanceId}`),
  generate: (instanceId: string) => request<{ generated: number; design: string }>(`/bom/${instanceId}/generate`, { method: 'POST' }),
  addItem:  (instanceId: string, item: Omit<BomItem, 'id'>) =>
    request<{ item_id: string }>(`/bom/${instanceId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),
  updateItem: (itemId: string, patch: Partial<Pick<BomItem, 'qty_value' | 'qty_unit' | 'notes' | 'name_zh'>>) =>
    request(`/bom/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteItem: (itemId: string) =>
    request(`/bom/items/${itemId}`, { method: 'DELETE' }),
}

// ─── Search ───────────────────────────────────────────────────────────────────
export interface CatalogSearchResult {
  fs_design_id:   string
  name:           string
  description_zh: string | null
  description_en: string | null
  garment_type:   string | null
  fabric_weight:  string | null
  difficulty:     number
  tags:           string[] | null
  season:         string[] | null
  score:          number
  source:         string | null          // 'freesewing' | 'mood_fabrics'
  download_url:   string | null          // Mood Fabrics PDF page URL
}

export const searchApi = {
  query: (query: string, topK = 6, garmentType?: string, fabricWeight?: string) =>
    request<CatalogSearchResult[]>('/search/query', {
      method: 'POST',
      body: JSON.stringify({ query, top_k: topK, garment_type: garmentType, fabric_weight: fabricWeight }),
    }),
  similarByAnalysis: (analysisId: string, topK = 5) =>
    request<CatalogSearchResult[]>(`/search/similar/${analysisId}?top_k=${topK}`),
}

// ─── Recommendations ─────────────────────────────────────────────────────────
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
    difficulty:  number
    hours_min:   number
    hours_max:   number
    cost_ntd:    number
    retail_ntd:  number
  }
  mood_patterns: Array<{ code: string; name: string; similarity: number }>
}

export const recommendationsApi = {
  generate: async (
    analysis: Record<string, unknown>,
    measurements?: Record<string, number>,
    lang: 'zh' | 'en' = 'zh',
  ): Promise<RecommendationsResult> => {
    const res = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis, measurements: measurements ?? {}, lang }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail ?? 'API error')
    }
    return res.json()
  },
}

export interface VersionEntry {
  id:                 string
  version:            number
  title:              string | null
  notes:              string | null
  sa:                 number
  paperless:          boolean
  options_snapshot:   Record<string, unknown>
  created_at:         string
  parent_instance_id: string | null
  has_svg:            boolean
}

// ─── Armstrong Draft ──────────────────────────────────────────────────────────
export interface ArmstrongFormulaRow {
  ch:       string
  ref:      string
  zh:       string
  en:       string
  formula:  string
  val_in:   number
  val_mm:   number
  note:     string
  warning?: boolean
}

export interface ArmstrongPoint {
  x: number
  y: number
}

export interface ArmstrongMeasurements {
  m5_cf_length:        number
  m6_full_length:      number
  m7_shoulder_slope:   number
  m9_bust_depth:       number
  m10_bust_span:       number
  m11_side_length:     number
  m13_shoulder_len:    number
  m14_across_shoulder: number
  m15_across_chest:    number
  m16_across_back:     number
  m17_bust_arc:        number
  m18_back_arc:        number
  m19_waist_arc:       number
  m20_dart_placement:  number
  hip_arc:             number
  hip_depth:           number
  cb_length:           number
}

export interface ArmstrongDraftResult {
  armstrong_measurements: ArmstrongMeasurements
  formula_rows:   ArmstrongFormulaRow[]
  front_points:   Record<string, ArmstrongPoint>
  back_points:    Record<string, ArmstrongPoint | number>
  warnings:       string[]
  bw_diff:        number
}

export const armstrongApi = {
  getDraft: (userId: string) =>
    request<ArmstrongDraftResult>(`/armstrong/draft?user_id=${userId}`),
}
