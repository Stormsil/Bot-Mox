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

## Self-Hosted Supabase In Docker Stack (Prod / Prod-Sim)

Production-like stack (`deploy/compose.stack.yml`) runs Supabase core services (Postgres + GoTrue + PostgREST + Storage + Kong)
next to `frontend`, `backend`, `minio` and `caddy`.

Key env concepts:
1. `SUPABASE_PUBLIC_URL`: public base URL used by the browser and GoTrue for link generation (example: `https://supabase.example.com`).
2. `SUPABASE_URL`: backend/internal base URL used by `proxy-server` to talk to Supabase (default in stack: `http://supabase-kong:8000`).
3. `SUPABASE_ANON_KEY`: public key (safe for frontend).
4. `SUPABASE_SERVICE_ROLE_KEY`: server-only key (must never be exposed to frontend).

### Generate Keys

You can generate `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from a JWT secret:

```bash
npm run supabase:generate-keys -- --jwt-secret "<32+ char secret>" --issuer "supabase"
```

### Create The First User (Email/Password)

To create an operator user (admin API of GoTrue; requires service role key):

```bash
npm run supabase:create-user -- --email "admin@example.com" --password "ChangeMeNow!" --tenant "default"
```

Then allowlist the operator to receive `admin` + `infra` roles in backend via:

- `SUPABASE_ADMIN_EMAILS=admin@example.com` (comma-separated)
- or `SUPABASE_ADMIN_USER_IDS=<uuid>`

## Supabase Auth Role Mapping (MVP)

By default any authenticated Supabase user gets role `api`.

Operators can be granted `admin` + `infra` by env allowlist:

- `SUPABASE_ADMIN_EMAILS` (comma-separated)
- `SUPABASE_ADMIN_USER_IDS` (comma-separated)

## Tenant Context (MVP)

For Supabase Auth, `tenant_id` is derived from `app_metadata.tenant_id` when present,
otherwise falls back to `DEFAULT_TENANT_ID`.
