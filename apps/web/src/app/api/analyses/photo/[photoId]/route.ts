/**
 * GET /api/analyses/photo/[photoId] — 回傳照片檔案
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { UPLOADS_DIR, readBytes, readJson } from '@/lib/storage'

interface Params { params: { photoId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const photoPath = path.join(UPLOADS_DIR, params.photoId)
  const imageData = readBytes(photoPath)
  if (!imageData) {
    return NextResponse.json({ error: '照片不存在' }, { status: 404 })
  }

  const meta     = readJson<{ mimeType: string }>(
    path.join(UPLOADS_DIR, `${params.photoId}.meta.json`)
  )
  const mimeType = meta?.mimeType ?? 'image/jpeg'

  return new NextResponse(new Uint8Array(imageData), {
    headers: {
      'Content-Type':  mimeType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
