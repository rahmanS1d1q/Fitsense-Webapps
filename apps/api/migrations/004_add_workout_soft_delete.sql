-- Migration 004: Add soft delete to workouts table
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_workouts_deleted_at ON workouts(deleted_at);
