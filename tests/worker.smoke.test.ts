import { describe, expect, it } from "vitest";
import type { Env } from "../src/shared/types/env";
import worker from "../src/worker";

describe("worker scaffold", () => {
  it("returns a stable scaffold response", async () => {
    const request = new Request("https://example.com/");
    const response = await worker.fetch(request, {} as Env);
    const payload = (await response.json()) as {
      marker: string;
    };

    expect(response.status).toBe(501);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(payload.marker).toBe("dink_scaffold_ready");
  });
});
