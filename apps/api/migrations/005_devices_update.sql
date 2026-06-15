-- Migration 005: Update devices table — company vs individual devices
-- Run this in pgAdmin before deploying

-- Tambah kolom baru ke tabel devices
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS owner_type VARCHAR(20) NOT NULL DEFAULT 'individual'
    CHECK (owner_type IN ('company', 'individual')),
  ADD COLUMN IF NOT EXISTS name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'borrowed', 'maintenance', 'lost')),
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Tambah kolom device_id ke sessions
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES devices(id) ON DELETE SET NULL;

-- Update constraint: user_id nullable untuk device company
ALTER TABLE devices ALTER COLUMN user_id DROP NOT NULL;

-- Index baru
CREATE INDEX IF NOT EXISTS idx_devices_owner_type  ON devices(owner_type);
CREATE INDEX IF NOT EXISTS idx_devices_status       ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_company_id   ON devices(company_id);
CREATE INDEX IF NOT EXISTS idx_devices_mac_address  ON devices(mac_address);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id   ON sessions(device_id);
