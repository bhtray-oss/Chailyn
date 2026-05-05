/**
 * GET /api/subscriptions/status
 * Proxies to FastAPI /subscriptions/status — forwards Authorization header.
 */
import { NextRequest, NextResponse } from 'next/server'

const FASTAPI = process.env.FASTAPI_URL ?? 'http://localhost:8000'

export async function GET(req: NextRequest) {
  const authorization = req.headers.get('authorization')
  if (!authorization) {
    return NextResponse.json({ detail: 'No authorization header' }, { status: 401 })
  }

  const upstream = await fetch(`${FASTAPI}/subscriptions/status`, {
    headers: { Authorization: authorization },
  }).catch(() => null)

  if (!upstream) {
    return NextResponse.json({ detail: 'Service unavailable' }, { status: 503 })
  }

  const data = await upstream.json()
  return NextResponse.json(data, { status: upstream.status })
}
