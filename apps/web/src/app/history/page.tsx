'use client'

import { useState, useEffect, useCallback } from 'react'
import { historyApi, patternApi } from '@/lib/api'
import type { AnalysisHistoryItem } from '@/lib/api'
import type { GarmentAnalysis } from '@/lib/types'
import { useLanguage } from '@/contexts/LanguageContext'
import { Trash2, ChevronDown, ChevronUp, Archive, Loader2 } from 'lucide-react'
import PatternViewer from '@/components/PatternViewer'

const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

export default function HistoryPage() {
  const { t, lang } = useLanguage()
  const [items, setItems]       = useState<AnalysisHistoryItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [patternSvgs, setPatternSvgs]     = useState<Record<string, string | 'loading'>>({})
  const [activePreview, setActivePreview] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await historyApi.list(DEV_USER_ID)) }
    catch (e) { console.error(e) }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (jobId: string) => {
    if (!confirm(t('error.deleteConfirm'))) return
    setDeleting(jobId)
    try {
      await historyApi.delete(jobId, DEV_USER_ID)
      setItems(prev => prev.filter(i => i.job_id !== jobId))
      if (expanded === jobId) setExpanded(null)
    } catch (e: any) {
      alert(t('error.deleteFailed') + e.message)
    } finally {
      setDeleting(null)
    }
  }

  const draftPattern = async (design: string) => {
    setActivePreview(design)
    if (patternSvgs[design] && patternSvgs[design] !== 'loading') return
    setPatternSvgs(prev => ({ ...prev, [design]: 'loading' }))
    try {
      const data = await patternApi.draft({
        userId: DEV_USER_ID, design,
        bodyProfileId: DEV_PROFILE_ID, sa: 10, renderMode: 'svg',
      }) as any
      setPatternSvgs(prev => ({ ...prev, [design]: data.svg ?? '' }))
    } catch {
      setPatternSvgs(prev => { const n = { ...prev }; delete n[design]; return n })
      setActivePreview(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3 text-[var(--muted)]">
      <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
      <span className="text-xs tracking-widest uppercase">{t('hist.loading')}</span>
    </div>
  )

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (items.length === 0) return (
    <div className="text-center py-24 text-[var(--muted)]">
      <Archive size={40} strokeWidth={1} className="mx-auto mb-4 text-[var(--border)]" />
      <p className="text-sm font-medium text-[var(--ink-soft)] mb-1">{t('hist.empty')}</p>
      <p className="text-xs mb-8">{t('hist.emptyHint')}</p>
      <a
        href="/analyze"
        className="text-[10px] tracking-widest uppercase font-medium px-5 py-2.5 transition-opacity hover:opacity-70"
        style={{ background: 'var(--ink)', color: 'var(--surface)' }}
      >
        {t('hist.startAnalysis')}
      </a>
    </div>
  )

  // ── Main list ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-2">
            {lang === 'zh' ? '分析記錄' : 'Analysis Records'}
          </p>
          <h1 className="font-display text-3xl text-[var(--ink)]">{t('hist.title')}</h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            {lang === 'zh' ? `共 ${items.length} 筆記錄` : `${items.length} records`}
          </p>
        </div>
        <a
          href="/analyze"
          className="text-[10px] tracking-widest uppercase font-medium px-4 py-2 transition-opacity hover:opacity-70"
          style={{ background: 'var(--ink)', color: 'var(--surface)' }}
        >
          + {lang === 'zh' ? '新增分析' : 'New'}
        </a>
      </div>

      <div className="border-t border-[var(--border)]">
        {items.map((item) => {
          const analysis    = item.result as GarmentAnalysis
          const isExpanded  = expanded === item.job_id
          const topPatterns = analysis?.closest_freesewing_patterns?.slice(0, 3) ?? []
          const fabric      = analysis?.fabric?.primary?.name
          const composition = analysis?.fabric?.primary?.composition_estimate
          const silhouette  = analysis?.cut?.silhouette
          const difficulty  = (analysis as any)?.difficulty_estimate as number | undefined
          const tags        = analysis?.silhouette_tags?.slice(0, 3) ?? []

          return (
            <div key={item.job_id} className="border-b border-[var(--border)] bg-[var(--surface)]">

              {/* ── Row 1: 圖片 + 主要資訊 ─────────────────────────────── */}
              <div className="flex gap-3 p-4">
                {/* 照片縮圖 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={historyApi.photoUrl(item.photo_id)}
                  alt=""
                  className="w-20 h-20 object-cover bg-[var(--bg)] flex-shrink-0"
                  style={{ border: '1px solid var(--border)' }}
                  onError={(e) => {
                    const el = e.target as HTMLImageElement
                    el.style.display = 'none'
                  }}
                />

                {/* 右側資訊欄 */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  {/* 上層：材質 + 難度 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-[var(--ink)] truncate">
                        {fabric ?? (lang === 'zh' ? '未知材質' : 'Unknown fabric')}
                      </p>
                      {composition && (
                        <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{composition}</p>
                      )}
                    </div>
                    {difficulty && (
                      <span
                        className="text-xs text-[var(--gold)] px-1.5 py-0.5 flex-shrink-0"
                        style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}
                      >
                        {'★'.repeat(difficulty)}
                      </span>
                    )}
                  </div>

                  {/* 輪廓 */}
                  {silhouette && (
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {lang === 'zh' ? '輪廓' : 'Silhouette'}:{' '}
                      <span className="font-medium text-[var(--ink-soft)]">{silhouette}</span>
                    </p>
                  )}

                  {/* 時間 */}
                  <p className="text-[11px] text-[var(--muted)] mt-1">{formatDate(item.created_at)}</p>
                </div>
              </div>

              {/* ── Row 2: Tags ───────────────────────────────────────── */}
              {(topPatterns.length > 0 || tags.length > 0) && (
                <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                  {topPatterns.map(p => (
                    <span
                      key={p.design}
                      className="text-[10px] tracking-wide px-2 py-0.5 capitalize font-medium text-[var(--ink-soft)]"
                      style={{ border: '1px solid var(--border)' }}
                    >
                      {p.design} {Math.round(p.confidence * 100)}%
                    </span>
                  ))}
                  {tags.map(tag => (
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

              {/* ── Row 3: 操作列 ─────────────────────────────────────── */}
              <div className="flex border-t border-[var(--border)]">
                <button
                  onClick={() => { setExpanded(isExpanded ? null : item.job_id); setActivePreview(null) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] tracking-widest uppercase font-medium text-[var(--ink-soft)] hover:bg-[var(--gold-light)] transition-colors"
                >
                  {isExpanded
                    ? <><ChevronUp size={13} strokeWidth={1.5} />{lang === 'zh' ? '收起' : 'Collapse'}</>
                    : <><ChevronDown size={13} strokeWidth={1.5} />{lang === 'zh' ? '詳情' : 'Details'}</>
                  }
                </button>

                <div className="w-px bg-[var(--border)]" />

                <button
                  onClick={() => handleDelete(item.job_id)}
                  disabled={deleting === item.job_id}
                  className="flex items-center justify-center gap-1.5 px-5 py-3 text-[10px] tracking-widest uppercase font-medium text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                  {deleting === item.job_id
                    ? (lang === 'zh' ? '刪除中…' : 'Deleting…')
                    : (lang === 'zh' ? '刪除' : 'Delete')
                  }
                </button>
              </div>

              {/* ── 展開詳情 ───────────────────────────────────────────── */}
              {isExpanded && analysis && (
                <div className="border-t border-[var(--border)] bg-[var(--bg)] p-4 space-y-4">

                  {/* 詳情格 */}
                  <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
                    <InfoBox label={lang === 'zh' ? '輪廓' : 'Silhouette'}    value={analysis.cut?.silhouette} />
                    <InfoBox label={lang === 'zh' ? '合身度' : 'Ease'}        value={(analysis.cut as any)?.fit_ease} />
                    <InfoBox label={lang === 'zh' ? '領型' : 'Collar'}        value={
                      typeof analysis.components?.collar === 'object'
                        ? (analysis.components.collar as any)?.type
                        : analysis.components?.collar as string
                    } />
                    <InfoBox label={lang === 'zh' ? '袖型' : 'Sleeve'}        value={
                      typeof analysis.components?.sleeves === 'object'
                        ? (analysis.components.sleeves as any)?.type
                        : analysis.components?.sleeves as string
                    } />
                  </div>

                  {/* 推薦版型按鈕 */}
                  {topPatterns.length > 0 && (
                    <div>
                      <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">
                        {lang === 'zh' ? '推薦版型' : 'Recommended Patterns'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {topPatterns.map(p => {
                          const isActive = activePreview === p.design
                          const state    = patternSvgs[p.design]
                          return (
                            <button key={p.design}
                              onClick={() => draftPattern(p.design)}
                              disabled={state === 'loading'}
                              className="text-xs font-medium px-3 py-2 capitalize transition-colors disabled:opacity-50"
                              style={{
                                background: isActive && state && state !== 'loading' ? 'var(--ink)' : 'transparent',
                                color:      isActive && state && state !== 'loading' ? 'var(--surface)' : 'var(--ink-soft)',
                                border:     '1px solid ' + (isActive && state && state !== 'loading' ? 'var(--ink)' : 'var(--border)'),
                              }}
                            >
                              {state === 'loading' && isActive
                                ? (lang === 'zh' ? '產圖中…' : 'Drafting…')
                                : `${p.design} · ${Math.round(p.confidence * 100)}%`
                              }
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* SVG 預覽 */}
                  {activePreview && (
                    patternSvgs[activePreview] === 'loading' ? (
                      <div
                        className="flex items-center justify-center py-10 gap-2"
                        style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
                      >
                        <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
                        <span className="text-[var(--muted)] text-xs">{lang === 'zh' ? '產圖中…' : 'Drafting…'}</span>
                      </div>
                    ) : patternSvgs[activePreview] ? (
                      <PatternViewer
                        svg={patternSvgs[activePreview] as string}
                        designName={activePreview}
                      />
                    ) : null
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── InfoBox ──────────────────────────────────────────────────────────────────
function InfoBox({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-[var(--surface)] px-3 py-2.5">
      <p className="text-[10px] tracking-[0.15em] uppercase text-[var(--muted)] mb-1">{label}</p>
      <p className="text-sm font-medium text-[var(--ink)] truncate">{value ?? '—'}</p>
    </div>
  )
}
