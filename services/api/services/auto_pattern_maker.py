"""
auto_pattern_maker.py — AI 自動打版服務
來源理論：Patternmaking for Fashion Design, 5th Ed. (Armstrong)

根據 AI 服裝分析結果與身體量測資料：
1. Armstrong 公式計算臀腰差省道量、罩杯尺寸、袖型參數
2. 對所有 FreeSewing 設計評分，選出最佳匹配
3. 映射分析特徵 → 設計 options
4. 回傳打版請求參數（不直接呼叫 engine）
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Optional

from .patternmaking_rules import (
    DESIGN_RULES,
    EASE_STANDARDS_MM,
    SEAM_ALLOWANCE_BY_GARMENT,
    DesignMatchRule,
)

INCH = 25.4  # mm per inch

# ─── Armstrong 個人省道量表（裙型，hip - waist 差，英吋）─────────────────────
# columns: hip_waist_diff, front_dart_count, front_intake_in, back_dart_count, back_intake_in
_DART_TABLE = [
    ( 4, 1, 0.500, 1, 0.750),
    ( 5, 1, 0.500, 1, 1.000),
    ( 6, 1, 0.500, 2, 0.625),
    ( 7, 1, 0.500, 2, 0.750),
    ( 8, 2, 0.375, 2, 0.875),
    ( 9, 2, 0.375, 2, 0.875),
    (10, 2, 0.500, 2, 1.000),
    (11, 2, 0.625, 2, 1.125),
    (12, 2, 0.625, 2, 1.250),
    (13, 2, 0.625, 2, 1.375),
    (14, 2, 0.625, 2, 1.375),
]

# Armstrong 袖型測量表（Size 6–18）
# columns: us_size, sleeve_len_in, cap_height_in, biceps_in
_SLEEVE_TABLE = [
    ( 6, 21.50, 5.500, 12.25),
    ( 8, 21.75, 5.625, 12.625),
    (10, 22.00, 5.750, 13.00),
    (12, 22.25, 5.875, 13.50),
    (14, 22.50, 6.000, 14.00),
    (16, 22.75, 6.125, 14.50),
    (18, 23.00, 6.250, 15.125),
]

# Armstrong 胸圍（arc = ½ 圍） → 美規尺寸對照（Size 10 bust arc = 10"）
_SIZE_BY_BUST_ARC_IN = [
    ( 9.25,  6), ( 9.75,  8), (10.00, 10), (10.50, 12),
    (11.00, 14), (11.25, 16), (12.00, 18),
]

# 特定設計的性別歸屬
_MALE_DESIGNS   = {"brian", "carlton", "cornelius", "charlie"}
_FEMALE_DESIGNS = {"bella", "carlita", "jaeger", "simone", "lily", "lunetius"}


def _get(d: dict, *keys: str, default: Any = None) -> Any:
    for k in keys:
        if not isinstance(d, dict):
            return default
        d = d.get(k, default)
    return d


# ─── Armstrong 計算層 ──────────────────────────────────────────────────────────

@dataclass
class ArmstrongMetrics:
    # 臀腰差 & 省道
    hip_waist_diff_in: float = 0.0
    front_dart_count: int = 1
    front_dart_intake_in: float = 0.5
    back_dart_count: int = 1
    back_dart_intake_in: float = 0.75

    # 罩杯（B 為標準）
    bust_cup: str = "B"
    cup_spread_in: float = 0.0       # 正 = 展開 (C/D/DD)，負 = 收攏 (A)

    # 袖型（對應美規尺寸）
    approx_us_size: int = 10
    sleeve_length_in: float = 22.0
    cap_height_in: float = 5.75
    biceps_in: float = 13.0

    # 胸腰臀鬆量等級
    ease_level: str = "semi_fitted"   # fitted / semi_fitted / relaxed / oversized


def calculate_armstrong_metrics(meas: dict[str, float]) -> ArmstrongMetrics:
    """
    meas: body_profiles.measurements（mm，FreeSewing 鍵名）
    """
    m = ArmstrongMetrics()

    # ── 臀腰差 → 省道量 ──────────────────────────────────────────────────────
    waist_mm = meas.get("waist", 0)
    hips_mm  = meas.get("hips",  0)
    if waist_mm and hips_mm:
        diff_in = (hips_mm - waist_mm) / INCH
        m.hip_waist_diff_in = diff_in
        best = min(_DART_TABLE, key=lambda row: abs(row[0] - diff_in))
        m.front_dart_count    = best[1]
        m.front_dart_intake_in = best[2]
        m.back_dart_count     = best[3]
        m.back_dart_intake_in = best[4]

    # ── 罩杯（胸圍 - 高胸圍差值）─────────────────────────────────────────────
    chest_mm    = meas.get("chest",    0)
    high_bust   = meas.get("highBust", 0)
    if chest_mm and high_bust:
        cup_diff_in = (chest_mm - high_bust) / INCH
        if cup_diff_in <= 1.0:
            m.bust_cup, m.cup_spread_in = "A", -0.375
        elif cup_diff_in <= 2.0:
            m.bust_cup, m.cup_spread_in = "B",  0.0
        elif cup_diff_in <= 3.0:
            m.bust_cup, m.cup_spread_in = "C",  0.375
        elif cup_diff_in <= 4.0:
            m.bust_cup, m.cup_spread_in = "D",  0.75
        else:
            m.bust_cup, m.cup_spread_in = "DD", 1.0

    # ── 美規尺寸 & 袖型參數 ──────────────────────────────────────────────────
    if chest_mm:
        bust_arc_in = (chest_mm / 2) / INCH
        best_size = min(_SIZE_BY_BUST_ARC_IN, key=lambda r: abs(r[0] - bust_arc_in))
        m.approx_us_size = best_size[1]
        sleeve_row = min(_SLEEVE_TABLE, key=lambda r: abs(r[0] - m.approx_us_size))
        m.sleeve_length_in = sleeve_row[1]
        m.cap_height_in    = sleeve_row[2]
        m.biceps_in        = sleeve_row[3]

    # ── 整體鬆量等級（從臀腰差推測廓形偏好）────────────────────────────────
    if m.hip_waist_diff_in >= 10:
        m.ease_level = "fitted"      # 曲線明顯 → 通常喜歡合身版型
    elif m.hip_waist_diff_in >= 7:
        m.ease_level = "semi_fitted"
    else:
        m.ease_level = "relaxed"

    return m


# ─── 設計評分 ─────────────────────────────────────────────────────────────────

def _score_design(rule: DesignMatchRule, analysis: dict, arm: ArmstrongMetrics) -> float:
    score = 0.0

    # 1. 服裝大類（最重要）
    category = _get(analysis, "garment_category", default="")
    if category == "dress":
        category = "top"  # dress 映射到 top + 長版
    if category and rule.garment_category == category:
        score += 0.35

    # 2. 輪廓線
    silhouette = _get(analysis, "cut", "silhouette", default="")
    if silhouette and silhouette in rule.silhouettes:
        score += 0.15

    # 3. 領型
    collar = _get(analysis, "components", "collar", "type", default="")
    if collar and collar in rule.collar_types:
        score += 0.20

    # 4. 袖型
    sleeve = _get(analysis, "components", "sleeves", "type", default="")
    if sleeve and sleeve in rule.sleeve_types:
        score += 0.20

    # 5. Claude Vision 直接點名的設計（最高額外分）
    mentioned = _get(analysis, "closest_freesewing_patterns", default=[]) or []
    if isinstance(mentioned, list) and rule.fs_design_id in mentioned:
        score += 0.25
    elif isinstance(mentioned, list):
        # partial: design name substring
        for m in mentioned:
            if isinstance(m, str) and rule.fs_design_id in m.lower():
                score += 0.15
                break

    # 6. 布料重量 vs 難度適合度
    weight = _get(analysis, "fabric", "weight", default="")
    if weight == "heavy" and rule.difficulty >= 3:
        score += 0.05
    elif weight in ("light", "medium") and rule.difficulty <= 2:
        score += 0.05

    # 7. 針織布偏好
    stretch = _get(analysis, "fabric", "stretch", default=False)
    if stretch and any(k in rule.fabric_types for k in ["針織", "jersey", "彈性針織"]):
        score += 0.08

    return round(score, 3)


# ─── FreeSewing 設計 Options 映射 ───────────────────────────────────────────

# 各設計的 collar/sleeve 選項名及值（FreeSewing camelCase）
_DESIGN_OPTION_MAP: dict[str, dict] = {
    "simon": {
        "collar_style_key": "collarStyle",
        "collar_values": {
            "basic_shirt_collar": "classic",
            "convertible":        "classic",
            "mandarin":           "band",
            "stand_collar":       "band",
        },
        "cuff_style_key": "cuffStyle",
        "cuff_values": {
            "basic_shirt_cuff": "classical",
            "french_cuff":      "frenchCuff",
            "roll_up_cuff":     "classical",
        },
    },
    "simone": {
        "collar_style_key": "collarStyle",
        "collar_values": {
            "basic_shirt_collar": "classic",
            "convertible":        "classic",
            "mandarin":           "band",
        },
        "cuff_style_key": "cuffStyle",
        "cuff_values": {
            "basic_shirt_cuff": "classical",
            "french_cuff":      "frenchCuff",
        },
    },
    "huey": {
        "pocket_key":    "kangarooPocket",
        "pocket_default": True,
    },
    "hugo": {
        "pocket_key":    "kangarooPocket",
        "pocket_default": True,
    },
    "sandy": {
        "waistband_key":     "waistbandWidth",
        "waistband_default": 30,   # mm
    },
    "waralee": {
        "waistband_key":     "waistbandWidth",
        "waistband_default": 30,
    },
    "paco": {
        "elastic_key":       "elasticWidth",
        "elastic_default":   25,
    },
}


def _build_options(design_id: str, analysis: dict, arm: ArmstrongMetrics, prefs: dict) -> dict:
    opts: dict = {}
    dmap = _DESIGN_OPTION_MAP.get(design_id, {})

    # collar style
    collar_type = _get(analysis, "components", "collar", "type", default="")
    if "collar_style_key" in dmap and collar_type:
        val = dmap["collar_values"].get(collar_type)
        if val:
            opts[dmap["collar_style_key"]] = val

    # cuff style
    cuff_type = _get(analysis, "components", "sleeves", "cuff_type", default="")
    if "cuff_style_key" in dmap and cuff_type:
        val = dmap["cuff_values"].get(cuff_type)
        if val:
            opts[dmap["cuff_style_key"]] = val

    # pocket
    if "pocket_key" in dmap:
        components = _get(analysis, "components", default={}) or {}
        has_pocket = any("pocket" in str(k).lower() for k in components)
        opts[dmap["pocket_key"]] = has_pocket or dmap["pocket_default"]

    # waistband
    if "waistband_key" in dmap:
        opts[dmap["waistband_key"]] = dmap["waistband_default"]

    # elastic
    if "elastic_key" in dmap:
        opts[dmap["elastic_key"]] = dmap["elastic_default"]

    # ease multiplier for fitted designs — hint only, FreeSewing handles actual ease
    fit_ease = _get(analysis, "cut", "fit_ease", default=arm.ease_level)
    if design_id in ("bella", "brian", "noble") and fit_ease == "fitted":
        opts["fitEase"] = "fitted"

    return opts


# ─── 性別判定 ────────────────────────────────────────────────────────────────

def _detect_gender(design_id: str, analysis: dict) -> str:
    if design_id in _MALE_DESIGNS:
        return "cisMale"
    if design_id in _FEMALE_DESIGNS:
        return "cisFemale"
    # 從分析文字推測
    detail = str(_get(analysis, "garment_type_detail", default="")).lower()
    if any(w in detail for w in ("men", "male", "masculine", "shirt", "suit")):
        return "cisMale"
    return "cisFemale"


# ─── 打版建議理由 ────────────────────────────────────────────────────────────

def _build_reasoning(
    rule: DesignMatchRule,
    analysis: dict,
    arm: ArmstrongMetrics,
    score: float,
) -> list[str]:
    r = []

    category = _get(analysis, "garment_category", default="")
    if category == rule.garment_category:
        r.append(f"服裝類別匹配：{category}")

    collar = _get(analysis, "components", "collar", "type", default="")
    if collar and collar in rule.collar_types:
        r.append(f"領型匹配：{collar}")

    sleeve = _get(analysis, "components", "sleeves", "type", default="")
    if sleeve and sleeve in rule.sleeve_types:
        r.append(f"袖型匹配：{sleeve}")

    if arm.hip_waist_diff_in > 0:
        r.append(
            f"Armstrong 臀腰差 {arm.hip_waist_diff_in:.1f}\" → "
            f"前 {arm.front_dart_count} 省（{arm.front_dart_intake_in}\" 每省），"
            f"後 {arm.back_dart_count} 省（{arm.back_dart_intake_in}\" 每省）"
        )
    if arm.bust_cup != "B":
        adj = "展開" if arm.cup_spread_in > 0 else "收攏"
        r.append(f"罩杯 {arm.bust_cup} 杯（需 {abs(arm.cup_spread_in)}\" {adj}胸省）")

    mentioned = _get(analysis, "closest_freesewing_patterns", default=[]) or []
    if isinstance(mentioned, list) and rule.fs_design_id in mentioned:
        r.append("Claude Vision 直接建議此設計")

    r.append(f"綜合信心分數：{score:.0%}")
    return r


# ─── 主函數 ──────────────────────────────────────────────────────────────────

@dataclass
class DraftParams:
    design:     str
    confidence: float
    options:    dict
    sa:         int
    gender:     str
    reasoning:  list[str]
    armstrong:  dict        # raw metrics for debugging / frontend display
    alternatives: list[dict] = field(default_factory=list)  # top 2 runners-up


def build_draft_params(
    measurements_mm: dict[str, float],
    analysis: dict,
    preferences: dict | None = None,
) -> DraftParams:
    """
    measurements_mm : body_profiles.measurements（mm）
    analysis        : Claude Vision 分析結果（GarmentAnalysis dict）
    preferences     : 可選覆蓋 {"sa": int, "gender": str, "paperless": bool}
    """
    prefs = preferences or {}
    arm   = calculate_armstrong_metrics(measurements_mm)

    # 評分所有設計
    scored = []
    for rule in DESIGN_RULES:
        s = _score_design(rule, analysis, arm)
        if s > 0:
            scored.append((s, rule))

    if not scored:
        # fallback：無法匹配時根據類別給預設
        category = _get(analysis, "garment_category", default="top")
        fallback_map = {
            "top":       "teagan",
            "bottom":    "sandy",
            "outerwear": "sven",
            "lingerie":  "lunetius",
            "block":     "bella",
            "dress":     "simone",
        }
        design_id = fallback_map.get(category, "teagan")
        rule = next((r for r in DESIGN_RULES if r.fs_design_id == design_id), DESIGN_RULES[0])
        scored = [(0.1, rule)]

    scored.sort(key=lambda x: x[0], reverse=True)
    top_score, top_rule = scored[0]

    options = _build_options(top_rule.fs_design_id, analysis, arm, prefs)
    gender  = prefs.get("gender") or _detect_gender(top_rule.fs_design_id, analysis)

    category = top_rule.garment_category
    sa = prefs.get("sa") or SEAM_ALLOWANCE_BY_GARMENT.get(category, 10)

    reasoning = _build_reasoning(top_rule, analysis, arm, top_score)

    alternatives = [
        {
            "design":      r.fs_design_id,
            "confidence":  round(s, 3),
            "description": r.description_zh,
        }
        for s, r in scored[1:3]
    ]

    return DraftParams(
        design      = top_rule.fs_design_id,
        confidence  = round(top_score, 3),
        options     = options,
        sa          = sa,
        gender      = gender,
        reasoning   = reasoning,
        armstrong   = {
            "hip_waist_diff_in":    round(arm.hip_waist_diff_in, 2),
            "front_dart_count":     arm.front_dart_count,
            "front_dart_intake_in": arm.front_dart_intake_in,
            "back_dart_count":      arm.back_dart_count,
            "back_dart_intake_in":  arm.back_dart_intake_in,
            "bust_cup":             arm.bust_cup,
            "cup_spread_in":        arm.cup_spread_in,
            "approx_us_size":       arm.approx_us_size,
            "cap_height_in":        round(arm.cap_height_in, 3),
            "sleeve_length_in":     arm.sleeve_length_in,
            "biceps_in":            arm.biceps_in,
            "ease_level":           arm.ease_level,
        },
        alternatives = alternatives,
    )
