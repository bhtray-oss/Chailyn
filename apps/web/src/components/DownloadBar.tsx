'use client'

/**
 * DownloadBar.tsx — v2 self-contained
 *
 * Fully autonomous download center:
 *  • Auto-loads Armstrong formula data on mount (no user action needed)
 *  • Has its own "Draft Patterns" button — does NOT depend on ArmstrongDraftPanel sections
 *  • Placed once after analysis result; always visible
 *
 * Downloads:
 *   Armstrong analysis → PDF
 *   Per pattern        → SVG / DXF / PDF (print dialog)
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Download, FileText, FileCode2, Printer,
  Loader2, CheckCircle2, AlertCircle, Layers, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { armstrongApi, patternApi } from '@/lib/api'
import type { ArmstrongDraftResult } from '@/lib/api'
import type { GarmentAnalysis } from '@/lib/types'

const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

// ─── Types ────────────────────────────────────────────────────────────────────
interface PatternAsset {
  design:     string
  instanceId: string
  svg:        string
}

interface Props {
  measurements: Record<string, number>
  analysis:     GarmentAnalysis | null
}

// ─── Per-button state ─────────────────────────────────────────────────────────
type BtnState = 'idle' | 'loading' | 'done' | 'error'

function DownloadBtn({
  label, sublabel, icon, onClick, disabled = false, accent = false,
}: {
  label:     string
  sublabel:  string
  icon:      React.ReactNode
  onClick:   () => Promise<void>
  disabled?: boolean
  accent?:   boolean
}) {
  const [state,  setState]  = useState<BtnState>('idle')
  const [errMsg, setErrMsg] = useState('')

  async function handle() {
    if (state === 'loading' || disabled) return
    setState('loading'); setErrMsg('')
    try {
      await onClick()
      setState('done')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setState('error')
    } finally {
      // auto-reset after 3 s
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const bg = accent
    ? (state === 'done' ? 'var(--gold)' : 'var(--ink)')
    : (state === 'done' ? '#d1fae5'    : 'var(--surface)')

  const fg = accent
    ? (state === 'done' ? 'var(--ink)' : 'var(--gold)')
    : (state === 'done' ? '#065f46'    : 'var(--ink)')

  return (
    <button
      onClick={handle}
      disabled={disabled || state === 'loading'}
      title={errMsg || undefined}
      className="flex flex-col items-start gap-1 px-4 py-3 w-full transition-all
                 disabled:opacity-40 hover:opacity-80 active:scale-[0.97]"
      style={{
        border:     `1px solid ${state === 'error' ? '#fca5a5' : 'var(--border)'}`,
        background: disabled ? 'var(--surface)' : bg,
        color:      disabled ? 'var(--muted)'   : fg,
      }}
    >
      <div className="flex items-center gap-1.5">
        {state === 'loading' ? <Loader2     size={13} className="animate-spin" />
         : state === 'done'  ? <CheckCircle2 size={13} />
         : state === 'error' ? <AlertCircle  size={13} className="text-red-400" />
         : icon}
        <span className="text-[10px] font-bold tracking-widest uppercase">{label}</span>
      </div>
      <span className="text-[9px] opacity-60 tracking-wide leading-tight">{sublabel}</span>
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DownloadBar({ measurements, analysis }: Props) {
  const { lang } = useLanguage()

  // Formula state (auto-loaded)
  const [formula,        setFormula]        = useState<ArmstrongDraftResult | null>(null)
  const [formulaLoading, setFormulaLoading] = useState(true)
  const [formulaError,   setFormulaError]   = useState<string | null>(null)

  // Pattern draft state (user-triggered)
  const [patterns,        setPatterns]        = useState<PatternAsset[]>([])
  const [patternLoading,  setPatternLoading]  = useState(false)
  const [patternError,    setPatternError]    = useState<string | null>(null)
  const [patternDrafted,  setPatternDrafted]  = useState(false)

  // Section open/close
  const [open, setOpen] = useState(true)

  // ── Auto-load formula on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      setFormulaLoading(true)
      setFormulaError(null)
      try {
        const data = await armstrongApi.getDraft(DEV_USER_ID)
        if (!cancelled) setFormula(data)
      } catch (e) {
        if (!cancelled) setFormulaError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setFormulaLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ── Draft all recommended patterns ───────────────────────────────────────
  const draftPatterns = useCallback(async () => {
    setPatternLoading(true)
    setPatternError(null)

    const recommended = (analysis?.closest_freesewing_patterns ?? [])
      .slice(0, 3).map(p => p.design)
    const cat     = (analysis as unknown as Record<string, unknown>)?.garment_category as string | undefined
    const designs = recommended.length > 0
      ? recommended
      : (cat === 'bottom' ? ['sandy', 'paco'] : ['bella', 'brian'])

    const results: PatternAsset[] = []
    for (const design of designs) {
      try {
        const res = await patternApi.draft({
          userId:        DEV_USER_ID,
          design,
          bodyProfileId: DEV_PROFILE_ID,
          options:       { sa: 10, paperless: true, complete: true, units: 'metric' },
          sa:            10,
          paperless:     true,
          renderMode:    'svg',
        }) as { svg?: string; instance_id?: string }
        if (res?.svg) {
          results.push({ design, instanceId: res.instance_id ?? '', svg: res.svg })
        }
      } catch { /* skip */ }
    }

    setPatternLoading(false)
    if (results.length === 0) {
      setPatternError(lang === 'zh'
        ? '打版失敗，請確認 Pattern Engine 服務已啟動 (port 3001)'
        : 'Draft failed — ensure pattern-engine is running on port 3001')
    } else {
      setPatterns(results)
      setPatternDrafted(true)
    }
  }, [analysis, lang])

  // ── Lazy-load download utils (browser-only) ───────────────────────────────
  async function dl() { return await import('@/lib/download-utils') }

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>

      {/* ── Header / toggle ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5
                   hover:bg-[var(--gold-light)] transition-colors"
        style={{ borderBottom: open ? '1px solid var(--border)' : 'none' }}
      >
        <div className="flex items-center gap-2.5">
          <Download size={15} className="text-[var(--gold)]" />
          <div className="text-left">
            <p className="text-[10px] tracking-[0.25em] uppercase text-[var(--muted)]">
              {lang === 'zh' ? '下載中心 Download Center' : 'Download Center'}
            </p>
            <p className="text-xs font-semibold text-[var(--ink)] mt-0.5">
              {lang === 'zh'
                ? 'Armstrong 分析 PDF · 版型 SVG / DXF / PDF'
                : 'Armstrong Analysis PDF · Pattern SVG / DXF / PDF'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {formulaLoading && <Loader2 size={13} className="animate-spin text-[var(--muted)]" />}
          {open ? <ChevronDown size={15} className="text-[var(--muted)]" />
                : <ChevronRight size={15} className="text-[var(--muted)]" />}
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-5">

          {/* ── Section 1: Armstrong Analysis PDF ──────────────────────────── */}
          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[var(--muted)] mb-2 flex items-center gap-2">
              {lang === 'zh' ? '分析報告' : 'Analysis Report'}
              {formulaLoading && (
                <span className="flex items-center gap-1 text-[var(--muted)]">
                  <Loader2 size={9} className="animate-spin" />
                  {lang === 'zh' ? '載入中…' : 'Loading…'}
                </span>
              )}
              {formulaError && (
                <span className="text-red-400 text-[9px]">⚠ {formulaError}</span>
              )}
            </p>

            <DownloadBtn
              accent
              label="PDF"
              sublabel={lang === 'zh'
                ? 'Armstrong 公式表 · 量體數值 · 版型座標點 (A4)'
                : 'Armstrong formulas · measurements · draft coordinates (A4)'}
              icon={<FileText size={13} />}
              disabled={!formula}
              onClick={async () => {
                if (!formula) throw new Error('Formula not loaded')
                const { downloadAnalysisPdf } = await dl()
                await downloadAnalysisPdf(formula, measurements, analysis, lang as 'zh' | 'en')
              }}
            />
          </div>

          {/* ── Section 2: Pattern files ─────────────────────────────────────── */}
          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">
              {lang === 'zh' ? '版型圖樣' : 'Pattern Files'}
            </p>

            {!patternDrafted && (
              <button
                onClick={draftPatterns}
                disabled={patternLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4
                           text-xs tracking-widest uppercase font-medium transition-all
                           hover:opacity-80 disabled:opacity-50"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}
              >
                {patternLoading
                  ? <><Loader2 size={13} className="animate-spin" />
                      {lang === 'zh' ? 'FreeSewing 打版中…（約 5–10 秒）' : 'Drafting via FreeSewing… (~5-10s)'}</>
                  : <><Layers size={13} className="text-[var(--gold)]" />
                      {lang === 'zh' ? '點擊打版 — 取得 SVG / DXF / PDF' : 'Draft Patterns — get SVG / DXF / PDF'}</>
                }
              </button>
            )}

            {patternError && (
              <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={11} /> {patternError}
              </p>
            )}

            {patternDrafted && patterns.length === 0 && (
              <p className="text-xs text-[var(--muted)]">
                {lang === 'zh' ? '無可用版型' : 'No patterns available'}
              </p>
            )}

            {patterns.map(({ design, instanceId, svg }) => (
              <div key={design}
                   className="mt-2 p-3 space-y-2"
                   style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                {/* Design label */}
                <div className="flex items-center gap-2 pb-1.5 border-b border-[var(--border)]">
                  <span className="text-[9px] font-bold tracking-widest uppercase text-[var(--gold)]">
                    FreeSewing
                  </span>
                  <span className="text-xs font-semibold text-[var(--ink)] capitalize">{design}</span>
                  <span className="text-[9px] text-[var(--muted)] ml-auto">
                    {lang === 'zh' ? '含縫份 + 尺寸標注' : 'incl. SA + paperless dims'}
                  </span>
                </div>

                {/* Three format buttons */}
                <div className="grid grid-cols-3 gap-1.5">
                  <DownloadBtn
                    label="SVG"
                    sublabel={lang === 'zh' ? '向量，可縮放' : 'Scalable vector'}
                    icon={<FileCode2 size={13} />}
                    onClick={async () => {
                      const { downloadSvg } = await dl()
                      downloadSvg(svg, `${design}_pattern.svg`)
                    }}
                  />
                  <DownloadBtn
                    label="DXF"
                    sublabel={lang === 'zh' ? 'CAD / 繪圖機' : 'CAD / plotter'}
                    icon={<FileCode2 size={13} />}
                    disabled={!instanceId}
                    onClick={async () => {
                      if (!instanceId) throw new Error('No instance ID')
                      const { downloadDxf } = await dl()
                      await downloadDxf(instanceId, design)
                    }}
                  />
                  <DownloadBtn
                    label="PDF"
                    sublabel={lang === 'zh' ? '列印 A0 / 捲筒紙' : 'Print A0 / roll'}
                    icon={<Printer size={13} />}
                    onClick={async () => {
                      const { printPatternAsPdf } = await dl()
                      printPatternAsPdf(svg, design, lang as 'zh' | 'en')
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <p className="text-[9px] text-[var(--muted)] leading-relaxed">
            {lang === 'zh'
              ? 'SVG / DXF 可匯入 Inkscape、Seamly2D、Adobe Illustrator 等打版軟體。版型 PDF 使用瀏覽器列印，建議選 A0 或捲筒紙格式。'
              : 'SVG / DXF can be imported into Inkscape, Seamly2D, Adobe Illustrator, etc. Pattern PDF uses the browser print dialog — recommend A0 or roll paper.'}
          </p>
        </div>
      )}
    </div>
  )
}
