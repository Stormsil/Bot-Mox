# Contributing

## Branch Strategy

1. Keep `main` releasable.
2. Create feature branches from `main`:
   - `feat/<scope>`
   - `fix/<scope>`
   - `chore/<scope>`
3. Open PRs into `main` and require green CI before merge.

## Commit Style

Use clear, scoped commit messages:
1. `feat(api): add artifacts resolve-download endpoint`
2. `fix(frontend): handle vm offline state in vm-ops`
3. `chore(deploy): add rollback workflow`

## Quality Checklist

Before pushing:
1. `npm run lint`
2. `npm run check:types`
3. `npm run build`
4. `npm run check:backend:syntax`
5. `npm run check:backend:smoke`
6. `npm run check:secrets`

## Security Rules

1. Never commit `.env` or private keys.
2. Keep production secrets only on VPS/secret manager.
3. Redact sensitive values in logs and error payloads.
4. Validate tenant boundaries on every new endpoint.

## Documentation Rules

When changing behavior:
1. Update `docs/api/openapi.yaml` for contract changes.
2. Update `docs/ARCHITECTURE.md` if topology/runtime changes.
3. Update roadmap/backlog status in:
   - `docs/plans/green-implementation-roadmap.md`
   - `docs/plans/green-issue-backlog.md`
