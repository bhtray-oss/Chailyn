# Chailyn App — AI Patternmaking Knowledge Base

> This file is read by Claude Code on every session start.
> It contains domain knowledge, architecture decisions, and coding conventions
> for the Chailyn FreeSewing AI garment analysis & pattern generation app.

---

## 1. Project Overview

**Chailyn** is a full-stack AI-powered sewing pattern platform:

- Upload a garment photo → Claude Vision analyses fabric, cut, silhouette
- Match to FreeSewing designs via semantic vector search (sentence-transformers)
- Generate personalised SVG/DXF patterns from body measurements
- Track pattern version history ("衣櫃 wardrobe"), export BOM, redraft

**Monorepo layout:**
```
chailyn-app/
├── apps/
│   ├── web/                  # Next.js 14 App Router (port 3000)
│   └── mobile/               # Expo (not yet active)
├── services/
│   ├── api/                  # FastAPI + SQLAlchemy async (port 8000)
│   └── pattern-engine/       # Node.js + FreeSewing v4 (port 3001)
├── package.json              # pnpm workspace root
└── CLAUDE.md                 # ← you are here
```

**Start everything:**
```bash
pnpm dev   # runs web + pattern-engine + api concurrently
```
Or individually:
```bash
pnpm --filter web dev
pnpm --filter pattern-engine dev
cd services/api && set -a && . .env && set +a && .venv/bin/uvicorn main:app --port 8000 --reload
```

---

## 2. FreeSewing Domain Knowledge

### 2.1 Measurement System

FreeSewing uses **millimetres (mm)** internally. The frontend collects in **cm**; `MeasurementsIn.to_mm()` converts.

Key measurements and their FreeSewing canonical names:
| Key | Description |
|-----|-------------|
| `chest` | Full chest circumference |
| `waist` | Natural waist circumference |
| `hips` | Full hip circumference |
| `highBust` | Circumference above bust point |
| `seat` | Seat circumference (trousers) |
| `hpsToWaistBack` | HPS (high point shoulder) to waist, back |
| `shoulderToWrist` | Shoulder point to wrist |
| `shoulderWidth` | Across shoulders, back |
| `neck` | Neck circumference (used for neckstimate) |
| `inseam` | Crotch to ankle, inner leg |
| `biceps` | Bicep circumference |
| `wrist` | Wrist circumference |

**Neckstimate:** FreeSewing can estimate missing measurements from neck size alone. Enabled with `fillMissing: true` in pattern-engine calls.

**Derived measurements** (auto-calculated in `body_profiles.py`):
- `halfChest = chest / 2`
- `quarterChest = chest / 4`
- `halfWaist = waist / 2`
- `halfHips = hips / 2`
- `bustSpan = chest - highBust` (used for dart shaping)

### 2.2 Supported Designs (15 total)

| Design | Category | Fabric weight | Skill | Notes |
|--------|----------|--------------|-------|-------|
| `aaron` | top / tank | light | ★ | Sleeveless, bias tape finish |
| `bella` | block / bodice | medium | ★★ | Female bodice base |
| `bibi` | top / tee | light | ★ | Relaxed, unisex |
| `brian` | block / bodice | medium | ★★ | Male bodice base |
| `carlita` | outerwear / coat | heavy | ★★★★ | Female double-breasted coat |
| `carlton` | outerwear / coat | heavy | ★★★★ | Male long coat |
| `huey` | top / hoodie | medium | ★★ | Zip hoodie with pocket |
| `lily` | lingerie | light | ★★ | Bra / swimwear base |
| `paco` | bottom / pants | medium | ★★ | Relaxed trousers, unisex |
| `sandy` | bottom / skirt | light | ★ | Wrap skirt, beginner-friendly |
| `simon` | top / shirt | light | ★★★ | Dress shirt, many options |
| `simone` | top / blouse | light | ★★★ | Female version of Simon |
| `teagan` | top / tee | light | ★ | Knit tee, unisex |
| `titan` | block / pants | medium | ★★ | Trouser block |
| `waralee` | bottom / pants | light | ★ | Thai wrap trousers, beginner |

Design IDs are lowercase strings; always validate against `DESIGNS` map in `pattern-engine/src/draft.mjs`.

### 2.3 Pattern Options

Each design exposes options via `pattern.getConfig().options`. Common options:
- `sa` (int, mm) — seam allowance; default 10mm
- `paperless` (bool) — add dimension annotations to SVG
- `complete` (bool) — always `true`
- `units` — always `"metric"`
- Design-specific: `collarStyle`, `cuffStyle`, `pocketPlacement`, etc.

### 2.4 DXF Export

DXF is generated in `pattern-engine/src/dxf.mjs` from `getRenderProps()` (not from SVG string).

- Format: DXF R2010 ASCII (`AC1015`)
- Units: mm (INSUNITS = 4)
- Each FreeSewing part → separate LAYER (e.g. `huey.front`, `huey.back`)
- Bézier curves sampled to LWPOLYLINE at 12 points/segment
- Every LWPOLYLINE requires `AcDbEntity` + `AcDbPolyline` subclass markers
- Validated with `ezdxf` Python library

### 2.5 SVG Logo Removal

FreeSewing embeds a skull logo in every SVG. Strip it in `stripFreeSewingLogo()` in `draft.mjs` using regex on `<use xlink:href="#logo">` and `<g class="logo">`.

---

## 3. Architecture

### 3.1 Services

**pattern-engine (Node.js, port 3001)**
- ESM-only (`"type": "module"`)
- `POST /draft` → SVG or renderProps
- `POST /dxf` → DXF file bytes
- `POST /sample` → sampling SVG
- `POST /measurements/estimate` → neckstimate fill
- No auth; trusted internal service only

**api (FastAPI, port 8000)**
- All routes in `services/api/routers/`
- Async SQLAlchemy with asyncpg
- Settings via `pydantic-settings`; `.env` file loaded with `set -a && . .env && set +a` before uvicorn
- **Critical:** env vars in the shell override `.env`. Run API with explicit env loading, never rely on inherited shell vars for `ANTHROPIC_API_KEY`.

**web (Next.js 14, port 3000)**
- App Router, all pages are `'use client'`
- Tailwind CSS (requires `postcss.config.js` in `apps/web/`)
- All fetch goes through `apps/web/src/lib/api.ts`

### 3.2 Database (PostgreSQL + pgvector)

**Key tables:**

| Table | Purpose |
|-------|---------|
| `users` | Auth, roles |
| `body_profiles` | Measurements (mm), versioned (`version`, `parent_id`), with `derived_measurements` JSONB |
| `garment_photos` | Uploaded photos metadata; files in `~/.chailyn/uploads/{photo_id}` |
| `ai_analyses` | Claude Vision results; `fabric_embed vector(384)`, `cut_embed vector(384)` |
| `analysis_jobs` | Async job tracking: `pending → running → done/failed` |
| `pattern_catalog` | 15 FreeSewing designs; `embed vector(384)` for semantic search |
| `pattern_instances` | Drafted patterns; `version`, `parent_instance_id`, `svg_data`, `design` |
| `bom_items` | Bill of Materials per pattern instance |
| `assets` | All persistent uploaded files |

**pgvector:** Embeddings are 384-dim (`paraphrase-multilingual-MiniLM-L12-v2`). Indexes use `ivfflat`. After adding significant data, rebuild with `REINDEX INDEX`.

**Dev seed user:**
- `user_id: 00000000-0000-0000-0000-000000000001`
- `body_profile_id: 00000000-0000-0000-0000-000000000002`

### 3.3 AI Analysis Pipeline

```
1. POST /analyses/upload          → save to ~/.chailyn/uploads/ + assets table
2. POST /analyses/jobs            → create job (pending), fire BackgroundTask
3. BackgroundTask _run_analysis() → mark running → Claude Vision → embed → mark done/failed
4. GET  /analyses/jobs/{id}       → frontend polls every 2s
5. jobApi.waitUntilDone()         → resolves when status=done|failed
```

Claude Vision prompt returns structured JSON: `fabric`, `cut`, `components`, `closest_freesewing_patterns`, `silhouette_tags`, `craft_recommendations`.

### 3.4 Semantic Search

- Model: `paraphrase-multilingual-MiniLM-L12-v2` via `sentence-transformers`
- Lazy-loaded on first call (model ~180MB, takes ~3s first time)
- `POST /search/reindex` rebuilds `pattern_catalog.embed` in background
- `POST /search/query` → text → embed → pgvector cosine similarity
- `GET /search/similar/{analysis_id}` → uses saved `cut_embed`

### 3.5 Body Profile Versioning

PATCH does **not** overwrite. It creates a new row with `version+1` and `parent_id` pointing to the old row. `GET /profiles/{user_id}` returns only leaf versions (nodes not pointed to by any `parent_id`).

### 3.6 Pattern Instance Versioning

Same pattern: each `POST /patterns/redraft` creates a new `pattern_instances` row with `version+1` and `parent_instance_id`. History retrieved via `GET /patterns/history/{instance_id}`.

---

## 4. Coding Conventions

### Python (services/api)

- **Async everywhere:** all DB calls use `await db.execute(text(...), params)`
- **Never use ORM models;** raw SQL with `sqlalchemy.text()` + named params
- **No f-strings in SQL;** always use `:param` placeholders
- UUID params passed as `str(uuid_obj)` to psycopg/asyncpg
- JSONB columns: cast with `CAST(:param AS JSONB)` in the SQL
- vector columns: cast with `CAST(:param AS vector)` — pass `"[1.0, 2.0, ...]"` string
- `BackgroundTasks` for async jobs; background functions must create their own `AsyncSessionLocal()` session
- Error HTTP codes: 400 bad input, 402 billing, 404 not found, 502 upstream failure

### TypeScript (apps/web)

- All pages are `'use client'`; no server components yet
- API calls go through `src/lib/api.ts` only — no direct fetch in pages
- `DEV_USER_ID = '00000000-0000-0000-0000-000000000001'` hardcoded in pages (replace with auth context later)
- Prefer explicit `interface` over `type` for API response shapes
- New interfaces exported from `api.ts`, not `types.ts`

### JavaScript (services/pattern-engine)

- ESM only: `import`/`export`, `.mjs` extensions
- FreeSewing pattern instantiation order: `new Design({...})` → `.use(themePlugin)` → `.draft()` → `.render()` or `.getRenderProps()`
- Always call `stripFreeSewingLogo()` after `.render()`
- `fillMissingWithNeckstimate()` called before drafting when `fillMissing=true`

---

## 5. Common Operations

### Add a new FreeSewing design

1. `pnpm --filter pattern-engine add @freesewing/<name>`
2. Add import + entry to `DESIGNS` map in `draft.mjs`
3. Add row to `pattern_catalog` INSERT in `schema.sql`
4. Run `POST /search/reindex` to rebuild embeddings
5. Add to `NOTIONS_BY_DESIGN` dict in `bom.py`
6. Add to `DESIGNS` array in `apps/web/src/app/pattern/page.tsx`

### Add a new API endpoint

1. Add route to appropriate file in `services/api/routers/`
2. If new router: import and mount in `main.py` with `app.include_router()`
3. Add corresponding method to `apps/web/src/lib/api.ts`
4. Run `npx tsc --noEmit` from `apps/web/` to check types

### DB schema change

1. Write `ALTER TABLE` / `CREATE TABLE` SQL
2. Run against dev DB: `psql postgresql://chailyn:chailyn_dev@localhost:5432/chailyn`
3. Update `db/schema.sql` for reference (not auto-applied)
4. Update relevant Pydantic models and SQL queries

### Run TypeScript check

```bash
cd apps/web && npx tsc --noEmit
```

### Rebuild semantic search index

```bash
curl -X POST http://localhost:8000/search/reindex
```

---

## 6. Known Gotchas

| Issue | Cause | Fix |
|-------|-------|-----|
| `ANTHROPIC_API_KEY` empty | Shell env overrides `.env` | Start API with `set -a && . .env && set +a` |
| Tailwind not compiling | Missing `postcss.config.js` | File must exist in `apps/web/` |
| SVG all black | `@freesewing/plugin-theme` not used | Call `pattern.use(themePlugin)` before `.draft()` |
| DXF invalid in ezdxf | Missing `AcDbEntity`/`AcDbPolyline` subclass markers | Both `100` group codes required in LWPOLYLINE |
| pgvector `CREATE EXTENSION` fails | Needs superuser | Run as postgres superuser, then switch back |
| `ivfflat` low recall warning | Not enough data | Expected in dev; suppress or use `hnsw` for production |
| Background task DB session | Can't pass FastAPI `db` to `BackgroundTasks` | Create fresh `async with AsyncSessionLocal() as db` inside the background function |
| FreeSewing v4 skull logo | Embedded in SVG defs | Regex-strip in `stripFreeSewingLogo()` after `.render()` |

---

## 7. Environment Variables

File: `services/api/.env` (never committed)

```
DATABASE_URL=postgresql+asyncpg://chailyn:chailyn_dev@localhost:5432/chailyn
PATTERN_ENGINE_URL=http://localhost:3001
ANTHROPIC_API_KEY=sk-ant-...
```

`pydantic-settings` reads `.env` but **environment variables take precedence**. Always verify with `echo $ANTHROPIC_API_KEY` before debugging auth errors.

---

## 8. Frontend Pages

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Landing / home |
| `/analyze` | `app/analyze/page.tsx` | Photo upload + AI analysis (async job polling) |
| `/search` | `app/search/page.tsx` | Semantic pattern search |
| `/pattern` | `app/pattern/page.tsx` | Draft patterns, version history, redraft, DXF/SVG/BOM |
| `/wardrobe` | `app/wardrobe/page.tsx` | All saved patterns grouped by design |
| `/profile` | `app/profile/page.tsx` | Body measurements with derived values and versioning |

---

## 9. Patternmaking Rules Knowledge Base

Source: *Patternmaking for Fashion Design, 5th Ed.* (Helen Joseph-Armstrong)
Module: `services/api/services/patternmaking_rules.py`

### 9.0 Module Architecture (10 Sections)

| Section | Symbol | Contents |
|---------|--------|----------|
| A | `ARMSTRONG_PRINCIPLES` | Three core principles (P1 Dart / P2 Fullness / P3 Contour) |
| B | `CONTOUR_GUIDELINES` | 7 Contour Guide Pattern lines with standard mm values |
| C | `KNIT_PATTERN_ADJUSTMENTS` | Ch 27 stretch-factor pattern reduction by knit grade |
| D | `DART_POINT_OFFSET_MM` | Dart geometry: cup sizes, 9 dart positions, width scaling |
| E | `compute_fullness_width_mm()` | Slash-and-spread width formulas; pleat/tuck constants |
| F | `YOKE_RULES` / `FLANGE_RULES` | Ch 8 yoke & flange construction dimensions |
| G | `STYLELINE_RULES` | Princess / armhole princess / panel / empire / yoke lines |
| H | `PANT_LENGTH_DERIVATIVES` | Ch 26 shorts→capri lengths; 14 pant fit problem codes |
| I | `GRAINLINE_RULES` / `NOTCH_RULES` | Pattern symbols and marking standards |
| J | `detect_required_armstrong_principles()` | Decision tree: visual features → principle set |

**Key functions for `auto_pattern_maker.py`:**
```python
from services.patternmaking_rules import (
    detect_required_armstrong_principles,   # → which P1/P2/P3 apply
    get_contour_guidelines_for_design,      # → which of 7 guidelines needed
    compute_contour_6_mm,                   # → strapless combined excess (mm)
    compute_fullness_width_mm,              # → slash-and-spread dimensions
    get_knit_pattern_adjustment,            # → stretch-factor reductions
    compute_pattern_adjustments_for_knit,   # → flat dict of all reductions
    dart_width_at_distance,                 # → dart width scaling by distance
)
```

### 9.1 Silhouette Classification (Armstrong)

| Code | Chinese | Description |
|------|---------|-------------|
| `sheath` | 合身直筒 | 雙腰省（前後各2個），緊貼身型 |
| `shift` | 半合身 | 單腰省，略寬於身型 |
| `box_fit` | 箱型 | 省道作鬆量不縫合，方正廓形 |
| `princess` | 公主線 | 縱向分割從肩到裙擺，無腰省 |
| `panel` | 縱向拼接 | 類公主線但分割不過肩 |
| `empire` | 高腰分割 | 胸下分割線，下身擴張 |
| `tent` | 帳篷型 | 肩寬裙擺寬無腰身，梯形極端版 |
| `a_line` | A字 | 腰合身裙擺自然展開 |
| `trapeze` | 梯形 | 肩窄裙擺大幅擴張 |
| `bias_cut` | 斜裁 | 45度紋理，垂墜感極佳 |

### 9.2 Collar → FreeSewing Design Mapping

| Collar Type | Designs | Notes |
|-------------|---------|-------|
| `basic_shirt_collar` / `convertible` | simon, simone | 可翻，1吋立領高 |
| `notched_lapel` / `shawl_collar` | carlton, jaeger, sven | 需駁領工藝，難度高 |
| `peter_pan` / `flat_collar` | — | 不可翻，適合娃娃裝 |
| `mandarin` / `stand_collar` | simon options | 中式立領 |
| `turtleneck` / `mock_neck` | teagan options, noble | 針織布高領 |
| `hood` | huey, hugo | 連帽 |
| `crew_neck` | teagan, aaron, brian | 基本圓領 |
| `none` / `strapless` | sandy（裙腰）, wahid | 無領片 |

### 9.3 Sleeve → Design Mapping

| Sleeve Type | Design | Notes |
|-------------|--------|-------|
| `set_in` | simon, simone, bella, noble | 標準裝袖，1.25-1.5吋吃量 |
| `tailored_two_piece` | carlton, jaeger, sven | 兩片袖，需袖肘縫 |
| `drop_shoulder` | huey, hugo, teagan oversized | 落肩，無吃量 |
| `raglan` | 自定義 | 需從頸部開始的斜線縫 |
| `bishop` | simon options | 袖口抽褶 |
| `sleeveless` | aaron, wahid, bella | 無袖 |
| `tank` | aaron | A字背心型袖窿 |

### 9.4 Pants Foundations (Armstrong 4 Types)

| Foundation | Design | Ease | Waist |
|------------|--------|------|-------|
| Culotte（褲裙）| paco variant | +100mm | 鬆緊 |
| Trouser（西裝褲）| charlie | +25-50mm | 省+拉鍊 |
| Slack（休閒褲）| paco | +50-75mm | 鬆緊/拉鍊 |
| Jean（牛仔褲）| — | +0-12mm | 無省 |

### 9.5 Ease Standards (mm)

| Fit Level | Bust | Waist | Hip | Sleeve Biceps | Cap |
|-----------|------|-------|-----|---------------|-----|
| `fitted` | 50 | 25 | 25 | 38 | 32 |
| `semi_fitted` | 63 | 38 | 50 | 50 | 38 |
| `relaxed` | 100 | 50 | 75 | 63 | 38 |
| `oversized` | 150+ | 100 | 125 | 100 | 38 |

### 9.6 Knit Stretch Classification

| Grade | Stretch% | Use case | Ease reduction |
|-------|----------|----------|----------------|
| `stable_knit` | 18% | 上衣、夾克 | 0% |
| `moderate_stretch` | 25% | 運動服、休閒 | 10% |
| `stretchy_knit` | 50% | 緊身衣、輕量泳衣 | 20% |
| `super_stretch` | 100% | 連身緊身衣、萊卡 | 30% |
| `rib_knit` | 100% | 領口/袖口羅紋 | 25% |

### 9.7 Contour Guide Pattern — 7 Guidelines (Ch 9)

| # | Name | Direction | Standard Removal | Applies To |
|---|------|-----------|-----------------|------------|
| 1 | Cutout Necklines | BP → mid-neck | **6.35 mm (1/4″)** | cutout neckline, surplice, strapless |
| 2 | Cutout Armholes | BP → shoulder tip (+bias offset) | **12.7 mm (1/2″)** | cutout armhole, tank, strapless |
| 3 | Armhole Ease Elim. | armhole curve → BP | **6.35 mm (1/4″)** | strapless, cutout armhole |
| 4 | Empire Styleline | waist→BP direction | **19 mm (3/4″)** total / 9.5 mm per dart leg | empire, bra top, corset |
| 5 | Between Busts | CF squared → BP | **19 mm (3/4″)** total / 9.5 mm per side | strapless, deep V, bra top |
| 6 | Strapless Combined | BP → mid-shoulder | G1+G2+G3 − 3.2 mm (≈22 mm) | strapless, bustier, tube top |
| 7 | Back Bodice | varies | chart per design | strapless, backless, low back |

Semi-fit garments use **3/16″ (4.76 mm)** per dart leg for Guidelines 4 & 5 (half of standard).

### 9.8 Knit Stretch-Factor Pattern Reductions (Ch 27)

For knits with **18–25% stretch** (moderate_stretch grade). For **25–50%** add 3.2 mm to each.

| Location | Remove / Raise (mm) |
|----------|---------------------|
| Neckline raise | 6.35 (1/4″) |
| Side seams (each) remove | 6.35 (1/4″) |
| Armhole raise | 12.7 (1/2″) |
| Dart points raise | 6.35 (1/4″) |
| Hem / waistline remove | 6.35 (1/4″) |
| Sleeve biceps raise | 12.7 (1/2″) |
| Sleeve underarm seam remove | 6.35 (1/4″) |
| Sleeve hem remove | 6.35 (1/4″) |
| Elbow dart reposition up | 6.35 (1/4″) |
| Crotch raise (trouser) | 12.7 (1/2″) |
| Crotch raise (slack/jean) | 6.35 (1/4″) |

Stretch direction rule: max stretch should **encircle** figure for tops/dresses/pants (filling/crosswise); go **up-and-down** for bodysuits/leotards/skiwear (warp/lengthwise).

### 9.9 Added Fullness Ratios (Ch 7)

| Ratio | Added | Total (26″ waist example) | Effect |
|-------|-------|--------------------------|--------|
| 1.5× | 50% | 39″ | 自然抽褶，輕薄布料 |
| 2.0× | 100% | 52″ | 中等豐盈，標準抽褶/圓裙 |
| 2.5× | 150% | 65″ | 豐富波浪感 |
| 3.0× | 200% | 78″ | 極豐盈，舞台/燈籠袖 |

Gather control notches: **13 mm (1/2″)** outside first and last slash line.
Slashes: 1 slash per ~32 mm (1.25″) of added fullness (`compute_fullness_width_mm()` auto-computes).

### 9.10 Claude Vision Output Fields (Updated)

新版 `claude_vision.py` 多了以下欄位：
- `garment_category`: `top | bottom | outerwear | lingerie | block | dress`
- `garment_type_detail`: 具體款式（button-down shirt, wrap skirt...）
- `skirt_type` / `pant_type`: 具體裙型/褲型代碼
- `components.collar.type`: Armstrong 領型代碼
- `components.sleeves.type`: Armstrong 袖型代碼
- `components.sleeves.cuff_type`: 袖口類型
- `cut.waist_treatment`: 腰部處理方式
- `cut.fit_ease`: fitted/semi_fitted/relaxed/oversized
- `difficulty_estimate`: 1-4 難度

---

## 10. API Quick Reference

```
# Auth
POST /auth/register
GET  /auth/user/{user_id}

# Body Profiles
POST   /profiles/
GET    /profiles/{user_id}
PATCH  /profiles/{profile_id}          ← creates new version
GET    /profiles/detail/{profile_id}

# AI Analysis
POST /analyses/upload
POST /analyses/jobs                    ← async, returns job_id
GET  /analyses/jobs/{job_id}           ← poll: pending|running|done|failed
POST /analyses/analyze                 ← sync (legacy)
GET  /analyses/{analysis_id}

# Patterns
POST /patterns/draft
POST /patterns/redraft                 ← creates new version
GET  /patterns/dxf/{instance_id}       ← download DXF file
GET  /patterns/history/{instance_id}   ← full version chain
GET  /patterns/user/{user_id}          ← wardrobe (latest per design)
GET  /patterns/catalog/list
GET  /patterns/designs
GET  /patterns/{instance_id}

# Search
POST /search/query                     ← text → similar catalog items
GET  /search/similar/{analysis_id}     ← analysis → similar catalog items
POST /search/reindex                   ← rebuild catalog embeddings

# BOM
GET    /bom/{instance_id}
POST   /bom/{instance_id}/generate     ← AI auto-estimate
POST   /bom/{instance_id}/items
PATCH  /bom/items/{item_id}
DELETE /bom/items/{item_id}
```
