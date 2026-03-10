import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../src/client/app/providers";
import { WorkspaceDashboardPageV1 } from "../../src/client/features/workspaces/workspace-dashboard-page.v1";

const sessionPrincipalMock = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  emailNormalized: "editor@example.com",
  role: "Editor" as const,
};

vi.mock("../../src/client/app/session-context", () => ({
  useRequiredSessionPrincipalV1: () => sessionPrincipalMock,
}));

function mockJsonResponse(input: { body: unknown; status: number }): Response {
  return new Response(JSON.stringify(input.body), {
    status: input.status,
    headers: { "Content-Type": "application/json" },
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

describe("WorkspaceDashboardPageV1", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the four module cards and opens a module route", async () => {
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

      if (url.startsWith("/v1/companies?") && method === "GET") {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            companies: [
              {
                id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                tenantId: sessionPrincipalMock.tenantId,
                legalName: "Beta AB",
                organizationNumber: "5562342345",
                defaultFiscalYearStart: "2025-01-01",
                defaultFiscalYearEnd: "2025-12-31",
                createdAt: "2026-03-05T10:00:00.000Z",
                updatedAt: "2026-03-05T10:00:00.000Z",
              },
            ],
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND");
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

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={["/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId"
              element={<WorkspaceDashboardPageV1 />}
            />
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<div>Module Route Loaded</div>}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Beta AB" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Recommended next module: Annual Report Analysis/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open module" })).toHaveLength(4);

    await user.click(screen.getAllByRole("button", { name: "Open module" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Module Route Loaded")).toBeInTheDocument();
    });
  });
});
