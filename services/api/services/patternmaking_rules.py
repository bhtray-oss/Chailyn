"""
patternmaking_rules.py — 打版知識庫 (ML-Optimised)
來源：Patternmaking for Fashion Design, 5th Ed. (Helen Joseph-Armstrong)

本模組提供：
1.  服裝分類詞彙表（供 Claude Vision prompt 使用）
2.  各部件標準術語（領型、袖型、褲型、裙型、輪廓線）
3.  FreeSewing 設計映射規則（圖片特徵 → fs_design_id）
4.  鬆量標準（ease）與針織布彈性等級
5.  版型工藝建議輔助函數
6.  Armstrong 三大打版原則（Dart Manipulation / Added Fullness / Contouring）
7.  褶道（dart）幾何計算規則
8.  針織布拉伸分類與版型縮放規則（Ch 27）
9.  輪廓引導版型（Contour Guide Pattern）7條準線標準值（Ch 9）
10. 刀褶/箱褶/抽褶/橫截分量計算（Ch 7）
11. 育克（Yoke）、翼片（Flange）、褶縫（Tuck）幾何規則（Ch 8）
12. 褲長衍生定義（Ch 26）與褲型版型問題代碼
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

# ─── 輪廓線（Silhouette）────────────────────────────────────────────────────

SILHOUETTE_TYPES: dict[str, str] = {
    # 連身裙 / 上身
    "sheath":       "合身直筒（雙腰省控制），緊貼身型",
    "shift":        "半合身（單腰省），略寬於身型",
    "box_fit":      "箱型寬鬆（省道作鬆量，不縫合）",
    "princess":     "公主線（縱向分割從肩到裙擺，無腰省）",
    "panel":        "縱向拼接，類公主線但分割不過肩",
    "empire":       "高腰線於胸下分割，下身擴張",
    "tent":         "帳篷型，肩寬裙擺寬，中間無腰身",
    "a_line":       "A字型，腰部合身裙擺漸寬",
    "trapeze":      "梯形，肩較窄裙擺大幅擴張",
    "oversized":    "寬鬆廓形，超出身型尺寸",
    "fitted":       "合身，完整依循身型曲線",
    "semi_fitted":  "半合身，略有曲線但不緊貼",
    "relaxed":      "放鬆版型，有穿著鬆量",
    "straight":     "直線型，上下等寬",
    "bias_cut":     "斜紋裁剪，布料45度使用增加垂墜感",
}

# ─── 領型（Collar Types）────────────────────────────────────────────────────

COLLAR_TYPES: dict[str, str] = {
    # 可翻（Convertible）—— 紐扣開合可變換外觀
    "basic_shirt_collar":  "基本襯衫領（可翻），後中1吋立領，寬2.5-3吋",
    "convertible":         "可翻領，開鈕可呈V領，合鈕成立領",
    "notched_lapel":       "西裝駁領，缺角領座，搭配門襟用於外套/西裝",
    "shawl_collar":        "青果領/披肩領，連續曲線無缺口",
    "double_breasted_lapel": "雙排扣西裝領，加寬駁領",

    # 不可翻（Non-convertible）—— 固定貼合頸部曲線
    "peter_pan":           "彼得潘領（不可翻），圓角扁平領片，1/2-1吋立領高",
    "flat_collar":         "平領，立領高接近零，完全貼平",
    "sailor_collar":       "水手領，後寬前尖V字，方形後片",

    # 獨立設計
    "mandarin":            "中式立領（旗袍領），短立筒不翻折，高約1-1.5吋",
    "stand_collar":        "立領，有縫合領座，可高可低",
    "turtleneck":          "高領/龜領，折疊式筒狀高領",
    "mock_neck":           "假高領，較矮不折疊的筒領",
    "cowl":                "垂墜領，偏斜紋自然垂落的布料堆疊",
    "hood":                "連帽，附帽款式",
    "crew_neck":           "圓領（無領片），基本圓形開領",
    "v_neck":              "V領（無領片），V形開領",
    "scoop_neck":          "船領/挖領，低圓弧形開領",
    "square_neck":         "方領，方形開領",
    "off_shoulder":        "露肩領，領口低至肩部以下",
    "strapless":           "無肩帶，使用圍裹或骨架支撐",
    "halter":              "吊帶頸掛式，後背裸露",
}

# ─── 袖型（Sleeve Types）────────────────────────────────────────────────────

SLEEVE_TYPES: dict[str, str] = {
    # 裝袖（Set-in）—— 獨立袖片縫於袖窿
    "set_in":              "裝袖，獨立袖片，1.25-1.5吋袖山吃量，最正式",
    "tailored_two_piece":  "兩片西裝袖，有袖肘縫，用於外套/西裝",
    "bishop":              "主教袖，袖口抽褶聚攏，中段寬鬆",
    "puff_cap":            "泡泡袖（袖山抽褶），袖山膨鬆",
    "puff_hem":            "泡泡袖（袖口抽褶），袖口束緊蓬起",
    "puff_both":           "全泡泡袖（上下皆抽褶）",
    "bell":                "喇叭袖，袖口呈圓形擴張",
    "lantern":             "燈籠袖，袖山與袖口均收緊中段蓬起",
    "leg_of_mutton":       "羊腿袖，袖山至肘寬大，肘以下合身",
    "cap_sleeve":          "蓋袖，極短僅覆蓋肩部",
    "petal":               "花瓣袖，多層交疊圓弧袖片",

    # 連身袖（Bodice-integrated）
    "kimono":              "和服袖，袖與身直接相連，腋下角落空間較大",
    "raglan":              "拉克蘭袖，斜線縫從頸部到腋下，無袖窿縫",
    "drop_shoulder":       "落肩袖，袖窿下移使肩線向外延伸",
    "dolman":              "蝙蝠袖/多爾曼袖，袖窿極深寬鬆",

    # 無袖
    "sleeveless":          "無袖，有修飾袖窿",
    "tank":                "背心型袖窿，寬肩帶",
    "spaghetti":           "細肩帶",
}

# ─── 袖口（Cuff Types）──────────────────────────────────────────────────────

CUFF_TYPES: dict[str, str] = {
    "basic_shirt_cuff":    "基本袖口，搭配釦子，1.5-2吋寬",
    "french_cuff":         "法式袖口（用袖口鏈），雙層折返，較正式",
    "contoured_cuff":      "輪廓型袖口，隨手臂形狀彎曲",
    "roll_up_cuff":        "捲袖口，可向上折疊",
    "ribbed_cuff":         "羅紋袖口，彈性針織收口",
    "elastic_cuff":        "鬆緊帶袖口",
    "open_hem":            "無袖口直接完成邊",
}

# ─── 裙型（Skirt Types）─────────────────────────────────────────────────────

SKIRT_TYPES: dict[str, str] = {
    "straight_pencil":     "直筒鉛筆裙，腰臀合身裙擺窄，需開衩",
    "a_line":              "A字裙，腰合身裙擺展開，自然傘形",
    "flared":              "喇叭裙，從腰或臀展開的廓形",
    "circle":              "圓裙，半圓或全圓，裙擺最大",
    "gathered":            "褶裙/抽褶裙，腰部大量抽褶",
    "pleated_box":         "箱褶裙，正面對稱箱型褶",
    "pleated_knife":       "刀褶裙，單方向連續折褶",
    "pleated_inverted":    "倒箱褶，褶縫朝外",
    "wrap":                "圍裹裙，前片交疊，繫帶固定",
    "tiered":              "層疊裙，多層漸寬的橫向分割",
    "yoke":                "育克裙，腰部有橫向分割接片",
    "trumpet_mermaid":     "魚尾裙，臀部合身膝下展開如魚尾",
    "tulip":               "鬱金香裙，前後片交疊如花瓣",
    "asymmetric":          "不對稱裙，一邊高一邊低的裙擺",
    "mini":                "迷你裙，膝蓋以上",
    "midi":                "中長裙，膝蓋至小腿",
    "maxi":                "長裙，腳踝至地面",
    "micro":               "超短裙，大腿中段以上",
}

# ─── 褲型（Pant Foundations，Armstrong 四大基礎）────────────────────────────

PANT_FOUNDATIONS: dict[str, str] = {
    # Armstrong 書中四大褲型基礎
    "foundation_1_culotte":  "褲裙（闊腳）：寬鬆裙褲，臀圍+4吋以上，無腰省",
    "foundation_2_trouser":  "西裝褲：標準合身，前褶或省，有腰身",
    "foundation_3_slack":    "休閒褲：較寬鬆腰圍，腰鬆緊帶或拉鍊",
    "foundation_4_jean":     "牛仔褲：緊貼臀部，無省，低腰弧度深",

    # 衍生褲型
    "wide_leg":         "闊腳褲，膝以下大幅展寬",
    "palazzo":          "闊腿長褲，幾乎如裙",
    "flared":           "喇叭褲，膝以下擴張",
    "straight":         "直筒褲，上下等寬",
    "tapered":          "錐形褲，腿部漸窄至踝",
    "skinny":           "緊身褲，全腿合身",
    "cropped":          "七分褲/截短褲",
    "shorts":           "短褲，大腿以上",
    "bermuda":          "百慕達短褲，膝上幾英吋",
    "capri":            "卡普里褲，小腿中段",
    "culottes":         "褲裙，膝左右寬鬆",
    "high_waist":       "高腰褲，腰線高於自然腰",
    "low_rise":         "低腰褲，腰線低於自然腰",
    "pleated_front":    "前褶西裝褲，1-2個正面褶",
    "flat_front":       "無褶平口褲",
    "pull_on":          "彈力拉褲，全鬆緊帶腰頭",
    "jumpsuit":         "連身褲（工作服），上下身連體",
}

# ─── 口袋（Pocket Types）────────────────────────────────────────────────────

POCKET_TYPES: dict[str, str] = {
    "patch":           "貼袋，縫於表面的布片",
    "welt":            "單嵌線袋，一條嵌線開口",
    "double_welt":     "雙嵌線袋（有袋蓋），兩條嵌線",
    "bound":           "鑲邊口袋，布邊鑲框",
    "in_seam":         "縫份口袋，隱藏於側縫中",
    "flap":            "有袋蓋口袋",
    "cargo":           "風琴袋/軍用袋，有箱褶擴張空間",
    "kangaroo":        "袋鼠袋，前中大型橫貫口袋",
}

# ─── 門襟與固定方式（Closures）──────────────────────────────────────────────

CLOSURE_TYPES: dict[str, str] = {
    "button_front":         "前開扣",
    "button_back":          "後開扣",
    "double_breasted":      "雙排扣",
    "zipper_center_back":   "後中隱形拉鍊",
    "zipper_side":          "側邊拉鍊",
    "zipper_fly":           "前飛拉鍊（褲用）",
    "invisible_zipper":     "隱形拉鍊",
    "wrap_tie":             "交叉繫帶",
    "elastic_waist":        "鬆緊帶腰頭",
    "hook_eye":             "鉤環",
    "snap":                 "按扣",
    "drawstring":           "抽繩",
    "lace_up":              "綁帶",
}

# ─── 針織布彈性等級（Armstrong 分類）────────────────────────────────────────

@dataclass
class KnitStretchGrade:
    name: str
    stretch_pct: int       # 橫紋拉伸百分比（5吋基準）
    example_fabric: str
    suitable_for: list[str]
    ease_reduction_pct: float  # 需從版型扣除的鬆量百分比

KNIT_GRADES: list[KnitStretchGrade] = [
    KnitStretchGrade(
        name="stable_knit",
        stretch_pct=18,
        example_fabric="雙面針織（double knit）",
        suitable_for=["上衣", "夾克", "褲子"],
        ease_reduction_pct=0.0,
    ),
    KnitStretchGrade(
        name="moderate_stretch",
        stretch_pct=25,
        example_fabric="尼龍三角布（nylon tricot）",
        suitable_for=["運動服", "休閒上衣", "緊身衣（鬆合身）"],
        ease_reduction_pct=10.0,
    ),
    KnitStretchGrade(
        name="stretchy_knit",
        stretch_pct=50,
        example_fabric="棉/彈性纖維、尼龍/彈性纖維",
        suitable_for=["緊身上衣", "連身褲", "泳衣（輕量）", "塑身"],
        ease_reduction_pct=20.0,
    ),
    KnitStretchGrade(
        name="super_stretch",
        stretch_pct=100,
        example_fabric="任何纖維+彈性纖維高比例混紡",
        suitable_for=["連身緊身衣", "萊卡運動服", "泳衣", "滑雪服"],
        ease_reduction_pct=30.0,
    ),
    KnitStretchGrade(
        name="rib_knit",
        stretch_pct=100,
        example_fabric="1×1 or 2×2 羅紋針織",
        suitable_for=["領口羅紋", "袖口羅紋", "下擺羅紋", "針織上衣"],
        ease_reduction_pct=25.0,
    ),
]

# ─── 鬆量標準（Ease Standards）──────────────────────────────────────────────

EASE_STANDARDS_MM: dict[str, dict[str, float]] = {
    "fitted": {
        "bust_ease":      50,   # 2吋
        "waist_ease":     25,   # 1吋
        "hip_ease":       25,   # 1吋
        "sleeve_biceps":  38,   # 1.5吋
        "sleeve_cap":     32,   # 1.25吋
    },
    "semi_fitted": {
        "bust_ease":      63,   # 2.5吋
        "waist_ease":     38,   # 1.5吋
        "hip_ease":       50,   # 2吋
        "sleeve_biceps":  50,   # 2吋
        "sleeve_cap":     38,   # 1.5吋
    },
    "relaxed": {
        "bust_ease":      100,  # 4吋
        "waist_ease":     50,   # 2吋
        "hip_ease":       75,   # 3吋
        "sleeve_biceps":  63,   # 2.5吋
        "sleeve_cap":     38,   # 1.5吋
    },
    "oversized": {
        "bust_ease":      150,  # 6吋+
        "waist_ease":     100,  # 4吋+
        "hip_ease":       125,  # 5吋+
        "sleeve_biceps":  100,  # 4吋+
        "sleeve_cap":     38,   # 保持正常（袖山不需更多吃量）
    },
}

# ─── FreeSewing 設計映射規則 ─────────────────────────────────────────────────

@dataclass
class DesignMatchRule:
    fs_design_id: str
    garment_category: str          # top / bottom / outerwear / lingerie / block
    description_zh: str
    # 關鍵視覺特徵（用於圖片匹配）
    key_features: list[str]
    # 主要輪廓線
    silhouettes: list[str]
    # 常見領型
    collar_types: list[str]
    # 常見袖型
    sleeve_types: list[str]
    # 適用布料特性
    fabric_types: list[str]
    # 困難度（1-4）
    difficulty: int
    # 必要身型測量（FreeSewing measurement key）
    required_measurements: list[str]

DESIGN_RULES: list[DesignMatchRule] = [
    DesignMatchRule(
        fs_design_id="aaron",
        garment_category="top",
        description_zh="無袖背心（A-shirt）",
        key_features=["無袖", "圓領或挖領", "貼身或寬鬆", "無領片"],
        silhouettes=["fitted", "relaxed", "straight"],
        collar_types=["crew_neck", "scoop_neck", "v_neck"],
        sleeve_types=["sleeveless", "tank"],
        fabric_types=["針織", "棉布", "jersey", "輕薄"],
        difficulty=1,
        required_measurements=["chest", "waist", "hpsToWaistBack"],
    ),
    DesignMatchRule(
        fs_design_id="bella",
        garment_category="block",
        description_zh="女裝上衣基礎板型（bodice block）",
        key_features=["基礎板", "胸省", "腰省", "無設計細節"],
        silhouettes=["fitted", "semi_fitted"],
        collar_types=["crew_neck"],
        sleeve_types=["sleeveless", "set_in"],
        fabric_types=["任何梭織"],
        difficulty=2,
        required_measurements=["chest", "waist", "hpsToWaistBack", "bustPointToArmholePitch"],
    ),
    DesignMatchRule(
        fs_design_id="brian",
        garment_category="block",
        description_zh="男裝上衣基礎板型（men's bodice block）",
        key_features=["基礎男裝板", "無省或少省", "合身男裝"],
        silhouettes=["fitted", "semi_fitted"],
        collar_types=["crew_neck"],
        sleeve_types=["set_in"],
        fabric_types=["任何梭織"],
        difficulty=2,
        required_measurements=["chest", "waist", "hpsToWaistBack"],
    ),
    DesignMatchRule(
        fs_design_id="carlton",
        garment_category="outerwear",
        description_zh="男裝西裝外套（tailored jacket）",
        key_features=["缺角駁領", "兩片西裝袖", "袋蓋口袋", "有裡布", "挺括面料"],
        silhouettes=["fitted", "semi_fitted"],
        collar_types=["notched_lapel", "shawl_collar"],
        sleeve_types=["tailored_two_piece"],
        fabric_types=["羊毛", "混紡", "厚料", "梭織"],
        difficulty=4,
        required_measurements=["chest", "waist", "hips", "hpsToWaistBack"],
    ),
    DesignMatchRule(
        fs_design_id="charlie",
        garment_category="bottom",
        description_zh="直筒長褲（chinos/trousers）",
        key_features=["直筒", "前拉鍊", "腰帶環", "標準腰高"],
        silhouettes=["straight", "semi_fitted"],
        collar_types=[],
        sleeve_types=[],
        fabric_types=["梭織棉", "斜紋布", "卡其布", "混紡"],
        difficulty=3,
        required_measurements=["waist", "hips", "inseam", "waistToFloor"],
    ),
    DesignMatchRule(
        fs_design_id="cornelius",
        garment_category="bottom",
        description_zh="南瓜褲/馬褲（knickerbockers/plus fours）",
        key_features=["膝下束口", "寬鬆腿部", "復古風格"],
        silhouettes=["oversized", "relaxed"],
        collar_types=[],
        sleeve_types=[],
        fabric_types=["羊毛", "厚梭織"],
        difficulty=3,
        required_measurements=["waist", "hips", "inseam"],
    ),
    DesignMatchRule(
        fs_design_id="huey",
        garment_category="top",
        description_zh="連帽衛衣（hoodie sweatshirt）",
        key_features=["連帽", "袋鼠袋", "羅紋袖口和下擺", "針織或厚棉"],
        silhouettes=["relaxed", "oversized"],
        collar_types=["hood"],
        sleeve_types=["set_in", "drop_shoulder"],
        fabric_types=["棉毛圈", "刷毛", "抓毛", "厚針織"],
        difficulty=2,
        required_measurements=["chest", "waist", "hpsToWaistBack"],
    ),
    DesignMatchRule(
        fs_design_id="hugo",
        garment_category="top",
        description_zh="連帽拉鍊衛衣（zip-up hoodie）",
        key_features=["連帽", "前中拉鍊", "羅紋收口", "針織或厚棉"],
        silhouettes=["relaxed", "oversized"],
        collar_types=["hood"],
        sleeve_types=["set_in", "drop_shoulder"],
        fabric_types=["棉毛圈", "刷毛", "厚針織"],
        difficulty=2,
        required_measurements=["chest", "waist", "hpsToWaistBack"],
    ),
    DesignMatchRule(
        fs_design_id="jaeger",
        garment_category="outerwear",
        description_zh="女裝西裝外套（tailored jacket）",
        key_features=["缺角駁領或無領", "有結構感", "腰身", "袋蓋或無蓋口袋"],
        silhouettes=["fitted", "semi_fitted"],
        collar_types=["notched_lapel", "shawl_collar", "crew_neck"],
        sleeve_types=["tailored_two_piece", "set_in"],
        fabric_types=["羊毛", "混紡", "厚料"],
        difficulty=4,
        required_measurements=["chest", "waist", "hips", "hpsToWaistBack"],
    ),
    DesignMatchRule(
        fs_design_id="lunetius",
        garment_category="lingerie",
        description_zh="胸罩（bra）",
        key_features=["胸罩罩杯", "肩帶", "背扣", "彈性材料"],
        silhouettes=["fitted"],
        collar_types=["strapless", "halter"],
        sleeve_types=["sleeveless", "spaghetti"],
        fabric_types=["彈性針織", "蕾絲", "超彈性布"],
        difficulty=3,
        required_measurements=["chest", "underbust", "bustPointToArmholePitch"],
    ),
    DesignMatchRule(
        fs_design_id="noble",
        garment_category="block",
        description_zh="針織基礎板型（knitwear block）",
        key_features=["針織布", "基礎板型", "無省或少省"],
        silhouettes=["fitted", "semi_fitted"],
        collar_types=["crew_neck", "v_neck"],
        sleeve_types=["set_in", "drop_shoulder"],
        fabric_types=["針織", "jersey", "彈性梭織"],
        difficulty=2,
        required_measurements=["chest", "waist", "hpsToWaistBack"],
    ),
    DesignMatchRule(
        fs_design_id="paco",
        garment_category="bottom",
        description_zh="鬆緊帶休閒褲（pull-on pants）",
        key_features=["全鬆緊帶腰頭", "無拉鍊無腰帶環", "寬鬆舒適"],
        silhouettes=["relaxed", "straight"],
        collar_types=[],
        sleeve_types=[],
        fabric_types=["棉針織", "彈性梭織", "輕薄梭織"],
        difficulty=2,
        required_measurements=["waist", "hips", "inseam"],
    ),
    DesignMatchRule(
        fs_design_id="sandy",
        garment_category="bottom",
        description_zh="圍裹裙（wrap skirt）",
        key_features=["前片交疊", "側邊繫帶", "A字或寬鬆廓形"],
        silhouettes=["a_line", "wrap", "flared"],
        collar_types=[],
        sleeve_types=[],
        fabric_types=["棉布", "麻布", "雪紡", "任何輕至中等重量"],
        difficulty=1,
        required_measurements=["waist", "hips", "waistToFloor"],
    ),
    DesignMatchRule(
        fs_design_id="simon",
        garment_category="top",
        description_zh="女裝合身襯衫（fitted button-down shirt）",
        key_features=["前排扣", "領片", "袖克夫", "公主線或省道"],
        silhouettes=["fitted", "semi_fitted"],
        collar_types=["basic_shirt_collar", "convertible", "mandarin"],
        sleeve_types=["set_in"],
        fabric_types=["棉布", "府綢", "混紡", "輕薄梭織"],
        difficulty=3,
        required_measurements=["chest", "waist", "hpsToWaistBack", "shoulderToElbow"],
    ),
    DesignMatchRule(
        fs_design_id="simone",
        garment_category="top",
        description_zh="女裝合身襯衫（女版 simon）",
        key_features=["前排扣", "領片", "袖克夫", "腰身", "女裝版型"],
        silhouettes=["fitted", "semi_fitted"],
        collar_types=["basic_shirt_collar", "convertible"],
        sleeve_types=["set_in"],
        fabric_types=["棉布", "府綢", "輕薄梭織"],
        difficulty=3,
        required_measurements=["chest", "waist", "hips", "hpsToWaistBack"],
    ),
    DesignMatchRule(
        fs_design_id="sven",
        garment_category="outerwear",
        description_zh="大衣/外套（coat）",
        key_features=["及膝以下長度", "厚料", "門襟", "大領子"],
        silhouettes=["straight", "a_line", "oversized"],
        collar_types=["notched_lapel", "shawl_collar", "stand_collar", "hood"],
        sleeve_types=["set_in", "tailored_two_piece", "raglan"],
        fabric_types=["羊毛", "厚料", "混紡厚料"],
        difficulty=4,
        required_measurements=["chest", "waist", "hpsToWaistBack"],
    ),
    DesignMatchRule(
        fs_design_id="teagan",
        garment_category="top",
        description_zh="基本T恤（basic T-shirt）",
        key_features=["圓領", "短袖或長袖", "針織布", "輕鬆合身"],
        silhouettes=["relaxed", "semi_fitted", "oversized"],
        collar_types=["crew_neck", "v_neck"],
        sleeve_types=["set_in", "drop_shoulder"],
        fabric_types=["針織", "jersey", "棉針織"],
        difficulty=1,
        required_measurements=["chest", "waist", "hpsToWaistBack"],
    ),
    DesignMatchRule(
        fs_design_id="wahid",
        garment_category="top",
        description_zh="無袖背心/馬甲（waistcoat/vest）",
        key_features=["無袖", "前排扣", "有結構感", "正式或休閒"],
        silhouettes=["fitted", "semi_fitted"],
        collar_types=["v_neck", "notched_lapel", "crew_neck"],
        sleeve_types=["sleeveless"],
        fabric_types=["梭織", "羊毛", "混紡"],
        difficulty=3,
        required_measurements=["chest", "waist", "hpsToWaistBack"],
    ),
    DesignMatchRule(
        fs_design_id="waralee",
        garment_category="bottom",
        description_zh="圍裹褲（wrap pants）",
        key_features=["褲形但有圍裹開口", "繫帶腰頭", "寬鬆"],
        silhouettes=["relaxed", "wide_leg"],
        collar_types=[],
        sleeve_types=[],
        fabric_types=["棉布", "麻布", "雪紡", "輕薄梭織"],
        difficulty=2,
        required_measurements=["waist", "hips", "inseam"],
    ),
]

# ─── 圖片特徵 → 設計建議函數 ─────────────────────────────────────────────────

def suggest_designs(
    silhouette: Optional[str] = None,
    collar: Optional[str] = None,
    sleeve: Optional[str] = None,
    garment_category: Optional[str] = None,
    fabric_stretch: Optional[int] = None,  # 0-4 scale
) -> list[dict]:
    """
    根據視覺特徵返回最可能的 FreeSewing 設計清單（按信心度排序）。
    """
    results = []
    for rule in DESIGN_RULES:
        score = 0.0

        if garment_category and rule.garment_category == garment_category:
            score += 0.3

        if silhouette and silhouette in rule.silhouettes:
            score += 0.25

        if collar and collar in rule.collar_types:
            score += 0.25

        if sleeve and sleeve in rule.sleeve_types:
            score += 0.2

        # 針織布優先針織版型
        if fabric_stretch is not None and fabric_stretch >= 2:
            if any(k in rule.fabric_types for k in ["針織", "jersey", "彈性針織"]):
                score += 0.1

        if score > 0:
            results.append({
                "design": rule.fs_design_id,
                "confidence": round(score, 2),
                "description_zh": rule.description_zh,
            })

    results.sort(key=lambda x: x["confidence"], reverse=True)
    return results[:5]  # 最多返回5個


def get_ease_recommendation(silhouette: str) -> dict[str, float]:
    """根據廓形返回建議鬆量（mm）"""
    mapping = {
        "sheath": "fitted",
        "fitted": "fitted",
        "princess": "fitted",
        "shift": "semi_fitted",
        "semi_fitted": "semi_fitted",
        "a_line": "semi_fitted",
        "box_fit": "relaxed",
        "relaxed": "relaxed",
        "tent": "oversized",
        "oversized": "oversized",
        "trapeze": "oversized",
    }
    key = mapping.get(silhouette, "semi_fitted")
    return EASE_STANDARDS_MM.get(key, EASE_STANDARDS_MM["semi_fitted"])


def classify_knit_stretch(stretch_pct: int) -> KnitStretchGrade:
    """根據彈性百分比返回針織布等級"""
    for grade in sorted(KNIT_GRADES, key=lambda g: g.stretch_pct):
        if stretch_pct <= grade.stretch_pct + 5:
            return grade
    return KNIT_GRADES[-1]  # super_stretch


# ─── 版型工藝建議 ─────────────────────────────────────────────────────────────

SEAM_ALLOWANCE_BY_GARMENT: dict[str, int] = {
    "top":        10,   # mm — 標準上衣
    "bottom":     15,   # mm — 裙褲腰縫需更多
    "outerwear":  15,   # mm — 外套
    "lingerie":    6,   # mm — 內衣精細
    "block":      10,   # mm — 基礎板
}

PRESSING_NOTES: dict[str, str] = {
    "cotton":          "中溫蒸汽燙，順紋方向",
    "wool":            "濕布墊蓋，中溫蒸汽，避免拉伸",
    "linen":           "高溫蒸汽，可直接燙或加墊布",
    "silk":            "低溫，反面燙，不用蒸汽",
    "polyester":       "低溫，墊布燙，避免直接接觸",
    "knit":            "輕蒸汽，不拉伸，縱向輕放",
    "denim":           "高溫蒸汽，正面可直接燙",
    "velvet":          "不可直接燙，使用毛圈墊或懸掛蒸汽",
}


def get_craft_recommendations(
    garment_type: str,
    fabric_name: str,
    silhouette: str = "semi_fitted",
) -> dict:
    """返回工藝建議字典，用於補充 Claude Vision 輸出"""
    sa = SEAM_ALLOWANCE_BY_GARMENT.get(garment_type, 10)

    # 嘗試匹配布料種類
    pressing = "中溫蒸汽燙，依布料說明"
    fabric_lower = fabric_name.lower()
    for key, note in PRESSING_NOTES.items():
        if key in fabric_lower:
            pressing = note
            break

    return {
        "seam_allowance_mm": sa,
        "pressing_notes": pressing,
        "ease_profile": get_ease_recommendation(silhouette),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION A — ARMSTRONG 三大打版原則
# Source: Armstrong Ch 4 (Principle #1), Ch 7 (Principle #2), Ch 9 (Principle #3)
# ═══════════════════════════════════════════════════════════════════════════════

ARMSTRONG_PRINCIPLES: dict[str, dict] = {
    "principle_1_dart_manipulation": {
        "name_en": "Dart Manipulation",
        "name_zh": "省道操作",
        "statement": (
            "A dart can be transferred to any position on the pattern outline from its "
            "pivotal point (bust point) without changing the size or fit of the garment. "
            "The dart angle remains constant regardless of location; only the width changes "
            "with distance from the pivotal point."
        ),
        "corollary": (
            "Dart excess can be expressed as dart equivalents: "
            "gathers, pleats, tuck-darts, stylelines, cowls, flare, or ease in the armhole."
        ),
        "key_rules": [
            "Pivotal point is always the bust point (BP).",
            "Dart angle is invariant — only dart width varies with distance from BP.",
            "One-dart point: 5/8\" (16 mm) below BP.",
            "Two-dart system: waist dart + side dart; point distances vary by cup size.",
            "Cup A: dart point 3/4\" (19 mm) from BP; overlap (reduce) 3/8\" (10 mm).",
            "Cup B: dart point 1\" (25 mm) from BP; no adjustment.",
            "Cup C: dart point 1.5\" (38 mm) from BP; spread 3/8\" (10 mm).",
            "Cup D: dart point 1.75\" (44 mm) from BP; spread 3/4\" (19 mm).",
            "Cup DD: dart point ~2\" (51 mm) from BP; spread 1\" (25 mm).",
            "Two transfer methods: slash-and-spread (visual) or pivotal transfer (preferred).",
        ],
        "dart_locations_9": [
            "shoulder", "mid_armhole", "side_seam", "waist_side",
            "waist_center", "hem", "center_front", "french_dart", "neckline"
        ],
    },

    "principle_2_added_fullness": {
        "name_en": "Added Fullness (Slash-and-Spread)",
        "name_zh": "加量法（剪開展開）",
        "statement": (
            "To increase fullness beyond the capacity of the dart excess, slash the pattern "
            "and spread. This adds fabric in the direction the fullness is needed."
        ),
        "corollary": (
            "Adding to the outside of the pattern's frame increases fabric quantity "
            "and can alter the silhouette entirely."
        ),
        "fullness_types": {
            "equal": "兩側等量展開 — 形成直向褶裙/抽褶均勻分布",
            "one_sided": "單側展開 — 形成弧形裙擺向一側外張",
            "unequal": "不等量展開 — 一側多一側少，形成不對稱或傾斜效果",
        },
        "identification_rules": [
            "Fullness passes through the length or width (not directed to bust point).",
            "Fullness is directed away from the bust point.",
            "Garment silhouette extends beyond the body outline.",
        ],
        "fullness_ratios": {
            # ratio_name: (multiplier, description)
            "1.5x":  (1.5,  "自然抽褶感，適合輕薄布料"),
            "2x":    (2.0,  "中等豐盈，標準抽褶/圓裙"),
            "2.5x":  (2.5,  "豐富抽褶，波浪感強"),
            "3x":    (3.0,  "極豐盈，舞台感/燈籠效果"),
        },
        # example: 26" waist at 2× = 26 + 26 = 52" total
        "gather_notch_rule": "1/2\" (13 mm) outside first and last slash line for gather control.",
        "princess_spread": "1.5:1 to 2:1 fullness ratio for princess-line sections.",
        "semi_yoke_rule": "Close waist dart overlapping dart point 3/4\"; spread each slash 3/4\".",
        "back_yoke_inverted_box_pleat": "Add 3\" (76 mm) to center back width; notch at CB and 1.5\" from CB.",
        "action_pleat_spread": "Spread slash 3\" (76 mm) for pleat intake; place crossmark 2.5\" from armhole.",
    },

    "principle_3_contouring": {
        "name_en": "Contouring",
        "name_zh": "輪廓緊貼法（內縮法）",
        "statement": (
            "To fit the contours of the upper torso closer than the basic garment, "
            "the pattern must be reduced WITHIN its frame to fit the body's dimensions "
            "above, below, and between the bust and shoulder blades."
        ),
        "corollary": (
            "The outline of the pattern is trimmed to fit the slope of the shoulder "
            "and the side seam ease is eliminated."
        ),
        "applies_to": [
            "empire_styleline",      # contouring under the bust
            "strapless",             # contouring over, under, and between the bust
            "bra_top",               # contouring over, under, between the bust
            "surplice_wrap",         # contouring over and under the bust
            "cutout_armhole",        # contouring above the bust
            "cutout_neckline",       # contouring above the bust
        ],
        "fitting_problems_without_contouring": [
            "Cutout neckline/armhole loses shoulder support → falls → gapping.",
            "Empire/strapless/bra: no bust definition, hangs loosely over hollows.",
        ],
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION B — 輪廓引導版型七條準線 (Contour Guide Pattern Guidelines)
# Source: Armstrong Ch 9, p.162–165
# Standard measurements assume 11\" bust-waist difference; otherwise measure form.
# Measurement key: bust_radius = Armstrong measurement #9
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ContourGuideline:
    number: int
    name_en: str
    name_zh: str
    location: str                  # anatomical landmark
    direction: str                 # from → to on pattern
    standard_measurement_in: float # inches — excess to remove
    standard_measurement_mm: float # mm equivalent
    notes: str
    applies_to: list[str]          # design types that require this guideline

CONTOUR_GUIDELINES: list[ContourGuideline] = [
    ContourGuideline(
        number=1,
        name_en="Cutout Necklines",
        name_zh="挖頸線輪廓（消除頸部空隙）",
        location="mid_neck",
        direction="bust_point → mid_neck",
        standard_measurement_in=0.25,
        standard_measurement_mm=6.35,
        notes="Draw from BP to mid-neck; mark 1/4\" out from circumference line.",
        applies_to=["cutout_neckline", "surplice_wrap", "strapless"],
    ),
    ContourGuideline(
        number=2,
        name_en="Cutout Armholes",
        name_zh="挖袖窿輪廓（消除袖窿空隙）",
        location="shoulder_tip",
        direction="bust_point → shoulder_tip",
        standard_measurement_in=0.5,
        standard_measurement_mm=12.7,
        notes="Add 1/4\" to measurement for bias stretch compensation. "
              "Mark out from circumference line at shoulder-tip level.",
        applies_to=["cutout_armhole", "tank", "sleeveless_fitted", "strapless"],
    ),
    ContourGuideline(
        number=3,
        name_en="Armhole Ease Elimination",
        name_zh="袖窿鬆量消除（無肩帶/挖袖窿）",
        location="armhole_curve",
        direction="armhole_curve → bust_point",
        standard_measurement_in=0.25,
        standard_measurement_mm=6.35,
        notes="Eliminate side seam ease. Mark 1/4\" standard; include with cutout armhole designs.",
        applies_to=["strapless", "cutout_armhole", "bra_top"],
    ),
    ContourGuideline(
        number=4,
        name_en="Empire Styleline (Under-bust Contour)",
        name_zh="帝政線輪廓（胸下線消除餘量）",
        location="under_bust",
        direction="waist → bust_point (direction of BP)",
        standard_measurement_in=0.75,   # total = 3/4", split 3/8" each dart leg
        standard_measurement_mm=19.05,
        notes="Divide 3/4\" between two dart legs at circumference line (3/8\" each). "
              "Semi-fit garments: use 3/16\" per dart leg instead.",
        applies_to=["empire", "empire_with_shirred_midriff", "bra_top", "corset"],
    ),
    ContourGuideline(
        number=5,
        name_en="Contour Between Busts",
        name_zh="兩胸間輪廓（消除中間空隙）",
        location="center_front_between_busts",
        direction="bust_point → center_front (squared)",
        standard_measurement_in=0.75,   # total = 3/4", split 3/8" each side of CF line
        standard_measurement_mm=19.05,
        notes="Square from CF to BP; mark 3/8\" on each side of square line at CF.",
        applies_to=["strapless", "bra_top", "deep_v_neckline", "plunge_neckline"],
    ),
    ContourGuideline(
        number=6,
        name_en="Strapless Designs (Combined)",
        name_zh="無肩帶合併準線",
        location="mid_shoulder_princess_line",
        direction="bust_point → mid_shoulder",
        standard_measurement_in=None,   # = sum of guidelines 1 + 2 + 3 − 1/8\"
        standard_measurement_mm=None,
        notes="Combination of Guidelines 1+2+3. Subtract 1/8\" (3.2 mm) for "
              "interconstruction thickness. Connect lines to BP.",
        applies_to=["strapless", "tube_top", "bustier", "bra_top"],
    ),
    ContourGuideline(
        number=7,
        name_en="Back Bodice Contour",
        name_zh="後片輪廓（低領背/無肩帶後片）",
        location="back_bodice",
        direction="varies by design",
        standard_measurement_in=None,   # chart for designs with low-cut necklines
        standard_measurement_mm=None,
        notes="Chart back bodice for low-cut necklines and strapless garments. "
              "HBL (Horizontal Balance Line) must be marked on back working pattern.",
        applies_to=["strapless", "backless", "low_back_neckline"],
    ),
]


def get_contour_guidelines_for_design(design_type: str) -> list[ContourGuideline]:
    """Returns applicable contour guidelines for a given design type."""
    return [g for g in CONTOUR_GUIDELINES if design_type in g.applies_to]


def compute_contour_6_mm(bust_radius_mm: float) -> float:
    """
    Compute Guideline 6 (strapless combined) excess to remove in mm.
    = sum(G1 + G2 + G3) − 3.2 mm interconstruction offset.
    bust_radius_mm: Armstrong measurement #9 converted to mm.
    Note: standard values used; individual bust radius adjusts circle placement only.
    """
    g1 = CONTOUR_GUIDELINES[0].standard_measurement_mm  # 6.35
    g2 = CONTOUR_GUIDELINES[1].standard_measurement_mm  # 12.7
    g3 = CONTOUR_GUIDELINES[2].standard_measurement_mm  # 6.35
    interconstruction_offset_mm = 3.175                  # 1/8 inch
    return g1 + g2 + g3 - interconstruction_offset_mm   # → 22.2 mm


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION C — 針織布彈性分類（完整版，含版型縮放規則）
# Source: Armstrong Ch 27, p.627–631
# ═══════════════════════════════════════════════════════════════════════════════

# Enhanced KNIT_GRADES with Armstrong's precise stretch gauge data
# Already defined above; supplement with pattern adjustment rules.

@dataclass
class KnitPatternAdjustment:
    """
    Armstrong Ch 27 stretch-factor pattern reduction rules.
    For stable/moderate knits (18–25% stretch).
    For knits 25–50%: add 1/8\" (3.2 mm) to EACH of the below values.
    """
    grade: str                       # matches KnitStretchGrade.name
    # Bodice/Skirt adjustments (mm to REMOVE from each location)
    neckline_raise_mm: float         # raise neckline seam by this amount
    side_seam_remove_mm: float       # remove from each side seam (parallel)
    armhole_raise_mm: float          # raise armhole by this amount
    dart_point_raise_mm: float       # raise dart point
    hem_waist_remove_mm: float       # remove from hem/waist parallel
    # Sleeve adjustments
    sleeve_biceps_raise_mm: float    # raise biceps line (new biceps level)
    sleeve_underarm_remove_mm: float # remove from underarm seam parallel
    sleeve_hem_remove_mm: float      # remove from sleeve hem parallel
    sleeve_elbow_dart_reposition_mm: float  # reposition elbow dart upward
    # Pant-specific
    crotch_raise_trouser_mm: float   # trouser
    crotch_raise_slack_jean_mm: float
    notes: str

KNIT_PATTERN_ADJUSTMENTS: list[KnitPatternAdjustment] = [
    KnitPatternAdjustment(
        grade="stable_knit",           # 18% stretch
        neckline_raise_mm=0.0,         # minimal stretch — no reduction needed
        side_seam_remove_mm=0.0,
        armhole_raise_mm=0.0,
        dart_point_raise_mm=0.0,
        hem_waist_remove_mm=0.0,
        sleeve_biceps_raise_mm=0.0,
        sleeve_underarm_remove_mm=0.0,
        sleeve_hem_remove_mm=0.0,
        sleeve_elbow_dart_reposition_mm=0.0,
        crotch_raise_trouser_mm=0.0,
        crotch_raise_slack_jean_mm=0.0,
        notes="Stable knit: treat like woven — no stretch-factor reduction. "
              "Enlarge pattern for shrinkage if needed.",
    ),
    KnitPatternAdjustment(
        grade="moderate_stretch",      # 25% stretch
        neckline_raise_mm=6.35,        # 1/4"
        side_seam_remove_mm=6.35,      # 1/4" each side
        armhole_raise_mm=12.7,         # 1/2"
        dart_point_raise_mm=6.35,      # 1/4"
        hem_waist_remove_mm=6.35,      # 1/4"
        sleeve_biceps_raise_mm=12.7,   # 1/2" (new biceps level)
        sleeve_underarm_remove_mm=6.35,
        sleeve_hem_remove_mm=6.35,
        sleeve_elbow_dart_reposition_mm=6.35,
        crotch_raise_trouser_mm=12.7,  # 1/2"
        crotch_raise_slack_jean_mm=6.35,  # 1/4"
        notes="18–25% stretch: use these exact values. "
              "For 25–50% stretch: add 3.2 mm (1/8\") to every value above.",
    ),
    KnitPatternAdjustment(
        grade="stretchy_knit",         # 50% stretch (25–50% zone → +1/8")
        neckline_raise_mm=9.55,        # 6.35 + 3.2
        side_seam_remove_mm=9.55,
        armhole_raise_mm=15.9,         # 12.7 + 3.2
        dart_point_raise_mm=9.55,
        hem_waist_remove_mm=9.55,
        sleeve_biceps_raise_mm=15.9,
        sleeve_underarm_remove_mm=9.55,
        sleeve_hem_remove_mm=9.55,
        sleeve_elbow_dart_reposition_mm=9.55,
        crotch_raise_trouser_mm=15.9,
        crotch_raise_slack_jean_mm=9.55,
        notes="25–50% stretch zone: all 18–25% values + 3.2 mm (1/8\"). "
              "Bodysuits/leotards: further reduce; test-fit before cutting.",
    ),
    KnitPatternAdjustment(
        grade="super_stretch",         # 100% stretch
        neckline_raise_mm=12.7,
        side_seam_remove_mm=12.7,
        armhole_raise_mm=19.05,
        dart_point_raise_mm=12.7,
        hem_waist_remove_mm=12.7,
        sleeve_biceps_raise_mm=19.05,
        sleeve_underarm_remove_mm=12.7,
        sleeve_hem_remove_mm=12.7,
        sleeve_elbow_dart_reposition_mm=12.7,
        crotch_raise_trouser_mm=19.05,
        crotch_raise_slack_jean_mm=12.7,
        notes="100%+ stretch: apply Contour Guide (Ch 9) in addition to reductions. "
              "Side ease eliminated entirely. Walk all seams. ",
    ),
]

KNIT_STRETCH_DIRECTION: dict[str, str] = {
    "warp":     "縱向拉伸 — 適合需要上下活動量的設計（連身衣、溜冰裙）",
    "filling":  "橫向拉伸 — 最常見；適合衣身橫向包覆（上衣、裙、褲）",
    "two_way":  "雙向拉伸 — 最高活動自由度；泳衣、彈性緊身衣",
}

KNIT_DIRECTION_RULE: dict[str, str] = {
    # garment_use → preferred stretch direction
    "dress_jacket_pants_top":  "filling (crosswise) — stretch should encircle figure",
    "bodysuit_leotard_jumpsuit_skiwear": "warp (lengthwise) — stretch goes up and down",
}

LYCRA_SPANDEX_STANDARDS: dict[str, str] = {
    "min_elongation_pct":       "12.5%",
    "min_power_psi":            "0.6 lb/sq.in for recovery under wet/dry conditions",
    "flex_cycles_zero_pullback":"3,000 cycles",
    "min_lycra_content_oz_sqyd":"0.6 oz/sq.yd for working stretch",
    "elbow_flex_length_pct":    "35–40%",
    "elbow_flex_circumference_pct": "15–22%",
    "knee_flex_length_pct":     "35–45%",
    "knee_flex_circumference_pct":  "12–14%",
    "across_back_flex_pct":     "13–16%",
    "seat_flex_across_pct":     "4–6%",
}


def get_knit_pattern_adjustment(grade_name: str) -> KnitPatternAdjustment | None:
    """Returns the pattern adjustment spec for a given KnitStretchGrade name."""
    for adj in KNIT_PATTERN_ADJUSTMENTS:
        if adj.grade == grade_name:
            return adj
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION D — 省道幾何計算規則（Dart Geometry）
# Source: Armstrong Ch 4, Ch 2 measurement landmarks
# ═══════════════════════════════════════════════════════════════════════════════

# Dart point distance from bust point (BP), by cup size
# Positive = below or away from BP (standard dart point offset)
DART_POINT_OFFSET_MM: dict[str, dict[str, float]] = {
    # one_dart: single-dart system (waist dart only)
    "one_dart": {
        "all_cups": 15.88,   # 5/8" below BP — universal one-dart rule
    },
    # two_dart: waist dart + side dart system
    "two_dart": {
        "A": 19.05,  # 3/4" — shallow cup; OVERLAP 3/8" at shoulder dart
        "B": 25.4,   # 1"   — standard cup; no adjustment needed
        "C": 38.1,   # 1.5" — full cup; SPREAD 3/8" at shoulder dart
        "D": 44.45,  # 1.75"— very full; SPREAD 3/4"
        "DD": 50.8,  # 2"   — extra full; SPREAD 1"
    },
}

# Cup size shoulder-dart adjustment (spread = positive, overlap = negative)
CUP_SIZE_SHOULDER_DART_ADJUSTMENT_MM: dict[str, float] = {
    "A":  -9.525,  # overlap 3/8"
    "B":   0.0,    # no change
    "C":   9.525,  # spread 3/8"
    "D":  19.05,   # spread 3/4"
    "DD": 25.4,    # spread 1"
}

# Armhole depth by size (from Armstrong Standard Measurement Chart)
# Value = depth in inches (converted to mm)
ARMHOLE_DEPTH_BY_SIZE_MM: dict[int, float] = {
    6:  (3 + 3/4) * 25.4,    # 3 3/4" → 95.25 mm
    8:  (4 + 0/8) * 25.4,    # 4"      → 101.6
    10: (4 + 1/8) * 25.4,    # 4 1/8"  → 104.8
    12: (4 + 2/8) * 25.4,    # 4 1/4"  → 107.95
    14: (4 + 3/8) * 25.4,    # 4 3/8"  → 111.1
    16: (4 + 4/8) * 25.4,    # 4 1/2"  → 114.3
    18: (4 + 5/8) * 25.4,    # 4 5/8"  → 117.5
    # grading increment between sizes: +1/8" (3.175 mm)
}

# Nine standard dart transfer positions and their angular relationships to BP
DART_TRANSFER_POSITIONS: dict[str, dict] = {
    "shoulder":      {"angle_from_cf_deg": 60,  "typical_width_in": (0.5, 1.5)},
    "mid_armhole":   {"angle_from_cf_deg": 90,  "typical_width_in": (0.75, 2.0)},
    "side_seam":     {"angle_from_cf_deg": 120, "typical_width_in": (1.0, 2.5)},
    "waist_side":    {"angle_from_cf_deg": 150, "typical_width_in": (1.0, 2.5)},
    "waist_center":  {"angle_from_cf_deg": 180, "typical_width_in": (0.5, 1.5)},
    "hem":           {"angle_from_cf_deg": 210, "typical_width_in": (0.5, 2.0)},
    "center_front":  {"angle_from_cf_deg": 240, "typical_width_in": (0.5, 1.5)},
    "french_dart":   {"angle_from_cf_deg": 270, "typical_width_in": (1.0, 3.0),
                      "note": "Diagonal waist-to-side seam; combines waist + side dart."},
    "neckline":      {"angle_from_cf_deg": 30,  "typical_width_in": (0.5, 1.0)},
}

def dart_width_at_distance(
    pivot_distance_mm: float,
    reference_distance_mm: float,
    reference_width_mm: float,
) -> float:
    """
    Scale dart width by distance from bust point.
    Dart width is proportional to distance from BP (same angle = same dart).
    pivot_distance_mm:    distance from BP to new dart location
    reference_distance_mm: distance from BP to known reference dart
    reference_width_mm:   known width at reference dart
    Returns: computed width at new location (mm)
    """
    if reference_distance_mm <= 0:
        return reference_width_mm
    return reference_width_mm * (pivot_distance_mm / reference_distance_mm)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION E — 鬆量/褶份計算（Added Fullness Geometry）
# Source: Armstrong Ch 7
# All measurements in mm
# ═══════════════════════════════════════════════════════════════════════════════

def compute_fullness_width_mm(
    base_measurement_mm: float,
    fullness_ratio: float,
) -> dict[str, float]:
    """
    Compute total pattern width and added fullness for slash-and-spread.

    base_measurement_mm: half-circumference or panel width (e.g. half waist)
    fullness_ratio: 1.5, 2.0, 2.5, 3.0 (Armstrong standard ratios)

    Returns dict with:
        total_width_mm: total cut width (base × ratio)
        added_fullness_mm: extra fabric added (base × (ratio - 1))
        slashes_recommended: suggested number of slash lines
    """
    added = base_measurement_mm * (fullness_ratio - 1.0)
    total = base_measurement_mm * fullness_ratio
    # Armstrong recommendation: 1 slash per 1–1.5" (~25–38 mm) of added fullness
    slashes = max(2, round(added / 32.0))
    return {
        "total_width_mm": round(total, 1),
        "added_fullness_mm": round(added, 1),
        "slashes_recommended": slashes,
        "gather_notch_offset_mm": 13.0,  # 1/2" from first/last slash
    }


# Pleat and tuck geometric constants (all in mm / inches from Armstrong Ch 8)
PLEAT_TUCK_RULES: dict[str, dict] = {
    "box_pleat": {
        "fold_direction":      "folds meet at center, face outward",
        "intake_per_pleat_mm": 76.2,   # 3" standard box pleat intake
        "notch_from_fold_mm":  38.1,   # 1.5" notch from fold
    },
    "inverted_box_pleat": {
        "fold_direction":      "folds meet at center, face inward (classic center-back pleat)",
        "intake_per_pleat_mm": 76.2,   # 3" — same as box pleat
        "notch_from_fold_mm":  38.1,
    },
    "knife_pleat": {
        "fold_direction":      "all folds face same direction",
        "intake_per_pleat_mm": 50.8,   # 2" typical
        "notch_from_fold_mm":  25.4,
    },
    "action_pleat": {
        "fold_direction":      "center-back spread for movement",
        "intake_per_pleat_mm": 76.2,   # 3" (Armstrong back yoke)
        "crossmark_from_armhole_mm": 63.5,  # 2.5" from armhole at yokeline
    },
    "pleat_tuck_standard": {
        # Armstrong: 3/4" from CF for extension, 3/4" guideline, 1" to second guideline
        "extension_from_cf_mm": 19.05,   # 3/4"
        "first_guideline_mm":   19.05,   # 3/4" from CF
        "second_guideline_mm":  25.4,    # 1" from first guideline
        "finished_width_range": "1/16\"–1\" (1.6–25.4 mm)",
    },
    "pin_tuck": {
        # Armstrong industry standard: 1/2" tuck + 1/2" space = 1" per tuck
        "tuck_width_mm":  12.7,    # 1/2" finished width
        "space_mm":       12.7,    # 1/2" space between tucks
        "total_per_tuck_mm": 25.4, # 1" = tuck + space
        "individual_tuck_width_mm": 1.59,  # 1/16" (fine pin tuck)
        "individual_space_mm":      6.35,  # 1/4" apart
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION F — 育克 / 翼片 / 縱向拼接規則
# Source: Armstrong Ch 8 (Yokes, Flanges)
# ═══════════════════════════════════════════════════════════════════════════════

YOKE_RULES: dict[str, dict] = {
    "front_yoke_basic": {
        "placement_from_cf_neck_mm": 63.5,  # 2.5" down from CF neck (varies)
        "slash_direction":           "parallel to CF from BP; from side dart to BP",
        "gather_notch_from_slash_mm": 38.1,  # 1.5" each side at yoke and dart legs at waist
        "method":                    "slash-and-spread (close side dart first)",
    },
    "back_yoke_basic": {
        "yoke_line_from_cb_mm":      "1/4 center back length or at HBL",
        "dart_transfer_target":      "mid-armhole (excess may gap slightly or be eliminated)",
        "pivotal_point":             "1/4 center back length — pivot point on yokeline",
        "method":                    "pivotal transfer",
    },
    "back_yoke_inverted_box_pleat": {
        "extension_at_cb_mm":        76.2,   # 3" added to CB width
        "notch_positions_from_cb_mm": [0, 38.1],  # at CB and 1.5" from CB
        "fold_at_cb":                True,
    },
    "back_yoke_action_pleat": {
        "crossmark_from_armhole_mm": 63.5,   # 2.5" at yokeline
        "spread_for_pleat_mm":       76.2,   # 3" intake
        "gather_notch_from_dart_mm": 25.4,   # 1" each side of dart leg
    },
    "back_yoke_with_gathers": {
        "extension_for_gathers_mm":  76.2,   # 3"+ below yokeline at CB
        "note":                      "Waist dart (broken line) absorbed into gathers.",
    },
}

FLANGE_RULES: dict[str, dict] = {
    "definition": (
        "A flange is an extension or separate piece that forms a continuation of the garment. "
        "It may be the same fabric or a contrast piece stitched in the styleline."
    ),
    "critical_constraint": (
        "The fold of a flange placed at the shoulderline must NOT fall within the "
        "curve of the armhole — this distorts armhole fit."
    ),
    "dart_flange": {
        # Dart excess transferred to shoulder tip → folds as flange
        "fold_direction":    "inside fold toward center front",
        "notch_at_dart_leg_and_half_beyond_mm": "half dart width beyond notch",
        "trim_excess_within_mm": 38.1,   # 1.5" within dart leg
    },
    "flange_to_waist": {
        # Principle #2 fullness used (no dart excess)
        "from_shoulder_tip_mm": 25.4,   # 1" from front/back shoulder tip (A)
        "from_side_waist_mm":   76.2,   # 3" from side waist (B)
        "spread_for_flange_mm": 76.2,   # 3" spread for 1.5"-wide flange
        "gather_notch_from_slash_mm": "2\" from center lines",
        "button_extension_mm":  25.4,   # 1" at CF for buttons
    },
    "flange_inset": {
        "from_dart_legs_waist_mm": 25.4,   # 1" A from front/back dart legs at waist
        "from_shoulder_tip_mm":    12.7,   # 1/2" B from shoulder tips
        "gather_notch_from_cf_mm": 50.8,   # 2" from center lines at waist
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION G — 縱向分割線（Styleline Geometry）
# Source: Armstrong Ch 6
# ═══════════════════════════════════════════════════════════════════════════════

STYLELINE_RULES: dict[str, dict] = {
    "classic_princess": {
        "path_front":  "shoulder dart → over bust point → waist dart → hem",
        "path_back":   "shoulder blade dart → waist dart → hem",
        "ease_notch_above_bp_mm": 50.8,   # 2" ease notch above BP
        "ease_notch_below_bp_mm": 50.8,   # 2" ease notch below BP
        "pivot_x_offset_from_bp_mm": 19.05,  # 3/4" from BP (labeled X)
        "note": "Side bust ease from 1-dart system; close side dart to auto-provide ease.",
        "extra_ease_spread_mm": 6.35,  # 1/4" additional spread if more ease needed
    },
    "armhole_princess": {
        "path_front":  "mid-armhole → over bust point → waist",
        "path_back":   "mid-armhole → shoulder blade → waist",
        "mid_armhole_up_mm": 9.525,   # 3/8" up from midpoint of guideline 2
        "note": "Styleline curves from BP to mid-armhole; NOT a dart transfer — "
                "no BP pivot needed for back panel.",
    },
    "panel_styleline": {
        "path_front":  "waist → mid-armhole (1/2\" from front)",
        "path_back":   "waist → mid-armhole (1/2\" from back)",
        "offset_from_princess_mm": 12.7,  # 1/2" from front/back (not through BP)
        "note": "Panel line is NOT a dart equivalent — does not pass through BP. "
                "Use separate ease control, not dart manipulation.",
        "dart_retention": "waist dart remains; ease control notches at waist only",
    },
    "empire_styleline": {
        "path": "horizontal or curved line crossing under bust",
        "contour_guideline": 4,       # must apply Guideline 4 (3/4\" under-bust removal)
        "semi_fit_reduction_per_dart_mm": 4.76,  # 3/16" per dart leg for semi-fit
    },
    "yoke_styleline": {
        "placement_range": "anywhere above bust level (front) or above/at/below shoulder blades (back)",
        "gathers_to_yoke": True,
        "pleats_to_yoke": True,
        "plain_panel_to_yoke": True,
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION H — 褲長衍生定義 (Pant Length Derivatives)
# Source: Armstrong Ch 26, p.613
# All offsets from crotch level unless noted
# ═══════════════════════════════════════════════════════════════════════════════

PANT_LENGTH_DERIVATIVES: dict[str, dict] = {
    "short_shorts": {
        "inseam_from_crotch_mm":  (25.4, 38.1),  # 1–1.5" below crotch
        "side_seam_from_crotch_mm": (-38.1, -25.4),  # 1–1.5" ABOVE crotch at side seam
        "description_zh": "超短褲，接近大腿根部",
    },
    "shorts": {
        "from_crotch_mm": 50.8,   # 2" below crotch level
        "description_zh": "普通短褲",
    },
    "jamaica": {
        "position": "halfway between crotch and knee",
        "description_zh": "牙買加褲，大腿中段",
    },
    "bermuda": {
        "position": "halfway between Jamaica and knee",
        "description_zh": "百慕達褲，接近膝蓋上方",
    },
    "pedal_pusher": {
        "from_knee_mm": -50.8,   # 2" below knee
        "description_zh": "踩踏褲，膝下約2吋",
    },
    "toreador": {
        "position": "halfway between knee and ankle",
        "description_zh": "鬥牛士褲，小腿中段",
    },
    "capri": {
        "from_ankle_mm": 25.4,   # 1" above ankle
        "description_zh": "卡布里褲，踝上約1吋",
    },
    "full_length": {
        "to_ankle": True,
        "description_zh": "長褲，到踝骨",
    },
}

# Pant fit problems and their pattern corrections (Armstrong Ch 26, Problems 1–14)
PANT_FIT_PROBLEMS: dict[int, dict] = {
    1:  {"problem": "Pant too tight (horizontal stress lines)",
         "correction": "Add measured amount to front and back side seams; correct waistband."},
    2:  {"problem": "Pant too loose (vertical folds)",
         "correction": "Subtract measured amount from front and back side seams/inseams."},
    3:  {"problem": "Pulling at crotch point (insufficient crotch extension)",
         "correction": "Add half of open space measurement to each inseam; blend to knee."},
    4:  {"problem": "Crotch too high (stress folds directed to crotch)",
         "correction": "Lower front and back crotch point by measured amount; blend to center line."},
    5:  {"problem": "Crotch too low",
         "correction": "Raise crotch point by measured amount at center front/back."},
    6:  {"problem": "Back crotch droops (flat buttocks)",
         "correction": "Slash to (not through) center back; overlap measured amount; blend."},
    7:  {"problem": "Stress at center front (insufficient pubic area room)",
         "correction": "Add half measured amount to center line; equal amount to crotch point."},
    8:  {"problem": "Stress from abdomen (waistband pulled downward)",
         "correction": "Slash to side seam; spread; add to center line and crotch point."},
    9:  {"problem": "Vertical fold at center front/back",
         "correction": "Trim equal amounts at center line; blend to crotch curve; adjust grainline."},
    10: {"problem": "Hemline out of alignment (high/low waistline or dominant bulge)",
         "correction": "Release side seam to hip; release darts; re-pin; add to front pant."},
    11: {"problem": "Back excess under waistband (sway back or hip area too tight)",
         "correction": "Trim measured amount from waist; re-mark zipper notch."},
    12: {"problem": "Diagonal pull at side seam (insufficient back dart for dominant buttocks)",
         "correction": "Add to center dart point as shown; use muslin as guide."},
    13: {"problem": "Back pant pulled downward from sitting",
         "sub_a": "Low-cut pant: add 1–2\" to center back; blend to zero at side seam.",
         "sub_b": "Basic waistband pant: slash from CB; spread measured amount; blend."},
    14: {"problem": "Diagonal stress lines toward thigh/calf (dominant thigh)",
         "correction": "Add 3/4 measured amount to crotch; 1/4 to side seam; blend."},
}

# Jumpsuit construction rule
JUMPSUIT_RULE: str = (
    "The creaseline of the pant MUST be parallel to center front and center back of the "
    "torso. If not parallel, place push pin at crossmark and pivot pant until creaseline "
    "grain is parallel. Lower front and back crotch 1/2\" (12.7 mm). Blend crotch and "
    "hipline of the pant with the torso outline."
)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION I — 版型符號 / 標記規則 (Grainline, Notch, Symbol Standards)
# Source: Armstrong throughout (confirmed Ch 2–3, Ch 6–9)
# ═══════════════════════════════════════════════════════════════════════════════

GRAINLINE_RULES: dict[str, str] = {
    "woven_lengthwise":   "Arrow parallel to selvage (center front / center back standard)",
    "woven_crosswise":    "Arrow perpendicular to selvage (waistbands, cuffs)",
    "woven_bias":         "Arrow at 45° to selvage (bias-cut garments for drape)",
    "knit_lengthwise":    "Arrow parallel to rib/wale direction",
    "knit_crosswise":     "Arrow perpendicular to rib — ensure max stretch encircles figure",
    "fold_line":          "Double-headed arrow or 'FOLD' annotation; cut on fold",
}

NOTCH_RULES: dict[str, str] = {
    "single_notch":    "Front seams — one notch",
    "double_notch":    "Back seams — two notches",
    "ease_notch":      "Marks start and end of ease/gathering zone",
    "gather_control":  "1/2\" (13 mm) outside first and last slash line",
    "balance_notch":   "Crossmark to align pattern pieces during sewing",
    "dart_leg_notch":  "Mark at end of each dart leg (closest to seam)",
    "pleat_notch":     "Mark fold line and placement line for each pleat",
}

SYMBOL_LEGEND: dict[str, str] = {
    "BP":      "Bust Point",
    "CF":      "Center Front",
    "CB":      "Center Back",
    "SS":      "Side Seam",
    "SW":      "Side Waist",
    "SH":      "Shoulder Seam",
    "SH_TIP":  "Shoulder Tip (outermost shoulder point)",
    "HBL":     "Horizontal Balance Line (connects underarm level, used as reference)",
    "HPS":     "High Point Shoulder (HPS — base of neck at shoulder; FreeSewing anchor)",
    "WL":      "Waist Line",
    "HL":      "Hip Line",
    "CL":      "Crotch Level (pants)",
    "KL":      "Knee Level",
}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION J — 圖片分析規則：輪廓 → 打版原則映射
# 供 Claude Vision / auto_pattern_maker.py 使用的決策樹
# ═══════════════════════════════════════════════════════════════════════════════

def detect_required_armstrong_principles(
    silhouette: str,
    collar_type: str,
    sleeve_type: str,
    has_gathers: bool = False,
    has_yoke: bool = False,
    has_flare: bool = False,
    neckline_depth: str = "standard",  # "standard" | "low_cut" | "cutout"
    armhole_style: str = "standard",   # "standard" | "cutout" | "dropped"
    waist_treatment: str = "dart",     # "dart" | "empire" | "smocked" | "elastic"
) -> dict[str, bool | list[str]]:
    """
    决策树：根据服装视觉特征返回需要应用哪些 Armstrong 原则。
    Returns a dict with booleans and lists describing required principles.
    """
    needs_dart_manip = True  # P1 always applies to bodice
    needs_added_fullness = has_gathers or has_flare or silhouette in (
        "trapeze", "tent", "circle_skirt", "gathered",
        "flared", "empire", "a_line",
    )
    contour_guidelines_needed: list[int] = []

    if neckline_depth in ("low_cut", "cutout"):
        contour_guidelines_needed.append(1)   # G1 neckline
    if armhole_style == "cutout":
        contour_guidelines_needed.extend([2, 3])  # G2+G3 armhole
    if collar_type == "strapless" or sleeve_type in ("sleeveless", "tank", "spaghetti"):
        contour_guidelines_needed.extend([2, 3])
    if collar_type == "strapless":
        contour_guidelines_needed.extend([1, 5, 6])  # full strapless set
    if waist_treatment == "empire":
        contour_guidelines_needed.append(4)   # G4 under-bust
    # Remove duplicates, sort
    contour_guidelines_needed = sorted(set(contour_guidelines_needed))

    needs_contouring = len(contour_guidelines_needed) > 0

    # Fullness ratio recommendation
    fullness_ratio = 1.0
    if silhouette in ("gathered", "a_line"):
        fullness_ratio = 1.5
    elif silhouette in ("flared", "empire"):
        fullness_ratio = 2.0
    elif silhouette in ("trapeze", "tent"):
        fullness_ratio = 2.5
    elif silhouette == "circle_skirt":
        fullness_ratio = 3.0

    return {
        "principle_1_dart_manipulation": needs_dart_manip,
        "principle_2_added_fullness": needs_added_fullness,
        "principle_3_contouring": needs_contouring,
        "contour_guidelines_needed": contour_guidelines_needed,
        "fullness_ratio_recommended": fullness_ratio,
        "yoke_construction": has_yoke,
        "notes": (
            "Apply principles in order: P1 (dart) → P2 (fullness) → P3 (contouring). "
            "Contouring must be applied AFTER all dart/fullness manipulation."
        ),
    }


def compute_pattern_adjustments_for_knit(
    grade_name: str,
    is_25_to_50_pct_range: bool = False,
) -> dict[str, float]:
    """
    Returns a flat dict of all pattern adjustments (in mm) for a given knit grade.
    If is_25_to_50_pct_range is True, adds 3.175 mm (1/8\") to each value.
    """
    adj = get_knit_pattern_adjustment(grade_name)
    if not adj:
        return {}
    extra = 3.175 if is_25_to_50_pct_range else 0.0
    return {
        "neckline_raise_mm":              adj.neckline_raise_mm + extra,
        "side_seam_remove_mm":            adj.side_seam_remove_mm + extra,
        "armhole_raise_mm":               adj.armhole_raise_mm + extra,
        "dart_point_raise_mm":            adj.dart_point_raise_mm + extra,
        "hem_waist_remove_mm":            adj.hem_waist_remove_mm + extra,
        "sleeve_biceps_raise_mm":         adj.sleeve_biceps_raise_mm + extra,
        "sleeve_underarm_remove_mm":      adj.sleeve_underarm_remove_mm + extra,
        "sleeve_hem_remove_mm":           adj.sleeve_hem_remove_mm + extra,
        "sleeve_elbow_dart_reposition_mm": adj.sleeve_elbow_dart_reposition_mm + extra,
        "crotch_raise_trouser_mm":        adj.crotch_raise_trouser_mm + extra,
        "crotch_raise_slack_jean_mm":     adj.crotch_raise_slack_jean_mm + extra,
    }
