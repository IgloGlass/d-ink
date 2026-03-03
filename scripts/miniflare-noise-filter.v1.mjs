const KNOWN_MINIFLARE_CLEANUP_PATTERNS_V1 = [
  /Unable to remove temporary directory/i,
  /\bEBUSY\b.*\b(rmdir|scandir|unlink|rm)\b/i,
  /cleanupMiniflareOptionsModules/i,
];

const MINIFLARE_STACK_HINT_PATTERNS_V1 = [
  /@cloudflare[\\/]+vitest-pool-workers/i,
  /vitest-pool-worker/i,
  /[\\/]\.wrangler[\\/].*miniflare/i,
];

function lineHasAnyPatternV1(input) {
  return input.patterns.some((pattern) => pattern.test(input.line));
}

/**
 * Identifies known Miniflare temporary-directory cleanup noise lines.
 *
 * Safety boundary:
 * - This only matches tightly-scoped EBUSY cleanup signatures.
 * - Non-matching stderr lines must always pass through unchanged.
 */
export function isKnownMiniflareEbusyCleanupLineV1(line) {
  const normalized = line.replace(/\r$/, "");
  const hasCleanupSignal = lineHasAnyPatternV1({
    line: normalized,
    patterns: KNOWN_MINIFLARE_CLEANUP_PATTERNS_V1,
  });
  if (!hasCleanupSignal) {
    return false;
  }

  return lineHasAnyPatternV1({
    line: normalized,
    patterns: MINIFLARE_STACK_HINT_PATTERNS_V1,
  });
}

export function filterKnownMiniflareCleanupFromStderrV1(stderrText) {
  const lines = stderrText.split(/\r?\n/);
  const keptLines = [];
  let suppressedLineCount = 0;

  for (const line of lines) {
    if (isKnownMiniflareEbusyCleanupLineV1(line)) {
      suppressedLineCount += 1;
      continue;
    }

    keptLines.push(line);
  }

  return {
    filteredText: keptLines.join("\n"),
    suppressedLineCount,
  };
}
