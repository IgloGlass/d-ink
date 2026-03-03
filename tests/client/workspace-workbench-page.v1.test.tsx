import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../src/client/app/providers";
import { WorkspaceWorkbenchPageV1 } from "../../src/client/features/workspaces/workspace-workbench-page.v1";

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
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("WorkspaceWorkbenchPageV1", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders ordered module cards and opens module shell", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?")
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

      return mockJsonResponse({
        status: 404,
        body: {
          ok: false,
          error: {
            code: "FORM_NOT_FOUND",
            message: "Not found",
            user_message: "Not found",
            context: {},
          },
        },
      });
    });

    const user = userEvent.setup();

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/workbench",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/workbench"
              element={<WorkspaceWorkbenchPageV1 />}
            />
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<div>Module Shell Loaded</div>}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Workspace Workbench" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Annual Report Analysis")).toBeInTheDocument();
      expect(screen.getByText("Tax Return INK2")).toBeInTheDocument();
    });

    await user.click(screen.getAllByText("Open module")[0]);

    await waitFor(() => {
      expect(screen.getByText("Module Shell Loaded")).toBeInTheDocument();
    });
  });
});
