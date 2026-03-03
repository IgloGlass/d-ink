// @ts-nocheck
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  acquireRunLockV1,
  buildTicketBranchNameV1,
  parseAutopilotQueueMarkdownV1,
  releaseRunLockV1,
  selectNextEligibleTicketV1,
  updateTicketStatusInQueueV1,
} from "../../scripts/lib/night-autopilot-core.mjs";

function buildQueueMarkdownFixtureV1(): string {
  return `
# AUTOPILOT_QUEUE v1

## Ticket NT-001
\`\`\`json
{
  "ticket_id": "NT-001",
  "status": "READY",
  "title": "First ticket",
  "goal": "Do A",
  "files_to_edit": ["src/a.ts"],
  "files_not_to_edit": ["src/db/**"],
  "requirements": ["r1"],
  "acceptance_criteria": ["a1"],
  "tests_to_add_or_run": ["corepack pnpm run test:server"],
  "output_summary_format": "summary",
  "depends_on": []
}
\`\`\`

## Ticket NT-002
\`\`\`json
{
  "ticket_id": "NT-002",
  "status": "READY",
  "title": "Second ticket",
  "goal": "Do B",
  "files_to_edit": ["src/b.ts"],
  "files_not_to_edit": ["src/db/**"],
  "requirements": ["r2"],
  "acceptance_criteria": ["a2"],
  "tests_to_add_or_run": ["corepack pnpm run test:server"],
  "output_summary_format": "summary",
  "depends_on": ["NT-001"]
}
\`\`\`
`;
}

describe("night-autopilot core", () => {
  it("parses strict queue markdown JSON blocks", () => {
    const queue = parseAutopilotQueueMarkdownV1(buildQueueMarkdownFixtureV1());
    expect(queue.version).toBe(1);
    expect(queue.tickets).toHaveLength(2);
    expect(queue.tickets[0].ticket_id).toBe("NT-001");
    expect(queue.tickets[1].depends_on).toEqual(["NT-001"]);
  });

  it("rejects malformed queue ticket blocks", () => {
    const invalidQueue = `
# AUTOPILOT_QUEUE v1
## Ticket BAD
\`\`\`json
{"ticket_id":"BAD-001","status":"READY"}
\`\`\`
`;

    expect(() => parseAutopilotQueueMarkdownV1(invalidQueue)).toThrow(
      /missing required "title"/i,
    );
  });

  it("selects next eligible READY ticket with dependency and branch gating", () => {
    const queue = parseAutopilotQueueMarkdownV1(buildQueueMarkdownFixtureV1());
    const firstSelection = selectNextEligibleTicketV1({
      queue,
      mainStatusByTicketId: new Map(),
      openPrBranches: new Set(),
      remoteBranches: new Set(),
    });

    expect(firstSelection.ticket?.ticket_id).toBe("NT-001");
    expect(firstSelection.branchName).toBe("codex/ticket-nt-001");

    const secondSelection = selectNextEligibleTicketV1({
      queue,
      mainStatusByTicketId: new Map([["NT-001", "DONE"]]),
      openPrBranches: new Set(["codex/ticket-nt-001"]),
      remoteBranches: new Set(),
    });

    expect(secondSelection.ticket?.ticket_id).toBe("NT-002");
    expect(
      secondSelection.skippedTickets.some(
        (entry) =>
          entry.ticket_id === "NT-001" && entry.reason === "open_pr_exists",
      ),
    ).toBe(true);
  });

  it("updates queue status and appends metadata notes", () => {
    const queue = parseAutopilotQueueMarkdownV1(buildQueueMarkdownFixtureV1());
    const updatedQueue = updateTicketStatusInQueueV1({
      queue,
      ticketId: "NT-001",
      status: "DONE",
      runId: "run-1",
      branchName: "codex/ticket-nt-001",
      commitSha: "abc123",
      pullRequestUrl: "https://example.com/pr/1",
    });

    const updatedTicket = updatedQueue.tickets.find(
      (ticket) => ticket.ticket_id === "NT-001",
    );
    expect(updatedTicket?.status).toBe("DONE");
    expect(updatedTicket?.notes).toContain("Commit: abc123");
    expect(updatedTicket?.notes).toContain("PR: https://example.com/pr/1");
  });

  it("handles lock acquisition and stale lock takeover", async () => {
    const tempDirectory = await mkdtemp(
      path.join(os.tmpdir(), "autopilot-lock-"),
    );
    const lockFilePath = path.join(tempDirectory, "lock.json");

    const firstAcquire = await acquireRunLockV1({
      runId: "run-a",
      cwd: tempDirectory,
      hostname: "host",
      lockFilePath,
      staleLockMs: 60_000,
    });
    expect(firstAcquire.acquired).toBe(true);

    const secondAcquire = await acquireRunLockV1({
      runId: "run-b",
      cwd: tempDirectory,
      hostname: "host",
      lockFilePath,
      staleLockMs: 60_000,
    });
    expect(secondAcquire.acquired).toBe(false);
    expect(secondAcquire.reason).toBe("active_lock_exists");

    await writeFile(
      lockFilePath,
      JSON.stringify(
        {
          runId: "run-a",
          cwd: tempDirectory,
          hostname: "host",
          pid: 1,
          createdAt: "2020-01-01T00:00:00.000Z",
          lastHeartbeatAt: "2020-01-01T00:00:00.000Z",
        },
        null,
        2,
      ),
      "utf8",
    );

    const staleTakeoverAcquire = await acquireRunLockV1({
      runId: "run-c",
      cwd: tempDirectory,
      hostname: "host",
      lockFilePath,
      staleLockMs: 1_000,
    });
    expect(staleTakeoverAcquire.acquired).toBe(true);
    expect(staleTakeoverAcquire.reason).toBe("stale_lock_replaced");

    const releaseResult = await releaseRunLockV1({
      runId: "run-c",
      lockFilePath,
    });
    expect(releaseResult.released).toBe(true);
  });

  it("normalizes branch names for ticket IDs", () => {
    expect(buildTicketBranchNameV1("NT_123")).toBe("codex/ticket-nt_123");
    expect(buildTicketBranchNameV1(" Ticket 99 ")).toBe(
      "codex/ticket-ticket-99",
    );
  });
});
