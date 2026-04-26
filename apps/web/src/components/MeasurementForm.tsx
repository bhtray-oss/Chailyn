'use client'

/**
 * MeasurementForm.tsx — 身材測量輸入表單
 *
 * 所有值以公分輸入，父元件透過 onChange 取得更新後的 measurements。
 * API 層（profileApi.create）負責轉成 mm。
 */

import type { Measurements } from '@/lib/types'

const FIELDS: Array<{ key: keyof Measurements; label: string; hint?: string }> = [
  { key: 'neck',           label: '頸圍',         hint: '必填，其他欄位可由此推算' },
  { key: 'chest',          label: '胸圍' },
  { key: 'highBust',       label: '上胸圍（高胸）' },
  { key: 'waist',          label: '腰圍' },
  { key: 'hips',           label: '臀圍' },
  { key: 'seat',           label: '坐圍' },
  { key: 'shoulderWidth',  label: '肩寬' },
  { key: 'hpsToWaistBack', label: '後頸點至腰長' },
  { key: 'shoulderToWrist',label: '肩點至手腕' },
  { key: 'biceps',         label: '上臂圍' },
  { key: 'wrist',          label: '手腕圍' },
  { key: 'inseam',         label: '內股長' },
]

interface Props {
  values: Measurements
  onChange: (m: Measurements) => void
}

export default function MeasurementForm({ values, onChange }: Props) {
  const handleChange = (key: keyof Measurements, raw: string) => {
    const num = parseFloat(raw)
    onChange({
      ...values,
      [key]: isNaN(num) ? undefined : num,
    })
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map(({ key, label, hint }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              {label}
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
            {hint && (
              <p className="text-xs text-stone-400 mt-1">{hint}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
