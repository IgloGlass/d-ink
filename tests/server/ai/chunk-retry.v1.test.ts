import { describe, expect, it } from "vitest";

import {
  executeChunksWithRetryAndSplitV1,
  isRetryableAiErrorV1,
} from "../../../src/server/ai/runtime/chunk-retry.v1";

describe("chunk retry runtime v1", () => {
  it("retries retryable failures and succeeds", async () => {
    let attempts = 0;
    const result = await executeChunksWithRetryAndSplitV1({
      chunks: [1],
      maxAttempts: 3,
      backoffMs: 0,
      splitChunk: () => null,
      executeChunk: async () => {
        attempts += 1;
        if (attempts < 3) {
          return {
            ok: false as const,
            error: {
              code: "MODEL_EXECUTION_FAILED" as const,
              message: "timed out",
              context: {},
            },
          };
        }

        return {
          ok: true as const,
          output: 42,
        };
      },
    });

    expect(result.successes).toHaveLength(1);
    expect(result.failures).toHaveLength(0);
    expect(result.telemetry.totalAttempts).toBe(3);
  });

  it("splits retryable exhausted chunks", async () => {
    const result = await executeChunksWithRetryAndSplitV1({
      chunks: [[1, 2, 3, 4]],
      maxAttempts: 1,
      backoffMs: 0,
      splitChunk: (chunk) => {
        if (chunk.length <= 1) {
          return null;
        }
        const midpoint = Math.ceil(chunk.length / 2);
        return [chunk.slice(0, midpoint), chunk.slice(midpoint)];
      },
      executeChunk: async (chunk) => {
        if (chunk.length > 1) {
          return {
            ok: false as const,
            error: {
              code: "MODEL_EXECUTION_FAILED" as const,
              message: "timed out",
              context: {},
            },
          };
        }

        return {
          ok: true as const,
          output: chunk[0],
        };
      },
    });

    expect(result.failures).toHaveLength(0);
    expect(result.successes).toHaveLength(4);
    expect(result.telemetry.splitCount).toBeGreaterThan(0);
  });

  it("does not retry non-retryable errors", () => {
    expect(
      isRetryableAiErrorV1({
        code: "CONFIG_INVALID",
        message: "bad key",
        context: {},
      }),
    ).toBe(false);
  });
});
