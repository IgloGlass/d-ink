import { describe, expect, it } from "vitest";

import {
  createServiceFailureResponseV1,
  isJsonBodyReadErrorV1,
  readJsonBodyV1,
} from "../../../src/server/http/http-helpers.v1";

describe("http helpers v1", () => {
  it("returns parsed JSON body when within size limits", async () => {
    const request = new Request("https://app.dink.test/v1/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ok: true,
      }),
    });

    const body = await readJsonBodyV1(request, {
      maxBytes: 1024,
    });

    expect(isJsonBodyReadErrorV1(body)).toBe(false);
    expect(body).toEqual({
      ok: true,
    });
  });

  it("returns content_length_invalid when Content-Length header is malformed", async () => {
    const request = new Request("https://app.dink.test/v1/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "abc",
      },
      body: JSON.stringify({
        ok: true,
      }),
    });

    const body = await readJsonBodyV1(request, {
      maxBytes: 1024,
    });

    expect(isJsonBodyReadErrorV1(body)).toBe(true);
    if (isJsonBodyReadErrorV1(body)) {
      expect(body.reason).toBe("content_length_invalid");
    }
  });

  it("returns payload_too_large when body exceeds configured limit", async () => {
    const request = new Request("https://app.dink.test/v1/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        value: "x".repeat(1024),
      }),
    });

    const body = await readJsonBodyV1(request, {
      maxBytes: 100,
    });

    expect(isJsonBodyReadErrorV1(body)).toBe(true);
    if (isJsonBodyReadErrorV1(body)) {
      expect(body.reason).toBe("payload_too_large");
      expect(body.maxBytes).toBe(100);
    }
  });

  it("maps service failures to the shared JSON error envelope", async () => {
    const response = createServiceFailureResponseV1({
      status: 409,
      failure: {
        error: {
          code: "STATE_CONFLICT",
          context: {
            workspaceId: "workspace-1",
          },
          message: "Workspace state is stale.",
          user_message: "Workspace changed. Refresh and retry.",
        },
      },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "STATE_CONFLICT",
        context: {
          workspaceId: "workspace-1",
        },
        message: "Workspace state is stale.",
        user_message: "Workspace changed. Refresh and retry.",
      },
    });
  });

  it("supports response code override for fallback mapping", async () => {
    const response = createServiceFailureResponseV1({
      status: 500,
      code: "PERSISTENCE_ERROR",
      failure: {
        error: {
          code: "UNKNOWN_FAILURE",
          context: {
            runId: "run-123",
          },
          message: "Unexpected dependency error.",
          user_message: "An internal error occurred.",
        },
      },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "PERSISTENCE_ERROR",
        context: {
          runId: "run-123",
        },
        message: "An internal error occurred.",
        user_message: "An internal error occurred.",
      },
    });
  });
});
