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
export const authApi = {
  register: (email: string, displayName: string) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, display_name: displayName }),
    }),

  getUser: (userId: string) =>
    request(`/auth/user/${userId}`),
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

  /** 查詢 Job 狀態（前端每 2 秒輪詢一次） */
  poll: (jobId: string) =>
    request<AnalysisJob>(`/analyses/jobs/${jobId}`),

  /**
   * 輪詢直到完成或失敗，回傳最終 Job。
   * intervalMs  輪詢間隔（ms），預設 2000
   * timeoutMs   最長等待時間（ms），預設 120000（2 分鐘）
   */
  waitUntilDone: async (
    jobId: string,
    onUpdate?: (job: AnalysisJob) => void,
    intervalMs = 2000,
    timeoutMs  = 120_000,
  ): Promise<AnalysisJob> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const job = await jobApi.poll(jobId)
      onUpdate?.(job)
      if (job.status === 'done' || job.status === 'failed') return job
      await new Promise(r => setTimeout(r, intervalMs))
    }
    throw new Error('分析逾時，請稍後再試')
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
}

// ─── Patterns ─────────────────────────────────────────────────────────────────
export const patternApi = {
  listDesigns: () =>
    request<{ designs: string[] }>('/patterns/designs'),

  listCatalog: (family?: string) =>
    request(`/patterns/catalog/list${family ? `?family=${family}` : ''}`),

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
  fs_design_id:  string
  name:          string
  description_zh: string | null
  garment_type:  string | null
  fabric_weight: string | null
  difficulty:    number
  tags:          string[] | null
  season:        string[] | null
  score:         number
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
  generate: (
    analysis: Record<string, unknown>,
    measurements?: Record<string, number>,
  ) =>
    request<RecommendationsResult>('/recommendations', {
      method: 'POST',
      body: JSON.stringify({ analysis, measurements: measurements ?? {} }),
    }),
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
