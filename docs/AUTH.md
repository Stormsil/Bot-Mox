# Auth (MVP)

Bot-Mox API uses `Authorization: Bearer <token>` for all `/api/v1/*` endpoints.

## Token Sources (Supported)

1. Internal tokens (ops/dev)
   - `INTERNAL_API_TOKEN` -> role: `api`
   - `INTERNAL_INFRA_TOKEN` -> roles: `infra`, `admin`

2. Supabase Auth (email/password)
   - Frontend signs in via Supabase and receives a short-lived `access_token` (JWT).
   - Backend validates the token via Supabase Auth API.

Firebase Auth tokens are treated as legacy and should be phased out.

## Supabase Auth Role Mapping (MVP)

By default any authenticated Supabase user gets role `api`.

Operators can be granted `admin` + `infra` by env allowlist:

- `SUPABASE_ADMIN_EMAILS` (comma-separated)
- `SUPABASE_ADMIN_USER_IDS` (comma-separated)

## Tenant Context (MVP)

For Supabase Auth, `tenant_id` is derived from `app_metadata.tenant_id` when present,
otherwise falls back to `DEFAULT_TENANT_ID`.

