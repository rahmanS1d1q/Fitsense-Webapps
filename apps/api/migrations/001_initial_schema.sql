-- FitSense — Initial Schema Migration
-- Requirements: 1.1, 3.1, 4.1, 10.1, 12.5, 18.1, 19.1

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Table: clubs
-- ============================================================
CREATE TABLE IF NOT EXISTS clubs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(50)  UNIQUE NOT NULL
               CHECK (slug ~ '^[a-z0-9-]{3,50}$'),
  address    TEXT,
  phone      VARCHAR(20),
  status     VARCHAR(20)  DEFAULT 'active'
               CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
-- Table: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID        REFERENCES clubs(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  role          VARCHAR(20)  NOT NULL
                  CHECK (role IN ('super_admin','club_owner','trainer','member')),
  age           INTEGER,
  gender        VARCHAR(10),
  status        VARCHAR(20)  DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive')),
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_club_id ON users(club_id);
CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);

-- ============================================================
-- Table: sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES users(id),
  club_id          UUID        REFERENCES clubs(id),
  started_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ,
  avg_hr           INTEGER,
  max_hr           INTEGER,
  min_hr           INTEGER,
  duration_minutes INTEGER,
  hr_zone          VARCHAR(20),
  auto_closed      BOOLEAN     DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_club_id    ON sessions(club_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);

-- ============================================================
-- Table: devices
-- ============================================================
CREATE TABLE IF NOT EXISTS devices (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES users(id),
  club_id       UUID        REFERENCES clubs(id),
  device_type   VARCHAR(50)
                  CHECK (device_type IN ('coospo_h6','coospo_hw706')),
  mac_address   VARCHAR(20),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, mac_address)
);

-- ============================================================
-- Table: ml_recommendations
-- ============================================================
CREATE TABLE IF NOT EXISTS ml_recommendations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES users(id),
  session_id   UUID        REFERENCES sessions(id),
  type         VARCHAR(30)  NOT NULL
                 CHECK (type IN ('workout_recommendation','anomaly_alert','zone_summary')),
  content      JSONB        NOT NULL,
  generated_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_rec_user_id      ON ml_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_rec_generated_at ON ml_recommendations(generated_at DESC);

-- ============================================================
-- Table: invite_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS invite_codes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID        REFERENCES clubs(id),
  code       VARCHAR(64)  UNIQUE NOT NULL,
  created_by UUID        REFERENCES users(id),
  used_by    UUID        REFERENCES users(id),
  expires_at TIMESTAMPTZ  NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code       ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_club_id    ON invite_codes(club_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires_at ON invite_codes(expires_at);

-- ============================================================
-- Table: password_reset_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES users(id),
  -- token_hash: SHA-256 of the raw token sent to the user's email.
  -- Raw token is NEVER stored. Verification: SHA-256(raw_token) == token_hash.
  token_hash TEXT        UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwd_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_user_id    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires_at ON password_reset_tokens(expires_at);
