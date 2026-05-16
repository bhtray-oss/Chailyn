'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { analysisApi, jobApi, patternApi, recommendationsApi } from '@/lib/api'
import type { GarmentAnalysis } from '@/lib/types'
import type { AnalysisJob, RecommendationsResult } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'
import {
  hasCJK, biField,
  translateFabricName, translateComposition,
  prettyLabel, formatSleeve,
  SILHOUETTE_LABEL, EASE_LABEL, WAIST_LABEL, COLLAR_LABEL,
} from '@/lib/garment-i18n'
import { Camera, Loader2, Sparkles, Check, Ruler, Layers, Palette, Lightbulb, ShoppingBag, Clock, Wind, BookOpen } from 'lucide-react'
import MeasurementChart from '@/components/MeasurementChart'
import ArmstrongDraftPanel, { type DraftedAsset } from '@/components/ArmstrongDraftPanel'
import DownloadBar from '@/components/DownloadBar'
import SmartDraftPanel from '@/components/SmartDraftPanel'
import type { ArmstrongDraftResult } from '@/lib/api'

const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

// Default measurements (mm) matching ensureDevProfile()
const DEV_MEASUREMENTS: Record<string, number> = {
  chest: 920, waist: 720, hips: 980, highBust: 870,
  hpsToWaistBack: 390, shoulderToWrist: 580, shoulderWidth: 370,
  neck: 350, inseam: 750, biceps: 300, wrist: 155, height: 1630,
}

type Step = 'upload' | 'uploading' | 'analyzing' | 'result'

export default function AnalyzePage() {
  const { t, lang } = useLanguage()
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

  // 展開上傳區
  const [showUploadZone, setShowUploadZone] = useState(false)
  const uploadZoneRef = useRef<HTMLDivElement>(null)

  // Armstrong 分析面板
  const [showArmstrong, setShowArmstrong] = useState(false)
  const armstrongRef = useRef<HTMLDivElement>(null)

  // AI Smart Draft — populated when analysis job completes
  const [analysisId, setAnalysisId] = useState<string | null>(null)

  // Download center — populated when Armstrong panel finishes drafting
  const [dlFormula,   setDlFormula]   = useState<ArmstrongDraftResult | null>(null)
  const [dlAssets,    setDlAssets]    = useState<DraftedAsset[]>([])

  // 推薦狀態
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
        lang,
      )
      setRecs(result)
      setTimeout(() => recsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e: any) {
      setRecsError(e.message ?? t('error.recsFailed'))
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
    setShowArmstrong(false)
    setShowUploadZone(false)
    setDlFormula(null)
    setDlAssets([])
    setAnalysisId(null)

    try {
      setStep('uploading')
      let uploadResult: { photo_id: string }
      try {
        uploadResult = await analysisApi.uploadPhoto(DEV_USER_ID, file)
      } catch (e: any) {
        const msg = e.message ?? ''
        if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
          throw new Error(t('error.serverDown'))
        }
        throw new Error(t('error.uploadFailed') + msg)
      }
      const { photo_id } = uploadResult

      setStep('analyzing')
      const { job_id } = await jobApi.create(photo_id, DEV_USER_ID)
      const job: AnalysisJob = await jobApi.waitUntilDone(
        job_id,
        (j) => {
          const key = `status.${j.status}` as Parameters<typeof t>[0]
          setJobStatus(t(key) || j.status)
        },
      )

      if (job.status === 'failed') {
        const errMsg = job.error ?? t('error.analysisFailed')
        if (errMsg.includes('credit balance') || errMsg.includes('billing'))
          throw new Error(t('error.billing'))
        if (errMsg.includes('Could not process image'))
          throw new Error(t('error.imageQuality'))
        throw new Error(errMsg)
      }

      setAnalysis(job.result as GarmentAnalysis)
      if (job.analysis_id) setAnalysisId(job.analysis_id)
      setStep('result')
    } catch (e: any) {
      const msg: string = e.message ?? ''
      setError(msg === 'TIMEOUT' ? t('error.timeout') : (msg || t('error.analysisFailed')))
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

      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-2">
          {lang === 'zh' ? 'AI 服裝分析' : 'AI Garment Analysis'}
        </p>
        <h1 className="font-display text-3xl text-[var(--ink)]">{t('analyze.title')}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">{t('analyze.subtitle')}</p>
      </div>

      {/* ── Upload zone ──────────────────────────────────────────────────────── */}
      {(step !== 'result' || showUploadZone) && (
        <div ref={uploadZoneRef} className={showUploadZone ? 'mb-8' : ''}>
          {showUploadZone && step === 'result' && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-[var(--ink-soft)] uppercase tracking-widest">{t('analyze.uploadNewTitle')}</p>
              <button
                onClick={() => setShowUploadZone(false)}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                {t('analyze.cancel')}
              </button>
            </div>
          )}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed text-center cursor-pointer transition-colors
              ${showUploadZone ? 'p-8' : 'p-12'}
              ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}
            `}
            style={{
              borderColor:    isDragActive ? 'var(--gold)' : 'var(--border)',
              background:     isDragActive ? 'var(--gold-light)' : 'var(--surface)',
            }}
          >
            <input {...getInputProps()} />
            {step === 'uploading' && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={24} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
                <p className="text-sm text-[var(--muted)]">{t('analyze.uploading')}</p>
              </div>
            )}
            {step === 'analyzing' && (
              <div className="space-y-3 flex flex-col items-center">
                <div className="w-48 h-[2px] bg-[var(--border)] overflow-hidden">
                  <div className="h-full bg-[var(--gold)] animate-pulse w-2/3" />
                </div>
                <p className="text-sm text-[var(--muted)]">{jobStatus || t('analyze.analyzing')}</p>
              </div>
            )}
            {(step === 'upload' || (step === 'result' && showUploadZone)) && (
              <div className="flex flex-col items-center gap-4">
                <Camera size={32} strokeWidth={1} className="text-[var(--border)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--ink)]">
                    {isDragActive ? t('analyze.release') : t('analyze.drop')}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-1.5">{t('analyze.hint')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 text-red-700 text-sm" style={{ border: '1px solid #fca5a5', background: '#fef2f2' }}>
          {error}
        </div>
      )}

      {/* ── Analysis result ───────────────────────────────────────────────── */}
      {step === 'result' && analysis && (
        <>
          {/* 操作列 */}
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 px-4 py-3"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <div className="flex items-center gap-2 text-sm">
              <Check size={14} strokeWidth={2} className="text-[var(--gold)]" />
              <span className="text-xs tracking-wide text-[var(--ink-soft)]">{t('analyze.saved')}</span>
              <a href="/history" className="text-[10px] tracking-widest uppercase text-[var(--gold)] hover:opacity-70">
                {t('analyze.viewHistory')}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setStep('upload'); setPreview(null); setAnalysis(null)
                  setJobStatus(''); setActivePreview(null); setPatternSvgs({})
                  setRecs(null); setShowArmstrong(false); setShowUploadZone(false)
                  setDlFormula(null); setDlAssets([]); setAnalysisId(null)
                }}
                className="text-xs px-4 py-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                style={{ border: '1px solid var(--border)' }}
              >
                {t('analyze.clear')}
              </button>
              <button
                onClick={() => {
                  setShowUploadZone(true)
                  setTimeout(() => uploadZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                }}
                className="text-xs px-4 py-1.5 font-medium transition-opacity hover:opacity-80"
                style={{ background: 'var(--ink)', color: 'var(--surface)' }}
              >
                {t('analyze.uploadNew')}
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {preview && (
              <div
                className="overflow-hidden"
                style={{ border: '1px solid var(--border)' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="上傳的服裝" className="w-full object-cover" />
              </div>
            )}

            <div className="flex flex-col gap-4">
              {/* ── Derived display values ──────────────────────────────── */}
              {(() => {
                const primary    = analysis.fabric?.primary as any
                const fabricName = (() => {
                  const raw = biField(primary, 'name', lang)
                  if (!raw) return null
                  return lang === 'en' && hasCJK(raw) ? translateFabricName(raw) : raw
                })()
                const composition = (() => {
                  const raw = biField(primary, 'composition_estimate', lang)
                             ?? biField(primary, 'composition', lang)
                  if (!raw) return null
                  return lang === 'en' && hasCJK(raw) ? translateComposition(raw) : raw
                })()
                const silhouette = prettyLabel(analysis.cut?.silhouette, SILHOUETTE_LABEL, lang)
                const ease       = prettyLabel((analysis.cut as any)?.fit_ease ?? (analysis.cut as any)?.ease_estimate, EASE_LABEL, lang)
                const waist      = prettyLabel((analysis.cut as any)?.waist_treatment, WAIST_LABEL, lang)
                const garmentTypeRaw = biField(analysis, 'garment_type_detail', lang)
                const garmentType = lang === 'en' && garmentTypeRaw && hasCJK(garmentTypeRaw)
                  ? undefined
                  : garmentTypeRaw
                const collar = (() => {
                  const col = analysis.components?.collar
                  const code = typeof col === 'object' && col !== null
                    ? (col as any).type ?? (col as any).description
                    : col as string | null
                  return prettyLabel(code, COLLAR_LABEL, lang)
                })()
                const sleeve = formatSleeve(analysis.components?.sleeves, lang)

                return (
                  <>
                    <AnalysisCard title={t('card.fabric')}>
                      <Row label={t('row.primary')}     value={fabricName} />
                      <Row label={t('row.composition')} value={composition} />
                      <Row label={t('row.weight')}      value={primary?.weight} />
                      <Row label={t('row.drape')}       value={primary?.drape    != null ? `${primary.drape}/10`    : null} />
                      <Row label={t('row.thickness')}   value={primary?.thickness != null ? `${primary.thickness}/10` : null} />
                    </AnalysisCard>

                    <AnalysisCard title={t('card.cut')}>
                      <Row label={t('row.silhouette')} value={silhouette} />
                      <Row label={t('row.ease')}       value={ease} />
                      <Row label={t('row.waist')}      value={waist} />
                      {garmentType && <Row label={t('row.type')} value={garmentType} />}
                      {!garmentType && lang === 'en' && (
                        <Row label={t('row.type')} value={
                          <span className="text-[var(--muted)] italic text-xs">
                            Re-analyze photo for English description
                          </span>
                        } />
                      )}
                    </AnalysisCard>

                    <AnalysisCard title={t('card.components')}>
                      <Row label={t('row.collar')}     value={collar} />
                      <Row label={t('row.sleeve')}     value={sleeve} />
                      <Row label={t('row.difficulty')} value={
                        (analysis as any)?.difficulty_estimate
                          ? '★'.repeat((analysis as any).difficulty_estimate)
                          : null
                      } />
                    </AnalysisCard>
                  </>
                )
              })()}

              {/* 推薦版型 */}
              <AnalysisCard title={t('card.patterns')}>
                {(analysis.closest_freesewing_patterns ?? []).map((p) => {
                  const isActive = activePreview === p.design
                  const state = patternSvgs[p.design]
                  return (
                    <div key={p.design} className="py-2 border-b border-[var(--border)] last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium capitalize text-sm text-[var(--ink)]">{p.design}</span>
                        <span
                          className="text-[10px] tracking-wide px-2 py-0.5 text-[var(--muted)]"
                          style={{ border: '1px solid var(--border)' }}
                        >
                          {Math.round(p.confidence * 100)}{t('pattern.match')}
                        </span>
                      </div>
                      {(p as any).reasoning && (
                        <p className="text-xs text-[var(--muted)] mb-2 leading-relaxed">{(p as any).reasoning}</p>
                      )}
                      <button
                        onClick={() => draftPattern(p.design)}
                        disabled={state === 'loading'}
                        className="text-[10px] tracking-widest uppercase font-medium px-3 py-1.5 transition-colors disabled:opacity-50"
                        style={{
                          background: isActive && state && state !== 'loading' ? 'var(--ink)' : 'transparent',
                          color:      isActive && state && state !== 'loading' ? 'var(--surface)' : 'var(--ink-soft)',
                          border:     '1px solid ' + (isActive && state && state !== 'loading' ? 'var(--ink)' : 'var(--border)'),
                        }}
                      >
                        {state === 'loading' ? t('pattern.drafting') : isActive && state ? t('pattern.previewed') : t('pattern.preview')}
                      </button>
                    </div>
                  )
                })}
              </AnalysisCard>

              {/* 輪廓標籤 */}
              {analysis.silhouette_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.silhouette_tags.map(tag => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 text-[var(--gold)]"
                      style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}
                    >
                      {tag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              <a href="/recommendations"
                className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                {t('analyze.goRecs')}
              </a>
            </div>
          </div>

          {/* ── 全寬版型圖樣預覽 ─────────────────────────────────────────────── */}
          {activePreview && (
            <div ref={previewRef} className="mt-10 overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div
                className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]"
                style={{ background: 'var(--bg)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[var(--ink)] capitalize">
                    {activePreview} {t('preview.title')}
                  </span>
                  {activeSvg && activeSvg !== 'loading' && (
                    <span className="text-xs text-[var(--muted)]">{t('preview.fullPieces')}</span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {activeSvg && activeSvg !== 'loading' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setZoom(z => Math.max(30, z - 10))}
                        className="w-6 h-6 text-[var(--muted)] hover:text-[var(--ink)] text-xs flex items-center justify-center transition-colors"
                        style={{ border: '1px solid var(--border)' }}
                      >−</button>
                      <input
                        type="range" min={30} max={300} step={5} value={zoom}
                        onChange={e => setZoom(Number(e.target.value))}
                        className="w-36"
                      />
                      <button
                        onClick={() => setZoom(z => Math.min(300, z + 10))}
                        className="w-6 h-6 text-[var(--muted)] hover:text-[var(--ink)] text-xs flex items-center justify-center transition-colors"
                        style={{ border: '1px solid var(--border)' }}
                      >+</button>
                      <span className="text-xs text-[var(--muted)] w-10 text-right">{zoom}%</span>
                      <button
                        onClick={() => setZoom(100)}
                        className="text-xs text-[var(--muted)] hover:text-[var(--ink)] ml-1"
                      >{t('pattern.reset')}</button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {activeSvg && activeSvg !== 'loading' && (
                      <a
                        href="/pattern"
                        onClick={() => sessionStorage.setItem('autoSelectDesign', activePreview)}
                        className="text-[10px] tracking-widest uppercase font-medium px-4 py-1.5 transition-opacity hover:opacity-70"
                        style={{ background: 'var(--ink)', color: 'var(--surface)' }}
                      >
                        {t('pattern.fullDraft')}
                      </a>
                    )}
                    <button
                      onClick={() => setActivePreview(null)}
                      className="text-xs text-[var(--muted)] hover:text-[var(--ink)] px-2"
                    >{t('pattern.close')}</button>
                  </div>
                </div>
              </div>

              <div className="overflow-auto" style={{ maxHeight: '80vh', background: 'var(--bg)' }}>
                {activeSvg === 'loading' ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
                    <p className="text-xs text-[var(--muted)] tracking-widest uppercase">{t('preview.generating')}</p>
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
                <div
                  className="px-6 py-3 border-t border-[var(--border)] flex items-center justify-between"
                  style={{ background: 'var(--bg)' }}
                >
                  <p className="text-xs text-[var(--muted)]">
                    {t('pattern.seam')} 10mm · {t('pattern.generated')}
                  </p>
                  <div className="flex gap-2 text-xs text-[var(--muted)]">
                    {(analysis.closest_freesewing_patterns ?? []).filter(p => p.design !== activePreview).map(p => (
                      <button
                        key={p.design}
                        onClick={() => draftPattern(p.design)}
                        className="underline underline-offset-2 hover:text-[var(--ink)] capitalize"
                      >
                        {p.design}
                      </button>
                    ))}
                    {(analysis.closest_freesewing_patterns ?? []).filter(p => p.design !== activePreview).length > 0 && (
                      <span className="opacity-40">{t('pattern.others')}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Armstrong 量體 + 版型公式 + 打版圖面 ────────────────────────── */}
          <div className="mt-10">
            {/* Toggle button */}
            <button
              onClick={() => {
                setShowArmstrong(s => !s)
                if (!showArmstrong)
                  setTimeout(() => armstrongRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
              }}
              className="w-full flex items-center justify-between px-5 py-4 transition-colors hover:bg-[var(--gold-light)]"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <div className="flex items-center gap-3">
                <BookOpen size={16} strokeWidth={1.5} className="text-[var(--gold)]" />
                <div className="text-left">
                  <p className="text-xs font-medium tracking-widest uppercase text-[var(--ink-soft)]">
                    {lang === 'zh' ? 'Armstrong 打版分析' : 'Armstrong Pattern Analysis'}
                  </p>
                  <p className="text-[10px] text-[var(--muted)] mt-0.5">
                    {lang === 'zh'
                      ? '量體表 · 版型公式 · 衣樣打版圖面'
                      : 'Measurement Chart · Draft Formulas · Bodice Diagram'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] tracking-widest uppercase font-medium px-3 py-1.5 transition-colors"
                    style={{
                      border: '1px solid var(--border)',
                      background: showArmstrong ? 'var(--ink)' : 'transparent',
                      color: showArmstrong ? 'var(--surface)' : 'var(--ink-soft)',
                    }}>
                {showArmstrong ? (lang === 'zh' ? '收起' : 'Collapse') : (lang === 'zh' ? '展開' : 'Expand')}
              </span>
            </button>

            {/* Armstrong content */}
            {showArmstrong && (
              <div ref={armstrongRef} className="mt-4 space-y-6">
                <MeasurementChart measurements={DEV_MEASUREMENTS} />
                <ArmstrongDraftPanel
                  measurements={DEV_MEASUREMENTS}
                  analysis={analysis}
                  onAssetsReady={(formula, assets) => {
                    setDlFormula(formula)
                    setDlAssets(assets)
                  }}
                />
              </div>
            )}
          </div>

          {/* ── AI Smart Draft Panel ─────────────────────────────────────────── */}
          {analysisId && (
            <div className="mt-6">
              <SmartDraftPanel analysisId={analysisId} />
            </div>
          )}

          {/* ── 下載中心 Download Center ─────────────────────────────────────── */}
          {/* Always visible after analysis — auto-loads formula, user triggers pattern draft */}
          <div className="mt-6">
            <DownloadBar
              measurements={DEV_MEASUREMENTS}
              analysis={analysis}
            />
          </div>

          {/* ── 為你量身推薦 CTA ─────────────────────────────────────────────── */}
          {!recs && (
            <div className="mt-10 p-8 text-center" style={{ background: 'var(--ink)' }}>
              <p className="text-white/60 text-[10px] tracking-[0.3em] uppercase mb-3">{t('analyze.saved')}</p>
              <h2 className="font-display text-2xl text-white mb-2">{t('recs.cta.title')}</h2>
              <p className="text-white/60 text-sm mb-6">{t('recs.cta.subtitle')}</p>
              <button
                onClick={generateRecs}
                disabled={recsLoading}
                className="inline-flex items-center gap-2 px-6 py-3 text-[10px] tracking-widest uppercase font-medium transition-all disabled:opacity-60"
                style={{ background: 'var(--gold)', color: 'var(--ink)' }}
              >
                {recsLoading ? (
                  <>
                    <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                    {t('recs.cta.generating')}
                  </>
                ) : (
                  <>
                    <Sparkles size={14} strokeWidth={1.5} />
                    {t('recs.cta.btn')}
                  </>
                )}
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
                  <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-1">{t('rec.byAI')}</p>
                  <h2 className="font-display text-2xl text-[var(--ink)]">{t('rec.heading')}</h2>
                </div>
                <button
                  onClick={generateRecs}
                  disabled={recsLoading}
                  className="text-[10px] tracking-widest uppercase text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-50 transition-colors"
                >
                  {recsLoading ? t('recs.cta.generating') : t('recs.cta.regen')}
                </button>
              </div>

              {/* 7-card grid */}
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-px bg-[var(--border)]">

                {/* 1. 版型調整 */}
                <RecCard icon={<Ruler size={16} strokeWidth={1.5} />} title={t('rec.card.adj')}>
                  <ul className="space-y-1.5">
                    {recs.pattern_adjustments.map((adj, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
                        <span className="mt-1.5 w-1 h-1 flex-shrink-0" style={{ background: 'var(--gold)' }} />
                        {adj}
                      </li>
                    ))}
                  </ul>
                </RecCard>

                {/* 2. 布料建議 */}
                <RecCard icon={<Layers size={16} strokeWidth={1.5} />} title={t('rec.card.fabric')}>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-[10px] tracking-widest uppercase text-[var(--muted)]">{t('rec.fabric.rec')}</span>
                      <p className="text-[var(--ink)] mt-0.5">{recs.fabric.primary}</p>
                    </div>
                    <div>
                      <span className="text-[10px] tracking-widest uppercase text-[var(--muted)]">{t('rec.fabric.alt')}</span>
                      <p className="text-[var(--ink-soft)] mt-0.5">{recs.fabric.alternative}</p>
                    </div>
                    <div>
                      <span className="text-[10px] tracking-widest uppercase text-red-400">{t('rec.fabric.avoid')}</span>
                      <p className="text-[var(--muted)] mt-0.5">{recs.fabric.avoid}</p>
                    </div>
                  </div>
                </RecCard>

                {/* 3. 色彩方案 */}
                <RecCard icon={<Palette size={16} strokeWidth={1.5} />} title={t('rec.card.color')}>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {recs.colors.map((c) => (
                      <div key={c.hex} className="flex flex-col items-center gap-1">
                        <div
                          className="w-10 h-10"
                          style={{ background: c.hex, border: '1px solid var(--border)' }}
                          title={c.hex}
                        />
                        <span className="text-[10px] text-[var(--muted)] text-center leading-tight">{c.name}</span>
                      </div>
                    ))}
                  </div>
                  {recs.color_notes.map((note, i) => (
                    <p key={i} className="text-xs text-[var(--muted)] leading-relaxed">{note}</p>
                  ))}
                </RecCard>

                {/* 4. 風格延伸 */}
                <RecCard icon={<Lightbulb size={16} strokeWidth={1.5} />} title={t('rec.card.style')}>
                  <div className="space-y-2">
                    {recs.style_variants.map((v) => (
                      <div key={v.occasion} className="text-sm">
                        <span
                          className="inline-block text-[10px] tracking-wide px-2 py-0.5 mb-1 text-[var(--gold)]"
                          style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}
                        >
                          {v.occasion}
                        </span>
                        <p className="text-[var(--ink-soft)] leading-relaxed">{v.description}</p>
                      </div>
                    ))}
                  </div>
                </RecCard>

                {/* 5. 採購清單 */}
                <RecCard icon={<ShoppingBag size={16} strokeWidth={1.5} />} title={t('rec.card.shopping')}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[var(--muted)] border-b border-[var(--border)]">
                        <th className="text-left pb-1.5 font-medium">{t('rec.shop.material')}</th>
                        <th className="text-center pb-1.5 font-medium">{t('rec.shop.qty')}</th>
                        <th className="text-right pb-1.5 font-medium">{t('rec.shop.price')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recs.shopping_list.map((item, i) => (
                        <tr key={i} className="border-b border-[var(--border)] last:border-0">
                          <td className="py-1.5 text-[var(--ink-soft)]">{item.item}</td>
                          <td className="py-1.5 text-center text-[var(--muted)]">{item.qty}</td>
                          <td className="py-1.5 text-right text-[var(--ink)] font-medium">{item.price_ntd.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className="pt-2 text-[var(--muted)] font-medium">{t('rec.shop.total')}</td>
                        <td className="pt-2 text-right font-bold text-[var(--gold)]">
                          NT$ {recs.shopping_list.reduce((s, i) => s + i.price_ntd, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </RecCard>

                {/* 6. 製作預估 */}
                <RecCard icon={<Clock size={16} strokeWidth={1.5} />} title={t('rec.card.production')}>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">{t('rec.prod.difficulty')}</span>
                      <span className="text-[var(--gold)] text-base">
                        {'★'.repeat(recs.production.difficulty)}
                        <span style={{ color: 'var(--border)' }}>{'★'.repeat(4 - recs.production.difficulty)}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">{t('rec.prod.time')}</span>
                      <span className="text-[var(--ink)] font-medium">{recs.production.hours_min}–{recs.production.hours_max} {t('rec.prod.hours')}</span>
                    </div>
                    <div className="border-t border-[var(--border)] pt-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--muted)]">{t('rec.prod.diy')}</span>
                        <span className="font-bold text-base text-[var(--gold)]">
                          NT$ {recs.production.cost_ntd.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--muted)] text-xs">vs {t('rec.prod.retail')}</span>
                        <span className="text-[var(--muted)] text-xs line-through">
                          NT$ {recs.production.retail_ntd.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className="text-[10px] tracking-wide px-2 py-0.5 text-[var(--gold)]"
                          style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}
                        >
                          {t('rec.prod.save')} {Math.round((1 - recs.production.cost_ntd / recs.production.retail_ntd) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </RecCard>

                {/* 7. 靈感版型 — full-width on xl */}
                <div className="md:col-span-2 xl:col-span-3 bg-[var(--surface)]">
                  <RecCard icon={<Wind size={16} strokeWidth={1.5} />} title={t('rec.card.mood')}>
                    <div className="flex flex-wrap gap-3">
                      {recs.mood_patterns.map((mp) => (
                        <div
                          key={mp.code}
                          className="flex-1 min-w-[180px] p-3"
                          style={{ border: '1px solid var(--border)' }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-[var(--ink)]">{mp.code}</span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 text-[var(--gold)]"
                              style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}
                            >
                              {mp.similarity}%
                            </span>
                          </div>
                          <p className="text-sm text-[var(--ink-soft)]">{mp.name}</p>
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

function AnalysisCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className="px-4 py-2 border-b border-[var(--border)]">
        <h3 className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)]">{title}</h3>
      </div>
      <div className="px-4 py-3 space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-[var(--ink)] font-medium">{value ?? '—'}</span>
    </div>
  )
}

function RecCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[var(--gold)]">{icon}</span>
        <h3 className="text-xs tracking-widest uppercase text-[var(--ink-soft)]">{title}</h3>
      </div>
      {children}
    </div>
  )
}
