"""
armstrong.py — Armstrong patternmaking formula computation endpoints

GET  /armstrong/draft?user_id=<uuid>
     Fetches the user's latest body profile from DB,
     converts FreeSewing mm → Armstrong inches,
     runs the real armstrong_bodice.py draft engine,
     and returns accurate formula table + key point coordinates.

POST /armstrong/compute
     Body: { "measurements": { "chest": 920, "waist": 720, ... } }
     Directly compute formula table from provided mm measurements
     (no DB lookup — used when Next.js local storage has the profile
     but FastAPI DB does not).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
import json

from db.database import get_db
from services.armstrong_calc import compute_formula_table, fs_mm_to_armstrong
from services.pattern_geometry import generate_complete_pattern, serialize_pattern_result

router = APIRouter()


class ComputeRequest(BaseModel):
    measurements: dict   # FreeSewing mm measurements


class GeometryRequest(BaseModel):
    measurements: dict                  # FreeSewing mm measurements
    waistband_width: Optional[float] = 1.75   # inches
    pocket_opening:  Optional[float] = 6.0    # inches


@router.post("/compute")
async def post_armstrong_compute(body: ComputeRequest):
    """
    Compute Armstrong formula table directly from provided measurements (mm).
    No DB required — used when Next.js local storage has the profile.
    """
    fs_mm = body.measurements
    if not fs_mm.get("chest") or not fs_mm.get("waist"):
        raise HTTPException(
            status_code=422,
            detail="measurements must include at least 'chest' and 'waist' (mm)",
        )
    try:
        result = compute_formula_table(fs_mm)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Armstrong draft error: {exc}") from exc
    return result


@router.get("/draft")
async def get_armstrong_draft(
    user_id: str = Query(..., description="User UUID"),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch user's latest body profile → run Armstrong draft engine → return formula table.
    """
    # ── Get most complete body profile for this user ──────────────────────────
    # Prefer profiles that have chest + waist; fall back to latest
    row = await db.execute(
        text("""
            SELECT measurements
            FROM body_profiles
            WHERE user_id = :uid
              AND measurements->>'chest' IS NOT NULL
              AND measurements->>'waist'  IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"uid": user_id},
    )
    profile = row.fetchone()

    if not profile:
        raise HTTPException(status_code=404, detail="No body profile found for this user")

    # ── Parse measurements (stored as JSON in mm) ──────────────────────────────
    raw = profile[0]
    if isinstance(raw, str):
        fs_mm: dict = json.loads(raw)
    elif isinstance(raw, dict):
        fs_mm = raw
    else:
        raise HTTPException(status_code=500, detail="Invalid measurements format in DB")

    if not fs_mm.get("chest") or not fs_mm.get("waist"):
        raise HTTPException(
            status_code=422,
            detail="Body profile is missing required measurements (chest, waist)",
        )

    # ── Run Armstrong draft engine ─────────────────────────────────────────────
    try:
        result = compute_formula_table(fs_mm)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Armstrong draft error: {exc}") from exc

    return result


# ── POST /armstrong/geometry ────────────────────────────────────────────────
# Full pattern geometry: bodice + skirt sloper + flare + box pleats + pocket

@router.post("/geometry")
async def post_pattern_geometry(body: GeometryRequest):
    """
    Full geometric pattern computation:
      • Front + back bodice slopers (Ch.3)
      • In-set waistband dimensions
      • A-line flare skirt via slash-and-spread (Ch.5 + Ch.16 Principle #2)
      • Box pleat coordinate transform (Ch.5)
      • Side-seam pocket facing + bag (Ch.20)
      • Seam trueing report (Ch.24)
      • Production markings: notches, awl punches, grainlines, HBL (Ch.24)
    """
    fs_mm = body.measurements
    if not fs_mm.get("chest") or not fs_mm.get("waist"):
        raise HTTPException(
            status_code=422,
            detail="measurements must include at least 'chest' and 'waist' (mm)",
        )
    try:
        m       = fs_mm_to_armstrong(fs_mm)
        result  = generate_complete_pattern(
            m,
            waistband_width=body.waistband_width,
            pocket_opening=body.pocket_opening,
        )
        return serialize_pattern_result(result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Pattern geometry error: {exc}") from exc


@router.get("/geometry")
async def get_pattern_geometry(
    user_id: str = Query(...),
    waistband_width: float = Query(1.75),
    pocket_opening:  float = Query(6.0),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch user body profile → run full pattern geometry engine.
    """
    row = await db.execute(
        text("""
            SELECT measurements FROM body_profiles
            WHERE user_id = :uid
              AND measurements->>'chest' IS NOT NULL
              AND measurements->>'waist'  IS NOT NULL
            ORDER BY created_at DESC LIMIT 1
        """),
        {"uid": user_id},
    )
    profile = row.fetchone()
    if not profile:
        raise HTTPException(404, "No body profile found for this user")

    raw = profile[0]
    fs_mm = json.loads(raw) if isinstance(raw, str) else raw

    try:
        m      = fs_mm_to_armstrong(fs_mm)
        result = generate_complete_pattern(m, waistband_width=waistband_width,
                                           pocket_opening=pocket_opening)
        return serialize_pattern_result(result)
    except Exception as exc:
        raise HTTPException(500, f"Pattern geometry error: {exc}") from exc
