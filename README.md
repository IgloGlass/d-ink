# D.ink Engineering Bootstrap

This repository contains the V1 technical scaffold for D.ink.

## Prerequisites

- Node.js 20.x (LTS, required for `npm run test` / `npm run check`)
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

## Local commands

```bash
pnpm dev
pnpm generate:tb-template
pnpm lint
pnpm typecheck
pnpm test
pnpm check
```

Portable alternative (works even when global `pnpm`/`corepack` is unavailable):

```bash
npm run dev
npm run generate:tb-template
npm run lint
npm run typecheck
npm run test
npm run check
```

### Runtime policy for tests

- Test commands enforce Node 20.x via `npm run test:runtime-check`.
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

1. Run `npm run test:runtime-check` and verify Node 20.x.
2. Run `npm run lint`.
3. Run `npm run test:server:stress`.
4. Run `npm run check`.
5. If needed for local diagnosis only, set `DINK_TEST_SERVER_SHOW_MINIFLARE_EBUSY=1`.

### CI parity notes

- Keep local and CI on the same major runtime: Node 20.x.
- Use a clean install path in CI (`npm ci`) before running `npm run check`.

## Frontend UI/UX V1 shell (2026-03-03 cutover)

Primary IA routes:

- `/app/workspaces` -> company selector (search-first with suggestions)
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

When enabled, the `/` sign-in screen on `localhost` shows a "Quick dev sign-in" form that creates a local session cookie.

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
