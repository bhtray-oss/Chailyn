/**
 * PATCH /api/bom/items/[itemId]  — 更新材料項目（stub）
 * DELETE /api/bom/items/[itemId] — 刪除材料項目（stub）
 */
import { NextResponse } from 'next/server'
export async function PATCH() {
  return NextResponse.json({ ok: true })
}
export async function DELETE() {
  return NextResponse.json({ ok: true })
}
