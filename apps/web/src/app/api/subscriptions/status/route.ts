/**
 * GET /api/subscriptions/status
 *
 * Returns subscription status. In standalone mode (FastAPI offline),
 * decodes the JWT locally and returns the tier from the token payload.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/standaloneAuth'

const FASTAPI = process.env.FASTAPI_URL ?? 'http://localhost:8000'

export async function GET(req: NextRequest) {
  const authorization = req.headers.get('authorization')
  if (!authorization) {
    return NextResponse.json({ detail: 'No authorization header' }, { status: 401 })
  }

  // ── Try FastAPI first (2s timeout) ────────────────────────────────────────
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2000)
    try {
      const upstream = await fetch(`${FASTAPI}/subscriptions/status`, {
        headers: { Authorization: authorization },
        signal:  ctrl.signal,
      })
      clearTimeout(timer)
      if (upstream.ok) {
        return NextResponse.json(await upstream.json())
      }
    } finally {
      clearTimeout(timer)
    }
  } catch { /* FastAPI offline */ }

  // ── Standalone fallback: decode JWT for tier ──────────────────────────────
  const token   = authorization.replace(/^Bearer\s+/i, '')
  const payload = verifyJwt(token)

  if (!payload?.sub) {
    return NextResponse.json({ detail: 'Invalid or expired token' }, { status: 401 })
  }

  const tier = (payload.subscription_tier as string) ?? 'free'
  return NextResponse.json({
    user_id:           payload.sub,
    subscription_tier: tier,
    is_pro:            tier === 'pro',
    features: {
      unlimited_drafts:  tier === 'pro',
      dxf_export:        tier === 'pro',
      pattern_history:   true,
      ai_analysis:       tier === 'pro',
    },
  })
}
