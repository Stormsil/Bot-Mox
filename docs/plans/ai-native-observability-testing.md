# AI-Native Observability & Testing (Playwright + OpenTelemetry)

Last updated: 2026-02-17

## Goal
Make Bot-Mox easy to debug (for humans and AI agents) by ensuring:

- every backend log line is JSON and contains `trace_id` + `span_id`
- frontend propagates W3C trace context (`traceparent`, `tracestate`, `baggage`) to backend
- Playwright E2E produces rich artifacts (`trace.zip`, screenshots, DOM snapshots, network logs) on failures

## Signals Overview

### Backend (proxy-server)
- **Tracing**: OpenTelemetry Node SDK + auto-instrumentation (HTTP server/client + Express + outbound HTTP used by Supabase SDK).
- **Logs**: `pino` JSON logs, request logs via `pino-http`.
- **Correlation**:
  - `trace_id` / `span_id` in every log line
  - `x-trace-id` / `x-span-id` attached to every HTTP response
  - existing `x-correlation-id` preserved

### Frontend (bot-mox)
- **Tracing**: OpenTelemetry Web SDK (Document Load + User Interaction + Fetch).
- **Propagation**: fetch instrumentation injects W3C headers to backend requests.
- **Export (optional but enabled in `pnpm run dev:trace`)**:
  - frontend spans are exported via backend proxy to avoid Jaeger CORS issues
- **Frontend incident logs**:
  - `uiLogger` emits normalized events
  - `warn/error` are batched and sent to backend ingest `POST /api/v1/client-logs`
  - backend stores them in pino JSON stream with `scope=client_log`, `source=frontend`

### E2E (Playwright)
- `trace: 'retain-on-failure'` locally
- `trace: 'on-first-retry'` in CI
- report artifacts:
  - `bot-mox/test-results/**` (includes `trace.zip`)
  - `bot-mox/playwright-report/**`
  - `bot-mox/test-results/playwright-report.json`

## Local Workflow

### 1) Start Observability UI (Jaeger)
```bash
pnpm run obs:up
```

- Jaeger UI: `http://localhost:16686`
- OTLP HTTP endpoint (backend exporter default): `http://localhost:4318/v1/traces`

Stop:
```bash
pnpm run obs:down
```

### 2) Start Dev With Tracing Enabled
```bash
pnpm run dev:trace
```

If `3001` is busy, set:
```bash
BOTMOX_PROXY_PORT=3101 pnpm run dev:trace
```

This enables:
- backend OTel (`BOTMOX_OTEL_ENABLED=1`)
- backend OTLP proxy for browser spans (`BOTMOX_OTEL_PROXY_ENABLED=1`)
- frontend OTel (`VITE_OTEL_ENABLED=1`) + exporter to `http://localhost:3001/api/v1/otel/v1/traces`

### 3) Run E2E
```bash
pnpm run test:e2e
```

Open report:
```bash
pnpm run test:e2e:report
```

### Prod-like Smoke (http://localhost/)
If you are running the prod-like stack (Caddy) and want a fast validation without starting dev servers:
```bash
pnpm run doctor
pnpm run test:e2e:prodlike
```

Or as a single command:
```bash
pnpm run smoke:prodlike
```

### Prod-like: enable tracing signals (recommended for debugging)
In the prod-like docker stack, the frontend is static (nginx) and reads runtime config from `runtime-config.js`.
To enable frontend OTel there, set these env vars for the `frontend` container (via `deploy/compose.prod-sim.env`):

```bash
VITE_OTEL_ENABLED=1
VITE_OTEL_SERVICE_NAME=bot-mox-frontend
VITE_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost/api/v1/otel/v1/traces
```

To enable backend tracing in the docker stack, set:
```bash
BOTMOX_OTEL_ENABLED=1
BOTMOX_DIAGNOSTICS_ENABLED=1
BOTMOX_OTEL_PROXY_ENABLED=1
OTEL_SERVICE_NAME=bot-mox-backend
```

If Jaeger is started on the host (`pnpm run obs:up`), use OTLP endpoint reachable from the container:
- Windows/macOS Docker Desktop: `OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318`

## Debug Runbook (Human + AI Agent)

### If an E2E test fails
1. Open Playwright HTML report (`pnpm run test:e2e:report`) and/or `bot-mox/test-results/playwright-report.json`.
2. Open the Playwright trace (`trace.zip`) from `bot-mox/test-results/**/trace.zip`.
3. Find the failing network request and read response headers:
   - `x-trace-id`
   - `x-correlation-id`
4. Backend logs: filter JSON logs by `trace_id=<value>`.
5. Frontend ingest logs: filter by `scope=client_log` + same `trace_id` or `correlation_id`.
6. Jaeger UI: search the trace by Trace ID and inspect spans (HTTP inbound + outbound calls).

### If the bug is not from E2E
1. Get `x-trace-id` from the browser devtools Network tab (any API call).
2. Find backend logs by `trace_id`.
3. Use spans in Jaeger to locate the slow/error segment.

## Configuration (Env Vars)

### Backend
- `BOTMOX_OTEL_ENABLED=1` enable tracing
- `OTEL_SERVICE_NAME=bot-mox-backend`
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces` (optional override)
- `BOTMOX_OTEL_PROXY_ENABLED=1` enable `/api/v1/otel/v1/traces` proxy (dev-only by default)
- `BOTMOX_PROXY_PORT=3101` override backend dev port used by `start-dev.js` (useful if `3001` is already in use)

### Frontend
- `VITE_OTEL_ENABLED=1`
- `VITE_OTEL_SERVICE_NAME=bot-mox-frontend`
- `VITE_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3001/api/v1/otel/v1/traces` (optional)

## Guardrails

- Backend: `pnpm run check:backend:logging`
- Frontend (wave-1 scope): `pnpm run check:frontend:logging`

Frontend guardrail fails CI on new `console.*` in:
- `bot-mox/src/services/**`
- `bot-mox/src/hooks/**`
- `bot-mox/src/pages/**`
- `bot-mox/src/observability/**`
- `bot-mox/src/components/ui/ErrorBoundary.tsx`

## CI Artifacts (Download For AI Analysis)
Playwright artifacts are uploaded in GitHub Actions as `playwright-artifacts` (includes `trace.zip` on failures).

Download via GitHub UI:
- Actions -> конкретный workflow run -> Artifacts -> `playwright-artifacts`

Download via GitHub CLI:
```bash
gh run list --workflow CI
gh run download <run_id> -n playwright-artifacts
```

