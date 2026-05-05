'use client'

import { useState, useEffect, useCallback } from 'react'
import { historyApi, patternApi } from '@/lib/api'
import type { AnalysisHistoryItem } from '@/lib/api'
import type { GarmentAnalysis } from '@/lib/types'
import { useLanguage } from '@/contexts/LanguageContext'
import {
  Trash2, ChevronDown, ChevronUp, Archive, Loader2,
  BookOpen, Ruler, Layers, Tag, Lock, Unlock
} from 'lucide-react'
import PatternViewer from '@/components/PatternViewer'
import MeasurementChart from '@/components/MeasurementChart'
import ArmstrongDraftPanel from '@/components/ArmstrongDraftPanel'
import {
  hasCJK, biField, prettyLabel, translateTag,
  translateFabricName, translateComposition,
  SILHOUETTE_LABEL, EASE_LABEL, COLLAR_LABEL, SLEEVE_LABEL,
} from '@/lib/garment-i18n'

const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

/** Whether a string is untranslated Chinese (for showing legacy notices). */
const isChineseText = (s: string | undefined) => !!s && hasCJK(s)

const DEV_MEASUREMENTS: Record<string, number> = {
  chest: 920, waist: 720, hips: 980, highBust: 870,
  hpsToWaistBack: 390, shoulderToWrist: 580, shoulderWidth: 370,
  neck: 350, inseam: 750, biceps: 300, wrist: 155, height: 1630,
}

// ── Tabs for expanded view ────────────────────────────────────────────────────
type TabKey = 'details' | 'patterns' | 'armstrong'

export default function HistoryPage() {
  const { t, lang } = useLanguage()
  const [items, setItems]       = useState<AnalysisHistoryItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Record<string, TabKey>>({})
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [togglingVis, setTogglingVis] = useState<string | null>(null)
  const [visibilityMap, setVisibilityMap] = useState<Record<string, 'public' | 'private'>>({})
  const [patternSvgs, setPatternSvgs]     = useState<Record<string, string | 'loading'>>({})
  const [activePreview, setActivePreview] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await historyApi.list(DEV_USER_ID)
      setItems(data)
      // Initialize visibility map from API response
      const map: Record<string, 'public' | 'private'> = {}
      for (const item of data) map[item.photo_id] = item.visibility ?? 'private'
      setVisibilityMap(map)
    }
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

  const handleToggleVisibility = async (photoId: string) => {
    const current = visibilityMap[photoId] ?? 'private'
    const next = current === 'private' ? 'public' : 'private'
    setTogglingVis(photoId)
    try {
      await historyApi.setVisibility(photoId, DEV_USER_ID, next)
      setVisibilityMap(prev => ({ ...prev, [photoId]: next }))
    } catch (e: any) {
      alert((lang === 'zh' ? '更新失敗：' : 'Update failed: ') + e.message)
    } finally {
      setTogglingVis(null)
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
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const toggleExpand = (jobId: string) => {
    if (expanded === jobId) {
      setExpanded(null)
      setActivePreview(null)
    } else {
      setExpanded(jobId)
      setActivePreview(null)
      // Default to details tab
      setActiveTab(prev => ({ ...prev, [jobId]: prev[jobId] ?? 'details' }))
    }
  }

  const getTab = (jobId: string): TabKey => activeTab[jobId] ?? 'details'
  const setTab = (jobId: string, tab: TabKey) =>
    setActiveTab(prev => ({ ...prev, [jobId]: tab }))

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3 text-[var(--muted)]">
      <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
      <span className="text-xs tracking-widest uppercase">{t('hist.loading')}</span>
    </div>
  )

  // ── Empty ────────────────────────────────────────────────────────────────────
  if (items.length === 0) return (
    <div className="text-center py-24 text-[var(--muted)]">
      <Archive size={40} strokeWidth={1} className="mx-auto mb-4 text-[var(--border)]" />
      <p className="text-sm font-medium text-[var(--ink-soft)] mb-1">{t('hist.empty')}</p>
      <p className="text-xs mb-8">{t('hist.emptyHint')}</p>
      <a href="/analyze"
         className="text-[10px] tracking-widest uppercase font-medium px-5 py-2.5 transition-opacity hover:opacity-70"
         style={{ background: 'var(--ink)', color: 'var(--surface)' }}>
        {t('hist.startAnalysis')}
      </a>
    </div>
  )

  // ── Main list ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-2">
            {lang === 'zh' ? '分析記錄' : 'Analysis Records'}
          </p>
          <h1 className="font-display text-3xl text-[var(--ink)]">{t('hist.title')}</h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            {lang === 'zh' ? `共 ${items.length} 筆記錄` : `${items.length} record${items.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <a href="/analyze"
           className="text-[10px] tracking-widest uppercase font-medium px-4 py-2 transition-opacity hover:opacity-70 flex-shrink-0"
           style={{ background: 'var(--ink)', color: 'var(--surface)' }}>
          + {lang === 'zh' ? '新增分析' : 'New'}
        </a>
      </div>

      <div className="divide-y divide-[var(--border)]" style={{ border: '1px solid var(--border)' }}>
        {items.map((item) => {
          const analysis    = item.result as GarmentAnalysis
          const isExpanded  = expanded === item.job_id
          const tab         = getTab(item.job_id)
          const topPatterns = analysis?.closest_freesewing_patterns?.slice(0, 3) ?? []
          const primary     = analysis?.fabric?.primary
          // Fabric name: try _en variant first, then translate legacy Chinese
          const fabricRaw   = biField(primary, 'name', lang)
          const fabric      = lang === 'en' && fabricRaw && hasCJK(fabricRaw)
                              ? translateFabricName(fabricRaw)
                              : (fabricRaw ?? (lang === 'zh' ? '未知材質' : 'Unknown fabric'))
          // Composition: try _en variant first, then translate legacy Chinese
          const compRaw     = biField(primary, 'composition_estimate', lang)
                           ?? biField(primary, 'composition', lang)
          const composition = lang === 'en' && compRaw
                              ? translateComposition(compRaw)
                              : compRaw
          const silhouette  = analysis?.cut?.silhouette
          const difficulty  = (analysis as any)?.difficulty_estimate as number | undefined
          const fitEase     = (analysis.cut as any)?.fit_ease ?? (analysis.cut as any)?.ease_estimate
          const collarType  = typeof analysis.components?.collar === 'object'
            ? (analysis.components.collar as any)?.type
            : analysis.components?.collar as string | undefined
          const sleeveType  = typeof analysis.components?.sleeves === 'object'
            ? (analysis.components.sleeves as any)?.type
            : analysis.components?.sleeves as string | undefined
          const tags        = analysis?.silhouette_tags?.slice(0, 4) ?? []
          // garment_type_detail: prefer _en variant; for legacy Chinese records show placeholder
          const garmentTypeRaw = biField(analysis, 'garment_type_detail', lang)
          const garmentType    = lang === 'en' && garmentTypeRaw && hasCJK(garmentTypeRaw)
                                 ? undefined   // hide Chinese garment type in EN mode (re-analyze to get EN)
                                 : garmentTypeRaw
          // pressing_notes: prefer _en variant; hide legacy Chinese in EN mode
          const pressNotesRaw = biField((analysis as any)?.craft_recommendations, 'pressing_notes', lang)
          const pressNotes    = lang === 'en' && pressNotesRaw && hasCJK(pressNotesRaw)
                                ? undefined
                                : pressNotesRaw

          return (
            <div key={item.job_id} className="bg-[var(--surface)]">

              {/* ── Card header: photo + summary ──────────────────────────── */}
              <div className="flex gap-4 p-4">
                {/* Photo thumbnail */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={historyApi.photoUrl(item.photo_id)}
                  alt=""
                  className="w-24 h-24 object-cover flex-shrink-0"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />

                <div className="flex-1 min-w-0">
                  {/* Top row: fabric name + visibility badge + difficulty */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-[var(--ink)] truncate">
                          {fabric}
                        </p>
                        {/* Visibility badge */}
                        {(() => {
                          const vis = visibilityMap[item.photo_id] ?? 'private'
                          return vis === 'public' ? (
                            <span className="flex items-center gap-0.5 text-[9px] tracking-widest uppercase font-semibold px-1.5 py-0.5 flex-shrink-0"
                                  style={{ border: '1px solid var(--gold)', color: 'var(--gold)', background: 'var(--gold-light)' }}>
                              <Unlock size={8} />
                              {lang === 'zh' ? '公開' : 'Public'}
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 text-[9px] tracking-widest uppercase font-semibold px-1.5 py-0.5 flex-shrink-0"
                                  style={{ border: '1px solid var(--border)', color: 'var(--muted)', background: 'transparent' }}>
                              <Lock size={8} />
                              {lang === 'zh' ? '私人' : 'Private'}
                            </span>
                          )
                        })()}
                      </div>
                      {garmentType ? (
                        <p className="text-xs text-[var(--ink-soft)] truncate capitalize mt-0.5">
                          {garmentType}
                        </p>
                      ) : lang === 'en' && isChineseText(biField(analysis, 'garment_type_detail', 'zh')) ? (
                        <p className="text-[10px] text-[var(--muted)] mt-0.5 italic">
                          Re-analyze photo for English description
                        </p>
                      ) : null}
                    </div>
                    {difficulty && (
                      <span className="text-xs text-[var(--gold)] px-1.5 py-0.5 flex-shrink-0"
                            style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}>
                        {'★'.repeat(difficulty)}
                      </span>
                    )}
                  </div>

                  {/* Meta pills — deduplicate if silhouette + ease share the same label */}
                  {(() => {
                    const silLabel  = silhouette ? prettyLabel(silhouette, SILHOUETTE_LABEL, lang) : null
                    const easeLabel = fitEase    ? prettyLabel(fitEase,    EASE_LABEL,        lang) : null
                    const showEase  = easeLabel && easeLabel.toLowerCase() !== silLabel?.toLowerCase()
                    return (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {silLabel  && <Pill icon={<Layers size={10} />} label={silLabel} />}
                        {showEase  && <Pill icon={<Ruler  size={10} />} label={easeLabel!} />}
                        {composition && <Pill label={composition} muted />}
                      </div>
                    )
                  })()}

                  {/* Pattern badges */}
                  {topPatterns.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {topPatterns.map(p => (
                        <span key={p.design}
                              className="text-[10px] tracking-wide px-2 py-0.5 capitalize font-medium text-[var(--ink-soft)]"
                              style={{ border: '1px solid var(--border)' }}>
                          {p.design} {Math.round(p.confidence * 100)}%
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-[var(--muted)] mt-2">{formatDate(item.created_at)}</p>
                </div>
              </div>

              {/* Silhouette tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                  {tags.map(tag => (
                    <span key={tag}
                          className="text-[10px] px-2 py-0.5 text-[var(--gold)] flex items-center gap-1"
                          style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}>
                      <Tag size={9} />
                      {translateTag(prettyLabel(tag, SILHOUETTE_LABEL, lang), lang)}
                    </span>
                  ))}
                </div>
              )}

              {/* ── Action bar ───────────────────────────────────────────── */}
              <div className="flex border-t border-[var(--border)]">
                <button
                  onClick={() => toggleExpand(item.job_id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] tracking-widest uppercase font-medium text-[var(--ink-soft)] hover:bg-[var(--gold-light)] transition-colors"
                >
                  {isExpanded
                    ? <><ChevronUp size={13} strokeWidth={1.5} />{lang === 'zh' ? '收起' : 'Collapse'}</>
                    : <><ChevronDown size={13} strokeWidth={1.5} />{lang === 'zh' ? '查看詳情' : 'Details'}</>}
                </button>
                <div className="w-px bg-[var(--border)]" />
                {/* Visibility toggle */}
                {(() => {
                  const vis = visibilityMap[item.photo_id] ?? 'private'
                  const isToggling = togglingVis === item.photo_id
                  return (
                    <button
                      onClick={() => handleToggleVisibility(item.photo_id)}
                      disabled={isToggling}
                      title={lang === 'zh'
                        ? (vis === 'public' ? '設為私人' : '設為公開')
                        : (vis === 'public' ? 'Set Private' : 'Set Public')}
                      className="flex items-center justify-center gap-1.5 px-4 py-3 text-[10px] tracking-widest uppercase font-medium transition-colors disabled:opacity-40"
                      style={{
                        color: vis === 'public' ? 'var(--gold)' : 'var(--muted)',
                      }}
                    >
                      {isToggling
                        ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                        : vis === 'public'
                          ? <Unlock size={13} strokeWidth={1.5} />
                          : <Lock size={13} strokeWidth={1.5} />}
                      {lang === 'zh'
                        ? (vis === 'public' ? '公開' : '私人')
                        : (vis === 'public' ? 'Public' : 'Private')}
                    </button>
                  )
                })()}
                <div className="w-px bg-[var(--border)]" />
                <button
                  onClick={() => handleDelete(item.job_id)}
                  disabled={deleting === item.job_id}
                  className="flex items-center justify-center gap-1.5 px-5 py-3 text-[10px] tracking-widest uppercase font-medium text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                  {deleting === item.job_id
                    ? (lang === 'zh' ? '刪除中…' : 'Deleting…')
                    : (lang === 'zh' ? '刪除' : 'Delete')}
                </button>
              </div>

              {/* ── Expanded detail panel ─────────────────────────────────── */}
              {isExpanded && analysis && (
                <div className="border-t border-[var(--border)]" style={{ background: 'var(--bg)' }}>

                  {/* Tab bar */}
                  <div className="flex border-b border-[var(--border)]">
                    {([
                      { key: 'details' as TabKey,   labelZh: '剪裁細節',  labelEn: 'Details',   icon: <Layers size={12} /> },
                      { key: 'patterns' as TabKey,  labelZh: '推薦版型',  labelEn: 'Patterns',  icon: <Ruler size={12} /> },
                      { key: 'armstrong' as TabKey, labelZh: 'Armstrong', labelEn: 'Armstrong', icon: <BookOpen size={12} /> },
                    ] as const).map(t2 => (
                      <button
                        key={t2.key}
                        onClick={() => setTab(item.job_id, t2.key)}
                        className="flex items-center gap-1.5 px-5 py-2.5 text-[10px] tracking-widest uppercase font-medium transition-colors border-b-2"
                        style={{
                          borderColor: tab === t2.key ? 'var(--gold)' : 'transparent',
                          color:       tab === t2.key ? 'var(--ink)' : 'var(--muted)',
                          background:  tab === t2.key ? 'var(--surface)' : 'transparent',
                        }}
                      >
                        <span className="text-[var(--gold)]">{t2.icon}</span>
                        {lang === 'zh' ? t2.labelZh : t2.labelEn}
                      </button>
                    ))}
                  </div>

                  {/* ── TAB: Details ─────────────────────────────────────── */}
                  {tab === 'details' && (
                    <div className="p-4 space-y-4">
                      {/* Grid of analysis values */}
                      <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
                        <InfoBox label={lang === 'zh' ? '輪廓' : 'Silhouette'}
                                 value={prettyLabel(silhouette, SILHOUETTE_LABEL, lang)} />
                        <InfoBox label={lang === 'zh' ? '合身度' : 'Ease'}
                                 value={prettyLabel(fitEase, EASE_LABEL, lang)} />
                        <InfoBox label={lang === 'zh' ? '領型' : 'Collar'}
                                 value={prettyLabel(collarType, COLLAR_LABEL, lang)} />
                        <InfoBox label={lang === 'zh' ? '袖型' : 'Sleeve'}
                                 value={prettyLabel(sleeveType, SLEEVE_LABEL, lang)} />
                        <InfoBox label={lang === 'zh' ? '材質' : 'Fabric'}
                                 value={fabric} />
                        <InfoBox label={lang === 'zh' ? '成分' : 'Composition'}
                                 value={composition ?? undefined} />
                        <InfoBox label={lang === 'zh' ? '垂墜感' : 'Drape'}
                                 value={analysis.fabric?.primary?.drape != null
                                   ? `${analysis.fabric.primary.drape}/10` : undefined} />
                        <InfoBox label={lang === 'zh' ? '厚度' : 'Thickness'}
                                 value={analysis.fabric?.primary?.thickness != null
                                   ? `${analysis.fabric.primary.thickness}/10` : undefined} />
                      </div>

                      {/* Craft notes */}
                      {pressNotes ? (
                        <div className="p-3 text-xs" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                          <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1">
                            {lang === 'zh' ? '裁縫建議' : 'Craft Notes'}
                          </p>
                          <p className="text-[var(--ink-soft)]">{pressNotes}</p>
                        </div>
                      ) : lang === 'en' && isChineseText(biField((analysis as any)?.craft_recommendations, 'pressing_notes', 'zh')) ? (
                        <div className="p-3 text-xs" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                          <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1">Craft Notes</p>
                          <p className="text-[var(--muted)] italic">
                            Re-analyze photo to generate English craft notes.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* ── TAB: Patterns ────────────────────────────────────── */}
                  {tab === 'patterns' && (
                    <div className="p-4 space-y-4">
                      {topPatterns.length > 0 ? (
                        <>
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
                                    : `${p.design} · ${Math.round(p.confidence * 100)}%`}
                                </button>
                              )
                            })}
                          </div>

                          {/* SVG preview */}
                          {activePreview && (
                            patternSvgs[activePreview] === 'loading' ? (
                              <div className="flex items-center justify-center py-10 gap-2"
                                   style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                                <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
                                <span className="text-[var(--muted)] text-xs">
                                  {lang === 'zh' ? '產圖中…' : 'Drafting…'}
                                </span>
                              </div>
                            ) : patternSvgs[activePreview] ? (
                              <PatternViewer
                                svg={patternSvgs[activePreview] as string}
                                designName={activePreview}
                              />
                            ) : null
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-[var(--muted)] text-center py-6">
                          {lang === 'zh' ? '無推薦版型資料' : 'No pattern recommendations found'}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── TAB: Armstrong ───────────────────────────────────── */}
                  {tab === 'armstrong' && (
                    <div className="p-4 space-y-4">
                      <MeasurementChart measurements={DEV_MEASUREMENTS} />
                      <ArmstrongDraftPanel measurements={DEV_MEASUREMENTS} analysis={analysis} />
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoBox({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-[var(--surface)] px-3 py-2.5">
      <p className="text-[10px] tracking-[0.15em] uppercase text-[var(--muted)] mb-1">{label}</p>
      <p className="text-sm font-medium text-[var(--ink)] truncate capitalize">{value ?? '—'}</p>
    </div>
  )
}

function Pill({ icon, label, muted }: { icon?: React.ReactNode; label: string; muted?: boolean }) {
  return (
    <span
      className="flex items-center gap-1 text-[10px] px-2 py-0.5 capitalize"
      style={{
        border: '1px solid var(--border)',
        background: muted ? 'transparent' : 'var(--gold-light)',
        color: muted ? 'var(--muted)' : 'var(--gold)',
      }}
    >
      {icon}
      {label}
    </span>
  )
}
