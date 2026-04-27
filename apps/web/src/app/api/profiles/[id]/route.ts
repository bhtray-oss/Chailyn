/**
 * GET   /api/profiles/[id] — 取得使用者的 profile 列表（id = userId）
 * PATCH /api/profiles/[id] — 更新 profile（id = profileId），建立新版本
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import {
  PROFILES_DIR, readJson, writeJson,
  ensureDevProfile, DEV_USER_ID, DEV_PROFILE_ID,
} from '@/lib/storage'
import type { Profile } from '@/lib/storage'

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = params.id

  // dev user
  if (userId === DEV_USER_ID) {
    const profile = ensureDevProfile()
    return NextResponse.json([profile])
  }

  const indexPath = path.join(PROFILES_DIR, `user-${userId}.json`)
  const ids       = readJson<string[]>(indexPath) ?? []

  // Return only leaf profiles (not pointed to by any other profile's parent_id)
  const profiles = ids
    .map(id => readJson<Profile>(path.join(PROFILES_DIR, `${id}.json`)))
    .filter(Boolean) as Profile[]

  const parentIds = new Set(profiles.map(p => p.parent_id).filter(Boolean))
  const leaves    = profiles.filter(p => !parentIds.has(p.id))

  return NextResponse.json(leaves)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const profileId = params.id
  const { measurements, notes, label } = await req.json() as {
    measurements?: Record<string, number>
    notes?: string | null
    label?: string | null
  }

  const oldPath = profileId === DEV_PROFILE_ID
    ? path.join(PROFILES_DIR, `${DEV_PROFILE_ID}.json`)
    : path.join(PROFILES_DIR, `${profileId}.json`)

  const old = readJson<Profile>(oldPath)
  if (!old) return NextResponse.json({ detail: '找不到 profile' }, { status: 404 })

  const newMeasurements = measurements ?? old.measurements
  const derived: Record<string, number> = {}
  if (newMeasurements.chest)   derived.halfChest    = newMeasurements.chest / 2
  if (newMeasurements.chest)   derived.quarterChest = newMeasurements.chest / 4
  if (newMeasurements.waist)   derived.halfWaist    = newMeasurements.waist / 2
  if (newMeasurements.hips)    derived.halfHips     = newMeasurements.hips  / 2
  if (newMeasurements.chest && newMeasurements.highBust)
    derived.bustSpan = newMeasurements.chest - newMeasurements.highBust

  const newId  = uuidv4()
  const now    = new Date().toISOString()
  const newProfile: Profile = {
    ...old,
    id:                  newId,
    version:             old.version + 1,
    parent_id:           old.id,
    measurements:        newMeasurements,
    derived_measurements: derived,
    notes:               notes !== undefined ? (notes ?? null) : old.notes,
    label:               label !== undefined ? (label ?? old.label) : old.label,
    updated_at:          now,
    created_at:          now,
  }

  writeJson(path.join(PROFILES_DIR, `${newId}.json`), newProfile)

  // 更新 user index
  const indexPath  = path.join(PROFILES_DIR, `user-${old.user_id}.json`)
  const existing   = readJson<string[]>(indexPath) ?? []
  if (!existing.includes(newId)) {
    writeJson(indexPath, [...existing, newId])
  }

  return NextResponse.json({ new_profile_id: newId })
}
