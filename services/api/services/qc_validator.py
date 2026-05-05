"""
qc_validator.py — 樣衣 QC 標準驗證
Source: BPD-2026-02 P7 QC Standards + Armstrong 5th Ed. general workroom standards

QC Standards (BPD-2026-02):
  12 SPI all seams | 5/8" SA | 1.5" hem
  All 4 neckline corners = 90° | Princess seam L/R ≤ 1/8" | Pleat alignment ≤ 1/8"
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import math


@dataclass
class QCResult:
    passed: bool
    check_name: str
    value: Optional[float] = None
    tolerance: Optional[float] = None
    unit: str = "in"
    message: str = ""
    severity: str = "error"    # error | warning | info


def check_spi(measured_spi: float, required: float = 12.0) -> QCResult:
    """Stitch-per-inch density check."""
    passed = abs(measured_spi - required) <= 1.0
    return QCResult(
        passed=passed,
        check_name="SPI",
        value=measured_spi,
        tolerance=1.0,
        unit="stitches/inch",
        message=(
            f"SPI {measured_spi:.1f} — OK" if passed
            else f"SPI {measured_spi:.1f} out of range (required {required} ±1)"
        ),
        severity="error" if not passed else "info",
    )


def check_seam_allowance(
    measured_sa_in: float,
    required_sa_in: float = 0.625,
    tolerance_in: float = 0.0625,   # 1/16" tolerance
) -> QCResult:
    """Seam allowance width check (5/8" = 0.625")."""
    passed = abs(measured_sa_in - required_sa_in) <= tolerance_in
    return QCResult(
        passed=passed,
        check_name="Seam Allowance",
        value=measured_sa_in,
        tolerance=tolerance_in,
        message=(
            f"SA {measured_sa_in:.3f}\" — OK" if passed
            else f"SA {measured_sa_in:.3f}\" (required {required_sa_in}\" ±{tolerance_in}\")"
        ),
        severity="error" if not passed else "info",
    )


def check_neckline_corner(
    measured_angle_deg: float,
    tolerance_deg: float = 2.0,
) -> QCResult:
    """
    Square neckline corner angle must be 90°.
    BPD-2026-02 P7: 'needle down exactly at corner; clip diagonally 2 threads'
    """
    passed = abs(measured_angle_deg - 90.0) <= tolerance_deg
    return QCResult(
        passed=passed,
        check_name="Square Neckline Corner",
        value=measured_angle_deg,
        tolerance=tolerance_deg,
        unit="degrees",
        message=(
            f"Corner {measured_angle_deg:.1f}° — OK" if passed
            else f"Corner {measured_angle_deg:.1f}° (must be 90° ±{tolerance_deg}°). "
                 "Re-clip corner; use point presser."
        ),
        severity="error" if not passed else "info",
    )


def check_princess_seam_symmetry(
    left_length_in: float,
    right_length_in: float,
    tolerance_in: float = 0.125,
) -> QCResult:
    """Princess seam L/R length symmetry ≤ 1/8"."""
    diff = abs(left_length_in - right_length_in)
    passed = diff <= tolerance_in
    return QCResult(
        passed=passed,
        check_name="Princess Seam L/R Symmetry",
        value=diff,
        tolerance=tolerance_in,
        message=(
            f"PS symmetry diff {diff:.3f}\" — OK" if passed
            else f"PS L/R diff {diff:.3f}\" exceeds {tolerance_in}\" limit. "
                 "Rip and restitch CF or Side Front seam."
        ),
        severity="error" if not passed else "info",
    )


def check_pleat_alignment(
    pleat_offsets_in: list[float],
    tolerance_in: float = 0.125,
) -> QCResult:
    """
    All pleat fold lines must align within 1/8" of marked position.
    Pass list of deviation measurements (one per pleat fold line).
    """
    if not pleat_offsets_in:
        return QCResult(passed=True, check_name="Pleat Alignment", message="No pleats to check.")
    max_dev = max(abs(d) for d in pleat_offsets_in)
    passed = max_dev <= tolerance_in
    return QCResult(
        passed=passed,
        check_name="Pleat Alignment",
        value=max_dev,
        tolerance=tolerance_in,
        message=(
            f"Max pleat deviation {max_dev:.3f}\" — OK" if passed
            else f"Pleat deviation {max_dev:.3f}\" exceeds {tolerance_in}\". "
                 "Re-mark fold lines with chalk ruler."
        ),
        severity="error" if not passed else "info",
    )


def check_hem_level(
    hem_measurements_in: list[float],
    required_in: float = 28.5,
    tolerance_in: float = 0.25,
) -> QCResult:
    """
    Hem level check: 28.5" from waistline all around.
    Measure at CF, CB, and both sides.
    """
    if not hem_measurements_in:
        return QCResult(passed=False, check_name="Hem Level", message="No measurements provided.")
    max_dev = max(abs(v - required_in) for v in hem_measurements_in)
    passed = max_dev <= tolerance_in
    return QCResult(
        passed=passed,
        check_name="Hem Level",
        value=max_dev,
        tolerance=tolerance_in,
        message=(
            f"Hem level max deviation {max_dev:.3f}\" — OK" if passed
            else f"Hem deviation {max_dev:.3f}\" exceeds {tolerance_in}\". "
                 "Hang garment 24hr; re-mark and trim."
        ),
        severity="warning" if not passed else "info",
    )


def check_zipper_stop(
    zipper_stop_from_waist_in: float,
    required_in: float = 22.0,
    tolerance_in: float = 0.25,
) -> QCResult:
    """22" invisible zipper stop position from waistline."""
    diff = abs(zipper_stop_from_waist_in - required_in)
    passed = diff <= tolerance_in
    return QCResult(
        passed=passed,
        check_name="Zipper Stop Position",
        value=zipper_stop_from_waist_in,
        tolerance=tolerance_in,
        message=(
            f"Zipper stop at {zipper_stop_from_waist_in:.2f}\" from waist — OK" if passed
            else f"Zipper stop {zipper_stop_from_waist_in:.2f}\" (required {required_in}\" ±{tolerance_in}\")"
        ),
        severity="warning" if not passed else "info",
    )


# ─── 完整 BPD-2026-02 QC Suite ────────────────────────────────────────────────

@dataclass
class BPDQCReport:
    style: str = "BPD-2026-02"
    checks: list[QCResult] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.checks if c.severity == "error")

    @property
    def errors(self) -> list[QCResult]:
        return [c for c in self.checks if not c.passed and c.severity == "error"]

    @property
    def warnings(self) -> list[QCResult]:
        return [c for c in self.checks if not c.passed and c.severity == "warning"]

    def to_dict(self) -> dict:
        return {
            "style": self.style,
            "overall_passed": self.passed,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "checks": [
                {
                    "name": c.check_name,
                    "passed": c.passed,
                    "value": c.value,
                    "tolerance": c.tolerance,
                    "unit": c.unit,
                    "message": c.message,
                    "severity": c.severity,
                }
                for c in self.checks
            ],
        }


def run_bpd_qc(
    spi: Optional[float] = None,
    sa_in: Optional[float] = None,
    nk_corner_angles_deg: Optional[list[float]] = None,
    ps_left_in: Optional[float] = None,
    ps_right_in: Optional[float] = None,
    pleat_deviations_in: Optional[list[float]] = None,
    hem_measurements_in: Optional[list[float]] = None,
    zipper_stop_in: Optional[float] = None,
) -> BPDQCReport:
    """
    Run all applicable BPD-2026-02 QC checks.
    Pass None for any measurement not yet taken — it will be skipped.
    """
    report = BPDQCReport()

    if spi is not None:
        report.checks.append(check_spi(spi))

    if sa_in is not None:
        report.checks.append(check_seam_allowance(sa_in))

    if nk_corner_angles_deg:
        for i, angle in enumerate(nk_corner_angles_deg):
            result = check_neckline_corner(angle)
            result.check_name = f"Square Neckline Corner #{i+1}"
            report.checks.append(result)

    if ps_left_in is not None and ps_right_in is not None:
        report.checks.append(check_princess_seam_symmetry(ps_left_in, ps_right_in))

    if pleat_deviations_in is not None:
        report.checks.append(check_pleat_alignment(pleat_deviations_in))

    if hem_measurements_in is not None:
        report.checks.append(check_hem_level(hem_measurements_in))

    if zipper_stop_in is not None:
        report.checks.append(check_zipper_stop(zipper_stop_in))

    return report
