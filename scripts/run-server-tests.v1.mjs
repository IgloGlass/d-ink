#!/usr/bin/env node

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isKnownMiniflareEbusyCleanupLineV1 } from "./miniflare-noise-filter.v1.mjs";

function createLineStreamFilterV1(onLine) {
  let pending = "";

  return {
    flush() {
      if (pending.length === 0) {
        return;
      }

      onLine(pending, "");
      pending = "";
    },
    push(chunkText) {
      pending += chunkText;

      for (;;) {
        const newlineIndex = pending.indexOf("\n");
        if (newlineIndex < 0) {
          return;
        }

        const line = pending.slice(0, newlineIndex);
        pending = pending.slice(newlineIndex + 1);
        onLine(line, "\n");
      }
    },
  };
}

function buildVitestArgsV1() {
  const vitestEntrypoint = resolve("node_modules", "vitest", "vitest.mjs");
  return [
    vitestEntrypoint,
    "run",
    "--config",
    "vitest.config.ts",
    ...process.argv.slice(2),
  ];
}

export async function runServerTestsWithNoiseFilterV1() {
  const shouldBypassFilter =
    process.env.DINK_TEST_SERVER_SHOW_MINIFLARE_EBUSY === "1";
  const command = process.execPath;
  const args = buildVitestArgsV1();

  if (shouldBypassFilter) {
    const child = spawn(command, args, {
      stdio: "inherit",
    });

    return await new Promise((resolve) => {
      child.on("close", (code, signal) => {
        if (signal) {
          resolve(1);
          return;
        }

        resolve(code ?? 1);
      });
    });
  }

  const child = spawn(command, args, {
    stdio: ["inherit", "pipe", "pipe"],
  });

  let suppressedLineCount = 0;
  const stderrFilter = createLineStreamFilterV1((line, newline) => {
    if (isKnownMiniflareEbusyCleanupLineV1(line)) {
      suppressedLineCount += 1;
      return;
    }

    process.stderr.write(line + newline);
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    stderrFilter.push(text);
  });
  child.stderr.on("end", () => {
    stderrFilter.flush();
  });

  return await new Promise((resolve) => {
    child.on("close", (code, signal) => {
      stderrFilter.flush();
      if (suppressedLineCount > 0) {
        process.stderr.write(
          `[test:server] Suppressed ${suppressedLineCount} known Miniflare EBUSY cleanup line(s).\n`,
        );
      }

      if (signal) {
        resolve(1);
        return;
      }

      resolve(code ?? 1);
    });
  });
}

async function main() {
  const exitCode = await runServerTestsWithNoiseFilterV1();
  process.exit(exitCode);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
