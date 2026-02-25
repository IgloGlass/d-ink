import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  inviteHandler,
  consumeHandler,
  authenticateHandler,
  currentSessionHandler,
  logoutHandler,
} = vi.hoisted(() => ({
  inviteHandler: vi.fn(async () => new Response(null, { status: 201 })),
  consumeHandler: vi.fn(async () => new Response(null, { status: 303 })),
  authenticateHandler: vi.fn(async () => new Response(null, { status: 200 })),
  currentSessionHandler: vi.fn(async () => new Response(null, { status: 200 })),
  logoutHandler: vi.fn(async () => new Response(null, { status: 200 })),
}));

vi.mock("../../../src/server/http/auth-create-invite.handler.v1", () => ({
  handleAuthCreateInviteV1: inviteHandler,
}));
vi.mock("../../../src/server/http/auth-consume.handler.v1", () => ({
  handleAuthConsumeV1: consumeHandler,
}));
vi.mock("../../../src/server/http/auth-authenticate.handler.v1", () => ({
  handleAuthAuthenticateSessionV1: authenticateHandler,
}));
vi.mock("../../../src/server/http/auth-current-session.handler.v1", () => ({
  handleAuthCurrentSessionV1: currentSessionHandler,
}));
vi.mock("../../../src/server/http/auth-logout.handler.v1", () => ({
  handleAuthLogoutV1: logoutHandler,
}));

import { handleAuthMagicLinkRoutesV1 } from "../../../src/server/http/auth-magic-link-routes.v1";
import type { Env } from "../../../src/shared/types/env";

function buildEnv(): Env {
  return {
    APP_BASE_URL: "https://app.dink.test",
    AUTH_TOKEN_HMAC_SECRET: "secret",
    DB: {} as Env["DB"],
  };
}

describe("auth-magic-link-routes v1 dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches POST invite to invite handler", async () => {
    const response = await handleAuthMagicLinkRoutesV1(
      new Request("https://app.dink.test/v1/auth/magic-link/invites", {
        method: "POST",
      }),
      buildEnv(),
    );

    expect(response.status).toBe(201);
    expect(inviteHandler).toHaveBeenCalledTimes(1);
  });

  it("returns 405 for wrong invite method", async () => {
    const response = await handleAuthMagicLinkRoutesV1(
      new Request("https://app.dink.test/v1/auth/magic-link/invites", {
        method: "GET",
      }),
      buildEnv(),
    );

    expect(response.status).toBe(405);
    expect(inviteHandler).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown auth route", async () => {
    const response = await handleAuthMagicLinkRoutesV1(
      new Request("https://app.dink.test/v1/auth/unknown", {
        method: "GET",
      }),
      buildEnv(),
    );

    expect(response.status).toBe(404);
  });
});
