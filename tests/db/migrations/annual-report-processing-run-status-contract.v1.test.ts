import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import workspaceAuditMigrationSql from "../../../src/db/migrations/0001_workspace_audit_v1.sql?raw";
import annualReportProcessingRunStatusContractMigrationSql from "../../../src/db/migrations/0011_annual_report_processing_run_status_contract_v1.sql?raw";

const TENANT_ID = "7a000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "7a000000-0000-4000-8000-000000000002";
const COMPANY_ID = "7a000000-0000-4000-8000-000000000003";

function splitSqlStatementsV1(migrationSql: string): string[] {
  return migrationSql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function runMigrationSqlV1(migrationSql: string): Promise<void> {
  for (const statement of splitSqlStatementsV1(migrationSql)) {
    await env.DB.prepare(statement).run();
  }
}

async function insertProcessingRunRowV1(input: {
  id: string;
  status: string;
}): Promise<void> {
  await env.DB.prepare(
    `
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
        technical_details_json,
        created_at,
        updated_at,
        degradation_json
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
    `,
  )
    .bind(
      input.id,
      TENANT_ID,
      WORKSPACE_ID,
      "annual-report.pdf",
      "pdf",
      `annual-report-source/${input.id}`,
      1024,
      "annual-report-manual-first.v1",
      input.status,
      0,
      "[]",
      "2026-03-07T10:00:00.000Z",
      "2026-03-07T10:00:00.000Z",
      null,
    )
    .run();
}

const LEGACY_PROCESSING_RUNS_TABLE_SQL_V1 = `
CREATE TABLE annual_report_processing_runs_v1 (
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
      'extracting_core_financials',
      'extracting_note_context',
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
  degradation_json TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces (id)
);
`;

describe("annual-report processing run status contract migration v1", () => {
  it("remaps legacy statuses and accepts canonical status writes", async () => {
    await runMigrationSqlV1(workspaceAuditMigrationSql);

    await env.DB.prepare("DROP TABLE IF EXISTS annual_report_processing_runs_v1_next").run();
    await env.DB.prepare("DROP TABLE IF EXISTS annual_report_processing_runs_v1").run();
    await env.DB.prepare(LEGACY_PROCESSING_RUNS_TABLE_SQL_V1).run();

    await env.DB.prepare("DELETE FROM workspaces WHERE id = ?1")
      .bind(WORKSPACE_ID)
      .run();
    await env.DB.prepare(
      `
        INSERT INTO workspaces (
          id,
          tenant_id,
          company_id,
          fiscal_year_start,
          fiscal_year_end,
          status,
          created_at,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `,
    )
      .bind(
        WORKSPACE_ID,
        TENANT_ID,
        COMPANY_ID,
        "2025-01-01",
        "2025-12-31",
        "draft",
        "2026-03-07T09:59:00.000Z",
        "2026-03-07T09:59:00.000Z",
      )
      .run();

    await insertProcessingRunRowV1({
      id: "7a000000-0000-4000-8000-000000000011",
      status: "extracting_core_financials",
    });
    await insertProcessingRunRowV1({
      id: "7a000000-0000-4000-8000-000000000012",
      status: "extracting_note_context",
    });

    await runMigrationSqlV1(
      annualReportProcessingRunStatusContractMigrationSql,
    );

    const remappedRows = await env.DB.prepare(
      `
        SELECT id, status
        FROM annual_report_processing_runs_v1
        WHERE id IN (?1, ?2)
        ORDER BY id
      `,
    )
      .bind(
        "7a000000-0000-4000-8000-000000000011",
        "7a000000-0000-4000-8000-000000000012",
      )
      .all<{ id: string; status: string }>();

    expect(remappedRows.results).toEqual([
      {
        id: "7a000000-0000-4000-8000-000000000011",
        status: "extracting_core_facts",
      },
      {
        id: "7a000000-0000-4000-8000-000000000012",
        status: "extracting_tax_notes",
      },
    ]);

    await expect(
      insertProcessingRunRowV1({
        id: "7a000000-0000-4000-8000-000000000013",
        status: "locating_sections",
      }),
    ).resolves.toBeUndefined();

    await expect(
      insertProcessingRunRowV1({
        id: "7a000000-0000-4000-8000-000000000014",
        status: "extracting_core_financials",
      }),
    ).rejects.toThrow(/CHECK constraint failed/i);
  });
});
