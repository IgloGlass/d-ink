import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../src/client/app/providers";
import { SessionGate } from "../../src/client/features/auth/session-gate";

function mockJsonResponse(input: { body: unknown; status: number }): Response {
  return new Response(JSON.stringify(input.body), {
    status: input.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("SessionGate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders unauthenticated guidance when session is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockJsonResponse({
        status: 401,
        body: {
          ok: false,
          error: {
            code: "SESSION_MISSING",
            message: "A valid authenticated session is required.",
            user_message: "A valid authenticated session is required.",
            context: {},
          },
        },
      }),
    );

    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <SessionGate />,
        },
      ],
      {
        initialEntries: ["/"],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Open your invite magic link to sign in."),
      ).toBeInTheDocument();
    });
  });

  it("navigates authenticated users to workspace route", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockJsonResponse({
        status: 200,
        body: {
          ok: true,
          principal: {
            tenantId: "11111111-1111-4111-8111-111111111111",
            userId: "22222222-2222-4222-8222-222222222222",
            emailNormalized: "user@example.com",
            role: "Admin",
          },
        },
      }),
    );

    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <SessionGate />,
        },
        {
          path: "/app/workspaces",
          element: <div>Workspace Home</div>,
        },
      ],
      {
        initialEntries: ["/"],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Workspace Home")).toBeInTheDocument();
    });
  });

  it("supports local quick dev sign-in when magic-link session is missing", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 401,
          body: {
            ok: false,
            error: {
              code: "SESSION_MISSING",
              message: "A valid authenticated session is required.",
              user_message: "A valid authenticated session is required.",
              context: {},
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            principal: {
              tenantId: "11111111-1111-4111-8111-111111111111",
              userId: "33333333-3333-4333-8333-333333333333",
              emailNormalized: "dev.user@example.com",
              role: "Admin",
            },
            session: {
              id: "44444444-4444-4444-8444-444444444444",
              tenantId: "11111111-1111-4111-8111-111111111111",
              userId: "33333333-3333-4333-8333-333333333333",
              createdAt: "2026-01-01T00:00:00.000Z",
              expiresAt: "2026-01-02T00:00:00.000Z",
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            principal: {
              tenantId: "11111111-1111-4111-8111-111111111111",
              userId: "33333333-3333-4333-8333-333333333333",
              emailNormalized: "dev.user@example.com",
              role: "Admin",
            },
          },
        }),
      );

    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <SessionGate />,
        },
        {
          path: "/app/workspaces",
          element: <div>Workspace Home</div>,
        },
      ],
      {
        initialEntries: ["/"],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Quick dev sign-in")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Sign in for local testing" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Workspace Home")).toBeInTheDocument();
    });
  });
});
