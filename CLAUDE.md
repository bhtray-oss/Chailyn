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

## 9. API Quick Reference

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
