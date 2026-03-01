import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../src/client/app/providers";

const sessionPrincipalMock: {
  emailNormalized: string;
  role: "Admin" | "Editor";
  tenantId: string;
  userId: string;
} = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  emailNormalized: "admin@example.com",
  role: "Admin",
};

vi.mock("../../src/client/app/session-context", () => ({
  useRequiredSessionPrincipalV1: () => sessionPrincipalMock,
}));

import { InvitePage } from "../../src/client/features/auth/invite-page";

function mockJsonResponse(input: { body: unknown; status: number }): Response {
  return new Response(JSON.stringify(input.body), {
    status: input.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("InvitePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionPrincipalMock.role = "Admin";
  });

  it("renders forbidden state for non-admin users", async () => {
    sessionPrincipalMock.role = "Editor";

    render(
      <AppProviders>
        <InvitePage />
      </AppProviders>,
    );

    expect(
      screen.getByText("Only Admin users can generate invite links."),
    ).toBeInTheDocument();
  });

  it("submits invite and renders copyable magic link URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockJsonResponse({
        status: 201,
        body: {
          ok: true,
          invite: {
            id: "33333333-3333-4333-8333-333333333333",
            tenantId: sessionPrincipalMock.tenantId,
            emailNormalized: "new.user@example.com",
            role: "Editor",
            status: "pending",
            invitedByUserId: sessionPrincipalMock.userId,
            createdAt: "2026-02-24T12:00:00.000Z",
            expiresAt: "2026-03-03T12:00:00.000Z",
            acceptedAt: null,
            acceptedByUserId: null,
            revokedAt: null,
          },
          magicLinkExpiresAt: "2026-02-24T12:15:00.000Z",
          magicLinkUrl:
            "https://app.dink.test/v1/auth/magic-link/consume?tenantId=11111111-1111-4111-8111-111111111111&token=abc",
        },
      }),
    );

    const user = userEvent.setup();

    render(
      <AppProviders>
        <InvitePage />
      </AppProviders>,
    );

    await user.type(
      screen.getByLabelText("Invitee email"),
      "new.user@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Generate invite link" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Invite link ready")).toBeInTheDocument();
      expect(
        screen.getByDisplayValue(/\/v1\/auth\/magic-link\/consume/),
      ).toBeInTheDocument();
    });

    const fetchArgs = fetchMock.mock.calls[0];
    expect(fetchArgs?.[0]).toBe("/v1/auth/magic-link/invites");
    expect(fetchArgs?.[1]).toMatchObject({
      method: "POST",
    });
  });
});
