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
