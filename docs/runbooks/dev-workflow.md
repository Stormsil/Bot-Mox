# Development Workflow (Prod-Like Localhost)

Last updated (UTC): **2026-02-18T21:17:42Z**

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

## Strangler Routing (Nest + Legacy)

Legacy API can proxy selected modules to Nest:

```env
STRANGLER_NEST_URL=http://127.0.0.1:3002
STRANGLER_MODULES=health,auth,agents,resources,vm-ops,bots,workspace,finance,playbooks,wow-names,ipqs,settings,license,theme-assets,provisioning
STRANGLER_FALLBACK_TO_LEGACY=true
STRANGLER_TIMEOUT_MS=20000
```

Behavior:
1. Request enters `proxy-server`.
2. If module is in `STRANGLER_MODULES`, request is proxied to Nest.
3. If Nest is unavailable and fallback is enabled, request is served by legacy Express.

## Current Baseline

`pnpm` + `turbo` is the default workflow for local development and migration gates. npm flow remains fallback-only for legacy environments.
