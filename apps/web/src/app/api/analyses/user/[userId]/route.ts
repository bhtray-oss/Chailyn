/**
 * GET /api/analyses/user/[userId] — 列出使用者所有已完成分析（最新在前）
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { JOBS_DIR, readJson, listJsonFiles } from '@/lib/storage'

interface Params { params: { userId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const files = listJsonFiles(JOBS_DIR)

  const jobs = files
    .map(f => readJson<Record<string, unknown>>(path.join(JOBS_DIR, f)))
    .filter(
      j => j && j.user_id === params.userId && j.status === 'done'
    )
    .sort((a, b) =>
      new Date(b!.created_at as string).getTime() -
      new Date(a!.created_at as string).getTime()
    )
    .slice(0, 100)

  return NextResponse.json(jobs)
}
