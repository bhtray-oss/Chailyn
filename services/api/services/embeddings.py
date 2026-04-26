"""
embeddings.py — 語意搜尋用文字嵌入服務

使用 sentence-transformers paraphrase-multilingual-MiniLM-L12-v2
支援中英文混合查詢（如「寬鬆棉質連帽衫」、「fitted linen shirt」）

向量維度：384（存入 pgvector 前 zero-pad 到 512 以符合 DB schema，
或直接改 schema；這裡選擇存真實 384 維並新增專用欄位）
"""
from __future__ import annotations
import hashlib
import json
from functools import lru_cache
from typing import Optional

import numpy as np

# Lazy import: 只在第一次呼叫時載入模型（避免啟動時阻塞）
_model = None
MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
EMBED_DIM   = 384


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed_text(text: str) -> list[float]:
    """
    將文字轉成 384 維向量（list of float）。
    """
    model  = _get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()


def embed_analysis(analysis: dict) -> dict[str, list[float]]:
    """
    從 Claude Vision 分析結果中萃取語意，生成兩個向量：
    - fabric_vec：布料語意（name + composition + weight + drape/thickness/stretch）
    - cut_vec：剪裁語意（silhouette + fit_ease + collar + sleeve + garment_type + tags）

    支援新版（含 collar.type / sleeves.type 結構物件）與舊版（字串）格式。
    回傳 { "fabric": [...], "cut": [...] }
    """
    # ── 布料文字 ──
    fabric_parts: list[str] = []
    f = (analysis.get("fabric") or {}).get("primary") or {}
    if f.get("name"):             fabric_parts.append(f["name"])
    if f.get("composition_estimate"): fabric_parts.append(f["composition_estimate"])
    if f.get("weight"):           fabric_parts.append(f["weight"])
    if f.get("drape") is not None:
        fabric_parts.append(f"drape {f['drape']}")
    if f.get("thickness") is not None:
        fabric_parts.append(f"thickness {f['thickness']}")
    if f.get("stretch") is not None:
        fabric_parts.append(f"stretch {f['stretch']}")
    if f.get("stretch_pct_estimate") is not None:
        pct = f["stretch_pct_estimate"]
        stretch_label = "super stretch" if pct >= 75 else ("stretchy" if pct >= 40 else ("moderate stretch" if pct >= 20 else "stable"))
        fabric_parts.append(stretch_label)
    sec = (analysis.get("fabric") or {}).get("secondary") or {}
    if sec.get("name"):           fabric_parts.append(sec["name"])
    fabric_text = ", ".join(filter(None, fabric_parts)) or "unknown fabric"

    # ── 剪裁文字 ──
    cut_parts: list[str] = []
    c = analysis.get("cut") or {}
    if c.get("silhouette"):       cut_parts.append(c["silhouette"].replace("_", " "))
    if c.get("fit_ease"):         cut_parts.append(c["fit_ease"].replace("_", " "))
    if c.get("waist_treatment"):  cut_parts.append(c["waist_treatment"])
    for sl in (c.get("stylelines") or []):
        cut_parts.append(str(sl))

    # 新版 components 結構：collar/sleeves 可能是 dict 或 str
    comp = analysis.get("components") or {}
    collar = comp.get("collar")
    if isinstance(collar, dict):
        if collar.get("type"):        cut_parts.append(collar["type"].replace("_", " "))
        if collar.get("description"): cut_parts.append(collar["description"])
    elif isinstance(collar, str) and collar:
        cut_parts.append(collar)

    sleeves = comp.get("sleeves")
    if isinstance(sleeves, dict):
        if sleeves.get("type"):       cut_parts.append(sleeves["type"].replace("_", " "))
        if sleeves.get("length"):     cut_parts.append(sleeves["length"])
        if sleeves.get("cuff_type"):  cut_parts.append(sleeves["cuff_type"].replace("_", " "))
    elif isinstance(sleeves, str) and sleeves:
        cut_parts.append(sleeves)

    closures = comp.get("closures")
    if isinstance(closures, dict):
        if closures.get("type"):      cut_parts.append(closures["type"].replace("_", " "))
    elif isinstance(closures, str) and closures:
        cut_parts.append(closures)

    # 服裝大類 + 詳細類型
    if analysis.get("garment_category"):
        cut_parts.append(analysis["garment_category"])
    if analysis.get("garment_type_detail"):
        cut_parts.append(analysis["garment_type_detail"])
    if analysis.get("skirt_type"):
        cut_parts.append(analysis["skirt_type"].replace("_", " "))
    if analysis.get("pant_type"):
        cut_parts.append(analysis["pant_type"].replace("_", " "))

    for tag in (analysis.get("silhouette_tags") or []):
        cut_parts.append(tag.replace("_", " "))

    cut_text = ", ".join(filter(None, cut_parts)) or "unknown cut"

    return {
        "fabric": embed_text(fabric_text),
        "cut":    embed_text(cut_text),
    }


def embed_catalog_item(item: dict) -> list[float]:
    """
    為 pattern_catalog 的一筆記錄生成語意向量
    （name + description_zh + tags + garment_type + fabric_weight）
    """
    parts: list[str] = []
    if item.get("name"):            parts.append(item["name"])
    if item.get("description_zh"):  parts.append(item["description_zh"])
    if item.get("garment_type"):    parts.append(item["garment_type"])
    if item.get("fabric_weight"):   parts.append(item["fabric_weight"])
    for tag in (item.get("tags") or []):
        parts.append(tag.replace("-", " "))
    text = " ".join(parts)
    return embed_text(text)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = (np.linalg.norm(va) * np.linalg.norm(vb))
    return float(np.dot(va, vb) / denom) if denom > 0 else 0.0
