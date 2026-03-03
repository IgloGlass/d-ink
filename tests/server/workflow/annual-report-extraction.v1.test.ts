import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1AuditRepositoryV1 } from "../../../src/db/repositories/audit.repository.v1";
import { createD1WorkspaceArtifactRepositoryV1 } from "../../../src/db/repositories/workspace-artifact.repository.v1";
import { createD1WorkspaceRepositoryV1 } from "../../../src/db/repositories/workspace.repository.v1";
import { MAX_ANNUAL_REPORT_FILE_BYTES_V1 } from "../../../src/server/security/payload-limits.v1";
import {
  type AnnualReportExtractionDepsV1,
  applyAnnualReportExtractionOverridesV1,
  confirmAnnualReportExtractionV1,
  getActiveAnnualReportExtractionV1,
  runAnnualReportExtractionV1,
} from "../../../src/server/workflow/annual-report-extraction.v1";
import { applyWorkspaceAuditSchemaForTests } from "../../db/test-schema";

const TENANT_ID = "9d000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "9d000000-0000-4000-8000-000000000002";
const COMPANY_ID = "9d000000-0000-4000-8000-000000000003";
const USER_ID = "9d000000-0000-4000-8000-000000000004";

async function seedWorkspace(): Promise<void> {
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
      "2026-03-03T12:00:00.000Z",
      "2026-03-03T12:00:00.000Z",
    )
    .run();
}

function toBase64(input: string): string {
  return btoa(input);
}

function createDeps(): AnnualReportExtractionDepsV1 {
  return {
    artifactRepository: createD1WorkspaceArtifactRepositoryV1(env.DB),
    auditRepository: createD1AuditRepositoryV1(env.DB),
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => "2026-03-03T12:10:00.000Z",
  };
}

describe("annual report extraction workflow v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("runs extraction, applies overrides, and confirms with version increments", async () => {
    await seedWorkspace();
    const deps = createDeps();
    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: toBase64(`
          Company Name: Acme AB
          Org nr: 556677-8899
          Fiscal year: 2025-01-01 to 2025-12-31
          K2
          Resultat före skatt: 1 000 000
        `),
        policyVersion: "annual-report-manual-first.v1",
        createdByUserId: USER_ID,
      },
      deps,
    );

    expect(runResult.ok).toBe(true);
    if (!runResult.ok) {
      return;
    }
    expect(runResult.active.version).toBe(1);

    const overrideResult = await applyAnnualReportExtractionOverridesV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: runResult.active.artifactId,
          version: runResult.active.version,
        },
        overrides: [
          {
            fieldKey: "profitBeforeTax",
            value: 1200000,
            reason: "Corrected based on signed report",
          },
        ],
        authorUserId: USER_ID,
      },
      deps,
    );

    expect(overrideResult.ok).toBe(true);
    if (!overrideResult.ok) {
      return;
    }
    expect(overrideResult.active.version).toBe(2);
    expect(overrideResult.extraction.confirmation.isConfirmed).toBe(false);

    const confirmResult = await confirmAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: overrideResult.active.artifactId,
          version: overrideResult.active.version,
        },
        confirmedByUserId: USER_ID,
      },
      deps,
    );
    expect(confirmResult.ok).toBe(true);
    if (!confirmResult.ok) {
      return;
    }
    expect(confirmResult.active.version).toBe(3);
    expect(confirmResult.extraction.confirmation.isConfirmed).toBe(true);
  });

  it("fails confirmation if required fields are missing", async () => {
    await seedWorkspace();
    const deps = createDeps();
    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: toBase64("Company Name: Acme AB"),
        policyVersion: "annual-report-manual-first.v1",
      },
      deps,
    );
    if (!runResult.ok) {
      throw new Error("Expected run success");
    }

    const confirmResult = await confirmAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: runResult.active.artifactId,
          version: runResult.active.version,
        },
        confirmedByUserId: USER_ID,
      },
      deps,
    );
    expect(confirmResult.ok).toBe(false);
    if (!confirmResult.ok) {
      expect(confirmResult.error.code).toBe("INPUT_INVALID");
    }
  });

  it("loads active extraction payload", async () => {
    await seedWorkspace();
    const deps = createDeps();
    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: toBase64("Company Name: Acme AB"),
        policyVersion: "annual-report-manual-first.v1",
      },
      deps,
    );
    if (!runResult.ok) {
      throw new Error("Expected run success");
    }

    const active = await getActiveAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(active.ok).toBe(true);
  });

  it("rejects oversized annual report payloads deterministically", async () => {
    await seedWorkspace();
    const deps = createDeps();
    const oversizedBytes = "A".repeat(MAX_ANNUAL_REPORT_FILE_BYTES_V1 + 1);

    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: btoa(oversizedBytes),
        policyVersion: "annual-report-manual-first.v1",
      },
      deps,
    );

    expect(runResult.ok).toBe(false);
    if (!runResult.ok) {
      expect(runResult.error.code).toBe("INPUT_INVALID");
      expect(runResult.error.context.reason).toBe("payload_too_large");
    }
  });
});
