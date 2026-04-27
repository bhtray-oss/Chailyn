/**
 * GET  /api/analyses/jobs/[jobId]  — 輪詢 Job 狀態
 * DELETE /api/analyses/jobs/[jobId] — 刪除 Job 記錄
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { JOBS_DIR, readJson, deleteFile } from '@/lib/storage'

interface Params { params: { jobId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const jobPath = path.join(JOBS_DIR, `${params.jobId}.json`)
  const job = readJson(jobPath)
  if (!job) return NextResponse.json({ error: '找不到 Job' }, { status: 404 })
  return NextResponse.json(job)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const url    = new URL(req.url)
  const userId = url.searchParams.get('user_id')

  const jobPath = path.join(JOBS_DIR, `${params.jobId}.json`)
  const job = readJson<{ user_id: string }>(jobPath)
  if (!job) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })
  if (userId && job.user_id !== userId) {
    return NextResponse.json({ error: '無權限刪除' }, { status: 403 })
  }

  deleteFile(jobPath)
  return NextResponse.json({ deleted: params.jobId })
}
