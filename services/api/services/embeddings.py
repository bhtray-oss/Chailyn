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
    - fabric_vec：布料語意（name + composition + drape/thickness/stretch）
    - cut_vec：剪裁語意（silhouette + ease + components + tags）

    回傳 { "fabric": [...], "cut": [...] }
    """
    # ── 布料文字 ──
    fabric_parts: list[str] = []
    f = (analysis.get("fabric") or {}).get("primary") or {}
    if f.get("name"):             fabric_parts.append(f["name"])
    if f.get("composition_estimate"): fabric_parts.append(f["composition_estimate"])
    if f.get("drape") is not None:
        fabric_parts.append(f"drape {f['drape']}")
    if f.get("thickness") is not None:
        fabric_parts.append(f"thickness {f['thickness']}")
    if f.get("stretch") is not None:
        fabric_parts.append(f"stretch {f['stretch']}")
    sec = (analysis.get("fabric") or {}).get("secondary") or {}
    if sec.get("name"):           fabric_parts.append(sec["name"])
    fabric_text = ", ".join(filter(None, fabric_parts)) or "unknown fabric"

    # ── 剪裁文字 ──
    cut_parts: list[str] = []
    c = analysis.get("cut") or {}
    if c.get("silhouette"):       cut_parts.append(c["silhouette"])
    if c.get("ease_estimate"):    cut_parts.append(c["ease_estimate"])
    comp = analysis.get("components") or {}
    for k in ("collar", "sleeves", "pockets", "closures"):
        if comp.get(k):           cut_parts.append(str(comp[k]))
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
