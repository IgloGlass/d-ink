import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMagicLinkInviteV1,
  fetchCurrentSessionV1,
  logoutSessionV1,
} from "../../src/client/lib/http/auth-api";
import { ApiClientError } from "../../src/client/lib/http/api-client";
import { listWorkspacesByTenantV1 } from "../../src/client/lib/http/workspace-api";

function mockJsonResponse(input: { body: unknown; status: number }): Response {
  return new Response(JSON.stringify(input.body), {
    status: input.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("client HTTP contract regression", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts valid payloads that match shared contracts", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            principal: {
              tenantId: "11111111-1111-4111-8111-111111111111",
              userId: "22222222-2222-4222-8222-222222222222",
              emailNormalized: "editor@example.com",
              role: "Editor",
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 201,
          body: {
            ok: true,
            invite: {
              id: "33333333-3333-4333-8333-333333333333",
              tenantId: "11111111-1111-4111-8111-111111111111",
              emailNormalized: "invitee@example.com",
              role: "Editor",
              status: "pending",
              invitedByUserId: "22222222-2222-4222-8222-222222222222",
              createdAt: "2026-02-24T10:00:00.000Z",
              expiresAt: "2026-02-25T10:00:00.000Z",
              acceptedAt: null,
              acceptedByUserId: null,
              revokedAt: null,
            },
            magicLinkExpiresAt: "2026-02-25T10:00:00.000Z",
            magicLinkUrl:
              "https://app.example.test/v1/auth/magic-link/consume?tenantId=11111111-1111-4111-8111-111111111111&token=opaque",
          },
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 200,
          body: {
            ok: true,
          },
        }),
      );

    const session = await fetchCurrentSessionV1();
    expect(session.ok).toBe(true);
    expect(session.principal.role).toBe("Editor");

    const invite = await createMagicLinkInviteV1({
      tenantId: "11111111-1111-4111-8111-111111111111",
      inviteeEmail: "invitee@example.com",
      inviteeRole: "Editor",
    });
    expect(invite.ok).toBe(true);
    expect(invite.magicLinkUrl).toContain("/v1/auth/magic-link/consume");

    const logout = await logoutSessionV1();
    expect(logout.ok).toBe(true);
  });

  it("rejects payloads that drift from shared response schemas", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockJsonResponse({
        status: 200,
        body: {
          ok: true,
          workspaces: [
            {
              id: "not-a-uuid",
              tenantId: "11111111-1111-4111-8111-111111111111",
              companyId: "44444444-4444-4444-8444-444444444444",
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

    await expect(
      listWorkspacesByTenantV1({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_RESPONSE_SCHEMA",
      status: 200,
    });
  });
});
