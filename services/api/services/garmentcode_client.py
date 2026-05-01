"""
garmentcode_client.py — 呼叫 garmentcode-bridge 微服務的非同步 client

bridge 服務在 port 3002，與主 API 完全隔離（避免 pygarment 的依賴污染）。
若 bridge 未啟動，所有方法回傳 None 並靜默失敗，不影響主流程。
"""
import os
import httpx
from typing import Optional

BRIDGE_URL = os.getenv("GARMENTCODE_BRIDGE_URL", "http://localhost:3002")
_TIMEOUT   = 60.0  # pygarment 打版可能需要幾秒


async def is_available() -> bool:
    """檢查 garmentcode-bridge 是否在線"""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{BRIDGE_URL}/health")
            return r.status_code == 200 and r.json().get("pygarment") is True
    except Exception:
        return False


async def list_designs() -> list[dict]:
    """取得 GarmentCode 內建設計清單"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{BRIDGE_URL}/designs")
            r.raise_for_status()
            return r.json().get("designs", [])
    except Exception as e:
        print(f"[garmentcode_client] list_designs failed: {e}")
        return []


async def draft_svg(
    design_spec: dict,
    measurements_cm: dict,
    sa_mm: int = 10,
) -> Optional[str]:
    """
    呼叫 bridge 打版，回傳 SVG 字串。
    失敗時回傳 None（不 raise）。

    Parameters
    ----------
    design_spec     : GarmentCode JSON spec（dict）
    measurements_cm : 身體測量值（cm）
    sa_mm           : 縫份（mm），預設 10
    """
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.post(
                f"{BRIDGE_URL}/draft",
                json={
                    "design_spec":  design_spec,
                    "measurements": measurements_cm,
                    "sa_mm":        sa_mm,
                },
            )
            r.raise_for_status()
            return r.text  # SVG 字串
    except Exception as e:
        print(f"[garmentcode_client] draft_svg failed: {e}")
        return None
