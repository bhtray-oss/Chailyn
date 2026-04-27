/**
 * POST /api/analyses/upload
 * 上傳照片 → 儲存到 ~/.chailyn/uploads/{photoId}
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { UPLOADS_DIR, writeBytes, writeJson } from '@/lib/storage'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  const url    = new URL(req.url)
  const userId = url.searchParams.get('user_id') ?? 'anonymous'

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '缺少 file 欄位' }, { status: 400 })

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `不支援的格式: ${file.type}` }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: '檔案超過 10 MB 限制' }, { status: 400 })
  }

  const photoId    = uuidv4()
  const localPath  = path.join(UPLOADS_DIR, photoId)
  const sizeKb     = Math.ceil(bytes.length / 1024)

  writeBytes(localPath, bytes)
  writeJson(path.join(UPLOADS_DIR, `${photoId}.meta.json`), {
    photoId,
    userId,
    mimeType:     file.type,
    sizeKb,
    originalName: file.name,
    createdAt:    new Date().toISOString(),
  })

  return NextResponse.json({
    photo_id: photoId,
    r2_key:   `photos/${userId}/${photoId}`,
    size_kb:  sizeKb,
  })
}
