'use client'

import { useState, useRef } from 'react'
import { searchApi } from '@/lib/api'
import type { CatalogSearchResult } from '@/lib/api'

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

const GARMENT_TYPES = [
  { id: '',          label: '全部' },
  { id: 'top',       label: '上衣' },
  { id: 'bottom',    label: '下身' },
  { id: 'outerwear', label: '外套' },
  { id: 'block',     label: '基礎版' },
  { id: 'lingerie',  label: '內衣' },
]

const FABRIC_WEIGHTS = [
  { id: '',       label: '任意重量' },
  { id: 'light',  label: '輕薄' },
  { id: 'medium', label: '中等' },
  { id: 'heavy',  label: '厚重' },
]

const DIFFICULTY_STARS: Record<number, string> = { 1: '★', 2: '★★', 3: '★★★', 4: '★★★★' }

const PRESET_QUERIES = [
  '寬鬆棉質上衣', '正裝襯衫', '輕盈夏日裙', '保暖外套', '初學者容易製作',
  '彈性針織', '雙排扣大衣', '瑜珈/運動',
]

export default function SearchPage() {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<CatalogSearchResult[]>([])
  const [loading, setLoading]     = useState(false)
  const [searched, setSearched]   = useState(false)
  const [gtype, setGtype]         = useState('')
  const [fweight, setFweight]     = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const doSearch = async (q?: string) => {
    const queryText = q ?? query
    if (!queryText.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await searchApi.query(queryText.trim(), 8, gtype || undefined, fweight || undefined)
      setResults(res)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-2">版型語意搜尋</h1>
        <p className="text-stone-500">用自然語言描述想要的服裝，AI 幫你找最接近的版型</p>
      </div>

      {/* Search box */}
      <div className="flex gap-3 mb-4">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="例：寬鬆棉質連帽衫、fitted linen shirt..."
          className="flex-1 border border-stone-300 rounded-xl px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          onClick={() => doSearch()}
          disabled={loading || !query.trim()}
          className="px-6 py-3 bg-stone-900 text-white font-medium rounded-xl hover:bg-stone-700 disabled:opacity-40 transition-colors"
        >
          {loading ? '搜尋中…' : '搜尋'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-1.5 flex-wrap">
          {GARMENT_TYPES.map(g => (
            <button
              key={g.id}
              onClick={() => setGtype(g.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                gtype === g.id
                  ? 'bg-stone-900 text-white'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >{g.label}</button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FABRIC_WEIGHTS.map(f => (
            <button
              key={f.id}
              onClick={() => setFweight(f.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                fweight === f.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {/* Preset queries */}
      {!searched && (
        <div>
          <p className="text-xs text-stone-400 mb-3">快速試試：</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_QUERIES.map(q => (
              <button
                key={q}
                onClick={() => { setQuery(q); doSearch(q) }}
                className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center h-40 text-stone-400">
          <div className="text-center">
            <div className="text-3xl animate-spin mb-2">⟳</div>
            <p className="text-sm">AI 正在比對向量…</p>
          </div>
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="text-center py-16 text-stone-400">
          <p className="text-lg mb-1">找不到相符的版型</p>
          <p className="text-sm">試試其他關鍵字，或移除篩選條件</p>
        </div>
      )}

      {results.length > 0 && !loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {results.map(item => (
            <SearchResultCard key={item.fs_design_id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function SearchResultCard({ item }: { item: CatalogSearchResult }) {
  const pct = Math.round((item.score ?? 0) * 100)

  const WEIGHT_LABELS: Record<string, string> = { light: '輕薄', medium: '中等', heavy: '厚重' }
  const TYPE_LABELS: Record<string, string>   = {
    top: '上衣', bottom: '下身', outerwear: '外套',
    block: '基礎版', lingerie: '內衣',
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <span className="font-semibold text-stone-800 capitalize text-base">{item.name}</span>
        <div className="flex flex-col items-end gap-1">
          {/* Similarity bar */}
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-stone-400">{pct}%</span>
          </div>
        </div>
      </div>

      {/* Description */}
      {item.description_zh && (
        <p className="text-xs text-stone-500 mb-3 leading-relaxed">{item.description_zh}</p>
      )}

      {/* Meta chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {item.garment_type && (
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
            {TYPE_LABELS[item.garment_type] ?? item.garment_type}
          </span>
        )}
        {item.fabric_weight && (
          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
            {WEIGHT_LABELS[item.fabric_weight] ?? item.fabric_weight}
          </span>
        )}
        {item.difficulty && (
          <span className="text-xs text-amber-500 px-1">
            {DIFFICULTY_STARS[item.difficulty] ?? ''}
          </span>
        )}
      </div>

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {item.tags.slice(0, 4).map(tag => (
            <span key={tag} className="text-xs bg-stone-50 text-stone-500 border border-stone-200 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Action */}
      <a
        href={`/pattern`}
        onClick={() => {
          // 存到 sessionStorage 讓 pattern 頁自動選取
          sessionStorage.setItem('autoSelectDesign', item.fs_design_id)
        }}
        className="block text-center text-xs font-medium py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors mt-1"
      >
        打這款版型 →
      </a>
    </div>
  )
}
