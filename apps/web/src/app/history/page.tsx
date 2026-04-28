'use client'

import { useState, useEffect, useCallback } from 'react'
import { historyApi, patternApi } from '@/lib/api'
import type { AnalysisHistoryItem } from '@/lib/api'
import type { GarmentAnalysis } from '@/lib/types'
import { useLanguage } from '@/contexts/LanguageContext'
import { Trash2, ChevronDown, ChevronUp, ZoomIn, ZoomOut, X } from 'lucide-react'

const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

export default function HistoryPage() {
  const { t, lang } = useLanguage()
  const [items, setItems]       = useState<AnalysisHistoryItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [patternSvgs, setPatternSvgs]   = useState<Record<string, string | 'loading'>>({})
  const [activePreview, setActivePreview] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)

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
    setZoom(100)
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

  // ── Empty / Loading ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3 text-stone-400">
      <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
      {t('hist.loading')}
    </div>
  )

  if (items.length === 0) return (
    <div className="text-center py-24 text-stone-400">
      <div className="text-5xl mb-4">📂</div>
      <p className="text-base font-medium text-stone-600 mb-1">{t('hist.empty')}</p>
      <p className="text-sm mb-6">{t('hist.emptyHint')}</p>
      <a href="/analyze"
        className="text-sm font-medium px-5 py-2.5 bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors">
        {t('hist.startAnalysis')}
      </a>
    </div>
  )

  // ── Main list ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-stone-900">{t('hist.title')}</h1>
          <p className="text-stone-400 text-xs mt-0.5">
            {lang === 'zh' ? `共 ${items.length} 筆記錄` : `${items.length} records`}
          </p>
        </div>
        <a href="/analyze"
          className="text-sm font-medium px-4 py-2 bg-stone-900 text-white rounded-xl hover:bg-stone-700 transition-colors">
          + {lang === 'zh' ? '新增分析' : 'New'}
        </a>
      </div>

      <div className="space-y-3">
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
            <div key={item.job_id}
              className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">

              {/* ── Row 1: 圖片 + 主要資訊 ─────────────────────────────── */}
              <div className="flex gap-3 p-3">
                {/* 照片縮圖 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={historyApi.photoUrl(item.photo_id)}
                  alt=""
                  className="w-20 h-20 object-cover rounded-xl bg-stone-100 flex-shrink-0 border border-stone-100"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement
                    el.style.display = 'none'
                  }}
                />

                {/* 右側資訊欄 */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  {/* 上層：材質 + 難度徽章 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900 text-sm truncate">
                        {fabric ?? (lang === 'zh' ? '未知材質' : 'Unknown fabric')}
                      </p>
                      {composition && (
                        <p className="text-xs text-stone-400 mt-0.5 truncate">{composition}</p>
                      )}
                    </div>
                    {difficulty && (
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium">
                        {'★'.repeat(difficulty)}
                      </span>
                    )}
                  </div>

                  {/* 中層：剪裁輪廓 */}
                  {silhouette && (
                    <p className="text-xs text-stone-500 mt-1">
                      {lang === 'zh' ? '輪廓' : 'Silhouette'}: <span className="font-medium text-stone-700">{silhouette}</span>
                    </p>
                  )}

                  {/* 下層：時間 */}
                  <p className="text-[11px] text-stone-300 mt-1">
                    {formatDate(item.created_at)}
                  </p>
                </div>
              </div>

              {/* ── Row 2: Tags（版型 + 輪廓標籤） ───────────────────── */}
              {(topPatterns.length > 0 || tags.length > 0) && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                  {topPatterns.map(p => (
                    <span key={p.design}
                      className="text-[11px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full capitalize font-medium">
                      {p.design} {Math.round(p.confidence * 100)}%
                    </span>
                  ))}
                  {tags.map(tag => (
                    <span key={tag}
                      className="text-[11px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                      {tag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              {/* ── Row 3: 操作列 ──────────────────────────────────────── */}
              <div className="flex border-t border-stone-100">
                {/* 查看詳情 */}
                <button
                  onClick={() => { setExpanded(isExpanded ? null : item.job_id); setActivePreview(null) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-stone-700 hover:bg-stone-50 active:bg-stone-100 transition-colors"
                >
                  {isExpanded
                    ? <><ChevronUp size={14} />{lang === 'zh' ? '收起詳情' : 'Collapse'}</>
                    : <><ChevronDown size={14} />{lang === 'zh' ? '查看詳情' : 'Details'}</>
                  }
                </button>

                {/* 分隔線 */}
                <div className="w-px bg-stone-100" />

                {/* 刪除 */}
                <button
                  onClick={() => handleDelete(item.job_id)}
                  disabled={deleting === item.job_id}
                  className="flex items-center justify-center gap-1.5 px-5 py-3 text-xs font-medium text-red-400 hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-40"
                >
                  <Trash2 size={14} />
                  {deleting === item.job_id
                    ? (lang === 'zh' ? '刪除中…' : 'Deleting…')
                    : (lang === 'zh' ? '刪除' : 'Delete')
                  }
                </button>
              </div>

              {/* ── 展開詳情 ───────────────────────────────────────────── */}
              {isExpanded && analysis && (
                <div className="border-t border-stone-100 bg-stone-50/60 p-3 space-y-3">

                  {/* 詳情資訊格 */}
                  <div className="grid grid-cols-2 gap-2">
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
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
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
                              className={`text-xs font-medium px-3 py-2 rounded-xl border transition-colors capitalize
                                ${isActive && state && state !== 'loading'
                                  ? 'bg-stone-900 text-white border-stone-900'
                                  : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'}
                                ${state === 'loading' ? 'opacity-50' : ''}`}
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
                    <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
                      {/* Toolbar */}
                      <div className="flex items-center justify-between px-3 py-2.5 border-b border-stone-100">
                        <span className="text-xs font-semibold text-stone-800 capitalize">
                          {activePreview}
                        </span>
                        <div className="flex items-center gap-2">
                          {patternSvgs[activePreview] && patternSvgs[activePreview] !== 'loading' && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => setZoom(z => Math.max(30, z - 15))}
                                className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center hover:bg-stone-50">
                                <ZoomOut size={13} className="text-stone-600" />
                              </button>
                              <span className="text-xs text-stone-500 w-8 text-center">{zoom}%</span>
                              <button onClick={() => setZoom(z => Math.min(300, z + 15))}
                                className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center hover:bg-stone-50">
                                <ZoomIn size={13} className="text-stone-600" />
                              </button>
                            </div>
                          )}
                          <button onClick={() => setActivePreview(null)}
                            className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center hover:bg-stone-50">
                            <X size={13} className="text-stone-500" />
                          </button>
                        </div>
                      </div>

                      {/* SVG content */}
                      <div className="overflow-auto p-3 bg-stone-50" style={{ maxHeight: '60vh' }}>
                        {patternSvgs[activePreview] === 'loading' ? (
                          <div className="flex items-center justify-center py-12 gap-2">
                            <div className="w-5 h-5 border-2 border-stone-200 border-t-stone-700 rounded-full animate-spin" />
                            <span className="text-stone-400 text-sm">{lang === 'zh' ? '產圖中…' : 'Drafting…'}</span>
                          </div>
                        ) : (
                          <div style={{ zoom: zoom / 100 }}
                            dangerouslySetInnerHTML={{ __html: patternSvgs[activePreview] as string }} />
                        )}
                      </div>
                    </div>
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
    <div className="bg-white border border-stone-100 rounded-xl px-3 py-2.5">
      <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-medium text-stone-800 truncate">{value ?? '—'}</p>
    </div>
  )
}
