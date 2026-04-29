'use client'

import { useState, useEffect } from 'react'
import { dxfApi, bomApi } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'
import { ZoomIn, ZoomOut, RotateCcw, Loader2 } from 'lucide-react'

interface Props {
  svg:         string
  designName?: string
  instanceId?: string
}

const getInitialZoom = () =>
  typeof window !== 'undefined' && window.innerWidth < 768 ? 35 : 100

export default function PatternViewer({ svg, designName, instanceId }: Props) {
  const { t } = useLanguage()
  const [zoom, setZoom]             = useState(getInitialZoom)
  const [dxfLoading, setDxfLoading] = useState(false)
  const [bomOpen, setBomOpen]       = useState(false)
  const [bom, setBom]               = useState<import('@/lib/api').BomResponse | null>(null)
  const [bomLoading, setBomLoading] = useState(false)

  useEffect(() => { setZoom(getInitialZoom()) }, [svg])

  const handleDxf = async () => {
    if (!instanceId) return
    setDxfLoading(true)
    try { await dxfApi.download(instanceId, `${designName ?? 'pattern'}.dxf`) }
    catch (e: any) { alert(e.message) }
    finally { setDxfLoading(false) }
  }

  const handleBom = async () => {
    if (!instanceId) return
    setBomOpen(o => !o)
    if (bom) return
    setBomLoading(true)
    try {
      let data = await bomApi.get(instanceId)
      if (data.total === 0) { await bomApi.generate(instanceId); data = await bomApi.get(instanceId) }
      setBom(data)
    } catch (e: any) { alert(e.message) }
    finally { setBomLoading(false) }
  }

  const handleDownloadSvg = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${designName ?? 'pattern'}.svg`; a.click()
    URL.revokeObjectURL(url)
  }

  const BOM_CATEGORY_KEYS: Record<string, Parameters<typeof t>[0]> = {
    fabric:      'bom.fabric',
    interfacing: 'bom.interfacing',
    notions:     'bom.notions',
    thread:      'bom.thread',
    misc:        'bom.misc',
  }

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>

      {/* ── Row 1：標題 + Zoom 控制 ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
        <span className="text-sm font-medium text-[var(--ink)] capitalize truncate mr-2">
          {designName ?? t('viewer.fallback')}
        </span>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setZoom(z => Math.max(20, z - 10))}
            className="w-8 h-8 flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
            style={{ border: '1px solid var(--border)' }}
            aria-label="縮小"
          >
            <ZoomOut size={14} strokeWidth={1.5} />
          </button>

          <button
            onClick={() => setZoom(getInitialZoom())}
            className="flex items-center gap-1 px-2 h-8 hover:bg-[var(--gold-light)] transition-colors"
            title="重設縮放"
          >
            <span className="text-xs text-[var(--muted)] tabular-nums w-8 text-center">{zoom}%</span>
            <RotateCcw size={9} className="text-[var(--border)]" />
          </button>

          <button
            onClick={() => setZoom(z => Math.min(300, z + 10))}
            className="w-8 h-8 flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
            style={{ border: '1px solid var(--border)' }}
            aria-label="放大"
          >
            <ZoomIn size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ── Row 2：操作按鈕列 ────────────────────────────────────────────── */}
      {instanceId && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[var(--border)] overflow-x-auto scrollbar-hide">
          <a
            href={`/pattern?redraft=${instanceId}`}
            className="flex-shrink-0 px-3 py-1.5 text-[10px] tracking-widest uppercase font-medium transition-colors whitespace-nowrap"
            style={{
              border: '1px solid var(--gold)',
              color: 'var(--gold)',
            }}
          >
            ↻ Redraft
          </a>

          <button
            onClick={handleBom}
            className="flex-shrink-0 px-3 py-1.5 text-[10px] tracking-widest uppercase font-medium transition-colors whitespace-nowrap"
            style={{
              border:     '1px solid var(--border)',
              background: bomOpen ? 'var(--ink)' : 'transparent',
              color:      bomOpen ? 'var(--surface)' : 'var(--muted)',
            }}
          >
            {bomLoading ? <Loader2 size={10} className="animate-spin inline" /> : t('viewer.bom')}
          </button>

          <button
            onClick={handleDxf}
            disabled={dxfLoading}
            className="flex-shrink-0 px-3 py-1.5 text-[10px] tracking-widest uppercase font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors whitespace-nowrap disabled:opacity-50"
            style={{ border: '1px solid var(--border)' }}
          >
            {dxfLoading ? '…' : '↓ DXF'}
          </button>

          <button
            onClick={handleDownloadSvg}
            className="flex-shrink-0 px-3 py-1.5 text-[10px] tracking-widest uppercase font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors whitespace-nowrap"
            style={{ border: '1px solid var(--border)' }}
          >
            ↓ SVG
          </button>
        </div>
      )}

      {/* ── SVG 顯示區 ──────────────────────────────────────────────────── */}
      <div
        className="overflow-auto"
        style={{
          maxHeight: '65vh',
          background: 'var(--bg)',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        <div
          className="freesewing-svg-wrap p-2"
          style={{ zoom: zoom / 100 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <p className="px-3 py-1.5 text-[10px] text-[var(--muted)] border-t border-[var(--border)] text-center tracking-wide">
        {t('viewer.footer')}
      </p>

      {/* ── BOM 面板 ────────────────────────────────────────────────────── */}
      {bomOpen && (
        <div className="border-t border-[var(--border)]" style={{ background: 'var(--bg)' }}>
          <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border)]">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)]">{t('viewer.bomTitle')}</p>
            {instanceId && (
              <button
                onClick={async () => {
                  setBomLoading(true)
                  try {
                    await bomApi.generate(instanceId!)
                    setBom(await bomApi.get(instanceId!))
                  } finally { setBomLoading(false) }
                }}
                className="text-[10px] tracking-widest uppercase text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                {t('viewer.bomRegen')}
              </button>
            )}
          </div>

          {bomLoading && (
            <div className="px-4 py-3 flex items-center gap-2 text-xs text-[var(--muted)]">
              <Loader2 size={12} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
              {t('viewer.bomLoading')}
            </div>
          )}

          {bom && !bomLoading && (
            <div className="px-4 py-4 space-y-4">
              {Object.entries(BOM_CATEGORY_KEYS).map(([cat, labelKey]) => {
                const items = bom.groups[cat]
                if (!items?.length) return null
                return (
                  <div key={cat}>
                    <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">
                      {t(labelKey)}
                    </p>
                    <table className="w-full text-xs">
                      <tbody>
                        {items.map(item => (
                          <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                            <td className="py-1.5 text-[var(--ink-soft)]">{item.name_zh}</td>
                            <td className="py-1.5 text-right text-[var(--ink)] font-medium w-14">
                              {item.qty_value} {item.qty_unit}
                            </td>
                            {item.width_mm && (
                              <td className="py-1.5 text-right text-[var(--muted)] w-16 text-[11px]">
                                {t('viewer.widthUnit')} {item.width_mm / 10}cm
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
              <p className="text-xs text-[var(--muted)] pt-1">
                {bom.total} · {t('viewer.bomTotal')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
