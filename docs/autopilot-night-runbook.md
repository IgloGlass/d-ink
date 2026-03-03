# Night Ticket Autopilot Runbook

## Purpose
Run tickets continuously overnight, one at a time, until there are no eligible `READY` tickets.

## Safety Model
1. Never push directly to `main`.
2. One ticket branch per ticket: `codex/ticket-<ticket_id>`.
3. One PR per ticket.
4. If a ticket fails execution or validation, mark it `BLOCKED`, open PR, continue to next eligible ticket.
5. Local run lock (`.autopilot/lock.json`) prevents concurrent overlapping runs.

## Prerequisites
1. GitHub CLI installed: `gh --version`
2. GitHub CLI authenticated: `gh auth status`
3. Node + pnpm installed and in `PATH`.
4. Clean working tree before run start.
5. GitHub branch protection on `main` set to PR-only (manual repository setting).

## Queue Contract
Queue file: `AUTOPILOT_QUEUE.md`

Each ticket is a JSON block with required fields:
1. `ticket_id`
2. `status` (`READY`, `BLOCKED`, `DONE`)
3. `title`
4. `goal`
5. `files_to_edit`
6. `files_not_to_edit`
7. `requirements`
8. `acceptance_criteria`
9. `tests_to_add_or_run`
10. `output_summary_format`

Optional:
1. `depends_on`
2. `notes`
3. `risk_level` (`low`, `medium`, `high`)

## Commands
Validate queue:

```bash
corepack pnpm run autopilot:validate
```

Continuous run:

```bash
corepack pnpm run autopilot:run -- --executor "<ticket-executor-command>"
```

Dry-run selection only:

```bash
corepack pnpm run autopilot:run -- --dry-run
```

## Executor Contract
The runner delegates actual code implementation to `--executor` (or env var `AUTOPILOT_TICKET_EXECUTOR_CMD`).

Executor receives:
1. `AUTOPILOT_RUN_ID`
2. `AUTOPILOT_TICKET_ID`
3. `AUTOPILOT_TICKET_BRANCH`
4. `AUTOPILOT_TICKET_PAYLOAD_PATH`

It must:
1. Implement only ticket-scoped changes.
2. Exit with `0` on success, non-zero on failure.
3. Leave the branch checked out.

## Automation Prompt Contract
Use this prompt in Codex automation:

1. Validate queue first.
2. Run continuous autopilot with executor.
3. Enforce branch and commit contracts:
   - Branch: `codex/ticket-<ticket_id>`
   - Commit: `auto(<ticket_id>): <title>`
   - PR title: `[AUTO][<ticket_id>] <title>`
4. Never merge PRs automatically.
5. End with summary: processed, blocked, skipped.

## Failure Handling
1. Lock conflict: run exits cleanly (`active_lock_exists`).
2. Missing prerequisites (`gh`, auth, git, pnpm): run exits with actionable error.
3. Queue parse errors: fix queue and rerun.
4. Ticket execution/test failure: ticket becomes `BLOCKED`, PR is still opened for review.

## Recommended Rollout
1. Add 2-3 synthetic low-risk tickets.
2. Run dry-run.
3. Run with executor in daytime.
4. Verify branch/PR behavior.
5. Enable hourly scheduler as watchdog trigger.
