"""
garmentcode-bridge — GarmentCode pygarment 包裝服務（port 3002）

pygarment 2.0.2 PyPI 版本只提供核心類別框架，
不含 data_config / wrappers 等完整模組（存在於 GitHub 原始碼）。
目前：/health + /designs 正常運作；/draft 標示為 coming-soon。

未來升級路徑：
  pip install git+https://github.com/maria-korosteleva/GarmentCode.git
"""
import json
from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel

app = FastAPI(title="GarmentCode Bridge", version="1.0.0")

# ── 檢查 pygarment 核心是否可用 ─────────────────────────────────────────────
_gc_core_ok = False
try:
    from pattern.core import BasicPattern
    from garmentcode.base import BaseComponent
    _gc_core_ok = True
except Exception as _e:
    print(f"[bridge] pygarment core not available: {_e}")

# ── GarmentCode 設計目錄（手工整理自 GarmentCodeData 資料集）──────────────────
# 資料來源：SIGGRAPH Asia 2023 / ECCV 2024 論文，共收錄 19 種基礎款型。
GC_DESIGNS = [
    {"id": "Shirt",            "category": "top",      "skill": 2, "fabric": "light-medium",
     "description_zh": "基本梭織襯衫，可選長短袖、領型",
     "description_en": "Basic woven shirt, configurable collar and sleeve length"},
    {"id": "TShirt",           "category": "top",      "skill": 1, "fabric": "light-knit",
     "description_zh": "彈性針織 T-shirt，圓領",
     "description_en": "Stretch knit T-shirt, crew neck"},
    {"id": "Skirt",            "category": "bottom",   "skill": 1, "fabric": "light",
     "description_zh": "A 字直裙，可調腰圍與裙長",
     "description_en": "A-line straight skirt, adjustable waist and length"},
    {"id": "Pants",            "category": "bottom",   "skill": 2, "fabric": "medium",
     "description_zh": "直筒褲，含側縫與後中縫",
     "description_en": "Straight-leg trousers with side and back seams"},
    {"id": "WideLeggings",     "category": "bottom",   "skill": 1, "fabric": "medium-knit",
     "description_zh": "寬版針織內搭褲",
     "description_en": "Wide-leg knit leggings"},
    {"id": "SkirtWB",          "category": "bottom",   "skill": 2, "fabric": "medium",
     "description_zh": "含腰帶設計的合身裙",
     "description_en": "Fitted skirt with waistband"},
    {"id": "Dress",            "category": "dress",    "skill": 2, "fabric": "light-medium",
     "description_zh": "連身裙（上衣 + 裙合版）",
     "description_en": "One-piece dress (bodice + skirt)"},
    {"id": "JumpSuit",         "category": "dress",    "skill": 3, "fabric": "medium",
     "description_zh": "連身褲，長袖設計",
     "description_en": "Jumpsuit with long sleeves"},
    {"id": "Jumpsuit",         "category": "dress",    "skill": 3, "fabric": "medium",
     "description_zh": "連身褲（無袖版）",
     "description_en": "Jumpsuit (sleeveless variant)"},
    {"id": "Coat",             "category": "outerwear","skill": 4, "fabric": "heavy",
     "description_zh": "長版大衣，含駁領與裡布",
     "description_en": "Long coat with lapels and lining"},
    {"id": "StraightSkirt",    "category": "bottom",   "skill": 1, "fabric": "light-medium",
     "description_zh": "窄裙（鉛筆裙），合身設計",
     "description_en": "Straight/pencil skirt, fitted silhouette"},
    {"id": "FittedShirt",      "category": "top",      "skill": 2, "fabric": "light",
     "description_zh": "合身版型女士襯衫",
     "description_en": "Fitted woven shirt for women"},
    {"id": "CasualPants",      "category": "bottom",   "skill": 2, "fabric": "medium",
     "description_zh": "休閒直筒褲，鬆緊腰頭",
     "description_en": "Casual trousers with elastic waist"},
    {"id": "TightSkirt",       "category": "bottom",   "skill": 2, "fabric": "medium-knit",
     "description_zh": "緊身包臀裙",
     "description_en": "Tight-fitting bodycon skirt"},
    {"id": "Hoodie",           "category": "top",      "skill": 2, "fabric": "medium",
     "description_zh": "連帽上衣，袋鼠口袋",
     "description_en": "Hoodie with kangaroo pocket"},
    {"id": "ClassicShirtDress","category": "dress",    "skill": 2, "fabric": "light",
     "description_zh": "衫裙式連身裙，前門襟扣",
     "description_en": "Classic shirt dress with front button placket"},
    {"id": "AsymSkirt",        "category": "bottom",   "skill": 2, "fabric": "light",
     "description_zh": "不對稱下擺裙，前短後長",
     "description_en": "Asymmetric hem skirt, short front / long back"},
    {"id": "WrappedPants",     "category": "bottom",   "skill": 2, "fabric": "light",
     "description_zh": "圍裹式寬腿褲",
     "description_en": "Wrapped wide-leg pants"},
    {"id": "CasualTop",        "category": "top",      "skill": 1, "fabric": "light-medium",
     "description_zh": "休閒上衣，落肩設計",
     "description_en": "Casual top with drop-shoulder"},
]


# ── Health ───────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "pygarment": _gc_core_ok,
        "designs_available": len(GC_DESIGNS),
        "draft_available": False,  # coming soon — needs full GitHub install
    }


# ── Designs ──────────────────────────────────────────────────────────────────
@app.get("/designs")
async def list_designs(category: str | None = None):
    """列出 GarmentCode 設計目錄"""
    result = GC_DESIGNS
    if category:
        result = [d for d in result if d["category"] == category]
    return {
        "total":   len(result),
        "designs": result,
        "source":  "GarmentCodeData (SIGGRAPH Asia 2023 / ECCV 2024)",
        "note":    "SVG draft requires full GarmentCode GitHub install — coming soon",
    }


# ── Draft (coming soon) ──────────────────────────────────────────────────────
class DraftRequest(BaseModel):
    design_id:       str
    measurements_cm: dict
    sa_mm:           int = 10


@app.post("/draft", response_class=PlainTextResponse)
async def draft_pattern(req: DraftRequest):
    """
    GarmentCode 打版（開發中）。
    目前 PyPI 版 pygarment 缺少 data_config 等完整模組。
    建議改用 FreeSewing 版型（/patterns/draft）。
    """
    raise HTTPException(
        503,
        detail={
            "error":    "GarmentCode draft not yet available",
            "reason":   "pygarment PyPI 2.0.2 lacks data_config module (only in GitHub source)",
            "workaround": "Use FreeSewing patterns via POST /patterns/draft",
            "issue":    "https://github.com/maria-korosteleva/GarmentCode",
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3002, reload=True)
