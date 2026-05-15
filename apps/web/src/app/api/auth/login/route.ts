/**
 * POST /api/auth/login
 *
 * Standalone mode: validates credentials against local file storage,
 * issues HS256 JWT tokens without requiring FastAPI.
 * Tries FastAPI first (2s timeout) then falls back to inline auth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { validateCredentials, issueTokens } from '@/lib/standaloneAuth'

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
  const body = await req.json()
  const { email, password } = body ?? {}

  if (!email || !password) {
    return NextResponse.json({ detail: 'Email and password are required' }, { status: 422 })
  }

  // ── Try FastAPI first (optional, 2s timeout) ──────────────────────────────
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2000)
    try {
      const upstream = await fetch(`${FASTAPI}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
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
      if (upstream.status === 401) {
        return NextResponse.json(await upstream.json(), { status: 401 })
      }
    } finally {
      clearTimeout(timer)
    }
  } catch { /* FastAPI offline — fall through */ }

  // ── Standalone auth ───────────────────────────────────────────────────────
  const user = validateCredentials(email.trim().toLowerCase(), password)
  if (!user) {
    return NextResponse.json({ detail: 'Incorrect email or password' }, { status: 401 })
  }

  const { refresh_token, ...rest } = issueTokens(user)
  const res = NextResponse.json(rest)
  res.cookies.set('chailyn_rt', refresh_token, COOKIE_OPTS)
  return res
}
