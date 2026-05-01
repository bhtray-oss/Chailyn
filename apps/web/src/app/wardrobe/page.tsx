'use client'

import { useState, useEffect } from 'react'
import { patternApi } from '@/lib/api'
import type { WardrobeItem, VersionEntry } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'
import { Loader2, Scissors } from 'lucide-react'

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
      <div className="flex items-center justify-center h-64 text-[var(--muted)]">
        <div className="text-center flex flex-col items-center gap-3">
          <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
          <p className="text-xs tracking-widest uppercase">{t('wardrobe.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-2">
            {lang === 'zh' ? '已儲存版型' : 'Saved Patterns'}
          </p>
          <h1 className="font-display text-3xl text-[var(--ink)]">{t('wardrobe.title')}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {items.length > 0
              ? lang === 'zh'
                ? `共 ${items.length} 款版型 · ${items.reduce((s, i) => s + i.total_versions, 0)} 個版本`
                : `${items.length} patterns · ${items.reduce((s, i) => s + i.total_versions, 0)} versions`
              : lang === 'zh' ? '尚無儲存的版型' : 'No saved patterns yet'}
          </p>
        </div>
        <a
          href="/pattern"
          className="text-[10px] tracking-widest uppercase font-medium px-4 py-2 transition-opacity hover:opacity-70"
          style={{ background: 'var(--ink)', color: 'var(--surface)' }}
        >
          {t('wardrobe.newPattern')}
        </a>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div
          className="flex flex-col items-center justify-center h-64 border-2 border-dashed text-[var(--muted)]"
          style={{ borderColor: 'var(--border)' }}
        >
          <Scissors size={32} strokeWidth={1} className="text-[var(--border)] mb-4" />
          <p className="text-sm font-medium text-[var(--ink-soft)]">{t('wardrobe.emptyTitle')}</p>
          <p className="text-xs mt-1">{t('wardrobe.emptyHint')}</p>
          <a
            href="/pattern"
            className="mt-5 text-[10px] tracking-widest uppercase text-[var(--gold)] hover:opacity-70 transition-opacity"
          >
            {t('wardrobe.startDrafting')} →
          </a>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Filter tabs */}
          <div className="flex gap-1.5 flex-wrap mb-6">
            {designs.map(d => (
              <button
                key={d}
                onClick={() => setFilterDesign(d)}
                className="px-3 py-1 text-xs tracking-wide capitalize font-medium transition-colors"
                style={{
                  background: filterDesign === d ? 'var(--ink)' : 'transparent',
                  color:      filterDesign === d ? 'var(--surface)' : 'var(--muted)',
                  border:     '1px solid ' + (filterDesign === d ? 'var(--ink)' : 'var(--border)'),
                }}
              >
                {d === 'all' ? `${t('wardrobe.filterAll')}（${items.length}）` : d}
              </button>
            ))}
          </div>

          {/* Cards by family */}
          {families.map(fam => {
            const group = filtered.filter(i => familyLabel(i.design) === fam)
            return (
              <div key={fam} className="mb-10">
                <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-3 px-1">
                  {fam}
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border)]">
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
    <div className="bg-[var(--surface)] flex flex-col">
      <div className="px-4 pt-4 pb-3 flex-1">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display text-lg text-[var(--ink)] capitalize">{item.design}</span>
              {item.created_by_ai && (
                <span
                  className="text-[10px] px-1.5 py-0.5 tracking-wide text-[var(--gold)]"
                  style={{ border: '1px solid var(--border)' }}
                >
                  AI
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span>v{item.version}</span>
              <span>·</span>
              <span>{t('wardrobe.seam')} {item.sa}mm</span>
              {item.paperless && <><span>·</span><span>paperless</span></>}
            </div>
          </div>
          <div className="text-right text-xs text-[var(--muted)]">
            <div>{dateStr}</div>
            {item.total_versions > 1 && (
              <div className="text-[var(--gold)] mt-0.5">{item.total_versions} {t('wardrobe.versions')}</div>
            )}
          </div>
        </div>

        {item.notes && (
          <p className="text-xs text-[var(--muted)] italic mt-2">{item.notes}</p>
        )}
      </div>

      {/* Action bar */}
      <div className="flex border-t border-[var(--border)]">
        <a
          href={`/pattern?redraft=${item.id}`}
          className="flex-1 py-2.5 text-center text-[10px] tracking-widest uppercase text-[var(--ink-soft)] hover:bg-[var(--gold-light)] transition-colors font-medium"
        >
          ↻ Redraft
        </a>
        <button
          onClick={onToggleHistory}
          disabled={loadingHistory}
          className="flex-1 py-2.5 text-center text-[10px] tracking-widest uppercase font-medium transition-colors border-l border-[var(--border)] disabled:opacity-50"
          style={{
            color:      versions ? 'var(--gold)' : 'var(--muted)',
            background: versions ? 'var(--gold-light)' : 'transparent',
          }}
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
        <div className="border-t border-[var(--border)] bg-[var(--bg)]">
          {[...versions].reverse().map((v, idx) => (
            <div
              key={v.id}
              className={`px-4 py-2.5 flex items-center justify-between text-xs
                ${idx < versions.length - 1 ? 'border-b border-[var(--border)]' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="font-mono px-1.5 py-0.5 text-[var(--ink-soft)]"
                  style={{ border: '1px solid var(--border)' }}
                >
                  v{v.version}
                </span>
                <span className="text-[var(--ink-soft)]">
                  {new Date(v.created_at).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US')}
                </span>
                {v.notes && (
                  <span className="text-[var(--muted)] italic truncate max-w-[80px]">{v.notes}</span>
                )}
              </div>
              <a
                href={`/pattern?redraft=${v.id}`}
                className="text-[var(--gold)] hover:opacity-70 font-medium tracking-wide uppercase text-[10px]"
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
