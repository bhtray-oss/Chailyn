/**
 * GET /api/patterns/history/[instanceId] — 版型版本鏈
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { PATTERNS_DIR, readJson } from '@/lib/storage'

interface Params { params: { instanceId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const seed = readJson<Record<string, unknown>>(
    path.join(PATTERNS_DIR, `${params.instanceId}.json`)
  )
  if (!seed) return NextResponse.json({ detail: '找不到版型' }, { status: 404 })

  // 收集完整版本鏈（往上追 parent）
  const chain: Record<string, unknown>[] = []
  let current: Record<string, unknown> | null = seed
  while (current) {
    chain.unshift(current)
    const parentId = current.parent_instance_id as string | null
    current = parentId
      ? readJson<Record<string, unknown>>(path.join(PATTERNS_DIR, `${parentId}.json`))
      : null
  }

  return NextResponse.json({
    design:   seed.design,
    user_id:  seed.user_id,
    versions: chain.map(v => ({
      id:                  v.id,
      version:             v.version,
      title:               v.title,
      notes:               v.notes,
      sa:                  v.sa,
      paperless:           v.paperless,
      options_snapshot:    v.options_snapshot,
      created_at:          v.created_at,
      parent_instance_id:  v.parent_instance_id,
      has_svg:             v.has_svg,
    })),
  })
}
