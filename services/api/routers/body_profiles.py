"""
body_profiles.py — 身材檔案 CRUD（含版本控管 + 衍生尺寸）

POST /profiles/          → 新增
GET  /profiles/{user_id} → 列出（含歷史版本）
PATCH /profiles/{id}     → 更新（建新版本，原版保留）
"""
import uuid
import json
import math
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional

from db.database import get_db

router = APIRouter()

CM_TO_MM = 10   # 前端傳 cm，後端存 mm


# ─── 衍生尺寸自動計算 ──────────────────────────────────────────────────────────
def calc_derived(mm: dict) -> dict:
    """
    根據主量測值推算常用衍生尺寸（FreeSewing 部分設計會用到）。
    所有值都是 mm，精確到整數。
    """
    d: dict = {}
    chest = mm.get("chest")
    waist = mm.get("waist")
    hips  = mm.get("hips")
    highBust = mm.get("highBust")

    if chest:
        d["halfChest"]   = round(chest / 2)
        d["quarterChest"] = round(chest / 4)
    if waist:
        d["halfWaist"]   = round(waist / 2)
    if hips:
        d["halfHips"]    = round(hips / 2)
    # 胸差（用於女性版型收褶量計算）
    if chest and highBust:
        d["bustSpan"] = round(chest - highBust)
    return d


# ─── Pydantic models ──────────────────────────────────────────────────────────
class MeasurementsIn(BaseModel):
    """使用者輸入的 measurements（cm 單位）"""
    chest:            Optional[float] = None
    waist:            Optional[float] = None
    hips:             Optional[float] = None
    neck:             Optional[float] = None
    seat:             Optional[float] = None
    hpsToWaistBack:   Optional[float] = None
    shoulderToWrist:  Optional[float] = None
    shoulderWidth:    Optional[float] = None
    highBust:         Optional[float] = None
    biceps:           Optional[float] = None
    wrist:            Optional[float] = None
    inseam:           Optional[float] = None

    def to_mm(self) -> dict:
        return {
            k: round(v * CM_TO_MM)
            for k, v in self.model_dump().items()
            if v is not None
        }


class BodyProfileCreate(BaseModel):
    user_id:      uuid.UUID
    label:        str = "日常"
    measurements: MeasurementsIn
    source:       str = "manual"
    is_default:   bool = False
    notes:        Optional[str] = None
    is_public:    bool = False


class BodyProfileUpdate(BaseModel):
    measurements: MeasurementsIn
    notes:        Optional[str] = None
    label:        Optional[str] = None


# ─── 新增身材檔案 ─────────────────────────────────────────────────────────────
@router.post("/")
async def create_profile(
    body: BodyProfileCreate,
    db: AsyncSession = Depends(get_db),
):
    profile_id = uuid.uuid4()
    mm = body.measurements.to_mm()
    derived = calc_derived(mm)

    await db.execute(
        text("""
            INSERT INTO body_profiles
              (id, user_id, label, measurements, derived_measurements,
               source, is_default, notes, is_public, version)
            VALUES
              (:id, :user_id, :label, CAST(:measurements AS JSONB),
               CAST(:derived AS JSONB), :source, :is_default,
               :notes, :is_public, 1)
        """),
        {
            "id":           str(profile_id),
            "user_id":      str(body.user_id),
            "label":        body.label,
            "measurements": json.dumps(mm),
            "derived":      json.dumps(derived),
            "source":       body.source,
            "is_default":   body.is_default,
            "notes":        body.notes,
            "is_public":    body.is_public,
        },
    )
    await db.commit()
    return {
        "profile_id":          str(profile_id),
        "measurements_mm":     mm,
        "derived_measurements": derived,
        "version":             1,
    }


# ─── 列出使用者所有身材檔案 ───────────────────────────────────────────────────
@router.get("/{user_id}")
async def list_profiles(
    user_id: uuid.UUID,
    include_history: bool = False,
    db: AsyncSession = Depends(get_db),
):
    if include_history:
        # 傳回全部版本（含舊版）
        sql = """
            SELECT id, label, measurements, derived_measurements,
                   source, is_default, notes, is_public,
                   version, parent_id, created_at
            FROM body_profiles
            WHERE user_id = :uid
            ORDER BY label, version DESC
        """
    else:
        # 只回傳每條 label 的最新版（parent_id IS NULL 代表根版或已是最新）
        sql = """
            SELECT id, label, measurements, derived_measurements,
                   source, is_default, notes, is_public,
                   version, parent_id, created_at
            FROM body_profiles
            WHERE user_id = :uid
              AND id NOT IN (
                  SELECT DISTINCT parent_id FROM body_profiles
                  WHERE user_id = :uid AND parent_id IS NOT NULL
              )
            ORDER BY created_at DESC
        """
    result = await db.execute(text(sql), {"uid": str(user_id)})
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


# ─── 更新身材檔案（建立新版本，舊版保留） ─────────────────────────────────────
@router.patch("/{profile_id}")
async def update_profile(
    profile_id: uuid.UUID,
    body: BodyProfileUpdate,
    db: AsyncSession = Depends(get_db),
):
    # 1. 取得現有版本
    result = await db.execute(
        text("""
            SELECT id, user_id, label, measurements, version, notes, is_default, is_public
            FROM body_profiles WHERE id = :id
        """),
        {"id": str(profile_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到身材檔案")

    old = dict(row._mapping)
    new_version = old["version"] + 1
    new_id = uuid.uuid4()

    mm = body.measurements.to_mm()
    derived = calc_derived(mm)
    new_label = body.label if body.label is not None else old["label"]
    new_notes = body.notes if body.notes is not None else old.get("notes")

    # 2. 插入新版本（parent_id 指向舊版）
    await db.execute(
        text("""
            INSERT INTO body_profiles
              (id, user_id, label, measurements, derived_measurements,
               source, is_default, notes, is_public, version, parent_id)
            VALUES
              (:id, :user_id, :label, CAST(:measurements AS JSONB),
               CAST(:derived AS JSONB), 'manual', :is_default,
               :notes, :is_public, :version, :parent_id)
        """),
        {
            "id":           str(new_id),
            "user_id":      str(old["user_id"]),
            "label":        new_label,
            "measurements": json.dumps(mm),
            "derived":      json.dumps(derived),
            "is_default":   old["is_default"],
            "notes":        new_notes,
            "is_public":    old["is_public"],
            "version":      new_version,
            "parent_id":    str(profile_id),
        },
    )
    await db.commit()

    return {
        "new_profile_id":       str(new_id),
        "version":              new_version,
        "measurements_mm":      mm,
        "derived_measurements": derived,
        "previous_id":          str(profile_id),
    }


# ─── 取得單一身材檔案 ─────────────────────────────────────────────────────────
@router.get("/detail/{profile_id}")
async def get_profile(
    profile_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            SELECT id, user_id, label, measurements, derived_measurements,
                   source, is_default, notes, is_public, version, parent_id, created_at
            FROM body_profiles WHERE id = :id
        """),
        {"id": str(profile_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "找不到身材檔案")
    return dict(row._mapping)
