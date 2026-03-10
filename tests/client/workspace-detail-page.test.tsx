import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../src/client/app/providers";

const sessionPrincipalMock = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  emailNormalized: "editor@example.com",
  role: "Editor" as const,
};

vi.mock("../../src/client/app/session-context", () => ({
  useRequiredSessionPrincipalV1: () => sessionPrincipalMock,
}));

import { WorkspaceDetailPage } from "../../src/client/features/workspaces/workspace-detail-page";

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

function renderWorkspaceDetailPageV1() {
  return render(
    <AppProviders>
      <MemoryRouter
        initialEntries={[
          "/app/workspaces/44444444-4444-4444-8444-444444444444",
        ]}
      >
        <Routes>
          <Route
            path="/app/workspaces/:workspaceId"
            element={<WorkspaceDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("WorkspaceDetailPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("applies transition successfully and refreshes workspace status", async () => {
    let currentStatus = "draft";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/44444444-4444-4444-8444-444444444444?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "44444444-4444-4444-8444-444444444444",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "55555555-5555-4555-8555-555555555555",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: currentStatus,
              createdAt: "2026-02-24T10:00:00.000Z",
              updatedAt: "2026-02-24T10:00:00.000Z",
            },
          },
        });
      }

      if (
        url.endsWith(
          "/v1/workspaces/44444444-4444-4444-8444-444444444444/transitions",
        ) &&
        method === "POST"
      ) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          toStatus: string;
        };
        currentStatus = body.toStatus;

        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "44444444-4444-4444-8444-444444444444",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "55555555-5555-4555-8555-555555555555",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: currentStatus,
              createdAt: "2026-02-24T10:00:00.000Z",
              updatedAt: "2026-02-24T10:05:00.000Z",
            },
            auditEvent: {
              id: "66666666-6666-4666-8666-666666666666",
              tenantId: sessionPrincipalMock.tenantId,
              workspaceId: "44444444-4444-4444-8444-444444444444",
              actorType: "user",
              actorUserId: sessionPrincipalMock.userId,
              eventType: "workspace.status_changed",
              targetType: "workspace",
              targetId: "44444444-4444-4444-8444-444444444444",
              before: {
                status: "draft",
              },
              after: {
                status: "in_review",
              },
              timestamp: "2026-02-24T10:05:01.000Z",
              context: {
                actorRole: sessionPrincipalMock.role,
                reason: null,
              },
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

    const user = userEvent.setup();
    renderWorkspaceDetailPageV1();

    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByLabelText("Target status"),
      "in_review",
    );
    await user.click(screen.getByRole("button", { name: "Apply transition" }));

    await waitFor(() => {
      expect(
        screen.getByText("Workspace status updated successfully."),
      ).toBeInTheDocument();
      expect(screen.getByText("In review")).toBeInTheDocument();
    });
  });

  it("shows API user_message when transition fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/44444444-4444-4444-8444-444444444444?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "44444444-4444-4444-8444-444444444444",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "55555555-5555-4555-8555-555555555555",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-02-24T10:00:00.000Z",
              updatedAt: "2026-02-24T10:00:00.000Z",
            },
          },
        });
      }

      if (
        url.endsWith(
          "/v1/workspaces/44444444-4444-4444-8444-444444444444/transitions",
        ) &&
        method === "POST"
      ) {
        return mockJsonResponse({
          status: 409,
          body: {
            ok: false,
            error: {
              code: "TRANSITION_REJECTED",
              message: "Transition rejected.",
              user_message: "This status change is not allowed.",
              context: {
                transitionError: {
                  code: "INVALID_TRANSITION",
                },
              },
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

    const user = userEvent.setup();
    renderWorkspaceDetailPageV1();

    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByLabelText("Target status"),
      "exported",
    );
    await user.click(screen.getByRole("button", { name: "Apply transition" }));

    await waitFor(() => {
      expect(
        screen.getByText("This status change is not allowed."),
      ).toBeInTheDocument();
    });
  });

  it("uses the shared annual-report retry flow on the legacy detail page", async () => {
    let uploadSessionRequests = 0;
    installAnnualReportUploadXhrMock({
      body: {
        ok: true,
        run: {
          schemaVersion: "annual_report_processing_run_v1",
          runId: "77777777-7777-4777-8777-777777777777",
          tenantId: sessionPrincipalMock.tenantId,
          workspaceId: "44444444-4444-4444-8444-444444444444",
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

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/44444444-4444-4444-8444-444444444444?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "44444444-4444-4444-8444-444444444444",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "55555555-5555-4555-8555-555555555555",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-07T08:00:00.000Z",
              updatedAt: "2026-03-07T08:00:00.000Z",
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockNotFoundResponse("EXTRACTION_NOT_FOUND");
      }

      if (
        url.includes("/annual-report-processing-runs/latest?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            run: {
              schemaVersion: "annual_report_processing_run_v1",
              runId: "66666666-6666-4666-8666-666666666666",
              tenantId: sessionPrincipalMock.tenantId,
              workspaceId: "44444444-4444-4444-8444-444444444444",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              status: "failed",
              statusMessage: "Failed",
              technicalDetails: [],
              hasPreviousActiveResult: false,
              createdAt: "2026-03-07T08:10:00.000Z",
              updatedAt: "2026-03-07T08:10:30.000Z",
              error: {
                code: "ANNUAL_REPORT_ANALYSIS_FAILED",
                userMessage:
                  "The annual report could not be analyzed. Upload the annual report again.",
              },
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
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("FORM_NOT_FOUND");
      }

      if (url.includes("/exports?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, exports: [] },
        });
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
        url.includes("/annual-report-upload-sessions") &&
        method === "POST"
      ) {
        uploadSessionRequests += 1;
        return mockJsonResponse({
          status: 201,
          body: {
            ok: true,
            session: {
              schemaVersion: "annual_report_upload_session_v1",
              uploadSessionId: "88888888-8888-4888-8888-888888888888",
              tenantId: sessionPrincipalMock.tenantId,
              workspaceId: "44444444-4444-4444-8444-444444444444",
              fileName: "annual-report.pdf",
              fileType: "pdf",
              fileSizeBytes: 100,
              policyVersion: "annual-report-manual-first.v1",
              uploadUrl:
                "/v1/workspaces/44444444-4444-4444-8444-444444444444/annual-report-upload-sessions/88888888-8888-4888-8888-888888888888/file",
              maxSizeBytes: 26214400,
              expiresAt: "2026-03-07T09:15:00.000Z",
              status: "created",
              createdAt: "2026-03-07T09:00:00.000Z",
              updatedAt: "2026-03-07T09:00:00.000Z",
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

    const user = userEvent.setup();
    renderWorkspaceDetailPageV1();

    await waitFor(() => {
      expect(
        screen.getByText(
          "The annual report could not be analyzed. Upload the annual report again.",
        ),
      ).toBeInTheDocument();
    });

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

    await user.click(screen.getByRole("button", { name: "Retry analysis" }));

    await waitFor(() => {
      expect(uploadSessionRequests).toBe(1);
    });
  });
});
