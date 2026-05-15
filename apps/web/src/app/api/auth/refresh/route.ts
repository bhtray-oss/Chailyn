/**
 * POST /api/auth/refresh
 *
 * Reads HttpOnly refresh token cookie → verifies locally signed JWT
 * → issues new access + refresh tokens (rotation).
 * Falls back to FastAPI refresh if available.
 */
import { NextRequest, NextResponse } from 'next/server'
import { refreshTokens } from '@/lib/standaloneAuth'

const FASTAPI = process.env.FASTAPI_URL ?? 'http://localhost:8000'
const IS_PROD = process.env.NODE_ENV === 'production'

const COOKIE_OPTS = {
  httpOnly:  true,
  secure:    IS_PROD,
  sameSite:  'lax' as const,
  path:      '/api/auth',
  maxAge:    60 * 60 * 24 * 30,
}

export async function POST(req: NextRequest) {
  const rt = req.cookies.get('chailyn_rt')?.value
  if (!rt) {
    return NextResponse.json({ detail: 'No refresh token' }, { status: 401 })
  }

  // ── Try FastAPI first (optional, 2s timeout) ──────────────────────────────
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2000)
    try {
      const upstream = await fetch(`${FASTAPI}/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh_token: rt }),
        signal:  ctrl.signal,
      })
      clearTimeout(timer)
      if (upstream.ok) {
        const data = await upstream.json()
        const { refresh_token, ...rest } = data
        const res = NextResponse.json(rest)
        if (refresh_token) res.cookies.set('chailyn_rt', refresh_token, COOKIE_OPTS)
        return res
      }
    } finally {
      clearTimeout(timer)
    }
  } catch { /* FastAPI offline — fall through */ }

  // ── Standalone token refresh ──────────────────────────────────────────────
  const result = refreshTokens(rt)
  if (!result) {
    // Token expired or invalid — clear cookie
    const res = NextResponse.json({ detail: 'Refresh token expired or invalid' }, { status: 401 })
    res.cookies.set('chailyn_rt', '', { ...COOKIE_OPTS, maxAge: 0 })
    return res
  }

  const { refresh_token, ...rest } = result
  const res = NextResponse.json(rest)
  res.cookies.set('chailyn_rt', refresh_token, COOKIE_OPTS)
  return res
}
