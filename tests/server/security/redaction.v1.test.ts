import { describe, expect, it } from "vitest";

import { redactSensitiveLogFieldsV1 } from "../../../src/server/security/redaction.v1";

describe("redaction utility v1", () => {
  it("redacts sensitive keys recursively", () => {
    const input = {
      fileBytesBase64: "abc123",
      nested: {
        contentBase64: "payload",
        token: "secret-token",
        authorization: "Bearer token",
        cookie: "session=value",
      },
      items: [
        {
          snippet: "source text",
          safe: "ok",
        },
      ],
      safeField: "visible",
    };

    const redacted = redactSensitiveLogFieldsV1(input) as Record<
      string,
      unknown
    >;
    const nested = redacted.nested as Record<string, unknown>;
    const item = (redacted.items as Array<Record<string, unknown>>)[0];

    expect(redacted.fileBytesBase64).toBe("[REDACTED]");
    expect(nested.contentBase64).toBe("[REDACTED]");
    expect(nested.token).toBe("[REDACTED]");
    expect(nested.authorization).toBe("[REDACTED]");
    expect(nested.cookie).toBe("[REDACTED]");
    expect(item?.snippet).toBe("[REDACTED]");
    expect(item?.safe).toBe("ok");
    expect(redacted.safeField).toBe("visible");
  });
});
