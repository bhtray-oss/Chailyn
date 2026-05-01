"""
search.py — 語意搜尋路由

POST /search/query       — 文字查詢 → 最相似版型
POST /search/by-analysis — 以分析結果搜尋相似版型
POST /search/reindex     — 重建 pattern_catalog embedding 索引
GET  /search/similar/{analysis_id} — 找與此分析最相似的版型
"""
import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional

from db.database import get_db

router = APIRouter()


class TextQueryRequest(BaseModel):
    query: str            # 中英文皆可，e.g. "寬鬆棉質連帽衫"
    top_k: int = 5
    garment_type: Optional[str] = None   # 可選過濾條件
    fabric_weight: Optional[str] = None


class AnalysisQueryRequest(BaseModel):
    analysis_id: str
    top_k: int = 5


# ─── 文字查詢 ─────────────────────────────────────────────────────────────────
@router.post("/query")
async def text_query(
    req: TextQueryRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    輸入自然語言 → 回傳最相似的版型目錄項目
    使用 sentence-transformers 向量 + pgvector 餘弦相似度
    """
    from services.embeddings import embed_text
    vec = embed_text(req.query)
    vec_str = "[" + ",".join(str(v) for v in vec) + "]"

    # 建立 where clause
    filters, params = [], {"topk": req.top_k, "vec": vec_str}
    if req.garment_type:
        filters.append("garment_type = :gtype")
        params["gtype"] = req.garment_type
    if req.fabric_weight:
        filters.append("fabric_weight = :fweight")
        params["fweight"] = req.fabric_weight

    where = ("AND " + " AND ".join(filters)) if filters else ""

    # 若 embed 欄位尚未建立，退回關鍵字搜尋
    result = await db.execute(
        text(f"""
            SELECT fs_design_id, name, description_zh, description_en,
                   garment_type, fabric_weight, difficulty, tags, season,
                   source, download_url,
                   CASE
                     WHEN embed IS NOT NULL
                     THEN 1 - (embed <=> CAST(:vec AS vector))
                     ELSE 0
                   END AS score
            FROM pattern_catalog
            WHERE is_active {where}
            ORDER BY
              CASE WHEN embed IS NOT NULL THEN embed <=> CAST(:vec AS vector) END ASC NULLS LAST,
              name ASC
            LIMIT :topk
        """),
        params,
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


# ─── 以分析結果搜尋 ───────────────────────────────────────────────────────────
@router.get("/similar/{analysis_id}")
async def similar_by_analysis(
    analysis_id: str,
    top_k: int = 5,
    db: AsyncSession = Depends(get_db),
):
    """
    給定一個已分析的 analysis_id，找 pattern_catalog 中最相似的版型
    """
    result = await db.execute(
        text("SELECT cut_embed, fabric_embed, raw_output FROM ai_analyses WHERE id = :id"),
        {"id": analysis_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到分析結果")

    # 優先用 cut_embed，其次退回文字搜尋
    if row.cut_embed is not None:
        vec_str = "[" + ",".join(str(v) for v in row.cut_embed) + "]"
        catalog = await db.execute(
            text("""
                SELECT fs_design_id, name, description_zh, description_en,
                       garment_type, fabric_weight, difficulty, tags,
                       source, download_url,
                       1 - (embed <=> CAST(:vec AS vector)) AS score
                FROM pattern_catalog
                WHERE is_active AND embed IS NOT NULL
                ORDER BY embed <=> CAST(:vec AS vector)
                LIMIT :topk
            """),
            {"vec": vec_str, "topk": top_k},
        )
    else:
        # 退回：用 raw_output 裡的 closest_freesewing_patterns
        raw   = row.raw_output or {}
        patterns = raw.get("closest_freesewing_patterns", [])
        design_ids = [p["design"] for p in patterns[:top_k]]
        if not design_ids:
            return []
        catalog = await db.execute(
            text("""
                SELECT fs_design_id, name, description_zh, description_en,
                       garment_type, fabric_weight, difficulty, tags,
                       source, download_url, 0 AS score
                FROM pattern_catalog
                WHERE fs_design_id = ANY(:ids) AND is_active
            """),
            {"ids": design_ids},
        )

    return [dict(r._mapping) for r in catalog.fetchall()]


# ─── 重建 catalog embedding 索引 ─────────────────────────────────────────────
@router.post("/reindex")
async def reindex_catalog(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """重新計算所有 pattern_catalog 的 embedding。可在新增款式後呼叫。"""
    background_tasks.add_task(_rebuild_catalog_embeddings)
    return {"status": "reindexing started"}


async def _rebuild_catalog_embeddings():
    from db.database import AsyncSessionLocal
    from services.embeddings import embed_catalog_item

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("SELECT id, name, description_zh, garment_type, fabric_weight, tags FROM pattern_catalog WHERE is_active")
        )
        rows = result.fetchall()

        for row in rows:
            item = dict(row._mapping)
            try:
                vec = embed_catalog_item(item)
                vec_str = "[" + ",".join(str(v) for v in vec) + "]"
                await db.execute(
                    text("UPDATE pattern_catalog SET embed = CAST(:v AS vector) WHERE id = :id"),
                    {"v": vec_str, "id": str(item["id"])},
                )
            except Exception as e:
                print(f"[reindex] Failed for {item['name']}: {e}")

        await db.commit()
        print(f"[reindex] Indexed {len(rows)} catalog items")
