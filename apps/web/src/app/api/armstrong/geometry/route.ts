/**
 * POST /api/armstrong/geometry
 * Proxies to FastAPI /armstrong/geometry
 * Accepts: { measurements, waistband_width?, pocket_opening? }
 * Returns: full pattern geometry result (serialized CompletePatternResult)
 */
import { NextRequest, NextResponse } from 'next/server'

const FASTAPI = process.env.FASTAPI_URL ?? 'http://localhost:8000'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const upstream = await fetch(`${FASTAPI}/armstrong/geometry`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).catch(() => null)

  if (!upstream) {
    return NextResponse.json({ detail: 'Pattern engine unavailable' }, { status: 503 })
  }

  const data = await upstream.json()
  return NextResponse.json(data, { status: upstream.status })
}
