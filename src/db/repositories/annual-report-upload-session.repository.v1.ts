import {
  type AnnualReportUploadFileTypeV1,
  type AnnualReportUploadSessionStatusV1,
} from "../../shared/contracts/annual-report-upload-session.v1";
import type { D1Database } from "../../shared/types/d1";

export type AnnualReportUploadSessionRecordV1 = {
  id: string;
  tenantId: string;
  workspaceId: string;
  fileName: string;
  fileType: AnnualReportUploadFileTypeV1;
  fileSizeBytes: number;
  policyVersion: string;
  sourceStorageKey: string;
  status: AnnualReportUploadSessionStatusV1;
  processingRunId?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

type AnnualReportUploadSessionRowV1 = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  file_name: string;
  file_type: AnnualReportUploadFileTypeV1;
  file_size_bytes: number;
  policy_version: string;
  source_storage_key: string;
  status: AnnualReportUploadSessionStatusV1;
  processing_run_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

export type AnnualReportUploadSessionRepositoryResultV1<TValue> =
  | {
      ok: true;
      value: TValue;
    }
  | {
      ok: false;
      code:
        | "WORKSPACE_NOT_FOUND"
        | "UPLOAD_SESSION_NOT_FOUND"
        | "PERSISTENCE_ERROR";
      message: string;
    };

export interface AnnualReportUploadSessionRepositoryV1 {
  create(
    session: AnnualReportUploadSessionRecordV1,
  ): Promise<
    AnnualReportUploadSessionRepositoryResultV1<AnnualReportUploadSessionRecordV1>
  >;
  getById(input: {
    uploadSessionId: string;
    tenantId: string;
    workspaceId: string;
  }): Promise<AnnualReportUploadSessionRecordV1 | null>;
  save(
    session: AnnualReportUploadSessionRecordV1,
  ): Promise<
    AnnualReportUploadSessionRepositoryResultV1<AnnualReportUploadSessionRecordV1>
  >;
}

const INSERT_SQL_V1 = `
INSERT INTO annual_report_upload_sessions_v1 (
  id,
  tenant_id,
  workspace_id,
  file_name,
  file_type,
  file_size_bytes,
  policy_version,
  source_storage_key,
  status,
  processing_run_id,
  created_by_user_id,
  created_at,
  updated_at,
  expires_at
)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
`;

const SELECT_SQL_V1 = `
SELECT
  id,
  tenant_id,
  workspace_id,
  file_name,
  file_type,
  file_size_bytes,
  policy_version,
  source_storage_key,
  status,
  processing_run_id,
  created_by_user_id,
  created_at,
  updated_at,
  expires_at
FROM annual_report_upload_sessions_v1
WHERE id = ?1
  AND tenant_id = ?2
  AND workspace_id = ?3
LIMIT 1
`;

const UPDATE_SQL_V1 = `
UPDATE annual_report_upload_sessions_v1
SET
  file_name = ?1,
  file_type = ?2,
  file_size_bytes = ?3,
  policy_version = ?4,
  source_storage_key = ?5,
  status = ?6,
  processing_run_id = ?7,
  created_by_user_id = ?8,
  created_at = ?9,
  updated_at = ?10,
  expires_at = ?11
WHERE id = ?12
  AND tenant_id = ?13
  AND workspace_id = ?14
`;

function mapRowV1(row: AnnualReportUploadSessionRowV1): AnnualReportUploadSessionRecordV1 {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    workspaceId: row.workspace_id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSizeBytes: row.file_size_bytes,
    policyVersion: row.policy_version,
    sourceStorageKey: row.source_storage_key,
    status: row.status,
    processingRunId: row.processing_run_id ?? undefined,
    createdByUserId: row.created_by_user_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

function toErrorMessageV1(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown persistence error.";
}

export function createD1AnnualReportUploadSessionRepositoryV1(
  database: D1Database,
): AnnualReportUploadSessionRepositoryV1 {
  return {
    async create(session) {
      try {
        await database
          .prepare(INSERT_SQL_V1)
          .bind(
            session.id,
            session.tenantId,
            session.workspaceId,
            session.fileName,
            session.fileType,
            session.fileSizeBytes,
            session.policyVersion,
            session.sourceStorageKey,
            session.status,
            session.processingRunId ?? null,
            session.createdByUserId ?? null,
            session.createdAt,
            session.updatedAt,
            session.expiresAt,
          )
          .run();

        return {
          ok: true,
          value: session,
        };
      } catch (error) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessageV1(error),
        };
      }
    },
    async getById(input) {
      const row = await database
        .prepare(SELECT_SQL_V1)
        .bind(input.uploadSessionId, input.tenantId, input.workspaceId)
        .first<AnnualReportUploadSessionRowV1>();

      return row ? mapRowV1(row) : null;
    },
    async save(session) {
      try {
        const result = await database
          .prepare(UPDATE_SQL_V1)
          .bind(
            session.fileName,
            session.fileType,
            session.fileSizeBytes,
            session.policyVersion,
            session.sourceStorageKey,
            session.status,
            session.processingRunId ?? null,
            session.createdByUserId ?? null,
            session.createdAt,
            session.updatedAt,
            session.expiresAt,
            session.id,
            session.tenantId,
            session.workspaceId,
          )
          .run();

        if ((result.meta?.changes ?? 0) === 0) {
          return {
            ok: false,
            code: "UPLOAD_SESSION_NOT_FOUND",
            message: "Annual-report upload session could not be found.",
          };
        }

        return {
          ok: true,
          value: session,
        };
      } catch (error) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessageV1(error),
        };
      }
    },
  };
}
