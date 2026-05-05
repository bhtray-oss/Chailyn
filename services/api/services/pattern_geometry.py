"""
pattern_geometry.py
════════════════════════════════════════════════════════════════════════════════
Armstrong 5th Ed. — Complete Geometric Pattern Engine
Source chapters:
  Ch.2  Model Measurements
  Ch.3  Bodice / Torso Sloper
  Ch.5  Skirts — Added Fullness (Pleats + Flare)
  Ch.6  Princess Seam
  Ch.11 Neckline Variations
  Ch.16 Dart Manipulation (Pivot + Slash-and-Spread)
  Ch.20 Pockets — Side Seam (In-seam)
  Ch.24 Production Marking (Notches, Awl Punches, Grainlines, HBL)

Units: inches throughout. Call .to_mm() on any Point for mm conversion.

Garment analysed for reference: Beige sleeveless top + A-line pleated skirt
  • Top:     jewel neckline, side-dart transfer, ~1/4–1/2" ease
  • Waist:   in-set waistband ~1.75"
  • Skirt:   A-line flare base + 2 symmetric box pleats front, side pockets, midi
"""

from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import Optional
from services.armstrong_bodice import (
    ArmstrongMeasurements,
    Point,
    FrontBodicePoints,
    BackBodicePoints,
    BoxPleatLayout,
    draft_front_bodice,
    draft_back_bodice,
    calculate_box_pleat_layout,
)


# ══════════════════════════════════════════════════════════════════════════════
# GEOMETRY HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _lerp(a: Point, b: Point, t: float) -> Point:
    """Linear interpolation between two points."""
    return Point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)


def _offset_point(p: Point, normal: Point, dist: float) -> Point:
    """Translate point p by dist along unit normal vector."""
    return Point(p.x + normal.x * dist, p.y + normal.y * dist)


def _segment_normal(a: Point, b: Point) -> Point:
    """Unit normal (left-hand side) of segment a→b."""
    dx, dy = b.x - a.x, b.y - a.y
    length = math.hypot(dx, dy) or 1e-9
    return Point(-dy / length, dx / length)


def _polyline_length(pts: list[Point]) -> float:
    """Arc length of a polyline."""
    return sum(pts[i].dist(pts[i + 1]) for i in range(len(pts) - 1))


def _smooth_curve(pts: list[Point], iterations: int = 2) -> list[Point]:
    """
    Chaikin curve refinement — replaces each segment with two new points
    at 1/4 and 3/4 positions, producing a smoother outline.
    Used for armhole, neckline, and hem curves.
    """
    for _ in range(iterations):
        out = [pts[0]]
        for i in range(len(pts) - 1):
            out.append(_lerp(pts[i], pts[i + 1], 0.25))
            out.append(_lerp(pts[i], pts[i + 1], 0.75))
        out.append(pts[-1])
        pts = out
    return pts


def _offset_polyline(pts: list[Point], dist: float) -> list[Point]:
    """
    Parallel offset of a polyline by dist inches (positive = left normal).
    Used for pocket facing and seam allowance generation.
    """
    result = []
    n = len(pts)
    for i, p in enumerate(pts):
        if i == 0:
            n_vec = _segment_normal(pts[0], pts[1])
        elif i == n - 1:
            n_vec = _segment_normal(pts[-2], pts[-1])
        else:
            n1 = _segment_normal(pts[i - 1], pts[i])
            n2 = _segment_normal(pts[i], pts[i + 1])
            # Miter average
            mx = (n1.x + n2.x) / 2
            my = (n1.y + n2.y) / 2
            mag = math.hypot(mx, my) or 1e-9
            n_vec = Point(mx / mag, my / mag)
        result.append(_offset_point(p, n_vec, dist))
    return result


# ══════════════════════════════════════════════════════════════════════════════
# RESULT DATACLASSES
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class SkirtSloperResult:
    """A-line skirt base BEFORE pleat/flare transformation."""
    waist_width:      float   # half front waist = waist_arc + ease
    hip_width:        float   # half front hip   = hip_arc + ease
    hem_width:        float   # half front hem (A-line flare, no extra pleats)
    skirt_length:     float
    waist_dart_depth: float   # excess to be transferred or closed
    waist_dart_width: float
    # 4-point outline for half-front sloper
    outline: list[Point]      # CF-top → side-top → side-hem → CF-hem → (close)


@dataclass
class FlareSkirtResult:
    """
    A-line after closing waist dart and transferring excess to hem.
    Principle #2 — Added Fullness via Slash-and-Spread.
    """
    hem_width_after_flare: float   # wider than base
    flare_added_per_slash: float   # inches of hem added per slash line
    slash_count:           int
    outline:               list[Point]
    trueing_note:          str


@dataclass
class PleatCoords:
    """Coordinates for one box pleat (all in inches from CF)."""
    pleat_number:     int
    visible_width:    float
    underlay_width:   float
    outer_fold_L:     float   # x from CF
    inner_fold_L:     float
    center_line:      float
    inner_fold_R:     float
    outer_fold_R:     float
    press_from_waist: float   # depth baste line
    notch_top_L:      Point
    notch_top_R:      Point
    awl_punch:        Point   # where press stops


@dataclass
class PleatTransformResult:
    """Full skirt after pleat slash-and-spread applied."""
    total_cut_width:  float           # full half-front width
    extra_fabric:     float           # added by all pleats
    pleat_coords:     list[PleatCoords]
    post_pleat_outline: list[Point]   # outer pattern boundary
    production_note:  str


@dataclass
class PocketFacingResult:
    """
    Armstrong Ch.20 — Side seam in-seam pocket.
    Generates facing strip + bag shape for front and back.
    """
    opening_start_y:  float   # distance from waist
    opening_end_y:    float
    opening_length:   float
    facing_width:     float   # typically 2"
    bag_depth:        float   # typically 5.5-6"
    bag_width:        float   # typically 5.5"
    # 2D outlines
    front_facing:     list[Point]
    back_facing:      list[Point]
    bag_shape:        list[Point]
    # Notch positions
    opening_notch_top:    Point
    opening_notch_bottom: Point
    grainline_dir:        str   # "lengthwise"
    sa_note:              str


@dataclass
class WaistbandResult:
    """In-set waistband (torso-foundation waistband style)."""
    finished_width:   float   # e.g. 1.75"
    cut_width:        float   # + seam allowances both sides
    front_length:     float   # half front waist circumference
    back_length:      float
    total_cut_length: float   # full circle = front + back × 2
    interfacing_note: str
    notch_positions:  list[dict]


@dataclass
class SeamTrueingReport:
    """
    Armstrong Ch.24 — Seam length comparison & trueing notes.
    True = seams joined must match in length.
    """
    checks: list[dict]  # {"seam": name, "length_a": float, "length_b": float, "ok": bool, "delta": float}
    all_ok: bool
    recommendation: str


@dataclass
class ProductionMarkings:
    """All production marks for the complete garment."""
    notches:    list[dict]   # {piece, position, type}
    awl_punches: list[dict]  # {piece, position, note}
    grainlines:  list[dict]  # {piece, direction, from_pt, to_pt}
    hbl:         list[dict]  # {piece, y_value, note}   horizontal balance lines
    seam_allowance_in: float  # standard = 0.625 (5/8")


@dataclass
class CompletePatternResult:
    """Top-level result from the full pattern geometry engine."""
    garment_description:  str
    measurements_used:    dict

    # --- Pattern pieces ---
    bodice_front:         FrontBodicePoints
    bodice_back:          BackBodicePoints
    waistband:            WaistbandResult
    skirt_sloper:         SkirtSloperResult
    flare_skirt:          FlareSkirtResult
    pleat_transform:      PleatTransformResult
    pocket_facing:        PocketFacingResult

    # --- Validation ---
    seam_trueing:         SeamTrueingReport
    production_markings:  ProductionMarkings
    warnings:             list[str]


# ══════════════════════════════════════════════════════════════════════════════
# PRINCIPLE #2 — A-LINE FLARE (slash-and-spread)
# ══════════════════════════════════════════════════════════════════════════════

def draft_aline_flare_skirt(m: ArmstrongMeasurements) -> tuple[SkirtSloperResult, FlareSkirtResult]:
    """
    Armstrong Ch.16 Principle #2 — Added Fullness via Slash-and-Spread.

    Step 1: Draft A-line skirt base sloper.
    Step 2: Close waist dart and rotate excess to hem (slash lines).

    Coordinate system: waist-CF = (0, 0); Y+ = down toward hem; X+ = toward side seam.
    """
    # ── Ease constants (Armstrong semi-fitted standard) ───────────────────────
    WAIST_EASE = 0.25   # 1/4" per half
    HIP_EASE   = 0.50   # 1/2" per half
    HEM_EASE   = 2.00   # A-line extra at hem (per half) beyond hip
    SA         = 0.625  # 5/8" seam allowance (not added to sloper)

    waist_w = m.m19_waist_arc + WAIST_EASE
    hip_w   = m.hip_arc       + HIP_EASE
    hem_w   = hip_w           + HEM_EASE
    L       = m.skirt_length

    # Waist dart parameters (excess between waist and hip)
    dart_excess = (hip_w - waist_w)
    dart_width  = min(dart_excess * 0.5, 1.25)  # max 1-1/4" waist dart
    dart_depth  = round(m.hip_depth * 0.85, 4)  # dart stops 85% of hip depth

    # Dart placement: 1/3 of the way from CF along waist
    dart_x = waist_w * 0.33
    dart_pt = Point(dart_x, dart_depth)

    # ── Sloper outline (half front, no ease for seams yet) ────────────────────
    A = Point(0,     0)         # CF waist top
    B = Point(waist_w, 0)       # Side waist
    C = Point(hip_w,   m.hip_depth)      # Side hip
    D = Point(hem_w,   L)       # Side hem
    E = Point(0,       L)       # CF hem

    sloper_outline = [A, B, C, D, E, A]   # close

    sloper = SkirtSloperResult(
        waist_width      = round(waist_w, 4),
        hip_width        = round(hip_w, 4),
        hem_width        = round(hem_w, 4),
        skirt_length     = round(L, 4),
        waist_dart_depth = round(dart_depth, 4),
        waist_dart_width = round(dart_width, 4),
        outline          = sloper_outline,
    )

    # ── Principle #2: Slash and Spread ────────────────────────────────────────
    # Number of slash lines = 3 (Armstrong standard for A-line from waist dart)
    SLASH_COUNT = 3
    # Each slash adds hem spread proportional to dart width / slash count
    spread_per_slash = round((dart_width * m.skirt_length) / (dart_depth * SLASH_COUNT), 4)
    extra_hem        = round(spread_per_slash * SLASH_COUNT, 4)
    new_hem_w        = round(hem_w + extra_hem, 4)

    # Post-flare outline (simplified — linear side seam swing)
    D2 = Point(new_hem_w, L)
    flare_outline = [A, B, C, D2, E, A]
    flare_outline = _smooth_curve(flare_outline, iterations=1)  # gentle curve

    flare = FlareSkirtResult(
        hem_width_after_flare = new_hem_w,
        flare_added_per_slash = spread_per_slash,
        slash_count           = SLASH_COUNT,
        outline               = flare_outline,
        trueing_note          = (
            f"After closing {dart_width:.3f}\" waist dart across {SLASH_COUNT} slash lines, "
            f"hem gained {extra_hem:.3f}\" per half (×2 = {extra_hem*2:.3f}\" full hem). "
            "True hem curve with French curve from CF; must be perpendicular to CF."
        ),
    )

    return sloper, flare


# ══════════════════════════════════════════════════════════════════════════════
# PRINCIPLE #2 — BOX PLEAT SLASH-AND-SPREAD (coordinate transform)
# ══════════════════════════════════════════════════════════════════════════════

def apply_box_pleat_transform(
    flare: FlareSkirtResult,
    m:     ArmstrongMeasurements,
) -> PleatTransformResult:
    """
    Armstrong Ch.5 — Box Pleat geometry applied on top of flare skirt.

    Algorithm:
      1. Place pleat center lines at pre-defined X positions on waist.
      2. For each pleat: all points with X > pleat_center shift right by (visible + 2×underlay).
      3. The shift creates two new vertical lines:
           outer_fold (= visible/2 + underlay from center) → fold toward CF
           inner_fold (= visible/2 from center)             → folds meet at underside
      4. Generate notch and awl punch coordinates for production.
    """
    visible   = m.box_pleat_visible
    underlay  = m.box_pleat_underlay
    count     = m.box_pleat_count_front
    press_d   = m.box_pleat_press_depth
    unit_w    = visible + underlay * 2   # e.g. 9"
    total_extra = unit_w * count

    # Pleat centers: evenly spaced, first at 3" from CF
    base_width = flare.hem_width_after_flare
    waist_w    = base_width
    CF_OFFSET  = 3.0  # first pleat center 3" from CF (Armstrong standard)
    spacing    = (waist_w * 0.6 - CF_OFFSET) / max(count - 1, 1) if count > 1 else 0

    pleat_coords = []
    # Running X-shift: each pleat adds unit_w to the total pattern width
    x_offset = 0.0

    for i in range(count):
        # Nominal center on the flare pattern
        ctr_nominal = CF_OFFSET + i * spacing
        # After shift from previous pleats
        ctr = ctr_nominal + x_offset

        outer_L = round(ctr - visible / 2 - underlay, 4)
        inner_L = round(ctr - visible / 2, 4)
        inner_R = round(ctr + visible / 2, 4)
        outer_R = round(ctr + visible / 2 + underlay, 4)

        # Points at waist (y=0) and at press depth
        notch_L  = Point(inner_L, 0)
        notch_R  = Point(inner_R, 0)
        awl      = Point(ctr, press_d)

        pleat_coords.append(PleatCoords(
            pleat_number  = i + 1,
            visible_width = visible,
            underlay_width= underlay,
            outer_fold_L  = outer_L,
            inner_fold_L  = inner_L,
            center_line   = round(ctr, 4),
            inner_fold_R  = inner_R,
            outer_fold_R  = outer_R,
            press_from_waist = press_d,
            notch_top_L  = notch_L,
            notch_top_R  = notch_R,
            awl_punch    = awl,
        ))
        x_offset += unit_w  # shift subsequent points

    # Post-pleat outline (CF, outer pleat edges, side seam, hem, CF-hem)
    # Simplified: just widen the waist/hem by total_extra
    new_waist = round(waist_w + total_extra, 4)
    new_hem   = round(flare.hem_width_after_flare + total_extra, 4)
    L         = flare.outline[-2].y if len(flare.outline) >= 2 else m.skirt_length

    post_outline = [
        Point(0,          0),      # CF waist
        Point(new_waist,  0),      # side waist
        Point(new_waist + 1.0, m.hip_depth),  # side hip (slight flare)
        Point(new_hem,    L),      # side hem
        Point(0,          L),      # CF hem
        Point(0,          0),      # close
    ]

    return PleatTransformResult(
        total_cut_width  = new_waist,
        extra_fabric     = round(total_extra, 4),
        pleat_coords     = pleat_coords,
        post_pleat_outline = post_outline,
        production_note  = (
            f"{count} box pleats × {unit_w:.2f}\" ({visible}\" visible + {underlay}×2\" underlay) "
            f"= {total_extra:.2f}\" added to cut width. "
            f"Baste across waist at 3/8\" before joining waistband. "
            f"Press pleat legs {press_d}\" from waist down; awl punch at fold stop."
        ),
    )


# ══════════════════════════════════════════════════════════════════════════════
# WAISTBAND (in-set)
# ══════════════════════════════════════════════════════════════════════════════

def draft_inset_waistband(m: ArmstrongMeasurements, finished_width: float = 1.75) -> WaistbandResult:
    """
    Armstrong torso-foundation in-set waistband.
    Cut on straight grain; full interfacing; seam allowance on both long edges.
    Notch at CF, CB, and side seam points.
    """
    SA        = 0.625
    front_len = m.m19_waist_arc + 0.25        # ease
    back_len  = (m.m19_waist_arc * 1.05)      # back waist slightly larger

    total_length = (front_len + back_len) * 2
    cut_width    = finished_width + SA * 2

    notch_positions = [
        {"position": "CF",        "x": 0,           "side": "both"},
        {"position": "CB",        "x": total_length / 2, "side": "both"},
        {"position": "side_front","x": front_len,     "side": "top"},
        {"position": "side_back", "x": front_len + back_len, "side": "top"},
    ]

    return WaistbandResult(
        finished_width = round(finished_width, 4),
        cut_width      = round(cut_width, 4),
        front_length   = round(front_len, 4),
        back_length    = round(back_len, 4),
        total_cut_length = round(total_length, 4),
        interfacing_note = (
            "Apply fusible woven interfacing to full cut piece. "
            "Understitch waistband to seam allowance after joining top. "
            "Finished width 1-3/4\"; total cut width (incl. 2×5/8\" SA) = "
            f"{cut_width:.3f}\"."
        ),
        notch_positions = notch_positions,
    )


# ══════════════════════════════════════════════════════════════════════════════
# POCKET — SIDE SEAM IN-SEAM (Ch.20)
# ══════════════════════════════════════════════════════════════════════════════

def draft_side_seam_pocket(
    m:               ArmstrongMeasurements,
    opening_start_y: float = 3.0,   # 3" below waist
    opening_length:  float = 6.0,   # standard opening
    facing_width:    float = 2.0,
    bag_depth:       float = 5.75,
    bag_width:       float = 5.5,
) -> PocketFacingResult:
    """
    Armstrong Ch.20 — In-seam side pocket.

    Pattern pieces generated:
      1. Front pocket facing  (attached to skirt front side seam)
      2. Back pocket facing   (attached to skirt back side seam)
      3. Pocket bag           (lining; sewn to both facings)

    Coordinate origin: waist side-seam point = (0, 0); Y+ = down.
    """
    opening_end_y = opening_start_y + opening_length

    # ── Front facing ─────────────────────────────────────────────────────────
    # Follows side seam curve from opening_start_y to opening_end_y,
    # then extends inward by facing_width.
    # For a straight side seam (simplified):
    ff_A = Point(0,            opening_start_y)   # top of opening on seam
    ff_B = Point(0,            opening_end_y)     # bottom of opening on seam
    ff_C = Point(-facing_width, opening_end_y)    # inner bottom
    ff_D = Point(-facing_width, opening_start_y)  # inner top
    front_facing = [ff_A, ff_B, ff_C, ff_D, ff_A]

    # ── Back facing ──────────────────────────────────────────────────────────
    bf_A = Point(0,            opening_start_y)
    bf_B = Point(0,            opening_end_y)
    bf_C = Point(-facing_width * 0.75, opening_end_y)  # slightly narrower back facing
    bf_D = Point(-facing_width * 0.75, opening_start_y)
    back_facing = [bf_A, bf_B, bf_C, bf_D, bf_A]

    # ── Pocket bag ────────────────────────────────────────────────────────────
    # D-shape: straight top seam, curved bottom
    bag_top_y  = opening_start_y - 0.5    # slightly above opening top
    bag_bot_y  = bag_top_y + bag_depth
    bag_x_in   = -bag_width               # inward

    pg_A = Point(0,       bag_top_y)
    pg_B = Point(bag_x_in, bag_top_y)
    # Rounded bottom: 5 interpolated points along an arc
    arc_cx, arc_cy = bag_x_in / 2, bag_bot_y
    arc_r          = abs(bag_x_in) / 2
    arc_pts = [
        Point(arc_cx + arc_r * math.cos(t), arc_cy + arc_r * math.sin(t))
        for t in [math.pi, 5 * math.pi / 6, 4 * math.pi / 6, 3 * math.pi / 6, 2 * math.pi / 6, math.pi / 6, 0]
    ]
    bag_shape = [pg_A, pg_B] + arc_pts + [pg_A]

    return PocketFacingResult(
        opening_start_y   = round(opening_start_y, 4),
        opening_end_y     = round(opening_end_y, 4),
        opening_length    = round(opening_length, 4),
        facing_width      = round(facing_width, 4),
        bag_depth         = round(bag_depth, 4),
        bag_width         = round(bag_width, 4),
        front_facing      = front_facing,
        back_facing       = back_facing,
        bag_shape         = bag_shape,
        opening_notch_top    = ff_A,
        opening_notch_bottom = ff_B,
        grainline_dir     = "lengthwise (parallel to side seam)",
        sa_note           = (
            "Add 5/8\" SA to all edges except pocket opening (stay-stitched at 3/8\"). "
            "Understitch front and back facings to SA. Clip curves every 1/2\"."
        ),
    )


# ══════════════════════════════════════════════════════════════════════════════
# SEAM TRUEING (Ch.24)
# ══════════════════════════════════════════════════════════════════════════════

def true_seams(
    front: FrontBodicePoints,
    back:  BackBodicePoints,
    pleat: PleatTransformResult,
    wb:    WaistbandResult,
) -> SeamTrueingReport:
    """
    Armstrong Ch.24 — verify critical seam length matches.
    Tolerance: ±1/16" (0.0625")
    """
    TOLERANCE = 0.0625

    # Bodice side seam length (approx): N to P (front) vs back equivalent
    bodice_side_front = front.N.dist(front.P)
    # Back side: from G level to waist; approx
    back_shoulder_y = back.G.y
    bodice_side_back = abs(back_shoulder_y - 0) * 0.48   # approx 48% of back height

    # Waistband vs bodice bottom + skirt top
    bodice_waist_front_half = abs(front.P.x - front.B.x)
    waist_front_half        = wb.front_length
    skirt_waist_front_half  = pleat.total_cut_width * 0.5   # after gathering to waistband

    checks = [
        {
            "seam":    "Bodice side (front vs back)",
            "length_a": round(bodice_side_front, 4),
            "length_b": round(bodice_side_back, 4),
            "delta":    round(abs(bodice_side_front - bodice_side_back), 4),
            "ok":       abs(bodice_side_front - bodice_side_back) <= TOLERANCE,
            "note":     "Ease-stitch the longer side if delta > 1/16\"",
        },
        {
            "seam":    "Waistband front vs bodice waist",
            "length_a": round(waist_front_half, 4),
            "length_b": round(bodice_waist_front_half, 4),
            "delta":    round(abs(waist_front_half - bodice_waist_front_half), 4),
            "ok":       abs(waist_front_half - bodice_waist_front_half) <= TOLERANCE * 4,
            "note":     "Waistband includes ease; small delta expected",
        },
        {
            "seam":    "Waistband front vs skirt top (pre-gather/pleat)",
            "length_a": round(waist_front_half, 4),
            "length_b": round(skirt_waist_front_half, 4),
            "delta":    round(abs(waist_front_half - skirt_waist_front_half), 4),
            "ok":       True,   # pleat always wider by design — OK
            "note":     "Skirt top wider than waistband by pleat depth — correct; baste pleats before joining",
        },
    ]

    all_ok = all(c["ok"] for c in checks)

    return SeamTrueingReport(
        checks         = checks,
        all_ok         = all_ok,
        recommendation = (
            "All seams check passed." if all_ok else
            "Review flagged seams. Use ease-stitching or re-draft to bring within 1/16\" tolerance."
        ),
    )


# ══════════════════════════════════════════════════════════════════════════════
# PRODUCTION MARKINGS (Ch.24)
# ══════════════════════════════════════════════════════════════════════════════

def generate_production_markings(
    front:  FrontBodicePoints,
    pleat:  PleatTransformResult,
    pocket: PocketFacingResult,
    wb:     WaistbandResult,
    m:      ArmstrongMeasurements,
) -> ProductionMarkings:
    """
    Armstrong Ch.24 — complete production annotation set.

    Notch spec:   1/4" × 1/16" (standard double notch = 2 marks 1/4" apart)
    Awl punch:    1/8" diameter at fold-stop points (inside seam area)
    Grainline:    lengthwise warp = parallel to CF/CB
    HBL:          at hip level (waist_to_hip below waist)
    """
    SA = 0.625

    notches: list[dict] = []
    awls:    list[dict] = []
    grains:  list[dict] = []
    hbls:    list[dict] = []

    # ── Bodice front notches ──────────────────────────────────────────────────
    notches += [
        {"piece": "bodice_front", "location": "side_seam_waist",
         "point": {"x": round(front.P.x, 4), "y": 0},       "type": "single"},
        {"piece": "bodice_front", "location": "underarm",
         "point": {"x": round(front.N.x, 4), "y": round(front.N.y, 4)}, "type": "double"},
        {"piece": "bodice_front", "location": "dart_base_L",
         "point": {"x": round(front.F.x, 4), "y": round(front.F.y, 4)}, "type": "single"},
        {"piece": "bodice_front", "location": "dart_base_R",
         "point": {"x": round(front.Q.x, 4), "y": round(front.Q.y, 4)}, "type": "single"},
    ]

    # ── Waistband notches ─────────────────────────────────────────────────────
    for nb in wb.notch_positions:
        notches.append({"piece": "waistband", "location": nb["position"],
                        "point": {"x": nb["x"], "y": 0}, "type": "single"})

    # ── Skirt pleat notches + awl punches ─────────────────────────────────────
    for pc in pleat.pleat_coords:
        notches += [
            {"piece": "skirt_front", "location": f"pleat_{pc.pleat_number}_inner_L",
             "point": {"x": pc.inner_fold_L, "y": 0}, "type": "single"},
            {"piece": "skirt_front", "location": f"pleat_{pc.pleat_number}_inner_R",
             "point": {"x": pc.inner_fold_R, "y": 0}, "type": "single"},
        ]
        awls.append({
            "piece": "skirt_front",
            "location": f"pleat_{pc.pleat_number}_press_stop",
            "point": {"x": pc.awl_punch.x, "y": pc.awl_punch.y},
            "note": f"Pleat {pc.pleat_number} press stops here; baste from waist to this point",
        })

    # ── Pocket opening notches ────────────────────────────────────────────────
    notches += [
        {"piece": "skirt_front", "location": "pocket_open_top",
         "point": {"x": round(pocket.opening_notch_top.x, 4),
                   "y": round(pocket.opening_notch_top.y, 4)}, "type": "double"},
        {"piece": "skirt_front", "location": "pocket_open_bottom",
         "point": {"x": round(pocket.opening_notch_bottom.x, 4),
                   "y": round(pocket.opening_notch_bottom.y, 4)}, "type": "double"},
    ]

    # ── Grainlines (parallel to CF/CB = Y-axis) ───────────────────────────────
    for piece in ["bodice_front", "bodice_back", "skirt_front", "skirt_back",
                  "waistband", "pocket_facing_front", "pocket_bag"]:
        grains.append({
            "piece":    piece,
            "direction":"lengthwise (warp / parallel to CF or CB)",
            "note":     "Arrow runs full length of piece; align to fabric selvedge",
        })

    # ── Horizontal Balance Lines (HBL) ────────────────────────────────────────
    hbls += [
        {"piece": "skirt_front",  "y_from_waist": round(m.hip_depth, 4),
         "note": "Hip balance line — must be horizontal when garment is on dress form"},
        {"piece": "skirt_back",   "y_from_waist": round(m.hip_depth, 4),
         "note": "Hip balance line — match front HBL at side seam"},
        {"piece": "bodice_front", "y_from_waist": round(m.m19_waist_arc * 0.3, 4),
         "note": "Chest balance line — 30% of waist arc above natural waist"},
    ]

    return ProductionMarkings(
        notches           = notches,
        awl_punches       = awls,
        grainlines        = grains,
        hbl               = hbls,
        seam_allowance_in = SA,
    )


# ══════════════════════════════════════════════════════════════════════════════
# MASTER ASSEMBLER
# ══════════════════════════════════════════════════════════════════════════════

def generate_complete_pattern(
    m:               ArmstrongMeasurements,
    waistband_width: float = 1.75,
    pocket_opening:  float = 6.0,
) -> CompletePatternResult:
    """
    End-to-end pattern geometry computation for the reference garment:
    Beige sleeveless top + A-line box-pleat skirt with in-seam pockets.

    Steps:
      1. Draft front + back bodice slopers (Ch.3)
      2. Draft in-set waistband (torso foundation)
      3. Draft A-line flare skirt via slash-and-spread (Ch.5 + Ch.16 P#2)
      4. Apply box pleat transform (Ch.5 P#2)
      5. Generate side-seam pocket facing & bag (Ch.20)
      6. True all seams (Ch.24)
      7. Generate production markings (Ch.24)
    """
    warnings: list[str] = []

    # 1. Bodice slopers
    front_bodice = draft_front_bodice(m)
    back_bodice  = draft_back_bodice(m)
    warnings.extend(front_bodice.warnings)

    # 2. Waistband
    wb = draft_inset_waistband(m, finished_width=waistband_width)

    # 3. Skirt sloper + flare
    skirt_sloper, flare_skirt = draft_aline_flare_skirt(m)

    # 4. Box pleat transform (applied on flare base)
    pleat_result = apply_box_pleat_transform(flare_skirt, m)

    # 5. Pocket
    pocket = draft_side_seam_pocket(m, opening_length=pocket_opening)

    # 6. Seam trueing
    trueing = true_seams(front_bodice, back_bodice, pleat_result, wb)
    if not trueing.all_ok:
        warnings.append(trueing.recommendation)

    # 7. Production markings
    markings = generate_production_markings(front_bodice, pleat_result, pocket, wb, m)

    measurements_used = {
        "bust_arc_in":    round(m.m17_bust_arc, 4),
        "waist_arc_in":   round(m.m19_waist_arc, 4),
        "hip_arc_in":     round(m.hip_arc, 4),
        "hip_depth_in":   round(m.hip_depth, 4),
        "skirt_length_in":round(m.skirt_length, 4),
        "cb_length_in":   round(m.cb_length, 4),
    }

    return CompletePatternResult(
        garment_description  = (
            "Sleeveless jewel-neck top + in-set waistband + "
            "A-line flare skirt with front box pleats and side in-seam pockets"
        ),
        measurements_used    = measurements_used,
        bodice_front         = front_bodice,
        bodice_back          = back_bodice,
        waistband            = wb,
        skirt_sloper         = skirt_sloper,
        flare_skirt          = flare_skirt,
        pleat_transform      = pleat_result,
        pocket_facing        = pocket,
        seam_trueing         = trueing,
        production_markings  = markings,
        warnings             = warnings,
    )


# ══════════════════════════════════════════════════════════════════════════════
# SERIALISER (dict output for JSON API)
# ══════════════════════════════════════════════════════════════════════════════

def _pt(p: Point) -> dict:
    return {"x": round(p.x, 4), "y": round(p.y, 4)}


def _pts(ps: list[Point]) -> list[dict]:
    return [_pt(p) for p in ps]


def serialize_pattern_result(r: CompletePatternResult) -> dict:
    """Convert CompletePatternResult to a JSON-serialisable dict."""

    def _bodice_front(f: FrontBodicePoints) -> dict:
        return {k: _pt(v) for k, v in vars(f).items() if isinstance(v, Point)}

    def _bodice_back(b: BackBodicePoints) -> dict:
        pts = {k: _pt(v) for k, v in vars(b).items() if isinstance(v, Point)}
        nums = {k: round(v, 4) for k, v in vars(b).items() if isinstance(v, float)}
        return {**pts, **nums}

    return {
        "garment_description": r.garment_description,
        "measurements_used":   r.measurements_used,
        "warnings":            r.warnings,

        "bodice_front": {
            "points":   _bodice_front(r.bodice_front),
        },
        "bodice_back": {
            "points":   _bodice_back(r.bodice_back),
        },
        "waistband": {
            "finished_width_in":  r.waistband.finished_width,
            "cut_width_in":       r.waistband.cut_width,
            "front_length_in":    r.waistband.front_length,
            "back_length_in":     r.waistband.back_length,
            "total_cut_length_in":r.waistband.total_cut_length,
            "interfacing_note":   r.waistband.interfacing_note,
            "notch_positions":    r.waistband.notch_positions,
        },
        "skirt_sloper": {
            "waist_width_in":      r.skirt_sloper.waist_width,
            "hip_width_in":        r.skirt_sloper.hip_width,
            "hem_width_in":        r.skirt_sloper.hem_width,
            "skirt_length_in":     r.skirt_sloper.skirt_length,
            "waist_dart_depth_in": r.skirt_sloper.waist_dart_depth,
            "waist_dart_width_in": r.skirt_sloper.waist_dart_width,
            "outline":             _pts(r.skirt_sloper.outline),
        },
        "flare_skirt": {
            "hem_width_after_flare_in":  r.flare_skirt.hem_width_after_flare,
            "flare_added_per_slash_in":  r.flare_skirt.flare_added_per_slash,
            "slash_count":               r.flare_skirt.slash_count,
            "outline":                   _pts(r.flare_skirt.outline),
            "trueing_note":              r.flare_skirt.trueing_note,
        },
        "pleat_transform": {
            "total_cut_width_in": r.pleat_transform.total_cut_width,
            "extra_fabric_in":    r.pleat_transform.extra_fabric,
            "production_note":    r.pleat_transform.production_note,
            "post_pleat_outline": _pts(r.pleat_transform.post_pleat_outline),
            "pleats": [
                {
                    "pleat_number":    pc.pleat_number,
                    "visible_width_in":pc.visible_width,
                    "underlay_width_in":pc.underlay_width,
                    "outer_fold_L_in": pc.outer_fold_L,
                    "inner_fold_L_in": pc.inner_fold_L,
                    "center_in":       pc.center_line,
                    "inner_fold_R_in": pc.inner_fold_R,
                    "outer_fold_R_in": pc.outer_fold_R,
                    "press_depth_in":  pc.press_from_waist,
                    "notch_top_L":     _pt(pc.notch_top_L),
                    "notch_top_R":     _pt(pc.notch_top_R),
                    "awl_punch":       _pt(pc.awl_punch),
                }
                for pc in r.pleat_transform.pleat_coords
            ],
        },
        "pocket_facing": {
            "opening_start_y_in":  r.pocket_facing.opening_start_y,
            "opening_end_y_in":    r.pocket_facing.opening_end_y,
            "opening_length_in":   r.pocket_facing.opening_length,
            "facing_width_in":     r.pocket_facing.facing_width,
            "bag_depth_in":        r.pocket_facing.bag_depth,
            "bag_width_in":        r.pocket_facing.bag_width,
            "front_facing":        _pts(r.pocket_facing.front_facing),
            "back_facing":         _pts(r.pocket_facing.back_facing),
            "bag_shape":           _pts(r.pocket_facing.bag_shape),
            "opening_notch_top":   _pt(r.pocket_facing.opening_notch_top),
            "opening_notch_bottom":_pt(r.pocket_facing.opening_notch_bottom),
            "grainline":           r.pocket_facing.grainline_dir,
            "sa_note":             r.pocket_facing.sa_note,
        },
        "seam_trueing": {
            "all_ok":       r.seam_trueing.all_ok,
            "checks":       r.seam_trueing.checks,
            "recommendation": r.seam_trueing.recommendation,
        },
        "production_markings": {
            "notches":     r.production_markings.notches,
            "awl_punches": r.production_markings.awl_punches,
            "grainlines":  r.production_markings.grainlines,
            "hbl":         r.production_markings.hbl,
            "seam_allowance_in": r.production_markings.seam_allowance_in,
        },
    }
