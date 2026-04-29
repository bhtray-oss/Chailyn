'use client'

import { useState, useRef } from 'react'
import { searchApi } from '@/lib/api'
import type { CatalogSearchResult } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'
import { Search, Loader2 } from 'lucide-react'

const GARMENT_TYPE_KEYS = ['', 'top', 'bottom', 'outerwear', 'block', 'lingerie'] as const
const FABRIC_WEIGHT_KEYS = ['', 'light', 'medium', 'heavy'] as const
const DIFFICULTY_STARS: Record<number, string> = { 1: '★', 2: '★★', 3: '★★★', 4: '★★★★' }

export default function SearchPage() {
  const { t, lang } = useLanguage()
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<CatalogSearchResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)
  const [gtype, setGtype]       = useState('')
  const [fweight, setFweight]   = useState('')
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

      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-2">
          {lang === 'zh' ? '語意搜尋' : 'Semantic Search'}
        </p>
        <h1 className="font-display text-3xl text-[var(--ink)]">{t('search.title')}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">{t('search.subtitle')}</p>
      </div>

      {/* Search box */}
      <div className="flex gap-0 mb-4 border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center pl-4 text-[var(--muted)]">
          <Search size={16} strokeWidth={1.5} />
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder={t('search.placeholder')}
          className="flex-1 px-3 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] bg-transparent focus:outline-none"
        />
        <button
          onClick={() => doSearch()}
          disabled={loading || !query.trim()}
          className="px-6 py-3 text-xs tracking-widest uppercase font-medium transition-all disabled:opacity-40"
          style={{
            background: 'var(--ink)',
            color: 'var(--surface)',
          }}
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
              className="px-3 py-1 text-xs tracking-wide uppercase font-medium transition-colors"
              style={{
                background: gtype === id ? 'var(--ink)' : 'transparent',
                color:      gtype === id ? 'var(--surface)' : 'var(--muted)',
                border:     '1px solid ' + (gtype === id ? 'var(--ink)' : 'var(--border)'),
              }}
            >{gtypeLabel(id)}</button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FABRIC_WEIGHT_KEYS.map(id => (
            <button
              key={id}
              onClick={() => setFweight(id)}
              className="px-3 py-1 text-xs tracking-wide uppercase font-medium transition-colors"
              style={{
                background: fweight === id ? 'var(--gold)' : 'transparent',
                color:      fweight === id ? 'var(--surface)' : 'var(--muted)',
                border:     '1px solid ' + (fweight === id ? 'var(--gold)' : 'var(--border)'),
              }}
            >{fweightLabel(id)}</button>
          ))}
        </div>
      </div>

      {/* Preset queries */}
      {!searched && (
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] mb-3">{t('search.quickTry')}</p>
          <div className="flex flex-wrap gap-2">
            {presetQueries.map(q => (
              <button
                key={q}
                onClick={() => { setQuery(q); doSearch(q) }}
                className="px-3 py-1.5 text-xs text-[var(--ink-soft)] hover:bg-[var(--gold-light)] transition-colors"
                style={{ border: '1px solid var(--border)' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40 text-[var(--muted)]">
          <div className="text-center flex flex-col items-center gap-3">
            <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
            <p className="text-xs tracking-widest uppercase">{t('search.matching')}</p>
          </div>
        </div>
      )}

      {/* No results */}
      {searched && !loading && results.length === 0 && (
        <div className="text-center py-16 text-[var(--muted)]">
          <p className="text-sm font-medium text-[var(--ink-soft)] mb-1">{t('search.noResults')}</p>
          <p className="text-xs">{t('search.noResultsHint')}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && !loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border)] mt-6">
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
    <div className="bg-[var(--surface)] p-5 flex flex-col gap-3 hover:bg-[var(--gold-light)] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <span className="font-display text-xl text-[var(--ink)] capitalize">{item.name}</span>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-12 h-[2px] bg-[var(--border)] overflow-hidden">
            <div className="h-full bg-[var(--gold)]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-[var(--muted)] tracking-wide">{pct}%</span>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-[var(--muted)] leading-relaxed">{description}</p>
      )}

      {/* Meta chips */}
      <div className="flex flex-wrap gap-1.5">
        {item.garment_type && (
          <span
            className="text-[10px] tracking-wide px-2 py-0.5 uppercase"
            style={{ background: 'var(--gold-light)', color: 'var(--gold)', border: '1px solid var(--border)' }}
          >
            {typeLabel(item.garment_type)}
          </span>
        )}
        {item.fabric_weight && (
          <span
            className="text-[10px] tracking-wide px-2 py-0.5 uppercase text-[var(--muted)]"
            style={{ border: '1px solid var(--border)' }}
          >
            {weightLabel(item.fabric_weight)}
          </span>
        )}
        {item.difficulty && (
          <span className="text-xs text-[var(--gold)] px-1">
            {DIFFICULTY_STARS[item.difficulty] ?? ''}
          </span>
        )}
      </div>

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 4).map(tag => (
            <span
              key={tag}
              className="text-[10px] text-[var(--muted)] px-1.5 py-0.5"
              style={{ border: '1px solid var(--border)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Action */}
      <a
        href="/pattern"
        onClick={() => { sessionStorage.setItem('autoSelectDesign', item.fs_design_id) }}
        className="mt-auto text-[10px] tracking-widest uppercase text-center py-2 font-medium transition-opacity hover:opacity-70"
        style={{ background: 'var(--ink)', color: 'var(--surface)' }}
      >
        {t('search.draftThis')}
      </a>
    </div>
  )
}
