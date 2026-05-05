-- ============================================================
-- Migration 001: Auth + Apple Subscription
-- Adds password auth, JWT refresh tokens, Apple IAP tables
-- ============================================================

-- ── 1. Extend users table ─────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash    TEXT,
  ADD COLUMN IF NOT EXISTS auth_provider    TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS apple_user_id    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_active        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_login_at    TIMESTAMPTZ;

-- ── 2. JWT refresh tokens ─────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,    -- SHA-256 of the actual token
  device_hint   TEXT,                    -- e.g. "iPhone 16 Pro"
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx   ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expire_idx ON refresh_tokens (expires_at);

-- ── 3. Subscriptions (Apple IAP) ─────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Apple identifiers
  original_transaction_id   TEXT UNIQUE NOT NULL,
  product_id                TEXT NOT NULL,          -- e.g. com.chailyn.pro.monthly
  bundle_id                 TEXT NOT NULL DEFAULT 'com.chailyn.app',
  -- Status
  status                    TEXT NOT NULL DEFAULT 'active',
  -- active | expired | revoked | grace_period | billing_retry
  environment               TEXT NOT NULL DEFAULT 'production',  -- sandbox | production
  -- Dates (epoch-ms from Apple → stored as TIMESTAMPTZ)
  purchase_date             TIMESTAMPTZ NOT NULL,
  expires_date              TIMESTAMPTZ,
  grace_period_expires_date TIMESTAMPTZ,
  -- Renewal intent
  auto_renew_status         BOOLEAN NOT NULL DEFAULT true,
  auto_renew_product_id     TEXT,
  -- Revocation
  revocation_date           TIMESTAMPTZ,
  revocation_reason         INT,                    -- 0=other, 1=customer complaint
  -- Offer
  offer_type                INT,                    -- 1=intro, 2=promo, 3=offer code
  offer_identifier          TEXT,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx   ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status);
CREATE INDEX IF NOT EXISTS subscriptions_expire_idx ON subscriptions (expires_date);

-- ── 4. Apple Server Notifications log ────────────────────
CREATE TABLE IF NOT EXISTS apple_notifications (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_uuid       TEXT UNIQUE,              -- Apple deduplication ID
  notification_type       TEXT NOT NULL,            -- SUBSCRIBED, DID_RENEW, EXPIRED, etc.
  subtype                 TEXT,                     -- INITIAL_BUY, AUTO_RENEW, etc.
  original_transaction_id TEXT,
  product_id              TEXT,
  environment             TEXT,
  payload_raw             TEXT NOT NULL,            -- full signedPayload (JWS) for audit
  processed               BOOLEAN NOT NULL DEFAULT false,
  error_message           TEXT,
  created_at              TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apple_notif_txn_idx  ON apple_notifications (original_transaction_id);
CREATE INDEX IF NOT EXISTS apple_notif_type_idx ON apple_notifications (notification_type);

