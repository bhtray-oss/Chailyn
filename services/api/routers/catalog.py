"""
catalog.py — 布料目錄、版型目錄、服裝分類 API

GET  /catalog/fabrics                — 布料目錄
GET  /catalog/fabrics/{id}           — 單筆布料詳情
GET  /catalog/patterns               — 版型目錄（含 suitable_fabrics 等新欄位）
POST /catalog/patterns/enrich        — 呼叫 pattern-engine /meta 補充 part_count
GET  /catalog/classifications        — 服裝分類記錄（依 user_id 篩選）
GET  /catalog/stats                  — 統計摘要
"""
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from db.database import get_db, settings

router = APIRouter()

PATTERN_ENGINE_URL = settings.pattern_engine_url


# ─── 布料目錄 ─────────────────────────────────────────────────────────────────

@router.get("/fabrics")
async def list_fabrics(
    category: str | None = None,
    weight:   str | None = None,
    db: AsyncSession = Depends(get_db),
):
    where = "WHERE 1=1"
    params: dict = {}
    if category:
        where += " AND category = :category"
        params["category"] = category
    if weight:
        where += " AND weight = :weight"
        params["weight"] = weight

    result = await db.execute(
        text(f"""
            SELECT id, name, category, weight, drape_score, stretch_grade,
                   composition_typical, suitable_designs, occurrence_count,
                   created_at, updated_at
            FROM fabric_catalog
            {where}
            ORDER BY occurrence_count DESC, name
        """),
        params,
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/fabrics/{fabric_id}")
async def get_fabric(fabric_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM fabric_catalog WHERE id = :id"),
        {"id": str(fabric_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到布料")
    return dict(row._mapping)


# ─── 版型目錄（含豐富元資料） ──────────────────────────────────────────────────

@router.get("/patterns")
async def list_patterns(
    family:   str | None = None,
    silhouette: str | None = None,
    fabric:   str | None = None,
    db: AsyncSession = Depends(get_db),
):
    where = "WHERE is_active = true"
    params: dict = {}
    if family:
        where += " AND family = :family"
        params["family"] = family
    if silhouette:
        where += " AND :silhouette = ANY(silhouette_codes)"
        params["silhouette"] = silhouette
    if fabric:
        where += " AND :fabric = ANY(suitable_fabrics)"
        params["fabric"] = fabric

    result = await db.execute(
        text(f"""
            SELECT fs_design_id, name, family, fabric_weight, difficulty,
                   tags, suitable_fabrics, silhouette_codes,
                   collar_types, sleeve_types, part_count, part_names,
                   description_zh, garment_type, gender_hint, updated_at
            FROM pattern_catalog
            {where}
            ORDER BY difficulty, fs_design_id
        """),
        params,
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("/patterns/enrich")
async def enrich_pattern_meta(db: AsyncSession = Depends(get_db)):
    """
    呼叫 pattern-engine /meta/:design（pattern-via-io 概念），
    補充 pattern_catalog.part_count 和 part_names。
    """
    result = await db.execute(
        text("SELECT fs_design_id FROM pattern_catalog WHERE is_active = true ORDER BY fs_design_id")
    )
    designs = [r.fs_design_id for r in result.fetchall()]

    updated = []
    errors = []
    async with httpx.AsyncClient(timeout=30) as client:
        for design in designs:
            try:
                resp = await client.get(f"{PATTERN_ENGINE_URL}/meta/{design}")
                if resp.status_code == 200:
                    data = resp.json()
                    await db.execute(
                        text("""
                            UPDATE pattern_catalog
                            SET part_count = :pc, part_names = :pn, updated_at = now()
                            WHERE fs_design_id = :design
                        """),
                        {
                            "pc": data.get("part_count"),
                            "pn": data.get("part_names", []),
                            "design": design,
                        },
                    )
                    updated.append(design)
                else:
                    errors.append({"design": design, "error": resp.text[:100]})
            except Exception as e:
                errors.append({"design": design, "error": str(e)})

    await db.commit()
    return {"updated": updated, "errors": errors}


# ─── 服裝分類記錄 ─────────────────────────────────────────────────────────────

@router.get("/classifications")
async def list_classifications(
    user_id:   str | None = Query(None),
    silhouette: str | None = None,
    fabric_category: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    where = "WHERE 1=1"
    params: dict = {"limit": limit}
    if user_id:
        where += " AND gc.user_id = :user_id"
        params["user_id"] = user_id
    if silhouette:
        where += " AND gc.silhouette = :silhouette"
        params["silhouette"] = silhouette
    if fabric_category:
        where += " AND gc.fabric_category = :fabric_category"
        params["fabric_category"] = fabric_category

    result = await db.execute(
        text(f"""
            SELECT
                gc.id, gc.fabric_name, gc.fabric_category, gc.fabric_weight,
                gc.silhouette, gc.collar_type, gc.sleeve_type, gc.fit_ease,
                gc.garment_category, gc.garment_type_detail, gc.difficulty,
                gc.recommended_designs, gc.silhouette_tags, gc.created_at,
                fc.suitable_designs AS fabric_suitable_designs
            FROM garment_classifications gc
            LEFT JOIN fabric_catalog fc ON fc.id = gc.fabric_id
            {where}
            ORDER BY gc.created_at DESC
            LIMIT :limit
        """),
        params,
    )
    return [dict(r._mapping) for r in result.fetchall()]


# ─── 統計摘要 ─────────────────────────────────────────────────────────────────

@router.get("/stats")
async def catalog_stats(db: AsyncSession = Depends(get_db)):
    r1 = await db.execute(text("SELECT COUNT(*) AS cnt FROM fabric_catalog"))
    r2 = await db.execute(text("SELECT COUNT(*) AS cnt FROM garment_classifications"))
    r3 = await db.execute(text("""
        SELECT category, COUNT(*) AS cnt
        FROM fabric_catalog GROUP BY category ORDER BY cnt DESC
    """))
    r4 = await db.execute(text("""
        SELECT silhouette, COUNT(*) AS cnt
        FROM garment_classifications
        WHERE silhouette IS NOT NULL
        GROUP BY silhouette ORDER BY cnt DESC LIMIT 8
    """))
    r5 = await db.execute(text("""
        SELECT fc.name, fc.occurrence_count
        FROM fabric_catalog fc ORDER BY occurrence_count DESC LIMIT 8
    """))

    return {
        "fabric_count":         r1.fetchone().cnt,
        "classification_count": r2.fetchone().cnt,
        "fabrics_by_category":  [dict(r._mapping) for r in r3.fetchall()],
        "top_silhouettes":      [dict(r._mapping) for r in r4.fetchall()],
        "top_fabrics":          [dict(r._mapping) for r in r5.fetchall()],
    }
