/**
 * GET /api/patterns/[instanceId] — 取得單筆版型
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { PATTERNS_DIR, readJson } from '@/lib/storage'

interface Params { params: { instanceId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const data = readJson(path.join(PATTERNS_DIR, `${params.instanceId}.json`))
  if (!data) return NextResponse.json({ detail: '找不到版型' }, { status: 404 })
  return NextResponse.json(data)
}
