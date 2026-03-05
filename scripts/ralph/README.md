# Ralph (Codex Loop Program)

This project includes three Ralph layers:

1. `ralph-codex.mjs` for story-by-story iterative implementation.
2. `ralph-program.v1.mjs` for generic multi-sweep convergence.
3. `ralph-frontend-program.v1.mjs` as a frontend-specific wrapper around the generic program.

## Files

- `scripts/ralph/ralph-codex.mjs`: single-loop runner.
- `scripts/ralph/ralph-program.v1.mjs`: generic multi-sweep convergence runner.
- `scripts/ralph/ralph-frontend-program.v1.mjs`: frontend defaults wrapper for `ralph-program.v1.mjs`.
- `scripts/ralph/prd.ui-ux-polish.v1.json`: focused UI polish PRD.
- `scripts/ralph/prd.frontend-full-premium.v1.json`: full 12-pass frontend PRD.
- `scripts/ralph/prd.frontend-wave1.v1.json`: wave 1 (foundation + IA).
- `scripts/ralph/prd.frontend-wave2.v1.json`: wave 2 (core workflow surfaces).
- `scripts/ralph/prd.frontend-wave3.v1.json`: wave 3 (final polish + legacy debt).
- `scripts/ralph/check-design-guardrails.v1.mjs`: style/token anti-pattern gate.
- `scripts/ralph/check-frontend-premium-gates.v1.mjs`: lint/typecheck/test/design gate pack.
- `scripts/ralph/run-visual-baseline.v1.mjs`: screenshot baseline capture.
- `scripts/ralph/progress.txt`: story loop log.
- `scripts/ralph/progress-frontend-program.txt`: multi-sweep program log.

## Core commands

```bash
npm run ralph:frontend:guardrails
npm run ralph:frontend:gates
npm run ralph:frontend:visual
npm run ralph:frontend:smoke
npm run ralph:program
npm run ralph:frontend:program
npm run ralph:frontend:program:strict
```

## Strict anti-lazy workflow (recommended)

Use the wave scripts in order. They force tighter convergence (`8` sweeps, `8` max stories per sweep, `3` consecutive green sweeps) and require visual validation.

```bash
npm run ralph:frontend:wave1
npm run ralph:frontend:wave2
npm run ralph:frontend:wave3
```

Or run all waves in sequence:

```bash
npm run ralph:frontend:waves
```

## Single loop run

```bash
node scripts/ralph/ralph-codex.mjs --prd scripts/ralph/prd.ui-ux-polish.v1.json --max 3
```

## Generic multi-sweep run

```bash
node scripts/ralph/ralph-program.v1.mjs \
  --name reliability-pass \
  --prd scripts/ralph/prd.ui-ux-polish.v1.json \
  --sweeps 4 \
  --max-per-sweep 4 \
  --consecutive-green 2
```

## Full frontend program run

```bash
node scripts/ralph/ralph-frontend-program.v1.mjs \
  --prd scripts/ralph/prd.frontend-full-premium.v1.json \
  --sweeps 6 \
  --max-per-sweep 24 \
  --consecutive-green 2
```

## Convergence behavior

1. Program creates a temporary per-sweep PRD copy with pass flags reset.
2. Runs Ralph iterations until all stories pass or per-sweep max is hit.
3. Runs gate command when configured (frontend wrapper uses premium gates by default).
4. Tracks consecutive green sweeps and only exits success when the target is met.
5. Fails if convergence target is not reached within configured sweeps.
6. If `max-per-sweep` is lower than PRD story count, it is automatically raised.
7. Retries transient Windows loop crashes (`1073807364`, `3221226091`) before marking a sweep red.
8. Source PRD remains unchanged unless you explicitly keep sweep copies.
9. Carries forward story pass flags across sweeps so retries resume from the first incomplete story.
10. Fails fast on repeated identical red sweep signatures to avoid token churn.

## Manual checkpoint policy between waves

After each wave turns green, do a fast manual pass in this order:

1. Workspace selector
2. Workbench
3. Core module shell (mapping, adjustments, INK2)

Checkpoint rule:

- Do not start the next wave until these routes look coherent and no obvious style regressions remain.

## Prompt contract for ad-hoc stories

If you add story tickets manually, keep this structure in each story/prompt:

1. Goal
2. Files to edit
3. Files not to edit
4. Requirements
5. Acceptance criteria
6. Tests to add/run
7. Output summary format

## Logs and artifacts

- Story details and failures: `scripts/ralph/progress.txt`
- Generic sweep records: `scripts/ralph/progress-<name>.txt`
- Story-run details per program: `scripts/ralph/progress-<name>-stories.txt`
- Frontend sweep records: `scripts/ralph/progress-frontend-program.txt`
- Visual captures: `scripts/ralph/artifacts/screenshots`

## Loop diagnostics and overrides

- `DINK_RALPH_LOOP_RETRIES`: extra retries for transient loop crashes (default `1`).
- `DINK_RALPH_MAX_IDENTICAL_RED_SWEEPS`: stop early after this many identical red sweep signatures (default `2`, set `0` to disable).
- `DINK_RALPH_LOOP_COMMAND`: override loop command template. Supports placeholders:
  - `{PRD}` path argument
  - `{PRD_SOURCE}` original PRD path
  - `{MAX}` iteration cap
  - `{MODEL_ARG}` optional model suffix
  - `{STORY_PROGRESS}` story progress file path
  - `{PROMPTS_DIR}` prompt output directory
  - `{OUTPUTS_DIR}` agent output directory
- `DINK_RALPH_GATES_COMMAND`: override gate command (leave empty for no gates).

Useful runner args:

- `--progress-file <path>`
- `--loop-command "<command template>"`
- `--gate-command "<command>"`
- `--keep-sweep-prd`

Smoke-test helpers:

```bash
npm run ralph:frontend:smoke
```

## Visual baseline mode

- Visual capture is optional by default.
- Strict scripts set `DINK_RALPH_REQUIRE_VISUAL=1` so visual baseline checks are mandatory.
- Default dev server port for capture is `4173` (override with `DINK_RALPH_VISUAL_PORT`).
