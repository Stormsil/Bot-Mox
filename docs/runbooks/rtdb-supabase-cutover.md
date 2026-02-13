# RTDB → Supabase Cutover Runbook

## Prerequisites
1. D-01: Repository interfaces — GREEN.
2. D-02: Supabase repositories — GREEN.
3. D-03: Migration toolkit — GREEN.
4. All Supabase migrations applied to target environment.
5. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured.

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

## Rollback Procedure

### Immediate Rollback (< 24h, minimal writes to Supabase)
1. Set environment variable:
   ```
   DATA_BACKEND=rtdb
   ```
2. Restart backend service.
3. Verify health endpoints.
4. All reads/writes resume against RTDB.

### Late Rollback (> 24h, significant writes to Supabase)
1. Export Supabase changes since cutover (manual SQL queries).
2. Apply changes back to RTDB.
3. Switch `DATA_BACKEND=rtdb`.
4. Restart and verify.

## Post-stabilization Cleanup
After **7 days** of stable Supabase operation:
1. RTDB code path can be deprecated.
2. Firebase RTDB can be set to read-only.
3. After **30 days**, RTDB data can be archived.
