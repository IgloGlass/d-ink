import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyAnnualReportOverridesV1,
  clearAnnualReportDataV1,
  confirmAnnualReportExtractionV1,
  createAnnualReportUploadSessionV1,
  getActiveAnnualReportExtractionV1,
  uploadAnnualReportAndStartProcessingV1,
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

function installUploadXhrMock(input: {
  body: unknown;
  includeRuntimeHeader?: boolean;
  status?: number;
}): void {
  class MockXmlHttpRequest {
    onabort: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;
    responseText = "";
    status = 0;
    upload = {
      onprogress: null as
        | ((event: { lengthComputable: boolean; loaded: number; total: number }) => void)
        | null,
    };
    withCredentials = false;

    open(): void {}

    setRequestHeader(): void {}

    getResponseHeader(name: string): string | null {
      if (
        input.includeRuntimeHeader !== false &&
        name.toLowerCase() === "x-dink-annual-report-runtime"
      ) {
        return "annual-report-deep-extraction.v3|qwen-plus|qwen-max";
      }
      return null;
    }

    send(): void {
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 128,
        total: 128,
      });
      this.status = input.status ?? 202;
      this.responseText = JSON.stringify(input.body);
      this.onload?.();
    }
  }

  vi.stubGlobal("XMLHttpRequest", MockXmlHttpRequest);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("workspace annual report API client v1", () => {
  it("parses get/override/confirm/clear response contracts", async () => {
    const basePayload = {
      ok: true,
      active: {
        artifactId: "9f000000-0000-4000-8000-000000000001",
        version: 1,
        schemaVersion: "annual_report_extraction_v1",
      },
      runtime: {
        extractionEngineVersion: "annual-report-deep-extraction.v2",
        runtimeFingerprint:
          "annual-report-deep-extraction.v2|qwen-plus|qwen-max",
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
        engineMetadata: {
          extractionEngineVersion: "annual-report-deep-extraction.v2",
          runtimeFingerprint:
            "annual-report-deep-extraction.v2|qwen-plus|qwen-max",
        },
        confirmation: {
          isConfirmed: true,
          confirmedAt: "2026-03-03T10:00:00.000Z",
          confirmedByUserId: "9f000000-0000-4000-8000-000000000012",
        },
      },
    };
    mockFetchJsonResponse([
      { payload: basePayload },
      { payload: { ...basePayload, appliedCount: 1 } },
      { payload: basePayload },
      {
        payload: {
          ok: true,
          clearedArtifactTypes: [
            "annual_report_extraction",
            "annual_report_tax_analysis",
            "tax_adjustments",
            "tax_summary",
            "ink2_form",
            "export_package",
          ],
        },
      },
    ]);
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

    const clear = await clearAnnualReportDataV1({
      tenantId: "9f000000-0000-4000-8000-000000000010",
      workspaceId: "9f000000-0000-4000-8000-000000000011",
    });
    expect(clear.ok).toBe(true);
  });

  it("throws a deterministic deprecation error for synchronous annual-report runs", async () => {
    const { runAnnualReportExtractionV1 } = await import(
      "../../src/client/lib/http/workspace-api"
    );
    await expect(
      runAnnualReportExtractionV1({
        tenantId: "9f000000-0000-4000-8000-000000000010",
        workspaceId: "9f000000-0000-4000-8000-000000000011",
        fileName: "annual-report.pdf",
        fileBytesBase64: "AQID",
        policyVersion: "annual-report-manual-first.v1",
      }),
    ).rejects.toMatchObject({
      status: 410,
      code: "PROCESSING_RUN_UNAVAILABLE",
    });
  });

  it("creates an upload session and streams the source file with progress", async () => {
    mockFetchJsonResponse({
      ok: true,
      session: {
        schemaVersion: "annual_report_upload_session_v1",
        uploadSessionId: "9f000000-0000-4000-8000-000000000099",
        tenantId: "9f000000-0000-4000-8000-000000000010",
        workspaceId: "9f000000-0000-4000-8000-000000000011",
        fileName: "annual-report.pdf",
        fileType: "pdf",
        fileSizeBytes: 128,
        policyVersion: "annual-report-manual-first.v1",
        uploadUrl:
          "/v1/workspaces/9f000000-0000-4000-8000-000000000011/annual-report-upload-sessions/9f000000-0000-4000-8000-000000000099/file",
        maxSizeBytes: 26214400,
        expiresAt: "2026-03-06T12:15:00.000Z",
        status: "created",
        createdAt: "2026-03-06T12:00:00.000Z",
        updatedAt: "2026-03-06T12:00:00.000Z",
      },
    });
    installUploadXhrMock({
      body: {
        ok: true,
        run: {
          schemaVersion: "annual_report_processing_run_v1",
          runId: "9f000000-0000-4000-8000-000000000100",
          tenantId: "9f000000-0000-4000-8000-000000000010",
          workspaceId: "9f000000-0000-4000-8000-000000000011",
          sourceFileName: "annual-report.pdf",
          sourceFileType: "pdf",
          status: "queued",
          statusMessage: "Uploading source",
          technicalDetails: [],
          hasPreviousActiveResult: false,
          createdAt: "2026-03-06T12:00:00.000Z",
          updatedAt: "2026-03-06T12:00:00.000Z",
        },
      },
    });

    const progressSpy = vi.fn();
    const result = await uploadAnnualReportAndStartProcessingV1({
      tenantId: "9f000000-0000-4000-8000-000000000010",
      workspaceId: "9f000000-0000-4000-8000-000000000011",
      file: new File(["annual report"], "annual-report.pdf", {
        type: "application/pdf",
      }),
      policyVersion: "annual-report-manual-first.v1",
      onUploadProgress: progressSpy,
    });

    expect(result.ok).toBe(true);
    expect(result.run.status).toBe("queued");
    expect(progressSpy).toHaveBeenCalledWith({
      loadedBytes: 128,
      totalBytes: 128,
    });
  });

  it("surfaces a runtime mismatch when the upload target is not the D.ink API", async () => {
    mockFetchJsonResponse({
      ok: true,
      session: {
        schemaVersion: "annual_report_upload_session_v1",
        uploadSessionId: "9f000000-0000-4000-8000-000000000099",
        tenantId: "9f000000-0000-4000-8000-000000000010",
        workspaceId: "9f000000-0000-4000-8000-000000000011",
        fileName: "annual-report.pdf",
        fileType: "pdf",
        fileSizeBytes: 128,
        policyVersion: "annual-report-manual-first.v1",
        uploadUrl:
          "/v1/workspaces/9f000000-0000-4000-8000-000000000011/annual-report-upload-sessions/9f000000-0000-4000-8000-000000000099/file",
        maxSizeBytes: 26214400,
        expiresAt: "2026-03-06T12:15:00.000Z",
        status: "created",
        createdAt: "2026-03-06T12:00:00.000Z",
        updatedAt: "2026-03-06T12:00:00.000Z",
      },
    });
    installUploadXhrMock({
      body: {
        ok: true,
        html: "<html>wrong backend</html>",
      },
      includeRuntimeHeader: false,
      status: 200,
    });

    await expect(
      uploadAnnualReportAndStartProcessingV1({
        tenantId: "9f000000-0000-4000-8000-000000000010",
        workspaceId: "9f000000-0000-4000-8000-000000000011",
        file: new File(["annual report"], "annual-report.pdf", {
          type: "application/pdf",
        }),
        policyVersion: "annual-report-manual-first.v1",
      }),
    ).rejects.toMatchObject({
      code: "RUNTIME_MISMATCH",
      userMessage:
        "The app is not connected to the correct local API service. Restart the local app and try again.",
    });
  });

  it("falls back to direct processing run when upload-session mode is unavailable", async () => {
    mockFetchJsonResponse([
      {
        payload: {
          ok: false,
          error: {
            code: "PROCESSING_RUN_UNAVAILABLE",
            message: "Annual-report background processing is not configured.",
            user_message:
              "Annual-report analysis is temporarily unavailable. Check the app configuration and try again.",
            context: {},
          },
        },
        status: 503,
      },
      {
        payload: {
          ok: true,
          run: {
            schemaVersion: "annual_report_processing_run_v1",
            runId: "9f000000-0000-4000-8000-000000000101",
            tenantId: "9f000000-0000-4000-8000-000000000010",
            workspaceId: "9f000000-0000-4000-8000-000000000011",
            sourceFileName: "annual-report.pdf",
            sourceFileType: "pdf",
            status: "completed",
            statusMessage: "Completed",
            technicalDetails: [],
            hasPreviousActiveResult: false,
            createdAt: "2026-03-06T12:00:00.000Z",
            updatedAt: "2026-03-06T12:00:10.000Z",
            finishedAt: "2026-03-06T12:00:10.000Z",
          },
        },
        status: 202,
      },
    ]);

    const result = await uploadAnnualReportAndStartProcessingV1({
      tenantId: "9f000000-0000-4000-8000-000000000010",
      workspaceId: "9f000000-0000-4000-8000-000000000011",
      file: new File(["annual report"], "annual-report.pdf", {
        type: "application/pdf",
      }),
      policyVersion: "annual-report-manual-first.v1",
    });

    expect(result.ok).toBe(true);
    expect(result.run.status).toBe("completed");
  });
});
