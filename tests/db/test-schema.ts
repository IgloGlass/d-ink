import { env } from "cloudflare:test";

import workspaceAuditMigrationSql from "../../src/db/migrations/0001_workspace_audit_v1.sql?raw";
import authMagicLinkMigrationSql from "../../src/db/migrations/0002_auth_magic_link_v1.sql?raw";
import tbPipelineArtifactsMigrationSql from "../../src/db/migrations/0003_tb_pipeline_artifacts_v1.sql?raw";
import mappingPreferencesMigrationSql from "../../src/db/migrations/0004_mapping_preferences_v1.sql?raw";

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
  ];

  for (const migrationSql of migrationSqlList) {
    const statements = splitSqlStatements(migrationSql);

    for (const statement of statements) {
      await env.DB.prepare(statement).run();
    }
  }
}
