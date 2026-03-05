import { existsSync, readFileSync, writeFileSync } from "node:fs";

function parseArgs(argv) {
  let mode = "pass-all";
  let prd = "";
  let stateFile = "";
  let exitCode = 1;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode" && argv[index + 1]) {
      mode = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--prd" && argv[index + 1]) {
      prd = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--state-file" && argv[index + 1]) {
      stateFile = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--exit-code" && argv[index + 1]) {
      exitCode = Number(argv[index + 1]);
      index += 1;
    }
  }

  return { exitCode, mode, prd, stateFile };
}

function markAllStoriesPassed(prdPath) {
  const prd = JSON.parse(readFileSync(prdPath, "utf8"));
  for (const story of prd.userStories ?? []) {
    story.passes = true;
  }
  writeFileSync(prdPath, `${JSON.stringify(prd, null, 2)}\n`, "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === "pass-all") {
    if (!args.prd) {
      throw new Error("--prd is required for pass-all mode.");
    }
    markAllStoriesPassed(args.prd);
    process.stdout.write("[ralph:test-loop-stub] all stories marked passed.\n");
    return;
  }

  if (args.mode === "fail") {
    process.stdout.write(
      `[ralph:test-loop-stub] forced failure (${args.exitCode}).\n`,
    );
    process.exit(args.exitCode);
  }

  if (args.mode === "fail-once-then-pass") {
    if (!args.prd) {
      throw new Error("--prd is required for fail-once-then-pass mode.");
    }
    if (!args.stateFile) {
      throw new Error("--state-file is required for fail-once-then-pass mode.");
    }

    if (!existsSync(args.stateFile)) {
      writeFileSync(args.stateFile, "failed-once\n", "utf8");
      process.stdout.write(
        `[ralph:test-loop-stub] forced transient failure (${args.exitCode}).\n`,
      );
      process.exit(args.exitCode);
    }

    markAllStoriesPassed(args.prd);
    process.stdout.write(
      "[ralph:test-loop-stub] recovered and marked all stories passed.\n",
    );
    return;
  }

  if (args.mode === "no-op") {
    process.stdout.write("[ralph:test-loop-stub] no-op success.\n");
    return;
  }

  throw new Error(`Unsupported mode: ${args.mode}`);
}

main();
