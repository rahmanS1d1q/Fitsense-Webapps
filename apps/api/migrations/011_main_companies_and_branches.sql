-- Phase C1: Option C-Safe Database Schema
-- main_companies (parent organization / gym brand)
-- company_branches (metadata/relationship table linking companies.id to main_companies.id)

CREATE TABLE IF NOT EXISTS main_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_main_companies_slug
  ON main_companies(slug);

CREATE INDEX IF NOT EXISTS idx_main_companies_status
  ON main_companies(status);

CREATE TABLE IF NOT EXISTS company_branches (
  company_id UUID PRIMARY KEY
    REFERENCES companies(id) ON DELETE CASCADE,
  main_company_id UUID NOT NULL
    REFERENCES main_companies(id) ON DELETE RESTRICT,
  display_name VARCHAR(255),
  contact_person VARCHAR(255),
  contact_email VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_branches_main_company_id
  ON company_branches(main_company_id);
