/**
 * POST /api/auth/register
 * Proxies to FastAPI /auth/register and sets HttpOnly refresh token cookie.
 */
import { NextRequest, NextResponse } from 'next/server'

const FASTAPI = process.env.FASTAPI_URL ?? 'http://localhost:8000'
const IS_PROD = process.env.NODE_ENV === 'production'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const upstream = await fetch(`${FASTAPI}/auth/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).catch(() => null)

  if (!upstream) {
    return NextResponse.json({ detail: 'Auth service unavailable' }, { status: 503 })
  }

  const data = await upstream.json()
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status })
  }

  const { refresh_token, ...rest } = data

  const res = NextResponse.json(rest, { status: 201 })
  res.cookies.set('chailyn_rt', refresh_token, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'lax',
    path:     '/api/auth',
    maxAge:   60 * 60 * 24 * 30,
  })
  return res
}
