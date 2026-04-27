'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { analysisApi, jobApi, patternApi, recommendationsApi } from '@/lib/api'
import type { GarmentAnalysis } from '@/lib/types'
import type { AnalysisJob, RecommendationsResult } from '@/lib/api'

const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

// Default measurements (mm) matching ensureDevProfile()
const DEV_MEASUREMENTS: Record<string, number> = {
  chest: 920, waist: 720, hips: 980, highBust: 870,
  hpsToWaistBack: 390, shoulderToWrist: 580, shoulderWidth: 370,
  neck: 350, inseam: 750, biceps: 300, wrist: 155, height: 1630,
}

type Step = 'upload' | 'uploading' | 'analyzing' | 'result'

const STATUS_LABEL: Record<string, string> = {
  pending: '排隊等待中…',
  running: 'Claude 正在分析照片…',
  done:    '分析完成',
  failed:  '分析失敗',
}

export default function AnalyzePage() {
  const [step, setStep]           = useState<Step>('upload')
  const [preview, setPreview]     = useState<string | null>(null)
  const [analysis, setAnalysis]   = useState<GarmentAnalysis | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string>('')

  // 版型預覽狀態
  const [patternSvgs, setPatternSvgs]     = useState<Record<string, string | 'loading'>>({})
  const [activePreview, setActivePreview] = useState<string | null>(null)
  const [zoom, setZoom]                   = useState(100)
  const previewRef = useRef<HTMLDivElement>(null)

  // 「上傳新服裝照片」展開上傳區（不清除現有結果）
  const [showUploadZone, setShowUploadZone] = useState(false)
  const uploadZoneRef = useRef<HTMLDivElement>(null)

  // 為你量身推薦狀態
  const [recs, setRecs]           = useState<RecommendationsResult | null>(null)
  const [recsLoading, setRecsLoading] = useState(false)
  const [recsError, setRecsError] = useState<string | null>(null)
  const recsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activePreview && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activePreview])

  const draftPattern = useCallback(async (design: string) => {
    setActivePreview(design)
    setZoom(100)
    if (patternSvgs[design] && patternSvgs[design] !== 'loading') return
    setPatternSvgs(prev => ({ ...prev, [design]: 'loading' }))
    try {
      const data = await patternApi.draft({
        userId: DEV_USER_ID,
        design,
        bodyProfileId: DEV_PROFILE_ID,
        sa: 10,
        renderMode: 'svg',
      }) as any
      setPatternSvgs(prev => ({ ...prev, [design]: data.svg ?? '' }))
    } catch {
      setPatternSvgs(prev => { const n = { ...prev }; delete n[design]; return n })
      setActivePreview(null)
    }
  }, [patternSvgs])

  const generateRecs = useCallback(async () => {
    if (!analysis) return
    setRecsLoading(true)
    setRecsError(null)
    try {
      const result = await recommendationsApi.generate(
        analysis as unknown as Record<string, unknown>,
        DEV_MEASUREMENTS,
      )
      setRecs(result)
      setTimeout(() => recsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e: any) {
      setRecsError(e.message ?? '推薦生成失敗，請再試一次')
    } finally {
      setRecsLoading(false)
    }
  }, [analysis])

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setError(null)
    setJobStatus('')
    setPatternSvgs({})
    setActivePreview(null)
    setRecs(null)
    setShowUploadZone(false)

    try {
      setStep('uploading')
      let uploadResult: { photo_id: string }
      try {
        uploadResult = await analysisApi.uploadPhoto(DEV_USER_ID, file)
      } catch (e: any) {
        const msg = e.message ?? ''
        if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
          throw new Error('無法連線到伺服器（API :8000 未啟動？），請確認後端服務正在執行。')
        }
        throw new Error(`上傳失敗：${msg}`)
      }
      const { photo_id } = uploadResult

      setStep('analyzing')
      const { job_id } = await jobApi.create(photo_id, DEV_USER_ID)
      const job: AnalysisJob = await jobApi.waitUntilDone(
        job_id,
        (j) => setJobStatus(STATUS_LABEL[j.status] ?? j.status),
      )

      if (job.status === 'failed') {
        const errMsg = job.error ?? '分析失敗，請再試一次'
        if (errMsg.includes('credit balance') || errMsg.includes('billing'))
          throw new Error('Anthropic 帳戶餘額不足，請至 console.anthropic.com 加值')
        if (errMsg.includes('Could not process image'))
          throw new Error('圖片格式不支援或品質太低，請換一張清晰的服裝照片')
        throw new Error(errMsg)
      }

      setAnalysis(job.result as GarmentAnalysis)
      setStep('result')
    } catch (e: any) {
      setError(e.message ?? '發生錯誤，請再試一次')
      setStep('upload')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    disabled: step === 'uploading' || step === 'analyzing',
  })

  const isLoading = step === 'uploading' || step === 'analyzing'
  const activeSvg = activePreview ? patternSvgs[activePreview] : null

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-900 mb-2">服裝照片分析</h1>
      <p className="text-stone-500 mb-8">上傳 1 張服裝照片，AI 將自動識別材質、剪裁與推薦版型</p>

      {/* ── Upload zone（初始 or 展開新上傳）──────────────────────────────── */}
      {(step !== 'result' || showUploadZone) && (
        <div ref={uploadZoneRef} className={showUploadZone ? 'mb-8' : ''}>
          {/* 展開模式的標題列 */}
          {showUploadZone && step === 'result' && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-stone-700">上傳新服裝照片</p>
              <button
                onClick={() => setShowUploadZone(false)}
                className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
              >
                ✕ 取消
              </button>
            </div>
          )}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors
              ${showUploadZone ? 'p-8' : 'p-12'}
              ${isDragActive ? 'border-amber-500 bg-amber-50' : 'border-stone-300 hover:border-stone-400 bg-white'}
              ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            {step === 'uploading' && (
              <div>
                <div className="text-3xl mb-3 animate-spin inline-block">⟳</div>
                <p className="text-stone-600">照片上傳中…</p>
              </div>
            )}
            {step === 'analyzing' && (
              <div className="space-y-3">
                <div className="w-48 h-1.5 mx-auto bg-stone-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full animate-pulse w-2/3" />
                </div>
                <p className="text-stone-600 text-sm">{jobStatus || 'Claude 正在分析照片…'}</p>
              </div>
            )}
            {(step === 'upload' || (step === 'result' && showUploadZone)) && (
              <div>
                <div className="text-4xl mb-3">📸</div>
                <p className="text-stone-700 font-medium">
                  {isDragActive ? '放開以上傳' : '拖拉照片到此，或點擊選擇'}
                </p>
                <p className="text-stone-400 text-sm mt-2">支援 JPG、PNG、WebP，最大 10MB</p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Analysis result ───────────────────────────────────────────────── */}
      {step === 'result' && analysis && (
        <>
          {/* 已儲存提示 + 操作列 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-emerald-500 text-base">✓</span>
              <span className="text-emerald-700 font-medium">照片與分析已儲存至歷史</span>
              <a href="/history" className="text-emerald-600 underline underline-offset-2 text-xs hover:text-emerald-800">
                查看歷史紀錄 →
              </a>
            </div>
            <div className="flex items-center gap-2">
              {/* 清除：立刻清空所有畫面狀態 */}
              <button
                onClick={() => {
                  setStep('upload')
                  setPreview(null)
                  setAnalysis(null)
                  setJobStatus('')
                  setActivePreview(null)
                  setPatternSvgs({})
                  setRecs(null)
                  setShowUploadZone(false)
                }}
                className="text-sm px-4 py-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100 transition-colors"
              >
                清除
              </button>
              {/* 上傳新照片：展開上傳區，保留現有分析結果 */}
              <button
                onClick={() => {
                  setShowUploadZone(true)
                  setTimeout(() => uploadZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                }}
                className="text-sm px-4 py-1.5 rounded-lg text-white font-medium transition-colors"
                style={{ background: '#2E5E4E' }}
              >
                📸 上傳新服裝照片
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {preview && (
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="上傳的服裝" className="w-full object-cover" />
              </div>
            )}

            <div className="flex flex-col gap-4">
              <Card title="布料">
                <Row label="主布" value={analysis.fabric?.primary?.name} />
                <Row label="成分" value={analysis.fabric?.primary?.composition_estimate} />
                <Row label="重量" value={(analysis.fabric?.primary as any)?.weight} />
                <Row label="垂墜" value={analysis.fabric?.primary?.drape != null ? `${analysis.fabric.primary.drape}/10` : null} />
                <Row label="厚度" value={analysis.fabric?.primary?.thickness != null ? `${analysis.fabric.primary.thickness}/10` : null} />
              </Card>

              <Card title="剪裁版型">
                <Row label="廓形" value={analysis.cut?.silhouette} />
                <Row label="鬆量" value={(analysis.cut as any)?.fit_ease ?? (analysis.cut as any)?.ease_estimate} />
                <Row label="腰部" value={(analysis.cut as any)?.waist_treatment} />
                <Row label="類型" value={(analysis as any)?.garment_type_detail} />
              </Card>

              <Card title="部件">
                <Row label="領型" value={
                  typeof analysis.components?.collar === 'object' && analysis.components.collar !== null
                    ? (analysis.components.collar as any).type ?? (analysis.components.collar as any).description
                    : analysis.components?.collar as string | null
                } />
                <Row label="袖型" value={
                  typeof analysis.components?.sleeves === 'object' && analysis.components.sleeves !== null
                    ? `${(analysis.components.sleeves as any).type ?? ''} ${(analysis.components.sleeves as any).length ?? ''}`.trim()
                    : analysis.components?.sleeves as string | null
                } />
                <Row label="難度" value={
                  (analysis as any)?.difficulty_estimate
                    ? '★'.repeat((analysis as any).difficulty_estimate)
                    : null
                } />
              </Card>

              {/* 推薦版型 */}
              <Card title="推薦 FreeSewing 版型">
                {(analysis.closest_freesewing_patterns ?? []).map((p) => {
                  const isActive = activePreview === p.design
                  const state = patternSvgs[p.design]
                  return (
                    <div key={p.design} className="py-2 border-b border-stone-100 last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold capitalize text-stone-800">{p.design}</span>
                        <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                          {Math.round(p.confidence * 100)}% 符合
                        </span>
                      </div>
                      {(p as any).reasoning && (
                        <p className="text-xs text-stone-400 mb-2 leading-relaxed">{(p as any).reasoning}</p>
                      )}
                      <button
                        onClick={() => draftPattern(p.design)}
                        disabled={state === 'loading'}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors
                          ${isActive && state && state !== 'loading'
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'border-stone-300 text-stone-700 hover:bg-stone-50'
                          }
                          ${state === 'loading' ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                      >
                        {state === 'loading' ? '打版中…' : isActive && state ? '✓ 已預覽' : '🪡 預覽版型圖樣'}
                      </button>
                    </div>
                  )
                })}
              </Card>

              {analysis.silhouette_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.silhouette_tags.map(tag => (
                    <span key={tag} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                      {tag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              <a href="/recommendations"
                className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-700 transition-colors">
                ✨ 前往設計建議頁面 →
              </a>
            </div>
          </div>

          {/* ── 全寬版型圖樣預覽 ─────────────────────────────────────────────── */}
          {activePreview && (
            <div ref={previewRef} className="mt-10 border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-stone-800 capitalize">
                    {activePreview} 版型圖樣
                  </span>
                  {activeSvg && activeSvg !== 'loading' && (
                    <span className="text-xs text-stone-400">完整裁片</span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {activeSvg && activeSvg !== 'loading' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setZoom(z => Math.max(30, z - 10))}
                        className="w-6 h-6 rounded border border-stone-300 text-stone-600 hover:bg-stone-100 text-xs flex items-center justify-center"
                      >−</button>
                      <input
                        type="range" min={30} max={300} step={5} value={zoom}
                        onChange={e => setZoom(Number(e.target.value))}
                        className="w-36 accent-stone-700"
                      />
                      <button
                        onClick={() => setZoom(z => Math.min(300, z + 10))}
                        className="w-6 h-6 rounded border border-stone-300 text-stone-600 hover:bg-stone-100 text-xs flex items-center justify-center"
                      >+</button>
                      <span className="text-xs text-stone-500 w-10 text-right">{zoom}%</span>
                      <button
                        onClick={() => setZoom(100)}
                        className="text-xs text-stone-400 hover:text-stone-700 ml-1"
                      >重置</button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {activeSvg && activeSvg !== 'loading' && (
                      <a
                        href="/pattern"
                        onClick={() => sessionStorage.setItem('autoSelectDesign', activePreview)}
                        className="text-xs font-medium px-4 py-1.5 bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors"
                      >
                        完整打版 →
                      </a>
                    )}
                    <button
                      onClick={() => setActivePreview(null)}
                      className="text-xs text-stone-400 hover:text-stone-700 px-2"
                    >✕ 關閉</button>
                  </div>
                </div>
              </div>

              <div className="overflow-auto bg-stone-50" style={{ maxHeight: '80vh' }}>
                {activeSvg === 'loading' ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-8 h-8 border-4 border-stone-200 border-t-stone-700 rounded-full animate-spin" />
                    <p className="text-stone-400 text-sm">正在生成 {activePreview} 版型…</p>
                  </div>
                ) : activeSvg ? (
                  <div className="p-6">
                    <div
                      style={{ zoom: zoom / 100 }}
                      dangerouslySetInnerHTML={{ __html: activeSvg }}
                    />
                  </div>
                ) : null}
              </div>

              {activeSvg && activeSvg !== 'loading' && (
                <div className="px-6 py-3 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
                  <p className="text-xs text-stone-400">
                    縫份 10mm・使用 FreeSewing v4 生成
                  </p>
                  <div className="flex gap-2 text-xs text-stone-400">
                    {(analysis.closest_freesewing_patterns ?? []).filter(p => p.design !== activePreview).map(p => (
                      <button
                        key={p.design}
                        onClick={() => draftPattern(p.design)}
                        className="underline underline-offset-2 hover:text-stone-700"
                      >
                        {p.design}
                      </button>
                    ))}
                    {(analysis.closest_freesewing_patterns ?? []).filter(p => p.design !== activePreview).length > 0 && (
                      <span className="text-stone-300">← 其他推薦</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 為你量身推薦 CTA ─────────────────────────────────────────────── */}
          {!recs && (
            <div className="mt-10 rounded-2xl p-8 text-center" style={{ background: 'linear-gradient(135deg,#2E5E4E 0%,#3d7a65 100%)' }}>
              <p className="text-white/80 text-sm mb-1">分析完成</p>
              <h2 className="text-white text-xl font-bold mb-2">為你量身推薦</h2>
              <p className="text-white/70 text-sm mb-6">結合 AI 分析與你的身材，產生版型調整、布料、配色、採購清單與製作預估</p>
              <button
                onClick={generateRecs}
                disabled={recsLoading}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
                style={{ background: '#C9A66B', color: '#1a1a1a' }}
              >
                {recsLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-stone-800/30 border-t-stone-800 rounded-full animate-spin inline-block" />
                    Claude 正在生成推薦…
                  </>
                ) : '✨ 立即生成個人化推薦'}
              </button>
              {recsError && (
                <p className="mt-4 text-red-300 text-sm">{recsError}</p>
              )}
            </div>
          )}

          {/* ── 推薦結果 ─────────────────────────────────────────────────────── */}
          {recs && (
            <div ref={recsRef} className="mt-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">為你量身推薦</h2>
                  <p className="text-stone-500 text-sm mt-0.5">結合 AI 分析與你的身材，產生以下優化建議</p>
                </div>
                <button
                  onClick={generateRecs}
                  disabled={recsLoading}
                  className="text-xs text-stone-400 hover:text-stone-700 disabled:opacity-50"
                >
                  {recsLoading ? '更新中…' : '↻ 重新生成'}
                </button>
              </div>

              {/* 7-card grid */}
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">

                {/* 1. 版型調整 */}
                <RecCard icon="📏" title="版型調整">
                  <ul className="space-y-1.5">
                    {recs.pattern_adjustments.map((adj, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#2E5E4E', marginTop: 6 }} />
                        {adj}
                      </li>
                    ))}
                  </ul>
                </RecCard>

                {/* 2. 布料建議 */}
                <RecCard icon="🧶" title="布料建議">
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-widest text-stone-400">推薦</span>
                      <p className="text-stone-800 mt-0.5">{recs.fabric.primary}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-widest text-stone-400">替代</span>
                      <p className="text-stone-700 mt-0.5">{recs.fabric.alternative}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-widest text-red-400">避免</span>
                      <p className="text-stone-500 mt-0.5">{recs.fabric.avoid}</p>
                    </div>
                  </div>
                </RecCard>

                {/* 3. 色彩方案 */}
                <RecCard icon="🎨" title="色彩方案">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {recs.colors.map((c) => (
                      <div key={c.hex} className="flex flex-col items-center gap-1">
                        <div
                          className="w-10 h-10 rounded-lg border border-stone-200 shadow-sm"
                          style={{ background: c.hex }}
                          title={c.hex}
                        />
                        <span className="text-[10px] text-stone-500 text-center leading-tight">{c.name}</span>
                      </div>
                    ))}
                  </div>
                  {recs.color_notes.map((note, i) => (
                    <p key={i} className="text-xs text-stone-500 leading-relaxed">{note}</p>
                  ))}
                </RecCard>

                {/* 4. 風格延伸 */}
                <RecCard icon="💡" title="風格延伸">
                  <div className="space-y-2">
                    {recs.style_variants.map((v) => (
                      <div key={v.occasion} className="text-sm">
                        <span
                          className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1"
                          style={{ background: '#2E5E4E15', color: '#2E5E4E' }}
                        >
                          {v.occasion}
                        </span>
                        <p className="text-stone-600 leading-relaxed">{v.description}</p>
                      </div>
                    ))}
                  </div>
                </RecCard>

                {/* 5. 採購清單 */}
                <RecCard icon="🛒" title="採購清單">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-stone-400 border-b border-stone-100">
                        <th className="text-left pb-1.5 font-medium">材料</th>
                        <th className="text-center pb-1.5 font-medium">數量</th>
                        <th className="text-right pb-1.5 font-medium">NT$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recs.shopping_list.map((item, i) => (
                        <tr key={i} className="border-b border-stone-50 last:border-0">
                          <td className="py-1.5 text-stone-700">{item.item}</td>
                          <td className="py-1.5 text-center text-stone-500">{item.qty}</td>
                          <td className="py-1.5 text-right text-stone-700 font-medium">{item.price_ntd.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className="pt-2 text-stone-400 font-medium">合計</td>
                        <td className="pt-2 text-right font-bold" style={{ color: '#2E5E4E' }}>
                          NT$ {recs.shopping_list.reduce((s, i) => s + i.price_ntd, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </RecCard>

                {/* 6. 製作預估 */}
                <RecCard icon="⏱" title="製作預估">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500">難度</span>
                      <span className="text-amber-500 text-base">
                        {'★'.repeat(recs.production.difficulty)}
                        <span className="text-stone-200">{'★'.repeat(4 - recs.production.difficulty)}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500">製作時間</span>
                      <span className="text-stone-800 font-medium">{recs.production.hours_min}–{recs.production.hours_max} 小時</span>
                    </div>
                    <div className="border-t border-stone-100 pt-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">DIY 材料成本</span>
                        <span className="font-bold text-base" style={{ color: '#2E5E4E' }}>
                          NT$ {recs.production.cost_ntd.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-400 text-xs">vs 市售參考價</span>
                        <span className="text-stone-400 text-xs line-through">
                          NT$ {recs.production.retail_ntd.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: '#C9A66B20', color: '#8B6914' }}
                        >
                          省 {Math.round((1 - recs.production.cost_ntd / recs.production.retail_ntd) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </RecCard>

                {/* 7. 靈感版型 — full-width on xl */}
                <div className="md:col-span-2 xl:col-span-3">
                  <RecCard icon="🌿" title="靈感版型">
                    <div className="flex flex-wrap gap-3">
                      {recs.mood_patterns.map((mp) => (
                        <div
                          key={mp.code}
                          className="flex-1 min-w-[180px] rounded-lg border border-stone-200 p-3"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-stone-800">{mp.code}</span>
                            <span
                              className="text-xs font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: '#2E5E4E15', color: '#2E5E4E' }}
                            >
                              {mp.similarity}% 相似
                            </span>
                          </div>
                          <p className="text-sm text-stone-600">{mp.name}</p>
                        </div>
                      ))}
                    </div>
                  </RecCard>
                </div>

              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="text-stone-800 font-medium">{value ?? '—'}</span>
    </div>
  )
}

function RecCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
      </div>
      {children}
    </div>
  )
}
