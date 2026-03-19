import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/worker", () => ({
  default: {
    fetch: vi.fn(),
  },
}));

describe("Pages annual-report proxy", () => {
  it("forwards a fresh request body to the API worker", async () => {
    const apiWorkerFetch = vi.fn().mockResolvedValue(new Response("ok"));
    const { onRequest } = await import("../../functions/v1/[[route]]");

    const requestBody = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x0a]);
    const response = await onRequest({
      env: {
        API_WORKER: {
          fetch: apiWorkerFetch,
        },
      },
      request: new Request(
        "https://d-ink-demo.pages.dev/v1/workspaces/123/annual-report-upload-sessions/456/file?tenantId=789",
        {
          method: "PUT",
          body: requestBody,
          headers: {
            "Content-Type": "application/pdf",
          },
        },
      ),
      waitUntil: () => {},
    } as never);

    expect(response.status).toBe(200);
    expect(apiWorkerFetch).toHaveBeenCalledTimes(1);

    const forwardedRequest = apiWorkerFetch.mock.calls[0][0] as Request;
    expect(forwardedRequest.method).toBe("PUT");
    expect(forwardedRequest.url).toBe(
      "https://d-ink-demo.pages.dev/v1/workspaces/123/annual-report-upload-sessions/456/file?tenantId=789",
    );
    expect(forwardedRequest.headers.get("Content-Type")).toBe(
      "application/pdf",
    );
    expect(new Uint8Array(await forwardedRequest.arrayBuffer())).toEqual(
      requestBody,
    );
  });
});
