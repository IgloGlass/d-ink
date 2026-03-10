DROP TABLE IF EXISTS workspace_active_artifacts_v1_next;
DROP TABLE IF EXISTS workspace_artifact_versions_v1_next;

CREATE TABLE workspace_artifact_versions_v1_next (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (
    artifact_type IN (
      'annual_report_extraction',
      'annual_report_tax_analysis',
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

INSERT INTO workspace_artifact_versions_v1_next (
  id,
  tenant_id,
  workspace_id,
  artifact_type,
  version,
  schema_version,
  payload_json,
  created_at,
  created_by_user_id
)
SELECT
  id,
  tenant_id,
  workspace_id,
  artifact_type,
  version,
  schema_version,
  payload_json,
  created_at,
  created_by_user_id
FROM workspace_artifact_versions_v1;

CREATE INDEX IF NOT EXISTS idx_workspace_artifact_versions_v1_next_lookup
  ON workspace_artifact_versions_v1_next (
    tenant_id,
    workspace_id,
    artifact_type,
    version DESC
  );

CREATE TABLE workspace_active_artifacts_v1_next (
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (
    artifact_type IN (
      'annual_report_extraction',
      'annual_report_tax_analysis',
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
  FOREIGN KEY (active_artifact_id) REFERENCES workspace_artifact_versions_v1_next (id)
);

INSERT INTO workspace_active_artifacts_v1_next (
  tenant_id,
  workspace_id,
  artifact_type,
  active_artifact_id,
  active_version,
  updated_at
)
SELECT
  tenant_id,
  workspace_id,
  artifact_type,
  active_artifact_id,
  active_version,
  updated_at
FROM workspace_active_artifacts_v1;

CREATE INDEX IF NOT EXISTS idx_workspace_active_artifacts_v1_next_lookup
  ON workspace_active_artifacts_v1_next (tenant_id, workspace_id, artifact_type);

DROP TABLE workspace_active_artifacts_v1;
DROP TABLE workspace_artifact_versions_v1;

ALTER TABLE workspace_artifact_versions_v1_next
  RENAME TO workspace_artifact_versions_v1;

ALTER TABLE workspace_active_artifacts_v1_next
  RENAME TO workspace_active_artifacts_v1;

DROP INDEX IF EXISTS idx_workspace_artifact_versions_v1_next_lookup;
DROP INDEX IF EXISTS idx_workspace_active_artifacts_v1_next_lookup;

CREATE INDEX IF NOT EXISTS idx_workspace_artifact_versions_v1_lookup
  ON workspace_artifact_versions_v1 (
    tenant_id,
    workspace_id,
    artifact_type,
    version DESC
  );

CREATE INDEX IF NOT EXISTS idx_workspace_active_artifacts_v1_lookup
  ON workspace_active_artifacts_v1 (tenant_id, workspace_id, artifact_type);
