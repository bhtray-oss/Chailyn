"""
patterns.py — 版型生成、歷程、Redraft、款式管理路由

POST /patterns/draft              — 打版（建立 instance）
POST /patterns/redraft            — 基於現有版本重新打版
GET  /patterns/designs            — 列出可用 design
GET  /patterns/catalog/list       — 版型目錄
GET  /patterns/user/{user_id}     — 使用者所有版型（衣櫃）
GET  /patterns/history/{inst_id}  — 版本鏈
GET  /patterns/{instance_id}      — 取得單一版型實例
"""
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional

from db.database import get_db
from services import pattern_engine_client as engine

router = APIRouter()


class DraftRequest(BaseModel):
    user_id:          uuid.UUID
    design:           str
    body_profile_id:  uuid.UUID
    options:          dict = {}
    sa:               int = 10
    paperless:        bool = False
    units:            str = "metric"
    render_mode:      str = "svg"
    gender:           str = "cisFemale"
    title:            Optional[str] = None
    notes:            Optional[str] = None
    ai_source_photo_id: Optional[uuid.UUID] = None
    ai_confidence:    Optional[float] = None


class RedraftRequest(BaseModel):
    """基於現有版本重新打版：複製設定並可覆蓋部分參數"""
    instance_id:      uuid.UUID           # 來源版本
    user_id:          uuid.UUID
    # 以下皆可選，不傳就沿用來源版本的值
    body_profile_id:  Optional[uuid.UUID] = None
    options:          Optional[dict] = None
    sa:               Optional[int] = None
    paperless:        Optional[bool] = None
    render_mode:      str = "svg"
    gender:           str = "cisFemale"
    title:            Optional[str] = None
    notes:            Optional[str] = None


class SampleRequest(BaseModel):
    design:           str
    mode:             str
    measurements:     dict = {}
    sample_option:    Optional[str] = None
    sample_measurement: Optional[str] = None
    gender:           str = "cisFemale"


# ─── 取得所有可用 design ───────────────────────────────────────────────────────
@router.get("/designs")
async def list_designs():
    designs = await engine.list_designs()
    return {"designs": designs}


# ─── 打版 ─────────────────────────────────────────────────────────────────────
@router.post("/draft")
async def draft_pattern(
    req: DraftRequest,
    db: AsyncSession = Depends(get_db),
):
    measurements = await _get_measurements(db, req.user_id, req.body_profile_id)
    engine_result = await _call_engine(req.design, measurements, req.options, req.sa,
                                       req.paperless, req.units, req.render_mode, req.gender)

    catalog_row = await _get_catalog_id(db, req.design)
    instance_id = uuid.uuid4()

    await db.execute(
        text("""
            INSERT INTO pattern_instances
              (id, user_id, pattern_catalog_id, body_profile_id,
               measurements_snapshot, options_snapshot, sa, paperless,
               created_by_ai, ai_source_photo_id, ai_confidence, logs,
               design, version, title, notes, svg_data)
            VALUES
              (:id, :uid, :catalog_id, :profile_id,
               CAST(:m AS JSONB), CAST(:o AS JSONB), :sa, :paperless,
               :ai, :ai_photo, :conf, CAST(:logs AS JSONB),
               :design, 1, :title, :notes, :svg)
        """),
        {
            "id":         str(instance_id),
            "uid":        str(req.user_id),
            "catalog_id": str(catalog_row.id) if catalog_row else None,
            "profile_id": str(req.body_profile_id),
            "m":          json.dumps(measurements),
            "o":          json.dumps(req.options),
            "sa":         req.sa,
            "paperless":  req.paperless,
            "ai":         req.ai_source_photo_id is not None,
            "ai_photo":   str(req.ai_source_photo_id) if req.ai_source_photo_id else None,
            "conf":       req.ai_confidence,
            "logs":       json.dumps(engine_result.get("logs", {})),
            "design":     req.design,
            "title":      req.title or req.design,
            "notes":      req.notes,
            "svg":        engine_result.get("svg"),
        },
    )
    await db.commit()

    return {"instance_id": str(instance_id), "design": req.design, **engine_result}


# ─── Redraft（基於現有版本建新版） ─────────────────────────────────────────────
@router.post("/redraft")
async def redraft_pattern(
    req: RedraftRequest,
    db: AsyncSession = Depends(get_db),
):
    # 1. 取得來源版本
    result = await db.execute(
        text("""
            SELECT id, user_id, design, body_profile_id,
                   measurements_snapshot, options_snapshot, sa, paperless,
                   version, title
            FROM pattern_instances WHERE id = :id AND user_id = :uid
        """),
        {"id": str(req.instance_id), "uid": str(req.user_id)},
    )
    src = result.fetchone()
    if not src:
        raise HTTPException(404, "找不到來源版型")

    src = dict(src._mapping)

    # 2. 覆蓋可選參數
    profile_id = req.body_profile_id or uuid.UUID(str(src["body_profile_id"]))
    options    = req.options    if req.options    is not None else src["options_snapshot"]
    sa         = req.sa         if req.sa         is not None else src["sa"]
    paperless  = req.paperless  if req.paperless  is not None else src["paperless"]
    new_version = src["version"] + 1

    measurements = await _get_measurements(db, req.user_id, profile_id)
    engine_result = await _call_engine(
        src["design"], measurements, options, sa, paperless, "metric", req.render_mode, req.gender
    )

    catalog_row = await _get_catalog_id(db, src["design"])
    new_id = uuid.uuid4()

    await db.execute(
        text("""
            INSERT INTO pattern_instances
              (id, user_id, pattern_catalog_id, body_profile_id,
               measurements_snapshot, options_snapshot, sa, paperless,
               created_by_ai, logs,
               design, version, title, notes, svg_data, parent_instance_id)
            VALUES
              (:id, :uid, :catalog_id, :profile_id,
               CAST(:m AS JSONB), CAST(:o AS JSONB), :sa, :paperless,
               false, CAST(:logs AS JSONB),
               :design, :version, :title, :notes, :svg, :parent_id)
        """),
        {
            "id":         str(new_id),
            "uid":        str(req.user_id),
            "catalog_id": str(catalog_row.id) if catalog_row else None,
            "profile_id": str(profile_id),
            "m":          json.dumps(measurements),
            "o":          json.dumps(options),
            "sa":         sa,
            "paperless":  paperless,
            "logs":       json.dumps(engine_result.get("logs", {})),
            "design":     src["design"],
            "version":    new_version,
            "title":      req.title or src.get("title") or src["design"],
            "notes":      req.notes,
            "svg":        engine_result.get("svg"),
            "parent_id":  str(req.instance_id),
        },
    )
    await db.commit()

    return {
        "instance_id": str(new_id),
        "design":      src["design"],
        "version":     new_version,
        "parent_id":   str(req.instance_id),
        **engine_result,
    }


# ─── 使用者衣櫃（所有版型，按 design 分組） ────────────────────────────────────
@router.get("/user/{user_id}")
async def list_user_patterns(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    回傳每個 design 的最新版本 + 版本總數。
    前端「衣櫃」頁面使用。
    """
    result = await db.execute(
        text("""
            WITH ranked AS (
              SELECT *,
                     ROW_NUMBER() OVER (PARTITION BY design ORDER BY version DESC, created_at DESC) AS rn
              FROM pattern_instances
              WHERE user_id = :uid
            ),
            counts AS (
              SELECT design, COUNT(*) AS total_versions
              FROM pattern_instances
              WHERE user_id = :uid
              GROUP BY design
            )
            SELECT r.id, r.design, r.version, r.title, r.notes,
                   r.options_snapshot, r.sa, r.paperless,
                   r.created_at, r.parent_instance_id,
                   r.created_by_ai, r.ai_confidence,
                   c.total_versions,
                   CASE WHEN r.svg_data IS NOT NULL THEN true ELSE false END AS has_svg
            FROM ranked r
            JOIN counts c ON r.design = c.design
            WHERE r.rn = 1
            ORDER BY r.created_at DESC
        """),
        {"uid": str(user_id)},
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


# ─── 版本鏈歷程 ──────────────────────────────────────────────────────────────
@router.get("/history/{instance_id}")
async def get_version_history(
    instance_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    從任意版本出發，找出同一 design + user 的完整版本鏈，
    按 version ASC 排序。
    """
    # 先找這個 instance 的 user_id + design
    result = await db.execute(
        text("SELECT user_id, design FROM pattern_instances WHERE id = :id"),
        {"id": str(instance_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到版型")

    uid    = str(row.user_id)
    design = row.design

    # 取完整版本鏈
    chain = await db.execute(
        text("""
            SELECT id, version, title, notes, sa, paperless,
                   options_snapshot, created_at, parent_instance_id,
                   CASE WHEN svg_data IS NOT NULL THEN true ELSE false END AS has_svg
            FROM pattern_instances
            WHERE user_id = :uid AND design = :design
            ORDER BY version ASC, created_at ASC
        """),
        {"uid": uid, "design": design},
    )
    versions = [dict(r._mapping) for r in chain.fetchall()]

    return {
        "design":   design,
        "user_id":  uid,
        "versions": versions,
    }


# ─── Armstrong 公式打版（BPD-2026-02 style）────────────────────────────────────

class ArmstrongDraftRequest(BaseModel):
    """
    Armstrong 5th Ed. 量測值（cm），供 armstrong_bodice.py 計算所有打版點位。
    BPD-2026-02 Missy 12 預設值已填入。
    """
    # Ch.2 標準量測（cm）
    m5_cf_length_cm: float = 41.9
    m6_full_length_cm: float = 43.2
    m7_shoulder_slope_cm: float = 14.6
    m9_bust_depth_cm: float = 24.8
    m10_bust_span_cm: float = 9.5
    m11_side_length_cm: float = 40.6
    m13_shoulder_len_cm: float = 12.7
    m14_across_shoulder_cm: float = 39.4
    m15_across_chest_cm: float = 17.8
    m16_across_back_cm: float = 18.4
    m17_bust_arc_cm: float = 45.7
    m18_back_arc_cm: float = 44.5
    m19_waist_arc_cm: float = 35.6
    m20_dart_placement_cm: float = 8.3
    hip_arc_cm: float = 49.5
    hip_depth_cm: float = 17.8
    cb_length_cm: float = 40.0
    skirt_length_cm: float = 72.4

    # 方領
    sq_nk_width_half_cm: Optional[float] = 15.9   # 6.25"
    sq_nk_depth_cm: Optional[float] = 7.0          # 2.75"

    # 箱褶
    box_pleat_visible_cm: float = 7.6
    box_pleat_underlay_cm: float = 7.6
    box_pleat_count_front: int = 2
    box_pleat_count_back: int = 2
    box_pleat_press_depth_cm: float = 15.2

    style_code: str = "BPD-2026-02"


@router.post("/armstrong-draft")
async def armstrong_draft(req: ArmstrongDraftRequest):
    """
    Armstrong 5th Ed. 公式完整打版。
    回傳前後片所有點位座標（英吋）、公主線、方領、箱褶、QC 標準。
    不存入 DB；供前端展示打版草圖或交給 pattern-engine 繪製。
    """
    from services.armstrong_bodice import from_cm, draft_bpd_2026_02

    m = from_cm(req.model_dump())
    result = draft_bpd_2026_02(m)
    return result


# ─── DXF 匯出 ────────────────────────────────────────────────────────────────
@router.get("/dxf/{instance_id}")
async def export_dxf(
    instance_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    根據已儲存的 pattern instance 重新打版並輸出 DXF 檔案
    """
    result = await db.execute(
        text("""
            SELECT pi.design, pi.measurements_snapshot, pi.options_snapshot,
                   pi.sa, pi.paperless, pc.name
            FROM pattern_instances pi
            LEFT JOIN pattern_catalog pc ON pi.pattern_catalog_id = pc.id
            WHERE pi.id = :id
        """),
        {"id": str(instance_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到版型實例")

    inst = dict(row._mapping)
    try:
        dxf_bytes = await engine.dxf(
            design       = inst["design"],
            measurements = inst["measurements_snapshot"],
            options      = inst["options_snapshot"] or {},
            sa           = inst["sa"],
            paperless    = inst["paperless"],
            title        = inst.get("name") or inst["design"],
        )
    except Exception as e:
        raise HTTPException(502, f"DXF 生成失敗: {e}")

    filename = f"{inst['design']}_sa{inst['sa']}.dxf"
    return Response(
        content=dxf_bytes,
        media_type="application/dxf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── 取樣預覽 ─────────────────────────────────────────────────────────────────
@router.post("/sample")
async def sample_pattern(req: SampleRequest):
    try:
        result = await engine.sample(
            design=req.design,
            mode=req.mode,
            measurements=req.measurements,
            sample_option=req.sample_option,
            sample_measurement=req.sample_measurement,
            gender=req.gender,
        )
    except Exception as e:
        raise HTTPException(502, f"Sample 失敗: {e}")
    return result


# ─── 版型目錄（必須在 /{instance_id} 前面） ────────────────────────────────────
@router.get("/catalog/list")
async def list_catalog(
    family: Optional[str] = None,
    source: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    filters, params = ["is_active"], {}
    if family:
        filters.append("family = :family")
        params["family"] = family
    if source:
        filters.append("source = :source")
        params["source"] = source
    where = " AND ".join(filters)
    result = await db.execute(
        text(f"SELECT * FROM pattern_catalog WHERE {where} ORDER BY garment_type, name"),
        params,
    )
    return [dict(r._mapping) for r in result.fetchall()]


# ─── 取得版型實例（含 SVG） ────────────────────────────────────────────────────
@router.get("/{instance_id}")
async def get_instance(
    instance_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT * FROM pattern_instances WHERE id = :id"),
        {"id": str(instance_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到版型實例")
    return dict(row._mapping)


# ─── 內部 helpers ─────────────────────────────────────────────────────────────
async def _get_measurements(db: AsyncSession, user_id: uuid.UUID, profile_id: uuid.UUID) -> dict:
    result = await db.execute(
        text("SELECT measurements FROM body_profiles WHERE id = :id AND user_id = :uid"),
        {"id": str(profile_id), "uid": str(user_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到身材檔案")
    return row.measurements


async def _get_catalog_id(db: AsyncSession, design: str):
    result = await db.execute(
        text("SELECT id FROM pattern_catalog WHERE fs_design_id = :d LIMIT 1"),
        {"d": design},
    )
    return result.fetchone()


async def _call_engine(design, measurements, options, sa, paperless, units, render_mode, gender):
    try:
        return await engine.draft(
            design=design,
            measurements=measurements,
            options=options,
            sa=sa,
            paperless=paperless,
            units=units,
            render_mode=render_mode,
            gender=gender,
        )
    except Exception as e:
        raise HTTPException(502, f"Pattern engine 錯誤: {e}")
