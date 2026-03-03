import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { EOL } from "node:os";
import path from "node:path";

const REQUIRED_TICKET_FIELDS_V1 = [
  "ticket_id",
  "status",
  "title",
  "goal",
  "files_to_edit",
  "files_not_to_edit",
  "requirements",
  "acceptance_criteria",
  "tests_to_add_or_run",
  "output_summary_format",
];

const OPTIONAL_TICKET_FIELDS_V1 = ["depends_on", "notes", "risk_level"];
const VALID_TICKET_STATUSES_V1 = new Set(["READY", "BLOCKED", "DONE"]);
const VALID_RISK_LEVELS_V1 = new Set(["low", "medium", "high"]);

const TICKET_JSON_BLOCK_REGEX_V1 = /```json\s*([\s\S]*?)```/gim;
const DEFAULT_QUEUE_HEADER_V1 = "# AUTOPILOT_QUEUE v1";

/**
 * Converts a ticket ID to the canonical branch name for autopilot runs.
 */
export function buildTicketBranchNameV1(ticketId) {
  const normalized = String(ticketId)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized.length === 0) {
    throw new Error(
      "ticket_id must contain at least one branch-safe character.",
    );
  }

  return `codex/ticket-${normalized}`;
}

function ensureStringArrayV1(value, fieldName, ticketId) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `Ticket ${ticketId}: "${fieldName}" must be a non-empty array.`,
    );
  }
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(
        `Ticket ${ticketId}: "${fieldName}" must contain non-empty strings only.`,
      );
    }
  }
}

function normalizeStringArrayV1(value) {
  return value.map((item) => item.trim());
}

function validateAndNormalizeTicketV1(rawTicket) {
  if (
    typeof rawTicket !== "object" ||
    rawTicket === null ||
    Array.isArray(rawTicket)
  ) {
    throw new Error("Each ticket JSON block must contain an object.");
  }

  const ticketId = String(rawTicket.ticket_id ?? "").trim();
  if (ticketId.length === 0) {
    throw new Error('Ticket is missing required "ticket_id".');
  }

  for (const requiredField of REQUIRED_TICKET_FIELDS_V1) {
    if (!(requiredField in rawTicket)) {
      throw new Error(
        `Ticket ${ticketId}: missing required "${requiredField}" field.`,
      );
    }
  }

  const unknownFields = Object.keys(rawTicket).filter(
    (fieldName) =>
      !REQUIRED_TICKET_FIELDS_V1.includes(fieldName) &&
      !OPTIONAL_TICKET_FIELDS_V1.includes(fieldName),
  );
  if (unknownFields.length > 0) {
    throw new Error(
      `Ticket ${ticketId}: unknown field(s): ${unknownFields.join(", ")}.`,
    );
  }

  const status = String(rawTicket.status ?? "")
    .trim()
    .toUpperCase();
  if (!VALID_TICKET_STATUSES_V1.has(status)) {
    throw new Error(
      `Ticket ${ticketId}: status must be one of READY, BLOCKED, DONE.`,
    );
  }

  const title = String(rawTicket.title ?? "").trim();
  const goal = String(rawTicket.goal ?? "").trim();
  const outputSummaryFormat = String(
    rawTicket.output_summary_format ?? "",
  ).trim();
  if (
    title.length === 0 ||
    goal.length === 0 ||
    outputSummaryFormat.length === 0
  ) {
    throw new Error(
      `Ticket ${ticketId}: title, goal, and output_summary_format must be non-empty strings.`,
    );
  }

  ensureStringArrayV1(rawTicket.files_to_edit, "files_to_edit", ticketId);
  ensureStringArrayV1(
    rawTicket.files_not_to_edit,
    "files_not_to_edit",
    ticketId,
  );
  ensureStringArrayV1(rawTicket.requirements, "requirements", ticketId);
  ensureStringArrayV1(
    rawTicket.acceptance_criteria,
    "acceptance_criteria",
    ticketId,
  );
  ensureStringArrayV1(
    rawTicket.tests_to_add_or_run,
    "tests_to_add_or_run",
    ticketId,
  );

  const dependsOnRaw = rawTicket.depends_on ?? [];
  if (!Array.isArray(dependsOnRaw)) {
    throw new Error(
      `Ticket ${ticketId}: "depends_on" must be an array when provided.`,
    );
  }
  const dependsOn = normalizeStringArrayV1(dependsOnRaw);
  for (const dependencyTicketId of dependsOn) {
    if (dependencyTicketId.length === 0) {
      throw new Error(
        `Ticket ${ticketId}: "depends_on" contains empty ticket IDs.`,
      );
    }
    if (dependencyTicketId === ticketId) {
      throw new Error(`Ticket ${ticketId}: cannot depend on itself.`);
    }
  }

  const riskLevel = rawTicket.risk_level;
  if (riskLevel !== undefined) {
    const normalizedRiskLevel = String(riskLevel).trim().toLowerCase();
    if (!VALID_RISK_LEVELS_V1.has(normalizedRiskLevel)) {
      throw new Error(
        `Ticket ${ticketId}: risk_level must be low, medium, or high.`,
      );
    }
  }

  return {
    ticket_id: ticketId,
    status,
    title,
    goal,
    files_to_edit: normalizeStringArrayV1(rawTicket.files_to_edit),
    files_not_to_edit: normalizeStringArrayV1(rawTicket.files_not_to_edit),
    requirements: normalizeStringArrayV1(rawTicket.requirements),
    acceptance_criteria: normalizeStringArrayV1(rawTicket.acceptance_criteria),
    tests_to_add_or_run: normalizeStringArrayV1(rawTicket.tests_to_add_or_run),
    output_summary_format: outputSummaryFormat,
    depends_on: dependsOn,
    notes:
      rawTicket.notes === undefined
        ? undefined
        : String(rawTicket.notes).trim(),
    risk_level:
      rawTicket.risk_level === undefined
        ? undefined
        : String(rawTicket.risk_level).trim().toLowerCase(),
  };
}

/**
 * Parses queue markdown and validates strict ticket contracts.
 */
export function parseAutopilotQueueMarkdownV1(markdown) {
  const source = String(markdown ?? "");
  const rawTicketJsonBlocks = [];
  let regexMatch = TICKET_JSON_BLOCK_REGEX_V1.exec(source);
  while (regexMatch !== null) {
    rawTicketJsonBlocks.push(regexMatch[1]);
    regexMatch = TICKET_JSON_BLOCK_REGEX_V1.exec(source);
  }

  if (rawTicketJsonBlocks.length === 0) {
    throw new Error(
      "AUTOPILOT_QUEUE.md must contain at least one ```json ticket block.",
    );
  }

  const tickets = rawTicketJsonBlocks.map((rawJsonBlock, index) => {
    let parsedJson;
    try {
      parsedJson = JSON.parse(rawJsonBlock);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown JSON parse error.";
      throw new Error(`Ticket block ${index + 1}: invalid JSON (${message}).`);
    }

    return validateAndNormalizeTicketV1(parsedJson);
  });

  const seenTicketIds = new Set();
  for (const ticket of tickets) {
    if (seenTicketIds.has(ticket.ticket_id)) {
      throw new Error(`Duplicate ticket_id detected: ${ticket.ticket_id}.`);
    }
    seenTicketIds.add(ticket.ticket_id);
  }

  return {
    version: 1,
    tickets,
  };
}

/**
 * Converts queue object back to normalized markdown.
 */
export function serializeAutopilotQueueMarkdownV1(queue, options = {}) {
  const queueObject = {
    version: 1,
    tickets: queue.tickets.map((ticket) =>
      validateAndNormalizeTicketV1(ticket),
    ),
  };

  const header = String(options.header ?? DEFAULT_QUEUE_HEADER_V1).trim();
  const description =
    String(options.description ?? "").trim() ||
    "Each ticket must be represented as a standalone JSON block. Keep IDs stable.";
  const sections = [header, "", description, ""];

  queueObject.tickets.forEach((ticket, index) => {
    const printableTicket = {
      ticket_id: ticket.ticket_id,
      status: ticket.status,
      title: ticket.title,
      goal: ticket.goal,
      files_to_edit: ticket.files_to_edit,
      files_not_to_edit: ticket.files_not_to_edit,
      requirements: ticket.requirements,
      acceptance_criteria: ticket.acceptance_criteria,
      tests_to_add_or_run: ticket.tests_to_add_or_run,
      output_summary_format: ticket.output_summary_format,
      ...(ticket.depends_on.length > 0
        ? { depends_on: ticket.depends_on }
        : {}),
      ...(ticket.notes ? { notes: ticket.notes } : {}),
      ...(ticket.risk_level ? { risk_level: ticket.risk_level } : {}),
    };

    sections.push(`## Ticket ${ticket.ticket_id}`);
    sections.push("```json");
    sections.push(JSON.stringify(printableTicket, null, 2));
    sections.push("```");
    if (index < queueObject.tickets.length - 1) {
      sections.push("");
    }
  });

  return sections.join(EOL).trimEnd() + EOL;
}

/**
 * Updates ticket status and appends context note metadata.
 */
export function updateTicketStatusInQueueV1(input) {
  const queue = {
    version: 1,
    tickets: input.queue.tickets.map((ticket) => ({ ...ticket })),
  };
  const ticketIndex = queue.tickets.findIndex(
    (ticket) => ticket.ticket_id === input.ticketId,
  );
  if (ticketIndex < 0) {
    throw new Error(`Ticket ${input.ticketId} was not found in queue.`);
  }

  const targetTicket = queue.tickets[ticketIndex];
  targetTicket.status = input.status;

  const contextLines = [];
  if (input.blockedReason) {
    contextLines.push(`Blocked reason: ${input.blockedReason}`);
  }
  if (input.commitSha) {
    contextLines.push(`Commit: ${input.commitSha}`);
  }
  if (input.branchName) {
    contextLines.push(`Branch: ${input.branchName}`);
  }
  if (input.pullRequestUrl) {
    contextLines.push(`PR: ${input.pullRequestUrl}`);
  }
  if (input.runId) {
    contextLines.push(`Run: ${input.runId}`);
  }

  if (contextLines.length > 0) {
    const metadataBlock = contextLines.join(" | ");
    targetTicket.notes = targetTicket.notes
      ? `${targetTicket.notes}${EOL}${metadataBlock}`
      : metadataBlock;
  }

  queue.tickets[ticketIndex] = validateAndNormalizeTicketV1(targetTicket);
  return queue;
}

/**
 * Returns the first eligible READY ticket and skip reasons for all others.
 */
export function selectNextEligibleTicketV1(input) {
  const skippedTickets = [];
  for (const ticket of input.queue.tickets) {
    if (ticket.status !== "READY") {
      skippedTickets.push({
        ticket_id: ticket.ticket_id,
        reason: `status=${ticket.status}`,
      });
      continue;
    }

    const unmetDependency = (ticket.depends_on ?? []).find(
      (dependencyTicketId) =>
        input.mainStatusByTicketId.get(dependencyTicketId) !== "DONE",
    );
    if (unmetDependency) {
      skippedTickets.push({
        ticket_id: ticket.ticket_id,
        reason: `depends_on_not_done=${unmetDependency}`,
      });
      continue;
    }

    const branchName = buildTicketBranchNameV1(ticket.ticket_id);
    if (input.openPrBranches.has(branchName)) {
      skippedTickets.push({
        ticket_id: ticket.ticket_id,
        reason: "open_pr_exists",
      });
      continue;
    }

    if (input.remoteBranches.has(branchName)) {
      skippedTickets.push({
        ticket_id: ticket.ticket_id,
        reason: "remote_branch_conflict",
      });
      continue;
    }

    return {
      ticket,
      branchName,
      skippedTickets,
    };
  }

  return {
    ticket: null,
    branchName: null,
    skippedTickets,
  };
}

function parseLockJsonV1(rawValue) {
  try {
    const parsed = JSON.parse(rawValue);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const runId = String(parsed.runId ?? "").trim();
    const lastHeartbeatAt = String(parsed.lastHeartbeatAt ?? "").trim();
    const createdAt = String(parsed.createdAt ?? "").trim();
    if (
      runId.length === 0 ||
      createdAt.length === 0 ||
      lastHeartbeatAt.length === 0
    ) {
      return null;
    }

    return {
      runId,
      createdAt,
      lastHeartbeatAt,
      pid: Number(parsed.pid ?? 0),
      hostname: String(parsed.hostname ?? ""),
      cwd: String(parsed.cwd ?? ""),
    };
  } catch {
    return null;
  }
}

function isFreshLockV1(lockData, staleLockMs, nowMs) {
  if (!lockData) {
    return false;
  }

  const heartbeatTimeMs = Date.parse(lockData.lastHeartbeatAt);
  if (Number.isNaN(heartbeatTimeMs)) {
    return false;
  }

  return nowMs - heartbeatTimeMs < staleLockMs;
}

async function readLockFileV1(lockFilePath) {
  try {
    const rawValue = await readFile(lockFilePath, "utf8");
    return parseLockJsonV1(rawValue);
  } catch {
    return null;
  }
}

/**
 * Acquires the local lock file, or reports active run ownership.
 */
export async function acquireRunLockV1(input) {
  const now = new Date();
  const nowMs = now.getTime();
  const existingLockData = await readLockFileV1(input.lockFilePath);
  if (isFreshLockV1(existingLockData, input.staleLockMs, nowMs)) {
    return {
      acquired: false,
      reason: "active_lock_exists",
      existingLockData,
    };
  }

  await mkdir(path.dirname(input.lockFilePath), { recursive: true });
  const nextLockData = {
    runId: input.runId,
    pid: process.pid,
    hostname: input.hostname,
    cwd: input.cwd,
    createdAt: now.toISOString(),
    lastHeartbeatAt: now.toISOString(),
  };
  await writeFile(
    input.lockFilePath,
    `${JSON.stringify(nextLockData, null, 2)}${EOL}`,
    "utf8",
  );

  return {
    acquired: true,
    reason: existingLockData ? "stale_lock_replaced" : "lock_created",
    existingLockData,
    lockData: nextLockData,
  };
}

/**
 * Updates lock heartbeat timestamp, if lock is still owned by runId.
 */
export async function heartbeatRunLockV1(input) {
  const currentLockData = await readLockFileV1(input.lockFilePath);
  if (!currentLockData || currentLockData.runId !== input.runId) {
    return {
      ok: false,
      reason: "lock_not_owned",
    };
  }

  const nextLockData = {
    ...currentLockData,
    lastHeartbeatAt: new Date().toISOString(),
  };
  await writeFile(
    input.lockFilePath,
    `${JSON.stringify(nextLockData, null, 2)}${EOL}`,
    "utf8",
  );

  return {
    ok: true,
    lockData: nextLockData,
  };
}

/**
 * Removes lock file when owned by runId.
 */
export async function releaseRunLockV1(input) {
  const currentLockData = await readLockFileV1(input.lockFilePath);
  if (!currentLockData || currentLockData.runId !== input.runId) {
    return {
      released: false,
      reason: "lock_not_owned",
    };
  }

  await rm(input.lockFilePath, { force: true });
  return {
    released: true,
  };
}
