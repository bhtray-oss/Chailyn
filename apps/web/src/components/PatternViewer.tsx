'use client'

/**
 * PatternViewer.tsx — FreeSewing SVG 版型預覽元件
 */

import { useState } from 'react'
import { dxfApi, bomApi } from '@/lib/api'

interface Props {
  svg:         string
  designName?: string
  instanceId?: string   // 儲存後的版型 ID，用於 Redraft 連結
}

export default function PatternViewer({ svg, designName, instanceId }: Props) {
  const [zoom, setZoom]         = useState(100)
  const [dxfLoading, setDxfLoading] = useState(false)
  const [bomOpen, setBomOpen]   = useState(false)
  const [bom, setBom]           = useState<import('@/lib/api').BomResponse | null>(null)
  const [bomLoading, setBomLoading] = useState(false)

  const handleDxf = async () => {
    if (!instanceId) return
    setDxfLoading(true)
    try {
      await dxfApi.download(instanceId, `${designName ?? 'pattern'}.dxf`)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setDxfLoading(false)
    }
  }

  const handleBom = async () => {
    if (!instanceId) return
    setBomOpen(o => !o)
    if (bom) return    // already loaded
    setBomLoading(true)
    try {
      // try fetch existing, if empty auto-generate
      let data = await bomApi.get(instanceId)
      if (data.total === 0) {
        await bomApi.generate(instanceId)
        data = await bomApi.get(instanceId)
      }
      setBom(data)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBomLoading(false)
    }
  }

  const handleDownloadSvg = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${designName ?? 'pattern'}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-stone-700 capitalize">
            {designName ?? '版型預覽'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Zoom */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(25, z - 25))}
              className="w-7 h-7 rounded border border-stone-200 text-stone-600 hover:bg-stone-50 text-sm font-bold"
            >−</button>
            <span className="text-xs text-stone-500 w-10 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
              className="w-7 h-7 rounded border border-stone-200 text-stone-600 hover:bg-stone-50 text-sm font-bold"
            >+</button>
          </div>

          {/* Redraft 按鈕 */}
          {instanceId && (
            <a
              href={`/pattern?redraft=${instanceId}`}
              className="px-3 py-1 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200 transition-colors"
            >
              ↻ Redraft
            </a>
          )}

          {/* BOM 按鈕 */}
          {instanceId && (
            <button
              onClick={handleBom}
              className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                bomOpen
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
              }`}
            >
              {bomLoading ? '…' : '📋 BOM'}
            </button>
          )}

          {/* DXF 匯出 */}
          {instanceId && (
            <button
              onClick={handleDxf}
              disabled={dxfLoading}
              className="px-3 py-1 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded border border-stone-200 transition-colors disabled:opacity-50"
            >
              {dxfLoading ? '生成中…' : '↓ DXF'}
            </button>
          )}

          <button
            onClick={handleDownloadSvg}
            className="px-3 py-1 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded border border-stone-200 transition-colors"
          >
            ↓ SVG
          </button>
        </div>
      </div>

      {/* SVG area */}
      <div className="overflow-auto p-4 bg-stone-50" style={{ maxHeight: '70vh' }}>
        <div
          className="freesewing-svg-wrap origin-top-left transition-transform"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <p className="px-4 py-2 text-xs text-stone-400 border-t border-stone-100">
        輸出格式：SVG / DXF · 單位：mm · 縫份已含
      </p>

      {/* BOM panel */}
      {bomOpen && (
        <div className="border-t border-stone-200 bg-stone-50">
          <div className="px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-700">物料清單（BOM）</h3>
            {instanceId && (
              <button
                onClick={async () => {
                  if (!instanceId) return
                  setBomLoading(true)
                  try {
                    await bomApi.generate(instanceId)
                    const data = await bomApi.get(instanceId)
                    setBom(data)
                  } finally { setBomLoading(false) }
                }}
                className="text-xs text-stone-500 hover:text-stone-700"
              >
                ↻ 重新估算
              </button>
            )}
          </div>

          {bomLoading && (
            <div className="px-4 pb-3 text-xs text-stone-400">載入中…</div>
          )}

          {bom && !bomLoading && (
            <div className="px-4 pb-4 space-y-3">
              {Object.entries(BOM_CATEGORY_LABELS).map(([cat, label]) => {
                const items = bom.groups[cat]
                if (!items?.length) return null
                return (
                  <div key={cat}>
                    <div className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-1">
                      {label}
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        {items.map(item => (
                          <tr key={item.id} className="border-b border-stone-100 last:border-0">
                            <td className="py-1.5 text-stone-700">{item.name_zh}</td>
                            <td className="py-1.5 text-right text-stone-800 font-medium w-16">
                              {item.qty_value} {item.qty_unit}
                            </td>
                            {item.width_mm && (
                              <td className="py-1.5 text-right text-stone-400 w-20">
                                幅寬 {item.width_mm / 10}cm
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
                共 {bom.total} 項 · 用料含 20% 餘量
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const BOM_CATEGORY_LABELS: Record<string, string> = {
  fabric:       '布料',
  interfacing:  '布襯',
  notions:      '小料輔料',
  thread:       '車線',
  misc:         '其他',
}
