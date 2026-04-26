"""
patternmaking_rules.py — 打版知識庫
來源：Patternmaking for Fashion Design, 5th Ed. (Helen Joseph-Armstrong)

本模組提供：
1. 服裝分類詞彙表（供 Claude Vision prompt 使用）
2. 各部件標準術語（領型、袖型、褲型、裙型、輪廓線）
3. FreeSewing 設計映射規則（圖片特徵 → fs_design_id）
4. 鬆量標準（ease）與針織布彈性等級
5. 版型工藝建議輔助函數
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
