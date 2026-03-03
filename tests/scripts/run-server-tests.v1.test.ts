import { describe, expect, it } from "vitest";

import {
  filterKnownMiniflareCleanupFromStderrV1,
  isKnownMiniflareEbusyCleanupLineV1,
} from "../../scripts/miniflare-noise-filter.v1.mjs";

describe("run-server-tests noise filter v1", () => {
  it("matches known Miniflare EBUSY cleanup noise lines", () => {
    expect(
      isKnownMiniflareEbusyCleanupLineV1(
        "Error: Unable to remove temporary directory C:\\repo\\.wrangler\\tmp\\miniflare-123 at @cloudflare/vitest-pool-workers",
      ),
    ).toBe(true);

    expect(
      isKnownMiniflareEbusyCleanupLineV1(
        "Error: EBUSY: resource busy or locked, rmdir 'C:\\repo\\.wrangler\\tmp\\miniflare-123' @cloudflare/vitest-pool-workers",
      ),
    ).toBe(true);
  });

  it("does not match unknown stderr lines", () => {
    expect(
      isKnownMiniflareEbusyCleanupLineV1(
        "Warning: Retry budget exceeded while fetching remote fixture.",
      ),
    ).toBe(false);
  });

  it("removes only known noise lines and preserves other stderr content", () => {
    const input = [
      "Warning: Something actionable happened.",
      "Error: EBUSY: resource busy or locked, rmdir 'C:\\repo\\.wrangler\\tmp\\miniflare-123' @cloudflare/vitest-pool-workers",
      "Error: Model timeout while generating test fixture.",
    ].join("\n");

    const result = filterKnownMiniflareCleanupFromStderrV1(input);

    expect(result.suppressedLineCount).toBe(1);
    expect(result.filteredText).toContain(
      "Warning: Something actionable happened.",
    );
    expect(result.filteredText).toContain(
      "Error: Model timeout while generating test fixture.",
    );
    expect(result.filteredText).not.toContain("EBUSY");
  });
});
