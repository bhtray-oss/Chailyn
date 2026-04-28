'use client'

import type { Measurements } from '@/lib/types'
import { useLanguage } from '@/contexts/LanguageContext'

interface Props {
  values: Measurements
  onChange: (m: Measurements) => void
}

export default function MeasurementForm({ values, onChange }: Props) {
  const { t } = useLanguage()

  const FIELDS: Array<{ key: keyof Measurements; labelKey: Parameters<typeof t>[0]; hintKey?: Parameters<typeof t>[0] }> = [
    { key: 'neck',           labelKey: 'mf.neck',           hintKey: 'mf.neck.hint' },
    { key: 'chest',          labelKey: 'mf.chest' },
    { key: 'highBust',       labelKey: 'mf.highBust' },
    { key: 'waist',          labelKey: 'mf.waist' },
    { key: 'hips',           labelKey: 'mf.hips' },
    { key: 'seat',           labelKey: 'mf.seat' },
    { key: 'shoulderWidth',  labelKey: 'mf.shoulderWidth' },
    { key: 'hpsToWaistBack', labelKey: 'mf.hpsToWaistBack' },
    { key: 'shoulderToWrist',labelKey: 'mf.shoulderToWrist' },
    { key: 'biceps',         labelKey: 'mf.biceps' },
    { key: 'wrist',          labelKey: 'mf.wrist' },
    { key: 'inseam',         labelKey: 'mf.inseam' },
  ]

  const handleChange = (key: keyof Measurements, raw: string) => {
    const num = parseFloat(raw)
    onChange({ ...values, [key]: isNaN(num) ? undefined : num })
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map(({ key, labelKey, hintKey }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              {t(labelKey)}
              {key === 'neck' && (
                <span className="ml-1 text-amber-600 text-xs">*</span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={0.5}
                placeholder="—"
                value={values[key] ?? ''}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
              <span className="text-stone-400 text-sm shrink-0">cm</span>
            </div>
            {hintKey && (
              <p className="text-xs text-stone-400 mt-1">{t(hintKey)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
