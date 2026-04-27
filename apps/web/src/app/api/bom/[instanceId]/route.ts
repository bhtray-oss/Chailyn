/**
 * GET  /api/bom/[instanceId] — 取得材料清單（BOM）
 * POST /api/bom/[instanceId]/generate — 自動產生 BOM（stub）
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { PATTERNS_DIR, readJson } from '@/lib/storage'

interface Params { params: { instanceId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const instance = readJson<{ design: string }>(
    path.join(PATTERNS_DIR, `${params.instanceId}.json`)
  )
  if (!instance) return NextResponse.json({ detail: '找不到版型' }, { status: 404 })

  // 回傳空的 BOM（單機版簡化）
  return NextResponse.json({ instance_id: params.instanceId, groups: {}, total: 0 })
}
