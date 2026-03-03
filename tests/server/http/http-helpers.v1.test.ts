import { describe, expect, it } from "vitest";

import {
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
});
