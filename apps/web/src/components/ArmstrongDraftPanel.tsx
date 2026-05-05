'use client'

/**
 * ArmstrongDraftPanel.tsx — v3 (complete redesign)
 *
 * Three sections:
 *  1. 章節參考 Chapter Reference   — from garment analysis (static, fast)
 *  2. 版型公式 Formula Reference   — real values from backend armstrong_bodice.py
 *  3. 衣樣打版圖面 Pattern Draft    — complete FreeSewing professional SVG patterns
 *
 * Formula values come from GET /armstrong/draft?user_id=... (not client-side estimates).
 * Pattern diagrams are auto-drafted via POST /patterns/draft (FreeSewing engine, all pieces).
 */

import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, BookOpen, Ruler, Layers, AlertCircle, RefreshCw, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { armstrongApi, patternApi, ArmstrongDraftResult, ArmstrongFormulaRow } from '@/lib/api'
import { GarmentAnalysis } from '@/lib/types'

// ─── Constants ───────────────────────────────────────────────────────────────
const DEV_USER_ID     = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID  = '00000000-0000-0000-0000-000000000002'

// ─── Armstrong chapter → garment analysis field mapping ──────────────────────
interface ChapterRef {
  ch: string
  titleZh: string
  titleEn: string
  descZh: string
  descEn: string
  trigger: (a: GarmentAnalysis) => boolean
}

const CHAPTER_REFS: ChapterRef[] = [
  {
    ch: 'Ch.2', titleZh: '量體 Measurements', titleEn: 'Taking Measurements',
    descZh: 'FreeSewing 尺寸換算為 Armstrong 英制量體系統，基礎數值 m5–m20。',
    descEn: 'FreeSewing mm measurements converted to Armstrong imperial system (m5–m20).',
    trigger: () => true,
  },
  {
    ch: 'Ch.3', titleZh: '基本衣身 Basic Bodice', titleEn: 'Basic Fitted Bodice',
    descZh: '前後衣身基礎版型（胸省、腰省、肩省），所有上衣打版的起點。',
    descEn: 'Front/back bodice block with bust, waist, shoulder darts — foundation for all tops.',
    // garment_category is an extended field not in base type — use runtime check
    trigger: (a) => {
      const cat = (a as unknown as Record<string, unknown>).garment_category as string | undefined
      return !cat || ['top', 'outerwear', 'block', 'dress'].includes(cat)
    },
  },
  {
    ch: 'Ch.5', titleZh: '箱型打褶 Box Pleat', titleEn: 'Box & Inverted Pleats',
    descZh: '箱型褶佈局計算：褶深、距離、縫製線位置。',
    descEn: 'Box pleat layout: depth, spacing, stitching lines per Armstrong p.78–82.',
    trigger: (a) => /box.?pleat|inverted.?pleat/i.test(JSON.stringify(a)),
  },
  {
    ch: 'Ch.6', titleZh: '公主線 Princess Seam', titleEn: 'Princess Seam',
    descZh: '衣身縱向分割從肩到裙擺，省道轉移為縫道，無獨立腰省。',
    descEn: 'Vertical seam from shoulder to hem — dart absorption into seam, no separate waist dart.',
    trigger: (a) => {
      const detail = (a as unknown as Record<string, unknown>).garment_type_detail as string | undefined
      return a.cut?.silhouette === 'princess' || /princess/i.test(detail ?? '')
    },
  },
  {
    ch: 'Ch.11', titleZh: '方形領口 Square Neckline', titleEn: 'Square Neckline',
    descZh: '方形領口寬度/深度計算，依胸圍比例縮放。',
    descEn: 'Square neckline width/depth, scaled to bust arc proportions.',
    trigger: (a) => /square.?neck|方.*領/i.test(String(a.components?.collar ?? '')),
  },
  {
    ch: 'Ch.16', titleZh: '貼邊 Facings', titleEn: 'Armhole & Neckline Facings',
    descZh: '袖窿/領口貼邊版型：寬度、形狀、布紋方向。',
    descEn: 'Facing pieces for armhole and neckline — width, shape, grain direction.',
    trigger: (a) => /sleeveless|tank/i.test(String(a.components?.sleeves ?? '')),
  },
  {
    ch: 'Ch.20', titleZh: '直裙 Straight Skirt', titleEn: 'Straight / Pencil Skirt',
    descZh: '合身直裙版型，腰省轉臀省，後中開叉。',
    descEn: 'Fitted straight skirt block with waist dart, back vent/slit.',
    trigger: (a) => {
      const detail = (a as unknown as Record<string, unknown>).garment_type_detail as string | undefined
      const cat    = (a as unknown as Record<string, unknown>).garment_category    as string | undefined
      return /skirt|裙/i.test(detail ?? '') || cat === 'bottom'
    },
  },
  {
    ch: 'Ch.24', titleZh: '袖子 Sleeves', titleEn: 'Set-In Sleeve',
    descZh: '裝袖版型：袖山高、袖弧、袖口形狀，對應袖窿曲線。',
    descEn: 'Set-in sleeve cap height, sleeve arc, cuff — matched to armhole curve.',
    trigger: (a) => !!a.components?.sleeves && !/sleeveless|tank/i.test(String(a.components.sleeves)),
  },
]

// ─── Formula table row component ─────────────────────────────────────────────
function FormulaRow({ row, lang, i }: { row: ArmstrongFormulaRow; lang: string; i: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr
        className="border-b border-[var(--border)] hover:bg-[var(--gold-light)] transition-colors cursor-pointer"
        style={{ background: row.warning ? '#fef2f2' : i % 2 === 0 ? 'var(--surface)' : 'transparent' }}
        onClick={() => setOpen(o => !o)}
      >
        <td className="pl-4 py-2 font-mono text-[10px] text-[var(--muted)]">{row.ch}</td>
        <td className="px-3 py-2 font-mono text-[10px] font-bold text-[var(--gold)]">{row.ref}</td>
        <td className="px-3 py-2 text-xs text-[var(--ink)]">
          {lang === 'zh' ? row.zh : row.en}
        </td>
        <td className="px-3 py-2 font-mono text-[10px] text-[var(--muted)]">{row.formula}</td>
        <td className="px-3 py-2 text-right font-bold font-mono tabular-nums text-sm"
            style={{ color: row.warning ? '#ef4444' : 'var(--gold)' }}>
          {row.val_in.toFixed(3)}&quot;
        </td>
        <td className="px-3 pr-4 py-2 text-right font-mono tabular-nums text-xs text-[var(--ink-soft)]">
          {row.val_mm}
        </td>
        <td className="px-2 py-2 text-[var(--muted)]">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </td>
      </tr>
      {open && (
        <tr style={{ background: row.warning ? '#fef2f2' : 'var(--gold-light)' }}>
          <td colSpan={7} className="pl-10 pr-4 py-2 text-[11px] text-[var(--muted)] italic border-b border-[var(--border)]">
            {row.warning && <span className="text-red-500 font-bold mr-2">⚠</span>}
            {row.note}
          </td>
        </tr>
      )}
    </>
  )
}

// ─── SVG Pattern Viewer with zoom ────────────────────────────────────────────
function PatternViewer({ svgData, title }: { svgData: string; title: string }) {
  const [zoom, setZoom] = useState(1)
  return (
    <div className="border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]"
           style={{ background: 'var(--bg)' }}>
        <span className="text-xs font-mono text-[var(--muted)]">{title}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}
                  className="p-1 hover:bg-[var(--gold-light)] rounded transition-colors">
            <ZoomOut size={13} />
          </button>
          <span className="text-[10px] font-mono text-[var(--muted)] w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.2))}
                  className="p-1 hover:bg-[var(--gold-light)] rounded transition-colors">
            <ZoomIn size={13} />
          </button>
          <button onClick={() => setZoom(1)}
                  className="p-1 hover:bg-[var(--gold-light)] rounded transition-colors ml-1">
            <RotateCcw size={13} />
          </button>
        </div>
      </div>
      <div className="overflow-auto" style={{ maxHeight: 560 }}>
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', display: 'inline-block' }}
          dangerouslySetInnerHTML={{ __html: svgData }}
        />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export interface DraftedAsset {
  design:     string
  instanceId: string
  svg:        string
}

interface Props {
  measurements?: Record<string, number>   // mm (FreeSewing standard) — optional, patterns use DEV_PROFILE_ID
  analysis: GarmentAnalysis | null
  onAssetsReady?: (formulaData: ArmstrongDraftResult, assets: DraftedAsset[]) => void
}

type Section = 'chapters' | 'formula' | 'patterns'

export default function ArmstrongDraftPanel({ measurements, analysis, onAssetsReady }: Props) {
  const { lang } = useLanguage()

  const [openSections, setOpenSections] = useState<Set<Section>>(new Set(['chapters']))
  const [formulaData,    setFormulaData]    = useState<ArmstrongDraftResult | null>(null)
  const [formulaLoading, setFormulaLoading] = useState(false)
  const [formulaError,   setFormulaError]   = useState<string | null>(null)

  // patternAssets now tracks instanceId too for DXF download
  const [patternAssets,  setPatternAssets]  = useState<DraftedAsset[]>([])
  const [patternLoading, setPatternLoading] = useState(false)
  const [patternError,   setPatternError]   = useState<string | null>(null)

  // ── Load formula data from backend ─────────────────────────────────────────
  const loadFormula = useCallback(async () => {
    setFormulaLoading(true)
    setFormulaError(null)
    try {
      const data = await armstrongApi.getDraft(DEV_USER_ID)
      setFormulaData(data)
      // Notify parent if patterns already ready
      if (patternAssets.length > 0) onAssetsReady?.(data, patternAssets)
    } catch (e) {
      setFormulaError(e instanceof Error ? e.message : 'Failed to load formula data')
    } finally {
      setFormulaLoading(false)
    }
  }, [patternAssets, onAssetsReady])

  // ── Load FreeSewing pattern SVGs ────────────────────────────────────────────
  const loadPatterns = useCallback(async () => {
    setPatternLoading(true)
    setPatternError(null)

    const recommended = analysis?.closest_freesewing_patterns?.slice(0, 3).map(p => p.design) ?? []
    const cat = (analysis as Record<string, unknown> | null)?.garment_category as string | undefined
    const designs = recommended.length > 0
      ? recommended
      : (cat === 'bottom' ? ['sandy', 'paco'] : ['bella', 'brian'])

    const results: DraftedAsset[] = []
    for (const design of designs) {
      try {
        const res = await patternApi.draft({
          userId:        DEV_USER_ID,
          design,
          bodyProfileId: DEV_PROFILE_ID,
          options:    { sa: 10, paperless: true, complete: true, units: 'metric' },
          sa:         10,
          paperless:  true,
          renderMode: 'svg',
        }) as { svg?: string; instance_id?: string }
        if (res?.svg) {
          results.push({
            design,
            instanceId: res.instance_id ?? '',
            svg:        res.svg,
          })
        }
      } catch {
        // skip failed design silently
      }
    }

    if (results.length === 0) {
      setPatternError(lang === 'zh'
        ? '無法載入版型圖面，請確認 Pattern Engine 服務已啟動 (port 3001)'
        : 'Could not load pattern SVGs. Ensure pattern-engine is running on port 3001.')
    } else {
      setPatternAssets(results)
      // Notify parent if formula also already ready
      if (formulaData) onAssetsReady?.(formulaData, results)
    }
    setPatternLoading(false)
  }, [analysis, formulaData, onAssetsReady, lang])

  // ── Toggle section open/close, load on first open ──────────────────────────
  const toggle = useCallback((sec: Section) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(sec)) { next.delete(sec); return next }
      next.add(sec)
      return next
    })
    if (sec === 'formula' && !formulaData && !formulaLoading) {
      loadFormula()
    }
    if (sec === 'patterns' && patternAssets.length === 0 && !patternLoading) {
      loadPatterns()
    }
  }, [formulaData, formulaLoading, patternAssets, patternLoading, loadFormula, loadPatterns])

  // ── Active chapter refs ────────────────────────────────────────────────────
  const activeChapters = analysis
    ? CHAPTER_REFS.filter(c => c.trigger(analysis))
    : CHAPTER_REFS.filter(c => c.ch === 'Ch.2' || c.ch === 'Ch.3')

  // ── Section header component ───────────────────────────────────────────────
  function SectionHeader({
    id, icon, zh, en, badge,
  }: { id: Section; icon: React.ReactNode; zh: string; en: string; badge?: string }) {
    const isOpen = openSections.has(id)
    return (
      <button
        onClick={() => toggle(id)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--gold-light)] transition-colors"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[var(--gold)]">{icon}</span>
          <span className="font-display text-base text-[var(--ink)]">
            {lang === 'zh' ? zh : en}
          </span>
          {badge && (
            <span className="text-[10px] px-2 py-0.5 font-mono text-[var(--gold)]"
                  style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}>
              {badge}
            </span>
          )}
        </div>
        {isOpen ? <ChevronDown size={16} className="text-[var(--muted)]" /> : <ChevronRight size={16} className="text-[var(--muted)]" />}
      </button>
    )
  }

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Panel header */}
      <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between"
           style={{ background: 'var(--bg)' }}>
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase text-[var(--muted)]">
            Armstrong Patternmaking 5th Ed. · Ch.2–24
          </p>
          <h3 className="font-display text-xl text-[var(--ink)] mt-0.5">
            {lang === 'zh' ? '打版分析 Patternmaking Analysis' : 'Patternmaking Analysis'}
          </h3>
        </div>
        <span className="text-[10px] tracking-widest uppercase px-2.5 py-1 text-[var(--gold)]"
              style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}>
          Armstrong 5th Ed.
        </span>
      </div>

      {/* ── Section 1: Chapter Reference ───────────────────────────────────── */}
      <SectionHeader
        id="chapters"
        icon={<BookOpen size={16} />}
        zh="章節參考 Chapter Reference"
        en="Chapter Reference"
        badge={`${activeChapters.length} chapters`}
      />
      {openSections.has('chapters') && (
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3 border-b border-[var(--border)]">
          {activeChapters.map(c => (
            <div key={c.ch}
                 className="p-3.5"
                 style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 text-[var(--gold)]"
                      style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}>
                  {c.ch}
                </span>
                <span className="text-xs font-semibold text-[var(--ink)]">
                  {lang === 'zh' ? c.titleZh : c.titleEn}
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                {lang === 'zh' ? c.descZh : c.descEn}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Section 2: Formula Reference ───────────────────────────────────── */}
      <SectionHeader
        id="formula"
        icon={<Ruler size={16} />}
        zh="版型公式 Draft Formula Reference"
        en="Draft Formula Reference"
        badge={formulaData ? `${formulaData.formula_rows.length} formulas` : undefined}
      />
      {openSections.has('formula') && (
        <div className="border-b border-[var(--border)]">
          {formulaLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-[var(--muted)]">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">
                {lang === 'zh' ? '運算 Armstrong 版型數值中…' : 'Computing Armstrong draft values…'}
              </span>
            </div>
          )}
          {formulaError && (
            <div className="m-4 p-4 flex items-start gap-3"
                 style={{ border: '1px solid #fca5a5', background: '#fef2f2' }}>
              <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700">
                  {lang === 'zh' ? '無法載入版型公式' : 'Formula load failed'}
                </p>
                <p className="text-xs text-red-500 mt-0.5">{formulaError}</p>
                <button onClick={loadFormula}
                        className="mt-2 text-xs px-3 py-1 text-red-600 hover:bg-red-50 border border-red-300 rounded transition-colors">
                  {lang === 'zh' ? '重試' : 'Retry'}
                </button>
              </div>
            </div>
          )}
          {formulaData && (
            <>
              {/* Bust-waist diff warning banner */}
              {Math.abs(formulaData.bw_diff - 10) > 0.375 && (
                <div className="mx-4 mt-4 px-4 py-2.5 flex items-center gap-2 text-sm"
                     style={{ border: '1px solid #fbbf24', background: '#fffbeb' }}>
                  <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                  <span className="text-amber-700">
                    {lang === 'zh'
                      ? `胸腰差 ${formulaData.bw_diff.toFixed(2)}" (標準 10") — 依 Armstrong p.44 調整省量`
                      : `Bust-waist diff ${formulaData.bw_diff.toFixed(2)}" (std 10") — adjust dart per Armstrong p.44`}
                  </span>
                </div>
              )}

              {/* Key measurement summary cards */}
              <div className="px-4 pt-4 pb-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(
                  [
                    { k: 'm17_bust_arc'       as const, zh: '胸弧 m17',  en: 'Bust arc'    },
                    { k: 'm19_waist_arc'      as const, zh: '腰弧 m19',  en: 'Waist arc'   },
                    { k: 'hip_arc'            as const, zh: '臀弧',       en: 'Hip arc'     },
                    { k: 'cb_length'          as const, zh: '後長 CB',    en: 'CB length'   },
                    { k: 'm14_across_shoulder'as const, zh: '肩寬 m14',   en: 'Shoulder'    },
                    { k: 'm7_shoulder_slope'  as const, zh: '肩斜 m7',    en: 'Shld slope'  },
                  ] as Array<{
                    k: keyof typeof formulaData.armstrong_measurements
                    zh: string
                    en: string
                  }>
                ).map(item => (
                  <div key={String(item.k)} className="p-2.5"
                       style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <p className="text-[9px] uppercase tracking-wide text-[var(--muted)] mb-0.5">
                      {lang === 'zh' ? item.zh : item.en}
                    </p>
                    <p className="text-base font-bold font-mono" style={{ color: 'var(--gold)' }}>
                      {(formulaData.armstrong_measurements[item.k] as number).toFixed(2)}&quot;
                    </p>
                  </div>
                ))}
              </div>

              {/* Formula table */}
              <div className="overflow-x-auto px-4 pb-4">
                <table className="w-full text-xs border-collapse mt-2">
                  <thead>
                    <tr style={{ background: 'var(--bg)' }}
                        className="border-b border-[var(--border)]">
                      {[
                        { label: lang === 'zh' ? '章節' : 'Chapter', cls: 'pl-4 text-left',       w: 90  },
                        { label: 'Ref',                               cls: 'px-3 text-left',        w: 90  },
                        { label: lang === 'zh' ? '項目' : 'Item',    cls: 'px-3 text-left',        w: 160 },
                        { label: lang === 'zh' ? '公式' : 'Formula', cls: 'px-3 text-left',        w: 160 },
                        { label: '英寸 "',                            cls: 'px-3 text-right',       w: 80  },
                        { label: 'mm',                                cls: 'px-3 pr-4 text-right',  w: 60  },
                        { label: '',                                  cls: 'px-2',                  w: 24  },
                      ].map(col => (
                        <th key={col.label}
                            className={`py-2 font-medium text-[var(--muted)] tracking-wide uppercase text-[10px] ${col.cls}`}
                            style={{ minWidth: col.w }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {formulaData.formula_rows.map((row, i) => (
                      <FormulaRow key={row.ref + i} row={row} lang={lang} i={i} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Engine warnings from armstrong_bodice.py */}
              {formulaData.warnings.length > 0 && (
                <div className="mx-4 mb-4 p-3 space-y-1"
                     style={{ border: '1px solid #fca5a5', background: '#fef2f2' }}>
                  {formulaData.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-red-600">⚠ {w}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Section 3: Pattern Draft Diagram ───────────────────────────────── */}
      <SectionHeader
        id="patterns"
        icon={<Layers size={16} />}
        zh="衣樣打版圖面 Pattern Draft"
        en="Pattern Draft Diagram"
        badge={patternAssets.length > 0 ? `${patternAssets.length} designs` : undefined}
      />
      {openSections.has('patterns') && (
        <div className="p-4 space-y-4">
          {patternLoading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--muted)]">
              <RefreshCw size={22} className="animate-spin text-[var(--gold)]" />
              <p className="text-sm">
                {lang === 'zh'
                  ? '正在從 FreeSewing 引擎打版中，請稍候…'
                  : 'Drafting patterns from FreeSewing engine, please wait…'}
              </p>
              <p className="text-[11px] text-[var(--muted)]">
                {lang === 'zh'
                  ? '（完整打版含所有紙型片，通常約 3–8 秒）'
                  : '(Full draft with all pieces, usually 3–8s)'}
              </p>
            </div>
          )}
          {patternError && (
            <div className="p-4 flex items-start gap-3"
                 style={{ border: '1px solid #fca5a5', background: '#fef2f2' }}>
              <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700">
                  {lang === 'zh' ? '版型載入失敗' : 'Pattern load failed'}
                </p>
                <p className="text-xs text-red-500 mt-0.5">{patternError}</p>
                <button onClick={loadPatterns}
                        className="mt-2 text-xs px-3 py-1 text-red-600 hover:bg-red-50 border border-red-300 rounded transition-colors">
                  {lang === 'zh' ? '重試' : 'Retry'}
                </button>
              </div>
            </div>
          )}
          {!patternLoading && !patternError && patternAssets.length === 0 && (
            <div className="py-10 text-center text-[var(--muted)] text-sm">
              <Layers size={28} className="mx-auto mb-3 opacity-30" />
              <p>
                {lang === 'zh'
                  ? '點擊上方「衣樣打版圖面」展開以載入完整版型'
                  : 'Tap "Pattern Draft Diagram" above to load complete pattern pieces'}
              </p>
            </div>
          )}
          {patternAssets.map(({ design, svg }) => (
            <PatternViewer
              key={design}
              svgData={svg}
              title={`FreeSewing · ${design} — ${lang === 'zh' ? '完整版型（所有紙型片含縫份）' : 'Complete pattern pieces with seam allowance'}`}
            />
          ))}
          {patternAssets.length > 0 && (
            <p className="text-[10px] text-[var(--muted)] px-1">
              {lang === 'zh'
                ? '版型由 FreeSewing v4 引擎依您的體型數值自動打版，含所有版片、縫份標示及尺寸標注（paperless 模式）。'
                : 'Patterns auto-drafted by FreeSewing v4 from your body measurements — all pieces, seam allowances, and dimension annotations (paperless mode).'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
