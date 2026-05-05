/**
 * POST /api/auth/logout
 * Reads HttpOnly refresh token cookie → calls FastAPI /auth/logout
 * → clears the chailyn_rt cookie regardless of upstream result.
 */
import { NextRequest, NextResponse } from 'next/server'

const FASTAPI  = process.env.FASTAPI_URL ?? 'http://localhost:8000'
const IS_PROD  = process.env.NODE_ENV === 'production'

export async function POST(req: NextRequest) {
  const rt = req.cookies.get('chailyn_rt')?.value

  // Best-effort: revoke on backend (ignore errors)
  if (rt) {
    await fetch(`${FASTAPI}/auth/logout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: rt }),
    }).catch(() => null)
  }

  // Always clear the cookie
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
