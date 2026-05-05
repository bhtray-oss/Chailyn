'use client'

/**
 * PatternGeometryPanel
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays the complete Armstrong pattern geometry result:
 *   • Garment breakdown (bodice, waistband, skirt, pocket)
 *   • SVG diagrams for each pattern piece with production markings
 *   • Seam trueing report
 *   • Pleat coordinate table
 *   • Production markings index
 */

import { useState, useEffect, useCallback } from 'react'
import { useLanguage }  from '@/contexts/LanguageContext'
import {
  ChevronDown, ChevronRight, Loader2, AlertCircle,
  CheckCircle, Scissors, Ruler, BookOpen,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Pt { x: number; y: number }

interface PleatData {
  pleat_number:    number
  visible_width_in:number
  underlay_width_in:number
  outer_fold_L_in: number
  inner_fold_L_in: number
  center_in:       number
  inner_fold_R_in: number
  outer_fold_R_in: number
  press_depth_in:  number
  notch_top_L:     Pt
  notch_top_R:     Pt
  awl_punch:       Pt
}

interface GeometryResult {
  garment_description: string
  measurements_used:   Record<string, number>
  warnings:            string[]
  waistband: {
    finished_width_in:   number
    cut_width_in:        number
    front_length_in:     number
    back_length_in:      number
    total_cut_length_in: number
    interfacing_note:    string
  }
  skirt_sloper: {
    waist_width_in:      number
    hip_width_in:        number
    hem_width_in:        number
    skirt_length_in:     number
    waist_dart_depth_in: number
    waist_dart_width_in: number
    outline:             Pt[]
  }
  flare_skirt: {
    hem_width_after_flare_in: number
    flare_added_per_slash_in: number
    slash_count:              number
    outline:                  Pt[]
    trueing_note:             string
  }
  pleat_transform: {
    total_cut_width_in: number
    extra_fabric_in:    number
    production_note:    string
    post_pleat_outline: Pt[]
    pleats:             PleatData[]
  }
  pocket_facing: {
    opening_start_y_in:   number
    opening_end_y_in:     number
    opening_length_in:    number
    facing_width_in:      number
    bag_depth_in:         number
    bag_width_in:         number
    front_facing:         Pt[]
    back_facing:          Pt[]
    bag_shape:            Pt[]
    opening_notch_top:    Pt
    opening_notch_bottom: Pt
    sa_note:              string
  }
  seam_trueing: {
    all_ok:   boolean
    checks:   { seam: string; length_a: number; length_b: number; delta: number; ok: boolean; note: string }[]
    recommendation: string
  }
  production_markings: {
    notches:           { piece: string; location: string; point: Pt; type: string }[]
    awl_punches:       { piece: string; location: string; point: Pt; note: string }[]
    grainlines:        { piece: string; direction: string }[]
    hbl:               { piece: string; y_from_waist: number; note: string }[]
    seam_allowance_in: number
  }
}

interface Props {
  measurements?: Record<string, number>
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function ptStr(pts: Pt[]): string {
  return pts.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ')
}

function viewBox(pts: Pt[], pad = 2): string {
  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const w    = Math.max(...xs) - Math.min(...xs) + pad * 2
  const h    = Math.max(...ys) - Math.min(...ys) + pad * 2
  return `${minX} ${minY} ${w} ${h}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, icon, children, defaultOpen = false }: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-[#E5DDD6] mb-3">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-[#FAFAF9] hover:bg-[#F7F5F2] transition-colors text-left"
        onClick={() => setOpen(v => !v)}
      >
        <span className="flex items-center gap-2 text-[11px] tracking-widest uppercase font-semibold text-[#3D3530]">
          {icon}{title}
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="p-4 bg-white">{children}</div>}
    </div>
  )
}

function LabelValue({ label, value, unit = '' }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1 border-b border-[#F0EBE5] last:border-0">
      <span className="text-[11px] text-[#8C7B72] tracking-wide">{label}</span>
      <span className="text-xs font-mono font-medium text-[#0C0A09]">
        {typeof value === 'number' ? value.toFixed(4) : value}{unit && ` ${unit}`}
      </span>
    </div>
  )
}

// ── Skirt outline SVG ─────────────────────────────────────────────────────────

function SkirtOutlineSvg({ outline, pleats, hbl, hip_depth, label }: {
  outline:   Pt[]
  pleats?:   PleatData[]
  hbl?:      number
  hip_depth?:number
  label:     string
}) {
  if (!outline.length) return null
  const vb = viewBox(outline, 3)

  return (
    <div className="mt-3">
      <p className="text-[10px] tracking-widest uppercase text-[#8C7B72] mb-1">{label}</p>
      <svg
        viewBox={vb}
        className="w-full max-h-64 border border-[#E5DDD6] bg-[#FAFAF9]"
        style={{ fontFamily: 'monospace', fontSize: '0.8px' }}
      >
        {/* Outline */}
        <polygon
          points={ptStr(outline)}
          fill="rgba(201,169,110,0.08)"
          stroke="#C9A96E"
          strokeWidth="0.25"
        />
        {/* HBL */}
        {hbl != null && hip_depth != null && (
          <line
            x1={outline[0]?.x ?? 0} y1={hip_depth}
            x2={(outline[2]?.x ?? 20)} y2={hip_depth}
            stroke="#8C7B72" strokeWidth="0.15" strokeDasharray="0.5 0.3"
          />
        )}
        {/* Pleat fold lines */}
        {pleats?.map(pl => (
          <g key={pl.pleat_number}>
            <line x1={pl.inner_fold_L_in} y1={0} x2={pl.inner_fold_L_in} y2={pl.press_depth_in}
              stroke="#3D3530" strokeWidth="0.2" />
            <line x1={pl.inner_fold_R_in} y1={0} x2={pl.inner_fold_R_in} y2={pl.press_depth_in}
              stroke="#3D3530" strokeWidth="0.2" />
            <line x1={pl.outer_fold_L_in} y1={0} x2={pl.outer_fold_L_in} y2={pl.press_depth_in}
              stroke="#C9A96E" strokeWidth="0.15" strokeDasharray="0.3 0.2" />
            <line x1={pl.outer_fold_R_in} y1={0} x2={pl.outer_fold_R_in} y2={pl.press_depth_in}
              stroke="#C9A96E" strokeWidth="0.15" strokeDasharray="0.3 0.2" />
            {/* Awl punch */}
            <circle cx={pl.awl_punch.x} cy={pl.awl_punch.y} r="0.2"
              fill="#0C0A09" />
            {/* Notches */}
            <rect x={pl.notch_top_L.x - 0.08} y={-0.3} width="0.16" height="0.4"
              fill="#3D3530" />
            <rect x={pl.notch_top_R.x - 0.08} y={-0.3} width="0.16" height="0.4"
              fill="#3D3530" />
          </g>
        ))}
        {/* CF grainline */}
        <line x1={outline[0]?.x ?? 0} y1="2" x2={outline[0]?.x ?? 0}
          y2={(outline[4]?.y ?? 28) - 2}
          stroke="#8C7B72" strokeWidth="0.15" markerEnd="url(#arr)" />
        {/* Labels */}
        <text x={(outline[0]?.x ?? 0) + 0.5} y="1.5" fontSize="0.8" fill="#8C7B72">CF</text>
      </svg>
    </div>
  )
}

// ── Pocket bag SVG ────────────────────────────────────────────────────────────

function PocketSvg({ bag_shape, front_facing }: { bag_shape: Pt[]; front_facing: Pt[] }) {
  if (!bag_shape.length) return null
  const all_pts = [...bag_shape, ...front_facing]
  const vb = viewBox(all_pts, 1.5)

  return (
    <svg viewBox={vb} className="w-full max-h-48 border border-[#E5DDD6] bg-[#FAFAF9]">
      <polygon points={ptStr(bag_shape)}   fill="rgba(201,169,110,0.1)" stroke="#C9A96E" strokeWidth="0.2" />
      <polygon points={ptStr(front_facing)} fill="rgba(61,53,48,0.08)"  stroke="#3D3530" strokeWidth="0.2" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PatternGeometryPanel({ measurements }: Props) {
  const { lang } = useLanguage()
  const [data,    setData]    = useState<GeometryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!measurements || !measurements.chest || !measurements.waist) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/armstrong/geometry', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ measurements }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load geometry')
    } finally {
      setLoading(false)
    }
  }, [measurements])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center gap-2 text-[#8C7B72] text-sm py-6">
      <Loader2 size={16} className="animate-spin" />
      {lang === 'zh' ? '計算幾何打版…' : 'Computing pattern geometry…'}
    </div>
  )

  if (error) return (
    <div className="flex items-center gap-2 text-red-500 text-sm py-4">
      <AlertCircle size={14} /> {error}
    </div>
  )

  if (!data) return (
    <p className="text-xs text-[#8C7B72]">
      {lang === 'zh' ? '尚無量體資料，請先建立身材檔案。' : 'No measurements. Create a body profile first.'}
    </p>
  )

  const pt = data.pleat_transform
  const sk = data.skirt_sloper
  const fl = data.flare_skirt
  const wb = data.waistband
  const pk = data.pocket_facing
  const tr = data.seam_trueing
  const pm = data.production_markings

  return (
    <div className="text-sm">

      {/* Garment description */}
      <div className="mb-4 p-3 bg-[#FFFDF9] border border-[#E5DDD6]">
        <p className="text-[10px] tracking-widest uppercase text-[#8C7B72] mb-1">
          {lang === 'zh' ? '分析衣款' : 'Garment Type'}
        </p>
        <p className="text-xs text-[#3D3530] leading-relaxed">{data.garment_description}</p>
      </div>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="mb-4 space-y-1">
          {data.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertCircle size={12} className="mt-0.5 shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}

      {/* ── 1. Waistband ─── */}
      <Section title={lang === 'zh' ? '腰帶（插入式）' : 'In-Set Waistband'} icon={<Ruler size={12} />} defaultOpen>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0">
          <LabelValue label={lang === 'zh' ? '完成寬度' : 'Finished Width'} value={wb.finished_width_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '裁切寬度（含縫份）' : 'Cut Width (incl. SA)'} value={wb.cut_width_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '前片長' : 'Front Length'} value={wb.front_length_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '後片長' : 'Back Length'} value={wb.back_length_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '總裁切長度' : 'Total Cut Length'} value={wb.total_cut_length_in} unit="in" />
        </div>
        <p className="mt-3 text-[10px] text-[#8C7B72] leading-relaxed italic">{wb.interfacing_note}</p>
      </Section>

      {/* ── 2. Skirt Sloper ─── */}
      <Section title={lang === 'zh' ? '裙子基礎版' : 'Skirt Sloper'} icon={<BookOpen size={12} />}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0">
          <LabelValue label={lang === 'zh' ? '腰圍半寬' : 'Waist Half-Width'} value={sk.waist_width_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '臀圍半寬' : 'Hip Half-Width'} value={sk.hip_width_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '裙擺半寬' : 'Hem Half-Width'} value={sk.hem_width_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '裙長' : 'Skirt Length'} value={sk.skirt_length_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '腰省深度' : 'Waist Dart Depth'} value={sk.waist_dart_depth_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '腰省寬度' : 'Waist Dart Width'} value={sk.waist_dart_width_in} unit="in" />
        </div>
        <SkirtOutlineSvg
          outline={sk.outline}
          label={lang === 'zh' ? 'A字基礎版（無褶展開）' : 'A-Line Sloper (pre-flare)'}
        />
      </Section>

      {/* ── 3. Flare Transform ─── */}
      <Section title={lang === 'zh' ? '傘狀展開（原理 #2）' : 'Flare Transform (Principle #2)'} icon={<Scissors size={12} />}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0">
          <LabelValue label={lang === 'zh' ? '展開後裙擺半寬' : 'Hem After Flare'} value={fl.hem_width_after_flare_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '每刀展開量' : 'Spread per Slash'} value={fl.flare_added_per_slash_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '剪開刀數' : 'Slash Lines'} value={fl.slash_count} />
        </div>
        <p className="mt-2 text-[10px] text-[#8C7B72] italic leading-relaxed">{fl.trueing_note}</p>
        <SkirtOutlineSvg
          outline={fl.outline}
          hip_depth={data.measurements_used.hip_depth_in}
          label={lang === 'zh' ? 'A字裙 + 傘狀展開後輪廓' : 'Post-Flare Skirt Outline'}
        />
      </Section>

      {/* ── 4. Box Pleat Transform ─── */}
      <Section title={lang === 'zh' ? '箱型褶座標計算（原理 #2）' : 'Box Pleat Transform (Principle #2)'} icon={<Scissors size={12} />} defaultOpen>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0 mb-3">
          <LabelValue label={lang === 'zh' ? '裁切總半寬' : 'Total Cut Half-Width'} value={pt.total_cut_width_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '褶增加布料' : 'Extra Fabric for Pleats'} value={pt.extra_fabric_in} unit="in" />
        </div>

        {/* Per-pleat table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-[#F7F5F2]">
                {['#', lang === 'zh' ? '外折L' : 'Outer L', lang === 'zh' ? '內折L' : 'Inner L',
                  lang === 'zh' ? '中心線' : 'Center', lang === 'zh' ? '內折R' : 'Inner R',
                  lang === 'zh' ? '外折R' : 'Outer R', lang === 'zh' ? '壓褶深' : 'Press Depth',
                  lang === 'zh' ? '鑽孔位' : 'Awl',
                ].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left border-b border-[#E5DDD6] text-[#8C7B72] tracking-wide font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pt.pleats.map(pl => (
                <tr key={pl.pleat_number} className="hover:bg-[#FAFAF9]">
                  <td className="px-2 py-1.5 border-b border-[#F0EBE5] font-medium">{pl.pleat_number}</td>
                  <td className="px-2 py-1.5 border-b border-[#F0EBE5] font-mono">{pl.outer_fold_L_in.toFixed(3)}"</td>
                  <td className="px-2 py-1.5 border-b border-[#F0EBE5] font-mono">{pl.inner_fold_L_in.toFixed(3)}"</td>
                  <td className="px-2 py-1.5 border-b border-[#F0EBE5] font-mono text-[#C9A96E] font-semibold">{pl.center_in.toFixed(3)}"</td>
                  <td className="px-2 py-1.5 border-b border-[#F0EBE5] font-mono">{pl.inner_fold_R_in.toFixed(3)}"</td>
                  <td className="px-2 py-1.5 border-b border-[#F0EBE5] font-mono">{pl.outer_fold_R_in.toFixed(3)}"</td>
                  <td className="px-2 py-1.5 border-b border-[#F0EBE5] font-mono">{pl.press_depth_in.toFixed(1)}"</td>
                  <td className="px-2 py-1.5 border-b border-[#F0EBE5] font-mono text-[#3D3530]">
                    ({pl.awl_punch.x.toFixed(2)}, {pl.awl_punch.y.toFixed(2)})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SkirtOutlineSvg
          outline={pt.post_pleat_outline}
          pleats={pt.pleats}
          hip_depth={data.measurements_used.hip_depth_in}
          label={lang === 'zh' ? '展開後裙片（含褶位標記）' : 'Post-Pleat Skirt (with fold marks)'}
        />
        <p className="mt-2 text-[10px] text-[#8C7B72] italic leading-relaxed">{pt.production_note}</p>
      </Section>

      {/* ── 5. Pocket ─── */}
      <Section title={lang === 'zh' ? '側縫口袋（貼邊 + 袋布）' : 'Side-Seam Pocket (Facing + Bag)'} icon={<Scissors size={12} />}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0 mb-3">
          <LabelValue label={lang === 'zh' ? '開口起點（腰下）' : 'Opening Start (from waist)'} value={pk.opening_start_y_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '開口長度' : 'Opening Length'} value={pk.opening_length_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '貼邊寬' : 'Facing Width'} value={pk.facing_width_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '袋布深' : 'Bag Depth'} value={pk.bag_depth_in} unit="in" />
          <LabelValue label={lang === 'zh' ? '袋布寬' : 'Bag Width'} value={pk.bag_width_in} unit="in" />
        </div>
        <PocketSvg bag_shape={pk.bag_shape} front_facing={pk.front_facing} />
        <p className="mt-2 text-[10px] text-[#8C7B72] italic leading-relaxed">{pk.sa_note}</p>
      </Section>

      {/* ── 6. Seam Trueing ─── */}
      <Section title={lang === 'zh' ? '縫份對位核對' : 'Seam Trueing Report'} icon={<CheckCircle size={12} />}>
        <div className="flex items-center gap-2 mb-3">
          {tr.all_ok
            ? <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                <CheckCircle size={13} /> {lang === 'zh' ? '全部通過 ✓' : 'All checks passed ✓'}
              </span>
            : <span className="flex items-center gap-1 text-xs text-amber-700 font-medium">
                <AlertCircle size={13} /> {tr.recommendation}
              </span>
          }
        </div>
        <div className="space-y-2">
          {tr.checks.map((c, i) => (
            <div key={i} className={`p-2.5 border text-[10px] ${c.ok ? 'border-[#E5DDD6] bg-[#FAFAF9]' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-[#3D3530]">{c.seam}</span>
                <span className={c.ok ? 'text-green-600' : 'text-amber-600'}>
                  Δ {c.delta.toFixed(4)}"
                </span>
              </div>
              <div className="mt-1 text-[#8C7B72]">
                A={c.length_a.toFixed(4)}" · B={c.length_b.toFixed(4)}" · {c.note}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 7. Production Markings ─── */}
      <Section title={lang === 'zh' ? '生產標記（剪口 · 鑽孔 · 布紋線 · 平衡線）' : 'Production Markings'} icon={<Ruler size={12} />}>
        <div className="space-y-4">

          {/* Notches */}
          <div>
            <p className="text-[10px] tracking-widest uppercase text-[#8C7B72] mb-1.5">
              {lang === 'zh' ? `剪口 (${pm.notches.length})` : `Notches (${pm.notches.length})`}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {pm.notches.map((n, i) => (
                <div key={i} className="text-[10px] p-1.5 bg-[#FAFAF9] border border-[#E5DDD6]">
                  <span className="font-medium text-[#3D3530]">{n.piece}</span>
                  <span className="text-[#8C7B72]"> · {n.location} · {n.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Awl punches */}
          <div>
            <p className="text-[10px] tracking-widest uppercase text-[#8C7B72] mb-1.5">
              {lang === 'zh' ? `鑽孔位 (${pm.awl_punches.length})` : `Awl Punches (${pm.awl_punches.length})`}
            </p>
            {pm.awl_punches.map((a, i) => (
              <div key={i} className="text-[10px] p-1.5 bg-[#FAFAF9] border border-[#E5DDD6] mb-1">
                <span className="font-medium">{a.piece}</span> · {a.location}
                <span className="text-[#8C7B72] ml-1">({a.note})</span>
              </div>
            ))}
          </div>

          {/* HBL */}
          <div>
            <p className="text-[10px] tracking-widest uppercase text-[#8C7B72] mb-1.5">
              {lang === 'zh' ? '水平平衡線 (HBL)' : 'Horizontal Balance Lines (HBL)'}
            </p>
            {pm.hbl.map((h, i) => (
              <div key={i} className="text-[10px] p-1.5 bg-[#FAFAF9] border border-[#E5DDD6] mb-1">
                <span className="font-medium">{h.piece}</span>
                <span className="text-[#8C7B72]"> · {h.y_from_waist.toFixed(3)}" from waist · {h.note}</span>
              </div>
            ))}
          </div>

          {/* SA */}
          <div className="text-[10px] text-[#8C7B72]">
            {lang === 'zh' ? '標準縫份：' : 'Seam Allowance: '}
            <span className="font-mono font-medium text-[#0C0A09]">{pm.seam_allowance_in}"</span>
            {' '}({(pm.seam_allowance_in * 25.4).toFixed(1)} mm)
          </div>

        </div>
      </Section>

    </div>
  )
}
