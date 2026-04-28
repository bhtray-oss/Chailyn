'use client'

import { useState, useRef } from 'react'
import { searchApi } from '@/lib/api'
import type { CatalogSearchResult } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'

const GARMENT_TYPE_KEYS = ['', 'top', 'bottom', 'outerwear', 'block', 'lingerie'] as const
const FABRIC_WEIGHT_KEYS = ['', 'light', 'medium', 'heavy'] as const
const DIFFICULTY_STARS: Record<number, string> = { 1: '★', 2: '★★', 3: '★★★', 4: '★★★★' }

export default function SearchPage() {
  const { t, lang } = useLanguage()
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<CatalogSearchResult[]>([])
  const [loading, setLoading]     = useState(false)
  const [searched, setSearched]   = useState(false)
  const [gtype, setGtype]         = useState('')
  const [fweight, setFweight]     = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const presetQueries = [
    t('search.preset.1'), t('search.preset.2'), t('search.preset.3'), t('search.preset.4'),
    t('search.preset.5'), t('search.preset.6'), t('search.preset.7'), t('search.preset.8'),
  ]

  const gtypeLabel = (id: string) => {
    if (id === '')          return t('type.all')
    if (id === 'top')       return t('type.top')
    if (id === 'bottom')    return t('type.bottom')
    if (id === 'outerwear') return t('type.outerwear')
    if (id === 'block')     return t('type.block')
    if (id === 'lingerie')  return t('type.lingerie')
    return id
  }

  const fweightLabel = (id: string) => {
    if (id === '')       return t('weight.any')
    if (id === 'light')  return t('weight.light')
    if (id === 'medium') return t('weight.medium')
    if (id === 'heavy')  return t('weight.heavy')
    return id
  }

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
        <h1 className="text-2xl font-bold text-stone-900 mb-2">{t('search.title')}</h1>
        <p className="text-stone-500">{t('search.subtitle')}</p>
      </div>

      {/* Search box */}
      <div className="flex gap-3 mb-4">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder={t('search.placeholder')}
          className="flex-1 border border-stone-300 rounded-xl px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          onClick={() => doSearch()}
          disabled={loading || !query.trim()}
          className="px-6 py-3 bg-stone-900 text-white font-medium rounded-xl hover:bg-stone-700 disabled:opacity-40 transition-colors"
        >
          {loading ? t('search.searching') : t('search.btn')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-1.5 flex-wrap">
          {GARMENT_TYPE_KEYS.map(id => (
            <button
              key={id}
              onClick={() => setGtype(id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                gtype === id
                  ? 'bg-stone-900 text-white'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >{gtypeLabel(id)}</button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FABRIC_WEIGHT_KEYS.map(id => (
            <button
              key={id}
              onClick={() => setFweight(id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                fweight === id
                  ? 'bg-amber-600 text-white'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >{fweightLabel(id)}</button>
          ))}
        </div>
      </div>

      {/* Preset queries */}
      {!searched && (
        <div>
          <p className="text-xs text-stone-400 mb-3">{t('search.quickTry')}</p>
          <div className="flex flex-wrap gap-2">
            {presetQueries.map(q => (
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
            <p className="text-sm">{t('search.matching')}</p>
          </div>
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="text-center py-16 text-stone-400">
          <p className="text-lg mb-1">{t('search.noResults')}</p>
          <p className="text-sm">{t('search.noResultsHint')}</p>
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
  const { t, lang } = useLanguage()
  const pct = Math.round((item.score ?? 0) * 100)

  const weightLabel = (w: string) => {
    if (w === 'light')  return t('weight.light')
    if (w === 'medium') return t('weight.medium')
    if (w === 'heavy')  return t('weight.heavy')
    return w
  }

  const typeLabel = (tp: string) => {
    if (tp === 'top')       return t('type.top')
    if (tp === 'bottom')    return t('type.bottom')
    if (tp === 'outerwear') return t('type.outerwear')
    if (tp === 'block')     return t('type.block')
    if (tp === 'lingerie')  return t('type.lingerie')
    return tp
  }

  const description = item.description_zh

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <span className="font-semibold text-stone-800 capitalize text-base">{item.name}</span>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-stone-400">{pct}%</span>
          </div>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-stone-500 mb-3 leading-relaxed">{description}</p>
      )}

      {/* Meta chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {item.garment_type && (
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
            {typeLabel(item.garment_type)}
          </span>
        )}
        {item.fabric_weight && (
          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
            {weightLabel(item.fabric_weight)}
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
        href="/pattern"
        onClick={() => { sessionStorage.setItem('autoSelectDesign', item.fs_design_id) }}
        className="block text-center text-xs font-medium py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors mt-1"
      >
        {t('search.draftThis')}
      </a>
    </div>
  )
}
