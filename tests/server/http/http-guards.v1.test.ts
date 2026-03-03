import { describe, expect, it } from "vitest";

import {
  createJsonErrorResponseV1,
  createMethodNotAllowedResponseV1,
} from "../../../src/server/http/http-error.v1";
import { validatePostOriginV1 } from "../../../src/server/http/origin-guard.v1";
import {
  createTenantMismatchResponseV1,
  extractSessionTokenFromRequestV1,
} from "../../../src/server/http/session-guard.v1";

describe("http guard helpers v1", () => {
  it("createJsonErrorResponseV1 redacts server error message", async () => {
    const response = createJsonErrorResponseV1({
      status: 500,
      code: "PERSISTENCE_ERROR",
      message: "raw internal details",
      userMessage: "safe message",
    });

    const body = (await response.json()) as {
      error: { message: string; user_message: string };
      ok: false;
    };

    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe("safe message");
    expect(body.error.user_message).toBe("safe message");
  });

  it("createMethodNotAllowedResponseV1 includes Allow header", async () => {
    const response = createMethodNotAllowedResponseV1(["GET", "POST"]);

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, POST");
  });

  it("validatePostOriginV1 rejects mismatched origin", async () => {
    const request = new Request("https://app.example.com/v1/workspaces", {
      method: "POST",
      headers: {
        Origin: "https://evil.example.com",
      },
    });

    const response = validatePostOriginV1({
      request,
      appBaseUrl: new URL("https://app.example.com"),
    });

    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);
  });

  it("extractSessionTokenFromRequestV1 reads dink_session_v1 cookie", () => {
    const request = new Request("https://app.example.com/v1/auth", {
      headers: {
        Cookie: "foo=bar; dink_session_v1=session-token; other=1",
      },
    });

    expect(extractSessionTokenFromRequestV1(request)).toBe("session-token");
  });

  it("createTenantMismatchResponseV1 returns null when tenant ids match", () => {
    const response = createTenantMismatchResponseV1({
      requestTenantId: "tenant-1",
      sessionTenantId: "tenant-1",
      userMessage: "mismatch",
    });

    expect(response).toBeNull();
  });
});
