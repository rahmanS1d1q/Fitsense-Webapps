-- Migration 006: Workout assignments
-- Trainer/owner assign workout ke member sebelum member mulai sesi di mobile app.

CREATE TABLE IF NOT EXISTS workout_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trainer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id    UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL,
  notes         TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'skipped')),
  session_id    UUID REFERENCES sessions(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_assignments_company_id    ON workout_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_workout_assignments_member_id     ON workout_assignments(member_id);
CREATE INDEX IF NOT EXISTS idx_workout_assignments_trainer_id    ON workout_assignments(trainer_id);
CREATE INDEX IF NOT EXISTS idx_workout_assignments_workout_id    ON workout_assignments(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_assignments_assigned_date ON workout_assignments(assigned_date);
CREATE INDEX IF NOT EXISTS idx_workout_assignments_status        ON workout_assignments(status);
