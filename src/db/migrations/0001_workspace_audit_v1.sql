CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  fiscal_year_start TEXT NOT NULL,
  fiscal_year_end TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'draft',
      'in_review',
      'changes_requested',
      'ready_for_approval',
      'approved_for_export',
      'exported',
      'client_accepted',
      'filed'
    )
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, company_id, fiscal_year_start, fiscal_year_end)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_id
  ON workspaces (tenant_id);

CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_status
  ON workspaces (tenant_id, status);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system')),
  actor_user_id TEXT,
  event_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL CHECK (length(trim(target_id)) > 0),
  before_json TEXT,
  after_json TEXT,
  policy_run_id TEXT,
  model_run_id TEXT,
  timestamp TEXT NOT NULL,
  context_json TEXT NOT NULL,
  CHECK (
    (actor_type = 'user' AND actor_user_id IS NOT NULL) OR
    (actor_type = 'system' AND actor_user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_workspace
  ON audit_events (tenant_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_timestamp
  ON audit_events (tenant_id, timestamp);
