/**
 * GET /api/armstrong/draft?user_id=<uuid>
 *
 * Fetches the user's body profile from local file storage,
 * runs the Armstrong bodice draft engine inline (TypeScript port of
 * armstrong_calc.py + armstrong_bodice.py), and returns the formula table.
 *
 * Falls back to FastAPI /armstrong/compute when available (optional enhancement).
 * Works fully standalone — no FastAPI required.
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { PROFILES_DIR, DEV_USER_ID, DEV_PROFILE_ID, readJson, ensureDevProfile } from '@/lib/storage'
import type { Profile } from '@/lib/storage'

const FASTAPI_BASE = process.env.FASTAPI_URL ?? 'http://localhost:8000'

// ─── Armstrong measurement types ─────────────────────────────────────────────

interface ArmstrongMeasurements {
  m5_cf_length:        number
  m6_full_length:      number
  m7_shoulder_slope:   number
  m9_bust_depth:       number
  m10_bust_span:       number
  m11_side_length:     number
  m13_shoulder_len:    number
  m14_across_shoulder: number
  m15_across_chest:    number
  m16_across_back:     number
  m17_bust_arc:        number
  m18_back_arc:        number
  m19_waist_arc:       number
  m20_dart_placement:  number
  hip_arc:             number
  hip_depth:           number
  cb_length:           number
  skirt_length:        number
}

interface Pt { x: number; y: number }

interface FrontPoints {
  A: Pt; B: Pt; C: Pt; D: Pt; E: Pt; G: Pt; H: Pt; I: Pt
  J: Pt; K: Pt; N: Pt; O: Pt; P: Pt; F: Pt; Q: Pt; dart_pt: Pt
  warnings: string[]
}

interface BackPoints {
  A: Pt; B: Pt; E: Pt; G: Pt; I: Pt
  nk_width: number; nk_depth: number
  shoulder_dart: number
}

// ─── fs_mm_to_armstrong (port of armstrong_calc.py) ──────────────────────────

function fsMmToArmstrong(fsMm: Record<string, number>): ArmstrongMeasurements {
  const mm = (k: string, def = 0) => fsMm[k] ?? def
  const inOf = (k: string, def = 0) => mm(k, def) / 25.4

  const bustIn  = inOf('chest',          920)
  const waistIn = inOf('waist',          720)
  const hipsIn  = inOf('hips',           980)
  const backIn  = inOf('hpsToWaistBack', 390)
  const shldIn  = inOf('shoulderWidth',  370)

  const bustArc  = bustIn  / 2
  const waistArc = waistIn / 2
  const hipArc   = hipsIn  / 2

  const m5  = +(backIn - 0.75).toFixed(4)
  const m6  = +(backIn + 0.125).toFixed(4)
  const m7  = +(5.75 * (backIn / 15.75)).toFixed(4)
  const m9  = +(m6 * 0.574).toFixed(4)
  const m10 = +(bustArc * 0.208).toFixed(4)
  const m11 = +backIn.toFixed(4)
  const m13 = +(shldIn / 3.0).toFixed(4)
  const m14 = +shldIn.toFixed(4)
  const m15 = +(shldIn * 0.452).toFixed(4)
  const m16 = +(shldIn * 0.469).toFixed(4)
  const m17 = +bustArc.toFixed(4)
  const m18 = +(bustArc * 0.964).toFixed(4)
  const m19 = +waistArc.toFixed(4)
  const m20 = +(m10 - 0.25).toFixed(4)

  return {
    m5_cf_length:        m5,
    m6_full_length:      m6,
    m7_shoulder_slope:   m7,
    m9_bust_depth:       m9,
    m10_bust_span:       m10,
    m11_side_length:     m11,
    m13_shoulder_len:    m13,
    m14_across_shoulder: m14,
    m15_across_chest:    m15,
    m16_across_back:     m16,
    m17_bust_arc:        m17,
    m18_back_arc:        m18,
    m19_waist_arc:       m19,
    m20_dart_placement:  m20,
    hip_arc:             +hipArc.toFixed(4),
    hip_depth:           7.0,
    cb_length:           +backIn.toFixed(4),
    skirt_length:        +(inOf('inseam', 750) * 0.8 + 5).toFixed(4),
  }
}

// ─── draft_front_bodice (port of armstrong_bodice.py) ────────────────────────

function draftFrontBodice(m: ArmstrongMeasurements): FrontPoints {
  const warnings: string[] = []

  const bwDiff = (m.m17_bust_arc - m.m19_waist_arc) * 2
  if (Math.abs(bwDiff - 10.0) > 0.375) {
    warnings.push(
      `Bust-waist diff = ${bwDiff.toFixed(2)}" (standard 10" ±3/8"). ` +
      'Adjust dart intake per Armstrong p.44.'
    )
  }

  // Reference lines
  const A: Pt = { x: 0, y: m.m6_full_length + 0.125 }
  const B: Pt = { x: 0, y: 0 }
  const C: Pt = { x: m.m14_across_shoulder / 2 - 0.125, y: A.y }
  const D: Pt = { x: 0, y: m.m5_cf_length }
  const E: Pt = { x: m.m17_bust_arc + 0.25, y: 0 }

  // Shoulder + bust
  const G: Pt = { x: C.x, y: m.m7_shoulder_slope + 0.125 }
  const H: Pt = { x: C.x, y: G.y - m.m9_bust_depth }
  const I: Pt = { x: C.x - m.m13_shoulder_len, y: G.y + 0.25 }

  const J: Pt = { x: m.m10_bust_span + 0.25, y: m.m5_cf_length - 1.0 }
  const K: Pt = { x: m.m15_across_chest + 0.25, y: J.y }

  // Side seam + waist
  const N: Pt = { x: E.x,       y: G.y - 0.5 }
  const O: Pt = { x: N.x,       y: N.y - m.m11_side_length }
  const P: Pt = { x: N.x + 1.25, y: 0 }

  // Waist dart
  const F: Pt = { x: m.m20_dart_placement, y: 0.1875 }
  const dartWidth = (m.m19_waist_arc + 0.25) - m.m20_dart_placement
  const Q: Pt = { x: F.x + dartWidth, y: 0.1875 }
  const dart_pt: Pt = { x: J.x, y: J.y - 0.625 }

  return { A, B, C, D, E, G, H, I, J, K, N, O, P, F, Q, dart_pt, warnings }
}

// ─── draft_back_bodice (port of armstrong_bodice.py) ─────────────────────────

function draftBackBodice(m: ArmstrongMeasurements): BackPoints {
  const A: Pt = { x: 0, y: m.cb_length + 0.125 }
  const B: Pt = { x: 0, y: 0 }
  const E: Pt = { x: m.m18_back_arc + 0.25, y: 0 }

  const G: Pt = { x: m.m14_across_shoulder / 2 - 0.125, y: m.m7_shoulder_slope - 0.125 }
  const I: Pt = { x: G.x - m.m13_shoulder_len, y: G.y + 0.125 }

  const nk_width    = 3.25
  const nk_depth    = 0.875
  const shoulder_dart = Math.max(0.0, (m.m14_across_shoulder / 2 - m.m16_across_back) * 0.5)

  return { A, B, E, G, I, nk_width, nk_depth, shoulder_dart }
}

// ─── compute_formula_table (port of armstrong_calc.py) ───────────────────────

function computeFormulaTable(fsMm: Record<string, number>) {
  const m  = fsMmToArmstrong(fsMm)
  const fb = draftFrontBodice(m)
  const bb = draftBackBodice(m)

  const bwDiff   = +((m.m17_bust_arc - m.m19_waist_arc) * 2).toFixed(3)
  const dartWidth = +((m.m19_waist_arc + 0.25) - m.m20_dart_placement).toFixed(3)

  const pt = (p: Pt) => ({ x: +p.x.toFixed(4), y: +p.y.toFixed(4) })

  const formulaRows = [
    // Ch.2 — Measurement conversion
    {
      ch: 'Ch.2', ref: 'm17',
      zh: '胸弧（半胸圍）', en: 'Half Bust Arc',
      formula: 'bust ÷ 2',
      val_in: m.m17_bust_arc,
      val_mm: Math.round(m.m17_bust_arc * 25.4),
      note: `full bust = ${+(m.m17_bust_arc * 2).toFixed(2)}"`,
    },
    {
      ch: 'Ch.2', ref: 'm19',
      zh: '腰弧（半腰圍）', en: 'Half Waist Arc',
      formula: 'waist ÷ 2',
      val_in: m.m19_waist_arc,
      val_mm: Math.round(m.m19_waist_arc * 25.4),
      note: `full waist = ${+(m.m19_waist_arc * 2).toFixed(2)}"`,
    },
    {
      ch: 'Ch.2', ref: 'hip_arc',
      zh: '臀弧（半臀圍）', en: 'Half Hip Arc',
      formula: 'hips ÷ 2',
      val_in: m.hip_arc,
      val_mm: Math.round(m.hip_arc * 25.4),
      note: `full hips = ${+(m.hip_arc * 2).toFixed(2)}"`,
    },
    {
      ch: 'Ch.2', ref: 'cb_length',
      zh: '後長 CB', en: 'CB Length',
      formula: 'HPS → waist (back)',
      val_in: m.cb_length,
      val_mm: Math.round(m.cb_length * 25.4),
      note: 'Center back neck to natural waist',
    },
    {
      ch: 'Ch.2', ref: 'm14',
      zh: '肩寬（全肩寬）', en: 'Across Shoulder',
      formula: 'shoulderWidth (full)',
      val_in: m.m14_across_shoulder,
      val_mm: Math.round(m.m14_across_shoulder * 25.4),
      note: 'Back across shoulder width',
    },
    // Ch.3 Front bodice points
    {
      ch: 'Ch.3 p.40', ref: 'Pt A',
      zh: 'A: 前中心頂', en: 'A: CF Top',
      formula: 'm6 + 1/8"',
      val_in: +fb.A.y.toFixed(3),
      val_mm: Math.round(fb.A.y * 25.4),
      note: `CF vertical height = ${+fb.A.y.toFixed(3)}" above waist`,
    },
    {
      ch: 'Ch.3 p.40', ref: 'Pt D',
      zh: 'D: 前頸點 (CF neck)', en: 'D: CF Neck',
      formula: 'B to D = m5_cf_length',
      val_in: +fb.D.y.toFixed(3),
      val_mm: Math.round(fb.D.y * 25.4),
      note: `y = ${+fb.D.y.toFixed(3)}" above waist`,
    },
    {
      ch: 'Ch.3 p.40', ref: 'Pt G',
      zh: 'G: 肩斜點', en: 'G: Shoulder Slope',
      formula: 'm7 + 1/8" from waist',
      val_in: +fb.G.y.toFixed(3),
      val_mm: Math.round(fb.G.y * 25.4),
      note: `y = ${+fb.G.y.toFixed(3)}" above waist on C vertical`,
    },
    {
      ch: 'Ch.3 p.40', ref: 'Pt E',
      zh: 'E: 胸弧腰線端', en: 'E: Bust Arc at Waist',
      formula: 'm17 + 1/4" ease',
      val_in: +fb.E.x.toFixed(3),
      val_mm: Math.round(fb.E.x * 25.4),
      note: `x = ${+fb.E.x.toFixed(3)}" from CF`,
    },
    {
      ch: 'Ch.3 p.41', ref: 'Pt J',
      zh: 'J: 胸高點', en: 'J: Bust Point',
      formula: 'm10 + 1/4" from CF',
      val_in: +fb.J.x.toFixed(3),
      val_mm: Math.round(fb.J.x * 25.4),
      note: `x=${+fb.J.x.toFixed(3)}"  y=${+fb.J.y.toFixed(3)}"`,
    },
    {
      ch: 'Ch.3 p.41', ref: 'Pt N',
      zh: 'N: 袖窿底/脇底', en: 'N: Underarm (Strap)',
      formula: 'E.x,  G.y − 1/2"',
      val_in: +fb.N.x.toFixed(3),
      val_mm: Math.round(fb.N.x * 25.4),
      note: `x=${+fb.N.x.toFixed(3)}"  y=${+fb.N.y.toFixed(3)}"`,
    },
    {
      ch: 'Ch.3 p.41', ref: 'dart_width',
      zh: '前腰省量', en: 'Front Dart Width',
      formula: '(m19 + 1/4") − m20',
      val_in: dartWidth,
      val_mm: Math.round(dartWidth * 25.4),
      note: `F→Q at waist: ${+fb.F.x.toFixed(3)}" to ${+fb.Q.x.toFixed(3)}"`,
    },
    {
      ch: 'Ch.3 p.40', ref: 'Pt P',
      zh: 'P: 腰側點', en: 'P: Waist Side',
      formula: 'N.x + 1-1/4" at waist',
      val_in: +fb.P.x.toFixed(3),
      val_mm: Math.round(fb.P.x * 25.4),
      note: `Side seam waist = ${+fb.P.x.toFixed(3)}" from CF`,
    },
    // Ch.3 Back bodice
    {
      ch: 'Ch.3 p.42', ref: 'back_A',
      zh: '後CB頂', en: 'Back CB Top',
      formula: 'CB + 1/8"',
      val_in: +bb.A.y.toFixed(3),
      val_mm: Math.round(bb.A.y * 25.4),
      note: `CB height = ${+bb.A.y.toFixed(3)}" above waist`,
    },
    {
      ch: 'Ch.3 p.42', ref: 'back_nk',
      zh: '後頸寬 / 深', en: 'Back Neck W / D',
      formula: 'W = 3-1/4"  D = 7/8"',
      val_in: bb.nk_width,
      val_mm: Math.round(bb.nk_width * 25.4),
      note: `Width ${bb.nk_width}"  Depth ${bb.nk_depth}"`,
    },
    {
      ch: 'Ch.3 p.42', ref: 'back_shld_dart',
      zh: '後肩省量', en: 'Back Shoulder Dart',
      formula: '(m14/2 − m16) × 0.5',
      val_in: +bb.shoulder_dart.toFixed(3),
      val_mm: Math.round(bb.shoulder_dart * 25.4),
      note: 'Pinch at shoulder seam toward armhole',
    },
    // Fit QC
    {
      ch: 'Armstrong p.44', ref: 'BW_diff',
      zh: '胸腰差（省道依據）', en: 'Bust-Waist Diff',
      formula: '(m17 − m19) × 2',
      val_in: bwDiff,
      val_mm: Math.round(bwDiff * 25.4),
      note: `Standard 10" ±3/8". ${Math.abs(bwDiff - 10) > 0.375 ? '⚠ Adjust dart per p.44.' : '✓ Within tolerance.'}`,
      warning: Math.abs(bwDiff - 10) > 0.375,
    },
  ]

  return {
    armstrong_measurements: {
      m5_cf_length:        m.m5_cf_length,
      m6_full_length:      m.m6_full_length,
      m7_shoulder_slope:   m.m7_shoulder_slope,
      m9_bust_depth:       m.m9_bust_depth,
      m10_bust_span:       m.m10_bust_span,
      m11_side_length:     m.m11_side_length,
      m13_shoulder_len:    m.m13_shoulder_len,
      m14_across_shoulder: m.m14_across_shoulder,
      m15_across_chest:    m.m15_across_chest,
      m16_across_back:     m.m16_across_back,
      m17_bust_arc:        m.m17_bust_arc,
      m18_back_arc:        m.m18_back_arc,
      m19_waist_arc:       m.m19_waist_arc,
      m20_dart_placement:  m.m20_dart_placement,
      hip_arc:             m.hip_arc,
      hip_depth:           m.hip_depth,
      cb_length:           m.cb_length,
    },
    formula_rows: formulaRows,
    front_points: {
      A: pt(fb.A), B: pt(fb.B), C: pt(fb.C), D: pt(fb.D),
      E: pt(fb.E), G: pt(fb.G), H: pt(fb.H), I: pt(fb.I),
      J: pt(fb.J), K: pt(fb.K), N: pt(fb.N), O: pt(fb.O),
      P: pt(fb.P), F: pt(fb.F), Q: pt(fb.Q),
      dart_pt: pt(fb.dart_pt),
    },
    back_points: {
      A: pt(bb.A), B: pt(bb.B), E: pt(bb.E),
      G: pt(bb.G), I: pt(bb.I),
      nk_width: bb.nk_width,
      nk_depth: bb.nk_depth,
    },
    warnings: fb.warnings,
    bw_diff:  bwDiff,
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id') ?? DEV_USER_ID

  // ── Get measurements from local storage ──────────────────────────────────
  let measurements: Record<string, number> | null = null

  const indexPath = path.join(PROFILES_DIR, `user-${userId}.json`)
  const profileIds = readJson<string[]>(indexPath)

  if (profileIds && profileIds.length > 0) {
    const latestId = profileIds[profileIds.length - 1]
    const profile  = readJson<Profile>(path.join(PROFILES_DIR, `${latestId}.json`))
    if (profile?.measurements?.chest && profile.measurements.waist) {
      measurements = profile.measurements
    }
  }

  if (!measurements) {
    const devProfile = userId === DEV_USER_ID
      ? ensureDevProfile()
      : readJson<Profile>(path.join(PROFILES_DIR, `${DEV_PROFILE_ID}.json`))
    if (devProfile?.measurements?.chest) {
      measurements = devProfile.measurements
    }
  }

  if (!measurements) {
    return NextResponse.json(
      { detail: 'No body profile with measurements found for this user' },
      { status: 404 },
    )
  }

  // ── Try FastAPI first (if available) ─────────────────────────────────────
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)  // 2s timeout
    try {
      const res = await fetch(`${FASTAPI_BASE}/armstrong/compute`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ measurements }),
        cache:   'no-store',
        signal:  controller.signal,
      })
      if (res.ok) {
        clearTimeout(timeout)
        return NextResponse.json(await res.json())
      }
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    // FastAPI unavailable — fall through to inline computation
  }

  // ── Inline computation (TypeScript port of armstrong_calc.py) ────────────
  try {
    const result = computeFormulaTable(measurements)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { detail: `Armstrong draft error: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
