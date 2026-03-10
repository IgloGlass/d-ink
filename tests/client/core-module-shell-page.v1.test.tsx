import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../src/client/app/providers";
import { CoreModuleShellPageV1 } from "../../src/client/features/modules/core-module-shell-page.v1";
import { getSilverfinTaxCategoryByCodeV1 } from "../../src/shared/contracts/mapping.v1";

const sessionPrincipalMock = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  emailNormalized: "editor@example.com",
  role: "Editor" as const,
};

const cashAndBankCategory = getSilverfinTaxCategoryByCodeV1("102000");

vi.mock("../../src/client/app/session-context", () => ({
  useRequiredSessionPrincipalV1: () => sessionPrincipalMock,
}));

function mockJsonResponse(input: { body: unknown; status: number }): Response {
  return new Response(JSON.stringify(input.body), {
    status: input.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function mockNotFoundResponse(code: string): Response {
  return mockJsonResponse({
    status: 404,
    body: {
      ok: false,
      error: {
        code,
        message: "Not found",
        user_message: "Not found",
        context: {},
      },
    },
  });
}

function installAnnualReportUploadXhrMock(input: {
  body: unknown;
  onSend?: () => void;
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
      if (name.toLowerCase() === "x-dink-annual-report-runtime") {
        return "annual-report-deep-extraction.v3|gemini-2.5-flash|gemini-2.5-pro";
      }
      return null;
    }

    send(): void {
      input.onSend?.();
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 100,
        total: 100,
      });
      this.status = input.status ?? 202;
      this.responseText = JSON.stringify(input.body);
      this.onload?.();
    }
  }

  vi.stubGlobal("XMLHttpRequest", MockXmlHttpRequest);
}

describe("CoreModuleShellPageV1", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps module tabs open but shows prerequisite guidance and review panel content", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND");
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }

      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }

      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }

      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }

      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            comments: [],
          },
        });
      }

      if (url.includes("/tasks?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            tasks: [],
          },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/account-mapping",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Account Mapping" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This module is available, but a complete annual report must be uploaded before mapping starts.",
    );
    expect(screen.queryByText("Populate the account table")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import trial balance" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Recommended next action")).toBeInTheDocument();
    expect(screen.getByText("No recent tasks.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload trial balance drop zone" }),
    ).toBeInTheDocument();
  });

  it("shows annual-report AI progress state while upload analysis is running", async () => {
    let processingRunCreated = false;
    installAnnualReportUploadXhrMock({
      onSend: () => {
        processingRunCreated = true;
      },
      body: {
        ok: true,
        run: {
          schemaVersion: "annual_report_processing_run_v1",
          runId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          tenantId: sessionPrincipalMock.tenantId,
          workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          sourceFileName: "annual-report.pdf",
          sourceFileType: "pdf",
          status: "queued",
          statusMessage: "Uploading source",
          technicalDetails: [],
          hasPreviousActiveResult: false,
          createdAt: "2026-03-01T10:00:00.000Z",
          updatedAt: new Date().toISOString(),
        },
      },
    });

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              workspace: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                fiscalYearStart: "2025-01-01",
                fiscalYearEnd: "2025-12-31",
                status: "draft",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return Promise.resolve(mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND"));
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND"));
      }

      if (url.includes("/mapping-decisions/active?")) {
        return Promise.resolve(mockNotFoundResponse("MAPPING_NOT_FOUND"));
      }

      if (url.includes("/tax-adjustments/active?")) {
        return Promise.resolve(mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND"));
      }

      if (url.includes("/tax-summary/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND"));
      }

      if (url.includes("/ink2-form/active?")) {
        return Promise.resolve(mockNotFoundResponse("INK2_FORM_NOT_FOUND"));
      }

      if (url.includes("/comments?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              comments: [],
            },
          }),
        );
      }

      if (url.includes("/tasks?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              tasks: [],
            },
          }),
        );
      }

      if (
        url.includes("/annual-report-processing-runs/latest?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: processingRunCreated ? 200 : 404,
            body: processingRunCreated
              ? {
                  ok: true,
                  run: {
                    schemaVersion: "annual_report_processing_run_v1",
                    runId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                    tenantId: sessionPrincipalMock.tenantId,
                    workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    sourceFileName: "annual-report.pdf",
                    sourceFileType: "pdf",
                    status: "queued",
                    statusMessage: "Uploading source",
                    technicalDetails: [],
                    hasPreviousActiveResult: false,
                    createdAt: "2026-03-01T10:00:00.000Z",
                    updatedAt: new Date().toISOString(),
                  },
                }
              : {
                  ok: false,
                  error: {
                    code: "PROCESSING_RUN_NOT_FOUND",
                    message: "Not found",
                    user_message: "Not found",
                    context: {},
                  },
                },
          }),
        );
      }

      if (
        url.includes("/annual-report-upload-sessions") &&
        method === "POST"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 201,
            body: {
              ok: true,
              session: {
                schemaVersion: "annual_report_upload_session_v1",
                uploadSessionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                tenantId: sessionPrincipalMock.tenantId,
                workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                fileName: "annual-report.pdf",
                fileType: "pdf",
                fileSizeBytes: 100,
                policyVersion: "annual-report-manual-first.v1",
                uploadUrl:
                  "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-upload-sessions/dddddddd-dddd-4ddd-8ddd-dddddddddddd/file",
                maxSizeBytes: 26214400,
                expiresAt: "2026-03-01T10:15:00.000Z",
                status: "created",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      return Promise.resolve(
        mockJsonResponse({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "UNEXPECTED",
              message: "Unexpected call",
              user_message: "Unexpected call",
              context: {},
            },
          },
        }),
      );
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Choose annual report" }),
      ).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(["annual report"], "annual-report.pdf", { type: "application/pdf" })],
      },
    });

    await userEvent.click(
      screen.getByText("Upload annual report", { selector: "button" }),
    );

    expect(
      await screen.findByText("AI analysis in progress"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Uploading source").length).toBeGreaterThan(0);
  });

  it("treats stale open annual-report runs as recoverable and allows replacement upload", async () => {
    let uploadSessionRequests = 0;
    installAnnualReportUploadXhrMock({
      body: {
        ok: true,
        run: {
          schemaVersion: "annual_report_processing_run_v1",
          runId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          tenantId: sessionPrincipalMock.tenantId,
          workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          sourceFileName: "annual-report.pdf",
          sourceFileType: "pdf",
          status: "queued",
          statusMessage: "Uploading source",
          technicalDetails: [],
          hasPreviousActiveResult: false,
          createdAt: "2026-03-01T10:00:00.000Z",
          updatedAt: new Date(Date.now() - 8 * 60 * 1_000).toISOString(),
        },
      },
    });

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              workspace: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                fiscalYearStart: "2025-01-01",
                fiscalYearEnd: "2025-12-31",
                status: "draft",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return Promise.resolve(mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND"));
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND"));
      }

      if (url.includes("/mapping-decisions/active?")) {
        return Promise.resolve(mockNotFoundResponse("MAPPING_NOT_FOUND"));
      }

      if (url.includes("/tax-adjustments/active?")) {
        return Promise.resolve(mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND"));
      }

      if (url.includes("/tax-summary/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND"));
      }

      if (url.includes("/ink2-form/active?")) {
        return Promise.resolve(mockNotFoundResponse("INK2_FORM_NOT_FOUND"));
      }

      if (url.includes("/comments?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              comments: [],
            },
          }),
        );
      }

      if (url.includes("/tasks?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              tasks: [],
            },
          }),
        );
      }

      if (
        url.includes("/annual-report-processing-runs/latest?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              run: {
                schemaVersion: "annual_report_processing_run_v1",
                runId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                tenantId: sessionPrincipalMock.tenantId,
                workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                sourceFileName: "annual-report.pdf",
                sourceFileType: "pdf",
                status: "queued",
                statusMessage: "Uploading source",
                technicalDetails: [],
                hasPreviousActiveResult: false,
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date(Date.now() - 8 * 60 * 1_000).toISOString(),
              },
            },
          }),
        );
      }

      if (
        url.includes("/annual-report-upload-sessions") &&
        method === "POST"
      ) {
        uploadSessionRequests += 1;
        return Promise.resolve(
          mockJsonResponse({
            status: 201,
            body: {
              ok: true,
              session: {
                schemaVersion: "annual_report_upload_session_v1",
                uploadSessionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                tenantId: sessionPrincipalMock.tenantId,
                workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                fileName: "annual-report.pdf",
                fileType: "pdf",
                fileSizeBytes: 100,
                policyVersion: "annual-report-manual-first.v1",
                uploadUrl:
                  "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-upload-sessions/dddddddd-dddd-4ddd-8ddd-dddddddddddd/file",
                maxSizeBytes: 26214400,
                expiresAt: "2026-03-01T10:15:00.000Z",
                status: "created",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      return Promise.resolve(
        mockJsonResponse({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "UNEXPECTED",
              message: "Unexpected call",
              user_message: "Unexpected call",
              context: {},
            },
          },
        }),
      );
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(
      await screen.findByText(
        "Annual-report processing appears stuck (no update for at least 5 minutes). You can upload a replacement file now.",
      ),
    ).toBeInTheDocument();

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(["annual report"], "annual-report.pdf", { type: "application/pdf" })],
      },
    });

    const uploadButton = screen
      .getAllByRole("button", {
        name: "Upload annual report",
      })
      .find((button) => button.closest(".module-stage-card__actions"));
    expect(uploadButton).toBeDefined();
    expect(uploadButton).toBeEnabled();
    await userEvent.click(uploadButton!);

    await waitFor(() => {
      expect(uploadSessionRequests).toBe(1);
    });
  });

  it("keeps only one upload CTA label in failed state and retries with the selected file", async () => {
    let uploadSessionRequests = 0;
    installAnnualReportUploadXhrMock({
      body: {
        ok: true,
        run: {
          schemaVersion: "annual_report_processing_run_v1",
          runId: "99999999-9999-4999-8999-999999999999",
          tenantId: sessionPrincipalMock.tenantId,
          workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          sourceFileName: "annual-report.pdf",
          sourceFileType: "pdf",
          status: "queued",
          statusMessage: "Uploading source",
          technicalDetails: [],
          hasPreviousActiveResult: false,
          createdAt: "2026-03-07T09:00:00.000Z",
          updatedAt: "2026-03-07T09:00:00.000Z",
        },
      },
    });

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              workspace: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                fiscalYearStart: "2025-01-01",
                fiscalYearEnd: "2025-12-31",
                status: "draft",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return Promise.resolve(mockNotFoundResponse("EXTRACTION_NOT_FOUND"));
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND"));
      }

      if (url.includes("/mapping-decisions/active?")) {
        return Promise.resolve(mockNotFoundResponse("MAPPING_NOT_FOUND"));
      }

      if (url.includes("/tax-adjustments/active?")) {
        return Promise.resolve(mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND"));
      }

      if (url.includes("/tax-summary/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND"));
      }

      if (url.includes("/ink2-form/active?")) {
        return Promise.resolve(mockNotFoundResponse("INK2_FORM_NOT_FOUND"));
      }

      if (url.includes("/comments?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, comments: [] },
          }),
        );
      }

      if (url.includes("/tasks?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, tasks: [] },
          }),
        );
      }

      if (
        url.includes("/annual-report-processing-runs/latest?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              run: {
                schemaVersion: "annual_report_processing_run_v1",
                runId: "12121212-1212-4212-8212-121212121212",
                tenantId: sessionPrincipalMock.tenantId,
                workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                sourceFileName: "previous.pdf",
                sourceFileType: "pdf",
                status: "failed",
                statusMessage: "Failed",
                technicalDetails: [],
                hasPreviousActiveResult: false,
                createdAt: "2026-03-07T08:50:00.000Z",
                updatedAt: "2026-03-07T08:51:00.000Z",
                error: {
                  code: "ANNUAL_REPORT_ANALYSIS_FAILED",
                  userMessage:
                    "The annual report could not be analyzed. Upload the annual report again.",
                },
              },
            },
          }),
        );
      }

      if (
        url.includes("/annual-report-upload-sessions") &&
        method === "POST"
      ) {
        uploadSessionRequests += 1;
        return Promise.resolve(
          mockJsonResponse({
            status: 201,
            body: {
              ok: true,
              session: {
                schemaVersion: "annual_report_upload_session_v1",
                uploadSessionId: "34343434-3434-4343-8434-343434343434",
                tenantId: sessionPrincipalMock.tenantId,
                workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                fileName: "annual-report.pdf",
                fileType: "pdf",
                fileSizeBytes: 100,
                policyVersion: "annual-report-manual-first.v1",
                uploadUrl:
                  "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-upload-sessions/34343434-3434-4343-8434-343434343434/file",
                maxSizeBytes: 26214400,
                expiresAt: "2026-03-07T09:15:00.000Z",
                status: "created",
                createdAt: "2026-03-07T09:00:00.000Z",
                updatedAt: "2026-03-07T09:00:00.000Z",
              },
            },
          }),
        );
      }

      return Promise.resolve(
        mockJsonResponse({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "UNEXPECTED",
              message: "Unexpected call",
              user_message: "Unexpected call",
              context: {},
            },
          },
        }),
      );
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getAllByText(
          "The annual report could not be analyzed. Upload the annual report again.",
        ).length,
      ).toBeGreaterThan(0);
    });
    expect(
      screen.getAllByRole("button", { name: "Upload annual report" }),
    ).toHaveLength(1);

    const fileInput = document.querySelector(
      '#annual-report-upload-panel input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["annual report"], "annual-report.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });

    await userEvent.click(screen.getAllByRole("button", { name: "Retry analysis" })[0]!);

    await waitFor(() => {
      expect(uploadSessionRequests).toBe(1);
    });
  });

  it("opens the chooser from the failed-state recovery action when no file is selected", async () => {
    const fileInputClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              workspace: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                fiscalYearStart: "2025-01-01",
                fiscalYearEnd: "2025-12-31",
                status: "draft",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return Promise.resolve(mockNotFoundResponse("EXTRACTION_NOT_FOUND"));
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND"));
      }

      if (url.includes("/mapping-decisions/active?")) {
        return Promise.resolve(mockNotFoundResponse("MAPPING_NOT_FOUND"));
      }

      if (url.includes("/tax-adjustments/active?")) {
        return Promise.resolve(mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND"));
      }

      if (url.includes("/tax-summary/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND"));
      }

      if (url.includes("/ink2-form/active?")) {
        return Promise.resolve(mockNotFoundResponse("INK2_FORM_NOT_FOUND"));
      }

      if (url.includes("/comments?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, comments: [] },
          }),
        );
      }

      if (url.includes("/tasks?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, tasks: [] },
          }),
        );
      }

      if (
        url.includes("/annual-report-processing-runs/latest?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              run: {
                schemaVersion: "annual_report_processing_run_v1",
                runId: "45454545-4545-4454-8454-454545454545",
                tenantId: sessionPrincipalMock.tenantId,
                workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                sourceFileName: "previous.pdf",
                sourceFileType: "pdf",
                status: "failed",
                statusMessage: "Failed",
                technicalDetails: [],
                hasPreviousActiveResult: false,
                createdAt: "2026-03-07T08:50:00.000Z",
                updatedAt: "2026-03-07T08:51:00.000Z",
                error: {
                  code: "ANNUAL_REPORT_ANALYSIS_FAILED",
                  userMessage:
                    "The annual report could not be analyzed. Upload the annual report again.",
                },
              },
            },
          }),
        );
      }

      return Promise.resolve(
        mockJsonResponse({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "UNEXPECTED",
              message: "Unexpected call",
              user_message: "Unexpected call",
              context: {},
            },
          },
        }),
      );
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getAllByText(
          "The annual report could not be analyzed. Upload the annual report again.",
        ).length,
      ).toBeGreaterThan(0);
    });

    const recoveryButton = screen
      .getAllByRole("button", { name: "Choose replacement file" })
      .find((button) => button.closest(".module-ai-analysis-card__actions"));
    expect(recoveryButton).toBeDefined();

    await userEvent.click(recoveryButton!);

    expect(fileInputClickSpy).toHaveBeenCalled();
  });

  it("requires confirmation before rerunning annual-report analysis when active extraction data exists", async () => {
    let annualReportRunCount = 0;
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(false);
    installAnnualReportUploadXhrMock({
      onSend: () => {
        annualReportRunCount += 1;
      },
      body: {
        ok: true,
        run: {
          schemaVersion: "annual_report_processing_run_v1",
          runId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          tenantId: sessionPrincipalMock.tenantId,
          workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          sourceFileName: "annual-report.pdf",
          sourceFileType: "pdf",
          status: "queued",
          statusMessage: "Uploading source",
          technicalDetails: [],
          hasPreviousActiveResult: true,
          createdAt: "2026-03-01T10:00:00.000Z",
          updatedAt: new Date().toISOString(),
        },
      },
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              version: 1,
              schemaVersion: "annual_report_extraction_v1",
            },
            extraction: {
              schemaVersion: "annual_report_extraction_v1",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              policyVersion: "annual-report-manual-first.v1",
              fields: {
                companyName: {
                  value: "Test Company AB",
                  status: "extracted",
                  confidence: 0.95,
                },
                organizationNumber: {
                  value: "5561231234",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearStart: {
                  value: "2025-01-01",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearEnd: {
                  value: "2025-12-31",
                  status: "extracted",
                  confidence: 0.95,
                },
                accountingStandard: {
                  value: "K2",
                  status: "extracted",
                  confidence: 0.92,
                },
                profitBeforeTax: {
                  value: 120000,
                  status: "extracted",
                  confidence: 0.88,
                },
              },
              summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
              taxSignals: [],
              documentWarnings: [],
              confirmation: { isConfirmed: false },
            },
          },
        });
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }

      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }

      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }

      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }

      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }

      if (url.includes("/tasks?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, tasks: [] },
        });
      }

      if (
        url.includes("/annual-report-processing-runs/latest?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: annualReportRunCount > 0 ? 200 : 404,
          body:
            annualReportRunCount > 0
              ? {
                  ok: true,
                  run: {
                    schemaVersion: "annual_report_processing_run_v1",
                    runId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                    tenantId: sessionPrincipalMock.tenantId,
                    workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    sourceFileName: "annual-report.pdf",
                    sourceFileType: "pdf",
                    status: "queued",
                    statusMessage: "Uploading source",
                    technicalDetails: [],
                    hasPreviousActiveResult: true,
                    createdAt: "2026-03-01T10:00:00.000Z",
                    updatedAt: new Date().toISOString(),
                  },
                }
              : {
                  ok: false,
                  error: {
                    code: "PROCESSING_RUN_NOT_FOUND",
                    message: "Not found",
                    user_message: "Not found",
                    context: {},
                  },
                },
        });
      }

      if (
        url.includes("/annual-report-upload-sessions") &&
        method === "POST"
      ) {
        return mockJsonResponse({
          status: 201,
          body: {
            ok: true,
            session: {
              schemaVersion: "annual_report_upload_session_v1",
              uploadSessionId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
              tenantId: sessionPrincipalMock.tenantId,
              workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              fileName: "annual-report.pdf",
              fileType: "pdf",
              fileSizeBytes: 100,
              policyVersion: "annual-report-manual-first.v1",
              uploadUrl:
                "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-upload-sessions/ffffffff-ffff-4fff-8fff-ffffffffffff/file",
              maxSizeBytes: 26214400,
              expiresAt: "2026-03-01T10:15:00.000Z",
              status: "created",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Choose annual report" }),
      ).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(["annual report"], "annual-report.pdf", { type: "application/pdf" })],
      },
    });

    await userEvent.click(
      screen.getByText("Upload a new annual report", { selector: "button" }),
    );

    expect(confirmSpy).toHaveBeenCalledWith(
      "Upload a new annual report? This will replace the active annual-report dataset and dependent tax outputs for this workspace. Previous versions will still be kept in history.",
    );
    expect(annualReportRunCount).toBe(0);

    confirmSpy.mockReturnValue(true);

    await userEvent.click(
      screen.getByText("Upload a new annual report", { selector: "button" }),
    );

    expect(annualReportRunCount).toBe(1);
  });

  it("requires confirmation before clearing active annual-report data", async () => {
    let clearCount = 0;
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              version: 1,
              schemaVersion: "annual_report_extraction_v1",
            },
            extraction: {
              schemaVersion: "annual_report_extraction_v1",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              policyVersion: "annual-report-manual-first.v1",
              fields: {
                companyName: { value: "Test Company AB", status: "extracted", confidence: 0.95 },
                organizationNumber: { value: "5561231234", status: "extracted", confidence: 0.95 },
                fiscalYearStart: { value: "2025-01-01", status: "extracted", confidence: 0.95 },
                fiscalYearEnd: { value: "2025-12-31", status: "extracted", confidence: 0.95 },
                accountingStandard: { value: "K2", status: "extracted", confidence: 0.92 },
                profitBeforeTax: { value: 120000, status: "extracted", confidence: 0.88 },
              },
              summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
              taxSignals: [],
              documentWarnings: [],
              taxDeep: {
                ink2rExtracted: {
                  incomeStatement: [{ code: "profit", label: "Profit", currentYearValue: 120000, evidence: [] }],
                  balanceSheet: [{ code: "assets", label: "Assets", currentYearValue: 400000, evidence: [] }],
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
                confirmedAt: "2026-03-01T10:00:00.000Z",
                confirmedByUserId: sessionPrincipalMock.userId,
              },
            },
          },
        });
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }
      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }
      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }
      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }
      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }
      if (url.includes("/comments?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, comments: [] } });
      }
      if (url.includes("/tasks?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, tasks: [] } });
      }
      if (url.includes("/annual-report-extractions/clear") && method === "POST") {
        clearCount += 1;
        return mockJsonResponse({
          status: 200,
          body: { ok: true, clearedArtifactTypes: ["annual_report_extraction"] },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: "Clear annual report data" }).length,
      ).toBeGreaterThan(0);
    });

    await userEvent.click(
      screen.getAllByRole("button", { name: "Clear annual report data" })[0]!,
    );
    expect(confirmSpy).toHaveBeenCalledWith(
      "Clear the current annual-report data? This will remove the active annual-report extraction and dependent tax outputs from this workspace. Historical versions will still be kept.",
    );
    expect(clearCount).toBe(0);

    confirmSpy.mockReturnValue(true);
    await userEvent.click(
      screen.getAllByRole("button", { name: "Clear annual report data" })[0]!,
    );
    expect(clearCount).toBe(1);
  });

  it("clears the annual-report screen after clearing active data", async () => {
    let activeFetchCount = 0;
    vi.spyOn(window, "confirm").mockReturnValue(true);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        activeFetchCount += 1;
        if (activeFetchCount === 1) {
          return mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              active: {
                artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                version: 1,
                schemaVersion: "annual_report_extraction_v1",
              },
              extraction: {
                schemaVersion: "annual_report_extraction_v1",
                sourceFileName: "annual-report.pdf",
                sourceFileType: "pdf",
                policyVersion: "annual-report-manual-first.v1",
                fields: {
                  companyName: { value: "Test Company AB", status: "extracted", confidence: 0.95 },
                  organizationNumber: { value: "5561231234", status: "extracted", confidence: 0.95 },
                  fiscalYearStart: { value: "2025-01-01", status: "extracted", confidence: 0.95 },
                  fiscalYearEnd: { value: "2025-12-31", status: "extracted", confidence: 0.95 },
                  accountingStandard: { value: "K2", status: "extracted", confidence: 0.92 },
                  profitBeforeTax: { value: 120000, status: "extracted", confidence: 0.88 },
                },
                summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
                taxSignals: [],
                documentWarnings: [],
                taxDeep: {
                  ink2rExtracted: {
                    incomeStatement: [{ code: "profit", label: "Profit", currentYearValue: 120000, evidence: [] }],
                    balanceSheet: [{ code: "assets", label: "Assets", currentYearValue: 400000, evidence: [] }],
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
                  confirmedAt: "2026-03-01T10:00:00.000Z",
                  confirmedByUserId: sessionPrincipalMock.userId,
                },
              },
            },
          });
        }

        return mockNotFoundResponse("EXTRACTION_NOT_FOUND");
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }
      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }
      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }
      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }
      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }
      if (url.includes("/comments?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, comments: [] } });
      }
      if (url.includes("/tasks?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, tasks: [] } });
      }
      if (url.includes("/annual-report-extractions/clear") && method === "POST") {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, clearedArtifactTypes: ["annual_report_extraction"] },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText("Test Company AB")).toBeInTheDocument();

    await userEvent.click(
      screen.getAllByRole("button", { name: "Clear annual report data" })[0]!,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Upload an annual report to trigger extraction and forensic tax review.",
        ),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Test Company AB")).not.toBeInTheDocument();
  });

  it("renders INK2-coded rows with a balance control instead of raw summary rows", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: "2026-03-01T10:00:00.000Z",
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              version: 3,
              schemaVersion: "annual_report_extraction_v1",
            },
            extraction: {
              schemaVersion: "annual_report_extraction_v1",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              policyVersion: "annual-report-manual-first.v1",
              fields: {
                companyName: {
                  value: "Test Company AB",
                  status: "extracted",
                  confidence: 0.95,
                },
                organizationNumber: {
                  value: "556123-1234",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearStart: {
                  value: "2025-01-01",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearEnd: {
                  value: "2025-12-31",
                  status: "extracted",
                  confidence: 0.95,
                },
                accountingStandard: {
                  value: "K3",
                  status: "extracted",
                  confidence: 0.92,
                },
                profitBeforeTax: {
                  value: 545286000,
                  status: "extracted",
                  confidence: 0.9,
                },
              },
              summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
              taxSignals: [],
              documentWarnings: [],
              taxDeep: {
                ink2rExtracted: {
                  statementUnit: "sek",
                  incomeStatement: [
                    {
                      code: "3.1",
                      label: "Nettoomsättning",
                      currentYearValue: 3989355000,
                      priorYearValue: 4381698000,
                      evidence: [],
                    },
                    {
                      code: "3.7",
                      label: "Övriga externa kostnader",
                      currentYearValue: 1234567000,
                      priorYearValue: 1111111000,
                      evidence: [],
                    },
                  ],
                  balanceSheet: [
                    {
                      code: "2.26",
                      label: "Kassa, bank och redovisningsmedel",
                      currentYearValue: 301521000,
                      priorYearValue: 287144000,
                      evidence: [],
                    },
                    {
                      code: "2.27",
                      label: "Bundet eget kapital",
                      currentYearValue: 150000000,
                      priorYearValue: 150000000,
                      evidence: [],
                    },
                    {
                      code: "2.28",
                      label: "Fritt eget kapital",
                      currentYearValue: 31000000,
                      priorYearValue: 16144000,
                      evidence: [],
                    },
                    {
                      code: "2.45",
                      label: "Leverantörsskulder",
                      currentYearValue: 120521000,
                      priorYearValue: 121000000,
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
                confirmedAt: "2026-03-01T10:00:00.000Z",
                confirmedByUserId: sessionPrincipalMock.userId,
              },
            },
          },
        });
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }
      if (url.includes("/annual-report-processing/latest?")) {
        return mockNotFoundResponse("PROCESSING_RUN_NOT_FOUND");
      }
      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }
      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }
      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }
      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }
      if (url.includes("/comments?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, comments: [] } });
      }
      if (url.includes("/tasks?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, tasks: [] } });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await screen.findByRole("heading", { name: "Financial data" });

    expect(screen.getByText("2.26")).toBeInTheDocument();
    expect(
      screen.getByText("Kassa, bank och redovisningsmedel"),
    ).toBeInTheDocument();
    expect(screen.getByText("Balance control")).toBeInTheDocument();
    expect(screen.getByText("Equity + liabilities")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Control passed: assets equal equity plus liabilities.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("SUMMA TILLGÅNGAR")).not.toBeInTheDocument();
  });

  it("requires confirmation before rerunning account mapping when active mapping data exists", async () => {
    let trialBalanceRunCount = 0;
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(false);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND");
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }

      if (url.includes("/mapping-decisions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              version: 1,
              schemaVersion: "mapping_decisions_v1",
            },
            mapping: {
              schemaVersion: "mapping_decisions_v1",
              policyVersion: "deterministic-bas.v1",
              summary: {
                totalRows: 1,
                deterministicDecisions: 1,
                manualReviewRequired: 0,
                fallbackDecisions: 0,
                matchedByAccountNumber: 1,
                matchedByAccountName: 0,
                unmatchedRows: 0,
              },
              decisions: [
                {
                  id: "mapping-1",
                  accountNumber: "1930",
                  sourceAccountNumber: "1930",
                  accountName: "Bank",
                  proposedCategory: cashAndBankCategory,
                  selectedCategory: cashAndBankCategory,
                  confidence: 0.98,
                  evidence: [
                    {
                      type: "tb_row",
                      reference: "Trial Balance:2",
                      snippet: "1930 Bank",
                      source: {
                        sheetName: "Trial Balance",
                        rowNumber: 2,
                      },
                    },
                  ],
                  policyRuleReference: "map.is.cash-and-bank.v1",
                  reviewFlag: false,
                  status: "proposed",
                  source: "deterministic",
                },
              ],
            },
          },
        });
      }

      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }

      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }

      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }

      if (url.includes("/tasks?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, tasks: [] },
        });
      }

      if (url.includes("/tb-pipeline-runs") && method === "POST") {
        trialBalanceRunCount += 1;
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "99999999-9999-4999-8999-999999999999",
              version: 2,
              schemaVersion: "mapping_decisions_v1",
            },
          },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/account-mapping",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Choose trial balance" }),
      ).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(["trial balance"], "trial-balance.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })],
      },
    });

    await userEvent.click(
      screen.getByText("Import trial balance", { selector: "button" }),
    );

    expect(confirmSpy).toHaveBeenCalledWith(
      "Import trial balance again? This will replace the active account mapping data and current mapping review state for this workspace.",
    );
    expect(trialBalanceRunCount).toBe(0);

    confirmSpy.mockReturnValue(true);

    await userEvent.click(
      screen.getByText("Import trial balance", { selector: "button" }),
    );

    expect(trialBalanceRunCount).toBe(1);
  });

  it("renders extracted financial data and tax notes in the annual-report sidebar", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              version: 2,
              schemaVersion: "annual_report_extraction_v1",
            },
            extraction: {
              schemaVersion: "annual_report_extraction_v1",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              policyVersion: "annual-report-manual-first.v1",
              fields: {
                companyName: {
                  value: "Deloitte AB",
                  status: "extracted",
                  confidence: 0.98,
                },
                organizationNumber: {
                  value: "556271-5309",
                  status: "extracted",
                  confidence: 0.98,
                },
                fiscalYearStart: {
                  value: "2024-06-01",
                  status: "extracted",
                  confidence: 0.98,
                },
                fiscalYearEnd: {
                  value: "2025-05-31",
                  status: "extracted",
                  confidence: 0.98,
                },
                accountingStandard: {
                  value: "K3",
                  status: "extracted",
                  confidence: 0.95,
                },
                profitBeforeTax: {
                  value: 545286,
                  status: "extracted",
                  confidence: 0.9,
                },
              },
              summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
              taxSignals: [],
              documentWarnings: [
                "Gemini statements extraction skipped on the previous run.",
              ],
              taxDeep: {
                ink2rExtracted: {
                  statementUnit: "ksek",
                  incomeStatement: [
                    {
                      code: "net-turnover",
                      label: "Nettoomsättning",
                      currentYearValue: 428447275000,
                      priorYearValue: 401000000000,
                      evidence: [],
                    },
                    {
                      code: "profit-before-tax",
                      label: "Resultat före skatt",
                      currentYearValue: 545286000,
                      priorYearValue: 510210000,
                      evidence: [],
                    },
                  ],
                  balanceSheet: [
                    {
                      code: "inventories",
                      label: "Varulager",
                      currentYearValue: 128000,
                      evidence: [],
                    },
                    {
                      code: "untaxed-reserves",
                      label: "Obeskattade reserver",
                      currentYearValue: 8000000,
                      evidence: [],
                    },
                  ],
                },
                depreciationContext: {
                  assetAreas: [
                    {
                      assetArea: "Inventories and equipment",
                      acquisitions: 22000,
                      disposals: 3500,
                      depreciationForYear: 8000,
                      closingCarryingAmount: 99000,
                      evidence: [],
                    },
                  ],
                  evidence: [],
                },
                assetMovements: {
                  lines: [],
                  evidence: [],
                },
                reserveContext: {
                  movements: [
                    {
                      reserveType: "Overavskrivningar",
                      openingBalance: 0,
                      movementForYear: 8000,
                      closingBalance: 8000,
                      evidence: [],
                    },
                  ],
                  notes: [
                    "Overavskrivningar of 8,000 should be matched to the tax depreciation schedule.",
                  ],
                  evidence: [],
                },
                netInterestContext: {
                  netInterest: {
                    value: -12000,
                    evidence: [],
                  },
                  notes: [
                    "Finance items should be reviewed against interest limitation rules if group debt exists.",
                  ],
                  evidence: [],
                },
                pensionContext: {
                  flags: [],
                  notes: ["Pension commitments should be reconciled to the special payroll tax base."],
                  evidence: [],
                },
                taxExpenseContext: {
                  currentTax: {
                    value: 112345000,
                    evidence: [],
                  },
                  deferredTax: {
                    value: -1200000,
                    evidence: [],
                  },
                  notes: [
                    "Deferred tax note indicates temporary differences that should be traced into the tax workpapers.",
                  ],
                  evidence: [],
                },
                leasingContext: {
                  flags: [],
                  notes: [],
                  evidence: [],
                },
                groupContributionContext: {
                  flags: [],
                  notes: [
                    "Group contribution references are present in the notes and should be reconciled to the tax return.",
                  ],
                  evidence: [],
                },
                shareholdingContext: {
                  dividendsPaid: {
                    value: 559458000,
                    evidence: [],
                  },
                  flags: [],
                  notes: [],
                  evidence: [],
                },
                priorYearComparatives: [],
              },
              confirmation: { isConfirmed: false },
            },
          },
        });
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              version: 1,
              schemaVersion: "annual_report_tax_analysis_v1",
            },
            taxAnalysis: {
              schemaVersion: "annual_report_tax_analysis_v1",
              sourceExtractionArtifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              policyVersion: "annual-report-tax-analysis.v1",
              basedOn: {
                ink2rExtracted: { incomeStatement: [], balanceSheet: [] },
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
              executiveSummary:
                "The report contains depreciation and reserve movements that require tax review.",
              accountingStandardAssessment: {
                status: "aligned",
                rationale: "K3 is explicit and usable for tax review.",
              },
              findings: [
                {
                  id: "finding-1",
                  area: "depreciation",
                  title: "Depreciation schedule should be reconciled",
                  severity: "medium",
                  rationale:
                    "Acquisitions, disposals, and over-depreciation are present in the report.",
                  recommendedFollowUp:
                    "Confirm the tax depreciation basis before filing.",
                  missingInformation: [],
                  policyRuleReference: "annual-report.tax.depreciation",
                  evidence: [],
                },
              ],
              missingInformation: [],
              recommendedNextActions: [
                "Verify the depreciation schedule against the fixed-asset ledger.",
              ],
            },
          },
        });
      }

      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }

      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }

      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }

      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            comments: [],
          },
        });
      }

      if (url.includes("/tasks?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            tasks: [],
          },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(
      await screen.findByRole("heading", { name: "Financial data" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Extract company facts and financial values")).not.toBeInTheDocument();
    expect(screen.getByText("Deloitte AB")).toBeInTheDocument();
    expect(screen.getByText("Normalized from kSEK to SEK")).toBeInTheDocument();
    expect(screen.getByText("Income statement")).toBeInTheDocument();
    expect(screen.getByText("Balance sheet")).toBeInTheDocument();
    expect(screen.getByText("Nettoomsättning")).toBeInTheDocument();
    expect(screen.getByText("428 447 275 000")).toBeInTheDocument();
    expect(screen.getByText("Varulager")).toBeInTheDocument();
    expect(
      screen.getByText("Depreciation and movements"),
    ).toBeInTheDocument();
    expect(screen.getByText("Current and deferred tax")).toBeInTheDocument();
    expect(screen.getByText("Current tax")).toBeInTheDocument();
    expect(screen.getByText("112 345 000")).toBeInTheDocument();
    expect(screen.getByText("Inventories and equipment")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Overavskrivningar of 8,000 should be matched to the tax depreciation schedule.",
      ),
    ).toBeInTheDocument();
    const warningDisclosure = document.querySelector(
      ".annual-report-sidebar__details",
    ) as HTMLDetailsElement | null;
    expect(warningDisclosure).not.toBeNull();
    expect(warningDisclosure?.open).toBe(false);
    expect(
      screen.getByRole("heading", { name: "Forensic tax review" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The report contains depreciation and reserve movements that require tax review.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a rerun-required state for stale core-only annual-report artifacts", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              version: 3,
              schemaVersion: "annual_report_extraction_v1",
            },
            runtime: {
              extractionEngineVersion: "annual-report-deep-extraction.v2",
              runtimeFingerprint:
                "annual-report-deep-extraction.v2|gemini-2.5-flash|gemini-2.5-pro",
            },
            extraction: {
              schemaVersion: "annual_report_extraction_v1",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              policyVersion: "annual-report-manual-first.v1",
              fields: {
                companyName: { value: "Deloitte AB", status: "extracted", confidence: 0.98 },
                organizationNumber: {
                  value: "556271-5309",
                  status: "extracted",
                  confidence: 0.98,
                },
                fiscalYearStart: { value: "2024-06-01", status: "extracted", confidence: 0.98 },
                fiscalYearEnd: { value: "2025-05-31", status: "extracted", confidence: 0.98 },
                accountingStandard: { value: "K3", status: "extracted", confidence: 0.95 },
                profitBeforeTax: { value: 545286, status: "extracted", confidence: 0.9 },
              },
              summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
              taxSignals: [],
              documentWarnings: [
                "Gemini statements extraction skipped: {\"error\":{\"code\":400,\"message\":\"A schema in GenerationConfig in the request exceeds the maximum allowed nesting depth.\",\"status\":\"INVALID_ARGUMENT\"}}",
                "Full financial extraction is missing on this artifact. Re-run the annual report analysis to populate full income statement, balance sheet, and tax-note data.",
              ],
              taxDeep: {
                ink2rExtracted: {
                  incomeStatement: [],
                  balanceSheet: [],
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
              confirmation: { isConfirmed: false },
            },
          },
        });
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }

      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }
      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }
      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }
      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }
      if (url.includes("/comments?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, comments: [] } });
      }
      if (url.includes("/tasks?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, tasks: [] } });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Legacy result")).toHaveLength(2);
    });
    expect(
      screen.getAllByText(
        "This saved result was created with an older extraction engine and is missing full statements and tax-note context. Upload the annual report again to refresh it.",
      ),
    ).toHaveLength(2);
    expect(screen.queryByText("Income statement")).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Choose another file" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Clear annual report data" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Technical details (1)")).toBeInTheDocument();
  });
});
