/**
 * GET /api/armstrong/draft?user_id=<uuid>
 *
 * Fetches the user's body profile from local file storage,
 * then proxies to FastAPI /armstrong/draft which runs the real
 * armstrong_bodice.py draft engine and returns the formula table.
 *
 * Falls back to default DEV measurements if profile not found.
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { PROFILES_DIR, DEV_USER_ID, DEV_PROFILE_ID, readJson, ensureDevProfile } from '@/lib/storage'
import type { Profile } from '@/lib/storage'

const FASTAPI_BASE = process.env.FASTAPI_URL ?? 'http://localhost:8000'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id') ?? DEV_USER_ID

  // ── Get user's profile from local storage ─────────────────────────────────
  let measurements: Record<string, number> | null = null

  // Try user index to find their latest profile id
  const indexPath = path.join(PROFILES_DIR, `user-${userId}.json`)
  const profileIds = readJson<string[]>(indexPath)

  if (profileIds && profileIds.length > 0) {
    // last in index = most recently added
    const latestId = profileIds[profileIds.length - 1]
    const profile  = readJson<Profile>(path.join(PROFILES_DIR, `${latestId}.json`))
    if (profile?.measurements?.chest && profile.measurements.waist) {
      measurements = profile.measurements
    }
  }

  // Fallback: try DEV_PROFILE_ID directly
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

  // ── Proxy to FastAPI armstrong engine ─────────────────────────────────────
  try {
    const upstream = await fetch(
      `${FASTAPI_BASE}/armstrong/draft?user_id=${userId}`,
      { headers: { 'Content-Type': 'application/json' }, cache: 'no-store' },
    )

    if (upstream.ok) {
      const data = await upstream.json()
      return NextResponse.json(data)
    }

    // FastAPI returned error — compute inline using measurements we already have
    // (this handles the case where FastAPI DB doesn't have this user's profile
    //  but the local storage does)
    const inlineRes = await fetch(`${FASTAPI_BASE}/armstrong/compute`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ measurements }),
      cache:   'no-store',
    })

    if (inlineRes.ok) {
      return NextResponse.json(await inlineRes.json())
    }

    // If FastAPI compute also fails, return its error
    const err = await inlineRes.json().catch(() => ({ detail: inlineRes.statusText }))
    return NextResponse.json(err, { status: inlineRes.status })

  } catch (e) {
    return NextResponse.json(
      { detail: `Armstrong service unavailable: ${e instanceof Error ? e.message : String(e)}` },
      { status: 503 },
    )
  }
}
