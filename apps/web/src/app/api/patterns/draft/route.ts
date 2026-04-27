/**
 * POST /api/patterns/draft — 打版並回傳 SVG / renderProps
 * 同時儲存 pattern instance 到 ~/.chailyn/standalone/patterns/
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { PROFILES_DIR, PATTERNS_DIR, readJson, writeJson, ensureDevProfile, DEV_PROFILE_ID } from '@/lib/storage'
import { draftPattern, fillMeasurements } from '@/lib/freesewing-draft'
import type { Profile } from '@/lib/storage'

interface DraftRequest {
  user_id:          string
  design:           string
  body_profile_id:  string
  options?:         Record<string, unknown>
  sa?:              number
  paperless?:       boolean
  render_mode?:     'svg' | 'props'
  gender?:          string
  title?:           string
  notes?:           string
  ai_source_photo_id?: string
  ai_confidence?:   number
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as DraftRequest
  const {
    user_id,
    design,
    body_profile_id,
    options     = {},
    sa          = 10,
    paperless   = false,
    render_mode = 'svg',
    gender      = 'cisFemale',
    title,
    notes,
    ai_source_photo_id,
    ai_confidence,
  } = body

  if (!design) return NextResponse.json({ detail: 'design 為必填' }, { status: 400 })

  // 讀取 body profile
  let profile: Profile | null = null
  if (body_profile_id === DEV_PROFILE_ID) {
    profile = ensureDevProfile()
  } else {
    profile = readJson<Profile>(path.join(PROFILES_DIR, `${body_profile_id}.json`))
  }

  if (!profile) {
    return NextResponse.json({ detail: `找不到 body profile: ${body_profile_id}` }, { status: 404 })
  }

  const rawMeasurements = { ...profile.measurements, ...profile.derived_measurements }
  const measurements   = await fillMeasurements(rawMeasurements, gender)

  try {
    const result = await draftPattern({
      design,
      measurements,
      options,
      sa,
      paperless,
      renderMode: render_mode,
      gender,
    })

    // 儲存 pattern instance
    const instanceId = uuidv4()
    const now        = new Date().toISOString()
    const instanceData = {
      id:                  instanceId,
      user_id,
      design,
      version:             1,
      parent_instance_id:  null,
      title:               title ?? null,
      notes:               notes ?? null,
      options_snapshot:    { ...options, sa, paperless, gender },
      sa,
      paperless,
      created_at:          now,
      body_profile_id,
      created_by_ai:       !!ai_source_photo_id,
      ai_confidence:       ai_confidence ?? null,
      has_svg:             render_mode === 'svg',
      svg_data:            render_mode === 'svg' ? (result as { svg: string }).svg : null,
    }
    writeJson(path.join(PATTERNS_DIR, `${instanceId}.json`), instanceData)

    return NextResponse.json({
      ok:          true,
      instance_id: instanceId,
      design,
      ...result,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ detail: msg }, { status: 422 })
  }
}
