import { render, screen, waitFor } from "@testing-library/react";
import {
  Navigate,
  RouterProvider,
  createMemoryRouter,
  useOutletContext,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../src/client/app/providers";
import { SessionGate } from "../../src/client/features/auth/session-gate";
import { type SessionPrincipalV1 } from "../../src/client/lib/http/auth-api";

function mockJsonResponse(input: { body: unknown; status: number }): Response {
  return new Response(JSON.stringify(input.body), {
    status: input.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function PrincipalProbe() {
  const principal = useOutletContext<SessionPrincipalV1>();
  return <div>{principal.emailNormalized}</div>;
}

describe("SessionGate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches current session once and passes principal through outlet context", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
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
          path: "/app",
          element: <SessionGate />,
          children: [
            {
              index: true,
              element: <Navigate replace to="/app/workspaces" />,
            },
            {
              path: "workspaces",
              element: <PrincipalProbe />,
            },
          ],
        },
      ],
      {
        initialEntries: ["/app"],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("user@example.com")).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
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
          path: "/app",
          element: <SessionGate />,
          children: [
            {
              path: "workspaces",
              element: <div>Workspace Home</div>,
            },
          ],
        },
      ],
      {
        initialEntries: ["/app/workspaces"],
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
    expect(screen.queryByText("Workspace Home")).not.toBeInTheDocument();
  });

  it("shows auth-code hint when redirected after failed invite authentication", async () => {
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
          path: "/app",
          element: <SessionGate />,
          children: [
            {
              path: "workspaces",
              element: <div>Workspace Home</div>,
            },
          ],
        },
      ],
      {
        initialEntries: ["/app/workspaces?auth=error&code=TOKEN_INVALID_OR_EXPIRED"],
      },
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "This magic link is invalid or expired. Ask an Admin for a new invite.",
        ),
      ).toBeInTheDocument();
    });
  });
});
