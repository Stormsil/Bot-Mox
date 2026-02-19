# Audit: AI-Native Observability & Testing

Date: 2026-02-17

## Intent
Introduce an "AI-Native Observability & Testing" baseline so agents can debug by correlating:

- Playwright E2E artifacts (`trace.zip`, screenshots, DOM snapshots, network logs)
- backend JSON logs (`trace_id`, `span_id`)
- distributed traces (Jaeger via OTLP)

## What Changed

### Wave-1 Debug-First Refactor (Frontend Logging + AI Incident Readiness)

- Added centralized frontend logger stack:
  - `apps/frontend/src/observability/logContext.ts`
  - `apps/frontend/src/observability/uiLogger.ts`
  - `apps/frontend/src/observability/clientLogTransport.ts`
- Added frontend incident ingest endpoint:
  - `apps/backend-legacy/src/modules/v1/client-logs.routes.js`
  - mounted in `apps/backend-legacy/src/modules/v1/index.js` as `/api/v1/client-logs` before mandatory auth.
- Ingest safety controls:
  - payload schema validation (`events` 1..20, body limit `64kb`)
  - recursive redaction for secrets (`password/token/authorization/cookie/...`)
  - truncation and size guards for `message`, `stack`, `extra`
  - route-level rate limiting (`60 req/min`, keyed by `uid` or hashed IP)
- Frontend critical-scope console refactor:
  - replaced `console.*` with `uiLogger.*` in `services/hooks/pages/observability/ErrorBoundary`.
- Added frontend logging guardrail:
  - `scripts/check-frontend-console.js`
  - `pnpm run check:frontend:logging`
  - integrated into `pnpm run check:all`.

### Backend (backend-legacy)
- Added OpenTelemetry bootstrap:
  - `apps/backend-legacy/src/observability/tracing.js`
  - `apps/backend-legacy/src/index.js` now initializes tracing before loading the app.
- Disabled OTel pino auto-instrumentation to avoid duplicate JSON keys:
  - `apps/backend-legacy/src/observability/tracing.js` disables `@opentelemetry/instrumentation-pino` because we inject `trace_id`/`span_id` ourselves.
- Added structured JSON logging (pino) and request logging (pino-http):
  - `apps/backend-legacy/src/observability/logger.js`
  - `apps/backend-legacy/src/bootstrap/http-middleware.js` now:
    - logs requests as JSON
    - injects `x-trace-id` / `x-span-id` response headers
    - updates CORS headers to allow/ expose tracing headers
- Refactored `console.*` usage to `logger.*` in infra modules to ensure JSON logs:
  - `apps/backend-legacy/src/modules/infra/connectors.js`
  - `apps/backend-legacy/src/modules/infra/ui-proxy-stack.js`
  - `apps/backend-legacy/src/modules/infra/ui-fallback-middleware.js`
  - `apps/backend-legacy/src/modules/infra/ui-service-auth.js`
  - `apps/backend-legacy/src/modules/infra/vm-operations-ws.js`
  - `apps/backend-legacy/src/middleware/audit-log.js`
  - `apps/backend-legacy/src/middleware/request-logger.js` (kept as fallback, now JSON)
- Added optional OTLP proxy route for browser-exported traces:
  - `apps/backend-legacy/src/modules/v1/otel.routes.js`
  - mounted under `/api/v1/otel/v1/traces` when `BOTMOX_OTEL_PROXY_ENABLED=1`

### Frontend (botmox)
- Added OpenTelemetry web bootstrap:
  - `apps/frontend/src/observability/otel.ts`
  - imported early in `apps/frontend/src/main.tsx`
- Enhanced API error objects with `x-trace-id` / `x-correlation-id` for triage:
  - `apps/frontend/src/services/apiClient.ts`

### E2E (Playwright)
- Added Playwright config and smoke test:
  - `apps/frontend/playwright.config.ts`
  - `apps/frontend/e2e/smoke.spec.ts`
- Fixed `test:e2e:prodlike` on Windows + Node 24 (`spawn EINVAL` for `.cmd`):
  - `scripts/e2e-prodlike.js` now runs via `cmd.exe /c`.
- Artifacts output:
  - `apps/frontend/test-results/**`
  - `apps/frontend/playwright-report/**`

### DevOps / Workflow
- Added Jaeger compose:
  - `deploy/compose.observability.yml`
- Added scripts:
  - `pnpm run obs:up`, `pnpm run obs:down`
  - `pnpm run dev:trace` (via `scripts/dev-trace.js`)
  - `pnpm run doctor` (via `scripts/doctor.js`) for fast non-scenario validation
  - `pnpm run test:e2e`, `pnpm run test:e2e:report`
  - `pnpm run test:e2e:prodlike` (via `scripts/e2e-prodlike.js`) to run Playwright against `http://localhost/`
- CI:
  - `.github/workflows/ci.yml` now runs Playwright E2E and uploads artifacts.

### Reliability Fixes
- Fixed `doctor` instability on Node 24 (libuv assert when using `fetch` + `AbortController`):
  - `scripts/doctor.js` now uses `http`/`https` with explicit timeouts instead of `fetch` abort.

## How To Verify
1. Start Jaeger:
   - `pnpm run obs:up`
2. Run app with tracing:
   - `pnpm run dev:trace`
3. Open UI and verify requests include W3C headers (DevTools -> Network -> Request headers):
   - `traceparent`, `tracestate`, `baggage`
4. Verify backend responses include:
   - `x-trace-id`, `x-span-id`, `x-correlation-id`
5. Verify backend logs are JSON and contain `trace_id` / `span_id`.
6. Run E2E:
   - `pnpm run test:e2e`
   - force a failure and verify `trace.zip` exists under `apps/frontend/test-results/**`.
7. Fast sanity check (prod-like or dev):
   - `pnpm run doctor` writes `logs/doctor-report.json` with detected mode + headers + dependency status.
8. Frontend logging guardrail:
   - `pnpm run check:frontend:logging` must pass.
9. Frontend ingest contract:
   - `POST /api/v1/client-logs` with valid payload returns `success=true` and `accepted > 0`.
10. Correlation path:
   - trigger frontend warn/error -> find backend JSON with `scope=client_log` and shared `trace_id`/`correlation_id`.

## Risk Notes
- Tracing is gated by `BOTMOX_OTEL_ENABLED`. If initialization fails, backend continues running.
- OTLP proxy is gated by `BOTMOX_OTEL_PROXY_ENABLED` and is intended for dev only.
- In prod-like docker mode, frontend OTel can be configured via `runtime-config.js` (nginx entrypoint) using `VITE_OTEL_*` env vars.

## Next Steps (Roadmap)
- Add stable E2E flows (login, bots list, notes CRUD) with test data seeding.
- Add backend integration tests and coverage thresholds.
- Add metrics (OTel) + SLO checks and an automated "debug bundle" script that collects:
  - Playwright artifacts
  - filtered backend logs by `trace_id`
  - Jaeger trace export

