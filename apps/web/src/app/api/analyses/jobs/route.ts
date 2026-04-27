/**
 * POST /api/analyses/jobs
 * 建立分析 Job → 同步執行 Claude Vision → 儲存結果 → 回傳 done
 *
 * 單機版簡化：直接在這個 request 內完成 AI 分析（約 15-45 秒），
 * 前端 polling 在收到回應後立即得到 "done" 狀態。
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import {
  UPLOADS_DIR, JOBS_DIR,
  readJson, writeJson, fileExists, readBytes,
} from '@/lib/storage'
import { analyzeGarmentPhoto } from '@/lib/claude-vision'

interface JobRequest {
  photo_id: string
  user_id:  string
}

export async function POST(req: NextRequest) {
  const { photo_id, user_id } = (await req.json()) as JobRequest
  if (!photo_id) return NextResponse.json({ error: '缺少 photo_id' }, { status: 400 })

  // 確認照片存在
  const photoPath = path.join(UPLOADS_DIR, photo_id)
  if (!fileExists(photoPath)) {
    return NextResponse.json({ error: '找不到照片，請重新上傳' }, { status: 404 })
  }

  // 讀取 mime type
  const meta = readJson<{ mimeType: string }>(path.join(UPLOADS_DIR, `${photo_id}.meta.json`))
  const mimeType = meta?.mimeType ?? 'image/jpeg'

  const jobId    = uuidv4()
  const jobPath  = path.join(JOBS_DIR, `${jobId}.json`)
  const now      = new Date().toISOString()

  // 寫入 pending 狀態
  writeJson(jobPath, {
    job_id:      jobId,
    user_id,
    photo_id,
    status:      'running',
    result:      null,
    error:       null,
    analysis_id: null,
    created_at:  now,
    started_at:  now,
    finished_at: null,
    mime_type:   mimeType,
    file_size_kb: meta ? (readJson<{ sizeKb: number }>(path.join(UPLOADS_DIR, `${photo_id}.meta.json`)))?.sizeKb ?? 0 : 0,
  })

  try {
    // 執行 Claude Vision 分析
    const imageBuffer = readBytes(photoPath)!
    const analysis    = await analyzeGarmentPhoto(imageBuffer, mimeType)

    const analysisId  = uuidv4()
    const finishedAt  = new Date().toISOString()

    // 更新 job 為 done
    writeJson(jobPath, {
      job_id:      jobId,
      user_id,
      photo_id,
      status:      'done',
      result:      analysis,
      error:       null,
      analysis_id: analysisId,
      created_at:  now,
      started_at:  now,
      finished_at: finishedAt,
      mime_type:   mimeType,
      file_size_kb: meta ? (readJson<{ sizeKb: number }>(path.join(UPLOADS_DIR, `${photo_id}.meta.json`)))?.sizeKb ?? 0 : 0,
    })

    return NextResponse.json({ job_id: jobId, status: 'done' })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)

    writeJson(jobPath, {
      job_id:      jobId,
      user_id,
      photo_id,
      status:      'failed',
      result:      null,
      error:       errMsg,
      analysis_id: null,
      created_at:  now,
      started_at:  now,
      finished_at: new Date().toISOString(),
      mime_type:   mimeType,
      file_size_kb: 0,
    })

    return NextResponse.json({ job_id: jobId, status: 'failed', error: errMsg })
  }
}
