/**
 * GET /api/patterns/user/[userId] — 衣櫃：該使用者所有版型（最新版本）
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { PATTERNS_DIR, readJson, listJsonFiles } from '@/lib/storage'

interface Params { params: { userId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const files = listJsonFiles(PATTERNS_DIR)

  const patterns = files
    .map(f => readJson<Record<string, unknown>>(path.join(PATTERNS_DIR, f)))
    .filter(p => p && p.user_id === params.userId)
    .sort((a, b) =>
      new Date(b!.created_at as string).getTime() -
      new Date(a!.created_at as string).getTime()
    )

  // 每個 design 只保留最新版本（total_versions 計算）
  const byDesign = new Map<string, (typeof patterns)[0][]>()
  for (const p of patterns) {
    const d = p!.design as string
    if (!byDesign.has(d)) byDesign.set(d, [])
    byDesign.get(d)!.push(p)
  }

  const result = Array.from(byDesign.values()).map(group => ({
    ...group[0],
    total_versions: group.length,
  }))

  return NextResponse.json(result)
}
