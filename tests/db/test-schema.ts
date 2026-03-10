import { env } from "cloudflare:test";

import workspaceAuditMigrationSql from "../../src/db/migrations/0001_workspace_audit_v1.sql?raw";
import authMagicLinkMigrationSql from "../../src/db/migrations/0002_auth_magic_link_v1.sql?raw";
import tbPipelineArtifactsMigrationSql from "../../src/db/migrations/0003_tb_pipeline_artifacts_v1.sql?raw";
import mappingPreferencesMigrationSql from "../../src/db/migrations/0004_mapping_preferences_v1.sql?raw";
import coreTaxModulesMigrationSql from "../../src/db/migrations/0005_core_tax_modules_v1.sql?raw";
import companiesMigrationSql from "../../src/db/migrations/0006_companies_v1.sql?raw";
import workspaceArtifactTaxAnalysisMigrationSql from "../../src/db/migrations/0007_workspace_artifact_tax_analysis_v1.sql?raw";
import annualReportProcessingRunsMigrationSql from "../../src/db/migrations/0008_annual_report_processing_runs_v1.sql?raw";
import annualReportUploadSessionsMigrationSql from "../../src/db/migrations/0009_annual_report_upload_sessions_v1.sql?raw";
import annualReportProcessingRunDegradationMigrationSql from "../../src/db/migrations/0010_annual_report_processing_run_degradation_v1.sql?raw";
import annualReportProcessingRunStatusContractMigrationSql from "../../src/db/migrations/0011_annual_report_processing_run_status_contract_v1.sql?raw";

function splitSqlStatements(migrationSql: string): string[] {
  return migrationSql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

/**
 * Applies real migration SQL for D1-backed tests.
 */
export async function applyWorkspaceAuditSchemaForTests(): Promise<void> {
  const migrationSqlList = [
    workspaceAuditMigrationSql,
    authMagicLinkMigrationSql,
    tbPipelineArtifactsMigrationSql,
    mappingPreferencesMigrationSql,
    coreTaxModulesMigrationSql,
    companiesMigrationSql,
    workspaceArtifactTaxAnalysisMigrationSql,
    annualReportProcessingRunsMigrationSql,
    annualReportUploadSessionsMigrationSql,
    annualReportProcessingRunDegradationMigrationSql,
    annualReportProcessingRunStatusContractMigrationSql,
  ];

  for (const migrationSql of migrationSqlList) {
    const statements = splitSqlStatements(migrationSql);

    for (const statement of statements) {
      await env.DB.prepare(statement).run();
    }
  }
}
