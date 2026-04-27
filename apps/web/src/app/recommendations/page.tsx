'use client'

import { useState, useEffect, useCallback } from 'react'
import { historyApi, recommendationsApi } from '@/lib/api'
import type { AnalysisHistoryItem, RecommendationsResult } from '@/lib/api'
import type { GarmentAnalysis } from '@/lib/types'

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

// Default measurements (mm) matching dev profile
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
  const [items, setItems]         = useState<AnalysisHistoryItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<AnalysisHistoryItem | null>(null)
  const [recs, setRecs]           = useState<RecommendationsResult | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]   = useState<string | null>(null)

  // Load history on mount; auto-select latest
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

  // When user selects a different analysis, load cache or clear
  const handleSelect = useCallback((item: AnalysisHistoryItem) => {
    setSelected(item)
    setGenError(null)
    const cached = loadCache(item.analysis_id)
    setRecs(cached)
  }, [])

  const generate = useCallback(async () => {
    if (!selected) return
    setGenerating(true)
    setGenError(null)
    try {
      const result = await recommendationsApi.generate(
        selected.result as unknown as Record<string, unknown>,
        DEV_MEASUREMENTS,
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
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">設計建議</h1>
        <p className="text-stone-500">
          結合 AI 分析與你的身材，產生版型調整、布料、配色、採購清單與製作預估等個人化推薦
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-32 text-stone-400">
          <div className="w-6 h-6 border-2 border-stone-200 border-t-stone-500 rounded-full animate-spin mr-3" />
          載入分析記錄…
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-32">
          <div className="text-5xl mb-4">📸</div>
          <p className="text-stone-500 mb-4">尚無分析記錄</p>
          <a
            href="/analyze"
            className="inline-block px-6 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#2E5E4E' }}
          >
            前往分析照片 →
          </a>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          {/* ── Analysis picker ──────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">
              選擇分析記錄
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {items.map(item => {
                const a = item.result as GarmentAnalysis
                const isSelected = selected?.job_id === item.job_id
                const hasCached  = !!loadCache(item.analysis_id)
                return (
                  <button
                    key={item.job_id}
                    onClick={() => handleSelect(item)}
                    className={`
                      flex-shrink-0 w-36 rounded-xl border-2 overflow-hidden text-left transition-all
                      ${isSelected
                        ? 'border-[#2E5E4E] shadow-md'
                        : 'border-stone-200 hover:border-stone-400'}
                    `}
                  >
                    {/* Thumbnail */}
                    <div className="w-full h-24 bg-stone-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={historyApi.photoUrl(item.photo_id)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-stone-700 truncate">
                        {(a as any)?.garment_type_detail ?? (a as any)?.garment_category ?? '服裝'}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {new Date(item.created_at).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                      </p>
                      {hasCached && (
                        <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: '#2E5E4E18', color: '#2E5E4E' }}>
                          已生成
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
              className="rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-start gap-6"
              style={{ background: 'linear-gradient(135deg,#2E5E4E 0%,#3d7a65 100%)' }}
            >
              {/* Photo */}
              <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-white/10">
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
                <p className="text-white/70 text-xs mb-1">分析結果摘要</p>
                <p className="text-white text-lg font-bold mb-1">
                  {(analysis as any)?.garment_type_detail ?? (analysis as any)?.garment_category ?? '服裝'}
                </p>
                <div className="flex flex-wrap gap-3 text-sm text-white/80 mb-4">
                  {analysis.fabric?.primary?.name && (
                    <span>🧶 {analysis.fabric.primary.name}</span>
                  )}
                  {analysis.cut?.silhouette && (
                    <span>✂️ {analysis.cut.silhouette}</span>
                  )}
                  {(analysis.closest_freesewing_patterns ?? [])[0]?.design && (
                    <span>🪡 {(analysis.closest_freesewing_patterns ?? [])[0].design}</span>
                  )}
                  {(analysis as any)?.difficulty_estimate && (
                    <span>⭐ {'★'.repeat((analysis as any).difficulty_estimate)} 難度</span>
                  )}
                </div>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                  style={{ background: '#C9A66B', color: '#1a1a1a' }}
                >
                  {generating ? (
                    <>
                      <span className="w-4 h-4 border-2 border-stone-800/30 border-t-stone-800 rounded-full animate-spin" />
                      Claude 正在生成推薦…
                    </>
                  ) : recs ? '↻ 重新生成推薦' : '✨ 立即生成個人化推薦'}
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
              <div className="flex items-center gap-2 mb-6">
                <h2 className="text-lg font-bold text-stone-900">為你量身推薦</h2>
                <span className="text-xs text-stone-400">· 由 Claude AI 根據分析結果與你的身材生成</span>
              </div>

              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">

                {/* 1. 版型調整 */}
                <RecCard icon="📏" title="版型調整">
                  <ul className="space-y-2">
                    {recs.pattern_adjustments.map((adj, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ background: '#2E5E4E' }} />
                        {adj}
                      </li>
                    ))}
                  </ul>
                </RecCard>

                {/* 2. 布料建議 */}
                <RecCard icon="🧶" title="布料建議">
                  <div className="space-y-3 text-sm">
                    <FabricRow label="推薦" labelColor="#2E5E4E" value={recs.fabric.primary} />
                    <FabricRow label="替代" labelColor="#6B7280" value={recs.fabric.alternative} />
                    <FabricRow label="避免" labelColor="#EF4444" value={recs.fabric.avoid} />
                  </div>
                </RecCard>

                {/* 3. 色彩方案 */}
                <RecCard icon="🎨" title="色彩方案">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {recs.colors.map((c) => (
                      <div key={c.hex} className="flex flex-col items-center gap-1">
                        <div
                          className="w-11 h-11 rounded-lg border border-stone-200 shadow-sm"
                          style={{ background: c.hex }}
                          title={c.hex}
                        />
                        <span className="text-[10px] text-stone-500 text-center w-12 leading-tight">{c.name}</span>
                      </div>
                    ))}
                  </div>
                  {recs.color_notes.map((note, i) => (
                    <p key={i} className="text-xs text-stone-500 leading-relaxed">{note}</p>
                  ))}
                </RecCard>

                {/* 4. 風格延伸 */}
                <RecCard icon="💡" title="風格延伸">
                  <div className="space-y-3">
                    {recs.style_variants.map((v) => (
                      <div key={v.occasion}>
                        <span
                          className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1"
                          style={{ background: '#2E5E4E15', color: '#2E5E4E' }}
                        >
                          {v.occasion}
                        </span>
                        <p className="text-sm text-stone-600 leading-relaxed">{v.description}</p>
                      </div>
                    ))}
                  </div>
                </RecCard>

                {/* 5. 採購清單 */}
                <RecCard icon="🛒" title="採購清單">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-stone-400 border-b border-stone-100">
                        <th className="text-left pb-2 font-medium">材料</th>
                        <th className="text-center pb-2 font-medium">數量</th>
                        <th className="text-right pb-2 font-medium">NT$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recs.shopping_list.map((item, i) => (
                        <tr key={i} className="border-b border-stone-50 last:border-0">
                          <td className="py-1.5 text-stone-700">{item.item}</td>
                          <td className="py-1.5 text-center text-stone-500">{item.qty}</td>
                          <td className="py-1.5 text-right font-medium text-stone-700">
                            {item.price_ntd.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className="pt-3 text-stone-500 font-semibold text-xs">
                          材料合計
                        </td>
                        <td className="pt-3 text-right font-bold text-sm" style={{ color: '#2E5E4E' }}>
                          NT$ {recs.shopping_list.reduce((s, i) => s + i.price_ntd, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </RecCard>

                {/* 6. 製作預估 */}
                <RecCard icon="⏱" title="製作預估">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-stone-500">難度</span>
                      <span className="text-lg">
                        <span className="text-amber-400">{'★'.repeat(recs.production.difficulty)}</span>
                        <span className="text-stone-200">{'★'.repeat(4 - recs.production.difficulty)}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-stone-500">製作時間</span>
                      <span className="font-semibold text-stone-800">
                        {recs.production.hours_min}–{recs.production.hours_max} 小時
                      </span>
                    </div>

                    <div className="border-t border-stone-100 pt-3">
                      {/* Cost comparison bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-stone-400 mb-1">
                          <span>DIY 材料成本</span>
                          <span>市售參考價</span>
                        </div>
                        <div className="relative h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="absolute left-0 top-0 h-full rounded-full"
                            style={{
                              background: '#2E5E4E',
                              width: `${Math.min(100, (recs.production.cost_ntd / recs.production.retail_ntd) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-bold" style={{ color: '#2E5E4E' }}>
                            NT$ {recs.production.cost_ntd.toLocaleString()}
                          </p>
                          <p className="text-xs text-stone-400 line-through">
                            市售 NT$ {recs.production.retail_ntd.toLocaleString()}
                          </p>
                        </div>
                        <span
                          className="text-sm font-bold px-3 py-1 rounded-full"
                          style={{ background: '#C9A66B20', color: '#8B6914' }}
                        >
                          省 {Math.round((1 - recs.production.cost_ntd / recs.production.retail_ntd) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </RecCard>

                {/* 7. 靈感版型 — spans full width */}
                <div className="md:col-span-2 xl:col-span-3">
                  <RecCard icon="🌿" title="靈感版型">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {recs.mood_patterns.map((mp) => (
                        <div
                          key={mp.code}
                          className="rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-stone-800 font-mono">{mp.code}</span>
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: '#2E5E4E15', color: '#2E5E4E' }}
                            >
                              {mp.similarity}%
                            </span>
                          </div>
                          <p className="text-sm text-stone-600 leading-snug">{mp.name}</p>
                          {/* Similarity bar */}
                          <div className="mt-2 h-1 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ background: '#C9A66B', width: `${mp.similarity}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </RecCard>
                </div>

              </div>

              {/* Footer actions */}
              <div className="mt-8 flex items-center justify-between text-sm text-stone-400">
                <span>推薦結果已快取，下次開啟本頁自動載入</span>
                <a href="/analyze" className="hover:text-stone-700 transition-colors">
                  分析新照片 →
                </a>
              </div>
            </div>
          )}

          {/* Empty state: history exists but no recs yet */}
          {!recs && !generating && selected && (
            <div className="text-center py-16 text-stone-400">
              <p className="text-4xl mb-4">✨</p>
              <p className="text-stone-500 mb-2">點擊上方按鈕，Claude 將根據你的身材與分析結果</p>
              <p className="text-stone-400 text-sm">產生版型調整、布料建議、配色方案、採購清單與製作預估</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RecCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{icon}</span>
        <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function FabricRow({ label, labelColor, value }: { label: string; labelColor: string; value: string }) {
  return (
    <div>
      <span
        className="inline-block text-[10px] font-bold uppercase tracking-widest mb-0.5 px-1.5 py-0.5 rounded"
        style={{ color: labelColor, background: labelColor + '15' }}
      >
        {label}
      </span>
      <p className="text-stone-700 text-sm leading-relaxed">{value}</p>
    </div>
  )
}
