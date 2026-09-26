-- Naano real backend schema (SQLite dialect, via Node's built-in node:sqlite —
-- zero dependencies, matching this repo's existing convention). Applied
-- automatically on first connection by api/_lib/db.mjs; every statement is
-- idempotent (IF NOT EXISTS) so re-running it is always safe.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,             -- "scrypt:<salt-hex>:<hash-hex>", see api/_lib/auth.mjs
  role          TEXT NOT NULL CHECK (role IN ('creator','brand')),
  name          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,            -- random token; also the cookie value
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_profile ON sessions(profile_id);

CREATE TABLE IF NOT EXISTS creator_cards (
  profile_id            TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  headline              TEXT,
  country               TEXT,
  industries            TEXT,              -- JSON array, e.g. ["SaaS","AI"]
  price_per_post_cents  INTEGER NOT NULL DEFAULT 0,
  followers             INTEGER,
  linkedin_url          TEXT,
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brand_profiles (
  profile_id    TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  company_name  TEXT,
  domain        TEXT,
  value_prop    TEXT,
  icps          TEXT,                      -- JSON array of {title, description}
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
  id           TEXT PRIMARY KEY,
  brand_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  brief        TEXT,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed','cancelled')),
  budget_cents INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand ON campaigns(brand_id);

CREATE TABLE IF NOT EXISTS collaborations (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','accepted','declined','delivered','paid')),
  post_url    TEXT,
  price_cents INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_collab_campaign ON collaborations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_collab_creator ON collaborations(creator_id);

-- Every euro that has ever moved through a brand's wallet. Balance is
-- derived (SUM(amount_cents)), never stored — no separate counter to drift
-- out of sync with its own history.
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id                TEXT PRIMARY KEY,
  brand_id          TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('topup','spend')),
  amount_cents      INTEGER NOT NULL,       -- positive for topup, negative for spend
  stripe_session_id TEXT UNIQUE,            -- idempotency key: a Stripe webhook retry
                                             -- can't double-credit the same session
  description       TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wallet_brand ON wallet_ledger(brand_id);
