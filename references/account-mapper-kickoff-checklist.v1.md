# Account Mapper Kickoff Checklist V1

Use this checklist when starting account-mapper work after annual-report hardening. The goal is to keep context focused on the mapper while preserving annual-report behavior.

## Before coding
- Re-read [AI Execution Patterns V1](./ai-execution-patterns.v1.md).
- Define the exact mapper boundary you plan to touch:
  - mapping contract
  - deterministic mapping logic
  - mapper UI
  - workflow/orchestration
- Confirm which annual-report projection the mapper is allowed to read, if any.
- Avoid reaching into annual-report executor internals from mapper code.

## Scope guard
- Default to one mapper ticket at a time.
- Do not refactor annual-report code while working on mapper unless the ticket explicitly requires a shared contract change.
- If a shared contract must change:
  - add the contract change first
  - keep backward compatibility or add an adapter
  - update boundary tests before migrating consumers

## Mapper design guardrails
- The active mapper is AI-first. Do not reintroduce deterministic mapping heuristics unless the ticket explicitly calls for a bounded fallback.
- Keep prompts narrow:
  - small account subsets
  - compact evidence
  - no duplicate annual-report context unless required
- Treat mapping-specific prompt guidance as protected behavior:
  - update [guideline-rules.v1.ts](../src/server/ai/modules/mapping-decisions/guideline-rules.v1.ts) instead of editing ad-hoc prose in the prompt
  - keep the original mapping intent aligned with [Mapping prompt.txt](C:/Users/slemi/Documents/Mapping%20prompt.txt) for mapping-specific rules only
  - update prompt coverage tests when a mapping rule is intentionally added, removed, or reworded
- Expose degraded and fallback states clearly if the mapper cannot complete full AI review.

## Annual-report regression gate
Run these checks before handing back mapper changes that touch shared contracts, workflow, or UI:
- `pnpm run typecheck`
- `pnpm vitest tests/server/ai/annual-report-analysis-executor.v1.test.ts`
- `pnpm vitest tests/server/workflow/annual-report-processing.v1.test.ts`
- `pnpm vitest tests/client/core-module-shell-page.v1.test.tsx`

## Strongly recommended mapper checks
- Mapper unit tests for changed deterministic rules.
- Mapper contract tests for changed outputs.
- Golden/fixture checks for ambiguous mapping cases if AI behavior changes.
- Prompt coverage tests proving all versioned mapping guidelines are rendered into the live prompt.

## Stop and reassess if
- A mapper ticket requires importing annual-report server internals instead of shared contracts.
- A mapper prompt starts depending on duplicated annual-report evidence that already exists in a structured projection.
- You need to weaken annual-report degraded-state signaling to make mapper flows simpler.
- A shared schema change would force multiple modules to change in one patch without adapters.
