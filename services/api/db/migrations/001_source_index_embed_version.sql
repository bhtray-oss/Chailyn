-- Migration 001: source index + embed version column
-- Run against existing databases after the Mood Fabrics / semantic search PR merge.
-- Safe to run multiple times (all statements use IF NOT EXISTS / IF EXISTS guards).
--
-- Apply:
--   psql $DATABASE_URL -f services/api/db/migrations/001_source_index_embed_version.sql

-- 1. Index on pattern_catalog.source (speeds up ?source= filter in /catalog/list and /search/query)
CREATE INDEX IF NOT EXISTS pattern_catalog_source_idx ON pattern_catalog (source);

-- 2. Index on pattern_catalog.is_active (used in every WHERE clause)
CREATE INDEX IF NOT EXISTS pattern_catalog_active_idx ON pattern_catalog (is_active);

-- 3. Embed version column — allows invalidating cached embeddings when the model changes
--    Default '1' = paraphrase-multilingual-MiniLM-L12-v2 (v1)
ALTER TABLE pattern_catalog
  ADD COLUMN IF NOT EXISTS embed_version SMALLINT NOT NULL DEFAULT 1;

-- 4. Backfill: mark rows that already have an embedding as version 1
UPDATE pattern_catalog SET embed_version = 1 WHERE embed IS NOT NULL;

-- 5. Composite index for "active rows of a given source with embeddings"
--    Used by /search/query when source filter is present
CREATE INDEX IF NOT EXISTS pattern_catalog_source_embed_idx
  ON pattern_catalog (source, is_active)
  WHERE embed IS NOT NULL;
