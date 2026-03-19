type RetryableAiErrorV1 = {
  code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
  message: string;
  context: Record<string, unknown>;
};

export type ChunkRetryTelemetryV1 = {
  splitCount: number;
  totalAttempts: number;
};

export type ChunkExecutionSuccessV1<TChunk, TOutput> = {
  chunk: TChunk;
  output: TOutput;
  attempts: number;
  splitDepth: number;
};

export type ChunkExecutionFailureV1<TChunk> = {
  chunk: TChunk;
  error: RetryableAiErrorV1;
  attempts: number;
  splitDepth: number;
};

export type ChunkRetryExecutionResultV1<TChunk, TOutput> = {
  failures: ChunkExecutionFailureV1<TChunk>[];
  successes: ChunkExecutionSuccessV1<TChunk, TOutput>[];
  telemetry: ChunkRetryTelemetryV1;
};

function sleepV1(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

export function isRetryableAiErrorV1(error: RetryableAiErrorV1): boolean {
  if (error.code === "CONFIG_INVALID") {
    return false;
  }

  return (
    error.code === "MODEL_EXECUTION_FAILED" ||
    error.message.includes("429") ||
    error.message.includes("500") ||
    error.message.includes("503") ||
    error.message.toLowerCase().includes("timed out")
  );
}

export async function executeChunksWithRetryAndSplitV1<TChunk, TOutput>(input: {
  chunks: TChunk[];
  executeChunk: (chunk: TChunk) => Promise<
    | { ok: true; output: TOutput }
    | {
        ok: false;
        error: RetryableAiErrorV1;
      }
  >;
  splitChunk: (chunk: TChunk) => [TChunk, TChunk] | null;
  maxAttempts: number;
  backoffMs: number;
  shouldRetryError?: (error: RetryableAiErrorV1) => boolean;
}): Promise<ChunkRetryExecutionResultV1<TChunk, TOutput>> {
  const successes: ChunkExecutionSuccessV1<TChunk, TOutput>[] = [];
  const failures: ChunkExecutionFailureV1<TChunk>[] = [];
  const retryableClassifier = input.shouldRetryError ?? isRetryableAiErrorV1;
  const telemetry: ChunkRetryTelemetryV1 = {
    splitCount: 0,
    totalAttempts: 0,
  };

  const executeRecursively = async (
    chunk: TChunk,
    splitDepth: number,
  ): Promise<void> => {
    let attempt = 0;
    let lastFailure: RetryableAiErrorV1 | null = null;

    while (attempt < Math.max(1, input.maxAttempts)) {
      attempt += 1;
      telemetry.totalAttempts += 1;
      const result = await input.executeChunk(chunk);
      if (result.ok) {
        successes.push({
          chunk,
          output: result.output,
          attempts: attempt,
          splitDepth,
        });
        return;
      }

      lastFailure = result.error;
      if (
        !retryableClassifier(result.error) ||
        attempt >= Math.max(1, input.maxAttempts)
      ) {
        break;
      }

      await sleepV1(Math.max(0, input.backoffMs) * attempt);
    }

    if (lastFailure === null) {
      return;
    }

    if (!retryableClassifier(lastFailure)) {
      failures.push({
        chunk,
        error: lastFailure,
        attempts: attempt,
        splitDepth,
      });
      return;
    }

    const split = input.splitChunk(chunk);
    if (!split) {
      failures.push({
        chunk,
        error: lastFailure,
        attempts: attempt,
        splitDepth,
      });
      return;
    }

    telemetry.splitCount += 1;
    await Promise.all([
      executeRecursively(split[0], splitDepth + 1),
      executeRecursively(split[1], splitDepth + 1),
    ]);
  };

  await Promise.all(input.chunks.map((chunk) => executeRecursively(chunk, 0)));

  return {
    successes,
    failures,
    telemetry,
  };
}
