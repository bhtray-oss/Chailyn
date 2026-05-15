/**
 * POST /api/bom/[instanceId]/generate — 自動產生版型材料清單（BOM）
 * 根據設計類型產生常用材料清單，儲存到 ~/.chailyn/standalone/bom/
 */
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { PATTERNS_DIR, BOM_DIR, readJson, writeJson } from '@/lib/storage'

interface Params { params: { instanceId: string } }

// 每個設計的固定輔料 (notions)
const NOTIONS_BY_DESIGN: Record<string, Array<{ name_zh: string; name_en: string; qty_value: number; qty_unit: string; category: string }>> = {
  aaron:   [{ name_zh: '棉紗滾邊帶', name_en: 'bias tape', qty_value: 1.5, qty_unit: 'm', category: 'notions' }],
  teagan:  [],
  bibi:    [],
  simon:   [
    { name_zh: '鈕扣 11mm', name_en: 'buttons 11mm', qty_value: 8, qty_unit: 'piece', category: 'notions' },
    { name_zh: '薄布襯',    name_en: 'interfacing',   qty_value: 0.5, qty_unit: 'm',     category: 'interfacing' },
  ],
  simone:  [
    { name_zh: '鈕扣 11mm', name_en: 'buttons 11mm', qty_value: 8, qty_unit: 'piece', category: 'notions' },
    { name_zh: '薄布襯',    name_en: 'interfacing',   qty_value: 0.5, qty_unit: 'm',     category: 'interfacing' },
  ],
  huey:    [
    { name_zh: '尼龍拉鍊 60cm', name_en: 'zipper 60cm',  qty_value: 1,   qty_unit: 'piece', category: 'notions' },
    { name_zh: '帽繩 1.5m',     name_en: 'drawstring',   qty_value: 1.5, qty_unit: 'm',     category: 'notions' },
  ],
  carlton: [
    { name_zh: '大鈕扣',  name_en: 'buttons large',    qty_value: 5,   qty_unit: 'piece', category: 'notions' },
    { name_zh: '厚布襯',  name_en: 'heavy interfacing', qty_value: 1.0, qty_unit: 'm',     category: 'interfacing' },
    { name_zh: '裡布',    name_en: 'lining fabric',     qty_value: 2.5, qty_unit: 'm',     category: 'fabric' },
  ],
  carlita: [
    { name_zh: '大鈕扣',  name_en: 'buttons large',    qty_value: 5,   qty_unit: 'piece', category: 'notions' },
    { name_zh: '厚布襯',  name_en: 'heavy interfacing', qty_value: 1.0, qty_unit: 'm',     category: 'interfacing' },
    { name_zh: '裡布',    name_en: 'lining fabric',     qty_value: 2.5, qty_unit: 'm',     category: 'fabric' },
  ],
  sandy:   [{ name_zh: '鬆緊帶 2.5cm', name_en: 'elastic 2.5cm', qty_value: 0.8, qty_unit: 'm', category: 'notions' }],
  titan:   [{ name_zh: '鬆緊帶 2.5cm', name_en: 'elastic 2.5cm', qty_value: 0.9, qty_unit: 'm', category: 'notions' }],
  paco:    [{ name_zh: '鬆緊帶 2.5cm', name_en: 'elastic 2.5cm', qty_value: 0.9, qty_unit: 'm', category: 'notions' }],
  waralee: [],
  lily:    [{ name_zh: '彈力帶 1cm', name_en: 'elastic 1cm', qty_value: 1.2, qty_unit: 'm', category: 'notions' }],
  bella:   [],
  brian:   [],
}

// 主布用量估算 (m) — 依設計類型
const FABRIC_BY_DESIGN: Record<string, { qty: number; width: number }> = {
  aaron:   { qty: 1.2, width: 1400 },
  teagan:  { qty: 1.5, width: 1500 },
  bibi:    { qty: 1.5, width: 1500 },
  simon:   { qty: 2.5, width: 1400 },
  simone:  { qty: 2.5, width: 1400 },
  huey:    { qty: 2.0, width: 1500 },
  carlton: { qty: 3.5, width: 1500 },
  carlita: { qty: 3.5, width: 1500 },
  sandy:   { qty: 1.5, width: 1500 },
  titan:   { qty: 2.0, width: 1500 },
  paco:    { qty: 2.0, width: 1500 },
  waralee: { qty: 2.5, width: 1500 },
  lily:    { qty: 0.5, width: 1500 },
  bella:   { qty: 2.0, width: 1400 },
  brian:   { qty: 2.0, width: 1400 },
}

export async function POST(_req: NextRequest, { params }: Params) {
  const instance = readJson<{ design: string }>(
    path.join(PATTERNS_DIR, `${params.instanceId}.json`)
  )
  if (!instance) return NextResponse.json({ detail: '找不到版型' }, { status: 404 })

  const design = instance.design?.toLowerCase() ?? ''

  // 建立 BOM 項目
  const items: Array<{ id: string; category: string; name_zh: string; name_en: string | null; qty_value: number; qty_unit: string; width_mm: number | null; notes: string | null }> = []

  // 主布
  const fabric = FABRIC_BY_DESIGN[design] ?? { qty: 2.0, width: 1500 }
  items.push({
    id:       uuidv4(),
    category: 'fabric',
    name_zh:  '主布',
    name_en:  'main fabric',
    qty_value: fabric.qty,
    qty_unit:  'm',
    width_mm:  fabric.width,
    notes:    null,
  })

  // 車縫線
  items.push({
    id:       uuidv4(),
    category: 'thread',
    name_zh:  '車縫線',
    name_en:  'sewing thread',
    qty_value: 1,
    qty_unit:  'spool',
    width_mm:  null,
    notes:    null,
  })

  // 設計專用輔料
  for (const notion of NOTIONS_BY_DESIGN[design] ?? []) {
    items.push({
      id:       uuidv4(),
      category: notion.category,
      name_zh:  notion.name_zh,
      name_en:  notion.name_en,
      qty_value: notion.qty_value,
      qty_unit:  notion.qty_unit,
      width_mm:  null,
      notes:    null,
    })
  }

  // 分組
  const groups: Record<string, typeof items> = {}
  for (const item of items) {
    if (!groups[item.category]) groups[item.category] = []
    groups[item.category].push(item)
  }

  const bom = { groups, total: items.length }
  writeJson(path.join(BOM_DIR, `${params.instanceId}.json`), bom)

  return NextResponse.json({ generated: items.length, design })
}
