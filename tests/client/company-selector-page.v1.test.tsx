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
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("CompanySelectorPageV1", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("filters results via search and navigates to workbench", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse({
        status: 200,
        body: {
          ok: true,
          workspaces: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: "2026-03-01T10:00:00.000Z",
            },
            {
              id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              fiscalYearStart: "2024-01-01",
              fiscalYearEnd: "2024-12-31",
              status: "in_review",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: "2026-03-01T10:00:00.000Z",
            },
          ],
        },
      }),
    );

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
        screen.getByRole("heading", { name: "Select Company Workspace" }),
      ).toBeInTheDocument();
    });

    await user.type(
      screen.getByLabelText("Search company, workspace, or year"),
      "dddddddd",
    );
    await user.click(screen.getAllByText("Continue")[0]);

    await waitFor(() => {
      expect(screen.getByText("Workbench Loaded")).toBeInTheDocument();
    });
  });
});
