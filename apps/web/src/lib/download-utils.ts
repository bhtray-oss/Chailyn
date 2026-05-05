/**
 * download-utils.ts
 * Client-side helpers for SVG / DXF / PDF download.
 * All functions run in the browser only (no SSR).
 */

import type { ArmstrongDraftResult } from '@/lib/api'
import type { GarmentAnalysis } from '@/lib/types'

// ─── SVG blob download ────────────────────────────────────────────────────────
export function downloadSvg(svgString: string, filename = 'pattern.svg') {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  triggerDownload(URL.createObjectURL(blob), filename)
}

// ─── DXF download via Next.js API route ──────────────────────────────────────
export async function downloadDxf(instanceId: string, design: string) {
  const res = await fetch(`/api/patterns/dxf/${instanceId}`)
  if (!res.ok) throw new Error(`DXF generation failed: ${res.statusText}`)
  const blob = await res.blob()
  triggerDownload(URL.createObjectURL(blob), `${design}_pattern.dxf`)
}

// ─── Pattern PDF: open SVG in new window → browser print → PDF ───────────────
export function printPatternAsPdf(svgString: string, design: string, lang: 'zh' | 'en' = 'zh') {
  const label  = lang === 'zh' ? `${design} 版型` : `${design} pattern`
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${label}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; display: flex; flex-direction: column; align-items: center; }
    h1 { font-family: serif; font-size: 14pt; font-weight: normal;
         letter-spacing: 0.15em; text-transform: uppercase;
         padding: 12mm 0 6mm; color: #333; }
    .svg-wrap { width: 100%; }
    .svg-wrap svg { width: 100% !important; height: auto !important; }
    .footer { font-family: sans-serif; font-size: 8pt; color: #999;
              padding: 6mm 0; letter-spacing: 0.1em; }
    @media print {
      @page { margin: 10mm; size: A0 landscape; }
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <h1>FreeSewing · ${label}</h1>
  <div class="svg-wrap">${svgString}</div>
  <p class="footer">Chailyn · Generated ${new Date().toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US')}</p>
  <script>window.onload = () => { setTimeout(() => window.print(), 400) }<\/script>
</body>
</html>`
  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}

// ─── Armstrong Analysis PDF (jsPDF + autotable) ───────────────────────────────
export async function downloadAnalysisPdf(
  formulaData: ArmstrongDraftResult,
  measurements: Record<string, number>,
  analysis: GarmentAnalysis | null,
  lang: 'zh' | 'en' = 'zh',
) {
  // Dynamic import — jsPDF is browser-only
  const { jsPDF }         = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W   = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  let y = 15

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const gold   = [176, 141, 87]  as [number,number,number]
  const ink    = [30,  28,  24]  as [number,number,number]
  const muted  = [120, 110, 95]  as [number,number,number]
  const border = [220, 210, 195] as [number,number,number]

  function heading(txt: string, size = 18) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(size)
    doc.setTextColor(...ink)
    doc.text(txt, 15, y)
    y += size * 0.5
  }
  function sub(txt: string) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...muted)
    doc.text(txt, 15, y)
    y += 5
  }
  function rule() {
    doc.setDrawColor(...border)
    doc.setLineWidth(0.3)
    doc.line(15, y, W - 15, y)
    y += 4
  }

  // ── Cover header ────────────────────────────────────────────────────────────
  // Gold accent bar
  doc.setFillColor(...gold)
  doc.rect(0, 0, 4, pageH, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...muted)
  doc.text('CHAILYN · AI PATTERNMAKING', 15, y)
  y += 5

  heading(lang === 'zh' ? 'Armstrong 打版分析報告' : 'Armstrong Patternmaking Report', 20)
  y += 2
  sub(`Armstrong Patternmaking for Fashion Design 5th Ed. · ${new Date().toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US')}`)
  rule()

  // ── Garment summary ─────────────────────────────────────────────────────────
  if (analysis) {
    const silhouette = analysis.cut?.silhouette ?? '—'
    const fabric     = analysis.fabric?.primary?.name ?? '—'
    const collar     = typeof analysis.components?.collar === 'string'
      ? analysis.components.collar : '—'
    const sleeve     = typeof analysis.components?.sleeves === 'string'
      ? analysis.components.sleeves : '—'
    const patterns   = (analysis.closest_freesewing_patterns ?? [])
      .map(p => p.design).join(', ') || '—'

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ink)
    doc.text(lang === 'zh' ? '服裝分析摘要' : 'Garment Analysis Summary', 15, y)
    y += 5

    const summaryRows = [
      [lang === 'zh' ? '廓形'   : 'Silhouette', silhouette],
      [lang === 'zh' ? '面料'   : 'Fabric',     fabric],
      [lang === 'zh' ? '領型'   : 'Collar',     collar],
      [lang === 'zh' ? '袖型'   : 'Sleeves',    sleeve],
      [lang === 'zh' ? '推薦版型' : 'FreeSewing Designs', patterns],
    ]

    autoTable(doc, {
      startY: y,
      head:   [],
      body:   summaryRows,
      theme:  'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: muted, cellWidth: 45 },
        1: { textColor: ink },
      },
      margin: { left: 15, right: 15 },
    })
    y = (doc as unknown as {lastAutoTable: {finalY: number}}).lastAutoTable.finalY + 6
  }

  rule()

  // ── Key Armstrong measurements ───────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...ink)
  doc.text(lang === 'zh' ? '關鍵 Armstrong 量體值' : 'Key Armstrong Measurements', 15, y)
  y += 5

  const am = formulaData.armstrong_measurements
  const keyRows = [
    ['m17 ' + (lang === 'zh' ? '胸弧' : 'Bust Arc'),    `${am.m17_bust_arc.toFixed(3)}"`, `${Math.round(am.m17_bust_arc * 25.4)} mm`],
    ['m19 ' + (lang === 'zh' ? '腰弧' : 'Waist Arc'),   `${am.m19_waist_arc.toFixed(3)}"`, `${Math.round(am.m19_waist_arc * 25.4)} mm`],
    [lang === 'zh' ? '臀弧' : 'Hip Arc',                `${am.hip_arc.toFixed(3)}"`, `${Math.round(am.hip_arc * 25.4)} mm`],
    ['CB ' + (lang === 'zh' ? '後長' : 'Length'),        `${am.cb_length.toFixed(3)}"`, `${Math.round(am.cb_length * 25.4)} mm`],
    ['m14 ' + (lang === 'zh' ? '肩寬' : 'Shoulder'),    `${am.m14_across_shoulder.toFixed(3)}"`, `${Math.round(am.m14_across_shoulder * 25.4)} mm`],
    ['m7 '  + (lang === 'zh' ? '肩斜' : 'Shld Slope'),  `${am.m7_shoulder_slope.toFixed(3)}"`, `${Math.round(am.m7_shoulder_slope * 25.4)} mm`],
    [lang === 'zh' ? '胸腰差' : 'Bust-Waist Diff',
     `${formulaData.bw_diff.toFixed(3)}"`,
     Math.abs(formulaData.bw_diff - 10) > 0.375
       ? (lang === 'zh' ? '⚠ 依 p.44 調整省量' : '⚠ Adjust dart per p.44')
       : (lang === 'zh' ? '✓ 在標準範圍內'    : '✓ Within tolerance')],
  ]

  autoTable(doc, {
    startY: y,
    head: [[lang === 'zh' ? '項目' : 'Item',
            lang === 'zh' ? '英寸' : 'Inches',
            lang === 'zh' ? '公釐 / 備注' : 'mm / Note']],
    body: keyRows,
    theme: 'grid',
    headStyles:    { fillColor: gold, textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles:    { fontSize: 8, textColor: ink },
    alternateRowStyles: { fillColor: [252, 249, 244] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55 },
      1: { cellWidth: 35, halign: 'right' as const },
    },
    margin: { left: 15, right: 15 },
  })
  y = (doc as unknown as {lastAutoTable: {finalY: number}}).lastAutoTable.finalY + 8

  // ── Full formula table ───────────────────────────────────────────────────────
  doc.addPage()
  y = 15

  doc.setFillColor(...gold)
  doc.rect(0, 0, 4, pageH, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...ink)
  doc.text(lang === 'zh' ? '版型公式 Draft Formula Reference' : 'Draft Formula Reference', 15, y)
  y += 6
  sub('Armstrong Patternmaking 5th Ed. Ch.2–Ch.3')
  rule()

  const formulaRows = formulaData.formula_rows.map(r => [
    r.ch,
    r.ref,
    lang === 'zh' ? r.zh : r.en,
    r.formula,
    `${r.val_in.toFixed(3)}"`,
    `${r.val_mm}`,
    r.warning ? '⚠' : '',
  ])

  autoTable(doc, {
    startY: y,
    head: [[
      lang === 'zh' ? '章節' : 'Chapter',
      'Ref',
      lang === 'zh' ? '項目' : 'Item',
      lang === 'zh' ? '公式' : 'Formula',
      lang === 'zh' ? '英寸' : 'in"',
      'mm',
      '',
    ]],
    body: formulaRows,
    theme: 'striped',
    headStyles:  { fillColor: gold, textColor: [255,255,255], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles:  { fontSize: 7.5, textColor: ink },
    alternateRowStyles: { fillColor: [252, 249, 244] },
    columnStyles: {
      0: { cellWidth: 22, textColor: muted },
      1: { cellWidth: 20, fontStyle: 'bold', textColor: gold as [number,number,number] },
      2: { cellWidth: 50 },
      3: { cellWidth: 42, textColor: muted },
      4: { cellWidth: 20, halign: 'right' as const, fontStyle: 'bold' },
      5: { cellWidth: 16, halign: 'right' as const, textColor: muted },
      6: { cellWidth: 10, halign: 'center' as const },
    },
    margin: { left: 15, right: 15 },
    didParseCell(data) {
      // highlight warning rows in light red
      const row = formulaData.formula_rows[data.row.index]
      if (row?.warning) {
        data.cell.styles.textColor = [180, 30, 30]
        data.cell.styles.fillColor = [255, 240, 240]
      }
    },
  })
  y = (doc as unknown as {lastAutoTable: {finalY: number}}).lastAutoTable.finalY + 6

  // ── Front/back key points ────────────────────────────────────────────────────
  if (y < pageH - 60) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ink)
    doc.text(lang === 'zh' ? '關鍵版型座標點 (英寸)' : 'Key Draft Points (inches)', 15, y)
    y += 5

    const fp = formulaData.front_points
    const bp = formulaData.back_points
    const ptRows: string[][] = []
    for (const [k, v] of Object.entries(fp)) {
      if (typeof v === 'object' && v !== null) {
        ptRows.push([`前 ${k}`, `x = ${(v as {x:number}).x.toFixed(4)}"`, `y = ${(v as {y:number}).y.toFixed(4)}"`])
      }
    }
    for (const [k, v] of Object.entries(bp)) {
      if (typeof v === 'object' && v !== null) {
        ptRows.push([`後 ${k}`, `x = ${(v as {x:number}).x.toFixed(4)}"`, `y = ${(v as {y:number}).y.toFixed(4)}"`])
      } else if (typeof v === 'number') {
        ptRows.push([`後 ${k}`, `${v.toFixed(4)}"`, ''])
      }
    }

    autoTable(doc, {
      startY: y,
      head: [[lang === 'zh' ? '點' : 'Point', 'X', 'Y']],
      body: ptRows,
      theme: 'plain',
      headStyles: { fillColor: [245, 240, 230], textColor: muted, fontSize: 7.5 },
      bodyStyles: { fontSize: 7, textColor: ink },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 25 },
        1: { fontStyle: 'bold', cellWidth: 45, textColor: gold as [number,number,number] },
        2: { fontStyle: 'bold', cellWidth: 45, textColor: gold as [number,number,number] },
      },
      margin: { left: 15, right: 15 },
    })
  }

  // ── Warnings ─────────────────────────────────────────────────────────────────
  if (formulaData.warnings.length > 0) {
    y = (doc as unknown as {lastAutoTable: {finalY: number}}).lastAutoTable?.finalY ?? y
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(180, 30, 30)
    formulaData.warnings.forEach(w => {
      doc.text(`⚠  ${w}`, 15, y)
      y += 5
    })
  }

  // ── Footer on all pages ───────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...muted)
    doc.text(
      `Chailyn · Armstrong Patternmaking Analysis · Page ${i} of ${pageCount}`,
      W / 2, pageH - 8, { align: 'center' }
    )
    doc.text(
      'Reference: Armstrong, H.J. Patternmaking for Fashion Design, 5th Ed.',
      W / 2, pageH - 4, { align: 'center' }
    )
  }

  doc.save(`armstrong-analysis-${Date.now()}.pdf`)
}

// ─── Internal helper ──────────────────────────────────────────────────────────
function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }, 500)
}
