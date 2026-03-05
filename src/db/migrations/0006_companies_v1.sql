CREATE TABLE IF NOT EXISTS companies_v1 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  legal_name TEXT NOT NULL CHECK (length(trim(legal_name)) > 0),
  organization_number TEXT NOT NULL CHECK (
    length(organization_number) = 10
    AND organization_number GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
  ),
  default_fiscal_year_start TEXT NOT NULL,
  default_fiscal_year_end TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, organization_number)
);

CREATE INDEX IF NOT EXISTS idx_companies_v1_tenant
  ON companies_v1 (tenant_id, updated_at DESC, id ASC);
