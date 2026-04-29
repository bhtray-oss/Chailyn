"""
garmentcode.py — GarmentCode 版型路由

透過 garmentcode-bridge 微服務（port 3002）提供 GarmentCode 打版功能。
若 bridge 未啟動，端點回傳 503 並說明安裝方式，不影響其他功能。

GET  /garmentcode/status          → bridge 是否在線
GET  /garmentcode/designs         → 列出可用設計
POST /garmentcode/draft           → 打版並回傳 SVG
"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from db.database import get_db
from services.garmentcode_client import is_available, list_designs, draft_svg

router = APIRouter()


# ── Status ───────────────────────────────────────────────────────────────────
@router.get("/status")
async def gc_status():
    """回傳 garmentcode-bridge 連線狀態"""
    available = await is_available()
    return {
        "available": available,
        "bridge_url": "http://localhost:3002",
        "note": "若為 False，請執行: cd services/garmentcode-bridge && pip install -r requirements.txt && python main.py",
    }


# ── List Designs ─────────────────────────────────────────────────────────────
@router.get("/designs")
async def gc_designs():
    """列出 GarmentCode 內建設計"""
    if not await is_available():
        raise HTTPException(503, "garmentcode-bridge 未啟動，請先啟動 services/garmentcode-bridge/main.py")
    return {"designs": await list_designs()}


# ── Draft ────────────────────────────────────────────────────────────────────
class GcDraftRequest(BaseModel):
    design_spec:     dict        # GarmentCode JSON spec
    measurements_cm: dict        # 身體測量值（cm）
    sa_mm:           int = 10    # 縫份 mm
    user_id:         uuid.UUID | None = None


@router.post("/draft", response_class=PlainTextResponse)
async def gc_draft(req: GcDraftRequest, db: AsyncSession = Depends(get_db)):
    """
    透過 GarmentCode 打版，回傳 SVG 字串。
    同時將結果儲存為 pattern_instances 紀錄（若提供 user_id）。
    """
    if not await is_available():
        raise HTTPException(503, "garmentcode-bridge 未啟動")

    svg = await draft_svg(req.design_spec, req.measurements_cm, req.sa_mm)
    if svg is None:
        raise HTTPException(500, "GarmentCode 打版失敗，請確認 design_spec 格式正確")

    # 可選：儲存至 pattern_instances（design = "garmentcode:<name>"）
    if req.user_id:
        design_name = req.design_spec.get("design_type", "garmentcode_custom")
        instance_id = uuid.uuid4()
        try:
            await db.execute(
                text("""
                    INSERT INTO pattern_instances
                      (id, user_id, design, version, svg_data, options_used)
                    VALUES
                      (:id, :uid, :design, 1, :svg, '{}')
                """),
                {
                    "id":     str(instance_id),
                    "uid":    str(req.user_id),
                    "design": f"gc:{design_name}",
                    "svg":    svg,
                },
            )
            await db.commit()
        except Exception as e:
            print(f"[garmentcode] Failed to save instance: {e}")

    return svg
