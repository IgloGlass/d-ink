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
pnpm lint
pnpm typecheck
pnpm test
pnpm check
```

Fallback (no global `pnpm`):

```bash
corepack pnpm dev
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm check
```

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
