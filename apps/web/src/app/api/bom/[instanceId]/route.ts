/**
 * GET /api/bom/[instanceId] — 取得材料清單（BOM）
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { PATTERNS_DIR, BOM_DIR, readJson } from '@/lib/storage'

interface Params { params: { instanceId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const instance = readJson<{ design: string }>(
    path.join(PATTERNS_DIR, `${params.instanceId}.json`)
  )
  if (!instance) return NextResponse.json({ detail: '找不到版型' }, { status: 404 })

  // 讀取已儲存的 BOM，若不存在則回傳空
  const stored = readJson<{ groups: Record<string, unknown[]>; total: number }>(
    path.join(BOM_DIR, `${params.instanceId}.json`)
  )
  if (stored) {
    return NextResponse.json({ instance_id: params.instanceId, ...stored })
  }

  return NextResponse.json({ instance_id: params.instanceId, groups: {}, total: 0 })
}
