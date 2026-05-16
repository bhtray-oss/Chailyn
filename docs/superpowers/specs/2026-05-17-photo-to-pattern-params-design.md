# AI Photo → Pattern Parameters — Design Spec

**Date:** 2026-05-17  
**Feature:** Photo upload → Claude Vision analysis → AI-suggested FreeSewing parametric options → editable SmartDraftPanel → one-click draft → /pattern page  
**Approach chosen:** B — Expanded Rule Mapper (deterministic, no extra API cost)

---

## 1. Problem

The existing `/analyze` page already runs Claude Vision and returns `closest_freesewing_patterns`, but:
- Patterns are previewed with **default options** (no collar style, no cuff style, default SA)
- The `auto_pattern_maker.py` option mapper covers only 5 of 15 designs shallowly
- Users have no way to see or adjust AI-suggested options before drafting
- There is no path from the Analyze page directly to the full pattern toolset (`/pattern`)

---

## 2. Goal

After a garment photo is analysed, the user can:
1. See which FreeSewing design the AI recommends (top 3 ranked)
2. See every design option the AI inferred from the photo (collar style, cuff style, SA, pockets, waistband width, etc.) with clear AI vs default labels
3. Review the Armstrong patternmaking calculations that drove the recommendations
4. Adjust any option, then click **"Draft with These Settings"**
5. Land on `/pattern?redraft={instance_id}` with the full pattern toolset (redraft, DXF, BOM, version history)

---

## 3. Architecture

### 3.1 Data Flow

```
1. [EXISTS] Photo upload + async Vision job
        claude_vision.py → ai_analyses table → structured JSON
        (collar.type, sleeves.type, silhouette, craft_recommendations.seam_allowance_mm…)

2. [NEW] GET /analyses/{analysis_id}/draft-params?profile_id={uuid}
        reads ai_analyses + body_profiles (mm)
        → build_draft_params(measurements_mm, analysis_json)
        → DraftParamsResponse (design, options with source tags, armstrong, alternatives)

3. [NEW] SmartDraftPanel component on /analyze page
        lazy-fetches params on first expand
        renders editable option rows (gold border = AI, grey = default)
        collapsible Armstrong breakdown section

4. [EXISTS] POST /patterns/draft
        receives design + measurements + edited options + sa
        → instance_id + SVG saved with created_by_ai = true

5. [EXISTS] router.push('/pattern?redraft={instance_id}')
        full pattern toolset: redraft, DXF, SVG, BOM, version history
```

### 3.2 Files Changed

| File | Change |
|------|--------|
| `services/api/services/auto_pattern_maker.py` | Expand `_DESIGN_OPTION_MAP` to all 15 designs; add `source` tag per option to `_build_options()` return |
| `services/api/routers/analyses.py` | Add `GET /analyses/{analysis_id}/draft-params` endpoint |
| `apps/web/src/components/SmartDraftPanel.tsx` | **New** — full panel component |
| `apps/web/src/lib/api.ts` | Add `analysisApi.getDraftParams(analysisId, profileId)` |
| `apps/web/src/app/analyze/page.tsx` | Mount `SmartDraftPanel` below existing ArmstrongDraftPanel toggle |
| `apps/web/src/lib/i18n.ts` | Add `smartDraft.*` bilingual keys |

**Not changing:** `claude_vision.py`, pattern engine, `/pattern` page, DB schema, wardrobe/search pages.

---

## 4. Backend

### 4.1 Expanded Option Mapping (`_build_options()`)

Add `source: "ai" | "default"` to every option entry. Expand `_DESIGN_OPTION_MAP` to cover:

| Design(s) | Option key | Mapped from Vision field | Source |
|-----------|-----------|--------------------------|--------|
| simon, simone | `collarStyle` | `components.collar.type` → `"classic"` / `"band"` / `"none"` | ai |
| simon, simone | `cuffStyle` | `components.sleeves.cuff_type` → `"classical"` / `"frenchCuff"` | ai |
| huey, hugo | `kangarooPocket` | `components.pockets.type != "none"` → bool | ai |
| carlita, carlton | `pockets` | `components.pockets.type != "none"` → bool | ai |
| sandy, waralee | `waistbandWidth` | `cut.waist_treatment == "elastic"` → 30mm, else 40mm | ai |
| paco, titan | `elasticWidth` | `cut.waist_treatment == "elastic"` → 25mm, else 0 | ai |
| all designs | `sa` | `craft_recommendations.seam_allowance_mm` (Vision suggests this) | ai |
| all designs | `paperless` | always `false` | default |

**Collar type → collarStyle mapping:**
```
basic_shirt_collar | convertible → "classic"
mandarin | stand_collar          → "band"
hood                             → (only applies to huey/hugo — no collarStyle key)
crew_neck | none                 → "none" (omit key for designs that don't support it)
```

**Cuff type → cuffStyle mapping:**
```
basic_shirt_cuff | roll_up → "classical"
french_cuff                → "frenchCuff"
ribbed | elastic           → "classical" (fallback)
```

### 4.2 New Pydantic Response Model

```python
class OptionEntry(BaseModel):
    value: Any                        # str | int | bool
    source: Literal["ai", "default"]
    choices: list[str] | None = None  # for enum options

class DraftParamsResponse(BaseModel):
    design: str
    confidence: float
    alternatives: list[dict]          # [{design, confidence, description_zh}]
    options: dict[str, OptionEntry]
    armstrong: dict                   # raw ArmstrongMetrics fields
    reasoning: list[str]
```

### 4.3 New Endpoint

```
GET /analyses/{analysis_id}/draft-params?profile_id={uuid}
```

- Reads `ai_analyses` row (`result` JSONB column)
- Reads `body_profiles` measurements for `profile_id` (mm)
- Calls `build_draft_params(measurements_mm, analysis_result)`
- Returns `DraftParamsResponse`
- 404 if analysis not found
- If profile not found: uses empty measurements dict, adds `"warning": "no_measurements"` to response

---

## 5. Frontend

### 5.1 New API method

```typescript
// api.ts
getDraftParams(analysisId: string, profileId: string): Promise<DraftParamsResponse>
// GET /analyses/{analysisId}/draft-params?profile_id={profileId}
```

```typescript
interface OptionEntry {
  value: string | number | boolean
  source: 'ai' | 'default'
  choices?: string[]
}
interface DraftParamsResponse {
  design: string
  confidence: number
  alternatives: { design: string; confidence: number; description_zh: string }[]
  options: Record<string, OptionEntry>
  armstrong: Record<string, number | string>
  reasoning: string[]
}
```

### 5.2 SmartDraftPanel Component

**Props:**
```typescript
interface Props {
  analysisId: string
  profileId:  string
}
```

**States:** `idle | loading | ready | drafting | error`

**Layout (expanded):**

```
┌─ Toggle button (collapsed by default) ───────────────────────────┐
│  ✦ AI Pattern Parameters          [展開 ▼] / [收起 ▲]           │
└──────────────────────────────────────────────────────────────────┘

When expanded:
┌──────────────────────────────────────────────────────────────────┐
│  AI 推薦設計                                                      │
│  [simon 78%▪] [simone 52%] [huey 31%]                           │
│  Reasoning text (italic, muted)                                  │
│                                                                  │
│  版型選項  ✦ 金邊 = AI 偵測                                       │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ collarStyle  │  [classic ▼]  ✦ AI                  │        │
│  │ cuffStyle    │  [frenchCuff▼] ✦ AI                  │        │
│  │ sa           │  [12] mm      ✦ AI                  │        │
│  │ paperless    │  [off ▼]      預設                   │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
│  ▶ Armstrong 打版計算 (collapsible <details>)                    │
│    臀腰差 8.2" · 前省 ×2 · 後省 ×2 · C cup · Size 12            │
│                                                                  │
│  [✦ Draft with These Settings]  [Reset to Defaults]             │
└──────────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Fetches params lazily on first expand (not on page load)
- Switching design choice re-renders options for the new design by re-calling `GET /analyses/{id}/draft-params?profile_id=...&design={chosen}` — the endpoint accepts an optional `design` query param that overrides the AI-ranked top choice. The endpoint runs `_build_options(chosen_design, analysis, arm, prefs)` and returns a fresh `DraftParamsResponse` for that design.
- Gold border (`var(--gold)`) + "✦ AI" label for `source === "ai"` options
- Grey border + "預設" label for `source === "default"` options
- "Reset to Defaults" restores all fields to the original API-returned values
- On "Draft" click:
  1. Calls `POST /patterns/draft` with current design + DEV_MEASUREMENTS + edited options + sa
  2. Shows inline spinner ("打版中…")
  3. On success → `router.push('/pattern?redraft=${instanceId}')`
  4. On error → shows inline error message, stays on page

### 5.3 Placement on Analyze Page

Mount `SmartDraftPanel` between the existing Armstrong toggle and the DownloadBar:

```tsx
{/* existing: ArmstrongDraftPanel toggle */}
<ArmstrongDraftPanel ... />

{/* NEW */}
{analysis && job?.analysis_id && (
  <SmartDraftPanel
    analysisId={job.analysis_id}
    profileId={DEV_PROFILE_ID}
  />
)}

{/* existing: DownloadBar */}
<DownloadBar ... />
```

### 5.4 New i18n Keys (`smartDraft.*`)

```typescript
// zh
'smartDraft.title':       'AI 版型參數',
'smartDraft.subtitle':    'AI 推薦設計 · 版型選項 · Armstrong 計算',
'smartDraft.expand':      '展開',
'smartDraft.collapse':    '收起',
'smartDraft.design':      'AI 推薦設計',
'smartDraft.options':     '版型選項',
'smartDraft.aiBadge':     '✦ AI',
'smartDraft.defaultBadge':'預設',
'smartDraft.armstrong':   'Armstrong 打版計算',
'smartDraft.draft':       'Draft with These Settings',
'smartDraft.reset':       'Reset to Defaults',
'smartDraft.drafting':    '打版中…',
'smartDraft.redirecting': '跳轉至版型工具…',
'smartDraft.error':       '打版失敗，請重試',
'smartDraft.noMeasure':   '尚無身材數據，將使用預設尺寸',

// en equivalents for all keys above
```

---

## 6. Error Handling

| Scenario | Behaviour |
|----------|-----------|
| `GET /draft-params` → 404 | Panel shows "無法取得 AI 參數" inline error |
| `GET /draft-params` → profile missing | Panel loads with warning banner "使用預設尺寸" |
| `POST /patterns/draft` fails | Inline error below button; panel stays open |
| Pattern engine down | Draft error; suggest checking server |
| User switches design mid-load | Cancels in-flight fetch, shows new design options |

---

## 7. Out of Scope

- Saving user's option edits across sessions (no localStorage persistence)
- Expanding the Visual Companion to non-Simon designs that have 10+ options (e.g. full Simon option tree with buttonhole placement, hem type, etc.) — can be added in a follow-up
- A second Claude Vision call for option extraction (Approach C) — deferred
- Mobile-specific layout adjustments for the panel

---

## 8. Success Criteria

1. After analysis, user can expand the SmartDraftPanel and see AI-ranked design + options within 1s
2. All AI-sourced options are visually distinguished from defaults
3. Clicking "Draft" with unmodified options produces a pattern that matches the analysed garment's style (collar style, cuff style, pocket presence)
4. Redirect to `/pattern?redraft=...` works and the pattern instance is saved with `created_by_ai = true`
5. TypeScript check (`npx tsc --noEmit`) passes with zero errors
6. Both Chinese and English UI labels render correctly
