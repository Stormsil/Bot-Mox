# Bot-Mox Architecture

## Runtime Topology

- Frontend: `bot-mox/` (`React + TypeScript + Vite + Refine + Ant Design`)
- Backend: `proxy-server/` (`Express`)
- Production-like edge/runtime: `deploy/compose.stack.yml` (`caddy + frontend + backend + minio`)
- Canonical API: `/api/v1/*`
- Primary storage: Firebase Realtime Database
- Optional migration target: Supabase/Postgres (feature-flagged via `DATA_BACKEND`)

Legacy `/api/*` compatibility routes и Cloud Functions в текущем runtime отсутствуют.

## Backend Structure

- Entry point: `proxy-server/server.js`
- App wiring: `proxy-server/src/legacy-app.js`
- API router: `proxy-server/src/modules/v1/index.js`
- Envelope contract: `proxy-server/src/contracts/envelope.js`

Domain routers:

- `auth.routes.js`
- `resources.routes.js`
- `workspace.routes.js`
- `settings.routes.js`
- `bots.routes.js`
- `finance.routes.js`
- `vm.routes.js` (`/api/v1/vm/*`, tenant-scoped VM UUID registry)
- `license.routes.js` (`/api/v1/license/*`, execution lease + heartbeat/revoke)
- `artifacts.routes.js` (`/api/v1/artifacts/*`, release assignment + lease-gated download resolve)
- `agents.routes.js` (`/api/v1/agents/*`, agent registration/pairing/heartbeat/revoke)
- `secrets.routes.js` (`/api/v1/secrets/*`, ciphertext-only E2E encrypted vault)
- `vm-ops.routes.js` (`/api/v1/vm-ops/*`, agent-mediated VM operations via command bus)
- `ipqs.routes.js`
- `wow-names.routes.js`
- `infra.routes.js` (legacy, admin/infra only)

Domain services:

- `modules/vm-registry/service.js`
- `modules/license/service.js`
- `modules/artifacts/service.js`
- `modules/agents/service.js`
- `modules/secrets/service.js`
- `modules/vm-ops/service.js`

Storage providers:

- `repositories/s3/storage-provider.js` (MinIO/S3 adapter for artifacts delivery)

## Security Baseline

- Bearer auth middleware: `proxy-server/src/middleware/auth.js`
- Tenant context on auth payload (`tenant_id`)
- Supported auth backends: internal tokens + Supabase Auth (see `docs/AUTH.md`)
- Infra RBAC gate (`infra` role) on `/api/v1/infra/*` (legacy, admin only)
- Agent operations require admin/infra role for pairing and revoke
- Secrets vault: server-blind E2E encryption (stores only ciphertext, never returns plaintext)
- VM operations flow through agent command bus (fail-fast when agent offline)
- Infra auth gate for UI proxy and WebSocket channels (`/proxmox-ui*`, `/tinyfm-ui*`, `/syncthing-ui*`, `/ws/vm-operations*`)
- Audit logging for infra mutating operations
- HTTP hardening and CORS: `proxy-server/src/bootstrap/http-middleware.js`

## Storage Policy

- Storage policy path: `/api/v1/settings/storage_policy`
- Secrets mode is fixed to `local-only`
- Operational mode: `local | cloud`
- Sync adapter: `sync.enabled` (`true | false`)

## Contract And Source Of Truth

- API contract: `docs/api/openapi.yaml`
- Data model notes: `docs/DATABASE.md`
- RTDB rules: `database.rules.json`
- Firestore rules: `firestore.rules`
- Migration/rollout plan: `docs/plans/supabase-saas-agent-mvp.md`
- Execution backlog (green roadmap): `docs/plans/green-implementation-roadmap.md`
- Tracker-ready issue list: `docs/plans/green-issue-backlog.md`
- Deploy stack manifests: `deploy/compose.stack.yml`, `deploy/compose.dev.override.yml`
- Deploy workflows: `.github/workflows/images.yml`, `.github/workflows/deploy-prod.yml`, `.github/workflows/rollback-prod.yml`
- VPS operations runbook: `docs/runbooks/vps-operations.md`
- Supabase agents/secrets/commands schema: `supabase/migrations/20260212000400_create_agents_domain.sql`

## History

- `docs/history/architecture/refactor-baseline.md`
- `docs/history/architecture/refactor-handoff-2026-02-10.md`
