/**
 * GET /api/auth/user/[userId] — 取得使用者資訊（單機版固定回傳 dev user）
 */
import { NextRequest, NextResponse } from 'next/server'
import { DEV_USER_ID } from '@/lib/storage'

interface Params { params: { userId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  return NextResponse.json({
    id:           params.userId,
    email:        params.userId === DEV_USER_ID ? 'dev@chailyn.local' : 'user@chailyn.local',
    display_name: '本機使用者',
    role:         'user',
    created_at:   '2024-01-01T00:00:00Z',
  })
}
