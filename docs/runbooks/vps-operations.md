# VPS Operations Runbook

## Local Substitute (when VPS is not ready yet)

Use the local production-like Docker stack as a direct substitute for VPS deploy flow:

```bash
# Start local production-like stack
pnpm run deploy:local:up

# Check status
pnpm run deploy:local:ps

# View logs
pnpm run deploy:local:logs

# Restart (simulates redeploy)
pnpm run deploy:local:restart

# Stop
pnpm run deploy:local:down
```

This mode uses:
- `deploy/compose.stack.yml`
- `deploy/compose.prod-sim.env.example`
- local images `apps/frontend/frontend:prod-sim` and `apps/frontend/backend:prod-sim`

So you can validate full-stack behavior before real VPS appears.

## 1. Required Secrets

### GitHub Actions Secrets (repository settings)

| Secret | Purpose | Example |
|---|---|---|
| `VPS_HOST` | VPS IP or hostname | `203.0.113.10` |
| `VPS_USER` | SSH user for deploy | `deploy` |
| `VPS_SSH_KEY` | SSH private key (ed25519 recommended) | PEM-encoded private key |
| `VPS_DEPLOY_PATH` | Absolute path to project on VPS | `/opt/botmox` |
| `API_HEALTHCHECK_URL` | Post-deploy health URL | `https://api.example.com/api/v1/health` |

### VPS-only Secrets (`.env.prod` on server, never in git)

| Variable | Purpose |
|---|---|
| `LICENSE_LEASE_SECRET` | HS256 signing key for execution leases (min 32 chars) |
| `AGENT_AUTH_SECRET` | HS256 signing key for scoped agent tokens (can equal `LICENSE_LEASE_SECRET`) |
| `AGENT_TOKEN_TTL_SECONDS` | Agent token TTL (recommended 30 days = `2592000`) |
| `AGENT_PAIRING_PUBLIC_URL` | Public API URL used in generated pairing links (`https://api.example.com`) |
| `SUPABASE_DB_PASSWORD` | PostgreSQL password |
| `SUPABASE_JWT_SECRET` | Supabase JWT signing key (min 32 chars) |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SUPABASE_ADMIN_EMAILS` | Comma-separated operator emails mapped to `admin` + `infra` |
| `SUPABASE_ADMIN_USER_IDS` | Comma-separated operator user IDs mapped to `admin` + `infra` |
| `MINIO_ROOT_PASSWORD` | MinIO root password |
| `S3_ACCESS_KEY_ID` | MinIO backend access key |
| `S3_SECRET_ACCESS_KEY` | MinIO backend secret key |

### Secret Generation

```bash
# Generate random token (64 chars)
openssl rand -hex 32

# Generate Supabase JWT secret (min 32 chars)
openssl rand -base64 48

# Generate SSH key for deploy user
ssh-keygen -t ed25519 -C "botmox-deploy" -f ~/.ssh/botmox-deploy
```

### Storage Policy

1. `.env.prod` exists only on VPS at `$VPS_DEPLOY_PATH/.env.prod`.
2. Never commit `.env.prod` to git.
3. `deploy/compose.prod.env.example` is the reference template.
4. Rotate secrets quarterly or on personnel changes.

---

## 2. VPS Initial Setup

### Prerequisites

- Ubuntu 22.04+ or Debian 12+.
- Docker Engine 24+ and Docker Compose v2.
- Minimum 2 vCPU / 4 GB RAM.
- SSH access configured for deploy user.

### First-time Setup

```bash
# 1. Create deploy directory
sudo mkdir -p /opt/botmox
sudo chown deploy:deploy /opt/botmox

# 2. Clone or copy repository files
cd /opt/botmox
git clone <repo-url> .
# Or scp the required files (compose, scripts, deploy config)

# 3. Create .env.prod from template
cp deploy/compose.prod.env.example .env.prod
# Edit .env.prod and fill in all secrets
nano .env.prod

# 4. Login to GHCR (one-time)
echo "<GHCR_PAT>" | docker login ghcr.io -u <username> --password-stdin

# 5. Create backup directories
mkdir -p backups/postgres backups/minio

# 6. Start the stack
IMAGE_TAG=main-latest ./scripts/deploy-vps.sh
```

### Fast Path (recommended after first setup)

```bash
# From GitHub UI:
# 1) Build And Publish Images (push to main)
# 2) Deploy Production -> image_tag=sha-<shortsha> (or main-latest)
```

What is now automated:

1. Workflow updates repository on VPS (`git pull --ff-only`).
2. Workflow computes GHCR repos from repository owner.
3. `deploy-vps.sh` resolves image repos from env automatically if needed.
4. `deploy-vps.sh` validates compose config before start.
5. Healthcheck uses retries with timeout instead of single one-shot curl.

---

## 3. Deploy Flow

### Automated (GitHub Actions)

1. Push code to `main` branch.
2. `images.yml` builds and pushes images with tags `sha-<shortsha>` and `main-latest`.
3. Go to **Actions > Deploy Production**.
4. Click **Run workflow**, enter image tag (e.g. `sha-abc1234`).
5. Workflow SSHs to VPS and executes `scripts/deploy-vps.sh`.
6. Post-deploy health check runs automatically.

### Manual Deploy (from VPS)

```bash
cd /opt/botmox

# Pull latest code changes
git pull origin main

# Deploy specific tag
IMAGE_TAG=sha-abc1234 \
API_HEALTHCHECK_URL=https://api.example.com/api/v1/health \
./scripts/deploy-vps.sh

# Dry-run (validate compose config only)
IMAGE_TAG=sha-abc1234 \
./scripts/deploy-vps.sh --dry-run
```

`FRONTEND_IMAGE_REPO`/`BACKEND_IMAGE_REPO` are optional in manual mode if they already exist in `.env.prod`
(or can be derived from `FRONTEND_IMAGE`/`BACKEND_IMAGE` there).

### Post-deploy Verification

```bash
# Health check
curl -sf https://api.example.com/api/v1/health | jq .

# Liveness
curl -sf https://api.example.com/api/v1/health/live | jq .

# Readiness (includes Supabase + S3 status)
curl -sf https://api.example.com/api/v1/health/ready | jq .

# Check running containers
docker compose -f deploy/compose.stack.yml --env-file .env.prod ps

# Check logs
docker compose -f deploy/compose.stack.yml --env-file .env.prod logs --tail=50 backend
docker compose -f deploy/compose.stack.yml --env-file .env.prod logs --tail=50 frontend
```

---

## 4. Rollback Flow

### Automated (GitHub Actions)

1. Go to **Actions > Rollback Production**.
2. Click **Run workflow**, enter the previous stable tag (e.g. `sha-prev123`).
3. Workflow restores previous image versions and runs health check.

### Manual Rollback (from VPS)

```bash
cd /opt/botmox

PREVIOUS_TAG=sha-prev123 \
API_HEALTHCHECK_URL=https://api.example.com/api/v1/health \
./scripts/rollback-vps.sh
```

`FRONTEND_IMAGE_REPO`/`BACKEND_IMAGE_REPO` are optional in manual mode if configured in `.env.prod`.

### Database Rollback

If a migration was applied and needs reverting:

```bash
# 1. Restore from pre-deploy backup
gunzip -c backups/postgres/postgres-<timestamp>.sql.gz | \
  docker exec -i supabase-db psql -U postgres postgres

# 2. Restart backend to pick up restored schema
docker compose -f deploy/compose.stack.yml --env-file .env.prod restart backend
```

---

## 5. Backup Schedule and Procedures

### Daily Backup (cron)

```bash
# Add to crontab on VPS (crontab -e)
# PostgreSQL backup daily at 03:00
0 3 * * * cd /opt/botmox && ./scripts/backup-postgres.sh >> /var/log/botmox-backup.log 2>&1

# MinIO backup daily at 03:30
30 3 * * * cd /opt/botmox && ./scripts/backup-minio.sh >> /var/log/botmox-backup.log 2>&1

# Cleanup backups older than 14 days
0 4 * * * find /opt/apps/frontend/backups -name "*.gz" -mtime +14 -delete
```

### Manual Backup

```bash
cd /opt/botmox

# PostgreSQL
./scripts/backup-postgres.sh
# Output: backups/postgres/postgres-YYYYMMDD-HHMMSS.sql.gz

# MinIO
./scripts/backup-minio.sh
# Output: backups/minio/minio-YYYYMMDD-HHMMSS.tar.gz
```

### Restore Drill Procedure

**Pre-restore backup is mandatory before any restore operation.**

#### PostgreSQL Restore

```bash
cd /opt/botmox

# 1. Create a safety backup first
./scripts/backup-postgres.sh

# 2. Stop backend to prevent writes
docker compose -f deploy/compose.stack.yml --env-file .env.prod stop backend

# 3. Restore from backup
gunzip -c backups/postgres/postgres-<timestamp>.sql.gz | \
  docker exec -i supabase-db psql -U postgres postgres

# 4. Restart backend
docker compose -f deploy/compose.stack.yml --env-file .env.prod start backend

# 5. Verify health
curl -sf https://api.example.com/api/v1/health/ready | jq .
```

#### MinIO Restore

```bash
cd /opt/botmox

# 1. Create a safety backup first
./scripts/backup-minio.sh

# 2. Stop minio
docker compose -f deploy/compose.stack.yml --env-file .env.prod stop minio

# 3. Get volume path
VOLUME_PATH=$(docker volume inspect botmox-stack_minio-data --format '{{.Mountpoint}}')

# 4. Restore archive
sudo tar -C "$VOLUME_PATH" -xzf backups/minio/minio-<timestamp>.tar.gz

# 5. Start minio
docker compose -f deploy/compose.stack.yml --env-file .env.prod start minio

# 6. Verify health
curl -sf https://api.example.com/api/v1/health/ready | jq .
```

---

## 6. Service Management

```bash
cd /opt/botmox
COMPOSE="docker compose -f deploy/compose.stack.yml --env-file .env.prod"

# View running services
$COMPOSE ps

# View logs (all services)
$COMPOSE logs --tail=100 -f

# View logs (specific service)
$COMPOSE logs --tail=100 -f backend

# Restart a single service
$COMPOSE restart backend

# Stop entire stack
$COMPOSE down

# Start entire stack
$COMPOSE up -d
```

---

## 7. Troubleshooting

### Backend won't start

```bash
# Check logs
docker compose -f deploy/compose.stack.yml --env-file .env.prod logs backend

# Common causes:
# - Missing env vars in .env.prod
# - Supabase/MinIO not reachable (check network)
```

### Health/ready returns unhealthy

```bash
# Check which dependency is down
curl -s https://api.example.com/api/v1/health | jq .

# Look for supabase_ready: false or s3_ready: false
# Restart the failing dependency:
docker compose -f deploy/compose.stack.yml --env-file .env.prod restart supabase-db supabase-kong
docker compose -f deploy/compose.stack.yml --env-file .env.prod restart minio
```

### GHCR image pull fails

```bash
# Re-authenticate
echo "<GHCR_PAT>" | docker login ghcr.io -u <username> --password-stdin

# Verify image exists
docker pull ghcr.io/<org>/botmox-backend:sha-abc1234
```

### Disk space low

```bash
# Check disk usage
df -h

# Clean old Docker images
docker image prune -a --filter "until=168h"

# Clean old backups
find /opt/apps/frontend/backups -name "*.gz" -mtime +7 -delete
```

---

## 8. Pre-deploy Checklist

- [ ] Backup PostgreSQL: `./scripts/backup-postgres.sh`
- [ ] Backup MinIO: `./scripts/backup-minio.sh`
- [ ] Verify the image tag exists in GHCR
- [ ] If DB migration included: review migration SQL
- [ ] Deploy using workflow or manual script
- [ ] Verify `/api/v1/health` returns OK
- [ ] Verify `/api/v1/health/ready` returns all deps healthy
- [ ] Verify frontend is accessible at `app.<domain>`
- [ ] Keep previous tag noted for rollback
