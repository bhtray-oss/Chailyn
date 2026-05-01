'use client'

import { useState, useEffect } from 'react'
import { profileApi } from '@/lib/api'
import MeasurementForm from '@/components/MeasurementForm'
import type { Measurements } from '@/lib/types'
import { useLanguage } from '@/contexts/LanguageContext'

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

interface Profile {
  id: string
  label: string
  version: number
  measurements: Record<string, number>
  derived_measurements: Record<string, number>
  notes: string | null
  created_at: string
}

const mm2cm = (v: number) => (v / 10).toFixed(1)

export default function ProfilePage() {
  const { t, lang } = useLanguage()

  const LABELS = [
    t('profile.label.daily'),
    t('profile.label.pregnancy'),
    t('profile.label.postWorkout'),
    t('profile.label.child'),
  ]

  const DERIVED_LABELS: Record<string, Parameters<typeof t>[0]> = {
    halfChest:    'derived.halfChest',
    quarterChest: 'derived.quarterChest',
    halfWaist:    'derived.halfWaist',
    halfHips:     'derived.halfHips',
    bustSpan:     'derived.bustSpan',
  }

  const [label, setLabel]               = useState(t('profile.label.daily'))
  const [measurements, setMeasurements] = useState<Measurements>({})
  const [notes, setNotes]               = useState('')
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [profiles, setProfiles]         = useState<Profile[]>([])
  const [derived, setDerived]           = useState<Record<string, number>>({})

  useEffect(() => {
    const chest    = measurements.chest
    const waist    = measurements.waist
    const hips     = measurements.hips
    const highBust = measurements.highBust
    const d: Record<string, number> = {}
    if (chest)              { d.halfChest = chest / 2; d.quarterChest = chest / 4 }
    if (waist)              { d.halfWaist = waist / 2 }
    if (hips)               { d.halfHips = hips / 2 }
    if (chest && highBust)  { d.bustSpan = chest - highBust }
    setDerived(d)
  }, [measurements])

  useEffect(() => {
    profileApi.list(DEV_USER_ID)
      .then((data: unknown) => setProfiles(data as Profile[]))
      .catch(() => {})
  }, [saved])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await profileApi.create(DEV_USER_ID, label, measurements as Record<string, number>, notes || undefined)
        .catch((e: any) => { throw new Error(t('profile.saveFailed') + ': ' + e.message) })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-2">
          {lang === 'zh' ? '身材數據' : 'Measurements'}
        </p>
        <h1 className="font-display text-3xl text-[var(--ink)]">{t('profile.title')}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">{t('profile.subtitle')}</p>
      </div>

      {/* Label selector */}
      <div className="mb-6">
        <label className="block text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] mb-3">
          {t('profile.labelTitle')}
        </label>
        <div className="flex gap-2 flex-wrap">
          {LABELS.map((l) => (
            <button
              key={l}
              onClick={() => setLabel(l)}
              className="px-4 py-1.5 text-xs tracking-wide uppercase font-medium transition-colors"
              style={{
                background: label === l ? 'var(--ink)' : 'transparent',
                color:      label === l ? 'var(--surface)' : 'var(--muted)',
                border:     '1px solid ' + (label === l ? 'var(--ink)' : 'var(--border)'),
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Measurement form */}
      <MeasurementForm values={measurements} onChange={setMeasurements} />

      {/* Derived measurements */}
      {Object.keys(derived).length > 0 && (
        <div className="mt-6 p-4" style={{ background: 'var(--gold-light)', border: '1px solid var(--border)' }}>
          <h3 className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">
            {t('profile.derived.title')}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(derived).map(([key, val]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-[var(--muted)]">{DERIVED_LABELS[key] ? t(DERIVED_LABELS[key]) : key}</span>
                <span className="text-[var(--ink)] font-medium">{val.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mt-6">
        <label className="block text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] mb-3">
          {t('profile.notes')}
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t('profile.notesPlaceholder')}
          rows={2}
          className="w-full px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] resize-none focus:outline-none focus:border-[var(--gold)] transition-colors"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
        />
      </div>

      {/* Save */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 text-xs tracking-widest uppercase font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: 'var(--ink)', color: 'var(--surface)' }}
        >
          {saving ? t('profile.saving') : t('profile.save')}
        </button>
        {saved  && <span className="text-xs tracking-wide text-[var(--gold)]">{t('profile.saved')}</span>}
        {error  && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <p className="mt-4 text-xs text-[var(--muted)]">{t('profile.hint')}</p>

      {/* Saved profiles list */}
      {profiles.length > 0 && (
        <div className="mt-10">
          <div className="h-px bg-[var(--border)] mb-6" />
          <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--muted)] mb-4">{t('profile.savedList')}</p>
          <div className="border-t border-[var(--border)]">
            {profiles.map((p) => (
              <div key={p.id} className="border-b border-[var(--border)] py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[var(--ink)]">{p.label}</span>
                    <span
                      className="text-[10px] tracking-wide px-2 py-0.5 text-[var(--muted)]"
                      style={{ border: '1px solid var(--border)' }}
                    >
                      v{p.version}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(p.created_at).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                  {Object.entries(p.measurements).slice(0, 6).map(([k, v]) => (
                    <span key={k}>{k}: {mm2cm(v)}cm</span>
                  ))}
                </div>
                {p.notes && (
                  <p className="mt-2 text-xs text-[var(--muted)] italic">{p.notes}</p>
                )}
                {p.derived_measurements && Object.keys(p.derived_measurements).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[var(--border)] grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-[var(--gold)]">
                    {Object.entries(p.derived_measurements).map(([k, v]) => (
                      <span key={k}>{DERIVED_LABELS[k] ? t(DERIVED_LABELS[k]) : k}: {mm2cm(v)}cm</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
