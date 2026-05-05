"""
armstrong_calc.py
Convert FreeSewing mm measurements → Armstrong Ch.2 inches + run real draft engine.
Returns accurate formula table from armstrong_bodice.py output.
"""

from __future__ import annotations
from services.armstrong_bodice import (
    ArmstrongMeasurements,
    draft_front_bodice,
    draft_back_bodice,
    calculate_square_neckline,
    calculate_box_pleat_layout,
    calculate_armhole_facing,
)


def fs_mm_to_armstrong(fs_mm: dict) -> ArmstrongMeasurements:
    """
    Convert FreeSewing standard measurements (mm) → Armstrong Ch.2 imperial inches.
    Uses empirical proportions calibrated to Armstrong Size 10-14 Missy standards.

    Required fs_mm keys (mm):
        chest, waist, hips, hpsToWaistBack, shoulderWidth

    Optional:
        highBust, neck, biceps, shoulderToWrist, inseam
    """
    def mm(k, default=0): return fs_mm.get(k, default)
    def in_(k, default=0): return mm(k, default) / 25.4

    bust_in   = in_("chest",          920)
    waist_in  = in_("waist",          720)
    hips_in   = in_("hips",           980)
    back_in   = in_("hpsToWaistBack", 390)
    shld_in   = in_("shoulderWidth",  370)

    bust_arc  = bust_in  / 2   # half bust
    waist_arc = waist_in / 2   # half waist
    hip_arc   = hips_in  / 2   # half hip

    # ── Estimate Armstrong-specific measurements from FreeSewing values ──
    # These proportions are derived from Armstrong's Missy size table Ch.2.
    # Validation: Missy 12 defaults (m17=18.0, m19=14.0, cb=15.75) must pass.

    # m5  CF neck → waist (front CF length) — typically CB - 0.75"
    m5 = round(back_in - 0.75, 4)

    # m6  Shoulder pt → waist front (full front length) — typically CB + 0.125"
    m6 = round(back_in + 0.125, 4)

    # m7  Shoulder slope — 5.75" standard for Missy 12, proportional to back length
    #     Armstrong p.38: measured from horizontal through base of neck to shoulder pt
    m7 = round(5.75 * (back_in / 15.75), 4)

    # m9  Shoulder pt → bust pt (bust depth) — typically ~57% of front length
    m9 = round(m6 * 0.574, 4)

    # m10 CF → bust pt half (bust span) — proportional to bust arc
    m10 = round(bust_arc * 0.208, 4)

    # m11 Underarm → waist (side length) — ~48% of CB for standard bodice
    #     NOTE: BPD-2026-02 uses 16" (full torso block). For general bodice, ~7.5-8.5".
    #     We use back_in as a proxy for the standard full-length torso block.
    m11 = round(back_in, 4)

    # m13 Shoulder seam length — ~1/3 shoulder width
    m13 = round(shld_in / 3.0, 4)

    # m14 Across shoulder = shoulderWidth directly
    m14 = round(shld_in, 4)

    # m15 Across chest (front) — ~45% of shoulder width
    m15 = round(shld_in * 0.452, 4)

    # m16 Across back — ~47% of shoulder width (back slightly wider)
    m16 = round(shld_in * 0.469, 4)

    # m17 Half bust arc
    m17 = round(bust_arc, 4)

    # m18 Half back arc — slightly less than bust (back narrower than front)
    m18 = round(bust_arc * 0.964, 4)

    # m19 Half waist arc
    m19 = round(waist_arc, 4)

    # m20 Dart placement from CF — ~bust_span - 1/4"
    m20 = round(m10 - 0.25, 4)

    return ArmstrongMeasurements(
        m5_cf_length        = m5,
        m6_full_length      = m6,
        m7_shoulder_slope   = m7,
        m9_bust_depth       = m9,
        m10_bust_span       = m10,
        m11_side_length     = m11,
        m13_shoulder_len    = m13,
        m14_across_shoulder = m14,
        m15_across_chest    = m15,
        m16_across_back     = m16,
        m17_bust_arc        = m17,
        m18_back_arc        = m18,
        m19_waist_arc       = m19,
        m20_dart_placement  = m20,
        hip_arc             = round(hip_arc, 4),
        hip_depth           = 7.0,
        cb_length           = round(back_in, 4),
        skirt_length        = round(in_("inseam", 750) * 0.8 + 5, 4),
    )


def compute_formula_table(fs_mm: dict) -> dict:
    """
    Run real Armstrong draft engine; return accurate formula table + key point values.
    """
    m   = fs_mm_to_armstrong(fs_mm)
    fb  = draft_front_bodice(m)
    bb  = draft_back_bodice(m)

    bw_diff = round((m.m17_bust_arc - m.m19_waist_arc) * 2, 3)

    # ── Compute dart width (from front draft) ───────────────────────────
    dart_width = round((m.m19_waist_arc + 0.25) - m.m20_dart_placement, 3)

    # ── Formula rows ─────────────────────────────────────────────────────
    formula_rows = [
        # Ch.2 — Measurement conversion
        {
            "ch": "Ch.2", "ref": "m17",
            "zh": "胸弧（半胸圍）", "en": "Half Bust Arc",
            "formula": "bust ÷ 2",
            "val_in": m.m17_bust_arc,
            "val_mm": round(m.m17_bust_arc * 25.4),
            "note": f"full bust = {round(m.m17_bust_arc*2, 2)}\"",
        },
        {
            "ch": "Ch.2", "ref": "m19",
            "zh": "腰弧（半腰圍）", "en": "Half Waist Arc",
            "formula": "waist ÷ 2",
            "val_in": m.m19_waist_arc,
            "val_mm": round(m.m19_waist_arc * 25.4),
            "note": f"full waist = {round(m.m19_waist_arc*2, 2)}\"",
        },
        {
            "ch": "Ch.2", "ref": "hip_arc",
            "zh": "臀弧（半臀圍）", "en": "Half Hip Arc",
            "formula": "hips ÷ 2",
            "val_in": m.hip_arc,
            "val_mm": round(m.hip_arc * 25.4),
            "note": f"full hips = {round(m.hip_arc*2, 2)}\"",
        },
        {
            "ch": "Ch.2", "ref": "cb_length",
            "zh": "後長 CB", "en": "CB Length",
            "formula": "HPS → waist (back)",
            "val_in": m.cb_length,
            "val_mm": round(m.cb_length * 25.4),
            "note": "Center back neck to natural waist",
        },
        {
            "ch": "Ch.2", "ref": "m14",
            "zh": "肩寬（全肩寬）", "en": "Across Shoulder",
            "formula": "shoulderWidth (full)",
            "val_in": m.m14_across_shoulder,
            "val_mm": round(m.m14_across_shoulder * 25.4),
            "note": "Back across shoulder width",
        },
        # Ch.3 — Front bodice draft points (computed by armstrong_bodice.py)
        {
            "ch": "Ch.3 p.40", "ref": "Pt A",
            "zh": "A: 前中心頂", "en": "A: CF Top",
            "formula": "m6 + 1/8\"",
            "val_in": round(fb.A.y, 3),
            "val_mm": round(fb.A.y * 25.4),
            "note": f"CF vertical height = {round(fb.A.y, 3)}\" above waist",
        },
        {
            "ch": "Ch.3 p.40", "ref": "Pt D",
            "zh": "D: 前頸點 (CF neck)", "en": "D: CF Neck",
            "formula": "B to D = m5_cf_length",
            "val_in": round(fb.D.y, 3),
            "val_mm": round(fb.D.y * 25.4),
            "note": f"y = {round(fb.D.y, 3)}\" above waist",
        },
        {
            "ch": "Ch.3 p.40", "ref": "Pt G",
            "zh": "G: 肩斜點", "en": "G: Shoulder Slope",
            "formula": "m7 + 1/8\" from waist",
            "val_in": round(fb.G.y, 3),
            "val_mm": round(fb.G.y * 25.4),
            "note": f"y = {round(fb.G.y, 3)}\" above waist on C vertical",
        },
        {
            "ch": "Ch.3 p.40", "ref": "Pt E",
            "zh": "E: 胸弧腰線端", "en": "E: Bust Arc at Waist",
            "formula": "m17 + 1/4\" ease",
            "val_in": round(fb.E.x, 3),
            "val_mm": round(fb.E.x * 25.4),
            "note": f"x = {round(fb.E.x, 3)}\" from CF",
        },
        {
            "ch": "Ch.3 p.41", "ref": "Pt J",
            "zh": "J: 胸高點", "en": "J: Bust Point",
            "formula": "m10 + 1/4\" from CF",
            "val_in": round(fb.J.x, 3),
            "val_mm": round(fb.J.x * 25.4),
            "note": f"x={round(fb.J.x,3)}\"  y={round(fb.J.y,3)}\"",
        },
        {
            "ch": "Ch.3 p.41", "ref": "Pt N",
            "zh": "N: 袖窿底/脇底", "en": "N: Underarm (Strap)",
            "formula": "E.x,  G.y − 1/2\"",
            "val_in": round(fb.N.x, 3),
            "val_mm": round(fb.N.x * 25.4),
            "note": f"x={round(fb.N.x,3)}\"  y={round(fb.N.y,3)}\"",
        },
        {
            "ch": "Ch.3 p.41", "ref": "dart_width",
            "zh": "前腰省量", "en": "Front Dart Width",
            "formula": "(m19 + 1/4\") − m20",
            "val_in": dart_width,
            "val_mm": round(dart_width * 25.4),
            "note": f"F→Q at waist: {round(fb.F.x,3)}\" to {round(fb.Q.x,3)}\"",
        },
        {
            "ch": "Ch.3 p.40", "ref": "Pt P",
            "zh": "P: 腰側點", "en": "P: Waist Side",
            "formula": "N.x + 1-1/4\" at waist",
            "val_in": round(fb.P.x, 3),
            "val_mm": round(fb.P.x * 25.4),
            "note": f"Side seam waist = {round(fb.P.x, 3)}\" from CF",
        },
        # Ch.3 Back bodice
        {
            "ch": "Ch.3 p.42", "ref": "back_A",
            "zh": "後CB頂", "en": "Back CB Top",
            "formula": "CB + 1/8\"",
            "val_in": round(bb.A.y, 3),
            "val_mm": round(bb.A.y * 25.4),
            "note": f"CB height = {round(bb.A.y, 3)}\" above waist",
        },
        {
            "ch": "Ch.3 p.42", "ref": "back_nk",
            "zh": "後頸寬 / 深", "en": "Back Neck W / D",
            "formula": "W = 3-1/4\"  D = 7/8\"",
            "val_in": bb.nk_width,
            "val_mm": round(bb.nk_width * 25.4),
            "note": f"Width {bb.nk_width}\"  Depth {bb.nk_depth}\"",
        },
        {
            "ch": "Ch.3 p.42", "ref": "back_shld_dart",
            "zh": "後肩省量", "en": "Back Shoulder Dart",
            "formula": "(m14/2 − m16) × 0.5",
            "val_in": round(bb.shoulder_dart, 3),
            "val_mm": round(bb.shoulder_dart * 25.4),
            "note": "Pinch at shoulder seam toward armhole",
        },
        # Fit QC
        {
            "ch": "Armstrong p.44", "ref": "BW_diff",
            "zh": "胸腰差（省道依據）", "en": "Bust-Waist Diff",
            "formula": "(m17 − m19) × 2",
            "val_in": bw_diff,
            "val_mm": round(bw_diff * 25.4),
            "note": f"Standard 10\" ±3/8\". {'⚠ Adjust dart per p.44.' if abs(bw_diff - 10) > 0.375 else '✓ Within tolerance.'}",
            "warning": abs(bw_diff - 10) > 0.375,
        },
    ]

    # ── Key point coordinate export ───────────────────────────────────────
    def pt(p): return {"x": round(p.x, 4), "y": round(p.y, 4)}

    return {
        "armstrong_measurements": {
            "m5_cf_length":        m.m5_cf_length,
            "m6_full_length":      m.m6_full_length,
            "m7_shoulder_slope":   m.m7_shoulder_slope,
            "m9_bust_depth":       m.m9_bust_depth,
            "m10_bust_span":       m.m10_bust_span,
            "m11_side_length":     m.m11_side_length,
            "m13_shoulder_len":    m.m13_shoulder_len,
            "m14_across_shoulder": m.m14_across_shoulder,
            "m15_across_chest":    m.m15_across_chest,
            "m16_across_back":     m.m16_across_back,
            "m17_bust_arc":        m.m17_bust_arc,
            "m18_back_arc":        m.m18_back_arc,
            "m19_waist_arc":       m.m19_waist_arc,
            "m20_dart_placement":  m.m20_dart_placement,
            "hip_arc":             m.hip_arc,
            "hip_depth":           m.hip_depth,
            "cb_length":           m.cb_length,
        },
        "formula_rows": formula_rows,
        "front_points": {
            "A": pt(fb.A), "B": pt(fb.B), "C": pt(fb.C), "D": pt(fb.D),
            "E": pt(fb.E), "G": pt(fb.G), "H": pt(fb.H), "I": pt(fb.I),
            "J": pt(fb.J), "K": pt(fb.K), "N": pt(fb.N), "O": pt(fb.O),
            "P": pt(fb.P), "F": pt(fb.F), "Q": pt(fb.Q),
            "dart_pt": pt(fb.dart_pt),
        },
        "back_points": {
            "A": pt(bb.A), "B": pt(bb.B), "E": pt(bb.E),
            "G": pt(bb.G), "I": pt(bb.I),
            "nk_width": bb.nk_width,
            "nk_depth": bb.nk_depth,
        },
        "warnings": fb.warnings,
        "bw_diff": bw_diff,
    }
