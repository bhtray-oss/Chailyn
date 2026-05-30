/**
 * GET /api/analyses/[analysisId]
 *
 * Returns the stored analysis result for a given analysis_id.
 * Reads from standalone file storage (~/.chailyn/standalone/jobs/).
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { JOBS_DIR, readJson } from '@/lib/storage'
import fs from 'fs'

function findJobByAnalysisId(analysisId: string): unknown | null {
  try {
    const files = fs.readdirSync(JOBS_DIR).filter(f => f.endsWith('.json'))
    for (const file of files) {
      const job = readJson<Record<string, unknown>>(path.join(JOBS_DIR, file))
      if (job?.analysis_id === analysisId && job.status === 'done') {
        return job.result
      }
    }
  } catch { /* dir may not exist */ }
  return null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { analysisId: string } },
) {
  const { analysisId } = params
  const result = findJobByAnalysisId(analysisId)
  if (!result) {
    return NextResponse.json(
      { detail: `找不到分析結果: ${analysisId}` },
      { status: 404 },
    )
  }
  return NextResponse.json(result)
}
