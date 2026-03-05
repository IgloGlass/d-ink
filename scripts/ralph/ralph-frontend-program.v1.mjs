import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  let prd = "scripts/ralph/prd.frontend-full-premium.v1.json";
  let sweeps = 6;
  let maxPerSweep = 24;
  let consecutiveGreen = 2;
  let model = "";
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--prd" && argv[index + 1]) {
      prd = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--sweeps" && argv[index + 1]) {
      sweeps = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--max-per-sweep" && argv[index + 1]) {
      maxPerSweep = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--consecutive-green" && argv[index + 1]) {
      consecutiveGreen = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--model" && argv[index + 1]) {
      model = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  return {
    consecutiveGreen,
    dryRun,
    maxPerSweep,
    model,
    prd,
    sweeps,
  };
}

function runShell(command) {
  const shell = process.platform === "win32" ? "cmd.exe" : "sh";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", command]
      : ["-lc", command];

  const result = spawnSync(shell, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
  });

  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  return result.status ?? 1;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resetPassFlags(prdPath) {
  const prd = readJson(prdPath);
  for (const story of prd.userStories) {
    story.passes = false;
  }
  writeJson(prdPath, prd);
}

function allStoriesPassed(prdPath) {
  const prd = readJson(prdPath);
  return prd.userStories.every((story) => story.passes === true);
}

function appendProgramLog(message) {
  const progressPath = path.resolve(
    process.cwd(),
    "scripts/ralph/progress-frontend-program.txt",
  );
  const previous = existsSync(progressPath)
    ? readFileSync(progressPath, "utf8")
    : "# Ralph Frontend Program\n";
  const next = `${previous}\n## ${new Date().toISOString()}\n${message}\n`;
  writeFileSync(progressPath, next, "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const prdPath = path.resolve(process.cwd(), args.prd);

  if (!existsSync(prdPath)) {
    throw new Error(`PRD not found: ${prdPath}`);
  }

  if (args.dryRun) {
    process.stdout.write(
      `${[
        "[ralph:frontend-program] DRY RUN",
        `- prd: ${prdPath}`,
        `- sweeps: ${args.sweeps}`,
        `- max-per-sweep: ${args.maxPerSweep}`,
        `- consecutive-green target: ${args.consecutiveGreen}`,
      ].join("\n")}\n`,
    );
    return;
  }

  let stableGreenCount = 0;

  for (let sweep = 1; sweep <= args.sweeps; sweep += 1) {
    process.stdout.write(
      `\n[ralph:frontend-program] Sweep ${sweep}/${args.sweeps}\n`,
    );
    resetPassFlags(prdPath);
    appendProgramLog(`Sweep ${sweep} started. PRD pass flags reset.`);

    const modelArg = args.model ? ` --model ${args.model}` : "";
    const loopExit = runShell(
      `node scripts/ralph/ralph-codex.mjs --prd "${args.prd}" --max ${args.maxPerSweep}${modelArg}`,
    );
    const storiesPassed = allStoriesPassed(prdPath);

    let gateExit = 1;
    if (loopExit === 0 && storiesPassed) {
      gateExit = runShell(
        "node scripts/ralph/check-frontend-premium-gates.v1.mjs",
      );
    }

    const sweepGreen = loopExit === 0 && storiesPassed && gateExit === 0;
    if (sweepGreen) {
      stableGreenCount += 1;
    } else {
      stableGreenCount = 0;
    }

    appendProgramLog(
      [
        `Sweep ${sweep} result: ${sweepGreen ? "GREEN" : "RED"}`,
        `- ralph loop exit: ${loopExit}`,
        `- all stories passed: ${storiesPassed}`,
        `- premium gates exit: ${gateExit}`,
        `- consecutive green sweeps: ${stableGreenCount}/${args.consecutiveGreen}`,
      ].join("\n"),
    );

    process.stdout.write(
      `[ralph:frontend-program] Sweep ${sweep} => ${sweepGreen ? "GREEN" : "RED"} (${stableGreenCount}/${args.consecutiveGreen})\n`,
    );

    if (stableGreenCount >= args.consecutiveGreen) {
      process.stdout.write(
        "[ralph:frontend-program] PASS convergence reached.\n",
      );
      return;
    }
  }

  process.stderr.write(
    "[ralph:frontend-program] FAIL convergence target was not reached.\n",
  );
  process.exit(1);
}

main();
