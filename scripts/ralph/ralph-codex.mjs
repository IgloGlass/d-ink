import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  let max = 3;
  let prd = "scripts/ralph/prd.ui-ux-polish.v1.json";
  let model = "";
  let progressFile = "";
  let promptsDir = "";
  let outputsDir = "";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--max" && argv[i + 1]) {
      max = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--prd" && argv[i + 1]) {
      prd = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--model" && argv[i + 1]) {
      model = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--progress-file" && argv[i + 1]) {
      progressFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--prompts-dir" && argv[i + 1]) {
      promptsDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--outputs-dir" && argv[i + 1]) {
      outputsDir = argv[i + 1];
      i += 1;
    }
  }
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error("--max must be a positive integer.");
  }
  return {
    max,
    model,
    outputsDir,
    prd,
    progressFile,
    promptsDir,
  };
}

function readJson(filePath) {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function appendProgress(progressFile, text) {
  mkdirSync(path.dirname(progressFile), { recursive: true });
  const previous = existsSync(progressFile)
    ? readFileSync(progressFile, "utf8")
    : "# Ralph Codex Progress\n";
  writeFileSync(
    progressFile,
    `${previous}\n## ${new Date().toISOString()}\n${text}\n`,
    "utf8",
  );
}

function sortedOpenStories(stories) {
  return stories
    .filter((story) => !story.passes)
    .sort((a, b) => a.priority - b.priority);
}

function runCommand(command, cwd) {
  const comspec = process.env.ComSpec || "cmd.exe";
  return spawnSync(comspec, ["/d", "/s", "/c", command], {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: "pipe",
  });
}

function runVerifyCommands(commands, cwd) {
  const results = [];
  for (const command of commands) {
    const result = runCommand(command, cwd);
    results.push({
      command,
      exitCode: result.status ?? 1,
      stderr: result.stderr ?? "",
      stdout: result.stdout ?? "",
    });
  }
  return results;
}

function runCodexIteration({ codexPath, cwd, model, outputPath, prompt }) {
  const args = [
    "exec",
    "--dangerously-bypass-approvals-and-sandbox",
    "-C",
    cwd,
  ];
  if (model) {
    args.push("--model", model);
  }
  args.push("-o", outputPath, "-");
  return spawnSync(codexPath, args, {
    cwd,
    encoding: "utf8",
    // Agent responses and tool transcripts can exceed default spawnSync buffers.
    maxBuffer: 64 * 1024 * 1024,
    stdio: "pipe",
    input: `${prompt}\n`,
  });
}

function resolveCodexPath(workspaceRoot) {
  const explicitPath = process.env.DINK_RALPH_CODEX_PATH?.trim();
  if (explicitPath) {
    return explicitPath;
  }

  const discoveredPath = execSync("where codex", {
    cwd: workspaceRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!discoveredPath) {
    throw new Error("Unable to resolve codex executable via `where codex`.");
  }

  return discoveredPath;
}

function buildPrompt({
  contextNotes,
  dirtyDiff,
  progressNotes,
  story,
  workspaceRoot,
}) {
  return `
You are running in a Ralph iteration for this repository.

Workspace root:
${workspaceRoot}

Critical constraints:
- Respect AGENTS.md and module boundaries.
- Do not revert unrelated working-tree changes.
- Edit only files listed in "filesToEdit" unless strictly required by type/lint fixes.
- Keep changes premium UI-focused and V4-token aligned.
- Run the story verification commands yourself before final output.
- At the end, print exactly one line:
RALPH_STATUS:PASS
or
RALPH_STATUS:FAIL

Project context notes:
${contextNotes.map((note) => `- ${note}`).join("\n")}

Recent progress notes:
${progressNotes || "(none)"}

Current dirty diff summary (for awareness only):
${dirtyDiff}

Story to implement:
ID: ${story.id}
Title: ${story.title}
Description:
${story.description}

filesToEdit:
${story.filesToEdit.map((file) => `- ${file}`).join("\n")}

acceptanceCriteria:
${story.acceptanceCriteria.map((criterion) => `- ${criterion}`).join("\n")}

verificationCommands:
${story.verificationCommands.map((command) => `- ${command}`).join("\n")}
`.trim();
}

function main() {
  const workspaceRoot = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const prdPath = path.resolve(workspaceRoot, args.prd);
  const scriptDir = path.dirname(prdPath);
  const progressPath = path.resolve(
    workspaceRoot,
    args.progressFile.trim().length > 0
      ? args.progressFile
      : path.join(scriptDir, "progress.txt"),
  );
  const promptsDir = path.resolve(
    workspaceRoot,
    args.promptsDir.trim().length > 0
      ? args.promptsDir
      : path.join(scriptDir, ".tmp-prompts"),
  );
  const outputsDir = path.resolve(
    workspaceRoot,
    args.outputsDir.trim().length > 0
      ? args.outputsDir
      : path.join(scriptDir, ".tmp-outputs"),
  );

  if (!existsSync(prdPath)) {
    throw new Error(`PRD file not found: ${prdPath}`);
  }

  mkdirSync(promptsDir, { recursive: true });
  mkdirSync(outputsDir, { recursive: true });
  const codexPath = resolveCodexPath(workspaceRoot);

  for (let iteration = 1; iteration <= args.max; iteration += 1) {
    const prd = readJson(prdPath);
    const openStories = sortedOpenStories(prd.userStories);
    if (openStories.length === 0) {
      console.log("Ralph complete: all stories passed.");
      appendProgress(progressPath, "All stories complete.");
      return;
    }

    const story = openStories[0];
    const dirtyNames = execSync("git diff --name-only", {
      cwd: workspaceRoot,
      encoding: "utf8",
    }).trim();
    const progressNotes = existsSync(progressPath)
      ? readFileSync(progressPath, "utf8").slice(-3000)
      : "";

    const prompt = buildPrompt({
      workspaceRoot,
      story,
      contextNotes: prd.contextNotes ?? [],
      dirtyDiff: dirtyNames || "(none)",
      progressNotes,
    });
    const promptPath = path.join(
      promptsDir,
      `iteration-${String(iteration).padStart(2, "0")}.md`,
    );
    const outputPath = path.join(
      outputsDir,
      `iteration-${String(iteration).padStart(2, "0")}.txt`,
    );
    writeFileSync(promptPath, `${prompt}\n`, "utf8");

    console.log(
      `\n=== Ralph iteration ${iteration}/${args.max} -> ${story.id} ${story.title}`,
    );

    const codexRun = runCodexIteration({
      codexPath,
      cwd: workspaceRoot,
      model: args.model,
      outputPath,
      prompt,
    });
    process.stdout.write(codexRun.stdout ?? "");
    process.stderr.write(codexRun.stderr ?? "");

    const codexStatus = codexRun.status ?? 1;
    const codexError = codexRun.error ? String(codexRun.error) : "";
    const agentOutput = existsSync(outputPath)
      ? readFileSync(outputPath, "utf8")
      : (codexRun.stdout ?? "");
    const saidPass = agentOutput.includes("RALPH_STATUS:PASS");

    const verifyResults = runVerifyCommands(
      story.verificationCommands,
      workspaceRoot,
    );
    const verifyPass = verifyResults.every((result) => result.exitCode === 0);

    if (codexStatus === 0 && saidPass && verifyPass) {
      const next = readJson(prdPath);
      const target = next.userStories.find(
        (candidate) => candidate.id === story.id,
      );
      if (target) {
        target.passes = true;
      }
      writeJson(prdPath, next);
      appendProgress(
        progressPath,
        [
          `Story passed: ${story.id} - ${story.title}`,
          `Codex command exit: ${codexStatus}`,
          "Verification:",
          ...verifyResults.map((result) =>
            [
              `- ${result.command} => exit ${result.exitCode === 0 ? "0" : result.exitCode}`,
              result.stderr ? `  stderr: ${result.stderr.trim()}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          ),
        ].join("\n"),
      );
      console.log(`Story PASSED: ${story.id}`);
    } else {
      appendProgress(
        progressPath,
        [
          `Story failed: ${story.id} - ${story.title}`,
          `Agent status: ${codexStatus === 0 && saidPass ? "PASS" : "FAIL_OR_MISSING"}`,
          `Codex command exit: ${codexStatus}`,
          codexError ? `Codex spawn error: ${codexError}` : "",
          codexRun.stderr ? `Codex stderr: ${codexRun.stderr.trim()}` : "",
          "Verification:",
          ...verifyResults.map((result) =>
            [
              `- ${result.command} => exit ${result.exitCode === 0 ? "0" : result.exitCode}`,
              result.stderr ? `  stderr: ${result.stderr.trim()}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          ),
        ].join("\n"),
      );
      console.log(`Story did not pass: ${story.id}`);
    }
  }

  console.log("Reached max iterations.");
  appendProgress(
    progressPath,
    `Reached max iterations (${args.max}) with unresolved stories.`,
  );
  process.exit(1);
}

main();
