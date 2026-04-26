"""
auto_classify.py — 分析完成後自動分類布料、廓形、版型資料存入 DB

呼叫時機：_run_analysis() 完成 AI 分析後，在同一個 background task 內呼叫。

儲存目標：
  1. fabric_catalog       — 累積唯一布料，occurrence_count++
  2. garment_classifications — 每次分析的結構化摘要
  3. pattern_catalog      — 依推薦結果更新 suitable_fabrics / silhouette_codes
"""

import json
import re
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


# ─── 布料分類映射 ─────────────────────────────────────────────────────────────

FABRIC_CATEGORY_MAP: dict[str, str] = {
    # 針織
    "jersey": "knit", "knit": "knit", "stretch": "knit", "interlock": "knit",
    "rib": "knit", "rib knit": "knit", "french terry": "knit",
    "sweatshirt": "knit", "fleece": "knit", "spandex": "knit",
    "lycra": "knit", "elastane": "knit", "swim fabric": "knit",
    "power mesh": "knit",
    # 梭織
    "cotton": "woven", "linen": "woven", "silk": "woven", "wool": "woven",
    "polyester": "woven", "rayon": "woven", "viscose": "woven",
    "poplin": "woven", "chambray": "woven", "denim": "woven",
    "twill": "woven", "tweed": "woven", "crepe": "woven",
    "chiffon": "woven", "organza": "woven", "satin": "woven",
    "brocade": "woven", "jacquard": "woven", "challis": "woven",
    "batik": "woven", "coating": "woven", "melton": "woven",
    "canvas": "woven", "muslin": "woven", "voile": "woven",
    # 皮革
    "leather": "leather", "faux leather": "leather", "suede": "leather",
    # 特殊
    "lace": "specialty", "mesh": "specialty", "tulle": "specialty",
    "velvet": "specialty", "corduroy": "specialty",
}

WEIGHT_MAP: dict[str, str] = {
    "light": "light", "lightweight": "light", "sheer": "light",
    "medium": "medium", "mid-weight": "medium",
    "heavy": "heavy", "heavyweight": "heavy",
    "extra_heavy": "extra_heavy", "coating": "heavy", "denim": "heavy",
}

STRETCH_MAP: dict[str, str] = {
    "none": "none", "woven": "none",
    "stable_knit": "stable_knit", "stable": "stable_knit",
    "moderate_stretch": "moderate_stretch", "moderate": "moderate_stretch",
    "stretchy_knit": "stretchy_knit", "stretchy": "stretchy_knit",
    "super_stretch": "super_stretch", "super": "super_stretch",
    "spandex": "super_stretch", "lycra": "super_stretch",
    "swim fabric": "stretchy_knit", "jersey": "moderate_stretch",
    "knit": "moderate_stretch", "rib knit": "super_stretch",
    "interlock": "moderate_stretch", "fleece": "stable_knit",
}


def _normalize_fabric_name(raw: str) -> str:
    """小寫、去括號、取主要布料名稱。"""
    name = raw.lower().strip()
    name = re.sub(r"\([^)]*\)", "", name).strip()
    name = re.sub(r"\s+", " ", name)
    # 取第一個逗號或斜線前的部分
    name = name.split(",")[0].split("/")[0].strip()
    return name


def _infer_category(name: str) -> str:
    for key, cat in FABRIC_CATEGORY_MAP.items():
        if key in name:
            return cat
    return "woven"


def _infer_stretch(name: str, category: str) -> str:
    for key, grade in STRETCH_MAP.items():
        if key in name:
            return grade
    if category == "knit":
        return "moderate_stretch"
    return "none"


async def classify_and_store(
    db: AsyncSession,
    analysis_id: str,
    photo_id: str,
    user_id: str,
    analysis: dict[str, Any],
) -> None:
    """
    主入口：解析 Claude Vision 結果，自動分類並寫入 DB。
    """
    try:
        await _upsert_fabric(db, analysis, analysis_id, photo_id, user_id)
        await _update_pattern_catalog(db, analysis)
    except Exception as e:
        # 分類失敗不中斷主流程，僅 log
        print(f"[auto_classify] Warning: {e}")


# ─── 1. 布料目錄 upsert ───────────────────────────────────────────────────────

async def _upsert_fabric(
    db: AsyncSession,
    analysis: dict,
    analysis_id: str,
    photo_id: str,
    user_id: str,
) -> None:
    fabric_data = analysis.get("fabric", {})
    primary = fabric_data.get("primary", {})
    raw_name = primary.get("name") or primary.get("type") or ""
    if not raw_name:
        return

    name = _normalize_fabric_name(raw_name)
    category = _infer_category(name)
    weight_raw = primary.get("weight", "")
    weight = next((v for k, v in WEIGHT_MAP.items() if k in weight_raw.lower()), "medium")
    drape = primary.get("drape")
    composition = primary.get("composition_estimate") or ""
    stretch = _infer_stretch(name, category)

    # 推薦版型列表
    recommended = [
        p["design"]
        for p in analysis.get("closest_freesewing_patterns", [])[:3]
    ]

    # Upsert fabric_catalog
    result = await db.execute(
        text("SELECT id FROM fabric_catalog WHERE name = :name"),
        {"name": name},
    )
    row = result.fetchone()

    if row:
        fabric_id = str(row.id)
        # 更新 occurrence_count，合併推薦版型
        await db.execute(
            text("""
                UPDATE fabric_catalog SET
                    occurrence_count = occurrence_count + 1,
                    drape_score = COALESCE(:drape, drape_score),
                    composition_typical = COALESCE(:comp, composition_typical),
                    suitable_designs = (
                        SELECT ARRAY(
                            SELECT DISTINCT unnest(
                                COALESCE(suitable_designs, '{}') || :designs::text[]
                            )
                        )
                    ),
                    updated_at = now()
                WHERE id = :id
            """),
            {
                "id": fabric_id,
                "drape": drape,
                "comp": composition or None,
                "designs": recommended,
            },
        )
    else:
        import uuid
        fabric_id = str(uuid.uuid4())
        await db.execute(
            text("""
                INSERT INTO fabric_catalog
                  (id, name, category, weight, drape_score, stretch_grade,
                   composition_typical, suitable_designs)
                VALUES
                  (:id, :name, :cat, :wt, :drape, :stretch, :comp, :designs)
            """),
            {
                "id": fabric_id,
                "name": name,
                "cat": category,
                "wt": weight,
                "drape": drape,
                "stretch": stretch,
                "comp": composition or None,
                "designs": recommended,
            },
        )

    # Insert garment_classifications
    cut = analysis.get("cut", {})
    components = analysis.get("components", {})
    collar = components.get("collar", {})
    sleeves = components.get("sleeves", {})

    collar_type = (collar.get("type") if isinstance(collar, dict) else collar) or None
    sleeve_type = (sleeves.get("type") if isinstance(sleeves, dict) else sleeves) or None

    import uuid
    await db.execute(
        text("""
            INSERT INTO garment_classifications
              (id, analysis_id, photo_id, user_id, fabric_id, fabric_name,
               fabric_category, fabric_weight, silhouette, collar_type,
               sleeve_type, fit_ease, garment_category, garment_type_detail,
               difficulty, recommended_designs, silhouette_tags)
            VALUES
              (:id, :analysis_id, :photo_id, :user_id, :fabric_id, :fabric_name,
               :fab_cat, :fab_wt, :silhouette, :collar_type,
               :sleeve_type, :fit_ease, :garment_cat, :garment_detail,
               :difficulty, :designs, :tags)
            ON CONFLICT DO NOTHING
        """),
        {
            "id": str(uuid.uuid4()),
            "analysis_id": analysis_id,
            "photo_id": photo_id,
            "user_id": user_id,
            "fabric_id": fabric_id,
            "fabric_name": name,
            "fab_cat": category,
            "fab_wt": weight,
            "silhouette": cut.get("silhouette"),
            "collar_type": collar_type,
            "sleeve_type": sleeve_type,
            "fit_ease": cut.get("fit_ease"),
            "garment_cat": analysis.get("garment_category"),
            "garment_detail": analysis.get("garment_type_detail"),
            "difficulty": analysis.get("difficulty_estimate"),
            "designs": recommended,
            "tags": analysis.get("silhouette_tags", []),
        },
    )

    await db.commit()


# ─── 2. pattern_catalog 更新 ─────────────────────────────────────────────────

async def _update_pattern_catalog(db: AsyncSession, analysis: dict) -> None:
    """
    依分析結果更新推薦版型的 suitable_fabrics 與 silhouette_codes。
    pattern-via-io 概念：每次分析 = 一次版型-布料對應知識的積累。
    """
    fabric_data = analysis.get("fabric", {})
    primary = fabric_data.get("primary", {})
    raw_name = primary.get("name") or primary.get("type") or ""
    if not raw_name:
        return

    fabric_name = _normalize_fabric_name(raw_name)
    silhouette = analysis.get("cut", {}).get("silhouette", "")
    cut = analysis.get("cut", {})
    collar = analysis.get("components", {}).get("collar", {})
    sleeves = analysis.get("components", {}).get("sleeves", {})
    collar_type = (collar.get("type") if isinstance(collar, dict) else collar) or None
    sleeve_type = (sleeves.get("type") if isinstance(sleeves, dict) else sleeves) or None

    for rec in analysis.get("closest_freesewing_patterns", [])[:3]:
        design = rec.get("design", "")
        if not design:
            continue

        update_parts = []
        params: dict = {"design": design}

        if fabric_name:
            update_parts.append("""
                suitable_fabrics = (
                    SELECT ARRAY(SELECT DISTINCT unnest(
                        COALESCE(suitable_fabrics,'{}') || ARRAY[:fabric_name]
                    ))
                )
            """)
            params["fabric_name"] = fabric_name

        if silhouette:
            update_parts.append("""
                silhouette_codes = (
                    SELECT ARRAY(SELECT DISTINCT unnest(
                        COALESCE(silhouette_codes,'{}') || ARRAY[:silhouette]
                    ))
                )
            """)
            params["silhouette"] = silhouette

        if collar_type:
            update_parts.append("""
                collar_types = (
                    SELECT ARRAY(SELECT DISTINCT unnest(
                        COALESCE(collar_types,'{}') || ARRAY[:collar_type]
                    ))
                )
            """)
            params["collar_type"] = collar_type

        if sleeve_type:
            update_parts.append("""
                sleeve_types = (
                    SELECT ARRAY(SELECT DISTINCT unnest(
                        COALESCE(sleeve_types,'{}') || ARRAY[:sleeve_type]
                    ))
                )
            """)
            params["sleeve_type"] = sleeve_type

        if update_parts:
            sql = f"""
                UPDATE pattern_catalog
                SET {', '.join(update_parts)}, updated_at = now()
                WHERE fs_design_id = :design
            """
            await db.execute(text(sql), params)

    await db.commit()
