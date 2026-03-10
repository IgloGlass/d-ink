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

  it("filters companies and opens the company dashboard for an existing workspace", async () => {
    localStorage.setItem("dink.activeFiscalYear", "2025");

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
              path="/app/workspaces/:workspaceId"
              element={<div>Dashboard Loaded</div>}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: /search companies and open the workspace/i,
        }),
      ).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Search company"), "Beta");
    await user.click(screen.getByRole("button", { name: "Open company" }));

    await waitFor(() => {
      expect(screen.getByText("Dashboard Loaded")).toBeInTheDocument();
    });
  });

  it("opens the existing workspace dashboard when the company card body is clicked", async () => {
    localStorage.setItem("dink.activeFiscalYear", "2025");

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
              path="/app/workspaces/:workspaceId"
              element={<div>Dashboard Loaded</div>}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Beta AB")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Beta AB"));

    await waitFor(() => {
      expect(screen.getByText("Dashboard Loaded")).toBeInTheDocument();
    });
  });

  it("creates the workspace for the selected fiscal year when none exists", async () => {
    localStorage.setItem("dink.activeFiscalYear", "2026");

    let createWorkspaceBody: Record<string, unknown> | null = null;

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
            ],
          },
        });
      }

      if (url.startsWith("/v1/workspaces?") && method === "GET") {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspaces: [],
          },
        });
      }

      if (url === "/v1/workspaces" && method === "POST") {
        createWorkspaceBody = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;

        return mockJsonResponse({
          status: 201,
          body: {
            ok: true,
            workspace: {
              id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              fiscalYearStart: "2026-01-01",
              fiscalYearEnd: "2026-12-31",
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
              path="/app/workspaces/:workspaceId"
              element={<div>Dashboard Loaded</div>}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Create 2026 workspace" }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Create 2026 workspace" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Dashboard Loaded")).toBeInTheDocument();
    });

    expect(createWorkspaceBody).toMatchObject({
      companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      fiscalYearStart: "2026-01-01",
      fiscalYearEnd: "2026-12-31",
      tenantId: sessionPrincipalMock.tenantId,
    });
  });

  it("auto-seeds a local test company when the tenant has no companies", async () => {
    localStorage.removeItem("dink.activeFiscalYear");

    let companyListCalls = 0;
    let createCompanyBody: Record<string, unknown> | null = null;
    let createWorkspaceBody: Record<string, unknown> | null = null;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.startsWith("/v1/companies?") && method === "GET") {
        companyListCalls += 1;
        if (companyListCalls === 1) {
          return mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              companies: [],
            },
          });
        }

        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            companies: [
              {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                legalName: "Test Company AB",
                organizationNumber: "5561231234",
                defaultFiscalYearStart: "2026-01-01",
                defaultFiscalYearEnd: "2026-12-31",
                createdAt: "2026-03-06T10:00:00.000Z",
                updatedAt: "2026-03-06T10:00:00.000Z",
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
            workspaces: [],
          },
        });
      }

      if (url === "/v1/companies" && method === "POST") {
        createCompanyBody = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;

        return mockJsonResponse({
          status: 201,
          body: {
            ok: true,
            company: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              legalName: "Test Company AB",
              organizationNumber: "5561231234",
              defaultFiscalYearStart: "2026-01-01",
              defaultFiscalYearEnd: "2026-12-31",
              createdAt: "2026-03-06T10:00:00.000Z",
              updatedAt: "2026-03-06T10:00:00.000Z",
            },
          },
        });
      }

      if (url === "/v1/workspaces" && method === "POST") {
        createWorkspaceBody = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;

        return mockJsonResponse({
          status: 201,
          body: {
            ok: true,
            workspace: {
              id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              fiscalYearStart: "2026-01-01",
              fiscalYearEnd: "2026-12-31",
              status: "draft",
              createdAt: "2026-03-06T10:00:00.000Z",
              updatedAt: "2026-03-06T10:00:00.000Z",
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
              timestamp: "2026-03-06T10:00:01.000Z",
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

    render(
      <AppProviders>
        <MemoryRouter initialEntries={["/app/workspaces"]}>
          <Routes>
            <Route path="/app/workspaces" element={<CompanySelectorPageV1 />} />
            <Route
              path="/app/workspaces/:workspaceId"
              element={<div>Dashboard Loaded</div>}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Dashboard Loaded")).toBeInTheDocument();
    });

    expect(createCompanyBody).toMatchObject({
      legalName: "Test Company AB",
      organizationNumber: "5561231234",
      tenantId: sessionPrincipalMock.tenantId,
    });
    expect(createWorkspaceBody).toMatchObject({
      companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      fiscalYearStart: "2026-01-01",
      fiscalYearEnd: "2026-12-31",
      tenantId: sessionPrincipalMock.tenantId,
    });
  });

  it("falls back to current year when persisted fiscal-year context is invalid for company creation", async () => {
    localStorage.setItem("dink.activeFiscalYear", "2025-01-01 to 2025-12-31");
    const fallbackYear = String(new Date().getFullYear());

    let createCompanyBody: Record<string, unknown> | null = null;
    let createWorkspaceBody: Record<string, unknown> | null = null;

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
                id: "99999999-9999-4999-8999-999999999999",
                tenantId: sessionPrincipalMock.tenantId,
                legalName: "Existing AB",
                organizationNumber: "5560000000",
                defaultFiscalYearStart: "2025-01-01",
                defaultFiscalYearEnd: "2025-12-31",
                createdAt: "2026-03-06T10:00:00.000Z",
                updatedAt: "2026-03-06T10:00:00.000Z",
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
            workspaces: [],
          },
        });
      }

      if (url === "/v1/companies" && method === "POST") {
        createCompanyBody = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        return mockJsonResponse({
          status: 201,
          body: {
            ok: true,
            company: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              legalName: "Gamma AB",
              organizationNumber: "5565555555",
              defaultFiscalYearStart: `${fallbackYear}-01-01`,
              defaultFiscalYearEnd: `${fallbackYear}-12-31`,
              createdAt: "2026-03-06T10:00:00.000Z",
              updatedAt: "2026-03-06T10:00:00.000Z",
            },
          },
        });
      }

      if (url === "/v1/workspaces" && method === "POST") {
        createWorkspaceBody = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        return mockJsonResponse({
          status: 201,
          body: {
            ok: true,
            workspace: {
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              fiscalYearStart: `${fallbackYear}-01-01`,
              fiscalYearEnd: `${fallbackYear}-12-31`,
              status: "draft",
              createdAt: "2026-03-06T10:00:00.000Z",
              updatedAt: "2026-03-06T10:00:00.000Z",
            },
            auditEvent: {
              id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              tenantId: sessionPrincipalMock.tenantId,
              workspaceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              actorType: "user",
              actorUserId: sessionPrincipalMock.userId,
              eventType: "workspace.created",
              targetType: "workspace",
              targetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              after: { status: "draft" },
              timestamp: "2026-03-06T10:00:01.000Z",
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
              path="/app/workspaces/:workspaceId"
              element={<div>Dashboard Loaded</div>}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await user.click(screen.getByRole("button", { name: "Create new company" }));
    expect(
      await screen.findByText(
        `Fiscal year filter is invalid. New company setup will use ${fallbackYear}.`,
      ),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Legal name"), "Gamma AB");
    await user.type(screen.getByLabelText("Organization number"), "556555-5555");
    await user.click(
      screen.getByRole("button", { name: "Create company and workspace" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Dashboard Loaded")).toBeInTheDocument();
    });

    expect(createCompanyBody).toMatchObject({
      tenantId: sessionPrincipalMock.tenantId,
      legalName: "Gamma AB",
      organizationNumber: "5565555555",
      defaultFiscalYearStart: `${fallbackYear}-01-01`,
      defaultFiscalYearEnd: `${fallbackYear}-12-31`,
    });
    expect(createWorkspaceBody).toMatchObject({
      tenantId: sessionPrincipalMock.tenantId,
      companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      fiscalYearStart: `${fallbackYear}-01-01`,
      fiscalYearEnd: `${fallbackYear}-12-31`,
    });
  });
});
