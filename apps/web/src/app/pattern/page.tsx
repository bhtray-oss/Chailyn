'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { patternApi } from '@/lib/api'
import type { CatalogItem, VersionEntry } from '@/lib/api'
import PatternViewer from '@/components/PatternViewer'
import { Suspense } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { Loader2, ExternalLink } from 'lucide-react'

const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

type FamilyKey = 'family.top' | 'family.shirt' | 'family.outerwear' | 'family.skirt' | 'family.pants'
type TabKey    = 'fs' | 'mood'

const DESIGNS: Array<{ id: string; name: string; familyKey: FamilyKey }> = [
  { id: 'aaron',   name: 'Aaron',   familyKey: 'family.top' },
  { id: 'teagan',  name: 'Teagan',  familyKey: 'family.top' },
  { id: 'bibi',    name: 'Bibi',    familyKey: 'family.top' },
  { id: 'lily',    name: 'Lily',    familyKey: 'family.top' },
  { id: 'simon',   name: 'Simon',   familyKey: 'family.shirt' },
  { id: 'simone',  name: 'Simone',  familyKey: 'family.shirt' },
  { id: 'huey',    name: 'Huey',    familyKey: 'family.outerwear' },
  { id: 'carlton', name: 'Carlton', familyKey: 'family.outerwear' },
  { id: 'carlita', name: 'Carlita', familyKey: 'family.outerwear' },
  { id: 'sandy',   name: 'Sandy',   familyKey: 'family.skirt' },
  { id: 'titan',   name: 'Titan',   familyKey: 'family.pants' },
  { id: 'paco',    name: 'Paco',    familyKey: 'family.pants' },
  { id: 'waralee', name: 'Waralee', familyKey: 'family.pants' },
]

const DIFFICULTY_STARS: Record<number, string> = { 1: '★', 2: '★★', 3: '★★★', 4: '★★★★' }

// ─── Mood Fabrics garment type labels ────────────────────────────────────────
const GTYPE_LABEL_ZH: Record<string, string> = {
  dress:     '洋裝',
  top:       '上衣',
  bottom:    '下身',
  outerwear: '外套',
  suit:      '套裝',
  block:     '基礎版',
  lingerie:  '內衣',
}
const GTYPE_LABEL_EN: Record<string, string> = {
  dress:     'Dress',
  top:       'Top',
  bottom:    'Bottom',
  outerwear: 'Outerwear',
  suit:      'Suit',
  block:     'Block',
  lingerie:  'Lingerie',
}
const WEIGHT_LABEL_ZH: Record<string, string> = { light: '輕薄', medium: '中等', heavy: '厚重' }
const WEIGHT_LABEL_EN: Record<string, string> = { light: 'Light', medium: 'Medium', heavy: 'Heavy' }

// ─── Mood Detail Panel ────────────────────────────────────────────────────────
function MoodDetailPanel({ item, lang }: { item: CatalogItem; lang: 'zh' | 'en' }) {
  const { t } = useLanguage()
  const description = lang === 'zh'
    ? (item.description_zh ?? item.description_en)
    : (item.description_en ?? item.description_zh)
  const gtypeLabel = lang === 'zh'
    ? (item.garment_type ? GTYPE_LABEL_ZH[item.garment_type] ?? item.garment_type : '')
    : (item.garment_type ? GTYPE_LABEL_EN[item.garment_type] ?? item.garment_type : '')
  const weightLabel = lang === 'zh'
    ? (item.fabric_weight ? WEIGHT_LABEL_ZH[item.fabric_weight] ?? item.fabric_weight : '')
    : (item.fabric_weight ? WEIGHT_LABEL_EN[item.fabric_weight] ?? item.fabric_weight : '')

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-[var(--border)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[9px] tracking-widest uppercase px-1.5 py-0.5 text-[var(--gold)]"
                style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}
              >
                Mood Fabrics
              </span>
              <span
                className="text-[9px] tracking-widest uppercase px-1.5 py-0.5 text-[var(--muted)]"
                style={{ border: '1px solid var(--border)' }}
              >
                {t('pattern.mood.free')}
              </span>
            </div>
            <h2 className="font-display text-2xl text-[var(--ink)] mt-2">{item.name}</h2>
          </div>
          {item.difficulty && (
            <span className="text-xl text-[var(--gold)] flex-shrink-0 mt-2">
              {DIFFICULTY_STARS[item.difficulty] ?? ''}
            </span>
          )}
        </div>
      </div>

      {/* Meta chips */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex flex-wrap gap-2">
        {gtypeLabel && (
          <span
            className="text-[10px] tracking-wide px-2.5 py-1 uppercase"
            style={{ background: 'var(--gold-light)', color: 'var(--gold)', border: '1px solid var(--border)' }}
          >
            {gtypeLabel}
          </span>
        )}
        {weightLabel && (
          <span
            className="text-[10px] tracking-wide px-2.5 py-1 uppercase text-[var(--muted)]"
            style={{ border: '1px solid var(--border)' }}
          >
            {t('pattern.mood.fabric')}: {weightLabel}
          </span>
        )}
        {item.difficulty && (
          <span
            className="text-[10px] tracking-wide px-2.5 py-1 uppercase text-[var(--muted)]"
            style={{ border: '1px solid var(--border)' }}
          >
            {t('pattern.mood.difficulty')}: {DIFFICULTY_STARS[item.difficulty]}
          </span>
        )}
        {item.season && item.season.length > 0 && (
          <span
            className="text-[10px] tracking-wide px-2.5 py-1 uppercase text-[var(--muted)]"
            style={{ border: '1px solid var(--border)' }}
          >
            {item.season.join(' / ')}
          </span>
        )}
      </div>

      {/* Description */}
      {description && (
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">
            {lang === 'zh' ? '說明' : 'About'}
          </p>
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{description}</p>
        </div>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">
            {t('pattern.mood.tags')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map(tag => (
              <span
                key={tag}
                className="text-[10px] text-[var(--muted)] px-2 py-0.5"
                style={{ border: '1px solid var(--border)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* skill notes */}
      {item.skill_notes_zh && lang === 'zh' && (
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">技術重點</p>
          <p className="text-xs text-[var(--ink-soft)] leading-relaxed">{item.skill_notes_zh}</p>
        </div>
      )}

      {/* Download CTA */}
      <div className="px-6 py-5">
        {item.download_url ? (
          <a
            href={item.download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 text-xs tracking-widest uppercase font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--gold)', color: 'var(--ink)' }}
          >
            <ExternalLink size={12} strokeWidth={2} />
            {t('pattern.mood.download')}
          </a>
        ) : (
          <p className="text-xs text-[var(--muted)] text-center">Download URL not available</p>
        )}
        <p className="text-[10px] text-[var(--muted)] text-center mt-2 tracking-wide">
          {lang === 'zh' ? '由 Mood Fabrics 提供，免費下載' : 'Provided by Mood Fabrics, free to download'}
        </p>
      </div>
    </div>
  )
}

// ─── Mood Fabrics Tab Panel ───────────────────────────────────────────────────
function MoodTab() {
  const { t, lang } = useLanguage()
  const [catalog, setCatalog]       = useState<CatalogItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<CatalogItem | null>(null)
  const [activeType, setActiveType] = useState<string>('')

  useEffect(() => {
    patternApi.listCatalog({ source: 'mood_fabrics' })
      .then(items => { setCatalog(items); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const garmentTypes = ['', ...Array.from(new Set(catalog.map(c => c.garment_type ?? '').filter(Boolean)))]
  const filtered     = activeType ? catalog.filter(c => c.garment_type === activeType) : catalog

  const typeLabel = (id: string) =>
    id === ''
      ? (lang === 'zh' ? '全部' : 'All')
      : (lang === 'zh' ? (GTYPE_LABEL_ZH[id] ?? id) : (GTYPE_LABEL_EN[id] ?? id))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-[var(--muted)]">
        <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
        <span className="text-xs tracking-widest uppercase">{t('pattern.mood.loading')}</span>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-3 gap-8">

      {/* ── Left: Mood catalog list ── */}
      <div className="md:col-span-1">
        {/* Type filter pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {garmentTypes.map(id => (
            <button
              key={id}
              onClick={() => { setActiveType(id); setSelected(null) }}
              className="px-2.5 py-1 text-[10px] tracking-wide uppercase font-medium transition-colors"
              style={{
                background: activeType === id ? 'var(--ink)' : 'transparent',
                color:      activeType === id ? 'var(--surface)' : 'var(--muted)',
                border:     '1px solid ' + (activeType === id ? 'var(--ink)' : 'var(--border)'),
              }}
            >
              {typeLabel(id)}
            </button>
          ))}
        </div>

        {/* Pattern list */}
        <div className="border-t border-[var(--border)]">
          {filtered.map(item => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="w-full text-left px-4 py-3 border-b border-[var(--border)] transition-colors group"
              style={{
                background: selected?.id === item.id ? 'var(--gold-light)' : 'var(--surface)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: selected?.id === item.id ? 'var(--ink)' : 'var(--ink-soft)' }}
                  >
                    {item.name}
                  </p>
                  {item.garment_type && (
                    <p className="text-[10px] text-[var(--muted)] mt-0.5 uppercase tracking-wide">
                      {typeLabel(item.garment_type)}
                    </p>
                  )}
                </div>
                {item.difficulty && (
                  <span className="text-xs text-[var(--gold)] flex-shrink-0 mt-0.5">
                    {DIFFICULTY_STARS[item.difficulty] ?? ''}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <p className="text-[10px] text-[var(--muted)] mt-3 px-1">
          {catalog.length} {lang === 'zh' ? '件版型 · 全部免費' : 'patterns · all free'}
        </p>
      </div>

      {/* ── Right: detail or hint ── */}
      <div className="md:col-span-2">
        {selected ? (
          <MoodDetailPanel item={selected} lang={lang} />
        ) : (
          <div
            className="flex items-center justify-center h-96 border-2 border-dashed"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="text-xs tracking-widest uppercase text-[var(--muted)]">
              {t('pattern.mood.selectHint')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FreeSewing Tab Panel ─────────────────────────────────────────────────────
function FreeSewingTab() {
  const { t, lang } = useLanguage()
  const searchParams = useSearchParams()
  const redraftFrom  = searchParams.get('redraft')

  const [selected, setSelected]       = useState<string | null>(null)
  const [svg, setSvg]                 = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [sa, setSa]                   = useState(10)
  const [paperless, setPaperless]     = useState(false)
  const [savedId, setSavedId]         = useState<string | null>(null)
  const [history, setHistory]         = useState<VersionEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [redraftSource, setRedraftSource] = useState<string | null>(redraftFrom)

  useEffect(() => {
    if (!redraftFrom) return
    patternApi.getInstance(redraftFrom).then((inst: any) => {
      if (DESIGNS.find(x => x.id === inst.design)) setSelected(inst.design)
      setSa(inst.sa ?? 10)
      setPaperless(inst.paperless ?? false)
    }).catch(() => {})
  }, [redraftFrom])

  // Also handle autoSelectDesign from sessionStorage (set by search page)
  useEffect(() => {
    const auto = sessionStorage.getItem('autoSelectDesign')
    if (auto) {
      sessionStorage.removeItem('autoSelectDesign')
      handleDraft(auto)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDraft = async (designId: string) => {
    setSelected(designId)
    setLoading(true)
    setSvg(null)
    setError(null)
    setSavedId(null)

    try {
      let result: any

      if (redraftSource) {
        result = await patternApi.redraft({
          instanceId: redraftSource,
          userId:     DEV_USER_ID,
          sa,
          paperless,
          renderMode: 'svg',
        })
      } else {
        result = await patternApi.draft({
          userId:        DEV_USER_ID,
          design:        designId,
          bodyProfileId: DEV_PROFILE_ID,
          sa,
          paperless,
          renderMode:    'svg',
        })
      }

      setSvg(result.svg)
      setSavedId(result.instance_id)

      const h = await patternApi.getHistory(result.instance_id)
      setHistory(h.versions)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRedraftVersion = (entry: VersionEntry) => {
    setRedraftSource(entry.id)
    setShowHistory(false)
    setSvg(null)
    setSavedId(null)
  }

  const families = [...new Set(DESIGNS.map((d) => d.familyKey))]

  return (
    <div className="grid md:grid-cols-3 gap-8">

      {/* ── Left: design picker ── */}
      <div className="md:col-span-1">
        {/* Redraft banner */}
        {redraftSource && (
          <div
            className="mb-4 px-3 py-2 flex items-center justify-between"
            style={{ background: 'var(--gold-light)', border: '1px solid var(--border)' }}
          >
            <span className="text-xs text-[var(--gold)]">{t('pattern.redraftMode')}</span>
            <button
              onClick={() => { setRedraftSource(null); setSvg(null) }}
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
            >✕</button>
          </div>
        )}

        {/* Settings */}
        <div
          className="p-4 mb-4 space-y-3"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <div>
            <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)]">
              {t('pattern.seamAmount')}
            </label>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="range" min={0} max={20} step={2}
                value={sa}
                onChange={(e) => setSa(Number(e.target.value))}
                className="flex-1 accent-[var(--ink)]"
              />
              <span className="text-xs font-medium text-[var(--ink)] w-8 text-right">{sa}</span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--ink-soft)] cursor-pointer">
            <input
              type="checkbox"
              checked={paperless}
              onChange={(e) => setPaperless(e.target.checked)}
              className="accent-[var(--ink)]"
            />
            {t('pattern.paperlessMode')}
          </label>
        </div>

        {/* Design list */}
        {families.map((famKey) => (
          <div key={famKey} className="mb-4">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] mb-2 px-1">
              {t(famKey)}
            </p>
            <div className="border-t border-[var(--border)]">
              {DESIGNS.filter((d) => d.familyKey === famKey).map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleDraft(d.id)}
                  disabled={loading}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors border-b border-[var(--border)] disabled:opacity-40"
                  style={{
                    background: selected === d.id && !redraftSource ? 'var(--ink)' : 'var(--surface)',
                    color:      selected === d.id && !redraftSource ? 'var(--surface)' : 'var(--ink-soft)',
                  }}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Right: SVG viewer + history ── */}
      <div className="md:col-span-2 space-y-4">
        {loading && (
          <div
            className="flex items-center justify-center h-96"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="text-center flex flex-col items-center gap-3 text-[var(--muted)]">
              <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
              <p className="text-xs tracking-widest uppercase">
                {redraftSource ? t('pattern.redrafting') : t('pattern.loading')}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 text-red-700 text-sm" style={{ border: '1px solid #fca5a5', background: '#fef2f2' }}>
            {error}
          </div>
        )}

        {svg && !loading && (
          <>
            {/* Saved banner */}
            {savedId && (
              <div
                className="flex items-center justify-between px-4 py-2.5 text-sm"
                style={{ background: 'var(--gold-light)', border: '1px solid var(--border)' }}
              >
                <span className="text-[var(--ink-soft)] text-xs">
                  {t('pattern.savedWardrobe')}
                  {history.length > 1 && (
                    <span className="ml-1 text-[var(--muted)]">
                      （v{history[history.length - 1]?.version}，
                      {lang === 'zh' ? `共 ${history.length} 個版本` : `${history.length} versions`}）
                    </span>
                  )}
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowHistory(h => !h)}
                    className="text-[10px] tracking-widest uppercase text-[var(--gold)] hover:opacity-70"
                  >
                    {showHistory ? t('pattern.hideHistory') : t('pattern.versionHistory')}
                  </button>
                  <a
                    href="/wardrobe"
                    className="text-[10px] tracking-widest uppercase text-[var(--gold)] hover:opacity-70"
                  >
                    {t('pattern.wardrobe')}
                  </a>
                </div>
              </div>
            )}

            {/* Version history panel */}
            {showHistory && history.length > 0 && (
              <div style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)]">
                    {t('pattern.versionHistory')} · {selected}
                  </p>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {[...history].reverse().map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 text-[var(--muted)]"
                            style={{ border: '1px solid var(--border)' }}
                          >
                            v{entry.version}
                          </span>
                          <span className="text-sm text-[var(--ink-soft)]">{entry.title ?? selected}</span>
                          {entry.id === savedId && (
                            <span
                              className="text-[10px] tracking-wide px-1.5 py-0.5 text-[var(--gold)]"
                              style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}
                            >
                              {t('pattern.latest')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--muted)] mt-0.5">
                          {new Date(entry.created_at).toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US')} · {t('pattern.seamShort')} {entry.sa}mm
                          {entry.paperless && ' · paperless'}
                        </div>
                        {entry.notes && (
                          <p className="text-xs text-[var(--muted)] italic mt-0.5">{entry.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {entry.id !== savedId && (
                          <button
                            onClick={() => handleRedraftVersion(entry)}
                            className="text-[10px] tracking-widest uppercase px-2.5 py-1 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                            style={{ border: '1px solid var(--border)' }}
                          >
                            Redraft
                          </button>
                        )}
                        <button
                          onClick={() => {
                            patternApi.getInstance(entry.id).then((inst: any) => {
                              if (inst.svg_data) setSvg(inst.svg_data)
                            })
                          }}
                          className="text-[10px] tracking-widest uppercase px-2.5 py-1 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                          style={{ border: '1px solid var(--border)' }}
                        >
                          {t('pattern.previewBtn')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <PatternViewer svg={svg} designName={selected ?? ''} instanceId={savedId ?? undefined} />
          </>
        )}

        {!svg && !loading && !error && (
          <div
            className="flex items-center justify-center h-96 border-2 border-dashed"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="text-xs tracking-widest uppercase text-[var(--muted)]">{t('pattern.selectHint')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page shell ───────────────────────────────────────────────────────────────
function PatternPageInner() {
  const { t, lang } = useLanguage()
  const [tab, setTab] = useState<TabKey>('fs')

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-1">
            {lang === 'zh' ? '版型選擇' : 'Patterns'}
          </p>
          <h1 className="font-display text-2xl text-[var(--ink)]">{t('pattern.lib')}</h1>
        </div>
        <a
          href="/wardrobe"
          className="text-[10px] tracking-widest uppercase text-[var(--gold)] hover:opacity-70 transition-opacity mb-0.5"
        >
          {t('pattern.wardrobe')}
        </a>
      </div>

      {/* Tab switcher */}
      <div className="flex mb-6 border-b border-[var(--border)]">
        {(['fs', 'mood'] as TabKey[]).map(key => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-5 py-2.5 text-xs tracking-widest uppercase font-medium transition-colors relative"
            style={{
              color: tab === key ? 'var(--ink)' : 'var(--muted)',
              borderBottom: tab === key ? '2px solid var(--ink)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {key === 'fs' ? t('pattern.tab.fs') : (
              <span className="flex items-center gap-1.5">
                {t('pattern.tab.mood')}
                <span
                  className="text-[9px] px-1 py-0.5 text-[var(--gold)]"
                  style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}
                >
                  20
                </span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sub-header for Mood tab */}
      {tab === 'mood' && (
        <p className="text-xs text-[var(--muted)] mb-5 -mt-3">
          {t('pattern.mood.subtitle')}
        </p>
      )}

      {/* Tab content */}
      {tab === 'fs' ? <FreeSewingTab /> : <MoodTab />}
    </div>
  )
}

export default function PatternPage() {
  const { t } = useLanguage()
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24 gap-3 text-[var(--muted)]">
        <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
        <span className="text-xs tracking-widest uppercase">{t('pattern.loading')}</span>
      </div>
    }>
      <PatternPageInner />
    </Suspense>
  )
}
