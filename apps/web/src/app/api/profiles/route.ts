/**
 * POST /api/profiles/ — 建立新的 body profile
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { PROFILES_DIR, readJson, writeJson } from '@/lib/storage'
import type { Profile } from '@/lib/storage'

interface CreateRequest {
  user_id:      string
  label:        string
  measurements: Record<string, number>
  notes?:       string | null
}

export async function POST(req: NextRequest) {
  const { user_id, label, measurements, notes } = (await req.json()) as CreateRequest
  if (!user_id || !measurements) {
    return NextResponse.json({ detail: '缺少必要欄位' }, { status: 400 })
  }

  const derived: Record<string, number> = {}
  if (measurements.chest)   derived.halfChest    = measurements.chest / 2
  if (measurements.chest)   derived.quarterChest = measurements.chest / 4
  if (measurements.waist)   derived.halfWaist    = measurements.waist / 2
  if (measurements.hips)    derived.halfHips     = measurements.hips  / 2
  if (measurements.chest && measurements.highBust)
    derived.bustSpan = measurements.chest - measurements.highBust

  const id  = uuidv4()
  const now = new Date().toISOString()
  const profile: Profile = {
    id, user_id, label, version: 1, parent_id: null,
    measurements, derived_measurements: derived,
    notes: notes ?? null, created_at: now, updated_at: now,
  }

  writeJson(path.join(PROFILES_DIR, `${id}.json`), profile)

  // 更新 user→profiles 索引
  const indexPath  = path.join(PROFILES_DIR, `user-${user_id}.json`)
  const existing   = readJson<string[]>(indexPath) ?? []
  writeJson(indexPath, [...existing, id])

  return NextResponse.json({ profile_id: id })
}
