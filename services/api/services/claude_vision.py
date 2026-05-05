"""
claude_vision.py — 呼叫 Claude Vision API 分析服裝照片

回傳結構化 JSON，欄位定義對齊 PRD §3.1 + §6.3 的 prompt 骨架。
版型術語來源：Patternmaking for Fashion Design, 5th Ed. (Helen Joseph-Armstrong)
"""
import base64
import io
import json
from pathlib import Path
import anthropic
from PIL import Image

from db.database import settings

client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key or None)

# 傳送給 Claude 的最大邊長（px）。手機照片通常 3000–4000px，縮到 1024 後
# 圖片 token 數從 1000+ 降到 ~300，API 回應速度提升 40–60%。
_MAX_IMAGE_PX  = 1024
_JPEG_QUALITY  = 85


def _resize_for_claude(image_bytes: bytes, mime_type: str) -> tuple[bytes, str]:
    """
    把圖片縮小到最長邊 ≤ 1024px 並轉成 JPEG，以減少 Claude 的圖片 token 數。
    若圖片原本就小於閾值則直接回傳原始 bytes（避免不必要的重新壓縮）。
    """
    img = Image.open(io.BytesIO(image_bytes))

    # EXIF 方向修正（手機拍攝常見問題）
    try:
        from PIL.ExifTags import TAGS
        exif = img._getexif() or {}
        orient_tag = next((k for k, v in TAGS.items() if v == "Orientation"), None)
        orientation = exif.get(orient_tag, 1)
        rotation_map = {3: 180, 6: 270, 8: 90}
        if orientation in rotation_map:
            img = img.rotate(rotation_map[orientation], expand=True)
    except Exception:
        pass  # EXIF 讀取失敗不影響主流程

    w, h = img.size
    if max(w, h) <= _MAX_IMAGE_PX:
        # 不需縮小，但仍統一轉 JPEG 以減少 base64 體積（PNG 較大）
        if mime_type == "image/png":
            buf = io.BytesIO()
            img.convert("RGB").save(buf, format="JPEG", quality=_JPEG_QUALITY)
            return buf.getvalue(), "image/jpeg"
        return image_bytes, mime_type

    # 等比縮放
    scale = _MAX_IMAGE_PX / max(w, h)
    new_size = (int(w * scale), int(h * scale))
    img = img.resize(new_size, Image.LANCZOS)

    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=_JPEG_QUALITY)
    return buf.getvalue(), "image/jpeg"

SYSTEM_PROMPT = """You are an expert fashion pattern-drafter and textile analyst, specialised in the terminology and construction standards of Patternmaking for Fashion Design, 5th Ed. (Helen Joseph-Armstrong).
Examine the garment in the image and return a structured JSON analysis.
Return ONLY the raw JSON — no markdown fences, no preamble.
If any field cannot be determined from the image, return null and explain in the `reasoning` field.
All free-text description fields must appear in BOTH Chinese (Traditional) and English — use the `_zh` / `_en` suffix pattern shown in the schema."""

USER_PROMPT = """Analyse the garment's pattern structure and fabric characteristics. Output strictly this JSON schema:

{
  "fabric": {
    "primary": {
      "name": "布料中文名稱（例：棉質府綢、羊毛混紡）",
      "name_en": "Fabric name in English (e.g. Cotton poplin, Wool blend twill)",
      "composition_estimate": "成分（中文，例：棉80%/聚酯20%）",
      "composition_en": "Fibre composition in English (e.g. 80% Cotton / 20% Polyester)",
      "weight": "light | medium | heavy",
      "drape": 0,
      "thickness": 0,
      "translucency": 0,
      "stretch": 0,
      "stretch_pct_estimate": 0
    },
    "secondary": null
  },
  "cut": {
    "silhouette": "one of: sheath | shift | box_fit | princess | panel | empire | tent | a_line | trapeze | oversized | fitted | semi_fitted | straight | bias_cut",
    "fit_ease": "fitted | semi_fitted | relaxed | oversized",
    "waist_treatment": "dart | seam | elastic | drawstring | none",
    "bodice_construction": "princess_seam | dart_fitted | yoke | raglan_yoke | seamless | gathered | smocked",
    "panel_count": null,
    "construction_lines": ["seam position descriptions in English, e.g. Princess seam from armhole to waist, CB invisible zipper"],
    "darts_count": 0,
    "stylelines": ["design line descriptions in English, e.g. Empire waistline seam, front vertical panel"]
  },
  "components": {
    "collar": {
      "type": "one of: basic_shirt_collar | convertible | notched_lapel | shawl_collar | peter_pan | flat_collar | sailor | mandarin | stand_collar | turtleneck | mock_neck | cowl | hood | crew_neck | v_neck | scoop_neck | square_neck | off_shoulder | strapless | halter | none",
      "neckline_shape": "square | round | v_shape | u_shape | sweetheart | straight | asymmetric | null",
      "neckline_width_estimate": "narrow | standard | wide",
      "neckline_depth_estimate": "shallow | medium | deep",
      "height_cm": null,
      "description": "Collar description in English with Armstrong chapter reference (e.g. Ch.11 square neckline)"
    },
    "sleeves": {
      "type": "one of: set_in | tailored_two_piece | bishop | puff_cap | puff_hem | bell | lantern | leg_of_mutton | cap_sleeve | petal | kimono | raglan | drop_shoulder | dolman | sleeveless | tank | spaghetti | wide_strap",
      "strap_type": "none | spaghetti | narrow_strap | wide_strap",
      "length": "sleeveless | cap | short | elbow | three_quarter | long",
      "cuff_type": "basic_shirt_cuff | french_cuff | contoured | roll_up | ribbed | elastic | open | none",
      "description": "Sleeve description in English"
    },
    "pockets": {
      "type": "patch | welt | double_welt | bound | in_seam | flap | cargo | kangaroo | none",
      "count": 0,
      "location": "location description in English"
    },
    "closures": {
      "type": "button_front | button_back | double_breasted | zipper_center_back | zipper_side | zipper_fly | invisible_zipper | wrap_tie | elastic_waist | hook_eye | snap | drawstring | lace_up | none",
      "button_count": null,
      "description": "closure description in English"
    }
  },
  "garment_category": "top | bottom | outerwear | lingerie | block | dress",
  "garment_type_detail": "具體款式（中文，例：無袖圓領A字洋裝）",
  "garment_type_detail_en": "Specific garment type in English (e.g. Sleeveless crew-neck A-line dress with box-pleat skirt)",
  "skirt_type": "straight_pencil | a_line | flared | circle | gathered | pleated_box | pleated_knife | wrap | tiered | yoke | trumpet_mermaid | null",
  "pleat_details": {
    "type": "box_pleat | knife_pleat | inverted_box | accordion | tuck | null",
    "count_estimate": null,
    "placement": "front_center | front_side | all_around | back | null",
    "visible_width_estimate": "narrow | standard | wide | null",
    "pressed_depth_estimate": "shallow | medium | full_length | null"
  },
  "pant_type": "culotte | trouser | slack | jean | wide_leg | flared | straight | tapered | skinny | cropped | shorts | bermuda | capri | culottes | high_waist | pull_on | jumpsuit | null",
  "closest_freesewing_patterns": [
    {
      "design": "aaron | bella | brian | carlton | charlie | cornelius | huey | hugo | jaeger | lunetius | noble | paco | sandy | simon | simone | sven | teagan | wahid | waralee",
      "confidence": 0.0,
      "reasoning": "Why this design matches — in English",
      "suggested_options": {}
    }
  ],
  "silhouette_tags": [
    "search tags — use: relaxed_fit | drop_shoulder | oversized | fitted | a_line | princess_line | empire_waist | wrap | knit_friendly | tailored | casual | formal | structured | unstructured | minimal | classic | sporty | romantic"
  ],
  "craft_recommendations": {
    "seam_allowance_mm": 10,
    "pressing_notes": "燙整建議（中文）",
    "pressing_notes_en": "Pressing instructions in English (fabric-specific)",
    "thread_color": "車線建議（中文）",
    "thread_color_en": "Thread colour recommendation in English",
    "interfacing_needed": false,
    "lining_suggested": false,
    "notions": ["材料清單（中文，例：隱形拉鍊20cm）"],
    "notions_en": ["Notions list in English (e.g. Invisible zip 20cm)"]
  },
  "difficulty_estimate": 1,
  "reasoning": "Notes on any undetermined fields and overall pattern analysis assessment — in English"
}

Construction rules (Armstrong 5th Ed.):
- silhouette: sheath=double-dart fitted; shift=single-dart semi-fitted; box_fit=no-dart relaxed; princess=vertical seam no waist dart
- bodice_construction: vertical seams from armhole to waist with no dart = princess_seam; visible darts no vertical seam = dart_fitted
- pleat: box pleat = symmetrical folds meeting at centre; knife pleat = single direction; any regular fold → fill pleat_details
- square_neck: right-angle corners at neckline (Armstrong Ch.11) → neckline_shape=square
- Knit fabrics (stretch>1) → prefer teagan/noble/aaron; woven fitted → simon/simone/bella
- Notched/shawl lapel + structure → carlton/jaeger/sven; hood+ribbing → huey/hugo
- Wrap skirt → sandy; wrap trousers → waralee; elastic-waist trousers → paco; straight trousers → charlie
- difficulty_estimate: 1=beginner; 2=easy; 3=intermediate (princess/square-neck/invisible zip); 4=advanced (lining/lapel/complex construction)"""


async def analyze_garment_photo(
    image_bytes: bytes,
    media_type: str = "image/jpeg",
) -> dict:
    """
    接受照片 bytes，回傳結構化分析 dict。
    分析結果欄位對齊 patternmaking_rules.py 的分類系統。

    速度優化：
    - 圖片縮至 1024px 再送 Claude，減少 image token 數 40–60%
    - max_tokens 從 3000 降至 1500（JSON 輸出實測 500–900 tokens）
    """
    # 壓縮縮小圖片
    image_bytes, media_type = _resize_for_claude(image_bytes, media_type)
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2200,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": b64,
                        },
                    },
                    {"type": "text", "text": USER_PROMPT},
                ],
            }
        ],
    )

    raw_text = message.content[0].text.strip()
    # 防呆：移除可能的 code fence
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]

    result = json.loads(raw_text)

    # 後處理：若 closest_freesewing_patterns 為空或缺失，用規則引擎補充
    if not result.get("closest_freesewing_patterns"):
        from services.patternmaking_rules import suggest_designs
        col = result.get("components", {}).get("collar", {})
        col_type = col.get("type") if isinstance(col, dict) else col
        slv = result.get("components", {}).get("sleeves", {})
        slv_type = slv.get("type") if isinstance(slv, dict) else slv
        suggestions = suggest_designs(
            silhouette=result.get("cut", {}).get("silhouette"),
            collar=col_type,
            sleeve=slv_type,
            garment_category=result.get("garment_category"),
            fabric_stretch=result.get("fabric", {}).get("primary", {}).get("stretch"),
        )
        result["closest_freesewing_patterns"] = [
            {"design": s["design"], "confidence": s["confidence"],
             "reasoning": s["description_zh"], "suggested_options": {}}
            for s in suggestions
        ]

    return result
