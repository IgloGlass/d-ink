import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../src/client/app/providers";
import { CoreModuleShellPageV1 } from "../../src/client/features/modules/core-module-shell-page.v1";

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

describe("CoreModuleShellPageV1", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders tax adjustments sidebar groups and final panel", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return mockJsonResponse({
        status: 404,
        body: {
          ok: false,
          error: {
            code: "ADJUSTMENTS_NOT_FOUND",
            message: "Not found",
            user_message: "Not found",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/tax-adjustments",
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
        screen.getByRole("heading", { name: "General Client Information" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Common")).toBeInTheDocument();
      expect(
        screen.getAllByText("Final Tax Calculation").length,
      ).toBeGreaterThan(0);
    });
  });
});
