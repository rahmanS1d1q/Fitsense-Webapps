-- Tambah kolom deleted_at dan deleted_by ke tabel utama
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

ALTER TABLE sessions 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

ALTER TABLE devices 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

ALTER TABLE workouts 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

ALTER TABLE workout_assignments 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Buat tabel audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action        VARCHAR(50) NOT NULL
                  CHECK (action IN (
                    'soft_delete', 'hard_delete', 'restore',
                    'suspend_company', 'activate_company'
                  )),
  entity_type   VARCHAR(50) NOT NULL
                  CHECK (entity_type IN (
                    'user', 'company', 'session',
                    'device', 'workout', 'workout_assignment'
                  )),
  entity_id     UUID NOT NULL,
  entity_data   JSONB,
  performed_by  UUID NOT NULL REFERENCES users(id),
  performed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes         TEXT
);

-- Index pendukung untuk pencarian audit_logs dan filter deleted_at
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_companies_deleted_at ON companies(deleted_at);
CREATE INDEX IF NOT EXISTS idx_sessions_deleted_at ON sessions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_devices_deleted_at ON devices(deleted_at);
CREATE INDEX IF NOT EXISTS idx_workouts_deleted_at ON workouts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_workout_assignments_deleted_at ON workout_assignments(deleted_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_at ON audit_logs(performed_at DESC);
