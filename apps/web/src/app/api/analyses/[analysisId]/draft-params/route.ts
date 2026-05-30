/**
 * GET /api/analyses/[analysisId]/draft-params?profile_id=<uuid>
 *
 * Returns AI-inferred FreeSewing options for a given analysis + body profile.
 * Each option is annotated with source ("ai" | "default") and valid choices.
 * Optional ?design= overrides the AI's top-ranked design.
 *
 * Reads from standalone file storage (~/.chailyn/standalone/).
 * Falls back to FastAPI when FASTAPI_URL is set (optional).
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { JOBS_DIR, PROFILES_DIR, readJson } from '@/lib/storage'
import type { Profile } from '@/lib/storage'
import fs from 'fs'

const FASTAPI_BASE = process.env.FASTAPI_URL ?? 'http://localhost:8000'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OptionEntry {
  value: string | number | boolean
  source: 'ai' | 'default'
  choices: string[]
}

interface DraftParamsResponse {
  design: string
  confidence: number
  alternatives: { design: string; confidence: number; description_zh: string }[]
  options: Record<string, OptionEntry>
  armstrong: Record<string, number | string>
  reasoning: string[]
  warning?: string
}

// ─── Option mapping constants ─────────────────────────────────────────────────

const OPTION_CHOICES: Record<string, string[]> = {
  collarStyle: ['classic', 'band', 'none'],
  cuffStyle:   ['classical', 'frenchCuff'],
}

const COLLAR_TO_STYLE: Record<string, string> = {
  basic_shirt_collar: 'classic',
  convertible:        'classic',
  mandarin:           'band',
  stand_collar:       'band',
}

const CUFF_TO_STYLE: Record<string, string> = {
  basic_shirt_cuff: 'classical',
  roll_up:          'classical',
  roll_up_cuff:     'classical',
  french_cuff:      'frenchCuff',
  ribbed:           'classical',
  elastic:          'classical',
}

const VALID_DESIGNS = new Set([
  'aaron','bella','bibi','brian','carlita','carlton',
  'huey','lily','paco','sandy','simon','simone',
  'teagan','titan','waralee',
])

// ─── Build annotated options ──────────────────────────────────────────────────

function buildAnnotatedOptions(
  designId: string,
  analysis: Record<string, unknown>,
  saFromPrefs?: number,
): Record<string, OptionEntry> {
  const opts: Record<string, OptionEntry> = {}

  const ai   = (value: string | number | boolean, key = ''): OptionEntry =>
    ({ value, source: 'ai',      choices: OPTION_CHOICES[key] ?? [] })
  const def  = (value: string | number | boolean, key = ''): OptionEntry =>
    ({ value, source: 'default', choices: OPTION_CHOICES[key] ?? [] })

  const components = (analysis.components ?? {}) as Record<string, unknown>
  const cut        = (analysis.cut ?? {}) as Record<string, unknown>
  const craft      = (analysis.craft_recommendations ?? {}) as Record<string, unknown>
  const collar     = (components.collar ?? {}) as Record<string, unknown>
  const sleeves    = (components.sleeves ?? {}) as Record<string, unknown>
  const pockets    = (components.pockets ?? {}) as Record<string, unknown>

  const collarType  = (collar.type as string)  ?? ''
  const cuffType    = (sleeves.cuff_type as string) ?? ''
  const waistTx     = (cut.waist_treatment as string) ?? ''
  const pocketType  = typeof pockets === 'object' && 'type' in pockets
    ? (pockets.type as string) : 'none'
  const saRec       = typeof craft.seam_allowance_mm === 'number' && craft.seam_allowance_mm > 0
    ? (craft.seam_allowance_mm as number) : null

  // collarStyle (simon, simone)
  if (designId === 'simon' || designId === 'simone') {
    const collarVal = COLLAR_TO_STYLE[collarType]
    if (collarVal) opts.collarStyle = ai(collarVal, 'collarStyle')
  }

  // cuffStyle (simon, simone)
  if (designId === 'simon' || designId === 'simone') {
    const cuffVal = CUFF_TO_STYLE[cuffType]
    if (cuffVal) opts.cuffStyle = ai(cuffVal, 'cuffStyle')
  }

  // kangarooPocket (huey, hugo)
  if (designId === 'huey' || designId === 'hugo') {
    opts.kangarooPocket = ai(!['none', '', null, undefined].includes(pocketType))
  }

  // pockets bool (carlita, carlton)
  if (designId === 'carlita' || designId === 'carlton') {
    opts.pockets = ai(!['none', '', null, undefined].includes(pocketType))
  }

  // waistbandWidth (sandy, waralee)
  if (designId === 'sandy' || designId === 'waralee') {
    opts.waistbandWidth = waistTx === 'elastic' ? ai(30) : def(40)
  }

  // elasticWidth (paco, titan)
  if (designId === 'paco' || designId === 'titan') {
    opts.elasticWidth = waistTx === 'elastic' ? ai(25) : def(0)
  }

  // sa (all designs) — prefs > Vision > default
  if (saFromPrefs != null && saFromPrefs > 0) {
    opts.sa = { value: saFromPrefs, source: 'ai', choices: [] }
  } else if (saRec != null) {
    opts.sa = ai(saRec)
  } else {
    opts.sa = def(10)
  }

  // paperless (always default)
  opts.paperless = def(false)

  return opts
}

// ─── Armstrong stub (minimal) ─────────────────────────────────────────────────

function buildArmstrongStub(
  measurements: Record<string, number>,
): Record<string, number | string> {
  const chest  = (measurements.chest  ?? 900) / 25.4    // mm → inches
  const waist  = (measurements.waist  ?? 720) / 25.4
  const hips   = (measurements.hips   ?? 960) / 25.4
  const sleeve = (measurements.shoulderToWrist ?? 580) / 25.4

  const hipWaistDiff = Math.round((hips - waist) * 100) / 100
  const bustWaistDiff = Math.round((chest / 2 - waist / 2) * 100) / 100

  // Approximate bust cup from chest vs highBust diff
  const highBust = (measurements.highBust ?? measurements.chest * 0.95) / 25.4
  const cupDiff  = chest / 2 - highBust / 2
  const cupMap   = [['A',0.5],['B',0.75],['C',1.0],['D',1.25],['DD',1.5]] as [string, number][]
  const bustCup  = cupMap.find(([, v]) => cupDiff <= v)?.[0] ?? 'D'
  const cupSpread = cupDiff > 0.375 ? Math.round((cupDiff - 0.375) * 100) / 100 : 0

  // Approximate US size from chest measurement
  const approxUsSize = Math.round((chest - 28) / 2) * 2 + 6

  return {
    hip_waist_diff_in:    Math.round(hipWaistDiff * 100) / 100,
    front_dart_count:     2,
    front_dart_intake_in: 0.375,
    back_dart_count:      2,
    back_dart_intake_in:  Math.round(bustWaistDiff * 0.5 * 100) / 100,
    bust_cup:             bustCup,
    cup_spread_in:        cupSpread,
    approx_us_size:       Math.max(2, Math.min(24, approxUsSize)),
    sleeve_length_in:     Math.round(sleeve * 100) / 100,
    ease_level:           'semi_fitted',
  }
}

// ─── Find analysis result from standalone jobs ────────────────────────────────

function findJobByAnalysisId(analysisId: string): Record<string, unknown> | null {
  try {
    const files = fs.readdirSync(JOBS_DIR).filter(f => f.endsWith('.json'))
    for (const file of files) {
      const job = readJson<Record<string, unknown>>(path.join(JOBS_DIR, file))
      if (job?.analysis_id === analysisId && job.status === 'done') {
        return job.result as Record<string, unknown>
      }
    }
  } catch { /* dir may not exist */ }
  return null
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { analysisId: string } },
) {
  const { analysisId } = params
  const profileId = req.nextUrl.searchParams.get('profile_id') ?? ''
  const designOverride = req.nextUrl.searchParams.get('design') ?? ''

  // 1. Try FastAPI first (if running)
  try {
    const fastapiUrl = `${FASTAPI_BASE}/analyses/${analysisId}/draft-params?profile_id=${profileId}${designOverride ? `&design=${designOverride}` : ''}`
    const faRes = await fetch(fastapiUrl, { signal: AbortSignal.timeout(3000) })
    if (faRes.ok) {
      const data = await faRes.json()
      return NextResponse.json(data)
    }
  } catch { /* FastAPI not available — fall through to standalone */ }

  // 2. Standalone: find analysis result in job files
  const analysisResult = findJobByAnalysisId(analysisId)
  if (!analysisResult) {
    return NextResponse.json(
      { detail: `找不到分析結果: ${analysisId}` },
      { status: 404 },
    )
  }

  // 3. Load measurements from profile
  let measurements: Record<string, number> = {}
  let warning: string | undefined
  if (profileId) {
    const profile = readJson<Profile>(path.join(PROFILES_DIR, `${profileId}.json`))
    if (profile?.measurements) {
      measurements = profile.measurements as Record<string, number>
    } else {
      warning = 'no_measurements'
    }
  }

  // 4. Resolve top design from closest_freesewing_patterns
  const patterns = (analysisResult.closest_freesewing_patterns ?? []) as {
    design: string; confidence: number; description?: string
  }[]
  const topPattern   = patterns[0] ?? { design: 'simon', confidence: 0.5 }
  const alternatives = patterns.slice(1, 3).map(p => ({
    design:         p.design,
    confidence:     p.confidence,
    description_zh: p.description ?? '',
  }))

  const chosenDesign = (designOverride && VALID_DESIGNS.has(designOverride))
    ? designOverride
    : topPattern.design

  if (!VALID_DESIGNS.has(chosenDesign)) {
    return NextResponse.json(
      { detail: `未知設計: ${chosenDesign}` },
      { status: 400 },
    )
  }

  // 5. Build annotated options
  const options = buildAnnotatedOptions(chosenDesign, analysisResult)

  // 6. Build Armstrong metrics
  const armstrong = buildArmstrongStub(measurements)

  // 7. Reasoning from analysis
  const craft = (analysisResult.craft_recommendations ?? {}) as Record<string, unknown>
  const reasoning: string[] = [
    `服裝類別匹配：${analysisResult.garment_category ?? 'unknown'}`,
    `Armstrong 信心分數：${Math.round(topPattern.confidence * 100)}%`,
  ]
  if (craft.construction_notes) reasoning.push(String(craft.construction_notes))

  const response: DraftParamsResponse = {
    design:       chosenDesign,
    confidence:   topPattern.confidence,
    alternatives,
    options,
    armstrong,
    reasoning,
    ...(warning ? { warning } : {}),
  }

  return NextResponse.json(response)
}
