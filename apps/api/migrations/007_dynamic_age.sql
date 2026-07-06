ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;

UPDATE users SET date_of_birth = (CURRENT_DATE - (age * INTERVAL '1 year'))::DATE
WHERE age IS NOT NULL AND date_of_birth IS NULL;

CREATE OR REPLACE VIEW users_with_age AS
SELECT *, EXTRACT(YEAR FROM AGE(NOW(), date_of_birth))::INTEGER AS calculated_age
FROM users WHERE date_of_birth IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_date_of_birth ON users(date_of_birth);
