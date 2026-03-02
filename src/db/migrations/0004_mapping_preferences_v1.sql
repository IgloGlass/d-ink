CREATE TABLE IF NOT EXISTS mapping_preferences_v1 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('return', 'user')),
  workspace_id TEXT,
  user_id TEXT,
  source_account_number TEXT NOT NULL,
  statement_type TEXT NOT NULL CHECK (
    statement_type IN ('balance_sheet', 'income_statement')
  ),
  selected_category_code TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  CHECK (
    (scope = 'return' AND workspace_id IS NOT NULL AND user_id IS NULL) OR
    (scope = 'user' AND workspace_id IS NULL AND user_id IS NOT NULL)
  ),
  FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (created_by_user_id) REFERENCES users (id),
  FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mapping_preferences_v1_return_unique
  ON mapping_preferences_v1 (
    tenant_id,
    workspace_id,
    source_account_number,
    statement_type
  )
  WHERE scope = 'return';

CREATE UNIQUE INDEX IF NOT EXISTS idx_mapping_preferences_v1_user_unique
  ON mapping_preferences_v1 (
    tenant_id,
    user_id,
    source_account_number,
    statement_type
  )
  WHERE scope = 'user';

CREATE INDEX IF NOT EXISTS idx_mapping_preferences_v1_lookup
  ON mapping_preferences_v1 (
    tenant_id,
    scope,
    workspace_id,
    user_id,
    source_account_number,
    statement_type
  );
