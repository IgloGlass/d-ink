CREATE TABLE IF NOT EXISTS tb_pipeline_artifact_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (
    artifact_type IN ('trial_balance', 'reconciliation', 'mapping')
  ),
  version INTEGER NOT NULL CHECK (version > 0),
  schema_version TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by_user_id TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
  UNIQUE (tenant_id, workspace_id, artifact_type, version)
);

CREATE INDEX IF NOT EXISTS idx_tb_pipeline_artifact_versions_lookup
  ON tb_pipeline_artifact_versions (
    tenant_id,
    workspace_id,
    artifact_type,
    version DESC
  );

CREATE TABLE IF NOT EXISTS tb_pipeline_active_artifacts (
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (
    artifact_type IN ('trial_balance', 'reconciliation', 'mapping')
  ),
  active_artifact_id TEXT NOT NULL,
  active_version INTEGER NOT NULL CHECK (active_version > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, workspace_id, artifact_type),
  FOREIGN KEY (active_artifact_id) REFERENCES tb_pipeline_artifact_versions (id)
);

CREATE INDEX IF NOT EXISTS idx_tb_pipeline_active_artifacts_lookup
  ON tb_pipeline_active_artifacts (tenant_id, workspace_id, artifact_type);
