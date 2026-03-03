export type AutopilotTicketStatusV1 = "READY" | "BLOCKED" | "DONE";

export interface AutopilotTicketV1 {
  ticket_id: string;
  status: AutopilotTicketStatusV1;
  title: string;
  goal: string;
  files_to_edit: string[];
  files_not_to_edit: string[];
  requirements: string[];
  acceptance_criteria: string[];
  tests_to_add_or_run: string[];
  output_summary_format: string;
  depends_on: string[];
  notes?: string;
  risk_level?: "low" | "medium" | "high";
}

export interface AutopilotQueueV1 {
  version: 1;
  tickets: AutopilotTicketV1[];
}

export interface TicketSkipReasonV1 {
  ticket_id: string;
  reason: string;
}

export interface LockDataV1 {
  runId: string;
  createdAt: string;
  lastHeartbeatAt: string;
  pid: number;
  hostname: string;
  cwd: string;
}

export function buildTicketBranchNameV1(ticketId: string): string;

export function parseAutopilotQueueMarkdownV1(markdown: string): AutopilotQueueV1;

export function serializeAutopilotQueueMarkdownV1(
  queue: AutopilotQueueV1,
  options?: {
    header?: string;
    description?: string;
  },
): string;

export function updateTicketStatusInQueueV1(input: {
  queue: AutopilotQueueV1;
  ticketId: string;
  status: AutopilotTicketStatusV1;
  blockedReason?: string;
  commitSha?: string;
  branchName?: string;
  pullRequestUrl?: string;
  runId?: string;
}): AutopilotQueueV1;

export function selectNextEligibleTicketV1(input: {
  queue: AutopilotQueueV1;
  mainStatusByTicketId: Map<string, AutopilotTicketStatusV1>;
  openPrBranches: Set<string>;
  remoteBranches: Set<string>;
}): {
  ticket: AutopilotTicketV1 | null;
  branchName: string | null;
  skippedTickets: TicketSkipReasonV1[];
};

export function acquireRunLockV1(input: {
  runId: string;
  cwd: string;
  hostname: string;
  lockFilePath: string;
  staleLockMs: number;
}): Promise<
  | {
      acquired: true;
      reason: "lock_created" | "stale_lock_replaced";
      existingLockData: LockDataV1 | null;
      lockData: LockDataV1;
    }
  | {
      acquired: false;
      reason: "active_lock_exists";
      existingLockData: LockDataV1 | null;
    }
>;

export function heartbeatRunLockV1(input: {
  runId: string;
  lockFilePath: string;
}): Promise<
  | {
      ok: true;
      lockData: LockDataV1;
    }
  | {
      ok: false;
      reason: "lock_not_owned";
    }
>;

export function releaseRunLockV1(input: {
  runId: string;
  lockFilePath: string;
}): Promise<
  | {
      released: true;
    }
  | {
      released: false;
      reason: "lock_not_owned";
    }
>;
