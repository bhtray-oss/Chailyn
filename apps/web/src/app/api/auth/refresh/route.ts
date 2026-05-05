/**
 * POST /api/auth/refresh
 * Reads HttpOnly refresh token cookie → calls FastAPI /auth/refresh
 * → issues new access token + rotated refresh token cookie.
 */
import { NextRequest, NextResponse } from 'next/server'

const FASTAPI = process.env.FASTAPI_URL ?? 'http://localhost:8000'
const IS_PROD = process.env.NODE_ENV === 'production'

export async function POST(req: NextRequest) {
  const rt = req.cookies.get('chailyn_rt')?.value
  if (!rt) {
    return NextResponse.json({ detail: 'No refresh token' }, { status: 401 })
  }

  const upstream = await fetch(`${FASTAPI}/auth/refresh`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ refresh_token: rt }),
  }).catch(() => null)

  if (!upstream) {
    return NextResponse.json({ detail: 'Auth service unavailable' }, { status: 503 })
  }

  const data = await upstream.json()
  if (!upstream.ok) {
    // Invalidate cookie on failure
    const res = NextResponse.json(data, { status: upstream.status })
    res.cookies.delete('chailyn_rt')
    return res
  }

  const { refresh_token, ...rest } = data
  const res = NextResponse.json(rest)
  res.cookies.set('chailyn_rt', refresh_token, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'lax',
    path:     '/api/auth',
    maxAge:   60 * 60 * 24 * 30,
  })
  return res
}
