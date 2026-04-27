/**
 * POST /api/search/reindex — stub（單機版不需要重建索引）
 */
import { NextResponse } from 'next/server'
export async function POST() {
  return NextResponse.json({ ok: true, message: '單機版不需要 reindex' })
}
