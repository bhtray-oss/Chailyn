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

SYSTEM_PROMPT = """你是專業服裝打版師與材料分析師，精通 Patternmaking for Fashion Design（Helen Joseph-Armstrong）書中的版型術語與工藝標準。
請檢視圖中服裝並以 JSON 輸出詳細分析結果。
只回傳 JSON，不加任何前置說明或 markdown code fence。
若某項資訊無法從圖判讀，回傳 null 並在 reasoning 欄說明。"""

USER_PROMPT = """請分析這件服裝的版型結構與材質特徵，以下列 JSON schema 輸出：

{
  "fabric": {
    "primary": {
      "name": "布料名稱（中文，例：棉質府綢、羊毛混紡、針織棉）",
      "composition_estimate": "成分估計（例：棉80%/聚酯20%）",
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
    "silhouette": "下列之一：sheath（合身直筒雙省）| shift（半合身單省）| box_fit（箱型無省）| princess（公主線）| panel（縱向拼接）| empire（高腰分割）| tent（帳篷型）| a_line（A字）| trapeze（梯形）| oversized（廓形寬鬆）| fitted（合身）| semi_fitted（半合身）| straight（直筒）| bias_cut（斜裁）",
    "fit_ease": "fitted（合身，胸圍鬆量≤5cm）| semi_fitted（半合身，5-10cm）| relaxed（寬鬆，10-15cm）| oversized（廓形，>15cm）",
    "waist_treatment": "dart（省道）| seam（腰接縫）| elastic（鬆緊帶）| drawstring（抽繩）| none（無腰身設計）",
    "construction_lines": ["接縫位置描述，例：公主線、肩線、側縫、後中縫"],
    "darts_count": 0,
    "stylelines": ["描述設計線，例：empire腰線、前片縱向分割"]
  },
  "components": {
    "collar": {
      "type": "下列之一：basic_shirt_collar | convertible | notched_lapel | shawl_collar | peter_pan | flat_collar | sailor | mandarin | stand_collar | turtleneck | mock_neck | cowl | hood | crew_neck | v_neck | scoop_neck | square_neck | off_shoulder | strapless | halter | none",
      "height_cm": null,
      "description": "領型描述"
    },
    "sleeves": {
      "type": "下列之一：set_in（裝袖）| tailored_two_piece（兩片西裝袖）| bishop（主教袖）| puff_cap（泡泡袖山）| puff_hem（泡泡袖口）| bell（喇叭袖）| lantern（燈籠袖）| leg_of_mutton（羊腿袖）| cap_sleeve（蓋袖）| petal（花瓣袖）| kimono（和服袖）| raglan（拉克蘭袖）| drop_shoulder（落肩）| dolman（蝙蝠袖）| sleeveless（無袖）| tank（背心袖窿）| spaghetti（細肩帶）",
      "length": "sleeveless | cap | short | elbow | three_quarter | long",
      "cuff_type": "basic_shirt_cuff | french_cuff | contoured | roll_up | ribbed | elastic | open | none",
      "description": "袖型描述"
    },
    "pockets": {
      "type": "patch（貼袋）| welt（嵌線袋）| double_welt（雙嵌線）| bound（鑲邊）| in_seam（縫份隱藏）| flap（袋蓋）| cargo（風琴袋）| kangaroo（袋鼠袋）| none",
      "count": 0,
      "location": "描述位置"
    },
    "closures": {
      "type": "button_front | button_back | double_breasted | zipper_center_back | zipper_side | zipper_fly | invisible_zipper | wrap_tie | elastic_waist | hook_eye | snap | drawstring | lace_up | none",
      "button_count": null,
      "description": "描述"
    }
  },
  "garment_category": "top | bottom | outerwear | lingerie | block | dress",
  "garment_type_detail": "更具體的款式描述，例：button-down shirt、wrap skirt、chinos、hoodie、trench coat",
  "skirt_type": "若為裙型填入：straight_pencil | a_line | flared | circle | gathered | pleated_box | pleated_knife | wrap | tiered | yoke | trumpet_mermaid | null",
  "pant_type": "若為褲型填入：culotte | trouser | slack | jean | wide_leg | flared | straight | tapered | skinny | cropped | shorts | bermuda | capri | culottes | high_waist | pull_on | jumpsuit | null",
  "closest_freesewing_patterns": [
    {
      "design": "aaron | bella | brian | carlton | charlie | cornelius | huey | hugo | jaeger | lunetius | noble | paco | sandy | simon | simone | sven | teagan | wahid | waralee",
      "confidence": 0.0,
      "reasoning": "為何匹配的說明",
      "suggested_options": {}
    }
  ],
  "silhouette_tags": [
    "用於搜尋的標籤，可包含：relaxed_fit | drop_shoulder | oversized | fitted | a_line | princess_line | empire_waist | wrap | knit_friendly | tailored | casual | formal | structured | unstructured | minimal | classic | sporty | romantic"
  ],
  "craft_recommendations": {
    "seam_allowance_mm": 10,
    "pressing_notes": "燙整建議（依布料特性）",
    "thread_color": "車線顏色建議",
    "interfacing_needed": false,
    "lining_suggested": false,
    "notions": ["建議小料，例：拉鍊20cm、四合扣×4"]
  },
  "difficulty_estimate": 1,
  "reasoning": "無法判讀部分的說明，以及版型分析的整體評估"
}

判斷規則補充說明：
- silhouette 依 Armstrong 定義：sheath=雙省合身; shift=單省半合身; box_fit=無省寬鬆; princess=縱向分割無腰省
- 針織布（stretch>1）優先考慮 teagan/noble/aaron；梭織合身優先 simon/simone/bella
- 有缺角駁領或青果領且有結構感→ carlton/jaeger/sven；連帽+鬆緊+羅紋→ huey/hugo
- 圍裹設計（裙）→ sandy；圍裹設計（褲）→ waralee；鬆緊腰褲→ paco；直筒褲→ charlie
- difficulty_estimate：1=初學者; 2=入門; 3=中級; 4=高級（含裡布/駁領/複雜工藝）"""


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
        max_tokens=1500,
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
