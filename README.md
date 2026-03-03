# D.ink Engineering Bootstrap

This repository contains the V1 technical scaffold for D.ink.

## Prerequisites

- Node.js 20+
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

### Known test-noise policy

`npm run test:server` now runs through `scripts/run-server-tests.v1.mjs`, which suppresses only known Miniflare temporary-directory cleanup `EBUSY` noise lines.

- Scope: only known cleanup signatures from `@cloudflare/vitest-pool-workers` + `.wrangler/tmp/miniflare` paths.
- Safety: non-matching stderr warnings/errors always pass through unchanged.
- Troubleshooting: set `DINK_TEST_SERVER_SHOW_MINIFLARE_EBUSY=1` to bypass filtering and print raw stderr.

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
