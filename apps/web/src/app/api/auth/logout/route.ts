/**
 * POST /api/auth/logout
 * Clears the HttpOnly refresh-token cookie.
 * Attempts best-effort revocation on FastAPI (ignored if offline).
 */
import { NextRequest, NextResponse } from 'next/server'

const FASTAPI = process.env.FASTAPI_URL ?? 'http://localhost:8000'
const IS_PROD = process.env.NODE_ENV === 'production'

export async function POST(req: NextRequest) {
  const rt = req.cookies.get('chailyn_rt')?.value

  // Best-effort: revoke on FastAPI (ignore errors)
  if (rt) {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 1500)
    await fetch(`${FASTAPI}/auth/logout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: rt }),
      signal:  ctrl.signal,
    }).catch(() => null)
  }

  // Always clear cookie
  const res = NextResponse.json({ ok: true })
  res.cookies.set('chailyn_rt', '', {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'lax',
    path:     '/api/auth',
    maxAge:   0,
  })
  return res
}
