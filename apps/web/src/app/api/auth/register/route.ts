/**
 * POST /api/auth/register
 *
 * Standalone mode: creates a new user in local file storage,
 * issues HS256 JWT tokens without requiring FastAPI.
 * Tries FastAPI first (2s timeout) then falls back to inline creation.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createUser, issueTokens } from '@/lib/standaloneAuth'

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
  const { email, password, display_name } = body ?? {}

  if (!email || !password) {
    return NextResponse.json({ detail: 'Email and password are required' }, { status: 422 })
  }

  // ── Try FastAPI first (optional, 2s timeout) ──────────────────────────────
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2000)
    try {
      const upstream = await fetch(`${FASTAPI}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  ctrl.signal,
      })
      clearTimeout(timer)
      if (upstream.ok) {
        const data = await upstream.json()
        const { refresh_token, ...rest } = data
        const res = NextResponse.json(rest, { status: 201 })
        if (refresh_token) res.cookies.set('chailyn_rt', refresh_token, COOKIE_OPTS)
        return res
      }
      if (upstream.status === 409) {
        return NextResponse.json(await upstream.json(), { status: 409 })
      }
    } finally {
      clearTimeout(timer)
    }
  } catch { /* FastAPI offline — fall through */ }

  // ── Standalone registration ───────────────────────────────────────────────
  try {
    const user = createUser(
      email.trim().toLowerCase(),
      password,
      display_name?.trim() || email.split('@')[0],
    )
    const { refresh_token, ...rest } = issueTokens(user)
    const res = NextResponse.json(rest, { status: 201 })
    res.cookies.set('chailyn_rt', refresh_token, COOKIE_OPTS)
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status = msg.toLowerCase().includes('already') ? 409 : 400
    return NextResponse.json({ detail: msg }, { status })
  }
}
