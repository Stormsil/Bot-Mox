# Secrets Rotation Audit Window

Status: Active  
Owner: Platform Security  
Last Updated: 2026-02-22  
Applies To: `apps/backend`, `scripts/secrets-rotation-runner.js`

## Purpose

Operational evidence log for tenant secret rotation runs (dry-run and live).

## Entries

| Timestamp (UTC) | Key ID | Dry Run | Tenants | Successful | Failed Tenants | Planned | Rotated | Skipped | Failed Secrets | Status | Details |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

| 2026-02-22T08:10:00.000Z | kms-2026q1 | true | 2 | 2 | 0 | 5 | 0 | 1 | 0 | pass | ok |
| 2026-02-22T10:10:08.877Z | local-key-2026-02-22 | false | 37 | 37 | 0 | 0 | 0 | 0 | 0 | pass | ok |
| 2026-02-22T10:10:29.482Z | local-key-2026-02-22 | false | 37 | 37 | 0 | 0 | 0 | 0 | 0 | pass | ok |
| 2026-02-22T10:10:29.482Z | local-key-2026-02-22 | false | 37 | 37 | 0 | 0 | 0 | 0 | 0 | pass | ok |
| 2026-02-22T10:10:54.416Z | local-key-2026-02-22 | false | 37 | 37 | 0 | 0 | 0 | 0 | 0 | pass | ok |
| 2026-02-22T10:11:37.124Z | local-key-2026-02-22 | false | 37 | 37 | 0 | 0 | 0 | 0 | 0 | pass | ok |
