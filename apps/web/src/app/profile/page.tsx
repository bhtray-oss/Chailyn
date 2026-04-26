'use client'

import { useState, useEffect } from 'react'
import { profileApi } from '@/lib/api'
import MeasurementForm from '@/components/MeasurementForm'
import type { Measurements } from '@/lib/types'

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

const LABELS = ['日常', '孕期', '重訓後', '孩童']

interface Profile {
  id: string
  label: string
  version: number
  measurements: Record<string, number>
  derived_measurements: Record<string, number>
  notes: string | null
  created_at: string
}

// mm → cm 顯示
const mm2cm = (v: number) => (v / 10).toFixed(1)

const DERIVED_LABELS: Record<string, string> = {
  halfChest:    '胸圍½',
  quarterChest: '胸圍¼',
  halfWaist:    '腰圍½',
  halfHips:     '臀圍½',
  bustSpan:     '胸差',
}

export default function ProfilePage() {
  const [label, setLabel]           = useState('日常')
  const [measurements, setMeasurements] = useState<Measurements>({})
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [profiles, setProfiles]     = useState<Profile[]>([])
  const [derived, setDerived]       = useState<Record<string, number>>({})

  // 計算衍生尺寸（前端即時預覽，後端也會計算）
  useEffect(() => {
    const chest    = measurements.chest
    const waist    = measurements.waist
    const hips     = measurements.hips
    const highBust = measurements.highBust
    const d: Record<string, number> = {}
    if (chest)    { d.halfChest    = chest / 2;    d.quarterChest = chest / 4 }
    if (waist)    { d.halfWaist    = waist / 2 }
    if (hips)     { d.halfHips     = hips / 2 }
    if (chest && highBust) { d.bustSpan = chest - highBust }
    setDerived(d)
  }, [measurements])

  // 載入已存的身材檔案
  useEffect(() => {
    profileApi.list(DEV_USER_ID)
      .then((data: unknown) => setProfiles(data as Profile[]))
      .catch(() => {})
  }, [saved])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      // measurements 從 cm 轉 number map，notes 另外送
      const body = {
        user_id:      DEV_USER_ID,
        label,
        measurements: measurements as Record<string, number>,
        notes:        notes || undefined,
      }
      // 直接呼叫 create（後端已可接收 notes）
      await fetch('http://localhost:8000/profiles/', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          user_id:      DEV_USER_ID,
          label,
          measurements: measurements,
          notes:        notes || null,
        }),
      }).then(r => { if (!r.ok) throw new Error('儲存失敗'); return r.json() })

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
      <h1 className="text-2xl font-bold text-stone-900 mb-2">身材檔案</h1>
      <p className="text-stone-500 mb-8">輸入測量值（公分），版型引擎自動換算為 mm</p>

      {/* Label selector */}
      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
          檔案標籤
        </label>
        <div className="flex gap-2 flex-wrap">
          {LABELS.map((l) => (
            <button
              key={l}
              onClick={() => setLabel(l)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                label === l
                  ? 'bg-stone-900 text-white'
                  : 'bg-white border border-stone-300 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Measurement form */}
      <MeasurementForm
        values={measurements}
        onChange={setMeasurements}
      />

      {/* 衍生尺寸預覽 */}
      {Object.keys(derived).length > 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-3">
            自動計算衍生尺寸（cm）
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(derived).map(([key, val]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-stone-500">{DERIVED_LABELS[key] ?? key}</span>
                <span className="text-stone-800 font-medium">{val.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 備註 */}
      <div className="mt-6">
        <label className="block text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
          備註（選填）
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="例：孕 28 週時量測、訓練旺季體重…"
          rows={2}
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        />
      </div>

      {/* Save */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-stone-900 text-white rounded-lg font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '儲存中…' : '儲存身材檔案'}
        </button>
        {saved && <span className="text-green-600 text-sm">✓ 已儲存</span>}
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>

      <p className="mt-4 text-xs text-stone-400">
        💡 未填寫的欄位將由系統依頸圍推估（neckstimate），版型仍可正常生成。每次更新都會保留版本歷史。
      </p>

      {/* 已存的身材檔案清單 */}
      {profiles.length > 0 && (
        <div className="mt-10">
          <h2 className="text-base font-semibold text-stone-700 mb-4">已儲存的身材檔案</h2>
          <div className="space-y-3">
            {profiles.map((p) => (
              <div key={p.id} className="bg-white border border-stone-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-800">{p.label}</span>
                    <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                      v{p.version}
                    </span>
                  </div>
                  <span className="text-xs text-stone-400">
                    {new Date(p.created_at).toLocaleDateString('zh-TW')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-stone-500">
                  {Object.entries(p.measurements).slice(0, 6).map(([k, v]) => (
                    <span key={k}>{k}: {mm2cm(v)}cm</span>
                  ))}
                </div>
                {p.notes && (
                  <p className="mt-2 text-xs text-stone-400 italic">{p.notes}</p>
                )}
                {p.derived_measurements && Object.keys(p.derived_measurements).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-stone-100 grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-amber-600">
                    {Object.entries(p.derived_measurements).map(([k, v]) => (
                      <span key={k}>{DERIVED_LABELS[k] ?? k}: {mm2cm(v)}cm</span>
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
