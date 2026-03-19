import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiClientError,
  apiRequest,
  toUserFacingErrorMessage,
} from "../../src/client/lib/http/api-client";

function mockJsonResponse(input: { body: unknown; status: number }): Response {
  return new Response(JSON.stringify(input.body), {
    status: input.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api-client v1", () => {
  it("retries a GET request once after a transient network failure", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            value: "recovered",
          },
        }),
      );

    const result = await apiRequest<{ ok: true; value: string }>({
      method: "GET",
      path: "/v1/test",
      parseResponse: (payload) => payload as { ok: true; value: string },
    });

    expect(result.value).toBe("recovered");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not retry a POST request after a transient network failure", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("offline"));

    await expect(
      apiRequest({
        method: "POST",
        body: { value: "submit" },
        path: "/v1/test",
        parseResponse: (payload) => payload,
      }),
    ).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      retryable: true,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("marks invalid responses as non-retryable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockJsonResponse({
        status: 200,
        body: {
          ok: true,
          value: "recovered",
        },
      }),
    );

    await expect(
      apiRequest({
        method: "GET",
        path: "/v1/test",
        parseResponse: () => {
          throw new Error("schema mismatch");
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      retryable: false,
    });
  });

  it("exposes retryable server failures distinctly", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      mockJsonResponse({
        status: 503,
        body: {
          ok: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Try again",
            user_message: "Try again",
            context: {},
          },
        },
      }),
    );

    await expect(
      apiRequest({
        method: "GET",
        path: "/v1/test",
        parseResponse: (payload) => payload,
      }),
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      retryable: true,
      status: 503,
    });
  });

  it("returns the API client user message directly for recoverable errors", () => {
    const error = new ApiClientError({
      status: 408,
      code: "REQUEST_TIMEOUT",
      message: "API request timed out.",
      retryable: true,
      userMessage:
        "The request took too long and was stopped. Please try again.",
    });

    expect(toUserFacingErrorMessage(error)).toBe(
      "The request took too long and was stopped. Please try again.",
    );
    expect(error.retryable).toBe(true);
  });
});
