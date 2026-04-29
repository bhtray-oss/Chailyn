'use client'

import { useState, useEffect, useCallback } from 'react'
import { historyApi, recommendationsApi } from '@/lib/api'
import type { AnalysisHistoryItem, RecommendationsResult } from '@/lib/api'
import type { GarmentAnalysis } from '@/lib/types'
import { useLanguage } from '@/contexts/LanguageContext'
import {
  Camera, Loader2, Sparkles, Ruler, Layers, Palette,
  Lightbulb, ShoppingBag, Clock, Wind,
} from 'lucide-react'

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

const DEV_MEASUREMENTS: Record<string, number> = {
  chest: 920, waist: 720, hips: 980, highBust: 870,
  hpsToWaistBack: 390, shoulderToWrist: 580, shoulderWidth: 370,
  neck: 350, inseam: 750, biceps: 300, wrist: 155, height: 1630,
}

function cacheKey(analysisId: string) { return `recs_${analysisId}` }
function saveCache(analysisId: string, data: RecommendationsResult) {
  try { localStorage.setItem(cacheKey(analysisId), JSON.stringify(data)) } catch { /* ignore */ }
}
function loadCache(analysisId: string): RecommendationsResult | null {
  try {
    const raw = localStorage.getItem(cacheKey(analysisId))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export default function RecommendationsPage() {
  const { t, lang } = useLanguage()
  const [items, setItems]           = useState<AnalysisHistoryItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<AnalysisHistoryItem | null>(null)
  const [recs, setRecs]             = useState<RecommendationsResult | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState<string | null>(null)

  useEffect(() => {
    historyApi.list(DEV_USER_ID).then(data => {
      setItems(data)
      if (data.length > 0) {
        setSelected(data[0])
        const cached = loadCache(data[0].analysis_id)
        if (cached) setRecs(cached)
      }
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const handleSelect = useCallback((item: AnalysisHistoryItem) => {
    setSelected(item)
    setGenError(null)
    setRecs(loadCache(item.analysis_id))
  }, [])

  const generate = useCallback(async () => {
    if (!selected) return
    setGenerating(true)
    setGenError(null)
    try {
      const result = await recommendationsApi.generate(
        selected.result as unknown as Record<string, unknown>,
        DEV_MEASUREMENTS,
        lang,
      )
      setRecs(result)
      saveCache(selected.analysis_id, result)
    } catch (e: any) {
      setGenError(e.message ?? '生成失敗，請再試一次')
    } finally {
      setGenerating(false)
    }
  }, [selected])

  const analysis = selected?.result as GarmentAnalysis | undefined

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-2">
          {lang === 'zh' ? 'AI 個人化建議' : 'AI Recommendations'}
        </p>
        <h1 className="font-display text-3xl text-[var(--ink)]">{t('rec.title')}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">{t('rec.subtitle')}</p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-32 gap-3 text-[var(--muted)]">
          <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
          <span className="text-xs tracking-widest uppercase">{t('hist.loading')}</span>
        </div>
      )}

      {/* No history */}
      {!loading && items.length === 0 && (
        <div className="text-center py-32">
          <Camera size={40} strokeWidth={1} className="mx-auto mb-4 text-[var(--border)]" />
          <p className="text-sm text-[var(--muted)] mb-6">{t('rec.noHistory')}</p>
          <a
            href="/analyze"
            className="inline-block text-[10px] tracking-widest uppercase font-medium px-6 py-3 transition-opacity hover:opacity-70"
            style={{ background: 'var(--ink)', color: 'var(--surface)' }}
          >
            {t('rec.goAnalyze')}
          </a>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          {/* ── Analysis picker ──────────────────────────────────────────── */}
          <section className="mb-8">
            <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-3">
              {t('rec.picker')}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {items.map(item => {
                const a = item.result as GarmentAnalysis
                const isSelected = selected?.job_id === item.job_id
                const hasCached  = !!loadCache(item.analysis_id)
                return (
                  <button
                    key={item.job_id}
                    onClick={() => handleSelect(item)}
                    className="flex-shrink-0 w-32 text-left transition-all overflow-hidden"
                    style={{
                      border: '2px solid ' + (isSelected ? 'var(--gold)' : 'var(--border)'),
                      background: isSelected ? 'var(--gold-light)' : 'var(--surface)',
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="w-full h-20 bg-[var(--bg)] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={historyApi.photoUrl(item.photo_id)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-[var(--ink)] truncate">
                        {(a as any)?.garment_type_detail ?? (a as any)?.garment_category ?? t('misc.garment')}
                      </p>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">
                        {new Date(item.created_at).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      {hasCached && (
                        <span
                          className="inline-block mt-1 text-[9px] px-1.5 py-0.5 tracking-wide text-[var(--gold)]"
                          style={{ border: '1px solid var(--border)' }}
                        >
                          {t('rec.generated')}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Selected analysis summary ────────────────────────────────── */}
          {selected && analysis && (
            <div
              className="p-6 mb-8 flex flex-col md:flex-row items-start gap-6"
              style={{ background: 'var(--ink)' }}
            >
              {/* Photo */}
              <div className="w-24 h-24 flex-shrink-0 overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={historyApi.photoUrl(selected.photo_id)}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>

              {/* Info */}
              <div className="flex-1">
                <p className="text-white/50 text-[10px] tracking-[0.3em] uppercase mb-2">{t('rec.summary')}</p>
                <p className="font-display text-2xl text-white mb-3">
                  {(analysis as any)?.garment_type_detail ?? (analysis as any)?.garment_category ?? t('misc.garment')}
                </p>

                {/* Meta chips — ivory-on-dark */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {analysis.fabric?.primary?.name && (
                    <span
                      className="text-[10px] tracking-wide px-2 py-0.5 text-white/70"
                      style={{ border: '1px solid rgba(255,255,255,0.2)' }}
                    >
                      {analysis.fabric.primary.name}
                    </span>
                  )}
                  {analysis.cut?.silhouette && (
                    <span
                      className="text-[10px] tracking-wide px-2 py-0.5 text-white/70"
                      style={{ border: '1px solid rgba(255,255,255,0.2)' }}
                    >
                      {analysis.cut.silhouette}
                    </span>
                  )}
                  {(analysis.closest_freesewing_patterns ?? [])[0]?.design && (
                    <span
                      className="text-[10px] tracking-wide px-2 py-0.5 text-[var(--gold)] capitalize"
                      style={{ border: '1px solid var(--gold)', background: 'rgba(184,147,95,0.15)' }}
                    >
                      {(analysis.closest_freesewing_patterns ?? [])[0].design}
                    </span>
                  )}
                  {(analysis as any)?.difficulty_estimate && (
                    <span className="text-[10px] text-[var(--gold)] px-1">
                      {'★'.repeat((analysis as any).difficulty_estimate)}
                    </span>
                  )}
                </div>

                <button
                  onClick={generate}
                  disabled={generating}
                  className="inline-flex items-center gap-2 text-[10px] tracking-widest uppercase font-medium px-5 py-2.5 transition-all disabled:opacity-60"
                  style={{ background: 'var(--gold)', color: 'var(--ink)' }}
                >
                  {generating ? (
                    <><Loader2 size={12} strokeWidth={2} className="animate-spin" />{t('rec.generating')}</>
                  ) : recs ? (
                    <><Sparkles size={12} strokeWidth={1.5} />{t('rec.regenBtn')}</>
                  ) : (
                    <><Sparkles size={12} strokeWidth={1.5} />{t('rec.generateBtn')}</>
                  )}
                </button>
                {genError && (
                  <p className="mt-3 text-red-300 text-sm">{genError}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Recommendations grid ─────────────────────────────────────── */}
          {recs && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-1">{t('rec.byAI')}</p>
                  <h2 className="font-display text-2xl text-[var(--ink)]">{t('rec.heading')}</h2>
                </div>
              </div>

              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-px bg-[var(--border)]">

                {/* 1. Pattern Adjustments */}
                <RecCard icon={<Ruler size={15} strokeWidth={1.5} />} title={t('rec.card.adj')}>
                  <ul className="space-y-2">
                    {recs.pattern_adjustments.map((adj, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
                        <span className="flex-shrink-0 mt-2 w-1 h-1" style={{ background: 'var(--gold)' }} />
                        {adj}
                      </li>
                    ))}
                  </ul>
                </RecCard>

                {/* 2. Fabric */}
                <RecCard icon={<Layers size={15} strokeWidth={1.5} />} title={t('rec.card.fabric')}>
                  <div className="space-y-3 text-sm">
                    <FabricRow label={t('rec.fabric.rec')}   accent="gold"  value={recs.fabric.primary} />
                    <FabricRow label={t('rec.fabric.alt')}   accent="muted" value={recs.fabric.alternative} />
                    <FabricRow label={t('rec.fabric.avoid')} accent="red"   value={recs.fabric.avoid} />
                  </div>
                </RecCard>

                {/* 3. Colors */}
                <RecCard icon={<Palette size={15} strokeWidth={1.5} />} title={t('rec.card.color')}>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {recs.colors.map((c) => (
                      <div key={c.hex} className="flex flex-col items-center gap-1">
                        <div
                          className="w-11 h-11"
                          style={{ background: c.hex, border: '1px solid var(--border)' }}
                          title={c.hex}
                        />
                        <span className="text-[10px] text-[var(--muted)] text-center w-12 leading-tight">{c.name}</span>
                      </div>
                    ))}
                  </div>
                  {recs.color_notes.map((note, i) => (
                    <p key={i} className="text-xs text-[var(--muted)] leading-relaxed">{note}</p>
                  ))}
                </RecCard>

                {/* 4. Style Variants */}
                <RecCard icon={<Lightbulb size={15} strokeWidth={1.5} />} title={t('rec.card.style')}>
                  <div className="space-y-3">
                    {recs.style_variants.map((v) => (
                      <div key={v.occasion}>
                        <span
                          className="inline-block text-[10px] tracking-wide px-2 py-0.5 mb-1 text-[var(--gold)]"
                          style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}
                        >
                          {v.occasion}
                        </span>
                        <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{v.description}</p>
                      </div>
                    ))}
                  </div>
                </RecCard>

                {/* 5. Shopping List */}
                <RecCard icon={<ShoppingBag size={15} strokeWidth={1.5} />} title={t('rec.card.shopping')}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[var(--muted)] border-b border-[var(--border)]">
                        <th className="text-left pb-2 font-medium">{t('rec.shop.material')}</th>
                        <th className="text-center pb-2 font-medium">{t('rec.shop.qty')}</th>
                        <th className="text-right pb-2 font-medium">{t('rec.shop.price')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recs.shopping_list.map((item, i) => (
                        <tr key={i} className="border-b border-[var(--border)] last:border-0">
                          <td className="py-1.5 text-[var(--ink-soft)]">{item.item}</td>
                          <td className="py-1.5 text-center text-[var(--muted)]">{item.qty}</td>
                          <td className="py-1.5 text-right font-medium text-[var(--ink)]">
                            {item.price_ntd.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className="pt-3 text-[var(--muted)] font-medium">
                          {t('rec.shop.total')}
                        </td>
                        <td className="pt-3 text-right font-bold text-[var(--gold)]">
                          NT$ {recs.shopping_list.reduce((s, i) => s + i.price_ntd, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </RecCard>

                {/* 6. Production Estimate */}
                <RecCard icon={<Clock size={15} strokeWidth={1.5} />} title={t('rec.card.production')}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--muted)]">{t('rec.prod.difficulty')}</span>
                      <span className="text-[var(--gold)] text-base">
                        {'★'.repeat(recs.production.difficulty)}
                        <span style={{ color: 'var(--border)' }}>{'★'.repeat(4 - recs.production.difficulty)}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--muted)]">{t('rec.prod.time')}</span>
                      <span className="font-medium text-[var(--ink)]">
                        {recs.production.hours_min}–{recs.production.hours_max} {t('rec.prod.hours')}
                      </span>
                    </div>

                    <div className="border-t border-[var(--border)] pt-3">
                      {/* Cost bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-[var(--muted)] mb-1">
                          <span>{t('rec.prod.diy')}</span>
                          <span>{t('rec.prod.retail')}</span>
                        </div>
                        <div className="relative h-[2px] bg-[var(--border)] overflow-hidden">
                          <div
                            className="absolute left-0 top-0 h-full"
                            style={{
                              background: 'var(--gold)',
                              width: `${Math.min(100, (recs.production.cost_ntd / recs.production.retail_ntd) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-end justify-between">
                        <div>
                          <p className="font-display text-2xl text-[var(--gold)]">
                            NT$ {recs.production.cost_ntd.toLocaleString()}
                          </p>
                          <p className="text-xs text-[var(--muted)] line-through">
                            {t('rec.prod.retailShort')} NT$ {recs.production.retail_ntd.toLocaleString()}
                          </p>
                        </div>
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

                {/* 7. Mood Patterns — full width */}
                <div className="md:col-span-2 xl:col-span-3 bg-[var(--surface)]">
                  <RecCard icon={<Wind size={15} strokeWidth={1.5} />} title={t('rec.card.mood')}>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {recs.mood_patterns.map((mp) => (
                        <div
                          key={mp.code}
                          className="p-4 hover:bg-[var(--gold-light)] transition-colors"
                          style={{ border: '1px solid var(--border)' }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-[var(--ink)] font-mono">{mp.code}</span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 text-[var(--gold)]"
                              style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}
                            >
                              {mp.similarity}%
                            </span>
                          </div>
                          <p className="text-sm text-[var(--ink-soft)] leading-snug">{mp.name}</p>
                          {/* Similarity bar */}
                          <div className="mt-3 h-[2px] bg-[var(--border)] overflow-hidden">
                            <div
                              className="h-full"
                              style={{ background: 'var(--gold)', width: `${mp.similarity}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </RecCard>
                </div>

              </div>

              {/* Footer */}
              <div className="mt-8 flex items-center justify-between text-xs text-[var(--muted)]">
                <span>{t('rec.cached')}</span>
                <a href="/analyze" className="hover:text-[var(--ink)] transition-colors tracking-wide uppercase text-[10px]">
                  {t('rec.analyzeNew')}
                </a>
              </div>
            </div>
          )}

          {/* Empty: history exists but no recs yet */}
          {!recs && !generating && selected && (
            <div className="text-center py-20">
              <Sparkles size={36} strokeWidth={1} className="mx-auto mb-4 text-[var(--border)]" />
              <p className="text-sm text-[var(--ink-soft)] mb-1">{t('rec.emptyHint')}</p>
              <p className="text-xs text-[var(--muted)]">{t('rec.emptyHint2')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RecCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[var(--gold)]">{icon}</span>
        <h3 className="text-[10px] tracking-widest uppercase text-[var(--ink-soft)]">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function FabricRow({ label, accent, value }: { label: string; accent: 'gold' | 'muted' | 'red'; value: string }) {
  const color = accent === 'gold' ? 'var(--gold)' : accent === 'red' ? '#ef4444' : 'var(--muted)'
  const bg    = accent === 'gold' ? 'var(--gold-light)' : accent === 'red' ? '#fef2f2' : 'transparent'
  return (
    <div>
      <span
        className="inline-block text-[10px] tracking-widest uppercase mb-0.5 px-1.5 py-0.5"
        style={{ color, background: bg, border: '1px solid var(--border)' }}
      >
        {label}
      </span>
      <p className="text-[var(--ink-soft)] text-sm leading-relaxed">{value}</p>
    </div>
  )
}
