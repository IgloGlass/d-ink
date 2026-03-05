# Ralph (Codex Loop Program)

This project includes two Ralph layers:

1. `ralph-codex.mjs` for story-by-story iterative implementation.
2. `ralph-frontend-program.v1.mjs` for multi-sweep frontend convergence.

## Files

- `scripts/ralph/ralph-codex.mjs`: single-loop runner.
- `scripts/ralph/ralph-frontend-program.v1.mjs`: multi-sweep convergence runner.
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

## Full frontend program run

```bash
node scripts/ralph/ralph-frontend-program.v1.mjs \
  --prd scripts/ralph/prd.frontend-full-premium.v1.json \
  --sweeps 6 \
  --max-per-sweep 24 \
  --consecutive-green 2
```

## Convergence behavior

1. Program resets PRD pass flags at the start of each sweep.
2. Runs Ralph iterations until all stories pass or per-sweep max is hit.
3. Runs premium gates (`lint`, `typecheck`, `test:client`, design guardrails).
4. Tracks consecutive green sweeps and only exits success when the target is met.
5. Fails if convergence target is not reached within configured sweeps.

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
- Sweep-level convergence records: `scripts/ralph/progress-frontend-program.txt`
- Visual captures: `scripts/ralph/artifacts/screenshots`

## Visual baseline mode

- Visual capture is optional by default.
- Strict scripts set `DINK_RALPH_REQUIRE_VISUAL=1` so visual baseline checks are mandatory.
- Default dev server port for capture is `4173` (override with `DINK_RALPH_VISUAL_PORT`).
