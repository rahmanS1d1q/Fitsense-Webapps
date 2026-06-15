-- FitSense — Initial Schema (matches actual pgAdmin schema)
-- Requirements: 1.1, 3.1, 4.1, 10.1, 12.5, 18.1, 19.1

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Migration tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS _migrations (
  id         SERIAL       PRIMARY KEY,
  filename   VARCHAR(255) NOT NULL,
  applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: companies
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(50)  UNIQUE NOT NULL
               CHECK (slug ~ '^[a-z0-9-]{3,50}$'),
  address    TEXT,
  phone      VARCHAR(20),
  status     VARCHAR(20)  NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  asset_id   UUID
);

-- ============================================================
-- Table: users
-- NOTE: role default 'member', NOT NULL.
--       super_admin role stored here directly.
--       All other roles also stored in users_companies.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT         NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  bio_code      VARCHAR(50),
  gender        VARCHAR(10),
  height        DOUBLE PRECISION,
  weight        DOUBLE PRECISION,
  age           INTEGER,
  role          VARCHAR(20)  NOT NULL DEFAULT 'member'
                  CHECK (role IN ('super_admin', 'club_owner', 'trainer', 'member')),
  status        VARCHAR(20)  NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- Table: users_companies (RBAC — role per company)
-- ============================================================
CREATE TABLE IF NOT EXISTS users_companies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL
                CHECK (role IN ('club_owner', 'trainer', 'member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_users_companies_user_id    ON users_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_users_companies_company_id ON users_companies(company_id);

-- ============================================================
-- Table: assets
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID         REFERENCES companies(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  size        VARCHAR(50),
  type        VARCHAR(50)  NOT NULL
                CHECK (type IN ('profile_photo', 'workout_video', 'workout_image', 'club_banner')),
  url         TEXT         NOT NULL,
  published   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_company_id ON assets(company_id);

-- FK from companies to assets (added after assets table)
ALTER TABLE companies ADD CONSTRAINT fk_companies_asset
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;

-- ============================================================
-- Table: workouts
-- ============================================================
CREATE TABLE IF NOT EXISTS workouts (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id         UUID         REFERENCES assets(id) ON DELETE SET NULL,
  name             VARCHAR(255) NOT NULL,
  intro_activities TEXT,
  intro_duration   INTEGER,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workouts_company_id ON workouts(company_id);

-- ============================================================
-- Table: sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id),
  company_id       UUID        NOT NULL REFERENCES companies(id),
  workout_id       UUID        REFERENCES workouts(id) ON DELETE SET NULL,
  started_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ,
  avg_hr           INTEGER,
  max_hr           INTEGER,
  min_hr           INTEGER,
  duration_minutes INTEGER,
  hr_zone          VARCHAR(20),
  mood             VARCHAR(50),
  auto_closed      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_company_id ON sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_workout_id ON sessions(workout_id);

-- ============================================================
-- Table: heart_rate (PostgreSQL summary per session)
-- ============================================================
CREATE TABLE IF NOT EXISTS heart_rate (
  id         UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID             NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp  TIMESTAMPTZ      NOT NULL,
  value      DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_heart_rate_session_id ON heart_rate(session_id);

-- ============================================================
-- Table: devices
-- ============================================================
CREATE TABLE IF NOT EXISTS devices (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id),
  company_id    UUID        NOT NULL REFERENCES companies(id),
  device_type   VARCHAR(50) NOT NULL
                  CHECK (device_type IN ('coospo_hw706')),
  mac_address   VARCHAR(20) NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, mac_address)
);

-- ============================================================
-- Table: ml_recommendations
-- ============================================================
CREATE TABLE IF NOT EXISTS ml_recommendations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id),
  session_id   UUID        NOT NULL REFERENCES sessions(id),
  type         VARCHAR(30) NOT NULL
                 CHECK (type IN ('workout_recommendation', 'anomaly_alert', 'zone_summary')),
  content      JSONB       NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_rec_user_id      ON ml_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_rec_generated_at ON ml_recommendations(generated_at DESC);

-- ============================================================
-- Table: invite_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS invite_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id),
  code        VARCHAR(64) UNIQUE NOT NULL,
  created_by  UUID        NOT NULL REFERENCES users(id),
  used_by     UUID        REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code       ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_company_id ON invite_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires_at ON invite_codes(expires_at);

-- ============================================================
-- Table: password_reset_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id),
  token_hash TEXT        UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwd_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_user_id    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires_at ON password_reset_tokens(expires_at);
