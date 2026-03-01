import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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

import { WorkspaceListPage } from "../../src/client/features/workspaces/workspace-list-page";

function mockJsonResponse(input: { body: unknown; status: number }): Response {
  return new Response(JSON.stringify(input.body), {
    status: input.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("WorkspaceListPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads workspaces and renders list", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockJsonResponse({
        status: 200,
        body: {
          ok: true,
          workspaces: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "55555555-5555-4555-8555-555555555555",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-02-24T10:00:00.000Z",
              updatedAt: "2026-02-24T10:00:00.000Z",
            },
          ],
        },
      }),
    );

    render(
      <AppProviders>
        <MemoryRouter>
          <WorkspaceListPage />
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Tenant workspace list")).toBeInTheDocument();
      expect(screen.getByText("44444444")).toBeInTheDocument();
    });
  });

  it("creates workspace and refreshes list", async () => {
    const workspaces: Array<{ id: string; companyId: string }> = [
      {
        id: "44444444-4444-4444-8444-444444444444",
        companyId: "55555555-5555-4555-8555-555555555555",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.startsWith("/v1/workspaces?") && method === "GET") {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspaces: workspaces.map((workspace) => ({
              id: workspace.id,
              tenantId: sessionPrincipalMock.tenantId,
              companyId: workspace.companyId,
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-02-24T10:00:00.000Z",
              updatedAt: "2026-02-24T10:00:00.000Z",
            })),
          },
        });
      }

      if (url === "/v1/workspaces" && method === "POST") {
        workspaces.push({
          id: "66666666-6666-4666-8666-666666666666",
          companyId: "77777777-7777-4777-8777-777777777777",
        });

        return mockJsonResponse({
          status: 201,
          body: {
            ok: true,
            workspace: {
              id: "66666666-6666-4666-8666-666666666666",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "77777777-7777-4777-8777-777777777777",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-02-24T10:00:00.000Z",
              updatedAt: "2026-02-24T10:00:00.000Z",
            },
            auditEvent: {
              id: "88888888-8888-4888-8888-888888888888",
              tenantId: sessionPrincipalMock.tenantId,
              workspaceId: "66666666-6666-4666-8666-666666666666",
              actorType: "user",
              actorUserId: sessionPrincipalMock.userId,
              eventType: "workspace.created",
              targetType: "workspace",
              targetId: "66666666-6666-4666-8666-666666666666",
              after: {
                status: "draft",
              },
              timestamp: "2026-02-24T10:00:01.000Z",
              context: {
                actorRole: sessionPrincipalMock.role,
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

    render(
      <AppProviders>
        <MemoryRouter>
          <WorkspaceListPage />
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("44444444")).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText("xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx"),
      "77777777-7777-4777-8777-777777777777",
    );
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() => {
      expect(screen.getByText("66666666")).toBeInTheDocument();
    });
  });
});
