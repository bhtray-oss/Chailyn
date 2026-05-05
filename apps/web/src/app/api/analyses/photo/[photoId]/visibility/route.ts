/**
 * PATCH /api/analyses/photo/[photoId]/visibility
 * Toggle analysis visibility between 'public' and 'private'.
 * Finds the job file by photo_id and updates its visibility field.
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { JOBS_DIR, listJsonFiles, readJson, writeJson } from '@/lib/storage'

interface Params { params: { photoId: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const body = await req.json().catch(() => ({}))
  const visibility = body?.visibility as string | undefined

  if (visibility !== 'public' && visibility !== 'private') {
    return NextResponse.json(
      { error: "visibility must be 'public' or 'private'" },
      { status: 400 },
    )
  }

  // Find the job file whose photo_id matches
  const files = listJsonFiles(JOBS_DIR)
  const matchFile = files.find(f => {
    const job = readJson<Record<string, unknown>>(path.join(JOBS_DIR, f))
    return job?.photo_id === params.photoId
  })

  if (!matchFile) {
    return NextResponse.json({ error: '找不到照片記錄' }, { status: 404 })
  }

  const jobPath = path.join(JOBS_DIR, matchFile)
  const job = readJson<Record<string, unknown>>(jobPath)!
  writeJson(jobPath, { ...job, visibility })

  return NextResponse.json({ photo_id: params.photoId, visibility })
}
