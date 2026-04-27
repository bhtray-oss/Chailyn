/**
 * POST /api/search/query — 簡易版型關鍵字搜尋（單機版，不使用 pgvector）
 */
import { NextRequest, NextResponse } from 'next/server'
import { AVAILABLE_DESIGNS } from '@/lib/freesewing-draft'

// 版型中文說明 + 關鍵字（取代 PostgreSQL semantic search）
const CATALOG: Array<{
  fs_design_id:    string
  name:            string
  description_zh:  string
  garment_type:    string
  fabric_weight:   string
  difficulty:      number
  tags:            string[]
  keywords:        string[]
}> = [
  { fs_design_id: 'aaron',   name: 'Aaron',   description_zh: '無袖背心，偏差帶飾邊設計，適合初學者',                  garment_type: 'top',      fabric_weight: 'light',  difficulty: 1, tags: ['sleeveless','casual'],           keywords: ['背心','無袖','tank','jersey','針織'] },
  { fs_design_id: 'bella',   name: 'Bella',   description_zh: '女性合身胸衣版型基礎型，精準公主線分割',              garment_type: 'block',    fabric_weight: 'medium', difficulty: 2, tags: ['princess_line','fitted'],        keywords: ['胸衣','版型','bodice','省道'] },
  { fs_design_id: 'bibi',    name: 'Bibi',    description_zh: '寬鬆T恤，中性設計，圓領，適合針織布',                  garment_type: 'top',      fabric_weight: 'light',  difficulty: 1, tags: ['relaxed_fit','casual'],          keywords: ['T恤','tshirt','針織','jersey','casual'] },
  { fs_design_id: 'brian',   name: 'Brian',   description_zh: '男性合身上衣版型基礎型',                               garment_type: 'block',    fabric_weight: 'medium', difficulty: 2, tags: ['fitted','block'],                keywords: ['版型','男性','bodice','基礎'] },
  { fs_design_id: 'carlita', name: 'Carlita', description_zh: '女款雙排扣長外套，結構嚴謹，有裡布',                  garment_type: 'outerwear', fabric_weight: 'heavy', difficulty: 4, tags: ['tailored','formal','classic'],   keywords: ['外套','coat','雙排扣','羊毛','wool'] },
  { fs_design_id: 'carlton', name: 'Carlton', description_zh: '男款長大衣，有駁領與裡布，中高難度',                   garment_type: 'outerwear', fabric_weight: 'heavy', difficulty: 4, tags: ['tailored','formal','classic'],   keywords: ['大衣','coat','駁領','lapel','外套'] },
  { fs_design_id: 'huey',    name: 'Huey',    description_zh: '拉鍊連帽衛衣，有口袋，適合針織或棉布',                 garment_type: 'top',      fabric_weight: 'medium', difficulty: 2, tags: ['relaxed_fit','casual','hood'],   keywords: ['連帽','帽T','hoodie','衛衣','fleece','運動'] },
  { fs_design_id: 'lily',    name: 'Lily',    description_zh: '貼身型內衣/泳衣基礎版型',                             garment_type: 'lingerie', fabric_weight: 'light',  difficulty: 2, tags: ['fitted','lingerie'],             keywords: ['內衣','泳衣','bra','lingerie','貼身'] },
  { fs_design_id: 'paco',    name: 'Paco',    description_zh: '中性寬鬆休閒褲，鬆緊腰帶，適合初學者',               garment_type: 'bottom',   fabric_weight: 'medium', difficulty: 1, tags: ['relaxed_fit','casual'],          keywords: ['褲子','pants','休閒褲','鬆緊','elastic'] },
  { fs_design_id: 'sandy',   name: 'Sandy',   description_zh: '圍裹裙，初學者友善，長短皆可',                        garment_type: 'bottom',   fabric_weight: 'light',  difficulty: 1, tags: ['a_line','wrap','beginner'],      keywords: ['裙子','skirt','圍裹','wrap','半裙'] },
  { fs_design_id: 'simon',   name: 'Simon',   description_zh: '男款正式襯衫，多種領型袖型可選',                      garment_type: 'top',      fabric_weight: 'light',  difficulty: 3, tags: ['fitted','classic','shirt'],      keywords: ['襯衫','shirt','正式','梭織','cotton','button'] },
  { fs_design_id: 'simone',  name: 'Simone',  description_zh: '女款正式襯衫，Simon 女版，多種選項',                  garment_type: 'top',      fabric_weight: 'light',  difficulty: 3, tags: ['fitted','classic','blouse'],     keywords: ['襯衫','blouse','女衫','梭織','button'] },
  { fs_design_id: 'teagan',  name: 'Teagan',  description_zh: '基本款針織T恤，中性設計，版型簡潔',                   garment_type: 'top',      fabric_weight: 'light',  difficulty: 1, tags: ['casual','knit_friendly'],        keywords: ['T恤','tshirt','針織','knit','jersey','基本'] },
  { fs_design_id: 'titan',   name: 'Titan',   description_zh: '西裝褲版型基礎型，省道設計',                          garment_type: 'block',    fabric_weight: 'medium', difficulty: 2, tags: ['tailored','trouser'],            keywords: ['西裝褲','trouser','省道','版型','正式'] },
  { fs_design_id: 'waralee', name: 'Waralee', description_zh: '泰式圍裹褲，初學者友善，直線縫製為主',               garment_type: 'bottom',   fabric_weight: 'light',  difficulty: 1, tags: ['wrap','beginner','minimal'],     keywords: ['圍裹褲','wrap pants','thai','泰式','輕薄'] },
]

interface QueryRequest {
  query:         string
  top_k?:        number
  garment_type?: string
  fabric_weight?: string
}

export async function POST(req: NextRequest) {
  const { query = '', top_k = 6, garment_type, fabric_weight } = (await req.json()) as QueryRequest
  const q = query.toLowerCase()

  let results = CATALOG.filter(c => {
    if (garment_type  && c.garment_type  !== garment_type)  return false
    if (fabric_weight && c.fabric_weight !== fabric_weight) return false
    return true
  })

  // Score by keyword match
  const scored = results.map(c => {
    let score = 0
    const haystack = [
      c.name.toLowerCase(),
      c.description_zh,
      c.garment_type,
      ...c.tags,
      ...c.keywords,
    ].join(' ')
    const queryTerms = q.split(/\s+/).filter(Boolean)
    for (const term of queryTerms) {
      if (haystack.includes(term)) score += 1
    }
    if (c.name.toLowerCase() === q) score += 10
    return { ...c, score: queryTerms.length ? score / queryTerms.length : 0.5 }
  })

  scored.sort((a, b) => b.score - a.score || a.difficulty - b.difficulty)

  return NextResponse.json(
    scored.slice(0, top_k).map(({ keywords: _k, ...rest }) => rest)
  )
}
