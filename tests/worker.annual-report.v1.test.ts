import { env } from "cloudflare:test";
import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";

import { hashTokenWithHmacV1 } from "../src/server/workflow/auth-magic-link.v1";
import type { Env } from "../src/shared/types/env";
import worker from "../src/worker";
import { applyWorkspaceAuditSchemaForTests } from "./db/test-schema";

const APP_BASE_URL = "https://app.dink.test";
const AUTH_TOKEN_HMAC_SECRET = "test-auth-token-secret";
const TENANT_ID = "9e000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "9e000000-0000-4000-8000-000000000002";
const COMPANY_ID = "9e000000-0000-4000-8000-000000000003";
const USER_ID = "9e000000-0000-4000-8000-000000000004";
const SESSION_TOKEN = "annual-report-session";
const mockStoredAnnualReports = new Map<string, Uint8Array>();
const queuedRunMessages: Array<{
  runId: string;
  tenantId: string;
  workspaceId: string;
}> = [];

function createMockAnnualReportSourceStoreV1(): NonNullable<Env["ANNUAL_REPORT_FILES"]> {
  return {
    async delete(key) {
      mockStoredAnnualReports.delete(key);
    },
    async get(key) {
      const bytes = mockStoredAnnualReports.get(key);
      if (!bytes) {
        return null;
      }

      return {
        async arrayBuffer() {
          return new Uint8Array(bytes).buffer;
        },
      };
    },
    async put(key, value) {
      if (value instanceof ReadableStream) {
        const reader = value.getReader();
        const chunks: Uint8Array[] = [];
        let totalLength = 0;
        while (true) {
          const next = await reader.read();
          if (next.done) {
            break;
          }
          chunks.push(next.value);
          totalLength += next.value.byteLength;
        }

        const buffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          buffer.set(chunk, offset);
          offset += chunk.byteLength;
        }
        mockStoredAnnualReports.set(key, buffer);
        return;
      }

      const bytes =
        typeof value === "string"
          ? new TextEncoder().encode(value)
          : value instanceof ArrayBuffer
            ? new Uint8Array(value)
            : new Uint8Array(
                value.buffer,
                value.byteOffset,
                value.byteLength,
              );
      mockStoredAnnualReports.set(key, bytes);
    },
  };
}

function buildWorkerEnv(): Env {
  return {
    DB: env.DB,
    AUTH_TOKEN_HMAC_SECRET,
    APP_BASE_URL,
    ANNUAL_REPORT_FILES: createMockAnnualReportSourceStoreV1(),
    ANNUAL_REPORT_QUEUE: {
      async send(message) {
        queuedRunMessages.push(
          message as {
            runId: string;
            tenantId: string;
            workspaceId: string;
          },
        );
        return;
      },
    },
  };
}

function buildWorkerEnvWithoutProcessingBindings(input?: {
  localFallbackEnabled?: boolean;
}): Env {
  return {
    DB: env.DB,
    AUTH_TOKEN_HMAC_SECRET,
    APP_BASE_URL:
      input?.localFallbackEnabled === true
        ? "http://localhost:5173"
        : APP_BASE_URL,
    DEV_AUTH_BYPASS_ENABLED:
      input?.localFallbackEnabled === true ? "true" : undefined,
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

function buildRawRequest(input: {
  body: BodyInit;
  contentType?: string;
  contentLength?: number;
  cookie?: string;
  method: "PUT";
  url: string;
}): Request {
  const headers = new Headers();
  if (input.cookie) {
    headers.set("Cookie", input.cookie);
  }
  if (input.contentType) {
    headers.set("Content-Type", input.contentType);
  }
  if (input.contentLength !== undefined) {
    headers.set("Content-Length", String(input.contentLength));
  }

  return new Request(input.url, {
    method: input.method,
    headers,
    body: input.body,
  });
}

function buildSessionCookie(token: string): string {
  return `dink_session_v1=${token}`;
}

async function seedSession(): Promise<void> {
  const nowIso = "2026-03-03T13:00:00.000Z";
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
    .bind(USER_ID, "annual-report-user@example.com", nowIso)
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
    .bind(crypto.randomUUID(), TENANT_ID, USER_ID, "Editor", nowIso, nowIso)
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
      "2099-03-04T13:00:00.000Z",
    )
    .run();
}

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
      "2026-03-03T13:05:00.000Z",
      "2026-03-03T13:05:00.000Z",
    )
    .run();
}

function annualTextBase64V1(): string {
  return btoa(`
    Company Name: Acme AB
    Org nr: 556677-8899
    Fiscal year: 2025-01-01 to 2025-12-31
    K2
    Resultat före skatt: 1 000 000
  `);
}

async function annualReportUploadBytesV1(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    "<w:document><w:body><w:p><w:r><w:t>Acme AB</w:t></w:r></w:p><w:p><w:r><w:t>Org nr 556677-8899</w:t></w:r></w:p><w:p><w:r><w:t>Fiscal year 2025-01-01 to 2025-12-31</w:t></w:r></w:p><w:p><w:r><w:t>K2</w:t></w:r></w:p><w:p><w:r><w:t>Resultat fore skatt 1000000</w:t></w:r></w:p></w:body></w:document>",
  );
  return zip.generateAsync({ type: "uint8array" });
}

function annualReportPdfBytesV1(): Uint8Array {
  return new TextEncoder().encode(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
  );
}

describe("worker annual report routes v1", () => {
  beforeEach(async () => {
    mockStoredAnnualReports.clear();
    queuedRunMessages.length = 0;
    await applyWorkspaceAuditSchemaForTests();
    await seedSession();
    await seedWorkspace();
  });

  async function flushAnnualReportQueueV1(workerEnv: Env): Promise<void> {
    while (queuedRunMessages.length > 0) {
      const next = queuedRunMessages.shift();
      if (!next) {
        continue;
      }
      await worker.queue(
        {
          messages: [
            {
              body: next,
              ack() {
                return;
              },
              retry() {
                throw new Error("Unexpected queue retry in test.");
              },
            },
          ],
        },
        workerEnv,
      );
    }
  }

  it("returns deprecation response for synchronous annual-report run endpoint", async () => {
    const workerEnv = buildWorkerEnv();
    const runResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-runs`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          fileName: "annual-report.pdf",
          fileBytesBase64: annualTextBase64V1(),
          policyVersion: "annual-report-manual-first.v1",
        },
      }),
      workerEnv,
    );
    expect(runResponse.status).toBe(410);
  });

  it("processes queued annual-report upload and returns active payload", async () => {
    const workerEnv = buildWorkerEnv();
    const uploadBytes = await annualReportUploadBytesV1();

    const createSessionResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-upload-sessions`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          fileName: "annual-report.docx",
          fileType: "docx",
          fileSizeBytes: uploadBytes.byteLength,
          policyVersion: "annual-report-manual-first.v1",
        },
      }),
      workerEnv,
    );
    const createSessionPayload = (await createSessionResponse.json()) as {
      ok: true;
      session: {
        uploadSessionId: string;
      };
    };
    expect(createSessionResponse.status).toBe(201);
    expect(createSessionPayload.ok).toBe(true);

    const uploadResponse = await worker.fetch(
      buildRawRequest({
        method: "PUT",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-upload-sessions/${createSessionPayload.session.uploadSessionId}/file?tenantId=${TENANT_ID}`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        contentLength: uploadBytes.byteLength,
        body: Uint8Array.from(uploadBytes).buffer,
      }),
      workerEnv,
    );
    expect(uploadResponse.status).toBe(202);
    await flushAnnualReportQueueV1(workerEnv);

    const getResponse = await worker.fetch(
      buildJsonRequest({
        method: "GET",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-extractions/active?tenantId=${TENANT_ID}`,
        cookie: buildSessionCookie(SESSION_TOKEN),
      }),
      workerEnv,
    );
    const getPayload = (await getResponse.json()) as {
      extraction: { schemaVersion: string };
      ok: true;
    };

    expect(getResponse.status).toBe(200);
    expect(getPayload.ok).toBe(true);
    expect(getPayload.extraction.schemaVersion).toBe(
      "annual_report_extraction_v1",
    );
  });

  it("persists a degraded reviewable extraction for PDF uploads when AI extraction is unavailable", async () => {
    const workerEnv = buildWorkerEnv();
    const uploadBytes = annualReportPdfBytesV1();

    const createSessionResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-upload-sessions`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          fileName: "annual-report.pdf",
          fileType: "pdf",
          fileSizeBytes: uploadBytes.byteLength,
          policyVersion: "annual-report-manual-first.v1",
        },
      }),
      workerEnv,
    );
    const createSessionPayload = (await createSessionResponse.json()) as {
      ok: true;
      session: {
        uploadSessionId: string;
      };
    };
    expect(createSessionResponse.status).toBe(201);

    const uploadResponse = await worker.fetch(
      buildRawRequest({
        method: "PUT",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-upload-sessions/${createSessionPayload.session.uploadSessionId}/file?tenantId=${TENANT_ID}`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        contentType: "application/pdf",
        contentLength: uploadBytes.byteLength,
        body: Uint8Array.from(uploadBytes).buffer,
      }),
      workerEnv,
    );
    expect(uploadResponse.status).toBe(202);
    await flushAnnualReportQueueV1(workerEnv);

    const latestRunResponse = await worker.fetch(
      buildJsonRequest({
        method: "GET",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-processing-runs/latest?tenantId=${TENANT_ID}`,
        cookie: buildSessionCookie(SESSION_TOKEN),
      }),
      workerEnv,
    );
    const latestRunPayload = (await latestRunResponse.json()) as {
      ok: true;
      run: {
        status: string;
        technicalDetails: string[];
      };
    };
    expect(latestRunResponse.status).toBe(200);
    expect(latestRunPayload.run.status).toBe("partial");
    expect(latestRunPayload.run.technicalDetails).toContain(
      "AI extraction was unavailable for this PDF. Manual review is required before continuing.",
    );

    const extractionResponse = await worker.fetch(
      buildJsonRequest({
        method: "GET",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-extractions/active?tenantId=${TENANT_ID}`,
        cookie: buildSessionCookie(SESSION_TOKEN),
      }),
      workerEnv,
    );
    const extractionPayload = (await extractionResponse.json()) as {
      ok: true;
      extraction: {
        aiRun?: { usedFallback: boolean };
        documentWarnings: string[];
        fields: {
          companyName: { status: string };
          organizationNumber: { status: string };
          fiscalYearStart: { status: string };
          fiscalYearEnd: { status: string };
          accountingStandard: { status: string };
          profitBeforeTax: { status: string };
        };
        summary: {
          autoDetectedFieldCount: number;
          needsReviewFieldCount: number;
        };
        taxDeep?: {
          ink2rExtracted: {
            incomeStatement: unknown[];
            balanceSheet: unknown[];
          };
        };
      };
    };

    expect(extractionResponse.status).toBe(200);
    expect(extractionPayload.extraction.aiRun?.usedFallback).toBe(true);
    expect(extractionPayload.extraction.summary.autoDetectedFieldCount).toBe(0);
    expect(extractionPayload.extraction.summary.needsReviewFieldCount).toBe(6);
    expect(extractionPayload.extraction.fields.companyName.status).toBe(
      "needs_review",
    );
    expect(extractionPayload.extraction.fields.organizationNumber.status).toBe(
      "needs_review",
    );
    expect(extractionPayload.extraction.fields.fiscalYearStart.status).toBe(
      "needs_review",
    );
    expect(extractionPayload.extraction.fields.fiscalYearEnd.status).toBe(
      "needs_review",
    );
    expect(extractionPayload.extraction.fields.accountingStandard.status).toBe(
      "needs_review",
    );
    expect(extractionPayload.extraction.fields.profitBeforeTax.status).toBe(
      "needs_review",
    );
    expect(extractionPayload.extraction.documentWarnings).toContain(
      "AI extraction was unavailable for this PDF. Manual review is required before continuing.",
    );
    expect(
      extractionPayload.extraction.taxDeep?.ink2rExtracted.incomeStatement ?? [],
    ).toEqual([]);
    expect(
      extractionPayload.extraction.taxDeep?.ink2rExtracted.balanceSheet ?? [],
    ).toEqual([]);
  });

  it("clears active annual-report data after upload", async () => {
    const workerEnv = buildWorkerEnv();
    const uploadBytes = await annualReportUploadBytesV1();
    const createSessionResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-upload-sessions`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          fileName: "annual-report.docx",
          fileType: "docx",
          fileSizeBytes: uploadBytes.byteLength,
          policyVersion: "annual-report-manual-first.v1",
        },
      }),
      workerEnv,
    );
    const createSessionPayload = (await createSessionResponse.json()) as {
      ok: true;
      session: { uploadSessionId: string };
    };
    expect(createSessionResponse.status).toBe(201);
    expect(createSessionPayload.ok).toBe(true);

    const uploadResponse = await worker.fetch(
      buildRawRequest({
        method: "PUT",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-upload-sessions/${createSessionPayload.session.uploadSessionId}/file?tenantId=${TENANT_ID}`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        contentLength: uploadBytes.byteLength,
        body: Uint8Array.from(uploadBytes).buffer,
      }),
      workerEnv,
    );
    expect(uploadResponse.status).toBe(202);
    await flushAnnualReportQueueV1(workerEnv);

    const clearResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-extractions/clear`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
        },
      }),
      workerEnv,
    );
    const clearPayload = (await clearResponse.json()) as {
      clearedArtifactTypes: string[];
      ok: true;
    };

    expect(clearResponse.status).toBe(200);
    expect(clearPayload.ok).toBe(true);
    expect(clearPayload.clearedArtifactTypes).toContain(
      "annual_report_extraction",
    );
  });

  it("creates an annual-report upload session and accepts raw file upload", async () => {
    const uploadBytes = await annualReportUploadBytesV1();
    const createSessionResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-upload-sessions`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          fileName: "annual-report.docx",
          fileType: "docx",
          fileSizeBytes: uploadBytes.byteLength,
          policyVersion: "annual-report-manual-first.v1",
        },
      }),
      buildWorkerEnv(),
    );
    const createSessionPayload = (await createSessionResponse.json()) as {
      ok: true;
      session: {
        uploadSessionId: string;
      };
    };

    expect(createSessionResponse.status).toBe(201);
    expect(createSessionPayload.ok).toBe(true);

    const uploadResponse = await worker.fetch(
      buildRawRequest({
        method: "PUT",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-upload-sessions/${createSessionPayload.session.uploadSessionId}/file?tenantId=${TENANT_ID}`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        contentLength: uploadBytes.byteLength,
        body: Uint8Array.from(uploadBytes).buffer,
      }),
      buildWorkerEnv(),
    );
    const uploadPayload = (await uploadResponse.json()) as {
      ok: true;
      run: {
        status: string;
      };
    };

    expect(uploadResponse.status).toBe(202);
    expect(uploadPayload.ok).toBe(true);
    expect(uploadPayload.run.status).toBe("queued");
  });

  it("uses local inline fallback when processing bindings are missing in dev mode", async () => {
    const workerEnv = buildWorkerEnvWithoutProcessingBindings({
      localFallbackEnabled: true,
    });
    const uploadBytes = await annualReportUploadBytesV1();
    const formData = new FormData();
    formData.set("tenantId", TENANT_ID);
    formData.set("policyVersion", "annual-report-manual-first.v1");
    formData.set(
      "file",
      new File([Uint8Array.from(uploadBytes).buffer], "annual-report.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );

    const response = await worker.fetch(
      new Request(
        `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-processing-runs`,
        {
          method: "POST",
          headers: new Headers({
            Cookie: buildSessionCookie(SESSION_TOKEN),
          }),
          body: formData,
        },
      ),
      workerEnv,
    );
    const payload = (await response.json()) as {
      ok: true;
      run: {
        status: string;
      };
    };

    expect(response.status).toBe(202);
    expect(response.headers.get("X-Dink-Annual-Report-Runtime")).toBeTruthy();
    expect(payload.ok).toBe(true);
    expect(["queued", "completed", "partial"]).toContain(payload.run.status);
  });

  it("keeps strict unavailable response outside local dev when bindings are missing", async () => {
    const workerEnv = buildWorkerEnvWithoutProcessingBindings();
    const uploadBytes = await annualReportUploadBytesV1();
    const formData = new FormData();
    formData.set("tenantId", TENANT_ID);
    formData.set("policyVersion", "annual-report-manual-first.v1");
    formData.set(
      "file",
      new File([Uint8Array.from(uploadBytes).buffer], "annual-report.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );

    const response = await worker.fetch(
      new Request(
        `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-processing-runs`,
        {
          method: "POST",
          headers: new Headers({
            Cookie: buildSessionCookie(SESSION_TOKEN),
          }),
          body: formData,
        },
      ),
      workerEnv,
    );
    const payload = (await response.json()) as {
      ok: false;
      error: {
        code: string;
      };
    };

    expect(response.status).toBe(503);
    expect(response.headers.get("X-Dink-Annual-Report-Runtime")).toBeTruthy();
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("PROCESSING_RUN_UNAVAILABLE");
  });
});
