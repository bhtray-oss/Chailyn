"""
garmentcode-bridge — GarmentCode pygarment 包裝服務（port 3002）

獨立微服務，與 services/api 完全隔離，避免 fastapi / pydantic 版本衝突。
提供 REST API 讓主 API 呼叫：

  GET  /designs          → 列出所有可用 GarmentCode 設計
  POST /draft            → 從 JSON spec + body measurements 生成 SVG 版型
  GET  /health           → 健康檢查
"""
import io
import json
import importlib
import pkgutil
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

app = FastAPI(title="GarmentCode Bridge", version="1.0.0")


# ── 延遲載入 pygarment（啟動時不立即 import，避免在無 GPU 環境崩潰）──────────────
_gc_available = None

def _check_gc() -> bool:
    global _gc_available
    if _gc_available is None:
        try:
            import pygarment  # noqa: F401
            _gc_available = True
        except Exception:
            _gc_available = False
    return _gc_available


# ── GarmentCode 內建設計清單（pygarment.assets 底下的範例） ──────────────────────
# 若 pygarment 已正確安裝，可動態掃描；否則回傳空列表。
def _list_builtin_designs() -> list[dict]:
    if not _check_gc():
        return []
    try:
        import pygarment
        assets_dir = Path(pygarment.__file__).parent / "assets" / "design_params"
        if not assets_dir.exists():
            # 嘗試其他路徑
            assets_dir = Path(pygarment.__file__).parent / "assets"

        designs = []
        for f in sorted(assets_dir.rglob("*.yaml")) if assets_dir.exists() else []:
            import yaml
            spec = yaml.safe_load(f.read_text())
            designs.append({
                "id":          f.stem,
                "file":        str(f.relative_to(assets_dir.parent)),
                "description": spec.get("description", f.stem),
            })
        return designs
    except Exception as e:
        return [{"error": str(e)}]


# ── API Endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "pygarment": _check_gc()}


@app.get("/designs")
async def list_designs():
    """列出所有可用 GarmentCode 設計（含內建範例）"""
    if not _check_gc():
        raise HTTPException(503, "pygarment 未正確安裝")
    return {"designs": _list_builtin_designs()}


class DraftRequest(BaseModel):
    design_spec: dict        # GarmentCode JSON / YAML spec（dict 格式）
    measurements: dict       # 身體測量值（cm，會轉為 mm）
    sa_mm: int = 10          # 縫份 mm


@app.post("/draft", response_class=PlainTextResponse)
async def draft_pattern(req: DraftRequest):
    """
    接收 GarmentCode JSON spec + body measurements，
    透過 pygarment 生成 SVG 版型並回傳 SVG 字串。
    """
    if not _check_gc():
        raise HTTPException(503, "pygarment 未正確安裝")

    try:
        from pygarment import BodyMeasurements, Pattern
        import tempfile, os

        # 測量值 cm → mm
        meas_mm = {k: v * 10 for k, v in req.measurements.items()}
        body = BodyMeasurements(meas_mm)

        # 從 dict 建立版型物件
        pattern = Pattern(design_params=req.design_spec, body=body)
        pattern.assembly()

        # 輸出 SVG
        with tempfile.TemporaryDirectory() as tmp:
            svg_path = Path(tmp) / "pattern.svg"
            pattern.serialize(tmp, to_svg=True, add_seam_allowance=req.sa_mm > 0)
            svgs = list(Path(tmp).glob("*.svg"))
            if not svgs:
                raise ValueError("pygarment 未輸出 SVG 檔案")
            # 合併所有片版 SVG（簡單串接）
            combined = "\n".join(s.read_text() for s in sorted(svgs))
            return combined

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"GarmentCode 打版失敗: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3002, reload=True)
