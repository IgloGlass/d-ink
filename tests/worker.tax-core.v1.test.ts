import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { createD1WorkspaceArtifactRepositoryV1 } from "../src/db/repositories/workspace-artifact.repository.v1";
import { hashTokenWithHmacV1 } from "../src/server/workflow/auth-magic-link.v1";
import {
  AUDIT_EVENT_TYPES_V1,
} from "../src/shared/audit/audit-event-catalog.v1";
import { parseAnnualReportExtractionPayloadV1 } from "../src/shared/contracts/annual-report-extraction.v1";
import type { Env } from "../src/shared/types/env";
import worker from "../src/worker";
import { applyWorkspaceAuditSchemaForTests } from "./db/test-schema";

const APP_BASE_URL = "https://app.dink.test";
const AUTH_TOKEN_HMAC_SECRET = "test-auth-token-secret";
const TENANT_ID = "af000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "af000000-0000-4000-8000-000000000002";
const COMPANY_ID = "af000000-0000-4000-8000-000000000003";
const USER_ID = "af000000-0000-4000-8000-000000000004";
const SESSION_TOKEN = "tax-core-session";

function buildWorkerEnv(): Env {
  return {
    DB: env.DB,
    AUTH_TOKEN_HMAC_SECRET,
    APP_BASE_URL,
  };
}

function buildJsonRequest(input: {
  body?: unknown;
  cookie?: string;
  method: "GET" | "POST";
  url: string;
}): Request {
  const headers = new Headers();
  if (input.method === "POST") {
    headers.set("Content-Type", "application/json");
  }
  if (input.cookie) {
    headers.set("Cookie", input.cookie);
  }
  return new Request(input.url, {
    method: input.method,
    headers,
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
}

function buildSessionCookie(token: string): string {
  return `dink_session_v1=${token}`;
}

async function assertStatusV1(input: {
  expected: number;
  label: string;
  response: Response;
}): Promise<void> {
  if (input.response.status === input.expected) {
    return;
  }

  throw new Error(
    `${input.label} failed: expected ${input.expected}, got ${input.response.status}.`,
  );
}

async function seedSessionAndWorkspace(): Promise<void> {
  const nowIso = "2026-03-03T18:00:00.000Z";
  const sessionTokenHash = await hashTokenWithHmacV1(
    AUTH_TOKEN_HMAC_SECRET,
    SESSION_TOKEN,
  );

  await env.DB.prepare(
    `
      INSERT INTO users (id, email_normalized, created_at)
      VALUES (?1, ?2, ?3)
    `,
  )
    .bind(USER_ID, "tax-core-user@example.com", nowIso)
    .run();
  await env.DB.prepare(
    `
      INSERT INTO tenant_memberships (
        id,
        tenant_id,
        user_id,
        role,
        created_at,
        updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `,
  )
    .bind(crypto.randomUUID(), TENANT_ID, USER_ID, "Admin", nowIso, nowIso)
    .run();
  await env.DB.prepare(
    `
      INSERT INTO auth_sessions (
        id,
        tenant_id,
        user_id,
        token_hash,
        created_at,
        expires_at,
        revoked_at,
        last_seen_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?5)
    `,
  )
    .bind(
      crypto.randomUUID(),
      TENANT_ID,
      USER_ID,
      sessionTokenHash,
      nowIso,
      "2099-03-04T18:00:00.000Z",
    )
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
      nowIso,
      nowIso,
    )
    .run();
}

function createWorkbookBase64V1(): string {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Account Name", "Account Number", "Opening Balance", "Closing Balance"],
    ["Representation external ej avdragsgill", "6072", "0", "1000"],
    ["Bankkonto", "1930", "0", "-1000"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Trial Balance");
  const bytes = new Uint8Array(
    XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    }),
  );
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function seedConfirmedAnnualReportExtractionV1(): Promise<void> {
  const repository = createD1WorkspaceArtifactRepositoryV1(env.DB);
  const extraction = parseAnnualReportExtractionPayloadV1({
    schemaVersion: "annual_report_extraction_v1",
    sourceFileName: "annual-report.pdf",
    sourceFileType: "pdf",
    policyVersion: "annual-report-manual-first.v1",
    fields: {
      companyName: { status: "extracted", confidence: 0.99, value: "Acme AB" },
      organizationNumber: {
        status: "extracted",
        confidence: 0.99,
        value: "556677-8899",
      },
      fiscalYearStart: {
        status: "extracted",
        confidence: 0.99,
        value: "2025-01-01",
      },
      fiscalYearEnd: {
        status: "extracted",
        confidence: 0.99,
        value: "2025-12-31",
      },
      accountingStandard: {
        status: "extracted",
        confidence: 0.99,
        value: "K2",
      },
      profitBeforeTax: {
        status: "extracted",
        confidence: 0.99,
        value: 1000000,
      },
    },
    summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
    taxSignals: [],
    documentWarnings: [],
    taxDeep: {
      ink2rExtracted: {
        incomeStatement: [
          {
            code: "profit-before-tax",
            label: "Resultat fore skatt",
            currentYearValue: 1000000,
            evidence: [],
          },
        ],
        balanceSheet: [
          {
            code: "total-assets",
            label: "Summa tillgangar",
            currentYearValue: 5000000,
            evidence: [],
          },
        ],
      },
      depreciationContext: { assetAreas: [], evidence: [] },
      assetMovements: { lines: [], evidence: [] },
      reserveContext: { movements: [], notes: [], evidence: [] },
      netInterestContext: { notes: [], evidence: [] },
      pensionContext: { flags: [], notes: [], evidence: [] },
      leasingContext: { flags: [], notes: [], evidence: [] },
      groupContributionContext: { flags: [], notes: [], evidence: [] },
      shareholdingContext: { flags: [], notes: [], evidence: [] },
      priorYearComparatives: [],
    },
    confirmation: {
      isConfirmed: true,
      confirmedAt: "2026-03-03T18:05:00.000Z",
      confirmedByUserId: USER_ID,
    },
  });

  const write = await repository.appendAnnualReportExtractionAndSetActive({
    artifactId: crypto.randomUUID(),
    tenantId: TENANT_ID,
    workspaceId: WORKSPACE_ID,
    createdAt: "2026-03-03T18:05:00.000Z",
    createdByUserId: USER_ID,
    extraction,
  });
  if (!write.ok) {
    throw new Error(`Failed to seed annual-report extraction: ${write.message}`);
  }
}

describe("worker tax core routes v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
    await seedSessionAndWorkspace();
    await seedConfirmedAnnualReportExtractionV1();
  });

  it("runs deterministic tax-core chain and collaboration endpoints", async () => {
    const cookie = buildSessionCookie(SESSION_TOKEN);
    const workerEnv = buildWorkerEnv();

    const parseFailedTbRun = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tb-pipeline-runs`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          fileName: "tb-invalid.xlsx",
          fileBytesBase64: btoa("invalid file bytes"),
          policyVersion: "deterministic-bas.v1",
        },
      }),
      workerEnv,
    );
    await assertStatusV1({
      expected: 400,
      label: "parseFailedTbRun",
      response: parseFailedTbRun,
    });

    const tbRun = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tb-pipeline-runs`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          fileName: "tb.xlsx",
          fileBytesBase64: createWorkbookBase64V1(),
          policyVersion: "deterministic-bas.v1",
        },
      }),
      buildWorkerEnv(),
    );
    await assertStatusV1({ expected: 200, label: "tbRun", response: tbRun });
    const tbRunPayload = (await tbRun.json()) as {
      ok: true;
      pipeline: {
        artifacts: { mapping: { artifactId: string; version: number } };
      };
    };
    expect(tbRunPayload.ok).toBe(true);

    const adjustmentsRun = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tax-adjustment-runs`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          policyVersion: "tax-adjustments.v1",
        },
      }),
      buildWorkerEnv(),
    );
    const adjustmentsPayload = (await adjustmentsRun.json()) as {
      ok: true;
      adjustments: { decisions: Array<{ amount: number; id: string }> };
    };
    await assertStatusV1({
      expected: 200,
      label: "adjustmentsRun",
      response: adjustmentsRun,
    });
    expect(adjustmentsPayload.ok).toBe(true);

    const summaryRun = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tax-summary-runs`,
        cookie,
        body: { tenantId: TENANT_ID },
      }),
      buildWorkerEnv(),
    );
    await assertStatusV1({
      expected: 200,
      label: "summaryRun",
      response: summaryRun,
    });

    const ink2Run = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/ink2-form-runs`,
        cookie,
        body: { tenantId: TENANT_ID },
      }),
      buildWorkerEnv(),
    );
    await assertStatusV1({
      expected: 200,
      label: "ink2Run",
      response: ink2Run,
    });
    const ink2Payload = (await ink2Run.json()) as {
      ok: true;
      form: { fields: Array<{ amount: number; fieldId: string }> };
    };
    expect(ink2Payload.ok).toBe(true);

    const transitionTo = async (
      toStatus: "approved_for_export" | "in_review" | "ready_for_approval",
    ): Promise<void> => {
      const transitionResponse = await worker.fetch(
        buildJsonRequest({
          method: "POST",
          url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/transitions`,
          cookie,
          body: {
            tenantId: TENANT_ID,
            toStatus,
          },
        }),
        buildWorkerEnv(),
      );
      await assertStatusV1({
        expected: 200,
        label: `transition:${toStatus}`,
        response: transitionResponse,
      });
    };
    await transitionTo("in_review");
    await transitionTo("ready_for_approval");
    await transitionTo("approved_for_export");

    const exportRun = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/exports/pdf`,
        cookie,
        body: { tenantId: TENANT_ID },
      }),
      buildWorkerEnv(),
    );
    await assertStatusV1({
      expected: 200,
      label: "exportRun",
      response: exportRun,
    });

    const commentCreate = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/comments`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          body: "Please review final tax summary",
        },
      }),
      buildWorkerEnv(),
    );
    await assertStatusV1({
      expected: 201,
      label: "commentCreate",
      response: commentCreate,
    });

    const taskCreate = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tasks`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          title: "Approve export",
        },
      }),
      buildWorkerEnv(),
    );
    await assertStatusV1({
      expected: 201,
      label: "taskCreate",
      response: taskCreate,
    });
    const taskCreatePayload = (await taskCreate.json()) as {
      ok: true;
      task: { id: string };
    };

    const completeTask = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tasks/${taskCreatePayload.task.id}/complete`,
        cookie,
        body: { tenantId: TENANT_ID },
      }),
      buildWorkerEnv(),
    );
    await assertStatusV1({
      expected: 200,
      label: "completeTask",
      response: completeTask,
    });

    const auditRows = await env.DB.prepare(
      `
        SELECT event_type, before_json, after_json
        FROM audit_events
        WHERE tenant_id = ?1 AND workspace_id = ?2
      `,
    )
      .bind(TENANT_ID, WORKSPACE_ID)
      .all<{
        after_json: string | null;
        before_json: string | null;
        event_type: string;
      }>();
    const eventTypes = (auditRows.results ?? []).map((row) => row.event_type);

    expect(eventTypes).toContain(AUDIT_EVENT_TYPES_V1.MAPPING_GENERATED);
    expect(eventTypes).toContain(AUDIT_EVENT_TYPES_V1.ADJUSTMENT_GENERATED);
    expect(eventTypes).toContain(AUDIT_EVENT_TYPES_V1.SUMMARY_GENERATED);
    expect(eventTypes).toContain(AUDIT_EVENT_TYPES_V1.FORM_POPULATED);
    expect(eventTypes).toContain(AUDIT_EVENT_TYPES_V1.EXPORT_CREATED);
    expect(eventTypes).toContain(AUDIT_EVENT_TYPES_V1.COMMENT_CREATED);
    expect(eventTypes).toContain(AUDIT_EVENT_TYPES_V1.TASK_CREATED);

    const completedTaskAudit = (auditRows.results ?? []).find(
      (row) => row.event_type === AUDIT_EVENT_TYPES_V1.TASK_COMPLETED,
    );
    expect(completedTaskAudit?.before_json).not.toBeNull();
    expect(completedTaskAudit?.after_json).not.toBeNull();
  });
});
