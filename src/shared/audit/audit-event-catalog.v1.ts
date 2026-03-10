/**
 * Canonical audit event catalog for V1.
 *
 * This is the single source of truth for required minimum coverage events.
 */
export const AUDIT_EVENT_TYPES_V1 = {
  WORKSPACE_CREATED: "workspace.created",
  WORKSPACE_STATUS_CHANGED: "workspace.status_changed",

  FILE_UPLOADED: "file.uploaded",
  PARSE_SUCCEEDED: "parsing.parse_succeeded",
  PARSE_FAILED: "parsing.parse_failed",

  EXTRACTION_CREATED: "annual_report.extracted",
  EXTRACTION_OVERRIDDEN: "annual_report.extraction_field_overridden",
  EXTRACTION_CONFIRMED: "annual_report.extraction_confirmed",
  EXTRACTION_ACTIVE_DATA_CLEARED: "annual_report.active_data_cleared",
  EXTRACTION_ACTIVE_DEPENDENTS_CLEARED:
    "annual_report.active_dependents_cleared",
  PROCESSING_RUN_QUEUED: "annual_report.processing_run_queued",
  PROCESSING_RUN_STARTED: "annual_report.processing_run_started",
  PROCESSING_RUN_COMPLETED: "annual_report.processing_run_completed",
  PROCESSING_RUN_FAILED: "annual_report.processing_run_failed",
  PROCESSING_RUN_SUPERSEDED: "annual_report.processing_run_superseded",
  PROCESSING_RUN_CANCELLED: "annual_report.processing_run_cancelled",

  RECONCILIATION_RESULT_RECORDED: "reconciliation.run_result_recorded",

  MAPPING_GENERATED: "mapping.generated",
  MAPPING_OVERRIDES_APPLIED: "mapping.overrides_applied",
  MAPPING_PREFERENCE_SAVED: "mapping.preference_saved",
  MAPPING_PREFERENCES_AUTO_APPLIED: "mapping.preferences_auto_applied",
  MAPPING_REVIEW_SUGGESTIONS_GENERATED: "mapping.review_suggestions_generated",

  ADJUSTMENT_GENERATED: "adjustment.generated",
  ADJUSTMENT_OVERRIDDEN: "adjustment.overridden",
  ADJUSTMENT_ACCEPTED: "adjustment.accepted",

  SUMMARY_GENERATED: "summary.generated",

  FORM_POPULATED: "form.populated",
  FORM_FIELD_EDITED: "form.field_edited",
  FORM_APPROVED: "form.approved",

  COMMENT_CREATED: "comment.created",
  TASK_CREATED: "task.created",
  TASK_COMPLETED: "task.completed",

  EXPORT_CREATED: "export.created",
  MODULE_RERUN: "module.rerun",
} as const;

export type AuditEventTypeCatalogV1 =
  (typeof AUDIT_EVENT_TYPES_V1)[keyof typeof AUDIT_EVENT_TYPES_V1];

/**
 * Minimum required event matrix aligned to AGENTS.md audit requirements.
 */
export const REQUIRED_AUDIT_EVENT_TYPES_V1 = [
  AUDIT_EVENT_TYPES_V1.FILE_UPLOADED,
  AUDIT_EVENT_TYPES_V1.PARSE_SUCCEEDED,
  AUDIT_EVENT_TYPES_V1.PARSE_FAILED,
  AUDIT_EVENT_TYPES_V1.EXTRACTION_CREATED,
  AUDIT_EVENT_TYPES_V1.EXTRACTION_OVERRIDDEN,
  AUDIT_EVENT_TYPES_V1.EXTRACTION_CONFIRMED,
  AUDIT_EVENT_TYPES_V1.PROCESSING_RUN_QUEUED,
  AUDIT_EVENT_TYPES_V1.PROCESSING_RUN_STARTED,
  AUDIT_EVENT_TYPES_V1.PROCESSING_RUN_COMPLETED,
  AUDIT_EVENT_TYPES_V1.RECONCILIATION_RESULT_RECORDED,
  AUDIT_EVENT_TYPES_V1.MAPPING_GENERATED,
  AUDIT_EVENT_TYPES_V1.MAPPING_OVERRIDES_APPLIED,
  AUDIT_EVENT_TYPES_V1.MAPPING_PREFERENCE_SAVED,
  AUDIT_EVENT_TYPES_V1.ADJUSTMENT_GENERATED,
  AUDIT_EVENT_TYPES_V1.ADJUSTMENT_OVERRIDDEN,
  AUDIT_EVENT_TYPES_V1.ADJUSTMENT_ACCEPTED,
  AUDIT_EVENT_TYPES_V1.FORM_POPULATED,
  AUDIT_EVENT_TYPES_V1.FORM_FIELD_EDITED,
  AUDIT_EVENT_TYPES_V1.FORM_APPROVED,
  AUDIT_EVENT_TYPES_V1.WORKSPACE_STATUS_CHANGED,
  AUDIT_EVENT_TYPES_V1.COMMENT_CREATED,
  AUDIT_EVENT_TYPES_V1.TASK_CREATED,
  AUDIT_EVENT_TYPES_V1.TASK_COMPLETED,
  AUDIT_EVENT_TYPES_V1.EXPORT_CREATED,
  AUDIT_EVENT_TYPES_V1.MODULE_RERUN,
] as const;
