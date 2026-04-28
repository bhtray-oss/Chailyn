'use client'

import { useState, useEffect } from 'react'
import { patternApi } from '@/lib/api'
import type { WardrobeItem, VersionEntry } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

const FAMILY_KEY: Record<string, string> = {
  aaron: 'family.top', teagan: 'family.top', bibi: 'family.top', lily: 'family.top',
  bella: 'family.block', brian: 'family.block',
  simon: 'family.shirt', simone: 'family.shirt',
  huey: 'family.outerwear', carlton: 'family.outerwear', carlita: 'family.outerwear',
  sandy: 'family.skirt',
  titan: 'family.pants', paco: 'family.pants', waralee: 'family.pants',
}

const DIFFICULTY: Record<number, string> = { 1: '★', 2: '★★', 3: '★★★', 4: '★★★★' }

interface ExpandedHistory {
  [instanceId: string]: VersionEntry[]
}

export default function WardrobePage() {
  const { t, lang } = useLanguage()
  const [items, setItems]               = useState<WardrobeItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [expanded, setExpanded]         = useState<ExpandedHistory>({})
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null)
  const [filterDesign, setFilterDesign] = useState<string>('all')

  useEffect(() => {
    patternApi.listUserPatterns(DEV_USER_ID)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleHistory = async (item: WardrobeItem) => {
    if (expanded[item.id]) {
      setExpanded(prev => { const n = { ...prev }; delete n[item.id]; return n })
      return
    }
    setLoadingHistory(item.id)
    try {
      const h = await patternApi.getHistory(item.id)
      setExpanded(prev => ({ ...prev, [item.id]: h.versions }))
    } catch {}
    setLoadingHistory(null)
  }

  const familyLabel = (design: string) => {
    const key = FAMILY_KEY[design]
    return key ? t(key as Parameters<typeof t>[0]) : t('family.other')
  }

  const designs = ['all', ...Array.from(new Set(items.map(i => i.design)))]
  const filtered = filterDesign === 'all' ? items : items.filter(i => i.design === filterDesign)
  const families = Array.from(new Set(filtered.map(i => familyLabel(i.design))))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400">
        <div className="text-center">
          <div className="text-3xl animate-spin mb-3">⟳</div>
          <p>{t('wardrobe.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{t('wardrobe.title')}</h1>
          <p className="text-stone-500 mt-1">
            {items.length > 0
              ? lang === 'zh'
                ? `共 ${items.length} 款版型 · ${items.reduce((s, i) => s + i.total_versions, 0)} 個版本`
                : `${items.length} patterns · ${items.reduce((s, i) => s + i.total_versions, 0)} versions`
              : lang === 'zh' ? '尚無儲存的版型' : 'No saved patterns yet'}
          </p>
        </div>
        <a
          href="/pattern"
          className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
        >
          {t('wardrobe.newPattern')}
        </a>
      </div>

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400">
          <div className="text-5xl mb-4">🧵</div>
          <p className="text-base font-medium">{t('wardrobe.emptyTitle')}</p>
          <p className="text-sm mt-1">{t('wardrobe.emptyHint')}</p>
          <a href="/pattern" className="mt-4 text-sm text-amber-600 hover:text-amber-700 font-medium">
            {t('wardrobe.startDrafting')}
          </a>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap mb-6">
            {designs.map(d => (
              <button
                key={d}
                onClick={() => setFilterDesign(d)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
                  filterDesign === d
                    ? 'bg-stone-900 text-white'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                {d === 'all' ? `${t('wardrobe.filterAll')}（${items.length}）` : d}
              </button>
            ))}
          </div>

          {/* Cards by family */}
          {families.map(fam => {
            const group = filtered.filter(i => familyLabel(i.design) === fam)
            return (
              <div key={fam} className="mb-8">
                <div className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3 px-1">
                  {fam}
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.map(item => (
                    <WardrobeCard
                      key={item.id}
                      item={item}
                      versions={expanded[item.id]}
                      loadingHistory={loadingHistory === item.id}
                      onToggleHistory={() => toggleHistory(item)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function WardrobeCard({
  item,
  versions,
  loadingHistory,
  onToggleHistory,
}: {
  item: WardrobeItem
  versions?: VersionEntry[]
  loadingHistory: boolean
  onToggleHistory: () => void
}) {
  const { t, lang } = useLanguage()
  const dateStr = new Date(item.created_at).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-stone-800 capitalize">{item.design}</span>
              {item.created_by_ai && (
                <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">AI</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <span>v{item.version}</span>
              <span>·</span>
              <span>{t('wardrobe.seam')} {item.sa}mm</span>
              {item.paperless && <><span>·</span><span>paperless</span></>}
            </div>
          </div>
          <div className="text-right text-xs text-stone-400">
            <div>{dateStr}</div>
            {item.total_versions > 1 && (
              <div className="text-amber-500 font-medium mt-0.5">{item.total_versions} {t('wardrobe.versions')}</div>
            )}
          </div>
        </div>

        {item.notes && (
          <p className="text-xs text-stone-400 italic mt-2">{item.notes}</p>
        )}
      </div>

      {/* Action bar */}
      <div className="flex border-t border-stone-100">
        <a
          href={`/pattern?redraft=${item.id}`}
          className="flex-1 py-2.5 text-center text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          ↻ Redraft
        </a>
        <button
          onClick={onToggleHistory}
          disabled={loadingHistory}
          className={`flex-1 py-2.5 text-center text-xs font-medium transition-colors border-l border-stone-100
            ${versions ? 'text-amber-600 bg-amber-50' : 'text-stone-600 hover:bg-stone-50'}
            disabled:opacity-50`}
        >
          {loadingHistory
            ? t('wardrobe.loadingHistory')
            : versions
              ? t('wardrobe.hideHistory')
              : `${t('wardrobe.history')}（${item.total_versions}）`}
        </button>
      </div>

      {/* Version history expansion */}
      {versions && (
        <div className="border-t border-stone-100 bg-stone-50">
          {[...versions].reverse().map((v, idx) => (
            <div
              key={v.id}
              className={`px-4 py-2.5 flex items-center justify-between text-xs
                ${idx < versions.length - 1 ? 'border-b border-stone-100' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono bg-white border border-stone-200 text-stone-600 px-1.5 py-0.5 rounded">
                  v{v.version}
                </span>
                <span className="text-stone-600">
                  {new Date(v.created_at).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US')}
                </span>
                {v.notes && (
                  <span className="text-stone-400 italic truncate max-w-[80px]">{v.notes}</span>
                )}
              </div>
              <a
                href={`/pattern?redraft=${v.id}`}
                className="text-amber-500 hover:text-amber-700 font-medium"
              >
                Redraft
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
