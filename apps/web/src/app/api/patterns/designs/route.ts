/**
 * GET /api/patterns/designs — 列出所有支援的設計
 */
import { NextResponse } from 'next/server'
import { AVAILABLE_DESIGNS } from '@/lib/freesewing-draft'

export async function GET() {
  return NextResponse.json({ designs: AVAILABLE_DESIGNS })
}
