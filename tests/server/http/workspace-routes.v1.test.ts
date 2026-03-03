import { beforeEach, describe, expect, it, vi } from "vitest";

const { listHandler, createHandler, getHandler, transitionHandler } =
  vi.hoisted(() => ({
    listHandler: vi.fn(async () => new Response(null, { status: 200 })),
    createHandler: vi.fn(async () => new Response(null, { status: 201 })),
    getHandler: vi.fn(async () => new Response(null, { status: 200 })),
    transitionHandler: vi.fn(async () => new Response(null, { status: 200 })),
  }));

vi.mock("../../../src/server/http/workspace-list.handler.v1", () => ({
  handleWorkspaceListV1: listHandler,
}));
vi.mock("../../../src/server/http/workspace-create.handler.v1", () => ({
  handleWorkspaceCreateV1: createHandler,
}));
vi.mock("../../../src/server/http/workspace-get.handler.v1", () => ({
  handleWorkspaceGetV1: getHandler,
}));
vi.mock("../../../src/server/http/workspace-transition.handler.v1", () => ({
  handleWorkspaceTransitionV1: transitionHandler,
}));

import { handleWorkspaceRoutesV1 } from "../../../src/server/http/workspace-routes.v1";
import type { Env } from "../../../src/shared/types/env";

function buildEnv(): Env {
  return {
    APP_BASE_URL: "https://app.dink.test",
    AUTH_TOKEN_HMAC_SECRET: "secret",
    DB: {} as Env["DB"],
  };
}

describe("workspace-routes v1 dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches GET /v1/workspaces to list handler", async () => {
    const response = await handleWorkspaceRoutesV1(
      new Request("https://app.dink.test/v1/workspaces", {
        method: "GET",
      }),
      buildEnv(),
    );

    expect(response.status).toBe(200);
    expect(listHandler).toHaveBeenCalledTimes(1);
  });

  it("dispatches GET /v1/workspaces/:id to get handler", async () => {
    const response = await handleWorkspaceRoutesV1(
      new Request("https://app.dink.test/v1/workspaces/workspace-id", {
        method: "GET",
      }),
      buildEnv(),
    );

    expect(response.status).toBe(200);
    expect(getHandler).toHaveBeenCalledTimes(1);
  });

  it("returns 405 for unsupported collection method", async () => {
    const response = await handleWorkspaceRoutesV1(
      new Request("https://app.dink.test/v1/workspaces", {
        method: "DELETE",
      }),
      buildEnv(),
    );

    expect(response.status).toBe(405);
    expect(listHandler).not.toHaveBeenCalled();
    expect(createHandler).not.toHaveBeenCalled();
  });
});
