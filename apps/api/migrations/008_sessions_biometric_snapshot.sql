ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS age_at_session    INTEGER,
  ADD COLUMN IF NOT EXISTS weight_at_session FLOAT,
  ADD COLUMN IF NOT EXISTS height_at_session FLOAT;

CREATE INDEX IF NOT EXISTS idx_sessions_age_at_session ON sessions(age_at_session);
