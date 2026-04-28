'use client'

import { useState, useEffect } from 'react'
import { dxfApi, bomApi } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

interface Props {
  svg:         string
  designName?: string
  instanceId?: string
}

// 手機自動縮小至 35%，桌機 100%
const getInitialZoom = () =>
  typeof window !== 'undefined' && window.innerWidth < 768 ? 35 : 100

export default function PatternViewer({ svg, designName, instanceId }: Props) {
  const { t } = useLanguage()
  const [zoom, setZoom]             = useState(getInitialZoom)
  const [dxfLoading, setDxfLoading] = useState(false)
  const [bomOpen, setBomOpen]       = useState(false)
  const [bom, setBom]               = useState<import('@/lib/api').BomResponse | null>(null)
  const [bomLoading, setBomLoading] = useState(false)

  // SVG 換新時重設縮放
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
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">

      {/* ── Row 1：標題 + Zoom 控制 ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-stone-100">
        <span className="text-sm font-semibold text-stone-700 capitalize truncate mr-2">
          {designName ?? t('viewer.fallback')}
        </span>

        {/* Zoom 控制 — 大按鈕，適合觸控 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setZoom(z => Math.max(20, z - 10))}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 active:bg-stone-100 transition-colors"
            aria-label="縮小"
          >
            <ZoomOut size={16} />
          </button>

          {/* 縮放百分比 — 點擊重設 */}
          <button
            onClick={() => setZoom(getInitialZoom())}
            className="flex items-center gap-0.5 px-2 h-9 rounded-xl hover:bg-stone-50 active:bg-stone-100 transition-colors"
            title="重設縮放"
          >
            <span className="text-xs font-medium text-stone-500 tabular-nums w-8 text-center">
              {zoom}%
            </span>
            <RotateCcw size={10} className="text-stone-300" />
          </button>

          <button
            onClick={() => setZoom(z => Math.min(300, z + 10))}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 active:bg-stone-100 transition-colors"
            aria-label="放大"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {/* ── Row 2：操作按鈕列（水平捲動）────────────────────────────────── */}
      {instanceId && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-100 overflow-x-auto scrollbar-hide">
          <a
            href={`/pattern?redraft=${instanceId}`}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-700 rounded-lg border border-amber-200 transition-colors whitespace-nowrap"
          >
            ↻ {t('viewer.fallback') === '版型' ? 'Redraft' : 'Redraft'}
          </a>

          <button
            onClick={handleBom}
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              bomOpen
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
            }`}
          >
            {bomLoading ? '…' : t('viewer.bom')}
          </button>

          <button
            onClick={handleDxf}
            disabled={dxfLoading}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg border border-stone-200 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {dxfLoading ? t('viewer.dxfLoading') : '↓ DXF'}
          </button>

          <button
            onClick={handleDownloadSvg}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg border border-stone-200 transition-colors whitespace-nowrap"
          >
            ↓ SVG
          </button>
        </div>
      )}

      {/* ── SVG 顯示區 ──────────────────────────────────────────────────── */}
      <div
        className="overflow-auto bg-stone-50"
        style={{
          maxHeight: '65vh',
          WebkitOverflowScrolling: 'touch',   // iOS 流暢滾動
        } as React.CSSProperties}
      >
        {/* 使用 CSS zoom（影響 layout，不留空白）替代 transform:scale */}
        <div
          className="freesewing-svg-wrap p-2"
          style={{ zoom: zoom / 100 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <p className="px-3 py-1.5 text-[10px] text-stone-300 border-t border-stone-100 text-center">
        {t('viewer.footer')}
      </p>

      {/* ── BOM 面板 ────────────────────────────────────────────────────── */}
      {bomOpen && (
        <div className="border-t border-stone-200 bg-stone-50">
          <div className="px-3 py-2.5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-700">{t('viewer.bomTitle')}</h3>
            {instanceId && (
              <button
                onClick={async () => {
                  setBomLoading(true)
                  try {
                    await bomApi.generate(instanceId!)
                    setBom(await bomApi.get(instanceId!))
                  } finally { setBomLoading(false) }
                }}
                className="text-xs text-stone-400 hover:text-stone-700 active:text-stone-900"
              >
                {t('viewer.bomRegen')}
              </button>
            )}
          </div>

          {bomLoading && (
            <div className="px-3 pb-3 text-xs text-stone-400">{t('viewer.bomLoading')}</div>
          )}

          {bom && !bomLoading && (
            <div className="px-3 pb-4 space-y-3">
              {Object.entries(BOM_CATEGORY_KEYS).map(([cat, labelKey]) => {
                const items = bom.groups[cat]
                if (!items?.length) return null
                return (
                  <div key={cat}>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
                      {t(labelKey)}
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        {items.map(item => (
                          <tr key={item.id} className="border-b border-stone-100 last:border-0">
                            <td className="py-1.5 text-stone-700">{item.name_zh}</td>
                            <td className="py-1.5 text-right text-stone-800 font-medium w-14">
                              {item.qty_value} {item.qty_unit}
                            </td>
                            {item.width_mm && (
                              <td className="py-1.5 text-right text-stone-400 w-16 text-[11px]">
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
              <p className="text-xs text-stone-400 pt-1">
                {bom.total} · {t('viewer.bomTotal')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
