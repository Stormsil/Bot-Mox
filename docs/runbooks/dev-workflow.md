# Development Workflow (Prod-Like Localhost)

Last updated (UTC): **2026-02-19T18:07:17Z**

## Core Principle

Default local development should run through Caddy on `http://localhost` with production-like routing:
- web UI
- API
- ws routes
- S3 and Supabase passthrough routes

## Main Commands

1. Start prod-like stack:
```bash
pnpm run dev:prodlike:up
```

2. Stop prod-like stack:
```bash
pnpm run dev:prodlike:down
```

3. Inspect stack:
```bash
pnpm run dev:prodlike:ps
pnpm run dev:prodlike:logs
```

## Enterprise Migration Commands

1. Monorepo dev orchestrator (requires pnpm installed):
```bash
pnpm run dev:mono
```

2. Run migration gates:
```bash
pnpm run db:types:check
pnpm run contract:check
pnpm run check:all:mono
```

## Current Baseline

`pnpm` + `turbo` with `apps/backend` (Nest) is the default workflow for local development and migration gates.
