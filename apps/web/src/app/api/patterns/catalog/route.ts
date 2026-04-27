/**
 * GET /api/patterns/catalog/list — 版型目錄列表（靜態資料）
 */
import { NextResponse } from 'next/server'

const CATALOG = [
  { fs_design_id: 'aaron',   name: 'Aaron',   family: 'top',      fabric_weight: 'light',  difficulty: 1, garment_type: 'tank top',      gender_hint: 'unisex',  description_zh: '無袖背心，偏差帶飾邊' },
  { fs_design_id: 'bella',   name: 'Bella',   family: 'block',    fabric_weight: 'medium', difficulty: 2, garment_type: 'bodice block',  gender_hint: 'female',  description_zh: '女性胸衣版型基礎型' },
  { fs_design_id: 'bibi',    name: 'Bibi',    family: 'top',      fabric_weight: 'light',  difficulty: 1, garment_type: 'tee',           gender_hint: 'unisex',  description_zh: '寬鬆T恤，圓領，適合針織布' },
  { fs_design_id: 'brian',   name: 'Brian',   family: 'block',    fabric_weight: 'medium', difficulty: 2, garment_type: 'bodice block',  gender_hint: 'male',    description_zh: '男性上衣版型基礎型' },
  { fs_design_id: 'carlita', name: 'Carlita', family: 'outerwear', fabric_weight: 'heavy', difficulty: 4, garment_type: 'coat',          gender_hint: 'female',  description_zh: '女款雙排扣長大衣' },
  { fs_design_id: 'carlton', name: 'Carlton', family: 'outerwear', fabric_weight: 'heavy', difficulty: 4, garment_type: 'coat',          gender_hint: 'male',    description_zh: '男款長大衣，有駁領' },
  { fs_design_id: 'huey',    name: 'Huey',    family: 'top',      fabric_weight: 'medium', difficulty: 2, garment_type: 'hoodie',        gender_hint: 'unisex',  description_zh: '拉鍊連帽衛衣，有口袋' },
  { fs_design_id: 'lily',    name: 'Lily',    family: 'lingerie', fabric_weight: 'light',  difficulty: 2, garment_type: 'bra',           gender_hint: 'female',  description_zh: '貼身型內衣/泳衣基礎版型' },
  { fs_design_id: 'paco',    name: 'Paco',    family: 'bottom',   fabric_weight: 'medium', difficulty: 1, garment_type: 'pants',         gender_hint: 'unisex',  description_zh: '休閒褲，鬆緊腰帶' },
  { fs_design_id: 'sandy',   name: 'Sandy',   family: 'bottom',   fabric_weight: 'light',  difficulty: 1, garment_type: 'skirt',         gender_hint: 'female',  description_zh: '圍裹裙，初學者友善' },
  { fs_design_id: 'simon',   name: 'Simon',   family: 'top',      fabric_weight: 'light',  difficulty: 3, garment_type: 'shirt',         gender_hint: 'male',    description_zh: '男款正式襯衫，多種選項' },
  { fs_design_id: 'simone',  name: 'Simone',  family: 'top',      fabric_weight: 'light',  difficulty: 3, garment_type: 'blouse',        gender_hint: 'female',  description_zh: '女款正式襯衫' },
  { fs_design_id: 'teagan',  name: 'Teagan',  family: 'top',      fabric_weight: 'light',  difficulty: 1, garment_type: 'tee',           gender_hint: 'unisex',  description_zh: '基本款針織T恤，中性設計' },
  { fs_design_id: 'titan',   name: 'Titan',   family: 'block',    fabric_weight: 'medium', difficulty: 2, garment_type: 'trouser block', gender_hint: 'unisex',  description_zh: '西裝褲版型基礎型' },
  { fs_design_id: 'waralee', name: 'Waralee', family: 'bottom',   fabric_weight: 'light',  difficulty: 1, garment_type: 'pants',         gender_hint: 'unisex',  description_zh: '泰式圍裹褲，初學者友善' },
]

export async function GET() {
  return NextResponse.json(CATALOG)
}
