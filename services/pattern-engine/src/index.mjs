/**
 * index.mjs — pattern-engine HTTP server
 *
 * Endpoints:
 *   POST /draft   — 打版，回傳 SVG 或 renderProps
 *   POST /sample  — 取樣預覽，回傳 SVG
 *   POST /measurements/estimate — 用 neckstimate 補齊身材資料
 *   GET  /designs — 列出所有支援的 design
 *   GET  /health  — 健康檢查
 */

import express from 'express'
import { draftPattern, availableDesigns } from './draft.mjs'
import { samplePattern } from './sample.mjs'
import { renderPropsToDxf } from './dxf.mjs'
import {
  toMm,
  fillMissingWithNeckstimate,
  validateMeasurements,
} from './measurements.mjs'

const app = express()
app.use(express.json({ limit: '2mb' }))

// ─── Health check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', designs: availableDesigns.length })
})

// ─── List designs ────────────────────────────────────────────────────────────
app.get('/designs', (_req, res) => {
  res.json({ designs: availableDesigns })
})

// ─── POST /draft ─────────────────────────────────────────────────────────────
/**
 * Body:
 * {
 *   design: string,
 *   measurements: Record<string, number>,  // mm (後端已轉換好)
 *   options?: Record<string, unknown>,
 *   sa?: number,
 *   paperless?: boolean,
 *   units?: 'metric' | 'imperial',
 *   renderMode?: 'svg' | 'props',
 *   fillMissing?: boolean,   // 是否用 neckstimate 補齊
 *   gender?: 'cisFemale' | 'cisMale',
 * }
 */
app.post('/draft', async (req, res) => {
  try {
    const {
      design,
      measurements: rawMeasurements = {},
      options = {},
      sa = 10,
      paperless = false,
      units = 'metric',
      renderMode = 'svg',
      fillMissing = true,
      gender = 'cisFemale',
    } = req.body

    if (!design) return res.status(400).json({ error: 'design is required' })

    // measurements 應已為 mm，但做防呆處理
    let measurements = rawMeasurements
    if (fillMissing) {
      measurements = fillMissingWithNeckstimate(measurements, gender)
    }

    const result = await draftPattern({
      design, measurements, options, sa, paperless, units, renderMode,
    })

    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('[/draft]', err.message)
    res.status(422).json({ ok: false, error: err.message })
  }
})

// ─── POST /sample ─────────────────────────────────────────────────────────────
/**
 * Body:
 * {
 *   design: string,
 *   mode: 'option' | 'measurement' | 'models',
 *   measurements?: Record<string, number>,
 *   sampleOption?: string,
 *   sampleMeasurement?: string,
 *   gender?: 'cisFemale' | 'cisMale',
 * }
 */
app.post('/sample', async (req, res) => {
  try {
    const params = req.body
    if (!params.design) return res.status(400).json({ error: 'design is required' })
    if (!params.mode) return res.status(400).json({ error: 'mode is required' })

    const result = await samplePattern(params)
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('[/sample]', err.message)
    res.status(422).json({ ok: false, error: err.message })
  }
})

// ─── POST /measurements/estimate ─────────────────────────────────────────────
/**
 * Body: { measurements: Record<string, number>, gender?: string }
 * 回傳用 neckstimate 補齊後的完整 measurements (mm)
 */
app.post('/measurements/estimate', (req, res) => {
  try {
    const { measurements = {}, gender = 'cisFemale' } = req.body
    const filled = fillMissingWithNeckstimate(measurements, gender)
    res.json({ ok: true, measurements: filled })
  } catch (err) {
    res.status(422).json({ ok: false, error: err.message })
  }
})

// ─── GET /meta/:design ───────────────────────────────────────────────────────
/**
 * pattern-via-io 概念：stdin(design) → getRenderProps() → stdout(metadata)
 * 回傳版型的結構元資料：裁片數量、裁片名稱、建議量身部位
 */
app.get('/meta/:design', async (req, res) => {
  const { design } = req.params
  try {
    // 用預設身材（Aaron 範例尺寸）draft 一次，僅為提取結構
    const defaultMeasurements = {
      chest: 1080, waist: 880, hips: 980, neck: 420,
      hpsToWaistBack: 550, shoulderToShoulder: 465,
      shoulderSlope: 16, biceps: 335, waistToHips: 145,
      inseam: 760, seat: 980, wrist: 170,
    }
    const filled = fillMissingWithNeckstimate(defaultMeasurements, 'cisFemale')
    const result = await draftPattern({
      design, measurements: filled, renderMode: 'props', sa: 0, paperless: false,
    })
    const props = result.renderProps
    if (!props) return res.status(422).json({ ok: false, error: 'no renderProps' })

    // 提取裁片名稱和數量
    const partNames = Object.keys(props.stacks || props.parts || {})
    const partCount = partNames.length

    res.json({
      ok: true,
      design,
      part_count: partCount,
      part_names: partNames,
      config: props.settings || {},
    })
  } catch (err) {
    res.status(422).json({ ok: false, error: err.message })
  }
})

// ─── POST /dxf ───────────────────────────────────────────────────────────────
/**
 * Body: same as /draft, always runs in props mode internally
 * Response: DXF file (text/plain)
 */
app.post('/dxf', async (req, res) => {
  try {
    const {
      design,
      measurements: rawMeasurements = {},
      options = {},
      sa = 10,
      paperless = false,
      units = 'metric',
      fillMissing = true,
      gender = 'cisFemale',
      title,
    } = req.body

    if (!design) return res.status(400).json({ error: 'design is required' })

    let measurements = rawMeasurements
    if (fillMissing) {
      measurements = fillMissingWithNeckstimate(measurements, gender)
    }

    // Always get renderProps for DXF conversion
    const { renderProps } = await draftPattern({
      design, measurements, options, sa, paperless, units, renderMode: 'props',
    })

    if (!renderProps) {
      return res.status(422).json({ error: 'Could not get render props' })
    }

    const dxfContent = renderPropsToDxf(renderProps, {
      title: title ?? design,
      units: 'mm',
    })

    const filename = `${design}_sa${sa}.dxf`
    res
      .set('Content-Type', 'application/dxf')
      .set('Content-Disposition', `attachment; filename="${filename}"`)
      .send(dxfContent)
  } catch (err) {
    console.error('[/dxf]', err.message)
    res.status(422).json({ ok: false, error: err.message })
  }
})

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`[pattern-engine] Running on http://localhost:${PORT}`)
  console.log(`[pattern-engine] Loaded ${availableDesigns.length} designs: ${availableDesigns.join(', ')}`)
})
