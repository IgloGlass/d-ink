import {
  type AnnualReportProcessingRunDegradationV1,
  type AnnualReportProcessingRunErrorV1,
  type AnnualReportProcessingRunStatusV1,
  parseAnnualReportProcessingRunV1,
} from "../../shared/contracts/annual-report-processing-run.v1";
import {
  type AnnualReportExtractionPayloadV1,
  type AnnualReportFileTypeV1,
  type AnnualReportRuntimeMetadataV1,
  parseAnnualReportExtractionPayloadV1,
} from "../../shared/contracts/annual-report-extraction.v1";
import type { D1Database } from "../../shared/types/d1";

export type AnnualReportProcessingProviderFileV1 = {
  mimeType: string;
  name: string;
  uri: string;
};

export type AnnualReportProcessingRunRecordV1 = {
  createdAt: string;
  createdByUserId?: string;
  degradation?: AnnualReportProcessingRunDegradationV1;
  error?: AnnualReportProcessingRunErrorV1;
  finishedAt?: string;
  hasPreviousActiveResult: boolean;
  id: string;
  policyVersion: string;
  previewExtraction?: AnnualReportExtractionPayloadV1;
  previousActiveExtractionArtifactId?: string;
  providerFile?: AnnualReportProcessingProviderFileV1;
  resultExtractionArtifactId?: string;
  resultTaxAnalysisArtifactId?: string;
  runtime?: AnnualReportRuntimeMetadataV1;
  sourceFileName: string;
  sourceFileType: AnnualReportFileTypeV1;
  sourceSizeBytes: number;
  sourceStorageKey: string;
  startedAt?: string;
  status: AnnualReportProcessingRunStatusV1;
  technicalDetails: string[];
  tenantId: string;
  updatedAt: string;
  workspaceId: string;
};

export type AnnualReportProcessingRunRepositoryFailureCodeV1 =
  | "WORKSPACE_NOT_FOUND"
  | "PROCESSING_RUN_NOT_FOUND"
  | "PERSISTENCE_ERROR";

export type AnnualReportProcessingRunRepositoryFailureV1 = {
  code: AnnualReportProcessingRunRepositoryFailureCodeV1;
  message: string;
  ok: false;
};

export type AnnualReportProcessingRunRepositorySuccessV1<TValue> = {
  ok: true;
  value: TValue;
};

export type AnnualReportProcessingRunRepositoryResultV1<TValue> =
  | AnnualReportProcessingRunRepositorySuccessV1<TValue>
  | AnnualReportProcessingRunRepositoryFailureV1;

export interface AnnualReportProcessingRunRepositoryV1 {
  create(
    run: AnnualReportProcessingRunRecordV1,
  ): Promise<
    AnnualReportProcessingRunRepositoryResultV1<
      AnnualReportProcessingRunRecordV1
    >
  >;
  getById(input: {
    runId: string;
    tenantId: string;
    workspaceId: string;
  }): Promise<AnnualReportProcessingRunRecordV1 | null>;
  getLatestByWorkspace(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<AnnualReportProcessingRunRecordV1 | null>;
  listOpenByWorkspace(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<AnnualReportProcessingRunRecordV1[]>;
  save(
    run: AnnualReportProcessingRunRecordV1,
  ): Promise<
    AnnualReportProcessingRunRepositoryResultV1<
      AnnualReportProcessingRunRecordV1
    >
  >;
}

type WorkspaceExistsRowV1 = {
  id: string;
};

type AnnualReportProcessingRunRowV1 = {
  created_at: string;
  created_by_user_id: string | null;
  degradation_json: string | null;
  error_json: string | null;
  finished_at: string | null;
  has_previous_active_result: number;
  id: string;
  policy_version: string;
  preview_extraction_json: string | null;
  previous_active_extraction_artifact_id: string | null;
  provider_file_mime_type: string | null;
  provider_file_name: string | null;
  provider_file_uri: string | null;
  result_extraction_artifact_id: string | null;
  result_tax_analysis_artifact_id: string | null;
  runtime_json: string | null;
  source_file_name: string;
  source_file_type: AnnualReportFileTypeV1;
  source_size_bytes: number;
  source_storage_key: string;
  started_at: string | null;
  status: AnnualReportProcessingRunStatusV1;
  technical_details_json: string;
  tenant_id: string;
  updated_at: string;
  workspace_id: string;
};

const OPEN_RUN_STATUS_SET_V1 = new Set<AnnualReportProcessingRunStatusV1>([
  "queued",
  "uploading_source",
  "locating_sections",
  "extracting_core_facts",
  "extracting_statements",
  "extracting_tax_notes",
  "running_tax_analysis",
]);

const SELECT_WORKSPACE_EXISTS_SQL_V1 = `
SELECT id
FROM workspaces
WHERE tenant_id = ?1 AND id = ?2
LIMIT 1
`;

const INSERT_RUN_SQL_V1 = `
INSERT INTO annual_report_processing_runs_v1 (
  id,
  tenant_id,
  workspace_id,
  source_file_name,
  source_file_type,
  source_storage_key,
  source_size_bytes,
  policy_version,
  status,
  has_previous_active_result,
  previous_active_extraction_artifact_id,
  technical_details_json,
  preview_extraction_json,
  error_json,
  degradation_json,
  runtime_json,
  result_extraction_artifact_id,
  result_tax_analysis_artifact_id,
  provider_file_name,
  provider_file_uri,
  provider_file_mime_type,
  created_by_user_id,
  created_at,
  updated_at,
  started_at,
  finished_at
)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26)
`;

const UPDATE_RUN_SQL_V1 = `
UPDATE annual_report_processing_runs_v1
SET
  source_file_name = ?1,
  source_file_type = ?2,
  source_storage_key = ?3,
  source_size_bytes = ?4,
  policy_version = ?5,
  status = ?6,
  has_previous_active_result = ?7,
  previous_active_extraction_artifact_id = ?8,
  technical_details_json = ?9,
  preview_extraction_json = ?10,
  error_json = ?11,
  degradation_json = ?12,
  runtime_json = ?13,
  result_extraction_artifact_id = ?14,
  result_tax_analysis_artifact_id = ?15,
  provider_file_name = ?16,
  provider_file_uri = ?17,
  provider_file_mime_type = ?18,
  created_by_user_id = ?19,
  created_at = ?20,
  updated_at = ?21,
  started_at = ?22,
  finished_at = ?23
WHERE id = ?24
  AND tenant_id = ?25
  AND workspace_id = ?26
`;

const SELECT_RUN_BY_ID_SQL_V1 = `
SELECT
  id,
  tenant_id,
  workspace_id,
  source_file_name,
  source_file_type,
  source_storage_key,
  source_size_bytes,
  policy_version,
  status,
  has_previous_active_result,
  previous_active_extraction_artifact_id,
  technical_details_json,
  preview_extraction_json,
  error_json,
  degradation_json,
  runtime_json,
  result_extraction_artifact_id,
  result_tax_analysis_artifact_id,
  provider_file_name,
  provider_file_uri,
  provider_file_mime_type,
  created_by_user_id,
  created_at,
  updated_at,
  started_at,
  finished_at
FROM annual_report_processing_runs_v1
WHERE tenant_id = ?1
  AND workspace_id = ?2
  AND id = ?3
LIMIT 1
`;

const SELECT_LATEST_RUN_SQL_V1 = `
SELECT
  id,
  tenant_id,
  workspace_id,
  source_file_name,
  source_file_type,
  source_storage_key,
  source_size_bytes,
  policy_version,
  status,
  has_previous_active_result,
  previous_active_extraction_artifact_id,
  technical_details_json,
  preview_extraction_json,
  error_json,
  degradation_json,
  runtime_json,
  result_extraction_artifact_id,
  result_tax_analysis_artifact_id,
  provider_file_name,
  provider_file_uri,
  provider_file_mime_type,
  created_by_user_id,
  created_at,
  updated_at,
  started_at,
  finished_at
FROM annual_report_processing_runs_v1
WHERE tenant_id = ?1
  AND workspace_id = ?2
ORDER BY created_at DESC, id DESC
LIMIT 1
`;

const SELECT_OPEN_RUNS_SQL_V1 = `
SELECT
  id,
  tenant_id,
  workspace_id,
  source_file_name,
  source_file_type,
  source_storage_key,
  source_size_bytes,
  policy_version,
  status,
  has_previous_active_result,
  previous_active_extraction_artifact_id,
  technical_details_json,
  preview_extraction_json,
  error_json,
  degradation_json,
  runtime_json,
  result_extraction_artifact_id,
  result_tax_analysis_artifact_id,
  provider_file_name,
  provider_file_uri,
  provider_file_mime_type,
  created_by_user_id,
  created_at,
  updated_at,
  started_at,
  finished_at
FROM annual_report_processing_runs_v1
WHERE tenant_id = ?1
  AND workspace_id = ?2
  AND status IN (
    'queued',
    'uploading_source',
    'locating_sections',
    'extracting_core_facts',
    'extracting_statements',
    'extracting_tax_notes',
    'running_tax_analysis'
  )
ORDER BY created_at DESC, id DESC
`;

function toErrorMessageV1(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown persistence error.";
}

function serializeJsonV1(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  return JSON.stringify(value);
}

function mapRowToRecordV1(
  row: AnnualReportProcessingRunRowV1,
): AnnualReportProcessingRunRecordV1 {
  const previewExtraction = row.preview_extraction_json
    ? parseAnnualReportExtractionPayloadV1(
        JSON.parse(row.preview_extraction_json),
      )
    : undefined;
  const runtime = row.runtime_json
    ? parseAnnualReportProcessingRunV1({
        schemaVersion: "annual_report_processing_run_v1",
        runId: row.id,
        tenantId: row.tenant_id,
        workspaceId: row.workspace_id,
        sourceFileName: row.source_file_name,
        sourceFileType: row.source_file_type,
        status: row.status,
        statusMessage: "placeholder",
        technicalDetails: [],
        runtime: JSON.parse(row.runtime_json),
        hasPreviousActiveResult: row.has_previous_active_result === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }).runtime
    : undefined;
  const parsed = parseAnnualReportProcessingRunV1({
    schemaVersion: "annual_report_processing_run_v1",
    runId: row.id,
    tenantId: row.tenant_id,
    workspaceId: row.workspace_id,
    sourceFileName: row.source_file_name,
    sourceFileType: row.source_file_type,
    status: row.status,
    statusMessage: "placeholder",
    technicalDetails: JSON.parse(row.technical_details_json),
    error: row.error_json ? JSON.parse(row.error_json) : undefined,
    degradation: row.degradation_json ? JSON.parse(row.degradation_json) : undefined,
    previewExtraction,
    result: {
      extractionArtifactId: row.result_extraction_artifact_id ?? undefined,
      taxAnalysisArtifactId: row.result_tax_analysis_artifact_id ?? undefined,
    },
    runtime,
    hasPreviousActiveResult: row.has_previous_active_result === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    createdByUserId: row.created_by_user_id ?? undefined,
  });

  return {
    id: parsed.runId,
    tenantId: parsed.tenantId,
    workspaceId: parsed.workspaceId,
    sourceFileName: parsed.sourceFileName,
    sourceFileType: parsed.sourceFileType,
    sourceStorageKey: row.source_storage_key,
    sourceSizeBytes: row.source_size_bytes,
    policyVersion: row.policy_version,
    status: parsed.status,
    hasPreviousActiveResult: parsed.hasPreviousActiveResult,
    previousActiveExtractionArtifactId:
      row.previous_active_extraction_artifact_id ?? undefined,
    technicalDetails: parsed.technicalDetails,
    previewExtraction: parsed.previewExtraction,
    error: parsed.error,
    degradation: parsed.degradation,
    runtime: parsed.runtime,
    resultExtractionArtifactId:
      row.result_extraction_artifact_id ?? undefined,
    resultTaxAnalysisArtifactId:
      row.result_tax_analysis_artifact_id ?? undefined,
    providerFile:
      row.provider_file_name && row.provider_file_uri && row.provider_file_mime_type
        ? {
            name: row.provider_file_name,
            uri: row.provider_file_uri,
            mimeType: row.provider_file_mime_type,
          }
        : undefined,
    createdByUserId: row.created_by_user_id ?? undefined,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
    startedAt: parsed.startedAt,
    finishedAt: parsed.finishedAt,
  };
}

function toDbValuesV1(run: AnnualReportProcessingRunRecordV1) {
  return [
    run.id,
    run.tenantId,
    run.workspaceId,
    run.sourceFileName,
    run.sourceFileType,
    run.sourceStorageKey,
    run.sourceSizeBytes,
    run.policyVersion,
    run.status,
    run.hasPreviousActiveResult ? 1 : 0,
    run.previousActiveExtractionArtifactId ?? null,
    JSON.stringify(run.technicalDetails),
    serializeJsonV1(run.previewExtraction),
    serializeJsonV1(run.error),
    serializeJsonV1(run.degradation),
    serializeJsonV1(run.runtime),
    run.resultExtractionArtifactId ?? null,
    run.resultTaxAnalysisArtifactId ?? null,
    run.providerFile?.name ?? null,
    run.providerFile?.uri ?? null,
    run.providerFile?.mimeType ?? null,
    run.createdByUserId ?? null,
    run.createdAt,
    run.updatedAt,
    run.startedAt ?? null,
    run.finishedAt ?? null,
  ] as const;
}

async function workspaceExistsV1(input: {
  db: D1Database;
  tenantId: string;
  workspaceId: string;
}): Promise<boolean> {
  const row = await input.db
    .prepare(SELECT_WORKSPACE_EXISTS_SQL_V1)
    .bind(input.tenantId, input.workspaceId)
    .first<WorkspaceExistsRowV1>();
  return Boolean(row?.id);
}

export function isOpenAnnualReportProcessingRunStatusV1(
  status: AnnualReportProcessingRunStatusV1,
): boolean {
  return OPEN_RUN_STATUS_SET_V1.has(status);
}

export function createD1AnnualReportProcessingRunRepositoryV1(
  db: D1Database,
): AnnualReportProcessingRunRepositoryV1 {
  async function create(
    run: AnnualReportProcessingRunRecordV1,
  ): Promise<
    AnnualReportProcessingRunRepositoryResultV1<
      AnnualReportProcessingRunRecordV1
    >
  > {
    if (
      !(await workspaceExistsV1({
        db,
        tenantId: run.tenantId,
        workspaceId: run.workspaceId,
      }))
    ) {
      return {
        ok: false,
        code: "WORKSPACE_NOT_FOUND",
        message: "Workspace does not exist for tenant and workspace ID.",
      };
    }

    try {
      await db.prepare(INSERT_RUN_SQL_V1).bind(...toDbValuesV1(run)).run();
      return {
        ok: true,
        value: run,
      };
    } catch (error) {
      return {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: toErrorMessageV1(error),
      };
    }
  }

  async function getById(input: {
    runId: string;
    tenantId: string;
    workspaceId: string;
  }): Promise<AnnualReportProcessingRunRecordV1 | null> {
    const row = await db
      .prepare(SELECT_RUN_BY_ID_SQL_V1)
      .bind(input.tenantId, input.workspaceId, input.runId)
      .first<AnnualReportProcessingRunRowV1>();
    return row ? mapRowToRecordV1(row) : null;
  }

  async function getLatestByWorkspace(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<AnnualReportProcessingRunRecordV1 | null> {
    const row = await db
      .prepare(SELECT_LATEST_RUN_SQL_V1)
      .bind(input.tenantId, input.workspaceId)
      .first<AnnualReportProcessingRunRowV1>();
    return row ? mapRowToRecordV1(row) : null;
  }

  async function listOpenByWorkspace(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<AnnualReportProcessingRunRecordV1[]> {
    const rows = await db
      .prepare(SELECT_OPEN_RUNS_SQL_V1)
      .bind(input.tenantId, input.workspaceId)
      .all<AnnualReportProcessingRunRowV1>();
    return (rows.results ?? []).map(mapRowToRecordV1);
  }

  async function save(
    run: AnnualReportProcessingRunRecordV1,
  ): Promise<
    AnnualReportProcessingRunRepositoryResultV1<
      AnnualReportProcessingRunRecordV1
    >
  > {
    try {
      const result = await db
        .prepare(UPDATE_RUN_SQL_V1)
        .bind(
          run.sourceFileName,
          run.sourceFileType,
          run.sourceStorageKey,
          run.sourceSizeBytes,
          run.policyVersion,
          run.status,
          run.hasPreviousActiveResult ? 1 : 0,
          run.previousActiveExtractionArtifactId ?? null,
          JSON.stringify(run.technicalDetails),
          serializeJsonV1(run.previewExtraction),
          serializeJsonV1(run.error),
          serializeJsonV1(run.degradation),
          serializeJsonV1(run.runtime),
          run.resultExtractionArtifactId ?? null,
          run.resultTaxAnalysisArtifactId ?? null,
          run.providerFile?.name ?? null,
          run.providerFile?.uri ?? null,
          run.providerFile?.mimeType ?? null,
          run.createdByUserId ?? null,
          run.createdAt,
          run.updatedAt,
          run.startedAt ?? null,
          run.finishedAt ?? null,
          run.id,
          run.tenantId,
          run.workspaceId,
        )
        .run();
      if ((result.meta?.changes ?? 0) === 0) {
        return {
          ok: false,
          code: "PROCESSING_RUN_NOT_FOUND",
          message: "Annual-report processing run does not exist.",
        };
      }

      return {
        ok: true,
        value: run,
      };
    } catch (error) {
      return {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: toErrorMessageV1(error),
      };
    }
  }

  return {
    create,
    getById,
    getLatestByWorkspace,
    listOpenByWorkspace,
    save,
  };
}
