CREATE TABLE IF NOT EXISTS workspace_artifact_versions_v1 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (
    artifact_type IN (
      'annual_report_extraction',
      'tax_adjustments',
      'tax_summary',
      'ink2_form',
      'export_package'
    )
  ),
  version INTEGER NOT NULL CHECK (version > 0),
  schema_version TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by_user_id TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
  UNIQUE (tenant_id, workspace_id, artifact_type, version)
);

CREATE INDEX IF NOT EXISTS idx_workspace_artifact_versions_v1_lookup
  ON workspace_artifact_versions_v1 (
    tenant_id,
    workspace_id,
    artifact_type,
    version DESC
  );

CREATE TABLE IF NOT EXISTS workspace_active_artifacts_v1 (
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (
    artifact_type IN (
      'annual_report_extraction',
      'tax_adjustments',
      'tax_summary',
      'ink2_form',
      'export_package'
    )
  ),
  active_artifact_id TEXT NOT NULL,
  active_version INTEGER NOT NULL CHECK (active_version > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, workspace_id, artifact_type),
  FOREIGN KEY (active_artifact_id) REFERENCES workspace_artifact_versions_v1 (id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_active_artifacts_v1_lookup
  ON workspace_active_artifacts_v1 (tenant_id, workspace_id, artifact_type);

CREATE TABLE IF NOT EXISTS comments_v1 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces (id)
);

CREATE INDEX IF NOT EXISTS idx_comments_v1_workspace_created
  ON comments_v1 (tenant_id, workspace_id, created_at DESC, id ASC);

CREATE TABLE IF NOT EXISTS tasks_v1 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  created_by_user_id TEXT NOT NULL,
  assigned_to_user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'completed')),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  completed_by_user_id TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
  CHECK (
    (status = 'open' AND completed_at IS NULL AND completed_by_user_id IS NULL) OR
    (status = 'completed' AND completed_at IS NOT NULL AND completed_by_user_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tasks_v1_workspace_created
  ON tasks_v1 (tenant_id, workspace_id, created_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_tasks_v1_workspace_status
  ON tasks_v1 (tenant_id, workspace_id, status, created_at DESC, id ASC);
