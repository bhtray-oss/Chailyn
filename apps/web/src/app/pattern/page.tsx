'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { patternApi } from '@/lib/api'
import PatternViewer from '@/components/PatternViewer'
import type { VersionEntry } from '@/lib/api'
import { Suspense } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

type FamilyKey = 'family.top' | 'family.shirt' | 'family.outerwear' | 'family.skirt' | 'family.pants'

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

function PatternPageInner() {
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
      const d = DESIGNS.find(x => x.id === inst.design)
      if (d) setSelected(inst.design)
      setSa(inst.sa ?? 10)
      setPaperless(inst.paperless ?? false)
    }).catch(() => {})
  }, [redraftFrom])

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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-stone-900">{t('pattern.lib')}</h1>
          <a href="/wardrobe" className="text-xs text-amber-600 hover:text-amber-700 font-medium">
            {t('pattern.wardrobe')}
          </a>
        </div>

        {/* Redraft banner */}
        {redraftSource && (
          <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
            <span className="text-xs text-amber-700">{t('pattern.redraftMode')}</span>
            <button
              onClick={() => { setRedraftSource(null); setSvg(null) }}
              className="text-xs text-amber-500 hover:text-amber-700"
            >✕</button>
          </div>
        )}

        {/* Settings */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs text-stone-500 font-medium uppercase tracking-widest">
              {t('pattern.seamAmount')}
            </label>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="range" min={0} max={20} step={2}
                value={sa}
                onChange={(e) => setSa(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-medium text-stone-700 w-8 text-right">{sa}</span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={paperless}
              onChange={(e) => setPaperless(e.target.checked)}
              className="rounded"
            />
            {t('pattern.paperlessMode')}
          </label>
        </div>

        {/* Design list */}
        {families.map((famKey) => (
          <div key={famKey} className="mb-4">
            <div className="text-xs text-stone-400 uppercase tracking-widest font-semibold mb-2 px-1">
              {t(famKey)}
            </div>
            <div className="space-y-1">
              {DESIGNS.filter((d) => d.familyKey === famKey).map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleDraft(d.id)}
                  disabled={loading}
                  className={`
                    w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${selected === d.id && !redraftSource
                      ? 'bg-stone-900 text-white'
                      : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-40'}
                  `}
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
          <div className="flex items-center justify-center h-96 bg-white rounded-xl border border-stone-200">
            <div className="text-center text-stone-400">
              <div className="text-4xl animate-spin mb-3">⟳</div>
              <p>{redraftSource ? t('pattern.redrafting') : t('pattern.loading')}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {svg && !loading && (
          <>
            {/* Saved banner */}
            {savedId && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm">
                <span className="text-green-700">
                  {t('pattern.savedWardrobe')}
                  {history.length > 1 && (
                    <span className="ml-1 text-green-500">
                      （v{history[history.length - 1]?.version}，
                      {lang === 'zh' ? `共 ${history.length} 個版本` : `${history.length} versions`}）
                    </span>
                  )}
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowHistory(h => !h)}
                    className="text-xs text-green-600 hover:text-green-800 font-medium"
                  >
                    {showHistory ? t('pattern.hideHistory') : t('pattern.versionHistory')}
                  </button>
                  <a href="/wardrobe" className="text-xs text-green-600 hover:text-green-800 font-medium">
                    {t('pattern.wardrobe')}
                  </a>
                </div>
              </div>
            )}

            {/* Version history panel */}
            {showHistory && history.length > 0 && (
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100">
                  <h3 className="text-sm font-semibold text-stone-700">{t('pattern.versionHistory')} · {selected}</h3>
                </div>
                <div className="divide-y divide-stone-100">
                  {[...history].reverse().map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-mono">
                            v{entry.version}
                          </span>
                          <span className="text-sm text-stone-700">{entry.title ?? selected}</span>
                          {entry.id === savedId && (
                            <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded">
                              {t('pattern.latest')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-stone-400 mt-0.5">
                          {new Date(entry.created_at).toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US')} · {t('pattern.seamShort')} {entry.sa}mm
                          {entry.paperless && ' · paperless'}
                        </div>
                        {entry.notes && (
                          <p className="text-xs text-stone-400 italic mt-0.5">{entry.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {entry.id !== savedId && (
                          <button
                            onClick={() => handleRedraftVersion(entry)}
                            className="text-xs px-2.5 py-1 border border-stone-200 rounded hover:bg-stone-50 text-stone-600"
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
                          className="text-xs px-2.5 py-1 border border-stone-200 rounded hover:bg-stone-50 text-stone-600"
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
          <div className="flex items-center justify-center h-96 bg-white rounded-xl border-2 border-dashed border-stone-200">
            <p className="text-stone-400">{t('pattern.selectHint')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PatternPage() {
  const { t } = useLanguage()
  return (
    <Suspense fallback={<div className="text-stone-400 p-8">{t('pattern.loading')}</div>}>
      <PatternPageInner />
    </Suspense>
  )
}
