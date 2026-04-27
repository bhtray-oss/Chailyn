/**
 * GET /api/profiles/detail/[profileId] — 取得單筆 profile 詳情
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { PROFILES_DIR, readJson, ensureDevProfile, DEV_PROFILE_ID } from '@/lib/storage'

interface Params { params: { profileId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  if (params.profileId === DEV_PROFILE_ID) {
    return NextResponse.json(ensureDevProfile())
  }

  const profile = readJson(path.join(PROFILES_DIR, `${params.profileId}.json`))
  if (!profile) return NextResponse.json({ detail: '找不到 profile' }, { status: 404 })
  return NextResponse.json(profile)
}
