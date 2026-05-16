# AI Photo → Pattern Parameters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a garment photo is analysed, show a collapsible `SmartDraftPanel` on `/analyze` that surfaces AI-inferred FreeSewing options (collarStyle, cuffStyle, SA, pockets, waistband) as editable fields with Armstrong calculations, then redirects to `/pattern?redraft={id}` on draft.

**Architecture:** Expand `_build_options()` in `auto_pattern_maker.py` to annotate each option with `source: "ai"|"default"` and valid choices. A new `GET /analyses/{analysis_id}/draft-params` endpoint uses the existing scoring/Armstrong pipeline and returns a `DraftParamsResponse`. A new `SmartDraftPanel` React component fetches this lazily on first expand, renders editable rows (gold border = AI), and on submit calls `POST /patterns/draft` then redirects.

**Tech Stack:** Python 3.11 + FastAPI + Pydantic v2, Next.js 14 App Router (`'use client'`), TypeScript, Tailwind CSS with CSS variables, `next/navigation` router

---

## Task 1: Add `OptionEntry` type + `_build_annotated_options()` to `auto_pattern_maker.py`

**Files:**
- Modify: `services/api/services/auto_pattern_maker.py`
- Create: `services/api/tests/__init__.py`
- Create: `services/api/tests/test_auto_pattern_maker.py`

### Background

The existing `_build_options()` returns a flat `dict` (e.g. `{"collarStyle": "classic"}`). We need a parallel function `_build_annotated_options()` that wraps each value in `{"value": ..., "source": "ai"|"default", "choices": [...]}`. We keep `_build_options()` unchanged so the existing auto-draft endpoint is not affected.

- [ ] **Step 1: Create the tests directory and empty `__init__.py`**

```bash
mkdir -p "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/services/api/tests"
touch "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/services/api/tests/__init__.py"
```

- [ ] **Step 2: Write the failing tests**

Create `services/api/tests/test_auto_pattern_maker.py`:

```python
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


# ── simon collar mapping ─────────────────────────────────────────────────────

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


# ── SA from craft_recommendations ────────────────────────────────────────────

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


# ── pocket detection ──────────────────────────────────────────────────────────

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


# ── waistband from waist_treatment ───────────────────────────────────────────

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


# ── paperless always default ──────────────────────────────────────────────────

def test_paperless_always_default():
    analysis = {
        "components": {"collar": {}, "sleeves": {}},
        "craft_recommendations": {},
        "cut": {},
    }
    opts = _build_annotated_options("simon", analysis, _arm(), {})
    assert opts["paperless"]["value"] is False
    assert opts["paperless"]["source"] == "default"
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/services/api"
.venv/bin/python -m pytest tests/test_auto_pattern_maker.py -v 2>&1 | head -30
```

Expected: `ImportError: cannot import name '_build_annotated_options'`

- [ ] **Step 4: Add `OptionEntry` TypedDict and `_build_annotated_options()` to `auto_pattern_maker.py`**

Add the following to `services/api/services/auto_pattern_maker.py` — insert after the `_DESIGN_OPTION_MAP` block (after line ~257) and before `_build_options()`:

```python
from typing import TypedDict, Literal, Any


class OptionEntry(TypedDict):
    value: Any
    source: Literal["ai", "default"]
    choices: list  # empty list = free-form (int / bool)


# Valid choices per design option (for dropdowns in the frontend)
_OPTION_CHOICES: dict[str, list[str]] = {
    "collarStyle": ["classic", "band", "none"],
    "cuffStyle":   ["classical", "frenchCuff"],
    "ease":        ["fitted", "semi_fitted", "relaxed", "oversized"],
}

# Maps collar Vision type → FreeSewing collarStyle value
_COLLAR_TO_STYLE: dict[str, str] = {
    "basic_shirt_collar": "classic",
    "convertible":        "classic",
    "mandarin":           "band",
    "stand_collar":       "band",
    "crew_neck":          "none",
    "none":               "none",
}

# Maps cuff Vision type → FreeSewing cuffStyle value
_CUFF_TO_STYLE: dict[str, str] = {
    "basic_shirt_cuff": "classical",
    "roll_up":          "classical",
    "french_cuff":      "frenchCuff",
    "ribbed":           "classical",
    "elastic":          "classical",
}


def _build_annotated_options(
    design_id: str,
    analysis: dict,
    arm: ArmstrongMetrics,
    prefs: dict,
) -> dict[str, OptionEntry]:
    """
    Returns options annotated with source ("ai" | "default") and valid choices.
    Does NOT modify the existing _build_options() — this is a parallel function
    used only by the new /analyses/{id}/draft-params endpoint.
    """
    opts: dict[str, OptionEntry] = {}

    def ai(value: Any, key: str = "") -> OptionEntry:
        return OptionEntry(value=value, source="ai", choices=_OPTION_CHOICES.get(key, []))

    def default(value: Any, key: str = "") -> OptionEntry:
        return OptionEntry(value=value, source="default", choices=_OPTION_CHOICES.get(key, []))

    collar_type = _get(analysis, "components", "collar", "type", default="") or ""
    cuff_type   = _get(analysis, "components", "sleeves", "cuff_type", default="") or ""
    waist_tx    = _get(analysis, "cut", "waist_treatment", default="") or ""
    pockets_raw = _get(analysis, "components", "pockets", default={}) or {}
    pocket_type = pockets_raw.get("type", "none") if isinstance(pockets_raw, dict) else "none"
    sa_rec      = _get(analysis, "craft_recommendations", "seam_allowance_mm", default=None)

    # ── collarStyle (simon, simone) ──────────────────────────────────────────
    if design_id in ("simon", "simone"):
        collar_val = _COLLAR_TO_STYLE.get(collar_type)
        if collar_val:
            opts["collarStyle"] = ai(collar_val, "collarStyle")

    # ── cuffStyle (simon, simone) ────────────────────────────────────────────
    if design_id in ("simon", "simone"):
        cuff_val = _CUFF_TO_STYLE.get(cuff_type)
        if cuff_val:
            opts["cuffStyle"] = ai(cuff_val, "cuffStyle")

    # ── kangarooPocket (huey, hugo) ──────────────────────────────────────────
    if design_id in ("huey", "hugo"):
        has_pocket = pocket_type not in ("none", "", None)
        opts["kangarooPocket"] = ai(has_pocket)

    # ── pockets bool (carlita, carlton) ─────────────────────────────────────
    if design_id in ("carlita", "carlton"):
        has_pocket = pocket_type not in ("none", "", None)
        opts["pockets"] = ai(has_pocket)

    # ── waistbandWidth (sandy, waralee) ─────────────────────────────────────
    if design_id in ("sandy", "waralee"):
        wb = 30 if waist_tx == "elastic" else 40
        opts["waistbandWidth"] = ai(wb)

    # ── elasticWidth (paco, titan) ───────────────────────────────────────────
    if design_id in ("paco", "titan"):
        ew = 25 if waist_tx == "elastic" else 0
        opts["elasticWidth"] = ai(ew)

    # ── sa (all designs) ────────────────────────────────────────────────────
    if sa_rec and isinstance(sa_rec, (int, float)):
        opts["sa"] = ai(int(sa_rec))
    else:
        from .patternmaking_rules import SEAM_ALLOWANCE_BY_GARMENT
        # fallback: use category-based default
        opts["sa"] = default(10)

    # ── paperless (all designs) ─────────────────────────────────────────────
    opts["paperless"] = default(False)

    return opts
```

- [ ] **Step 5: Run tests — all should pass**

```bash
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/services/api"
.venv/bin/python -m pytest tests/test_auto_pattern_maker.py -v
```

Expected output: all 11 tests `PASSED`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app"
git add services/api/services/auto_pattern_maker.py \
        services/api/tests/__init__.py \
        services/api/tests/test_auto_pattern_maker.py
git commit -m "feat(api): add OptionEntry type and _build_annotated_options() to auto_pattern_maker"
```

---

## Task 2: Add `GET /analyses/{analysis_id}/draft-params` endpoint

**Files:**
- Modify: `services/api/routers/analyses.py`

### Background

The new endpoint reads the `ai_analyses` row (`raw_output` JSONB column contains the full Vision JSON), reads `body_profiles` measurements for the given `profile_id`, calls `build_draft_params()` for scoring + Armstrong, and calls `_build_annotated_options()` for the annotated option set. It also accepts an optional `?design=` query param to override the top-ranked design choice (used when the user switches designs in the panel).

Note: In `analyses.py`, route order matters — FastAPI matches routes top-to-bottom. The new `GET /analyses/{analysis_id}/draft-params` route **must be added before** the existing `GET /analyses/{analysis_id}` catch-all route (currently around line 313).

- [ ] **Step 1: Add Pydantic models + endpoint to `analyses.py`**

Open `services/api/routers/analyses.py`. Find the comment `# ─── 取得分析結果` (around line 312) and insert the following block **immediately before it**:

```python
# ─── AI 打版參數推薦 ──────────────────────────────────────────────────────────
@router.get("/{analysis_id}/draft-params")
async def get_draft_params(
    analysis_id: uuid.UUID,
    profile_id: uuid.UUID,
    design: str | None = None,          # optional override for design choice
    db: AsyncSession = Depends(get_db),
):
    """
    Returns AI-inferred FreeSewing options for the given analysis + body profile.
    Each option includes value, source ("ai"|"default"), and valid choices list.
    Optional ?design= overrides the AI's top-ranked design choice.
    """
    # 1. Load analysis JSON
    result = await db.execute(
        text("SELECT raw_output FROM ai_analyses WHERE id = :id"),
        {"id": str(analysis_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, f"找不到分析結果: {analysis_id}")

    analysis_json = row.raw_output  # already a dict (asyncpg parses JSONB)
    if isinstance(analysis_json, str):
        import json as _json
        analysis_json = _json.loads(analysis_json)

    # 2. Load body measurements (mm)
    warning = None
    meas_result = await db.execute(
        text("SELECT measurements FROM body_profiles WHERE id = :id"),
        {"id": str(profile_id)},
    )
    meas_row = meas_result.fetchone()
    if meas_row:
        measurements_mm = meas_row.measurements or {}
        if isinstance(measurements_mm, str):
            import json as _json
            measurements_mm = _json.loads(measurements_mm)
    else:
        measurements_mm = {}
        warning = "no_measurements"

    # 3. Run scorer + Armstrong
    from services.auto_pattern_maker import build_draft_params, _build_annotated_options

    draft = build_draft_params(measurements_mm, analysis_json)

    # 4. Resolve final design (AI top choice or user override)
    chosen_design = design or draft.design

    # 5. Build annotated options for chosen design
    from services.auto_pattern_maker import ArmstrongMetrics, calculate_armstrong_metrics
    arm = calculate_armstrong_metrics(measurements_mm)
    annotated_opts = _build_annotated_options(chosen_design, analysis_json, arm, {})

    response: dict = {
        "design":       chosen_design,
        "confidence":   draft.confidence,
        "alternatives": draft.alternatives,
        "options":      annotated_opts,
        "armstrong":    draft.armstrong,
        "reasoning":    draft.reasoning,
    }
    if warning:
        response["warning"] = warning

    return response
```

- [ ] **Step 2: Start the API server and smoke-test the endpoint**

```bash
# In one terminal — start the API
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/services/api"
set -a && . .env && set +a
.venv/bin/uvicorn main:app --port 8000 --reload

# In a second terminal — call the endpoint with the dev analysis_id
# First find a real analysis_id from the DB:
psql postgresql://chailyn:chailyn_dev@localhost:5432/chailyn \
  -c "SELECT id FROM ai_analyses ORDER BY created_at DESC LIMIT 1;"

# Then call the endpoint (replace <analysis_id> with the real UUID):
curl -s "http://localhost:8000/analyses/<analysis_id>/draft-params?profile_id=00000000-0000-0000-0000-000000000002" \
  | python3 -m json.tool | head -60
```

Expected: JSON with `design`, `confidence`, `alternatives`, `options` (each with `value`/`source`/`choices`), `armstrong`, `reasoning`.

- [ ] **Step 3: Test the `?design=` override**

```bash
curl -s "http://localhost:8000/analyses/<analysis_id>/draft-params?profile_id=00000000-0000-0000-0000-000000000002&design=simone" \
  | python3 -m json.tool | grep -A3 '"design"'
```

Expected: `"design": "simone"` in response.

- [ ] **Step 4: Test the 404 case**

```bash
curl -s "http://localhost:8000/analyses/00000000-0000-0000-0000-000000000099/draft-params?profile_id=00000000-0000-0000-0000-000000000002" \
  | python3 -m json.tool
```

Expected: `{"detail": "找不到分析結果: 00000000-0000-0000-0000-000000000099"}`

- [ ] **Step 5: Commit**

```bash
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app"
git add services/api/routers/analyses.py
git commit -m "feat(api): add GET /analyses/{id}/draft-params endpoint with annotated options"
```

---

## Task 3: Add TypeScript types + `analysisApi.getDraftParams()` to `api.ts`

**Files:**
- Modify: `apps/web/src/lib/api.ts`

### Background

Add the `OptionEntry` and `DraftParamsResponse` interfaces, then add `getDraftParams()` to the existing `analysisApi` object.

- [ ] **Step 1: Open `apps/web/src/lib/api.ts` and find the `analysisApi` object**

Search for `analysisApi` — it contains methods like `uploadPhoto`, `getJob`, etc.

- [ ] **Step 2: Add interfaces before the `analysisApi` export**

Insert the following interfaces at the top of the file near the other interface definitions (or directly before `analysisApi`):

```typescript
export interface OptionEntry {
  value: string | number | boolean
  source: 'ai' | 'default'
  choices: string[]   // empty array = free-form (number / boolean)
}

export interface DraftParamsAlternative {
  design: string
  confidence: number
  description_zh: string
}

export interface DraftParamsResponse {
  design: string
  confidence: number
  alternatives: DraftParamsAlternative[]
  options: Record<string, OptionEntry>
  armstrong: Record<string, number | string>
  reasoning: string[]
  warning?: string  // "no_measurements" if profile not found
}
```

- [ ] **Step 3: Add `getDraftParams()` method to `analysisApi`**

Inside the `analysisApi` object, add:

```typescript
getDraftParams: async (
  analysisId: string,
  profileId: string,
  design?: string,
): Promise<DraftParamsResponse> => {
  const params = new URLSearchParams({ profile_id: profileId })
  if (design) params.set('design', design)
  const res = await fetch(`${API_BASE}/analyses/${analysisId}/draft-params?${params}`)
  if (!res.ok) throw new Error(`draft-params failed: ${res.status}`)
  return res.json()
},
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/apps/web"
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專Case/chailyn-app"
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add DraftParamsResponse types and analysisApi.getDraftParams()"
```

---

## Task 4: Add `smartDraft.*` i18n keys

**Files:**
- Modify: `apps/web/src/lib/i18n.ts`

### Background

The i18n file uses a flat key dictionary with `zh` and `en` sections. Add all keys needed by `SmartDraftPanel`.

- [ ] **Step 1: Find the insertion point in `i18n.ts`**

Open `apps/web/src/lib/i18n.ts`. Search for the `// ── Misc` comment or the last key block in the `zh` section. Insert **before the closing brace** of the `zh` object:

```typescript
  // ── Smart Draft Panel ──────────────────────────────────────────────────
  'smartDraft.title':         'AI 版型參數',
  'smartDraft.subtitle':      'AI 推薦設計 · 版型選項 · Armstrong 計算',
  'smartDraft.expand':        '展開',
  'smartDraft.collapse':      '收起',
  'smartDraft.design':        'AI 推薦設計',
  'smartDraft.options':       '版型選項',
  'smartDraft.aiBadge':       '✦ AI',
  'smartDraft.defaultBadge':  '預設',
  'smartDraft.armstrong':     'Armstrong 打版計算',
  'smartDraft.draft':         'Draft with These Settings',
  'smartDraft.reset':         '恢復 AI 建議值',
  'smartDraft.drafting':      '打版中…',
  'smartDraft.redirecting':   '跳轉至版型工具…',
  'smartDraft.error':         '打版失敗，請重試',
  'smartDraft.noMeasure':     '尚無身材數據，將使用預設尺寸',
  'smartDraft.confidence':    '信心分數',
  'smartDraft.reasoning':     'AI 判斷依據',
  'smartDraft.armHipWaist':   '臀腰差',
  'smartDraft.armFrontDart':  '前省',
  'smartDraft.armBackDart':   '後省',
  'smartDraft.armCup':        '罩杯',
  'smartDraft.armSleeve':     '袖長',
  'smartDraft.armSize':       '美規尺寸',
  'smartDraft.armEach':       '每省',
```

Then add the corresponding `en` keys in the `en` section:

```typescript
  // ── Smart Draft Panel ──────────────────────────────────────────────────
  'smartDraft.title':         'AI Pattern Parameters',
  'smartDraft.subtitle':      'AI Design · Options · Armstrong Calculations',
  'smartDraft.expand':        'Expand',
  'smartDraft.collapse':      'Collapse',
  'smartDraft.design':        'AI Recommended Design',
  'smartDraft.options':       'Pattern Options',
  'smartDraft.aiBadge':       '✦ AI',
  'smartDraft.defaultBadge':  'default',
  'smartDraft.armstrong':     'Armstrong Calculations',
  'smartDraft.draft':         'Draft with These Settings',
  'smartDraft.reset':         'Reset to AI Suggestions',
  'smartDraft.drafting':      'Drafting…',
  'smartDraft.redirecting':   'Redirecting to pattern tools…',
  'smartDraft.error':         'Draft failed — please try again',
  'smartDraft.noMeasure':     'No measurements saved — using default sizing',
  'smartDraft.confidence':    'Confidence',
  'smartDraft.reasoning':     'AI Reasoning',
  'smartDraft.armHipWaist':   'Hip–waist diff',
  'smartDraft.armFrontDart':  'Front dart',
  'smartDraft.armBackDart':   'Back dart',
  'smartDraft.armCup':        'Bust cup',
  'smartDraft.armSleeve':     'Sleeve length',
  'smartDraft.armSize':       'US size',
  'smartDraft.armEach':       'each',
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/apps/web"
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app"
git add apps/web/src/lib/i18n.ts
git commit -m "feat(web): add smartDraft.* i18n keys (zh + en)"
```

---

## Task 5: Build `SmartDraftPanel.tsx`

**Files:**
- Create: `apps/web/src/components/SmartDraftPanel.tsx`

### Background

The component has 5 states: `idle` → `loading` → `ready` → `drafting` → `error`. It fetches params lazily on first expand. Switching designs re-fetches with `?design=` override. On draft success it calls `router.push('/pattern?redraft=...')`. Uses CSS variables from the existing design system (`var(--gold)`, `var(--ink)`, `var(--muted)`, `var(--border)`, `var(--surface)`, `var(--gold-light)`).

- [ ] **Step 1: Create `SmartDraftPanel.tsx`**

Create `apps/web/src/components/SmartDraftPanel.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { analysisApi, patternApi } from '@/lib/api'
import type { DraftParamsResponse, OptionEntry } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'
import { Loader2 } from 'lucide-react'

// Dev constant — replace with auth context when auth is implemented
const DEV_USER_ID    = '00000000-0000-0000-0000-000000000001'
const DEV_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

// Measurements (mm) matching the dev profile seed
const DEV_MEASUREMENTS: Record<string, number> = {
  chest: 920, waist: 720, hips: 980, highBust: 870,
  hpsToWaistBack: 390, shoulderToWrist: 580, shoulderWidth: 370,
  neck: 350, inseam: 750, biceps: 300, wrist: 155, height: 1630,
}

type PanelState = 'idle' | 'loading' | 'ready' | 'drafting' | 'error'

interface Props {
  analysisId: string
  profileId?: string
}

export default function SmartDraftPanel({ analysisId, profileId = DEV_PROFILE_ID }: Props) {
  const { t } = useLanguage()
  const router = useRouter()

  const [open, setOpen]         = useState(false)
  const [state, setState]       = useState<PanelState>('idle')
  const [params, setParams]     = useState<DraftParamsResponse | null>(null)
  // edited values — user may change these from AI suggestions
  const [editedOpts, setEditedOpts] = useState<Record<string, string | number | boolean>>({})
  const [activeDesign, setActiveDesign] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchParams = useCallback(async (design?: string) => {
    setState('loading')
    setErrorMsg(null)
    try {
      const data = await analysisApi.getDraftParams(analysisId, profileId, design)
      setParams(data)
      setActiveDesign(data.design)
      // seed edits with AI-suggested values
      const initial: Record<string, string | number | boolean> = {}
      for (const [k, entry] of Object.entries(data.options)) {
        initial[k] = entry.value
      }
      setEditedOpts(initial)
      setState('ready')
    } catch (e: any) {
      setErrorMsg(e.message ?? t('smartDraft.error'))
      setState('error')
    }
  }, [analysisId, profileId])

  const handleToggle = () => {
    if (!open && state === 'idle') {
      fetchParams()
    }
    setOpen(o => !o)
  }

  const handleDesignSwitch = (design: string) => {
    if (design === activeDesign) return
    fetchParams(design)
  }

  const handleOptionChange = (key: string, value: string | number | boolean) => {
    setEditedOpts(prev => ({ ...prev, [key]: value }))
  }

  const handleReset = () => {
    if (!params) return
    const initial: Record<string, string | number | boolean> = {}
    for (const [k, entry] of Object.entries(params.options)) {
      initial[k] = entry.value
    }
    setEditedOpts(initial)
  }

  const handleDraft = async () => {
    if (!params) return
    setState('drafting')
    setErrorMsg(null)
    try {
      // Flatten edited options — remove sa and paperless (handled separately)
      const { sa, paperless, ...restOpts } = editedOpts
      const result = await (patternApi.draft as any)({
        userId:        DEV_USER_ID,
        design:        activeDesign,
        bodyProfileId: profileId,
        sa:            typeof sa === 'number' ? sa : 10,
        paperless:     paperless === true,
        renderMode:    'svg',
        options:       restOpts,
      }) as { instance_id?: string; id?: string }

      const instanceId = result.instance_id ?? result.id
      if (!instanceId) throw new Error('No instance_id returned from draft')
      router.push(`/pattern?redraft=${instanceId}`)
    } catch (e: any) {
      setErrorMsg(e.message ?? t('smartDraft.error'))
      setState('ready')
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>

      {/* ── Toggle bar ────────────────────────────────────────────────────── */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors hover:bg-[var(--gold-light)]"
        style={{ background: open ? 'var(--gold-light)' : 'var(--surface)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[var(--gold)]">✦</span>
          <div className="text-left">
            <p className="text-xs font-medium tracking-widest uppercase text-[var(--ink-soft)]">
              {t('smartDraft.title')}
            </p>
            <p className="text-[10px] text-[var(--muted)] mt-0.5">{t('smartDraft.subtitle')}</p>
          </div>
        </div>
        <span
          className="text-[10px] tracking-widest uppercase px-3 py-1.5 font-medium"
          style={{
            border:     '1px solid var(--border)',
            background: open ? 'var(--ink)' : 'transparent',
            color:      open ? 'var(--surface)' : 'var(--ink-soft)',
          }}
        >
          {open ? t('smartDraft.collapse') : t('smartDraft.expand')}
        </span>
      </button>

      {/* ── Panel body (visible when open) ────────────────────────────────── */}
      {open && (
        <div className="px-5 py-5 border-t border-[var(--border)]">

          {/* Loading */}
          {state === 'loading' && (
            <div className="flex items-center justify-center py-8 gap-3 text-[var(--muted)]">
              <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-[var(--gold)]" />
              <span className="text-xs tracking-widest uppercase">Loading AI params…</span>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="text-sm text-red-600 py-4">
              {errorMsg ?? t('smartDraft.error')}
            </div>
          )}

          {/* Ready or Drafting */}
          {(state === 'ready' || state === 'drafting') && params && (
            <>
              {/* Warning banner */}
              {params.warning === 'no_measurements' && (
                <div className="mb-4 px-3 py-2 text-xs text-[var(--gold)]"
                     style={{ border: '1px solid var(--border)', background: 'var(--gold-light)' }}>
                  {t('smartDraft.noMeasure')}
                </div>
              )}

              {/* Design selector */}
              <div className="mb-5">
                <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] mb-3">
                  {t('smartDraft.design')}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {/* Top design */}
                  {[
                    { design: params.design, confidence: params.confidence },
                    ...params.alternatives,
                  ].map(({ design, confidence }) => (
                    <button
                      key={design}
                      onClick={() => handleDesignSwitch(design)}
                      disabled={state === 'drafting'}
                      className="px-4 py-1.5 text-xs tracking-wide capitalize font-medium transition-colors disabled:opacity-50"
                      style={{
                        background: activeDesign === design ? 'var(--ink)' : 'transparent',
                        color:      activeDesign === design ? 'var(--surface)' : 'var(--muted)',
                        border:     '1px solid ' + (activeDesign === design ? 'var(--ink)' : 'var(--border)'),
                      }}
                    >
                      {design}
                      <span className="ml-2 opacity-60 text-[10px]">
                        {Math.round(confidence * 100)}%
                      </span>
                    </button>
                  ))}
                </div>
                {params.reasoning.length > 0 && (
                  <p className="text-[10px] text-[var(--muted)] italic mt-2">
                    {params.reasoning.slice(0, 2).join(' · ')}
                  </p>
                )}
              </div>

              {/* Options table */}
              <div className="mb-5">
                <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] mb-3">
                  {t('smartDraft.options')}
                  <span className="ml-2 text-[var(--gold)]">{t('smartDraft.aiBadge')} = AI 偵測</span>
                </p>
                <div style={{ border: '1px solid var(--border)' }}>
                  {Object.entries(params.options).map(([key, entry]: [string, OptionEntry], idx, arr) => (
                    <div
                      key={key}
                      className="flex items-center justify-between px-3 py-2.5 text-xs"
                      style={{ borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <span className="text-[var(--muted)]">{key}</span>
                      <div className="flex items-center gap-2">
                        {/* Render correct input type */}
                        {typeof entry.value === 'boolean' ? (
                          <select
                            value={editedOpts[key] ? 'true' : 'false'}
                            onChange={e => handleOptionChange(key, e.target.value === 'true')}
                            disabled={state === 'drafting'}
                            className="text-xs px-2 py-1 disabled:opacity-50"
                            style={{
                              border: `1px solid ${entry.source === 'ai' ? 'var(--gold)' : 'var(--border)'}`,
                              background: 'var(--surface)',
                              color: 'var(--ink)',
                            }}
                          >
                            <option value="true">on</option>
                            <option value="false">off</option>
                          </select>
                        ) : entry.choices.length > 0 ? (
                          <select
                            value={String(editedOpts[key] ?? entry.value)}
                            onChange={e => handleOptionChange(key, e.target.value)}
                            disabled={state === 'drafting'}
                            className="text-xs px-2 py-1 disabled:opacity-50"
                            style={{
                              border: `1px solid ${entry.source === 'ai' ? 'var(--gold)' : 'var(--border)'}`,
                              background: 'var(--surface)',
                              color: 'var(--ink)',
                            }}
                          >
                            {entry.choices.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="number"
                            value={Number(editedOpts[key] ?? entry.value)}
                            onChange={e => handleOptionChange(key, Number(e.target.value))}
                            disabled={state === 'drafting'}
                            className="w-16 text-xs px-2 py-1 text-right disabled:opacity-50"
                            style={{
                              border: `1px solid ${entry.source === 'ai' ? 'var(--gold)' : 'var(--border)'}`,
                              background: 'var(--surface)',
                              color: 'var(--ink)',
                            }}
                          />
                        )}
                        <span
                          className="text-[10px] tracking-wide"
                          style={{ color: entry.source === 'ai' ? 'var(--gold)' : 'var(--muted)' }}
                        >
                          {entry.source === 'ai' ? t('smartDraft.aiBadge') : t('smartDraft.defaultBadge')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Armstrong collapsible */}
              <details className="mb-5" style={{ border: '1px solid var(--border)' }}>
                <summary
                  className="px-3 py-2.5 text-[10px] tracking-[0.2em] uppercase cursor-pointer list-none flex justify-between"
                  style={{ color: 'var(--gold)', background: 'var(--gold-light)' }}
                >
                  <span>{t('smartDraft.armstrong')}</span>
                  <span>▾</span>
                </summary>
                <div className="px-3 py-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  {[
                    [t('smartDraft.armHipWaist'), `${params.armstrong.hip_waist_diff_in}"`],
                    [t('smartDraft.armFrontDart'), `×${params.armstrong.front_dart_count} · ${params.armstrong.front_dart_intake_in}" ${t('smartDraft.armEach')}`],
                    [t('smartDraft.armBackDart'),  `×${params.armstrong.back_dart_count} · ${params.armstrong.back_dart_intake_in}" ${t('smartDraft.armEach')}`],
                    [t('smartDraft.armCup'),       `${params.armstrong.bust_cup} cup`],
                    [t('smartDraft.armSleeve'),    `${params.armstrong.sleeve_length_in}"`],
                    [t('smartDraft.armSize'),      `Size ${params.armstrong.approx_us_size}`],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex justify-between py-1"
                         style={{ borderBottom: '1px solid var(--border)' }}>
                      <span className="text-[var(--muted)]">{label}</span>
                      <span className="text-[var(--ink)]">{value}</span>
                    </div>
                  ))}
                </div>
              </details>

              {/* Action row */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDraft}
                  disabled={state === 'drafting'}
                  className="flex-1 py-3 text-[10px] tracking-widest uppercase font-medium transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'var(--ink)', color: 'var(--surface)' }}
                >
                  {state === 'drafting' ? (
                    <>
                      <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                      {t('smartDraft.drafting')}
                    </>
                  ) : (
                    <>✦ &nbsp;{t('smartDraft.draft')}</>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  disabled={state === 'drafting'}
                  className="px-4 py-3 text-[10px] tracking-widest uppercase font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors disabled:opacity-50"
                  style={{ border: '1px solid var(--border)' }}
                >
                  {t('smartDraft.reset')}
                </button>
              </div>

              {/* Draft error */}
              {errorMsg && state === 'ready' && (
                <p className="mt-3 text-xs text-red-600">{errorMsg}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/apps/web"
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors. If `patternApi.draft` typing issues arise, the cast `as any` in `handleDraft` handles it.

- [ ] **Step 3: Commit**

```bash
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app"
git add apps/web/src/components/SmartDraftPanel.tsx
git commit -m "feat(web): add SmartDraftPanel component with editable AI options + Armstrong breakdown"
```

---

## Task 6: Mount `SmartDraftPanel` on the Analyze page + end-to-end test

**Files:**
- Modify: `apps/web/src/app/analyze/page.tsx`

### Background

The `job` object returned by `jobApi.waitUntilDone()` includes `analysis_id` (a UUID string, nullable). Mount `SmartDraftPanel` between the existing `ArmstrongDraftPanel` toggle section and the `DownloadBar`.

- [ ] **Step 1: Add the import to `analyze/page.tsx`**

At the top of `apps/web/src/app/analyze/page.tsx`, add:

```typescript
import SmartDraftPanel from '@/components/SmartDraftPanel'
```

- [ ] **Step 2: Update the `job` state type to include `analysis_id`**

Find where `job` is stored in state. The `AnalysisJob` type (from `api.ts`) should already have `analysis_id?: string`. If not, add it to the `AnalysisJob` interface:

```typescript
export interface AnalysisJob {
  job_id: string
  status: 'pending' | 'running' | 'done' | 'failed'
  result?: unknown
  error?: string
  analysis_id?: string   // add this if missing
}
```

Also store the job in state in `analyze/page.tsx` — find where `setAnalysis(job.result as GarmentAnalysis)` is called and add state storage:

```typescript
// Add state at the top of the component (with other useState hooks):
const [job, setJob] = useState<AnalysisJob | null>(null)

// After `setAnalysis(job.result as GarmentAnalysis)`:
setJob(job)
```

- [ ] **Step 3: Mount `SmartDraftPanel` in the JSX**

Find the section in the JSX that renders the Armstrong toggle:

```tsx
{/* ── Armstrong 量體 + 版型公式 + 打版圖面 ────────────────────────── */}
<div className="mt-10">
  {/* Toggle button */}
  <button onClick={...}> ... </button>
  ...
</div>
```

Insert `SmartDraftPanel` **after** this Armstrong block and **before** the `DownloadBar`:

```tsx
{/* ── AI Smart Draft Panel ─────────────────────────────────────────── */}
{job?.analysis_id && (
  <div className="mt-6">
    <SmartDraftPanel analysisId={job.analysis_id} />
  </div>
)}
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/apps/web"
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 5: Start all services and run end-to-end test**

```bash
# Terminal 1 — API
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/services/api"
set -a && . .env && set +a && .venv/bin/uvicorn main:app --port 8000 --reload

# Terminal 2 — Pattern engine
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/services/pattern-engine"
node src/index.mjs

# Terminal 3 — Web
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/apps/web"
pnpm dev
```

Manual test steps:
1. Open http://localhost:3000/analyze
2. Upload a garment photo (shirt or hoodie recommended)
3. Wait for analysis to complete
4. Scroll down — confirm `SmartDraftPanel` toggle appears below the Armstrong panel
5. Click **Expand** — confirm loading spinner, then options table renders with gold borders on AI-sourced values
6. Confirm Armstrong breakdown is visible in the collapsible section
7. Change one dropdown value (e.g. `collarStyle` from `classic` to `band`)
8. Click **✦ Draft with These Settings** — confirm spinner appears
9. Confirm redirect to `/pattern?redraft=...` with the pattern instance loaded

- [ ] **Step 6: Verify `created_by_ai` flag in DB**

```bash
psql postgresql://chailyn:chailyn_dev@localhost:5432/chailyn \
  -c "SELECT id, design, version, created_by_ai FROM pattern_instances ORDER BY created_at DESC LIMIT 3;"
```

Expected: the newest row has `created_by_ai = true`.

- [ ] **Step 7: Commit**

```bash
cd "/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app"
git add apps/web/src/app/analyze/page.tsx apps/web/src/lib/api.ts
git commit -m "feat(web): mount SmartDraftPanel on analyze page — AI photo → pattern params complete"
```

---

## Self-Review

**Spec coverage:**
- ✅ §3.1 Data flow — all 5 steps covered across Tasks 1–6
- ✅ §4.1 Expanded option mapping — Task 1 covers all 8 rows from the spec table
- ✅ §4.2 `DraftParamsResponse` model — defined in Task 2 (Python) and Task 3 (TypeScript)
- ✅ §4.3 New endpoint with `?design=` override — Task 2
- ✅ §5.1 `getDraftParams()` API method — Task 3
- ✅ §5.2 `SmartDraftPanel` component — Task 5 (all 5 states, design switcher, options table, Armstrong, action row)
- ✅ §5.3 Placement on analyze page — Task 6
- ✅ §5.4 i18n keys — Task 4 (all 14 keys in zh + en)
- ✅ §6 Error handling — 404, missing profile, draft failure, design switch mid-load (handled via new fetch replacing old)
- ✅ §8 Success criteria — covered in Task 6 Step 5–6

**Type consistency:**
- `OptionEntry` defined in Task 1 (Python `TypedDict`) and Task 3 (TypeScript `interface`) — fields match: `value`, `source`, `choices`
- `DraftParamsResponse` defined in Task 2 (endpoint return shape) and Task 3 (TS interface) — fields match: `design`, `confidence`, `alternatives`, `options`, `armstrong`, `reasoning`, `warning?`
- `_build_annotated_options()` defined in Task 1 and imported in Task 2 — function name consistent throughout
- `analysisApi.getDraftParams()` defined in Task 3 and used in `SmartDraftPanel` (Task 5) — signature matches
