/**
 * GET /api/auth/me
 * Proxies to FastAPI /auth/me — forwards the Bearer token from the client.
 */
import { NextRequest, NextResponse } from 'next/server'

const FASTAPI = process.env.FASTAPI_URL ?? 'http://localhost:8000'

export async function GET(req: NextRequest) {
  const authorization = req.headers.get('authorization')
  if (!authorization) {
    return NextResponse.json({ detail: 'No authorization header' }, { status: 401 })
  }

  const upstream = await fetch(`${FASTAPI}/auth/me`, {
    headers: { Authorization: authorization },
  }).catch(() => null)

  if (!upstream) {
    return NextResponse.json({ detail: 'Auth service unavailable' }, { status: 503 })
  }

  const data = await upstream.json()
  return NextResponse.json(data, { status: upstream.status })
}
