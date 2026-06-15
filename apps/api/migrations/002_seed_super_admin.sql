-- Seed: Super Admin account
-- Email: superadmin@fitsense.com
-- Password: SuperAdmin123
-- CHANGE THE PASSWORD AFTER FIRST LOGIN!

INSERT INTO users (first_name, last_name, email, password_hash, role, status)
VALUES (
  'Super',
  'Admin',
  'superadmin@fitsense.com',
  '$2a$10$bCvGO2HBHAxXDSdk7NNQTuXWprs24SApjri4yo0MltRHoJhWGlowy',
  'super_admin',
  'active'
)
ON CONFLICT (email) DO NOTHING;
