-- Chailyn FreeSewing APP · PostgreSQL Schema
-- 執行前需安裝 pgvector extension

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 使用者
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  role          TEXT DEFAULT 'user',
  locale        TEXT DEFAULT 'zh-TW',
  subscription_tier TEXT DEFAULT 'free',
  clerk_user_id TEXT UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 身材檔案 (FreeSewing measurements, 單位 mm)
CREATE TABLE body_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label           TEXT DEFAULT '日常',
  measurements    JSONB NOT NULL DEFAULT '{}',
  source          TEXT DEFAULT 'manual',
  is_default      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON body_profiles USING GIN (measurements);
CREATE INDEX ON body_profiles (user_id);

-- 風格偏好
CREATE TABLE style_preferences (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  style_tags    TEXT[] DEFAULT '{}',
  color_palette JSONB DEFAULT '{}',
  avoid_list    TEXT[] DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 上傳照片
CREATE TABLE garment_photos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  r2_key        TEXT NOT NULL,
  thumbnail_url TEXT,
  original_url  TEXT,
  visibility    TEXT DEFAULT 'private',
  mime_type     TEXT DEFAULT 'image/jpeg',
  file_size_kb  INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON garment_photos (user_id);

-- AI 分析結果
CREATE TABLE ai_analyses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photo_id          UUID NOT NULL REFERENCES garment_photos(id) ON DELETE CASCADE,
  model             TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  raw_output        JSONB NOT NULL,
  fabric_vector     vector(512),
  cut_vector        vector(512),
  closest_patterns  JSONB,
  silhouette_tags   TEXT[],
  fabric_summary    TEXT,
  craft_notes       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON ai_analyses (photo_id);
CREATE INDEX ON ai_analyses USING ivfflat (fabric_vector vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON ai_analyses USING ivfflat (cut_vector vector_cosine_ops) WITH (lists = 100);

-- 版型目錄
CREATE TABLE pattern_catalog (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source          TEXT DEFAULT 'freesewing',
  fs_design_id    TEXT,
  name            TEXT NOT NULL,
  family          TEXT,
  gender_hint     TEXT,
  difficulty      INTEGER,
  options_schema  JSONB DEFAULT '{}',
  thumbnail_url   TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON pattern_catalog (family);
CREATE INDEX ON pattern_catalog (fs_design_id);

-- 版型實例
CREATE TABLE pattern_instances (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_catalog_id    UUID REFERENCES pattern_catalog(id),
  body_profile_id       UUID REFERENCES body_profiles(id),
  measurements_snapshot JSONB NOT NULL,
  options_snapshot      JSONB NOT NULL DEFAULT '{}',
  sa                    INTEGER DEFAULT 10,
  paperless             BOOLEAN DEFAULT false,
  svg_url               TEXT,
  pdf_url               TEXT,
  dxf_url               TEXT,
  created_by_ai         BOOLEAN DEFAULT false,
  ai_source_photo_id    UUID REFERENCES garment_photos(id),
  ai_confidence         NUMERIC(4,3),
  logs                  JSONB,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON pattern_instances (user_id);

-- 專案
CREATE TABLE projects (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL DEFAULT '未命名專案',
  photo_ids           UUID[] DEFAULT '{}',
  pattern_instance_id UUID REFERENCES pattern_instances(id),
  notes               TEXT,
  status              TEXT DEFAULT 'draft',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON projects (user_id);

-- 預設版型種子資料 (15 精選)
INSERT INTO pattern_catalog (fs_design_id, name, family, gender_hint, difficulty) VALUES
  ('aaron',   'Aaron',   'top',      'cis_male',   1),
  ('brian',   'Brian',   'block',    'cis_male',   2),
  ('bella',   'Bella',   'block',    'cis_female', 2),
  ('simon',   'Simon',   'shirt',    'cis_male',   3),
  ('simone',  'Simone',  'shirt',    'cis_female', 3),
  ('titan',   'Titan',   'pants',    'unisex',     2),
  ('sandy',   'Sandy',   'skirt',    'cis_female', 1),
  ('carlton', 'Carlton', 'coat',     'cis_male',   4),
  ('carlita', 'Carlita', 'coat',     'cis_female', 4),
  ('teagan',  'Teagan',  'top',      'unisex',     1),
  ('huey',    'Huey',    'hoodie',   'unisex',     2),
  ('paco',    'Paco',    'pants',    'unisex',     2),
  ('waralee', 'Waralee', 'pants',    'cis_female', 1),
  ('bibi',    'Bibi',    'top',      'cis_female', 1),
  ('lily',    'Lily',    'lingerie', 'cis_female', 2);
