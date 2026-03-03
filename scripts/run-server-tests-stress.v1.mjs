#!/usr/bin/env node

import { assertSupportedTestRuntimeV1 } from "./assert-test-runtime.v1.mjs";
import { runServerTestsWithNoiseFilterV1 } from "./run-server-tests.v1.mjs";

const DEFAULT_STRESS_RUN_COUNT_V1 = 3;

function parseStressRunCountV1() {
  const rawValue = process.env.DINK_TEST_SERVER_STRESS_RUNS;
  if (!rawValue || rawValue.trim() === "") {
    return DEFAULT_STRESS_RUN_COUNT_V1;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `DINK_TEST_SERVER_STRESS_RUNS must be a positive integer. Received: ${rawValue}`,
    );
  }

  return parsed;
}

async function main() {
  assertSupportedTestRuntimeV1();

  const totalRuns = parseStressRunCountV1();
  for (let runIndex = 1; runIndex <= totalRuns; runIndex += 1) {
    process.stdout.write(`[test:server:stress] Run ${runIndex}/${totalRuns}\n`);
    const exitCode = await runServerTestsWithNoiseFilterV1();
    if (exitCode !== 0) {
      process.stderr.write(
        `[test:server:stress] Failed on run ${runIndex}/${totalRuns}.\n`,
      );
      process.exit(exitCode);
    }
  }

  process.stdout.write(
    `[test:server:stress] Passed ${totalRuns}/${totalRuns} runs.\n`,
  );
}

void main();
