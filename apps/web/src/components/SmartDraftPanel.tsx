'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { analysisApi, patternApi } from '@/lib/api'
import type { DraftParamsResponse, OptionEntry } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'

const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

type PanelState = 'idle' | 'loading' | 'ready' | 'drafting' | 'error'

interface Props {
  analysisId: string
  profileId?: string
}

export default function SmartDraftPanel({ analysisId, profileId = DEV_PROFILE_ID }: Props) {
  const { t } = useLanguage()
  const router = useRouter()
  const fetchGenRef = useRef(0)

  const [open, setOpen]             = useState(false)
  const [state, setState]           = useState<PanelState>('idle')
  const [params, setParams]         = useState<DraftParamsResponse | null>(null)
  const [editedOpts, setEditedOpts] = useState<Record<string, string | number | boolean>>({})
  const [activeDesign, setActiveDesign] = useState<string>('')
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)

  const fetchParams = useCallback(async (design?: string) => {
    fetchGenRef.current += 1
    const gen = fetchGenRef.current
    setState('loading')
    setErrorMsg(null)
    try {
      const data = await analysisApi.getDraftParams(analysisId, profileId, design)
      if (gen !== fetchGenRef.current) return  // stale response — discard
      setParams(data)
      setActiveDesign(data.design)
      const initial: Record<string, string | number | boolean> = {}
      for (const [k, entry] of Object.entries(data.options)) {
        initial[k] = entry.value
      }
      setEditedOpts(initial)
      setState('ready')
    } catch (e: unknown) {
      if (gen !== fetchGenRef.current) return  // stale error — discard
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(msg)
      setState('error')
    }
  }, [analysisId, profileId])

  const handleToggle = () => {
    if (!open && state === 'idle') fetchParams()
    setOpen(o => !o)
  }

  const handleDesignSwitch = (design: string) => {
    if (design === activeDesign) return
    fetchParams(design)
  }

  const handleOptionChange = (key: string, value: string | number | boolean) => {
    setEditedOpts(prev => ({ ...prev, [key]: value }))
  }

  const handleReset = () => {
    if (!params) return
    const initial: Record<string, string | number | boolean> = {}
    for (const [k, entry] of Object.entries(params.options)) initial[k] = entry.value
    setEditedOpts(initial)
  }

  const handleDraft = async () => {
    if (!params) return
    setState('drafting')
    setErrorMsg(null)
    try {
      const { sa, paperless, ...restOpts } = editedOpts
      const result = await patternApi.draft({
        userId:          DEV_USER_ID,
        design:          activeDesign,
        bodyProfileId:   profileId,
        sa:              typeof sa === 'number' ? sa : 10,
        paperless:       paperless === true,
        options:         restOpts as Record<string, unknown>,
        aiConfidence:    params.confidence,          // marks created_by_ai = true
      }) as { instance_id?: string; id?: string }

      const instanceId = result.instance_id ?? result.id
      if (!instanceId) throw new Error('No instance_id in draft response')
      router.push(`/pattern?redraft=${instanceId}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(msg)
      setState('ready')
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  const allDesigns = params
    ? [{ design: params.design, confidence: params.confidence }, ...params.alternatives]
    : []

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>

      {/* Toggle bar */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ background: open ? 'var(--gold-light)' : 'var(--surface)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--gold)' }}>✦</span>
          <div className="text-left">
            <p className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--ink-soft)' }}>
              {t('smartDraft.title')}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
              {t('smartDraft.subtitle')}
            </p>
          </div>
        </div>
        <span
          className="text-[10px] tracking-widest uppercase px-3 py-1.5 font-medium"
          style={{
            border:     '1px solid var(--border)',
            background: open ? 'var(--ink)' : 'transparent',
            color:      open ? 'var(--surface)' : 'var(--ink-soft)',
          }}
        >
          {open ? `${t('smartDraft.collapse')} ▲` : `${t('smartDraft.expand')} ▼`}
        </span>
      </button>

      {/* Panel body */}
      {open && (
        <div className="px-5 py-5" style={{ borderTop: '1px solid var(--border)' }}>

          {state === 'loading' && (
            <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--muted)' }}>
              <span className="animate-spin text-base" style={{ color: 'var(--gold)' }}>◌</span>
              <span className="text-xs tracking-widest uppercase">{t('smartDraft.loading')}</span>
            </div>
          )}

          {state === 'error' && (
            <p className="text-sm py-4 text-red-600">{errorMsg ?? t('smartDraft.error')}</p>
          )}

          {(state === 'ready' || state === 'drafting') && params && (
            <>
              {/* No-measurements warning */}
              {params.warning === 'no_measurements' && (
                <div
                  className="mb-4 px-3 py-2 text-xs"
                  style={{ border: '1px solid var(--border)', background: 'var(--gold-light)', color: 'var(--gold)' }}
                >
                  {t('smartDraft.noMeasure')}
                </div>
              )}

              {/* Design selector */}
              <div className="mb-5">
                <p className="text-[10px] tracking-[0.2em] uppercase mb-3" style={{ color: 'var(--muted)' }}>
                  {t('smartDraft.design')}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {allDesigns.map(({ design, confidence }) => (
                    <button
                      key={design}
                      onClick={() => handleDesignSwitch(design)}
                      disabled={state === 'drafting'}
                      className="px-4 py-1.5 text-xs tracking-wide capitalize font-medium disabled:opacity-50"
                      style={{
                        background: activeDesign === design ? 'var(--ink)' : 'transparent',
                        color:      activeDesign === design ? 'var(--surface)' : 'var(--muted)',
                        border:     `1px solid ${activeDesign === design ? 'var(--ink)' : 'var(--border)'}`,
                      }}
                    >
                      {design}
                      <span className="ml-2 text-[10px] opacity-60">
                        {Math.round(confidence * 100)}%
                      </span>
                    </button>
                  ))}
                </div>
                {params.reasoning.length > 0 && (
                  <p className="text-[10px] italic mt-2" style={{ color: 'var(--muted)' }}>
                    {params.reasoning.slice(0, 2).join(' · ')}
                  </p>
                )}
              </div>

              {/* Options table */}
              <div className="mb-5">
                <p className="text-[10px] tracking-[0.2em] uppercase mb-3" style={{ color: 'var(--muted)' }}>
                  {t('smartDraft.options')}
                  <span className="ml-2" style={{ color: 'var(--gold)' }}>{t('smartDraft.aiBadge')} = AI 偵測</span>
                </p>
                <div style={{ border: '1px solid var(--border)' }}>
                  {Object.entries(params.options).map(([key, entry]: [string, OptionEntry], idx, arr) => (
                    <div
                      key={key}
                      className="flex items-center justify-between px-3 py-2.5 text-xs"
                      style={{ borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <span style={{ color: 'var(--muted)' }}>{key}</span>
                      <div className="flex items-center gap-2">
                        {typeof entry.value === 'boolean' ? (
                          <select
                            value={editedOpts[key] === true ? 'true' : 'false'}
                            onChange={e => handleOptionChange(key, e.target.value === 'true')}
                            disabled={state === 'drafting'}
                            className="text-xs px-2 py-1 disabled:opacity-50"
                            style={{
                              border: `1px solid ${entry.source === 'ai' ? 'var(--gold)' : 'var(--border)'}`,
                              background: 'var(--surface)', color: 'var(--ink)',
                            }}
                          >
                            <option value="true">{t('smartDraft.on')}</option>
                            <option value="false">{t('smartDraft.off')}</option>
                          </select>
                        ) : entry.choices.length > 0 ? (
                          <select
                            value={String(editedOpts[key] ?? entry.value)}
                            onChange={e => handleOptionChange(key, e.target.value)}
                            disabled={state === 'drafting'}
                            className="text-xs px-2 py-1 disabled:opacity-50"
                            style={{
                              border: `1px solid ${entry.source === 'ai' ? 'var(--gold)' : 'var(--border)'}`,
                              background: 'var(--surface)', color: 'var(--ink)',
                            }}
                          >
                            {entry.choices.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : (
                          <input
                            type="number"
                            value={Number(editedOpts[key] ?? entry.value)}
                            onChange={e => handleOptionChange(key, Number(e.target.value))}
                            disabled={state === 'drafting'}
                            className="w-16 text-xs px-2 py-1 text-right disabled:opacity-50"
                            style={{
                              border: `1px solid ${entry.source === 'ai' ? 'var(--gold)' : 'var(--border)'}`,
                              background: 'var(--surface)', color: 'var(--ink)',
                            }}
                          />
                        )}
                        <span
                          className="text-[10px] tracking-wide"
                          style={{ color: entry.source === 'ai' ? 'var(--gold)' : 'var(--muted)' }}
                        >
                          {entry.source === 'ai' ? t('smartDraft.aiBadge') : t('smartDraft.defaultBadge')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Armstrong collapsible */}
              <details className="mb-5" style={{ border: '1px solid var(--border)' }}>
                <summary
                  className="px-3 py-2.5 text-[10px] tracking-[0.2em] uppercase cursor-pointer list-none flex justify-between"
                  style={{ color: 'var(--gold)', background: 'var(--gold-light)' }}
                >
                  <span>{t('smartDraft.armstrong')}</span>
                  <span>▾</span>
                </summary>
                <div className="px-3 py-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  {([
                    [t('smartDraft.armHipWaist'), `${params.armstrong.hip_waist_diff_in ?? '—'}"`],
                    [t('smartDraft.armFrontDart'), `×${params.armstrong.front_dart_count ?? '—'} · ${params.armstrong.front_dart_intake_in ?? '—'}" ${t('smartDraft.armEach')}`],
                    [t('smartDraft.armBackDart'),  `×${params.armstrong.back_dart_count ?? '—'} · ${params.armstrong.back_dart_intake_in ?? '—'}" ${t('smartDraft.armEach')}`],
                    [t('smartDraft.armCup'),       `${params.armstrong.bust_cup ?? '—'} cup`],
                    [t('smartDraft.armSleeve'),    `${params.armstrong.sleeve_length_in ?? '—'}"`],
                    [t('smartDraft.armSize'),      `Size ${params.armstrong.approx_us_size ?? '—'}`],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} className="flex justify-between py-1" style={{ borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--muted)' }}>{label}</span>
                      <span style={{ color: 'var(--ink)' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </details>

              {/* Action row */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDraft}
                  disabled={state === 'drafting'}
                  className="flex-1 py-3 text-[10px] tracking-widest uppercase font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'var(--ink)', color: 'var(--surface)' }}
                >
                  {state === 'drafting' ? `◌ ${t('smartDraft.drafting')}` : `✦  ${t('smartDraft.draft')}`}
                </button>
                <button
                  onClick={handleReset}
                  disabled={state === 'drafting'}
                  className="px-4 py-3 text-[10px] tracking-widest uppercase font-medium disabled:opacity-50"
                  style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
                >
                  {t('smartDraft.reset')}
                </button>
              </div>

              {errorMsg && state === 'ready' && (
                <p className="mt-3 text-xs text-red-600">{errorMsg}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
