CREATE TABLE IF NOT EXISTS annual_report_processing_runs_v1 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  source_file_name TEXT NOT NULL,
  source_file_type TEXT NOT NULL CHECK (source_file_type IN ('pdf', 'docx')),
  source_storage_key TEXT NOT NULL,
  source_size_bytes INTEGER NOT NULL CHECK (source_size_bytes > 0),
  policy_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'queued',
      'uploading_source',
      'locating_sections',
      'extracting_core_facts',
      'extracting_statements',
      'extracting_tax_notes',
      'running_tax_analysis',
      'completed',
      'partial',
      'failed',
      'cancelled',
      'superseded'
    )
  ),
  has_previous_active_result INTEGER NOT NULL DEFAULT 0 CHECK (has_previous_active_result IN (0, 1)),
  previous_active_extraction_artifact_id TEXT,
  technical_details_json TEXT NOT NULL DEFAULT '[]',
  preview_extraction_json TEXT,
  error_json TEXT,
  runtime_json TEXT,
  result_extraction_artifact_id TEXT,
  result_tax_analysis_artifact_id TEXT,
  provider_file_name TEXT,
  provider_file_uri TEXT,
  provider_file_mime_type TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces (id)
);

CREATE INDEX IF NOT EXISTS idx_annual_report_processing_runs_v1_lookup
  ON annual_report_processing_runs_v1 (
    tenant_id,
    workspace_id,
    created_at DESC,
    id DESC
  );

CREATE INDEX IF NOT EXISTS idx_annual_report_processing_runs_v1_status
  ON annual_report_processing_runs_v1 (
    tenant_id,
    workspace_id,
    status,
    updated_at DESC
  );
