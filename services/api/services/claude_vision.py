"""
claude_vision.py — 呼叫 Claude Vision API 分析服裝照片

回傳結構化 JSON，欄位定義對齊 PRD §3.1 + §6.3 的 prompt 骨架。
"""
import base64
import json
from pathlib import Path
import anthropic

from db.database import settings

client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key or None)

SYSTEM_PROMPT = """你是專業服裝材料與版型分析師。請檢視圖中服裝並以 JSON 輸出分析結果。
只回傳 JSON，不加任何前置說明或 markdown code fence。
若某項資訊無法從圖判讀，回傳 null 並在 reasoning 欄說明。"""

USER_PROMPT = """請分析這件服裝，以下列 JSON schema 輸出：
{
  "fabric": {
    "primary": {
      "name": "布料名稱",
      "composition_estimate": "成分估計，例: 棉80%/聚酯20%",
      "drape": 0,
      "thickness": 0,
      "translucency": 0,
      "stretch": 0
    },
    "secondary": null
  },
  "cut": {
    "silhouette": "A-line | straight | oversized | fitted | ...",
    "construction_lines": ["接縫位置描述"],
    "darts": 0,
    "ease_estimate": "合身 | 標準 | 寬鬆"
  },
  "components": {
    "collar": "領型描述 or null",
    "sleeves": "袖型描述 or null",
    "pockets": "口袋描述 or null",
    "closures": "鈕扣/拉鍊/等 or null"
  },
  "closest_freesewing_patterns": [
    {"design": "aaron", "confidence": 0.0, "suggested_options": {}}
  ],
  "silhouette_tags": ["relaxed_fit", "drop_shoulder"],
  "craft_recommendations": {
    "seam_allowance_mm": 10,
    "pressing_notes": "燙整建議",
    "thread_color": "車線顏色建議"
  },
  "reasoning": "無法判讀部分的說明"
}"""


async def analyze_garment_photo(
    image_bytes: bytes,
    media_type: str = "image/jpeg",
) -> dict:
    """
    接受照片 bytes，回傳結構化分析 dict。
    """
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
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

    return json.loads(raw_text)
