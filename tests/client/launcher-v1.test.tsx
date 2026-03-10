import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LauncherV1 } from "../../src/client/components/launcher-v1";
import { listWorkspacesByTenantV1 } from "../../src/client/lib/http/workspace-api";

const navigateMock = vi.fn();
const setActiveContextMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../src/client/app/app-context.v1", () => ({
  useGlobalAppContextV1: () => ({
    setActiveContext: setActiveContextMock,
  }),
}));

vi.mock("../../src/client/lib/http/workspace-api", () => ({
  listWorkspacesByTenantV1: vi.fn(),
}));

describe("LauncherV1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes fiscal-year key and navigates to canonical workspace path", async () => {
    vi.mocked(listWorkspacesByTenantV1).mockResolvedValue({
      ok: true,
      workspaces: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          tenantId: "11111111-1111-4111-8111-111111111111",
          companyId: "Gamma AB",
          fiscalYearStart: "2025-01-01",
          fiscalYearEnd: "2025-12-31",
          status: "draft",
          createdAt: "2026-03-07T12:00:00.000Z",
          updatedAt: "2026-03-07T12:00:00.000Z",
        },
      ],
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LauncherV1
            isOpen={true}
            onClose={onClose}
            tenantId="11111111-1111-4111-8111-111111111111"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Gamma AB/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Gamma AB/i }));

    expect(setActiveContextMock).toHaveBeenCalledWith({
      activeWorkspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      activeFiscalYear: "2025",
    });
    expect(navigateMock).toHaveBeenCalledWith(
      "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(onClose).toHaveBeenCalled();
  });
});

