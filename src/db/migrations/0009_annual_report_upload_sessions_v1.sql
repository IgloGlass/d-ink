CREATE TABLE IF NOT EXISTS annual_report_upload_sessions_v1 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  source_storage_key TEXT NOT NULL,
  status TEXT NOT NULL,
  processing_run_id TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_annual_report_upload_sessions_workspace_created
  ON annual_report_upload_sessions_v1 (tenant_id, workspace_id, created_at DESC);
