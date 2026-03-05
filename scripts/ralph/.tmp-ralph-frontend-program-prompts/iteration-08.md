You are running in a Ralph iteration for this repository.

Workspace root:
C:\Users\slemi\Documents\D.ink

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
- Design precedence is locked as V4 > V3 > V1 > UI architecture > SSOT/AGENTS.
- Use only token-driven styling with Open Sans and strict 4px/8px radii.
- No gradients, no glassmorphism, no purple/indigo accents, and no default library aesthetics.
- Desktop-first V1 with keyboard-accessible interactions.
- All modules remain manually editable with advisory sequence guidance only.

Recent progress notes:
information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.

[90mstderr[2m | tests/client/core-module-shell-page.v1.test.tsx[2m > [22m[2mCoreModuleShellPageV1[2m > [22m[2mrenders tax adjustments sidebar groups and final panel
[22m[39m⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.

## 2026-03-05T17:07:18.528Z
Story passed: FEP-06 - Workbench Module Hub Sweep
Codex command exit: 0
Verification:
- npm run typecheck => exit 0
- node scripts/ralph/check-design-guardrails.v1.mjs => exit 0
- set DINK_ALLOW_UNSUPPORTED_NODE_TEST_RUNTIME=1&& npx vitest run --config vitest.client.config.ts tests/client/workspace-workbench-page.v1.test.tsx => exit 0
  stderr: [90mstderr[2m | tests/client/workspace-workbench-page.v1.test.tsx[2m > [22m[2mWorkspaceWorkbenchPageV1[2m > [22m[2mrenders ordered module cards and opens module shell
[22m[39m⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.

## 2026-03-05T17:11:22.136Z
Story passed: FEP-07 - Core Module Shell Structure Sweep
Codex command exit: 0
Verification:
- npm run typecheck => exit 0
- node scripts/ralph/check-design-guardrails.v1.mjs => exit 0
- set DINK_ALLOW_UNSUPPORTED_NODE_TEST_RUNTIME=1&& npx vitest run --config vitest.client.config.ts tests/client/core-module-shell-page.v1.test.tsx => exit 0
  stderr: [90mstderr[2m | tests/client/core-module-shell-page.v1.test.tsx[2m > [22m[2mCoreModuleShellPageV1[2m > [22m[2mrenders tax adjustments sidebar groups and final panel
[22m[39m⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.


Current dirty diff summary (for awareness only):
MEMORY.md
README.md
src/client/app/app-context.v1.tsx
src/client/app/router.tsx
src/client/components/app-shell.tsx
src/client/components/button-v1.tsx
src/client/components/guidance-banner-v1.tsx
src/client/components/input-v1.tsx
src/client/components/sidebar-nav-v1.tsx
src/client/components/status-badge-v1.tsx
src/client/components/tabs-v1.tsx
src/client/features/auth/session-gate.tsx
src/client/features/groups/group-control-panel-page.v1.tsx
src/client/features/modules/core-module-shell-page.v1.tsx
src/client/features/workspaces/company-selector-page.v1.tsx
src/client/features/workspaces/workspace-workbench-page.v1.tsx
src/client/styles/global.css
src/client/styles/tokens.css
src/server/workflow/workflow-deps.v1.ts
src/shared/contracts/index.ts
src/worker.ts
tests/client/company-selector-page.v1.test.tsx
tests/client/session-gate.test.tsx
tests/db/test-schema.ts
tests/worker.annual-report.v1.test.ts
tests/worker.mapping-overrides.v1.test.ts
tests/worker.mapping-review.v1.test.ts
tests/worker.tax-core.v1.test.ts

Story to implement:
ID: FEP-08
Title: Tax Adjustments Workbench Sweep
Description:
Polish tax adjustments side navigation and pinned final calculation visibility to preserve high-confidence workflow orientation.

filesToEdit:
- src/client/features/modules/core-module-shell-page.v1.tsx
- src/client/components/sidebar-nav-v1.tsx
- src/client/styles/global.css
- docs/tax-adjustments-submodules.v1.md

acceptanceCriteria:
- Left sidebar is scrollable, structured, and readable.
- Final calculation panel remains visible and legible.
- Approved submodule ordering/grouping remains intact.

verificationCommands:
- npm run typecheck
- node scripts/ralph/check-design-guardrails.v1.mjs
- set DINK_ALLOW_UNSUPPORTED_NODE_TEST_RUNTIME=1&& npx vitest run --config vitest.client.config.ts tests/client/core-module-shell-page.v1.test.tsx
