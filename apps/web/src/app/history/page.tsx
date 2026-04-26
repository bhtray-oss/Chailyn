'use client'

import { useState, useEffect, useCallback } from 'react'
import { historyApi, patternApi } from '@/lib/api'
import type { AnalysisHistoryItem } from '@/lib/api'
import type { GarmentAnalysis } from '@/lib/types'

const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

export default function HistoryPage() {
  const [items, setItems]       = useState<AnalysisHistoryItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [patternSvgs, setPatternSvgs] = useState<Record<string, string | 'loading'>>({})
  const [activePreview, setActivePreview] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await historyApi.list(DEV_USER_ID)
      setItems(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (jobId: string) => {
    if (!confirm('確定要刪除這筆分析記錄？')) return
    setDeleting(jobId)
    try {
      await historyApi.delete(jobId, DEV_USER_ID)
      setItems(prev => prev.filter(i => i.job_id !== jobId))
      if (expanded === jobId) setExpanded(null)
    } catch (e: any) {
      alert(`刪除失敗：${e.message}`)
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
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const activeSvg = activePreview ? patternSvgs[activePreview] : null

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">分析歷史</h1>
          <p className="text-stone-500 text-sm mt-1">所有服裝照片的 AI 分析記錄，自動儲存</p>
        </div>
        <a href="/analyze"
          className="text-sm font-medium px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors">
          + 新增分析
        </a>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 gap-3 text-stone-400">
          <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          載入中…
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-24 text-stone-400">
          <div className="text-5xl mb-4">📂</div>
          <p className="text-lg font-medium text-stone-600 mb-2">尚無分析記錄</p>
          <p className="text-sm mb-6">上傳服裝照片後，結果會自動儲存在這裡</p>
          <a href="/analyze"
            className="text-sm font-medium px-5 py-2.5 bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors">
            開始分析
          </a>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => {
            const analysis = item.result as GarmentAnalysis
            const isExpanded = expanded === item.job_id
            const topPatterns = analysis?.closest_freesewing_patterns?.slice(0, 3) ?? []

            return (
              <div key={item.job_id}
                className="bg-white border border-stone-200 rounded-2xl overflow-hidden hover:shadow-sm transition-shadow">

                {/* ── 卡片頭部（縮圖 + 摘要 + 操作） ── */}
                <div className="flex gap-4 p-4">
                  {/* 縮圖 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={historyApi.photoUrl(item.photo_id)}
                    alt="服裝照片"
                    className="w-24 h-24 object-cover rounded-xl border border-stone-100 flex-shrink-0 bg-stone-50"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />

                  {/* 摘要文字 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-stone-400 mb-1">{formatDate(item.created_at)}</p>
                        <p className="font-semibold text-stone-800">
                          {analysis?.fabric?.primary?.name ?? '未知布料'}
                          {analysis?.cut?.silhouette ? ` · ${analysis.cut.silhouette}` : ''}
                        </p>
                        <p className="text-sm text-stone-500 mt-0.5">
                          {analysis?.fabric?.primary?.composition_estimate ?? ''}
                        </p>
                      </div>
                      {/* 難度標記 */}
                      {(analysis as any)?.difficulty_estimate && (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
                          {'★'.repeat((analysis as any).difficulty_estimate)}
                        </span>
                      )}
                    </div>

                    {/* 推薦版型標籤 */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {topPatterns.map(p => (
                        <span key={p.design}
                          className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full capitalize">
                          {p.design} {Math.round(p.confidence * 100)}%
                        </span>
                      ))}
                      {analysis?.silhouette_tags?.slice(0, 2).map(tag => (
                        <span key={tag}
                          className="text-xs bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full">
                          {tag.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 操作按鈕 */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => { setExpanded(isExpanded ? null : item.job_id); setActivePreview(null) }}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      {isExpanded ? '收起' : '查看詳情'}
                    </button>
                    <button
                      onClick={() => handleDelete(item.job_id)}
                      disabled={deleting === item.job_id}
                      className="text-xs px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 border border-red-200 transition-colors disabled:opacity-50"
                    >
                      {deleting === item.job_id ? '刪除中…' : '刪除'}
                    </button>
                  </div>
                </div>

                {/* ── 展開詳情 ── */}
                {isExpanded && analysis && (
                  <div className="border-t border-stone-100 p-4">
                    {/* 詳細資料 grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <InfoBox label="廓形" value={analysis.cut?.silhouette} />
                      <InfoBox label="鬆量" value={(analysis.cut as any)?.fit_ease} />
                      <InfoBox label="領型" value={
                        typeof analysis.components?.collar === 'object'
                          ? (analysis.components.collar as any)?.type
                          : analysis.components?.collar as string
                      } />
                      <InfoBox label="袖型" value={
                        typeof analysis.components?.sleeves === 'object'
                          ? (analysis.components.sleeves as any)?.type
                          : analysis.components?.sleeves as string
                      } />
                    </div>

                    {/* 推薦版型 + 預覽按鈕 */}
                    <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">
                      推薦 FreeSewing 版型
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {topPatterns.map(p => {
                        const isActive = activePreview === p.design
                        const state = patternSvgs[p.design]
                        return (
                          <button key={p.design}
                            onClick={() => draftPattern(p.design)}
                            disabled={state === 'loading'}
                            className={`text-sm font-medium px-4 py-2 rounded-xl border transition-colors capitalize
                              ${isActive && state && state !== 'loading'
                                ? 'bg-stone-900 text-white border-stone-900'
                                : 'border-stone-300 text-stone-700 hover:bg-stone-50'}
                              ${state === 'loading' ? 'opacity-50' : ''}`}
                          >
                            {state === 'loading' && isActive ? '打版中…' : `🪡 ${p.design} (${Math.round(p.confidence * 100)}%)`}
                          </button>
                        )
                      })}
                    </div>

                    {/* 全寬 SVG 預覽 */}
                    {activePreview && (
                      <div className="border border-stone-200 rounded-xl overflow-hidden bg-stone-50">
                        {/* 工具列 */}
                        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-stone-100">
                          <span className="text-sm font-semibold text-stone-800 capitalize">
                            {activePreview} 版型圖樣
                          </span>
                          <div className="flex items-center gap-3">
                            {activeSvg && activeSvg !== 'loading' && (
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => setZoom(z => Math.max(30, z - 10))}
                                  className="w-6 h-6 rounded border border-stone-300 text-stone-600 hover:bg-stone-100 text-xs flex items-center justify-center">−</button>
                                <input type="range" min={30} max={300} step={5} value={zoom}
                                  onChange={e => setZoom(Number(e.target.value))}
                                  className="w-28 accent-stone-700" />
                                <button onClick={() => setZoom(z => Math.min(300, z + 10))}
                                  className="w-6 h-6 rounded border border-stone-300 text-stone-600 hover:bg-stone-100 text-xs flex items-center justify-center">+</button>
                                <span className="text-xs text-stone-500 w-10">{zoom}%</span>
                                <button onClick={() => setZoom(100)} className="text-xs text-stone-400 hover:text-stone-700">重置</button>
                              </div>
                            )}
                            <button onClick={() => setActivePreview(null)} className="text-stone-400 hover:text-stone-700 text-sm px-2">✕</button>
                          </div>
                        </div>

                        {/* SVG 內容 */}
                        <div className="overflow-auto p-4" style={{ maxHeight: '70vh' }}>
                          {activeSvg === 'loading' ? (
                            <div className="flex items-center justify-center py-16 gap-3">
                              <div className="w-6 h-6 border-2 border-stone-200 border-t-stone-700 rounded-full animate-spin" />
                              <span className="text-stone-400 text-sm">正在生成 {activePreview} 版型…</span>
                            </div>
                          ) : activeSvg ? (
                            <div style={{ zoom: zoom / 100 }}
                              dangerouslySetInnerHTML={{ __html: activeSvg }} />
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-stone-50 rounded-xl p-3">
      <p className="text-xs text-stone-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-stone-800">{value ?? '—'}</p>
    </div>
  )
}
