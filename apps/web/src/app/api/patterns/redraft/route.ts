/**
 * POST /api/patterns/redraft — 重新打版（建立新版本）
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import {
  PATTERNS_DIR, PROFILES_DIR,
  readJson, writeJson,
  ensureDevProfile, DEV_PROFILE_ID,
} from '@/lib/storage'
import { draftPattern, fillMeasurements } from '@/lib/freesewing-draft'
import type { Profile } from '@/lib/storage'

interface RedraftRequest {
  instance_id:      string
  user_id:          string
  body_profile_id?: string
  options?:         Record<string, unknown>
  sa?:              number
  paperless?:       boolean
  render_mode?:     'svg' | 'props'
  gender?:          string
  title?:           string
  notes?:           string
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RedraftRequest
  const {
    instance_id, user_id, body_profile_id,
    options, sa, paperless, render_mode = 'svg', gender = 'cisFemale',
    title, notes,
  } = body

  const old = readJson<Record<string, unknown>>(
    path.join(PATTERNS_DIR, `${instance_id}.json`)
  )
  if (!old) return NextResponse.json({ detail: '找不到原始版型' }, { status: 404 })

  const profileId = body_profile_id ?? (old.body_profile_id as string)
  let profile: Profile | null =
    profileId === DEV_PROFILE_ID
      ? ensureDevProfile()
      : readJson<Profile>(path.join(PROFILES_DIR, `${profileId}.json`))

  if (!profile) return NextResponse.json({ detail: '找不到 body profile' }, { status: 404 })

  const rawMeasurements = { ...profile.measurements, ...profile.derived_measurements }
  const measurements    = await fillMeasurements(rawMeasurements, gender)
  const mergedOptions = { ...(old.options_snapshot as Record<string, unknown>), ...(options ?? {}) }
  const finalSa = sa ?? (old.sa as number) ?? 10
  const finalPaperless = paperless ?? (old.paperless as boolean) ?? false

  try {
    const result = await draftPattern({
      design:     old.design as string,
      measurements,
      options:    mergedOptions,
      sa:         finalSa,
      paperless:  finalPaperless,
      renderMode: render_mode,
      gender,
    })

    const newId  = uuidv4()
    const now    = new Date().toISOString()
    const newInstance = {
      id:                  newId,
      user_id,
      design:              old.design,
      version:             ((old.version as number) ?? 1) + 1,
      parent_instance_id:  instance_id,
      title:               title ?? null,
      notes:               notes ?? null,
      options_snapshot:    mergedOptions,
      sa:                  finalSa,
      paperless:           finalPaperless,
      created_at:          now,
      body_profile_id:     profileId,
      created_by_ai:       false,
      ai_confidence:       null,
      has_svg:             render_mode === 'svg',
      svg_data:            render_mode === 'svg' ? (result as { svg: string }).svg : null,
    }
    writeJson(path.join(PATTERNS_DIR, `${newId}.json`), newInstance)

    return NextResponse.json({ ok: true, instance_id: newId, design: old.design, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ detail: msg }, { status: 422 })
  }
}
