import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyAnnualReportOverridesV1,
  confirmAnnualReportExtractionV1,
  getActiveAnnualReportExtractionV1,
  runAnnualReportExtractionV1,
} from "../../src/client/lib/http/workspace-api";

function mockFetchJsonResponse(
  payload: unknown | Array<{ payload: unknown; status?: number }>,
): void {
  const queue = Array.isArray(payload)
    ? payload
    : [{ payload, status: 200 as number }];

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => {
      const next = queue.shift() ?? {
        payload: {
          ok: false,
          error: {
            code: "TEST_MISSING_MOCK",
            message: "No queued payload in test.",
            user_message: "No queued payload in test.",
            context: {},
          },
        },
        status: 500,
      };

      return new Response(JSON.stringify(next.payload), {
        status: next.status ?? 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workspace annual report API client v1", () => {
  it("parses run/get/override/confirm response contracts", async () => {
    const basePayload = {
      ok: true,
      active: {
        artifactId: "9f000000-0000-4000-8000-000000000001",
        version: 1,
        schemaVersion: "annual_report_extraction_v1",
      },
      extraction: {
        schemaVersion: "annual_report_extraction_v1",
        sourceFileName: "annual-report.pdf",
        sourceFileType: "pdf",
        policyVersion: "annual-report-manual-first.v1",
        fields: {
          companyName: { status: "manual", confidence: 1, value: "Acme AB" },
          organizationNumber: {
            status: "manual",
            confidence: 1,
            value: "556677-8899",
          },
          fiscalYearStart: {
            status: "manual",
            confidence: 1,
            value: "2025-01-01",
          },
          fiscalYearEnd: {
            status: "manual",
            confidence: 1,
            value: "2025-12-31",
          },
          accountingStandard: { status: "manual", confidence: 1, value: "K2" },
          profitBeforeTax: { status: "manual", confidence: 1, value: 1000000 },
        },
        summary: {
          autoDetectedFieldCount: 0,
          needsReviewFieldCount: 0,
        },
        confirmation: {
          isConfirmed: false,
        },
      },
    };
    mockFetchJsonResponse([
      { payload: basePayload },
      { payload: basePayload },
      { payload: { ...basePayload, appliedCount: 1 } },
      { payload: basePayload },
    ]);

    const run = await runAnnualReportExtractionV1({
      tenantId: "9f000000-0000-4000-8000-000000000010",
      workspaceId: "9f000000-0000-4000-8000-000000000011",
      fileName: "annual-report.pdf",
      fileBytesBase64: "AQID",
      policyVersion: "annual-report-manual-first.v1",
    });
    expect(run.ok).toBe(true);

    const get = await getActiveAnnualReportExtractionV1({
      tenantId: "9f000000-0000-4000-8000-000000000010",
      workspaceId: "9f000000-0000-4000-8000-000000000011",
    });
    expect(get.ok).toBe(true);

    const override = await applyAnnualReportOverridesV1({
      tenantId: "9f000000-0000-4000-8000-000000000010",
      workspaceId: "9f000000-0000-4000-8000-000000000011",
      expectedActiveExtraction: {
        artifactId: "9f000000-0000-4000-8000-000000000001",
        version: 1,
      },
      overrides: [
        {
          fieldKey: "profitBeforeTax",
          value: 1200000,
          reason: "manual correction",
        },
      ],
    });
    expect(override.ok).toBe(true);

    const confirm = await confirmAnnualReportExtractionV1({
      tenantId: "9f000000-0000-4000-8000-000000000010",
      workspaceId: "9f000000-0000-4000-8000-000000000011",
      expectedActiveExtraction: {
        artifactId: "9f000000-0000-4000-8000-000000000001",
        version: 1,
      },
    });
    expect(confirm.ok).toBe(true);
  });
});
