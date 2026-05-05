"""
armstrong_bodice.py — Armstrong 5th Ed. 前後片打版公式引擎
Source: Patternmaking for Fashion Design (Helen Joseph-Armstrong) Ch.3 / 5 / 6 / 11 / 16

Units: 英吋 (inches)。呼叫方傳入英吋，輸出點座標也是英吋。
若需 mm，乘以 25.4。

BPD-2026-02 Missy 12 驗證值（P2 Measurement Chart）：
  m5=16.50, m6=17.00, m7=5.75, m9=9.75, m10=3.75, m11=16.00
  m13=5.00, m14=15.50, m15=7.00, m16=7.25, m17=18.00, m18=17.50
  m19=14.00, m20=3.25, hip_arc=19.50, hip_depth=7.00, cb_length=15.75
  sq_nk_width_half=6.25, sq_nk_depth=2.75, skirt_length=28.50
  box_pleat_visible=3.00, box_pleat_underlay=3.00
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import math


@dataclass
class Point:
    x: float
    y: float

    def dist(self, other: "Point") -> float:
        return math.hypot(self.x - other.x, self.y - other.y)

    def __repr__(self) -> str:
        return f"({self.x:.4f}, {self.y:.4f})"


@dataclass
class ArmstrongMeasurements:
    """Armstrong Ch.2 Model Measurement Chart — 英吋"""
    m5_cf_length: float         # (5)  Center front length, neck → waist
    m6_full_length: float       # (6)  Full front length, shoulder → waist
    m7_shoulder_slope: float    # (7)  Shoulder slope
    m9_bust_depth: float        # (9)  Shoulder point to bust point
    m10_bust_span: float        # (10) CF to bust point (half)
    m11_side_length: float      # (11) Underarm to waist
    m13_shoulder_len: float     # (13) Shoulder seam length
    m14_across_shoulder: float  # (14) Full back shoulder width
    m15_across_chest: float     # (15) Front across chest
    m16_across_back: float      # (16) Back width
    m17_bust_arc: float         # (17) Half bust circumference
    m18_back_arc: float         # (18) Half back circumference
    m19_waist_arc: float        # (19) Half waist circumference
    m20_dart_placement: float   # (20) CF to dart position at waist

    # 附加量測（非 Ch.2 標準編號）
    hip_arc: float              # Half hip circumference
    hip_depth: float            # Waist to hip level (typically 7")
    cb_length: float            # Center back neck to waist
    skirt_length: float         # Waist to hem

    # 方領（若有）
    sq_nk_width_half: Optional[float] = None   # Half of square neckline width
    sq_nk_depth: Optional[float] = None         # Square neckline depth

    # 箱褶（若有）
    box_pleat_visible: float = 3.0              # Visible width per pleat
    box_pleat_underlay: float = 3.0             # Each underlay arm
    box_pleat_count_front: int = 2              # Pleats on front
    box_pleat_count_back: int = 2               # Pleats on back
    box_pleat_press_depth: float = 6.0          # Press from waist down

    units: str = "imperial"


@dataclass
class FrontBodicePoints:
    """Armstrong Ch.3 前片打版點位"""
    A: Point    # CF top (shoulder line height)
    B: Point    # CF waist
    C: Point    # Shoulder reference (half across shoulder - 1/8")
    D: Point    # CF neck point
    E: Point    # Bust arc width
    G: Point    # Shoulder slope point
    H: Point    # Bust depth on G-B line
    I: Point    # Shoulder end point
    J: Point    # Bust point
    K: Point    # Across chest width
    N: Point    # New strap (side top)
    O: Point    # Side waist reference
    P: Point    # Waist side (1-1/4" out from E)
    F: Point    # Dart base (CF side)
    Q: Point    # Dart base (side seam side)
    dart_pt: Point  # Dart vanishing point (5/8" from bust point)
    warnings: list[str] = field(default_factory=list)


@dataclass
class BackBodicePoints:
    """Armstrong Ch.3 後片打版點位"""
    A: Point    # CB top
    B: Point    # CB waist
    E: Point    # Back arc width
    G: Point    # Shoulder slope
    I: Point    # Shoulder end
    nk_width: float     # Back neck width = 3-1/4"
    nk_depth: float     # Back neck depth = 7/8"
    shoulder_dart: float
    waist_dart_from_cb: float = 1.0  # Back waist dart = 1" from CB


@dataclass
class PrincessSeamResult:
    """Armstrong Ch.6 公主線轉換結果"""
    cf_panel_outline: list[Point]       # CF panel outer edge points
    side_front_panel_outline: list[Point]
    princess_seam_line: list[Point]     # Shared seam: armhole → bust → waist


@dataclass
class BoxPleatLayout:
    """Armstrong Ch.5 箱褶排版"""
    cut_width_total: float              # Total cut width including pleat allowance
    pleat_unit_width: float             # visible + 2 × underlay = 9"
    fold_lines: list[dict]              # Each pleat's outer/inner fold coords
    baste_line_depth: float             # 6" from waist
    note: str


@dataclass
class SquareNecklineResult:
    """Armstrong Ch.11 方領計算"""
    front_width: float                  # Half width of front sq. neckline
    front_depth: float
    back_width: float                   # Slightly narrower than front
    back_depth: float
    facing_depth: float = 2.25          # Facing cut depth (standard = 2-1/4" front, 1-3/4" back)
    corner_tolerance_deg: float = 0.0   # Must be 90°; any slope = error


# ─── Ch.3 前片打版 ─────────────────────────────────────────────────────────────

def draft_front_bodice(m: ArmstrongMeasurements) -> FrontBodicePoints:
    """
    Armstrong Ch.3 p.40-41 前片基礎版
    座標系：B=(0,0) 為前腰中心，Y軸向上為正，X軸向右（CF→側縫）。
    """
    warnings: list[str] = []

    # P2 BPD-2026-02 驗算：bust-waist diff standard = 10"
    bw_diff = (m.m17_bust_arc - m.m19_waist_arc) * 2
    if abs(bw_diff - 10.0) > 0.375:
        warnings.append(
            f"Bust-waist diff = {bw_diff:.2f}\" (standard 10\" ±3/8\"). "
            "Adjust dart intake per Armstrong p.44."
        )

    # Figure 1 — Reference lines
    A = Point(0, m.m6_full_length + 0.125)  # A to B = full length + 1/8"
    B = Point(0, 0)                           # CF waist origin
    C = Point(m.m14_across_shoulder / 2 - 0.125, A.y)  # A to C = across shld/2 - 1/8"
    D = Point(0, m.m5_cf_length)             # B to D = CF length (neck pt)
    E = Point(m.m17_bust_arc + 0.25, 0)     # B to E = bust arc + 1/4" ease

    # Figure 2 — Shoulder + bust
    G = Point(C.x, m.m7_shoulder_slope + 0.125)  # B to G = slope + 1/8"
    H = Point(C.x, G.y - m.m9_bust_depth)         # G to H = bust depth
    I = Point(C.x - m.m13_shoulder_len, G.y + 0.25)  # G to I = shoulder length

    # J = bust point
    J = Point(m.m10_bust_span + 0.25, m.m5_cf_length - 1.0)  # approx 1" below CF neck
    K = Point(m.m15_across_chest + 0.25, J.y)  # L to M = across chest + 1/4"

    # Figure 3 — Side seam + waist
    N = Point(E.x, G.y - 0.5)        # new strap reference (side top)
    O = Point(N.x, N.y - m.m11_side_length)   # N to O = side length
    P = Point(N.x + 1.25, 0)         # waist side = 1-1/4" out from bust arc

    # Figure 4 — Waist dart
    F = Point(m.m20_dart_placement, 0.1875)    # B to F = dart placement
    dart_width = (m.m19_waist_arc + 0.25) - m.m20_dart_placement
    Q = Point(F.x + dart_width, 0.1875)
    dart_pt = Point(J.x, J.y - 0.625)  # 5/8" from bust point toward waist

    return FrontBodicePoints(
        A=A, B=B, C=C, D=D, E=E,
        G=G, H=H, I=I, J=J, K=K,
        N=N, O=O, P=P, F=F, Q=Q,
        dart_pt=dart_pt,
        warnings=warnings,
    )


# ─── Ch.3 後片打版 ─────────────────────────────────────────────────────────────

def draft_back_bodice(m: ArmstrongMeasurements) -> BackBodicePoints:
    """
    Armstrong Ch.3 後片基礎版
    BPD-2026-02 P4: Back CB = CB length + 1/8"
    Back neck width = 3-1/4"; depth = 7/8"
    """
    A = Point(0, m.cb_length + 0.125)  # Back CB = CB length + 1/8"
    B = Point(0, 0)                     # CB waist
    E = Point(m.m18_back_arc + 0.25, 0)  # Back B to E = back arc + 1/4"

    # Shoulder slope (back = front slope - 1/4" typically)
    G = Point(m.m14_across_shoulder / 2 - 0.125, m.m7_shoulder_slope - 0.125)
    I = Point(G.x - m.m13_shoulder_len, G.y + 0.125)

    # Back neck: standard 3-1/4" wide, 7/8" deep
    nk_width = 3.25
    nk_depth = 0.875

    # Shoulder dart (pinch excess)
    shoulder_dart = max(0.0, (m.m14_across_shoulder / 2 - m.m16_across_back) * 0.5)

    return BackBodicePoints(
        A=A, B=B, E=E, G=G, I=I,
        nk_width=nk_width, nk_depth=nk_depth,
        shoulder_dart=shoulder_dart,
        waist_dart_from_cb=1.0,
    )


# ─── Ch.6 公主線轉換 ──────────────────────────────────────────────────────────

def convert_to_princess_seam(front: FrontBodicePoints) -> PrincessSeamResult:
    """
    Armstrong Ch.6 p.124
    Rotate waist dart + bust dart into single princess seamline from armhole → waist.
    BPD-2026-02: 4 panels (CF + Side Front front; CB + Side Back back), zero external darts.
    Clip seam allowance every 1/2" at concave curves.
    """
    # Princess seam runs: armhole edge (K) → bust point (J) → dart vanish → waist dart base
    princess_seam = [front.K, front.J, front.dart_pt, front.F]

    # CF panel outline: D (neck) → A (top CF) → ... → B (waist) → F (dart left side)
    cf_panel = [front.D, front.A, front.G, front.I, front.K, front.J, front.dart_pt, front.F, front.B, front.D]

    # Side Front panel: opposite side of princess seam → side seam
    side_front = [front.K, front.I, front.N, front.P, front.Q, front.dart_pt, front.J, front.K]

    return PrincessSeamResult(
        cf_panel_outline=cf_panel,
        side_front_panel_outline=side_front,
        princess_seam_line=princess_seam,
    )


# ─── Ch.5 箱褶計算 ────────────────────────────────────────────────────────────

def calculate_box_pleat_layout(
    base_width: float,
    m: ArmstrongMeasurements,
    cf_offset: float = 3.0,
) -> BoxPleatLayout:
    """
    Armstrong Ch.5
    BPD-2026-02 P5:
      visible_per_pleat = 3", underlay_each_arm = 3" → pleat_unit = 9"
      2 pleats front → 18" extra fabric added to cut width
      Press pleat legs from waist down 6"
      Outer fold toward center; inner folds meet at underside

    Args:
        base_width: finished skirt half-front width (before pleats)
        cf_offset:  distance from CF to first pleat center line
    """
    visible = m.box_pleat_visible
    underlay = m.box_pleat_underlay
    count = m.box_pleat_count_front

    pleat_unit = visible + underlay * 2   # 3 + 3 + 3 = 9"
    extra = pleat_unit * count             # 18" for 2 front pleats
    cut_width = base_width + extra

    # Auto-space pleats evenly if count > 1
    spacing = (base_width - cf_offset) / max(count, 1)

    fold_lines = []
    for i in range(count):
        ctr = cf_offset + i * spacing
        fold_lines.append({
            "pleat": i + 1,
            "center": round(ctr, 4),
            "outer_fold_L": round(ctr - visible / 2 - underlay, 4),
            "inner_fold_L": round(ctr - visible / 2, 4),
            "inner_fold_R": round(ctr + visible / 2, 4),
            "outer_fold_R": round(ctr + visible / 2 + underlay, 4),
            "press_depth": m.box_pleat_press_depth,
            "note": "Outer folds meet at underside center; inner folds face up.",
        })

    return BoxPleatLayout(
        cut_width_total=cut_width,
        pleat_unit_width=pleat_unit,
        fold_lines=fold_lines,
        baste_line_depth=m.box_pleat_press_depth,
        note=(
            f"{count} box pleats × {pleat_unit}\" each = {extra}\" added to cut width. "
            f"Baste across waist at 3/8\" before joining bodice."
        ),
    )


# ─── Ch.11 方領計算 ───────────────────────────────────────────────────────────

def calculate_square_neckline(m: ArmstrongMeasurements) -> SquareNecklineResult:
    """
    Armstrong Ch.11 style modification for square neckline.
    BPD-2026-02 P6:
      Front: 12.50" wide (full) × 2.25" deep facing, cut on fold
      Back:  11.50" wide (full) × 1.75" deep facing, cut on fold
      All 4 corners must be true right angles (90°).
      Interface full piece. Understitch 1/4" from seam.
    """
    if m.sq_nk_width_half is None or m.sq_nk_depth is None:
        raise ValueError("sq_nk_width_half and sq_nk_depth required for square neckline.")

    front_width = m.sq_nk_width_half  # half-width (will be mirrored at CF fold)
    front_depth = m.sq_nk_depth

    # Back is 0.5" narrower and 1.25" shallower than front (Armstrong standard & P4 note)
    back_width = front_width - 0.25   # half width
    back_depth = max(0.5, front_depth - 1.25)

    return SquareNecklineResult(
        front_width=front_width,
        front_depth=front_depth,
        back_width=back_width,
        back_depth=back_depth,
        facing_depth=2.25,        # Front facing: 2-1/4" deep per P6
        corner_tolerance_deg=0.0,
    )


# ─── Ch.16 袖窿貼邊計算 ───────────────────────────────────────────────────────

def calculate_armhole_facing(
    front: FrontBodicePoints,
    facing_width: float = 2.0,
) -> dict:
    """
    Armstrong Ch.16 — Sleeveless armhole facing.
    BPD-2026-02 P6:
      Front AH facing: 2" wide × approx. 8" long
      Back AH facing:  2" wide × approx. 7.5" long
      Interface full piece. Understitch 1/4". Trim 1/8" at shoulder/neck.
      AH lowered 1/2" below standard for sleeveless (P3 note).
    """
    # AH facing follows the curved armhole opening, not the full panel width.
    # For sleeveless, front AH ≈ 8", back ≈ 7.5" per BPD-2026-02 P6.
    # Straight-line I→K→N overestimates — use BPD fixed values for now.
    ah_length_approx = 8.0  # Front AH facing length per P6
    return {
        "front_facing_width_in": facing_width,
        "front_facing_length_in": round(ah_length_approx, 2),
        "back_facing_width_in": facing_width,
        "back_facing_length_in": round(ah_length_approx * 0.93, 2),  # back AH slightly shorter
        "ah_lowered_in": 0.5,
        "staystitch_from_edge_in": 0.5,
        "understitch_from_seam_in": 0.25,
        "trim_at_shoulder_in": 0.125,
        "clip_curves_every_in": 0.75,
        "notes": [
            "Join front + back facing at shoulder seams before attaching.",
            "Stitch facing to AH right sides together; grade; clip every 3/4\".",
            "Understitch 1/4\" from seam. Turn; press.",
            "Attach straps at basted 1/4\" before final press.",
        ],
    }


# ─── 完整 BPD-2026-02 打版包 ─────────────────────────────────────────────────

def draft_bpd_2026_02(m: ArmstrongMeasurements) -> dict:
    """
    BPD-2026-02 Sleeveless Square-Neck Box-Pleat A-Line Midi Dress 完整打版。
    回傳所有打版組件的計算結果，供前端顯示或 pattern-engine 使用。
    """
    front    = draft_front_bodice(m)
    back     = draft_back_bodice(m)
    princess = convert_to_princess_seam(front)
    sq_nk    = calculate_square_neckline(m)
    ah_facing = calculate_armhole_facing(front)

    # Skirt base half-width = hip_arc + 1" ease (BPD formula)
    skirt_base_half = m.hip_arc + 1.0
    box_pleats = calculate_box_pleat_layout(skirt_base_half, m)

    # Strap: cut 2-1/4" wide (finished 1-7/8" after 1/4" SA each edge)
    strap_cut_width = 2.25
    strap_length_approx = m.m6_full_length + 1.0   # shoulder to waist + ease

    return {
        "style": "BPD-2026-02",
        "warnings": front.warnings,
        "front_bodice": {
            "points": {k: {"x": v.x, "y": v.y} for k, v in vars(front).items() if isinstance(v, Point)},
            "panel_count": 2,  # CF + Side Front
        },
        "back_bodice": {
            "points": {
                "A": {"x": back.A.x, "y": back.A.y},
                "B": {"x": back.B.x, "y": back.B.y},
                "E": {"x": back.E.x, "y": back.E.y},
                "G": {"x": back.G.x, "y": back.G.y},
                "I": {"x": back.I.x, "y": back.I.y},
            },
            "nk_width": back.nk_width,
            "nk_depth": back.nk_depth,
            "shoulder_dart": back.shoulder_dart,
            "panel_count": 2,  # CB + Side Back
        },
        "princess_seam": {
            "seam_line": [{"x": p.x, "y": p.y} for p in princess.princess_seam_line],
            "clip_every_in": 0.5,
            "qc_tolerance_in": 0.125,
            "note": "Ease front at bust curve. Press open. L/R symmetry must be ≤ 1/8\".",
        },
        "square_neckline": {
            "front_half_width_in": sq_nk.front_width,
            "front_depth_in": sq_nk.front_depth,
            "back_half_width_in": sq_nk.back_width,
            "back_depth_in": sq_nk.back_depth,
            "facing_depth_in": sq_nk.facing_depth,
            "corner_angle_deg": 90,
            "qc_note": "All 4 corners must be true 90°. Use point presser at corners.",
        },
        "armhole_facing": ah_facing,
        "skirt": {
            "base_half_width_in": skirt_base_half,
            "length_in": m.skirt_length,
            "hem_allowance_in": 1.5,
            "a_line_flare_note": "Steam-shrink full A-line hem before catch-stitching.",
        },
        "box_pleat_layout": {
            "cut_width_incl_pleats_in": box_pleats.cut_width_total,
            "pleat_unit_in": box_pleats.pleat_unit_width,
            "fold_lines": box_pleats.fold_lines,
            "baste_depth_in": box_pleats.baste_line_depth,
            "note": box_pleats.note,
        },
        "strap": {
            "cut_width_in": strap_cut_width,
            "finished_width_in": 1.875,
            "length_approx_in": round(strap_length_approx, 2),
            "cut_count": 2,
            "note": "Fold right sides together; stitch 1/4\" SA; turn right side out; press. Top-stitch both edges 1/8\".",
        },
        "closure": {
            "type": "invisible_zipper",
            "length_in": 22,
            "placement": "CB",
            "install_note": "Install zipper BEFORE joining CB side seams. Stitch from bottom of opening upward.",
        },
        "qc_standards": {
            "spi": 12,
            "seam_allowance_in": 0.625,
            "hem_allowance_in": 1.5,
            "neckline_corner_angle_deg": 90,
            "princess_seam_symmetry_in": 0.125,
            "pleat_alignment_in": 0.125,
        },
    }


# ─── 便利函數：從 cm 量測建立 ArmstrongMeasurements ───────────────────────────

def from_cm(cm_dict: dict) -> ArmstrongMeasurements:
    """將 cm 字典轉換為英吋並建構 ArmstrongMeasurements。"""
    def inch(v):
        return v / 2.54

    return ArmstrongMeasurements(
        m5_cf_length       = inch(cm_dict.get("m5_cf_length_cm", 41.9)),
        m6_full_length     = inch(cm_dict.get("m6_full_length_cm", 43.2)),
        m7_shoulder_slope  = inch(cm_dict.get("m7_shoulder_slope_cm", 14.6)),
        m9_bust_depth      = inch(cm_dict.get("m9_bust_depth_cm", 24.8)),
        m10_bust_span      = inch(cm_dict.get("m10_bust_span_cm", 9.5)),
        m11_side_length    = inch(cm_dict.get("m11_side_length_cm", 40.6)),
        m13_shoulder_len   = inch(cm_dict.get("m13_shoulder_len_cm", 12.7)),
        m14_across_shoulder= inch(cm_dict.get("m14_across_shoulder_cm", 39.4)),
        m15_across_chest   = inch(cm_dict.get("m15_across_chest_cm", 17.8)),
        m16_across_back    = inch(cm_dict.get("m16_across_back_cm", 18.4)),
        m17_bust_arc       = inch(cm_dict.get("m17_bust_arc_cm", 45.7)),
        m18_back_arc       = inch(cm_dict.get("m18_back_arc_cm", 44.5)),
        m19_waist_arc      = inch(cm_dict.get("m19_waist_arc_cm", 35.6)),
        m20_dart_placement = inch(cm_dict.get("m20_dart_placement_cm", 8.3)),
        hip_arc            = inch(cm_dict.get("hip_arc_cm", 49.5)),
        hip_depth          = inch(cm_dict.get("hip_depth_cm", 17.8)),
        cb_length          = inch(cm_dict.get("cb_length_cm", 40.0)),
        skirt_length       = inch(cm_dict.get("skirt_length_cm", 72.4)),
        sq_nk_width_half   = inch(cm_dict["sq_nk_width_half_cm"]) if "sq_nk_width_half_cm" in cm_dict else None,
        sq_nk_depth        = inch(cm_dict["sq_nk_depth_cm"]) if "sq_nk_depth_cm" in cm_dict else None,
        box_pleat_visible  = inch(cm_dict.get("box_pleat_visible_cm", 7.6)),
        box_pleat_underlay = inch(cm_dict.get("box_pleat_underlay_cm", 7.6)),
        box_pleat_count_front = cm_dict.get("box_pleat_count_front", 2),
        box_pleat_count_back  = cm_dict.get("box_pleat_count_back", 2),
        box_pleat_press_depth = inch(cm_dict.get("box_pleat_press_depth_cm", 15.2)),
    )
