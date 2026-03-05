import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const TRANSIENT_LOOP_EXIT_CODES = new Set([1073807364, 3221226091]);

function parseArgs(argv) {
  let name = "ralph-program";
  let prd = "scripts/ralph/prd.ui-ux-polish.v1.json";
  let sweeps = 6;
  let maxPerSweep = 24;
  let consecutiveGreen = 2;
  let model = "";
  let reasoningEffort = "";
  let progressFile = "";
  let loopCommand = "";
  let gateCommand = "";
  let keepSweepPrd = false;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--name" && argv[index + 1]) {
      name = argv[index + 1];
      index += 1;
      continue;
    }
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
    if (arg === "--reasoning-effort" && argv[index + 1]) {
      reasoningEffort = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--progress-file" && argv[index + 1]) {
      progressFile = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--loop-command" && argv[index + 1]) {
      loopCommand = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--gate-command" && argv[index + 1]) {
      gateCommand = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--keep-sweep-prd") {
      keepSweepPrd = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  return {
    consecutiveGreen,
    dryRun,
    gateCommand,
    keepSweepPrd,
    loopCommand,
    maxPerSweep,
    model,
    name,
    prd,
    progressFile,
    reasoningEffort,
    sweeps,
  };
}

function runShell(command) {
  const shell =
    process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "sh";
  const args =
    process.platform === "win32" ? ["/d", "/c", command] : ["-lc", command];

  const result = spawnSync(shell, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: "inherit",
  });

  return result.status ?? 1;
}

function toPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function toNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return value;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function getStoryCount(prdPath) {
  const prd = readJson(prdPath);
  if (!Array.isArray(prd.userStories) || prd.userStories.length === 0) {
    throw new Error("PRD must define at least one user story.");
  }
  return prd.userStories.length;
}

function normalizeProgramConfig(rawConfig, storyCount, labelPrefix) {
  const normalized = {
    ...rawConfig,
    sweeps: toPositiveInteger(rawConfig.sweeps, "--sweeps"),
    maxPerSweep: toPositiveInteger(rawConfig.maxPerSweep, "--max-per-sweep"),
    consecutiveGreen: toPositiveInteger(
      rawConfig.consecutiveGreen,
      "--consecutive-green",
    ),
  };

  if (normalized.maxPerSweep < storyCount) {
    normalized.maxPerSweep = storyCount;
    process.stdout.write(
      `[${labelPrefix}] INFO max-per-sweep raised to ${storyCount} so all stories can be attempted each sweep.\n`,
    );
  }

  if (normalized.consecutiveGreen > normalized.sweeps) {
    normalized.consecutiveGreen = normalized.sweeps;
    process.stdout.write(
      `[${labelPrefix}] INFO consecutive-green reduced to ${normalized.sweeps} (cannot exceed sweeps).\n`,
    );
  }

  return normalized;
}

function interpolateCommand(template, replacements) {
  let output = template;
  for (const [key, value] of Object.entries(replacements)) {
    output = output.replaceAll(`{${key}}`, value);
  }
  return output.trim();
}

function isTransientLoopFailure(exitCode) {
  return TRANSIENT_LOOP_EXIT_CODES.has(exitCode);
}

function runLoopWithRetries(command, maxAttempts, labelPrefix) {
  let attempts = 0;
  let exitCode = 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    if (attempt > 1) {
      process.stdout.write(
        `[${labelPrefix}] Retrying loop command (${attempt}/${maxAttempts}).\n`,
      );
    }

    exitCode = runShell(command);
    if (exitCode === 0) {
      return { attempts, exitCode };
    }
    if (!isTransientLoopFailure(exitCode)) {
      return { attempts, exitCode };
    }
  }

  return { attempts, exitCode };
}

function sanitizeNameForFileName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function appendProgramLog(progressPath, title, message) {
  mkdirSync(path.dirname(progressPath), { recursive: true });
  const previous = existsSync(progressPath)
    ? readFileSync(progressPath, "utf8")
    : `# ${title}\n`;
  const next = `${previous}\n## ${new Date().toISOString()}\n${message}\n`;
  writeFileSync(progressPath, next, "utf8");
}

function createWorkingSweepPrdCopy(input) {
  const sourcePrd = readJson(input.sourcePrdPath);
  for (const story of sourcePrd.userStories) {
    story.passes = false;
  }

  const sourceBaseName = path.basename(
    input.sourcePrdPath,
    path.extname(input.sourcePrdPath),
  );
  const fileName = `.tmp-${sourceBaseName}.${input.runTag}.sweep-${String(input.sweep).padStart(2, "0")}.json`;
  const workingPath = path.join(path.dirname(input.sourcePrdPath), fileName);
  writeJson(workingPath, sourcePrd);
  return workingPath;
}

function allStoriesPassed(prdPath) {
  const prd = readJson(prdPath);
  return prd.userStories.every((story) => story.passes === true);
}

function resolveDefaultLoopRunnerPath() {
  const projectLoopRunnerPath = path.resolve(
    process.cwd(),
    "scripts/ralph/ralph-codex.mjs",
  );
  if (existsSync(projectLoopRunnerPath)) {
    return projectLoopRunnerPath;
  }

  const currentScriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentScriptDirectory, "ralph-codex.mjs");
}

function main() {
  const rawArgs = parseArgs(process.argv.slice(2));
  const sourcePrdPath = path.resolve(process.cwd(), rawArgs.prd);

  if (!existsSync(sourcePrdPath)) {
    throw new Error(`PRD not found: ${sourcePrdPath}`);
  }

  const labelPrefix = rawArgs.name;
  const logTitle = `Ralph Program (${rawArgs.name})`;
  const storyCount = getStoryCount(sourcePrdPath);
  const args = normalizeProgramConfig(rawArgs, storyCount, labelPrefix);
  const loopRetryBudget = toNonNegativeInteger(
    Number(process.env.DINK_RALPH_LOOP_RETRIES ?? "1"),
    "DINK_RALPH_LOOP_RETRIES",
  );
  const loopMaxAttempts = loopRetryBudget + 1;
  const nameForPath = sanitizeNameForFileName(args.name) || "ralph-program";
  const storyProgressPath = path.resolve(
    process.cwd(),
    `scripts/ralph/progress-${nameForPath}-stories.txt`,
  );
  const promptsDirPath = path.resolve(
    process.cwd(),
    `scripts/ralph/.tmp-${nameForPath}-prompts`,
  );
  const outputsDirPath = path.resolve(
    process.cwd(),
    `scripts/ralph/.tmp-${nameForPath}-outputs`,
  );
  const defaultLoopRunnerPath = resolveDefaultLoopRunnerPath();
  const loopCommandTemplate =
    args.loopCommand.trim() ||
    process.env.DINK_RALPH_LOOP_COMMAND?.trim() ||
    `node ${defaultLoopRunnerPath} --prd {PRD} --max {MAX}{MODEL_ARG}{REASONING_ARG} --progress-file {STORY_PROGRESS} --prompts-dir {PROMPTS_DIR} --outputs-dir {OUTPUTS_DIR}`;
  const gateCommand =
    args.gateCommand.trim() ||
    process.env.DINK_RALPH_GATES_COMMAND?.trim() ||
    "";
  const runGates = gateCommand.length > 0;
  const progressPath = path.resolve(
    process.cwd(),
    args.progressFile.trim().length > 0
      ? args.progressFile
      : `scripts/ralph/progress-${nameForPath}.txt`,
  );
  mkdirSync(path.dirname(progressPath), { recursive: true });
  mkdirSync(path.dirname(storyProgressPath), { recursive: true });
  mkdirSync(promptsDirPath, { recursive: true });
  mkdirSync(outputsDirPath, { recursive: true });

  if (args.dryRun) {
    const modelArg = args.model ? ` --model ${args.model}` : "";
    const reasoningArg = args.reasoningEffort
      ? ` --reasoning-effort ${args.reasoningEffort}`
      : "";
    const sampleLoopCommand = interpolateCommand(loopCommandTemplate, {
      PRD: sourcePrdPath,
      PRD_SOURCE: sourcePrdPath,
      MAX: String(args.maxPerSweep),
      MODEL_ARG: modelArg,
      REASONING_ARG: reasoningArg,
      STORY_PROGRESS: storyProgressPath,
      PROMPTS_DIR: promptsDirPath,
      OUTPUTS_DIR: outputsDirPath,
    });
    process.stdout.write(
      `${[
        `[${labelPrefix}] DRY RUN`,
        `- source prd: ${sourcePrdPath}`,
        `- stories: ${storyCount}`,
        `- sweeps: ${args.sweeps}`,
        `- max-per-sweep: ${args.maxPerSweep}`,
        `- consecutive-green target: ${args.consecutiveGreen}`,
        `- loop command template: ${loopCommandTemplate}`,
        `- loop command sample: ${sampleLoopCommand}`,
        `- gate command: ${runGates ? gateCommand : "(none)"}`,
        `- loop attempts per sweep: ${loopMaxAttempts}`,
        `- progress file: ${progressPath}`,
        `- story progress file: ${storyProgressPath}`,
        `- prompts dir: ${promptsDirPath}`,
        `- outputs dir: ${outputsDirPath}`,
        `- keep sweep prd copies: ${args.keepSweepPrd ? "yes" : "no"}`,
      ].join("\n")}\n`,
    );
    return;
  }

  appendProgramLog(
    progressPath,
    logTitle,
    [
      `[${labelPrefix}] Run configuration`,
      `- source prd: ${sourcePrdPath}`,
      `- stories: ${storyCount}`,
      `- sweeps: ${args.sweeps}`,
      `- max-per-sweep: ${args.maxPerSweep}`,
      `- consecutive-green target: ${args.consecutiveGreen}`,
      `- loop command template: ${loopCommandTemplate}`,
      `- gate command: ${runGates ? gateCommand : "(none)"}`,
      `- loop attempts per sweep: ${loopMaxAttempts}`,
      `- story progress file: ${storyProgressPath}`,
      `- prompts dir: ${promptsDirPath}`,
      `- outputs dir: ${outputsDirPath}`,
      `- keep sweep prd copies: ${args.keepSweepPrd ? "yes" : "no"}`,
    ].join("\n"),
  );

  let stableGreenCount = 0;
  const runTag = `${Date.now()}-${process.pid}`;

  for (let sweep = 1; sweep <= args.sweeps; sweep += 1) {
    process.stdout.write(`\n[${labelPrefix}] Sweep ${sweep}/${args.sweeps}\n`);

    const workingPrdPath = createWorkingSweepPrdCopy({
      runTag,
      sourcePrdPath,
      sweep,
    });
    appendProgramLog(
      progressPath,
      logTitle,
      `Sweep ${sweep} started. Working PRD prepared: ${workingPrdPath}`,
    );

    try {
      const modelArg = args.model ? ` --model ${args.model}` : "";
      const reasoningArg = args.reasoningEffort
        ? ` --reasoning-effort ${args.reasoningEffort}`
        : "";
      const loopCommand = interpolateCommand(loopCommandTemplate, {
        PRD: workingPrdPath,
        PRD_SOURCE: sourcePrdPath,
        MAX: String(args.maxPerSweep),
        MODEL_ARG: modelArg,
        REASONING_ARG: reasoningArg,
        STORY_PROGRESS: storyProgressPath,
        PROMPTS_DIR: promptsDirPath,
        OUTPUTS_DIR: outputsDirPath,
      });
      const loopResult = runLoopWithRetries(
        loopCommand,
        loopMaxAttempts,
        labelPrefix,
      );
      const loopExit = loopResult.exitCode;
      if (loopExit !== 0 && isTransientLoopFailure(loopExit)) {
        appendProgramLog(
          progressPath,
          logTitle,
          `Sweep ${sweep} transient loop failures persisted after ${loopResult.attempts} attempt(s). Last exit: ${loopExit}.`,
        );
      }

      const storiesPassed = allStoriesPassed(workingPrdPath);
      let gateExit = runGates ? 1 : 0;
      if (loopExit === 0 && storiesPassed && runGates) {
        gateExit = runShell(gateCommand);
      }

      const sweepGreen = loopExit === 0 && storiesPassed && gateExit === 0;
      if (sweepGreen) {
        stableGreenCount += 1;
      } else {
        stableGreenCount = 0;
      }

      appendProgramLog(
        progressPath,
        logTitle,
        [
          `Sweep ${sweep} result: ${sweepGreen ? "GREEN" : "RED"}`,
          `- loop command: ${loopCommand}`,
          `- loop exit: ${loopExit}`,
          `- loop attempts: ${loopResult.attempts}/${loopMaxAttempts}`,
          `- all stories passed: ${storiesPassed}`,
          `- gate command used: ${runGates ? "yes" : "no"}`,
          `- gate exit: ${gateExit}`,
          `- consecutive green sweeps: ${stableGreenCount}/${args.consecutiveGreen}`,
          `- working prd: ${workingPrdPath}`,
        ].join("\n"),
      );

      process.stdout.write(
        `[${labelPrefix}] Sweep ${sweep} => ${sweepGreen ? "GREEN" : "RED"} (${stableGreenCount}/${args.consecutiveGreen})\n`,
      );

      if (stableGreenCount >= args.consecutiveGreen) {
        process.stdout.write(`[${labelPrefix}] PASS convergence reached.\n`);
        return;
      }
    } finally {
      if (!args.keepSweepPrd) {
        rmSync(workingPrdPath, { force: true });
      }
    }
  }

  process.stderr.write(
    `[${labelPrefix}] FAIL convergence target was not reached.\n`,
  );
  process.exit(1);
}

main();
