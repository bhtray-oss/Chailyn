/**
 * GET /api/auth/me
 *
 * Decodes the Bearer JWT locally (standalone).
 * Falls back to FastAPI if available and token looks like a remote token.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt, findUserById } from '@/lib/standaloneAuth'

const FASTAPI = process.env.FASTAPI_URL ?? 'http://localhost:8000'

export async function GET(req: NextRequest) {
  const authorization = req.headers.get('authorization')
  if (!authorization) {
    return NextResponse.json({ detail: 'No authorization header' }, { status: 401 })
  }

  const token = authorization.replace(/^Bearer\s+/i, '')

  // ── Try to verify locally first ───────────────────────────────────────────
  const payload = verifyJwt(token)
  if (payload?.sub) {
    const user = findUserById(payload.sub)
    if (user) {
      return NextResponse.json({
        id:               user.id,
        email:            user.email,
        display_name:     user.display_name,
        role:             user.role,
        subscription_tier: user.subscription_tier,
      })
    }
  }

  // ── Fall back to FastAPI (2s timeout) ─────────────────────────────────────
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2000)
    try {
      const upstream = await fetch(`${FASTAPI}/auth/me`, {
        headers: { Authorization: authorization },
        signal:  ctrl.signal,
      })
      clearTimeout(timer)
      if (upstream.ok) {
        return NextResponse.json(await upstream.json())
      }
      return NextResponse.json(await upstream.json(), { status: upstream.status })
    } finally {
      clearTimeout(timer)
    }
  } catch { /* FastAPI offline */ }

  return NextResponse.json({ detail: 'Invalid or expired token' }, { status: 401 })
}
