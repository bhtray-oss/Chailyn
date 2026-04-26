"""
bom.py — 版型物料清單（Bill of Materials）路由

GET  /bom/{instance_id}        — 取得 BOM
POST /bom/{instance_id}/generate — AI 自動生成 BOM（基於版型尺寸 + 分析資料）
POST /bom/{instance_id}/items  — 手動新增項目
PATCH /bom/items/{item_id}     — 修改項目
DELETE /bom/items/{item_id}    — 刪除項目
"""
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional

from db.database import get_db

router = APIRouter()


class BomItemCreate(BaseModel):
    category:    str        # fabric / interfacing / notions / thread / misc
    name_zh:     str
    name_en:     Optional[str] = None
    qty_value:   float
    qty_unit:    str
    width_mm:    Optional[int] = None
    notes:       Optional[str] = None


class BomItemUpdate(BaseModel):
    qty_value:   Optional[float] = None
    qty_unit:    Optional[str] = None
    notes:       Optional[str] = None
    name_zh:     Optional[str] = None


# ─── BOM 估算規則（依 design family 給出預設物料） ─────────────────────────────
# 規則：{ design_id: [ {category, name_zh, name_en, qty_fn, unit, width_mm, notes} ] }
# qty_fn 接受 measurements(mm) 回傳數量

def _estimate_fabric_meters(measurements: dict, design: str, fabric_width_mm: int = 1140) -> float:
    """
    簡化版面積估算：
    以主要測量值推算每片的用料長度，再加 20% 餘量
    """
    chest  = measurements.get("chest",  920)
    hips   = measurements.get("hips",   980)
    inseam = measurements.get("inseam", 760)
    htw    = measurements.get("hpsToWaistBack", 400)
    sw     = measurements.get("shoulderToWrist", 600)

    design_l = design.lower()

    # 上衣類
    if design_l in ("aaron", "teagan", "bibi"):
        length = (htw + 150) * 2 / 1000   # 前後片
    elif design_l in ("simon", "simone"):
        length = (htw + 250 + sw + 150) * 2 / 1000   # 前後 + 袖
    elif design_l in ("huey",):
        length = (htw + 350 + sw + 150) * 2 / 1000
    elif design_l in ("carlton", "carlita"):
        length = (htw * 2 + sw * 2 + 800) / 1000    # 大衣
    # 下身類
    elif design_l in ("sandy", "waralee"):
        length = (hips / 10 + 600) / 1000
    elif design_l in ("titan", "paco"):
        length = (inseam * 2 + 400) / 1000
    elif design_l == "lily":
        length = (chest / 10 + htw) / 1000
    else:  # bella, brian, block
        length = (htw * 2 + 200) / 1000

    # 加放縫份 + 20% 餘量
    return round(length * 1.2, 2)


NOTIONS_BY_DESIGN: dict[str, list[dict]] = {
    "aaron":   [{"name_zh": "棉紗滾邊帶", "name_en": "bias tape", "qty_value": 1.5, "qty_unit": "m", "category": "notions"}],
    "teagan":  [],
    "bibi":    [],
    "simon":   [
        {"name_zh": "鈕扣 11mm", "name_en": "buttons 11mm", "qty_value": 8, "qty_unit": "piece", "category": "notions"},
        {"name_zh": "薄布襯", "name_en": "interfacing", "qty_value": 0.5, "qty_unit": "m", "category": "interfacing"},
    ],
    "simone":  [
        {"name_zh": "鈕扣 11mm", "name_en": "buttons 11mm", "qty_value": 8, "qty_unit": "piece", "category": "notions"},
        {"name_zh": "薄布襯", "name_en": "interfacing", "qty_value": 0.5, "qty_unit": "m", "category": "interfacing"},
    ],
    "huey":    [
        {"name_zh": "尼龍拉鍊 60cm", "name_en": "zipper 60cm", "qty_value": 1, "qty_unit": "piece", "category": "notions"},
        {"name_zh": "帽繩 1.5m", "name_en": "drawstring", "qty_value": 1.5, "qty_unit": "m", "category": "notions"},
    ],
    "carlton": [
        {"name_zh": "暗扣 / 大鈕扣", "name_en": "buttons large", "qty_value": 5, "qty_unit": "piece", "category": "notions"},
        {"name_zh": "厚布襯", "name_en": "heavy interfacing", "qty_value": 1.0, "qty_unit": "m", "category": "interfacing"},
        {"name_zh": "裡布", "name_en": "lining", "qty_value": 2.5, "qty_unit": "m", "category": "fabric"},
    ],
    "carlita": [
        {"name_zh": "暗扣 / 大鈕扣", "name_en": "buttons large", "qty_value": 5, "qty_unit": "piece", "category": "notions"},
        {"name_zh": "厚布襯", "name_en": "heavy interfacing", "qty_value": 1.0, "qty_unit": "m", "category": "interfacing"},
        {"name_zh": "裡布", "name_en": "lining", "qty_value": 2.5, "qty_unit": "m", "category": "fabric"},
    ],
    "sandy":   [{"name_zh": "鬆緊帶 2.5cm", "name_en": "elastic 2.5cm", "qty_value": 0.8, "qty_unit": "m", "category": "notions"}],
    "titan":   [{"name_zh": "鬆緊帶 2.5cm", "name_en": "elastic 2.5cm", "qty_value": 0.9, "qty_unit": "m", "category": "notions"}],
    "paco":    [{"name_zh": "鬆緊帶 2.5cm", "name_en": "elastic 2.5cm", "qty_value": 0.9, "qty_unit": "m", "category": "notions"}],
    "waralee": [],
    "lily":    [{"name_zh": "彈力帶 1cm", "name_en": "elastic 1cm", "qty_value": 1.2, "qty_unit": "m", "category": "notions"}],
    "bella":   [],
    "brian":   [],
}


def _default_fabric_name(design: str, analysis: dict | None) -> tuple[str, str]:
    """回傳 (name_zh, name_en)"""
    if analysis:
        f = (analysis.get("fabric") or {}).get("primary") or {}
        name = f.get("name")
        if name:
            return (f"主布料（{name}）", f"Main fabric ({name})")
    return ("主布料", "Main fabric")


# ─── GET BOM ──────────────────────────────────────────────────────────────────
@router.get("/{instance_id}")
async def get_bom(
    instance_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            SELECT id, category, name_zh, name_en, qty_value, qty_unit,
                   width_mm, notes, created_at
            FROM bom_items
            WHERE instance_id = :id
            ORDER BY category, created_at
        """),
        {"id": str(instance_id)},
    )
    rows = result.fetchall()
    items = [dict(r._mapping) for r in rows]

    # 按 category 分組
    groups: dict = {}
    for item in items:
        cat = item["category"]
        groups.setdefault(cat, []).append(item)

    return {"instance_id": str(instance_id), "groups": groups, "total": len(items)}


# ─── AI 自動生成 BOM ──────────────────────────────────────────────────────────
@router.post("/{instance_id}/generate")
async def generate_bom(
    instance_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    根據版型 instance 的 design + measurements_snapshot 自動估算物料。
    若存在關聯的 AI 分析結果，也會納入布料建議。
    """
    # 取得版型資料
    result = await db.execute(
        text("""
            SELECT pi.design, pi.measurements_snapshot, pi.sa,
                   pi.ai_source_photo_id,
                   aa.raw_output AS analysis
            FROM pattern_instances pi
            LEFT JOIN garment_photos gp ON pi.ai_source_photo_id = gp.id
            LEFT JOIN ai_analyses aa    ON aa.photo_id = gp.id
            WHERE pi.id = :id
        """),
        {"id": str(instance_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到版型實例")

    inst = dict(row._mapping)
    design      = (inst["design"] or "").lower()
    measurements = inst["measurements_snapshot"] or {}
    analysis    = inst["analysis"]

    # 清除舊 BOM（重新生成）
    await db.execute(
        text("DELETE FROM bom_items WHERE instance_id = :id"),
        {"id": str(instance_id)},
    )

    items_to_insert: list[dict] = []

    # ── 主布料 ──
    fabric_m = _estimate_fabric_meters(measurements, design)
    fname_zh, fname_en = _default_fabric_name(design, analysis)
    items_to_insert.append({
        "category": "fabric",
        "name_zh":   fname_zh,
        "name_en":   fname_en,
        "qty_value": fabric_m,
        "qty_unit":  "m",
        "width_mm":  1140,
        "notes":     f"估算用量（含 20% 餘量），縫份 {inst['sa']}mm",
    })

    # ── 車線 ──
    items_to_insert.append({
        "category": "thread",
        "name_zh":   "車縫線（配色）",
        "name_en":   "thread (matching)",
        "qty_value": 2,
        "qty_unit":  "piece",
        "width_mm":  None,
        "notes":     "建議備 2 捲底線 + 面線",
    })

    # ── 款式特有小料 ──
    for notion in NOTIONS_BY_DESIGN.get(design, []):
        items_to_insert.append({
            "category": notion["category"],
            "name_zh":   notion["name_zh"],
            "name_en":   notion["name_en"],
            "qty_value": notion["qty_value"],
            "qty_unit":  notion["qty_unit"],
            "width_mm":  None,
            "notes":     None,
        })

    # ── AI 建議（craft_recommendations） ──
    if analysis:
        rec = analysis.get("craft_recommendations") or {}
        if rec.get("pressing_notes"):
            items_to_insert.append({
                "category": "misc",
                "name_zh":   f"燙馬 / 燙板（{rec['pressing_notes']}）",
                "name_en":   "pressing equipment",
                "qty_value": 1,
                "qty_unit":  "set",
                "width_mm":  None,
                "notes":     rec.get("pressing_notes"),
            })

    # 批次寫入
    for item in items_to_insert:
        await db.execute(
            text("""
                INSERT INTO bom_items
                  (id, instance_id, category, name_zh, name_en,
                   qty_value, qty_unit, width_mm, notes)
                VALUES
                  (:id, :inst, :cat, :nzh, :nen,
                   :qty, :unit, :w, :notes)
            """),
            {
                "id":    str(uuid.uuid4()),
                "inst":  str(instance_id),
                "cat":   item["category"],
                "nzh":   item["name_zh"],
                "nen":   item.get("name_en"),
                "qty":   item["qty_value"],
                "unit":  item["qty_unit"],
                "w":     item.get("width_mm"),
                "notes": item.get("notes"),
            },
        )
    await db.commit()

    return {
        "generated": len(items_to_insert),
        "instance_id": str(instance_id),
        "design": design,
    }


# ─── 手動新增項目 ─────────────────────────────────────────────────────────────
@router.post("/{instance_id}/items")
async def add_bom_item(
    instance_id: uuid.UUID,
    item: BomItemCreate,
    db: AsyncSession = Depends(get_db),
):
    item_id = uuid.uuid4()
    await db.execute(
        text("""
            INSERT INTO bom_items
              (id, instance_id, category, name_zh, name_en,
               qty_value, qty_unit, width_mm, notes)
            VALUES (:id, :inst, :cat, :nzh, :nen, :qty, :unit, :w, :notes)
        """),
        {
            "id":   str(item_id),
            "inst": str(instance_id),
            "cat":  item.category,
            "nzh":  item.name_zh,
            "nen":  item.name_en,
            "qty":  item.qty_value,
            "unit": item.qty_unit,
            "w":    item.width_mm,
            "notes": item.notes,
        },
    )
    await db.commit()
    return {"item_id": str(item_id)}


# ─── 修改項目 ─────────────────────────────────────────────────────────────────
@router.patch("/items/{item_id}")
async def update_bom_item(
    item_id: uuid.UUID,
    body: BomItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    updates, params = [], {"id": str(item_id)}
    if body.qty_value  is not None: updates.append("qty_value = :qty");  params["qty"]   = body.qty_value
    if body.qty_unit   is not None: updates.append("qty_unit = :unit");  params["unit"]  = body.qty_unit
    if body.notes      is not None: updates.append("notes = :notes");    params["notes"] = body.notes
    if body.name_zh    is not None: updates.append("name_zh = :nzh");    params["nzh"]   = body.name_zh

    if not updates:
        return {"updated": False}

    await db.execute(
        text(f"UPDATE bom_items SET {', '.join(updates)} WHERE id = :id"),
        params,
    )
    await db.commit()
    return {"updated": True}


# ─── 刪除項目 ─────────────────────────────────────────────────────────────────
@router.delete("/items/{item_id}")
async def delete_bom_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("DELETE FROM bom_items WHERE id = :id"),
        {"id": str(item_id)},
    )
    await db.commit()
    return {"deleted": True}
