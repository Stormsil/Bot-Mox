# Bot-Mox

Bot-Mox is a SaaS control-plane and automation toolkit for managing bot infrastructure.

Current stack:
1. Frontend: React + TypeScript + Vite (`bot-mox/`)
2. Backend: Express API (`proxy-server/`)
3. Data: Supabase/Postgres (primary runtime)
4. Infra runtime: Docker Compose + Caddy + MinIO (production-like stack)

## Repository Layout

1. `bot-mox/` - frontend application
2. `proxy-server/` - backend API and infra connectors
3. `docs/` - architecture, API contract, plans, rollout docs
4. `deploy/` - production-like compose stack, Caddy config, env templates
5. `scripts/` - operational scripts (stack up/down, deploy, rollback, backups)

## Quick Start (Development)

Prerequisites:
1. Node.js 20+
2. npm 10+
3. Docker Desktop

Install:

```bash
npm ci
cd bot-mox && npm ci
cd ../proxy-server && npm ci
cd ..
```

Run local app (non-container):

```bash
npm run dev
```

Run Docker dev stack (hot reload):

```bash
npm run stack:dev:up
```

Run production-like local stack:

```bash
npm run stack:prod-sim:up
```

## Quality Gates

Run full local checks:

```bash
npm run check:all
```

CI workflow: `.github/workflows/ci.yml`

## AI Debugging & Testing

Stack:
- Observability: OpenTelemetry (frontend + backend) + JSON logs (pino) + Jaeger (OTLP)
- E2E: Playwright with `trace.zip` artifacts on failures
- Frontend incident ingest: `uiLogger` -> `POST /api/v1/client-logs` -> backend pino stream (`scope=client_log`)

Quick start (local):

```bash
# 1) Start Jaeger UI (OTLP receiver + trace viewer)
npm run obs:up

# 2) Start app with tracing enabled (backend + frontend propagation)
npm run dev:trace

# 3) Fast sanity check (no scenarios)
npm run doctor

# 4) Run E2E smoke
npm run test:e2e

# If you already run the prod-like stack on http://localhost (Caddy) and don't want Playwright to start webServer:
npm run test:e2e:prodlike

# Combined quick check (doctor + Playwright smoke against http://localhost):
npm run smoke:prodlike
```

Where to find debugging artifacts:
- Playwright results: `bot-mox/test-results/`
- Playwright HTML report: `bot-mox/playwright-report/`
- AI-native debug runbook + env vars: `docs/plans/ai-native-observability-testing.md`
- Frontend incident logs: backend JSON stream (`scope=client_log`, `source=frontend`)

How to analyze failures (AI agent flow):
1. Open Playwright report and trace (`trace.zip`) for the failing test.
2. Read `x-trace-id` (or request `traceparent`) for the failing network request.
3. Find backend JSON request logs by `trace_id` to reconstruct the server-side flow.
4. Find frontend ingest logs by `scope=client_log` + same `trace_id` (or `correlation_id`) to connect UI errors with backend flow.
5. (If enabled) Open Jaeger UI and inspect spans for that Trace ID.

Guardrails:
- `npm run check:frontend:logging` blocks new `console.*` in critical frontend layers (`services/hooks/pages/observability/ErrorBoundary`).
- `npm run check:backend:logging` blocks new `console.*` in backend (allowlist-based).

## API Contract and Architecture

1. API contract: `docs/api/openapi.yaml`
2. Architecture baseline: `docs/ARCHITECTURE.md`
3. Execution roadmap: `docs/plans/green-implementation-roadmap.md`
4. Tracker-ready backlog: `docs/plans/green-issue-backlog.md`

## Deployment

1. Build/publish images: `.github/workflows/images.yml`
2. Manual deploy: `.github/workflows/deploy-prod.yml`
3. Manual rollback: `.github/workflows/rollback-prod.yml`

VPS scripts:
1. `scripts/deploy-vps.sh`
2. `scripts/rollback-vps.sh`
3. `scripts/backup-postgres.sh`
4. `scripts/backup-minio.sh`

## Publish to GitHub

If repository is not connected yet:

```bash
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

If you use SSH:

```bash
git remote add origin git@github.com:<owner>/<repo>.git
git push -u origin main
```
