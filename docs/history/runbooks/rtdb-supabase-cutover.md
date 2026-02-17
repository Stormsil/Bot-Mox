# RTDB → Supabase Cutover Runbook (Legacy)

## Prerequisites
1. D-01: Repository interfaces — GREEN.
2. D-02: Supabase repositories — GREEN.
3. D-03: Migration toolkit — GREEN.
4. All Supabase migrations applied to target environment.
5. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured.
6. Firebase Admin доступен для скриптов миграции (`firebase-key.json` или `FIREBASE_DATABASE_URL` + credentials).
7. Migration tooling dependencies installed: `cd scripts && npm install`.

## Migration Toolkit Scripts

| Script | Purpose |
|--------|---------|
| `node scripts/migrate-rtdb-to-supabase.js --dry-run` | Preview migration without writing |
| `node scripts/migrate-rtdb-to-supabase.js` | Execute migration (idempotent) |
| `node scripts/verify-migration-parity.js` | Compare record counts + sample records |

## Cutover Procedure

### Phase 1: Pre-cutover Verification (no downtime)
1. Run migration in dry-run mode:
   ```bash
   node scripts/migrate-rtdb-to-supabase.js --dry-run
   ```
2. Verify source counts are as expected.

### Phase 2: Initial Migration (no downtime)
1. Run migration:
   ```bash
   node scripts/migrate-rtdb-to-supabase.js
   ```
2. Verify parity:
   ```bash
   node scripts/verify-migration-parity.js
   ```
3. Review any MISMATCH entries.

### Phase 3: Freeze Window (brief downtime)
1. **Announce maintenance window** (1-5 minutes expected).
2. Stop backend or set read-only mode to prevent RTDB writes.
3. Run final migration to capture any writes since Phase 2:
   ```bash
   node scripts/migrate-rtdb-to-supabase.js
   ```
4. Verify final parity:
   ```bash
   node scripts/verify-migration-parity.js
   ```

Important: run migration and parity verification sequentially (do not execute in parallel).

### Phase 4: Switch Backend
1. Set environment variable:
   ```
   DATA_BACKEND=supabase
   ```
2. Restart backend service.
3. Verify health:
   ```bash
   curl -s http://localhost:3001/api/v1/health | jq .
   curl -s http://localhost:3001/api/v1/health/ready | jq .
   ```

### Phase 5: Post-cutover Smoke
1. Test each domain endpoint:
   - `GET /api/v1/bots` — verify bot list loads
   - `GET /api/v1/resources/licenses` — verify resources load
   - `GET /api/v1/workspace/notes` — verify workspace loads
   - `GET /api/v1/finance/operations` — verify finance loads
   - `GET /api/v1/settings` — verify settings load
2. Test write operations:
   - `POST /api/v1/bots` — create a test bot, then delete it
   - `PATCH /api/v1/settings/test_key` — write and read back
3. Verify no errors in application logs.

### Phase 6: Monitoring Window
1. Monitor for **24 hours** after switch.
2. Check for:
   - API error rate changes
   - Response time regressions
   - Missing data reports from users

## Rollback Procedure (Current Runtime)

`DATA_BACKEND` toggle rollback is no longer the primary strategy.

1. Use deployment rollback (`rollback-prod.yml` / `scripts/rollback-vps.sh`) to return to the previous known-good backend image.
2. Keep Supabase as runtime data source.
3. If a data incident occurred during migration, run targeted data restore/replay from backups.

## Post-cutover Maintenance

1. Keep RTDB in read-only/archive mode as a historical source during stabilization window.
2. Use `scripts/migrate-rtdb-to-supabase.js` and parity verification only for residual backfill.
3. After the agreed retention period, archive and decommission RTDB access.
