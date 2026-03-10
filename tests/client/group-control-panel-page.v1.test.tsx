import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../src/client/app/providers";
import { GroupControlPanelPageV1 } from "../../src/client/features/groups/group-control-panel-page.v1";

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

describe("GroupControlPanelPageV1", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders display-ready company data and opens the workspace dashboard", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

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
        <MemoryRouter initialEntries={["/app/groups/default/control-panel"]}>
          <Routes>
            <Route
              path="/app/groups/:groupId/control-panel"
              element={<GroupControlPanelPageV1 />}
            />
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

    expect(screen.getByText("556234-2345")).toBeInTheDocument();
    expect(screen.getByText("Open dashboard")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open dashboard" }));

    await waitFor(() => {
      expect(screen.getByText("Dashboard Loaded")).toBeInTheDocument();
    });
  });
});
