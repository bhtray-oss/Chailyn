'use client'

/**
 * MeasurementChart.tsx
 * Armstrong 5th Ed. Ch.2 measurement reference table
 * Converts FreeSewing mm measurements → cm + inches + Armstrong draft values
 */

import { useLanguage } from '@/contexts/LanguageContext'

interface Props {
  measurements: Record<string, number>  // in mm (FreeSewing standard)
}

const MM_TO_IN = 1 / 25.4
const MM_TO_CM = 0.1

// ── Armstrong measurement rows ───────────────────────────────────────────────
interface Row {
  zh: string; en: string; key: string
  armNumZh: string; armNumEn: string
  draftFn?: (m: Record<string, number>) => string
  noteZh?: string; noteEn?: string
}

const ROWS: Row[] = [
  {
    zh: '全胸圍', en: 'Full Bust', key: 'chest',
    armNumZh: 'm17 × 2', armNumEn: 'm17 × 2',
    noteZh: '半胸弧 m17 = 胸圍 ÷ 2', noteEn: 'Half bust arc (m17) = bust ÷ 2',
    draftFn: m => `m17 = ${(m.chest * MM_TO_IN / 2).toFixed(2)}"`,
  },
  {
    zh: '高胸圍', en: 'High Bust', key: 'highBust',
    armNumZh: '參考', armNumEn: 'ref',
    noteZh: '胸上圍合身核查 / neckstimate 基準', noteEn: 'High bust fit check / neckstimate base',
  },
  {
    zh: '全腰圍', en: 'Full Waist', key: 'waist',
    armNumZh: 'm19 × 2', armNumEn: 'm19 × 2',
    noteZh: '半腰弧 m19 = 腰圍 ÷ 2', noteEn: 'Half waist arc (m19) = waist ÷ 2',
    draftFn: m => `m19 = ${(m.waist * MM_TO_IN / 2).toFixed(2)}"`,
  },
  {
    zh: '全臀圍', en: 'Full Hips', key: 'hips',
    armNumZh: 'hip_arc × 2', armNumEn: 'hip_arc × 2',
    noteZh: '臀弧 = 臀圍 ÷ 2', noteEn: 'hip arc = hips ÷ 2',
    draftFn: m => `hip = ${(m.hips * MM_TO_IN / 2).toFixed(2)}"`,
  },
  {
    zh: '後肩至腰', en: 'Back Length', key: 'hpsToWaistBack',
    armNumZh: 'cb_length', armNumEn: 'cb_length',
    noteZh: '後中長，後頸點至自然腰', noteEn: 'CB length, HPS to natural waist',
    draftFn: m => `cb = ${(m.hpsToWaistBack * MM_TO_IN).toFixed(2)}"`,
  },
  {
    zh: '肩寬', en: 'Shoulder Width', key: 'shoulderWidth',
    armNumZh: 'm14', armNumEn: 'm14',
    noteZh: '後肩全寬 (m14)', noteEn: 'Full across shoulder, back (m14)',
    draftFn: m => `m14 = ${(m.shoulderWidth * MM_TO_IN).toFixed(2)}"`,
  },
  {
    zh: '袖長', en: 'Shoulder→Wrist', key: 'shoulderToWrist',
    armNumZh: '袖長參考', armNumEn: 'sleeve ref',
    noteZh: '全袖長參考值', noteEn: 'Full sleeve length reference',
    draftFn: m => `sl = ${(m.shoulderToWrist * MM_TO_IN).toFixed(2)}"`,
  },
  {
    zh: '頸圍', en: 'Neck Circ.', key: 'neck',
    armNumZh: 'neckstimate', armNumEn: 'neckstimate',
    noteZh: '頸圍 → 估算其他尺寸', noteEn: 'Neck → estimate other measurements',
    draftFn: m => `neck_w ≈ ${((m.neck * MM_TO_IN / (2 * Math.PI)) * 1.2 + 0.5).toFixed(2)}"`,
  },
  {
    zh: '上臂圍', en: 'Bicep Circ.', key: 'biceps',
    armNumZh: '袖肥參考', armNumEn: 'bicep ref',
    noteZh: '袖山高 / 袖弧鬆量參考', noteEn: 'Sleeve cap height / ease reference',
  },
  {
    zh: '手腕圍', en: 'Wrist Circ.', key: 'wrist',
    armNumZh: '袖口參考', armNumEn: 'cuff ref',
    noteZh: '袖口開口尺寸', noteEn: 'Cuff opening / sleeve end',
  },
  {
    zh: '褲襠長', en: 'Inseam', key: 'inseam',
    armNumZh: '褲長參考', armNumEn: 'trouser ref',
    noteZh: '褲子內股長度', noteEn: 'Trouser inseam length',
  },
]

// ── Derived Armstrong computed values ─────────────────────────────────────────
function computeDerived(m: Record<string, number>) {
  const bust_in   = (m.chest           || 0) * MM_TO_IN
  const waist_in  = (m.waist           || 0) * MM_TO_IN
  const hips_in   = (m.hips            || 0) * MM_TO_IN
  const back_in   = (m.hpsToWaistBack  || 0) * MM_TO_IN
  const shld_in   = (m.shoulderWidth   || 0) * MM_TO_IN

  const bust_arc  = bust_in  / 2
  const waist_arc = waist_in / 2
  const hip_arc   = hips_in  / 2
  const diff      = (bust_arc - waist_arc) * 2          // full bust-waist diff
  const dart_est  = Math.max(0, (bust_arc - waist_arc)) // front half dart est

  return { bust_arc, waist_arc, hip_arc, back_in, shld_in, diff, dart_est,
           front_len: back_in * 1.065 }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MeasurementChart({ measurements: m }: Props) {
  const { lang } = useLanguage()
  const d = computeDerived(m)

  const derived = [
    {
      labelZh: '胸腰差', labelEn: 'Bust-Waist Δ',
      value: `${d.diff.toFixed(2)}"`,
      note: lang === 'zh' ? '標準 10"，省量依此調整' : 'Std 10", dart adjusted per diff',
      highlight: Math.abs(d.diff - 10) > 1,
    },
    {
      labelZh: '前半腰省量', labelEn: 'Front Dart Est.',
      value: `±${d.dart_est.toFixed(2)}"`,
      note: lang === 'zh' ? '前片半身省量' : 'per half front panel',
      highlight: false,
    },
    {
      labelZh: '胸弧 m17', labelEn: 'Half Bust (m17)',
      value: `${d.bust_arc.toFixed(2)}"`,
      note: lang === 'zh' ? '= 全胸圍 ÷ 2' : '= full bust ÷ 2',
      highlight: false,
    },
    {
      labelZh: '腰弧 m19', labelEn: 'Half Waist (m19)',
      value: `${d.waist_arc.toFixed(2)}"`,
      note: lang === 'zh' ? '= 全腰圍 ÷ 2' : '= full waist ÷ 2',
      highlight: false,
    },
    {
      labelZh: '後長 CB', labelEn: 'CB Length',
      value: `${d.back_in.toFixed(2)}"`,
      note: lang === 'zh' ? '後頸點 HPS → 腰，後中' : 'HPS → waist, back',
      highlight: false,
    },
    {
      labelZh: '前長 CF 估', labelEn: 'CF Length Est.',
      value: `${d.front_len.toFixed(2)}"`,
      note: lang === 'zh' ? '≈ CB × 1.065（第三章 p.40）' : '≈ CB × 1.065 (Ch.3 p.40)',
      highlight: false,
    },
  ]

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between"
           style={{ background: 'var(--bg)' }}>
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase text-[var(--muted)]">
            Armstrong Patternmaking 5th Ed. · Ch.2
          </p>
          <h3 className="font-display text-xl text-[var(--ink)] mt-0.5">
            {lang === 'zh' ? '量體表 Measurement Chart' : 'Measurement Chart'}
          </h3>
        </div>
        <span
          className="text-[10px] tracking-widest uppercase px-2.5 py-1 text-[var(--gold)]"
          style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}
        >
          {lang === 'zh' ? '自動轉換' : 'Auto-converted'}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: 'var(--bg)' }}
                className="border-b border-[var(--border)]">
              {[
                { label: lang === 'zh' ? '測量項目' : 'Measurement', cls: 'text-left pl-5', w: 160 },
                { label: 'mm',       cls: 'text-right pr-4', w: 70 },
                { label: 'cm',       cls: 'text-right pr-4', w: 70 },
                { label: lang === 'zh' ? '英寸 "' : 'in "', cls: 'text-right pr-4', w: 80 },
                { label: 'Armstrong #', cls: 'text-left px-4', w: 110 },
                { label: lang === 'zh' ? '版型值' : 'Draft value', cls: 'text-left pl-4 pr-5 hidden lg:table-cell', w: 140 },
              ].map(col => (
                <th key={col.label}
                    className={`py-2.5 font-medium text-[var(--muted)] tracking-wide uppercase ${col.cls}`}
                    style={{ minWidth: col.w }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => {
              const mm = m[row.key]
              if (!mm) return null
              const cm      = (mm * MM_TO_CM).toFixed(1)
              const inches  = (mm * MM_TO_IN).toFixed(2)
              const draft   = row.draftFn?.(m) ?? '—'

              return (
                <tr key={row.key}
                    className="border-b border-[var(--border)] hover:bg-[var(--gold-light)] transition-colors"
                    style={{ background: i % 2 === 0 ? 'var(--surface)' : 'transparent' }}>
                  <td className="pl-5 pr-3 py-2.5">
                    <span className="font-medium text-[var(--ink)]">
                      {lang === 'zh' ? row.zh : row.en}
                    </span>
                    <span className="text-[var(--muted)] ml-1.5 text-[10px] hidden sm:inline">
                      {lang === 'zh' ? row.en : row.zh}
                    </span>
                  </td>
                  <td className="pr-4 py-2.5 text-right text-[var(--muted)] font-mono tabular-nums">{mm}</td>
                  <td className="pr-4 py-2.5 text-right text-[var(--ink-soft)] font-mono tabular-nums font-medium">{cm}</td>
                  <td className="pr-4 py-2.5 text-right font-bold font-mono tabular-nums"
                      style={{ color: 'var(--gold)' }}>
                    {inches}"
                  </td>
                  <td className="px-4 py-2.5 text-[var(--muted)] font-mono text-[10px]">{lang === 'zh' ? row.armNumZh : row.armNumEn}</td>
                  <td className="pl-4 pr-5 py-2.5 text-[var(--ink-soft)] font-mono text-[10px] hidden lg:table-cell">
                    {draft}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Derived values */}
      <div className="border-t border-[var(--border)] p-5" style={{ background: 'var(--bg)' }}>
        <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] mb-3">
          {lang === 'zh' ? '衍生計算值 Derived Draft Values' : 'Derived Armstrong Draft Values'}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {derived.map(d => (
            <div key={d.labelZh}
                 className="p-3"
                 style={{
                   border: `1px solid ${d.highlight ? '#fca5a5' : 'var(--border)'}`,
                   background: d.highlight ? '#fef2f2' : 'var(--surface)',
                 }}>
              <p className="text-[10px] tracking-wide uppercase mb-1"
                 style={{ color: d.highlight ? '#ef4444' : 'var(--muted)' }}>
                {lang === 'zh' ? d.labelZh : d.labelEn}
              </p>
              <p className="text-lg font-bold font-mono" style={{ color: 'var(--gold)' }}>
                {d.value}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>{d.note}</p>
            </div>
          ))}
        </div>
        {d.diff < 8 && (
          <p className="mt-3 text-xs text-orange-600 px-1">
            ⚠ {lang === 'zh'
              ? `胸腰差 ${d.diff.toFixed(1)}" 小於標準 10"，按 Armstrong p.44 縮小省量。`
              : `Bust-waist diff ${d.diff.toFixed(1)}" below 10" standard — reduce dart per Armstrong p.44.`}
          </p>
        )}
        {d.diff > 12 && (
          <p className="mt-3 text-xs text-orange-600 px-1">
            ⚠ {lang === 'zh'
              ? `胸腰差 ${d.diff.toFixed(1)}" 大於標準 10"，按 Armstrong p.44 加大省量。`
              : `Bust-waist diff ${d.diff.toFixed(1)}" above 10" standard — increase dart per Armstrong p.44.`}
          </p>
        )}
      </div>
    </div>
  )
}
