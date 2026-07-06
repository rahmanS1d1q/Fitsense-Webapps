ALTER TABLE devices ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_default_per_user
  ON devices(user_id) WHERE is_default = TRUE AND owner_type = 'individual';
