#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  acquireRunLockV1,
  buildTicketBranchNameV1,
  heartbeatRunLockV1,
  parseAutopilotQueueMarkdownV1,
  releaseRunLockV1,
  selectNextEligibleTicketV1,
  serializeAutopilotQueueMarkdownV1,
  updateTicketStatusInQueueV1,
} from "./lib/night-autopilot-core.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    queuePath: "AUTOPILOT_QUEUE.md",
    baseBranch: "main",
    lockFilePath: path.join(".autopilot", "lock.json"),
    staleLockMs: 2 * 60 * 60 * 1000,
    maxTickets: Number.POSITIVE_INFINITY,
    dryRun: false,
    executorCommand: process.env.AUTOPILOT_TICKET_EXECUTOR_CMD?.trim() ?? "",
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--queue") {
      options.queuePath = args[index + 1];
      index += 1;
      continue;
    }
    if (argument === "--base-branch") {
      options.baseBranch = args[index + 1];
      index += 1;
      continue;
    }
    if (argument === "--lock-file") {
      options.lockFilePath = args[index + 1];
      index += 1;
      continue;
    }
    if (argument === "--stale-lock-ms") {
      options.staleLockMs = Number(args[index + 1]);
      index += 1;
      continue;
    }
    if (argument === "--max-tickets") {
      const parsedMaxTickets = Number(args[index + 1]);
      options.maxTickets =
        Number.isFinite(parsedMaxTickets) && parsedMaxTickets > 0
          ? Math.floor(parsedMaxTickets)
          : Number.POSITIVE_INFINITY;
      index += 1;
      continue;
    }
    if (argument === "--executor") {
      options.executorCommand = args[index + 1];
      index += 1;
      continue;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!options.queuePath) {
    throw new Error("--queue value must be provided.");
  }
  if (!options.baseBranch) {
    throw new Error("--base-branch value must be provided.");
  }
  if (!Number.isFinite(options.staleLockMs) || options.staleLockMs <= 0) {
    throw new Error("--stale-lock-ms must be a positive integer.");
  }

  return options;
}

function runCommandOrThrowV1(command, input = {}) {
  const result = spawnSync(command, {
    shell: true,
    cwd: input.cwd ?? process.cwd(),
    env: input.env ?? process.env,
    encoding: "utf8",
    stdio: input.captureOutput ? "pipe" : "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    throw new Error(
      `Command failed (${command}) [exit=${result.status}]${stdout || stderr ? `\n${stdout}\n${stderr}` : ""}`,
    );
  }

  return result;
}

function runCommandWithResultV1(command, input = {}) {
  const result = spawnSync(command, {
    shell: true,
    cwd: input.cwd ?? process.cwd(),
    env: input.env ?? process.env,
    encoding: "utf8",
    stdio: "pipe",
  });

  return {
    command,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function ensureCleanWorkingTreeV1() {
  const statusResult = runCommandWithResultV1("git status --porcelain");
  if (statusResult.status !== 0) {
    throw new Error(`Unable to read git status:\n${statusResult.stderr}`);
  }
  if (statusResult.stdout.trim().length > 0) {
    throw new Error(
      "Night autopilot requires a clean working tree before execution.",
    );
  }
}

function ensureToolingV1() {
  for (const command of [
    "git --version",
    "node --version",
    "corepack pnpm --version",
    "gh --version",
  ]) {
    const result = runCommandWithResultV1(command);
    if (result.status !== 0) {
      throw new Error(`Missing prerequisite command: ${command}`);
    }
  }

  const authResult = runCommandWithResultV1("gh auth status");
  if (authResult.status !== 0) {
    throw new Error(
      "GitHub CLI authentication is required. Run: gh auth login",
    );
  }
}

async function readQueueFromPathV1(queuePath) {
  const source = await readFile(queuePath, "utf8");
  return parseAutopilotQueueMarkdownV1(source);
}

async function readQueueFromBranchV1(queuePath, branchRef) {
  const showResult = runCommandWithResultV1(
    `git show ${branchRef}:${queuePath}`,
  );
  if (showResult.status !== 0) {
    return null;
  }

  return parseAutopilotQueueMarkdownV1(showResult.stdout);
}

function buildMainStatusMapV1(mainQueue) {
  const map = new Map();
  for (const ticket of mainQueue?.tickets ?? []) {
    map.set(ticket.ticket_id, ticket.status);
  }

  return map;
}

function listOpenPrBranchesV1() {
  const result = runCommandWithResultV1(
    "gh pr list --state open --limit 200 --json headRefName",
  );
  if (result.status !== 0) {
    throw new Error(`Unable to list open PRs:\n${result.stderr}`);
  }

  const rows = JSON.parse(result.stdout);
  return new Set(rows.map((row) => row.headRefName));
}

function listRemoteTicketBranchesV1() {
  const result = runCommandWithResultV1(
    'git ls-remote --heads origin "refs/heads/codex/ticket-*"',
  );
  if (result.status !== 0) {
    throw new Error(`Unable to list remote ticket branches:\n${result.stderr}`);
  }

  const remoteBranches = new Set();
  for (const line of result.stdout.split(/\r?\n/)) {
    const refName = line.trim().split(/\s+/)[1];
    if (!refName) {
      continue;
    }
    remoteBranches.add(refName.replace("refs/heads/", ""));
  }

  return remoteBranches;
}

function checkoutFreshBaseBranchV1(baseBranch) {
  runCommandOrThrowV1(`git checkout "${baseBranch}"`);
  runCommandOrThrowV1(`git pull --ff-only origin "${baseBranch}"`);
}

function checkoutTicketBranchFromBaseV1(branchName, baseBranch) {
  runCommandOrThrowV1(
    `git checkout -B "${branchName}" "origin/${baseBranch}"`,
  );
}

function writeQueueToPathV1(queuePath, queue) {
  return writeFile(queuePath, serializeAutopilotQueueMarkdownV1(queue), "utf8");
}

function resolveCurrentCommitShaV1() {
  const result = runCommandWithResultV1("git rev-parse HEAD");
  if (result.status !== 0) {
    throw new Error(`Unable to resolve commit SHA:\n${result.stderr}`);
  }

  return result.stdout.trim();
}

async function createPullRequestV1(input) {
  await mkdir(".autopilot", { recursive: true });
  const prBodyPath = path.join(".autopilot", `pr-body-${input.branchName}.md`);
  const prBodySections = [
    "## Ticket",
    `- ID: ${input.ticket.ticket_id}`,
    `- Status: ${input.status}`,
    `- Branch: ${input.branchName}`,
    "",
    "## Validation",
    ...input.validationResults.map(
      (item) =>
        `- \`${item.command}\`: ${item.status === 0 ? "passed" : "failed"}`,
    ),
    "",
    "## Notes",
    input.note,
  ];
  await writeFile(prBodyPath, `${prBodySections.join("\n")}\n`, "utf8");

  const titlePrefix = input.status === "DONE" ? "" : "[BLOCKED] ";
  const prTitle = `[AUTO][${input.ticket.ticket_id}] ${titlePrefix}${input.ticket.title}`;
  const createResult = runCommandWithResultV1(
    `gh pr create --base "${input.baseBranch}" --head "${input.branchName}" --title "${prTitle.replace(/"/g, '\\"')}" --body-file "${prBodyPath}"`,
  );
  if (createResult.status !== 0) {
    throw new Error(`Unable to create PR:\n${createResult.stderr}`);
  }

  return createResult.stdout.trim();
}

async function runTicketExecutorV1(input) {
  if (!input.executorCommand) {
    throw new Error(
      "No ticket executor configured. Set AUTOPILOT_TICKET_EXECUTOR_CMD or --executor.",
    );
  }

  await mkdir(".autopilot", { recursive: true });
  const payloadPath = path.join(
    ".autopilot",
    `ticket-${input.ticket.ticket_id}.json`,
  );
  await writeFile(
    payloadPath,
    `${JSON.stringify(
      {
        run_id: input.runId,
        ticket: input.ticket,
        branch_name: input.branchName,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const executorEnv = {
    ...process.env,
    AUTOPILOT_RUN_ID: input.runId,
    AUTOPILOT_TICKET_ID: input.ticket.ticket_id,
    AUTOPILOT_TICKET_BRANCH: input.branchName,
    AUTOPILOT_TICKET_PAYLOAD_PATH: payloadPath,
  };

  const executionResult = runCommandWithResultV1(input.executorCommand, {
    env: executorEnv,
  });
  return executionResult;
}

function runValidationCommandsV1(ticket) {
  const validationResults = [];
  for (const command of ticket.tests_to_add_or_run) {
    const commandResult = runCommandWithResultV1(command);
    validationResults.push(commandResult);
    if (commandResult.status !== 0) {
      return validationResults;
    }
  }

  const typecheckResult = runCommandWithResultV1("corepack pnpm run typecheck");
  validationResults.push(typecheckResult);
  return validationResults;
}

function hasValidationFailureV1(validationResults) {
  return validationResults.some((result) => result.status !== 0);
}

async function markTicketStatusAndCommitV1(input) {
  const currentQueue = await readQueueFromPathV1(input.queuePath);
  const updatedQueue = updateTicketStatusInQueueV1({
    queue: currentQueue,
    ticketId: input.ticket.ticket_id,
    status: input.status,
    blockedReason: input.blockedReason,
    commitSha: input.commitSha,
    branchName: input.branchName,
    pullRequestUrl: input.pullRequestUrl,
    runId: input.runId,
  });
  await writeQueueToPathV1(input.queuePath, updatedQueue);

  runCommandOrThrowV1("git add -A");
  const commitTitle =
    input.status === "DONE"
      ? `auto(${input.ticket.ticket_id}): ${input.ticket.title}`
      : `auto(${input.ticket.ticket_id}): ${input.ticket.title} [blocked]`;
  runCommandOrThrowV1(`git commit -m "${commitTitle.replace(/"/g, '\\"')}"`);
}

async function processTicketV1(input) {
  checkoutTicketBranchFromBaseV1(input.branchName, input.baseBranch);

  const executorResult = await runTicketExecutorV1({
    executorCommand: input.executorCommand,
    runId: input.runId,
    ticket: input.ticket,
    branchName: input.branchName,
  });
  const validationResults = [executorResult];

  if (executorResult.status === 0) {
    validationResults.push(...runValidationCommandsV1(input.ticket));
  }

  const blockedReason = hasValidationFailureV1(validationResults)
    ? "Execution or validation failed. See PR validation section."
    : "";

  await markTicketStatusAndCommitV1({
    queuePath: input.queuePath,
    ticket: input.ticket,
    status: blockedReason ? "BLOCKED" : "DONE",
    blockedReason,
    branchName: input.branchName,
    runId: input.runId,
  });
  const commitSha = resolveCurrentCommitShaV1();

  runCommandOrThrowV1(`git push -u origin "${input.branchName}"`);
  const pullRequestUrl = await createPullRequestV1({
    ticket: input.ticket,
    status: blockedReason ? "BLOCKED" : "DONE",
    branchName: input.branchName,
    baseBranch: input.baseBranch,
    note: blockedReason || "Ticket completed successfully.",
    validationResults,
  });

  const finalQueue = await readQueueFromPathV1(input.queuePath);
  const queueWithPrMetadata = updateTicketStatusInQueueV1({
    queue: finalQueue,
    ticketId: input.ticket.ticket_id,
    status: blockedReason ? "BLOCKED" : "DONE",
    blockedReason,
    commitSha,
    branchName: input.branchName,
    pullRequestUrl,
    runId: input.runId,
  });
  await writeQueueToPathV1(input.queuePath, queueWithPrMetadata);
  runCommandOrThrowV1("git add -A");
  runCommandOrThrowV1("git commit --amend --no-edit --allow-empty");
  runCommandOrThrowV1(
    `git push --force-with-lease origin "${input.branchName}"`,
  );

  checkoutFreshBaseBranchV1(input.baseBranch);
  return {
    ticketId: input.ticket.ticket_id,
    status: blockedReason ? "BLOCKED" : "DONE",
    branchName: input.branchName,
    pullRequestUrl,
    validationResults,
  };
}

async function main() {
  const options = parseArgs();
  const runId = `run-${Date.now()}`;
  const cwd = process.cwd();
  const hostname = os.hostname();

  ensureToolingV1();
  ensureCleanWorkingTreeV1();
  checkoutFreshBaseBranchV1(options.baseBranch);

  const lockResult = await acquireRunLockV1({
    runId,
    cwd,
    hostname,
    lockFilePath: options.lockFilePath,
    staleLockMs: options.staleLockMs,
  });
  if (!lockResult.acquired) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          runId,
          skipped: true,
          reason: lockResult.reason,
        },
        null,
        2,
      ),
    );
    return;
  }

  const processedTickets = [];
  let heartbeatTimer = null;
  try {
    heartbeatTimer = setInterval(() => {
      heartbeatRunLockV1({
        runId,
        lockFilePath: options.lockFilePath,
      }).catch(() => {
        // Best-effort heartbeat only; lock ownership is validated each run.
      });
    }, 30_000);

    while (processedTickets.length < options.maxTickets) {
      checkoutFreshBaseBranchV1(options.baseBranch);
      const queue = await readQueueFromPathV1(options.queuePath);
      const baseQueue = await readQueueFromBranchV1(
        options.queuePath,
        `origin/${options.baseBranch}`,
      );
      const openPrBranches = listOpenPrBranchesV1();
      const remoteBranches = listRemoteTicketBranchesV1();

      const nextTicketResult = selectNextEligibleTicketV1({
        queue,
        mainStatusByTicketId: buildMainStatusMapV1(baseQueue),
        openPrBranches,
        remoteBranches,
      });

      if (!nextTicketResult.ticket) {
        break;
      }

      if (options.dryRun) {
        processedTickets.push({
          ticketId: nextTicketResult.ticket.ticket_id,
          status: "DRY_RUN",
          branchName: nextTicketResult.branchName,
        });
        remoteBranches.add(nextTicketResult.branchName);
        continue;
      }

      const ticketResult = await processTicketV1({
        queuePath: options.queuePath,
        runId,
        ticket: nextTicketResult.ticket,
        branchName: nextTicketResult.branchName,
        baseBranch: options.baseBranch,
        executorCommand: options.executorCommand,
      });
      processedTickets.push(ticketResult);

      await heartbeatRunLockV1({
        runId,
        lockFilePath: options.lockFilePath,
      });
    }
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }

    await releaseRunLockV1({
      runId,
      lockFilePath: options.lockFilePath,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        queuePath: options.queuePath,
        dryRun: options.dryRun,
        processedTickets,
        processedCount: processedTickets.length,
      },
      null,
      2,
    ),
  );
}

main().catch(async (error) => {
  const message =
    error instanceof Error ? error.message : "Unknown night autopilot failure.";
  console.error(`Night autopilot failed: ${message}`);
  process.exitCode = 1;
});
