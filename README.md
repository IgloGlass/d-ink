# D.ink Engineering Bootstrap

This repository contains the V1 technical scaffold for D.ink.

## Prerequisites

- Node.js 20.x or 22.x (supported for `npm run test` / `npm run check`)
- pnpm (or Corepack)

If `pnpm` is not installed globally:

```bash
corepack enable
```

## Install

```bash
pnpm install
```

Fallback (no global `pnpm`):

```bash
corepack pnpm install
```

## Qwen AI setup

The backend now supports Qwen as the primary AI provider for:

- annual report analysis
- account mapping
- tax adjustments

Configure secrets in local `.dev.vars` or Wrangler secrets:

```bash
QWEN_API_KEY=your-qwen-api-key
QWEN_FAST_MODEL=qwen-plus
QWEN_THINKING_MODEL=qwen-max
```

Notes:

- `QWEN_API_KEY` is preferred.
- `AI_PROVIDER_API_KEY` remains supported as a backwards-compatible fallback.
- If no Qwen key is configured, the backend falls back to deterministic/offline behavior for local safety and testability.
- Do not commit real API keys.

## Windows quick start

For a non-technical local test on Windows, use [`start-local-dev.cmd`](C:\Users\slemi\Documents\D.ink\start-local-dev.cmd).

- Double-click it from Explorer, or run `.\start-local-dev.cmd` in PowerShell.
- It installs dependencies with `pnpm`, warns if Node is outside the supported 20.x/22.x range, and starts both the web app and the local API.
- It opens the app in your browser automatically.
- Leave the terminal window open while testing.
- Code changes should appear automatically in the open browser tab through Vite hot reload.

Helpful companion shortcuts:

- [`check-local-app.cmd`](C:\Users\slemi\Documents\D.ink\check-local-app.cmd): verifies that the web app and API are actually responding.
- [`run-local-tests.cmd`](C:\Users\slemi\Documents\D.ink\run-local-tests.cmd): runs the automated test suite without requiring terminal commands.

## Local commands

```bash
pnpm dev
pnpm start:local
pnpm doctor:local
pnpm test:local
pnpm generate:tb-template
pnpm lint
pnpm typecheck
pnpm test
pnpm check
```

Portable alternative for Windows:

```bash
.\start-local-dev.cmd
.\check-local-app.cmd
.\run-local-tests.cmd
```

### Runtime policy for tests

- Test commands enforce Node 20.x or 22.x via `npm run test:runtime-check`.
- On unsupported Node versions, test scripts fail fast with an actionable message.
- Temporary local bypass (never CI): set `DINK_ALLOW_UNSUPPORTED_NODE_TEST_RUNTIME=1`.

### Determinism/stability check

- Stress harness: `npm run test:server:stress`
- Optional run count override: set `DINK_TEST_SERVER_STRESS_RUNS` to a positive integer.

### Known test-noise policy

`npm run test:server` now runs through `scripts/run-server-tests.v1.mjs`, which suppresses only known Miniflare temporary-directory cleanup `EBUSY` noise lines.

- Scope: only known cleanup signatures from `@cloudflare/vitest-pool-workers` + `.wrangler/tmp/miniflare` paths.
- Safety: non-matching stderr warnings/errors always pass through unchanged.
- Troubleshooting: set `DINK_TEST_SERVER_SHOW_MINIFLARE_EBUSY=1` to bypass filtering and print raw stderr.

### Troubleshooting sequence (`npm run` reliability)

1. Run `npm run test:runtime-check` and verify Node 20.x or 22.x.
2. Run `npm run lint`.
3. Run `npm run test:server:stress`.
4. Run `npm run check`.
5. If needed for local diagnosis only, set `DINK_TEST_SERVER_SHOW_MINIFLARE_EBUSY=1`.

### CI parity notes

- Keep local and CI on the same major runtime: Node 20.x or Node 22.x.
- Use a clean install path in CI (`npm ci`) before running `npm run check`.

## Frontend UI/UX V1 shell (2026-03-03 cutover)

Primary IA routes:

- `/app/workspaces` -> company hub (create company, seed demo companies, open landing)
- `/app/groups/:groupId/control-panel` -> group control panel
- `/app/workspaces/:workspaceId/workbench` -> ordered module hub
- `/app/workspaces/:workspaceId/:coreModule` -> core module shell
- `/app/workspaces/:workspaceId/:coreModule/:subModule` -> module + submodule
- `/app/workspaces/:workspaceId/legacy-detail` -> legacy detailed workflow (compatibility path)

Notes:

- Global context launcher: `Ctrl + J` (workspace/year quick switch in top header)
- Theme: light-only (V1)
- i18n: English active with locale provider and key-based translations
- Tax adjustments shell: grouped sidebar (`Common`, `Advanced`) with pinned final-calculation chain
- Account mapping shell: high-density virtualized grid with `View All` / `Exceptions Only`, inline command preview, and search-first override picker
- Company hub: legal-name/org-number/fiscal-year capture with automatic initial workspace bootstrap and card-based company directory

### Ralph frontend premium loop

Use Ralph to run repeated frontend sweeps with premium design guardrails:

```bash
npm run ralph:frontend:guardrails
npm run ralph:frontend:gates
npm run ralph:frontend:program
```

Program defaults:

- PRD: `scripts/ralph/prd.frontend-full-premium.v1.json` (12 passes)
- Sweep cap: `6`
- Iteration cap per sweep: `24`
- Convergence target: `2` consecutive green sweeps

Optional visual baseline capture:

```bash
npm run ralph:frontend:visual
```

If you want visual capture to be mandatory in premium gates, set:

```bash
set DINK_RALPH_REQUIRE_VISUAL=1
```

Final consistency sweep command (FEP-12):

```bash
node scripts/ralph/check-frontend-premium-gates.v1.mjs
```

Final sweep guardrails confirmed for sign-off:

- V4-first token styling (`tokens.css`) with Open Sans and 4px/8px radii only
- Selector -> workbench -> module shell flow preserved and keyboard reachable
- No gradients, glassmorphism, or purple/indigo accent drift

Fallback (no global `pnpm`):

```bash
corepack pnpm dev
corepack pnpm generate:tb-template
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm check
```

## Local dev auth bypass (optional)

For faster local iteration without magic links, set the following in `.dev.vars`:

```bash
DEV_AUTH_BYPASS_ENABLED=true
DEV_AUTH_DEFAULT_TENANT_ID=<tenant-uuid-v4>
DEV_AUTH_DEFAULT_EMAIL=dev.user@example.com
DEV_AUTH_DEFAULT_ROLE=Admin
```

`DEV_AUTH_DEFAULT_TENANT_ID` can be either a UUIDv4 or a short numeric ID (for example `5335`) for local testing.

When enabled, the `/` route on `localhost` now auto-creates an Admin demo session (no magic-link step).

## Cloudflare Pages demo deploy (same-origin API + auto demo sign-in)

This repo supports a Pages deploy where static UI and `/v1/*` API run on the same origin via `functions/v1/[[route]].ts`.

Production demo flow:

1. Build the frontend:

```bash
pnpm run build:web
```

2. Create a Pages project once (pick your own name):

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\invoke-local-node-tool.ps1 .\node_modules\wrangler\bin\wrangler.js --config wrangler.pages.toml pages project create d-ink-demo --production-branch main
```

3. Configure Pages bindings/secrets (Dashboard):
- D1 binding: `DB`
- R2 binding: `ANNUAL_REPORT_FILES`
- Queue binding: `ANNUAL_REPORT_QUEUE`
- Vars:
  - `APP_BASE_URL=https://<your-pages-domain>`
  - `DEV_AUTH_BYPASS_ENABLED=true`
  - `DEV_AUTH_DEFAULT_TENANT_ID=<tenant-uuid-or-short-id>`
  - `DEV_AUTH_DEFAULT_EMAIL=<demo-admin-email>`
  - `DEV_AUTH_DEFAULT_ROLE=Admin`

4. Deploy:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\invoke-local-node-tool.ps1 .\node_modules\wrangler\bin\wrangler.js --config wrangler.pages.toml pages deploy dist --project-name d-ink-demo --branch main
```

5. Open the demo with auto sign-in enabled:

```text
https://<your-pages-domain>/?demo=1
```

`?demo=1` enables the same auto admin-session behavior used locally for the current browser session.

## Trial balance template

- Static download path: `/templates/trial-balance-template-v1.xlsx`
- Source generator: `scripts/generate-trial-balance-template-v1.mjs`

## Scaffold scope in Ticket 1

- Cloudflare Worker runtime baseline (`wrangler.toml`, `src/worker.ts`)
- Strict TypeScript setup
- Vitest smoke test
- Biome lint/format setup
- Module directory boundaries under `src/server/*`

## Canonical project docs

- `SINGLE_SOURCE_OF_TRUTH.md`
- `AGENTS.md`
- `MEMORY.md`
- `V2_ROADMAP.md`
