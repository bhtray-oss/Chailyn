/**
 * POST /api/patterns/sample — 取樣預覽（stub，回傳空 SVG）
 */
import { NextResponse } from 'next/server'
export async function POST() {
  return NextResponse.json({ ok: true, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="10" y="50" font-size="10">Sample not available in standalone mode</text></svg>' })
}
