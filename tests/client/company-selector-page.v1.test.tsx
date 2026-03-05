import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../src/client/app/providers";
import { CompanySelectorPageV1 } from "../../src/client/features/workspaces/company-selector-page.v1";

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

describe("CompanySelectorPageV1", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("filters companies via search and opens existing workspace", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.startsWith("/v1/companies?") && method === "GET") {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            companies: [
              {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                legalName: "Alpha AB",
                organizationNumber: "5561231234",
                defaultFiscalYearStart: "2025-01-01",
                defaultFiscalYearEnd: "2025-12-31",
                createdAt: "2026-03-05T10:00:00.000Z",
                updatedAt: "2026-03-05T10:00:00.000Z",
              },
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

      if (url.startsWith("/v1/workspaces?") && method === "GET") {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspaces: [
              {
                id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                tenantId: sessionPrincipalMock.tenantId,
                companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                fiscalYearStart: "2025-01-01",
                fiscalYearEnd: "2025-12-31",
                status: "draft",
                createdAt: "2026-03-05T10:00:00.000Z",
                updatedAt: "2026-03-05T10:00:00.000Z",
              },
            ],
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

    render(
      <AppProviders>
        <MemoryRouter initialEntries={["/app/workspaces"]}>
          <Routes>
            <Route path="/app/workspaces" element={<CompanySelectorPageV1 />} />
            <Route
              path="/app/workspaces/:workspaceId/workbench"
              element={<div>Workbench Loaded</div>}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Create and Open Companies" }),
      ).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Search companies"), "Beta");
    await user.click(
      screen.getByRole("button", { name: "Open company landing" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Workbench Loaded")).toBeInTheDocument();
    });
  });

  it("creates company and initial workspace from the form", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.startsWith("/v1/companies?") && method === "GET") {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, companies: [] },
        });
      }

      if (url.startsWith("/v1/workspaces?") && method === "GET") {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, workspaces: [] },
        });
      }

      if (url === "/v1/companies" && method === "POST") {
        return mockJsonResponse({
          status: 201,
          body: {
            ok: true,
            company: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              legalName: "Created AB",
              organizationNumber: "5567777777",
              defaultFiscalYearStart: "2025-01-01",
              defaultFiscalYearEnd: "2025-12-31",
              createdAt: "2026-03-05T10:00:00.000Z",
              updatedAt: "2026-03-05T10:00:00.000Z",
            },
          },
        });
      }

      if (url === "/v1/workspaces" && method === "POST") {
        return mockJsonResponse({
          status: 201,
          body: {
            ok: true,
            workspace: {
              id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-05T10:00:00.000Z",
              updatedAt: "2026-03-05T10:00:00.000Z",
            },
            auditEvent: {
              id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              tenantId: sessionPrincipalMock.tenantId,
              workspaceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              actorType: "user",
              actorUserId: sessionPrincipalMock.userId,
              eventType: "workspace.created",
              targetType: "workspace",
              targetId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              after: { status: "draft" },
              timestamp: "2026-03-05T10:00:01.000Z",
              context: { actorRole: sessionPrincipalMock.role },
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

    render(
      <AppProviders>
        <MemoryRouter initialEntries={["/app/workspaces"]}>
          <Routes>
            <Route path="/app/workspaces" element={<CompanySelectorPageV1 />} />
            <Route
              path="/app/workspaces/:workspaceId/workbench"
              element={<div>Workbench Loaded</div>}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Create and Open Companies" }),
      ).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText("Examplebolaget AB"),
      "Created AB",
    );
    await user.type(screen.getByPlaceholderText("556123-1234"), "556777-7777");
    await user.click(
      screen.getByRole("button", { name: "Create company and continue" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Workbench Loaded")).toBeInTheDocument();
    });
  });
});
