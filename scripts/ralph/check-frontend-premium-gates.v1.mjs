import { spawnSync } from "node:child_process";
import process from "node:process";

function runStep(step) {
  const command =
    process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "sh";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", step.command]
      : ["-lc", step.command];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      ...(step.env ?? {}),
    },
  });

  process.stdout.write(`\n[ralph:gates] ${step.name}\n`);
  process.stdout.write(`[ralph:gates] command: ${step.command}\n`);
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) {
    process.stderr.write(
      `[ralph:gates] spawn error: ${String(result.error)}\n`,
    );
  }
  process.stdout.write(`[ralph:gates] exit: ${result.status ?? "null"}\n`);

  return result.status ?? 1;
}

function main() {
  const steps = [
    { name: "lint", command: "npm run lint" },
    { name: "typecheck", command: "npm run typecheck" },
    {
      name: "client-tests",
      command: "npm run test:client",
      env: {
        DINK_ALLOW_UNSUPPORTED_NODE_TEST_RUNTIME:
          process.env.DINK_ALLOW_UNSUPPORTED_NODE_TEST_RUNTIME ?? "1",
      },
    },
    {
      name: "design-guardrails",
      command: "node scripts/ralph/check-design-guardrails.v1.mjs",
    },
  ];

  const strictVisual = process.env.DINK_RALPH_REQUIRE_VISUAL === "1";
  if (strictVisual) {
    steps.push({
      name: "visual-baseline",
      command: "node scripts/ralph/run-visual-baseline.v1.mjs",
    });
  }

  for (const step of steps) {
    const code = runStep(step);
    if (code !== 0) {
      process.stderr.write(`\n[ralph:gates] FAIL at step: ${step.name}\n`);
      process.exit(code);
    }
  }

  process.stdout.write("\n[ralph:gates] PASS\n");
}

main();
