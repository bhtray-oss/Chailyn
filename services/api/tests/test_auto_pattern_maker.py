"""Tests for _build_annotated_options() in auto_pattern_maker.py"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.auto_pattern_maker import (
    _build_annotated_options,
    ArmstrongMetrics,
)


def _arm() -> ArmstrongMetrics:
    """Minimal ArmstrongMetrics for testing."""
    m = ArmstrongMetrics()
    m.ease_level = "semi_fitted"
    return m


def test_simon_collar_basic_shirt_collar():
    analysis = {
        "components": {
            "collar":  {"type": "basic_shirt_collar"},
            "sleeves": {"cuff_type": "basic_shirt_cuff"},
        },
        "craft_recommendations": {"seam_allowance_mm": 10},
        "cut": {},
    }
    opts = _build_annotated_options("simon", analysis, _arm(), {})
    assert opts["collarStyle"]["value"] == "classic"
    assert opts["collarStyle"]["source"] == "ai"
    assert "classic" in opts["collarStyle"]["choices"]


def test_simon_collar_mandarin():
    analysis = {
        "components": {
            "collar":  {"type": "mandarin"},
            "sleeves": {"cuff_type": None},
        },
        "craft_recommendations": {},
        "cut": {},
    }
    opts = _build_annotated_options("simon", analysis, _arm(), {})
    assert opts["collarStyle"]["value"] == "band"
    assert opts["collarStyle"]["source"] == "ai"


def test_simon_cuff_french():
    analysis = {
        "components": {
            "collar":  {"type": "basic_shirt_collar"},
            "sleeves": {"cuff_type": "french_cuff"},
        },
        "craft_recommendations": {},
        "cut": {},
    }
    opts = _build_annotated_options("simon", analysis, _arm(), {})
    assert opts["cuffStyle"]["value"] == "frenchCuff"
    assert opts["cuffStyle"]["source"] == "ai"


def test_sa_from_craft_recommendations():
    analysis = {
        "components": {"collar": {}, "sleeves": {}},
        "craft_recommendations": {"seam_allowance_mm": 15},
        "cut": {},
    }
    opts = _build_annotated_options("teagan", analysis, _arm(), {})
    assert opts["sa"]["value"] == 15
    assert opts["sa"]["source"] == "ai"


def test_sa_default_when_missing():
    analysis = {
        "components": {"collar": {}, "sleeves": {}},
        "craft_recommendations": {},
        "cut": {},
    }
    opts = _build_annotated_options("teagan", analysis, _arm(), {})
    assert opts["sa"]["value"] == 10
    assert opts["sa"]["source"] == "default"


def test_huey_pocket_detected():
    analysis = {
        "components": {
            "collar": {},
            "sleeves": {},
            "pockets": {"type": "kangaroo", "count": 1},
        },
        "craft_recommendations": {},
        "cut": {},
    }
    opts = _build_annotated_options("huey", analysis, _arm(), {})
    assert opts["kangarooPocket"]["value"] is True
    assert opts["kangarooPocket"]["source"] == "ai"


def test_huey_no_pocket():
    analysis = {
        "components": {
            "collar": {},
            "sleeves": {},
            "pockets": {"type": "none"},
        },
        "craft_recommendations": {},
        "cut": {},
    }
    opts = _build_annotated_options("huey", analysis, _arm(), {})
    assert opts["kangarooPocket"]["value"] is False
    assert opts["kangarooPocket"]["source"] == "ai"


def test_sandy_elastic_waistband():
    analysis = {
        "components": {"collar": {}, "sleeves": {}},
        "craft_recommendations": {},
        "cut": {"waist_treatment": "elastic"},
    }
    opts = _build_annotated_options("sandy", analysis, _arm(), {})
    assert opts["waistbandWidth"]["value"] == 30
    assert opts["waistbandWidth"]["source"] == "ai"


def test_sandy_dart_waistband():
    analysis = {
        "components": {"collar": {}, "sleeves": {}},
        "craft_recommendations": {},
        "cut": {"waist_treatment": "dart"},
    }
    opts = _build_annotated_options("sandy", analysis, _arm(), {})
    assert opts["waistbandWidth"]["value"] == 40
    assert opts["waistbandWidth"]["source"] == "ai"


def test_paperless_always_default():
    analysis = {
        "components": {"collar": {}, "sleeves": {}},
        "craft_recommendations": {},
        "cut": {},
    }
    opts = _build_annotated_options("simon", analysis, _arm(), {})
    assert opts["paperless"]["value"] is False
    assert opts["paperless"]["source"] == "default"
