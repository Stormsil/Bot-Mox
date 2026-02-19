# Auth (MVP)

Bot-Mox API uses `Authorization: Bearer <token>` for all `/api/v1/*` endpoints.

## Token Sources (Supported)

1. Supabase Auth (email/password)
   - Frontend signs in via Supabase and receives a short-lived `access_token` (JWT).
   - Backend validates the token via Supabase Auth API.
   - Authenticated users receive role `api` by default.
   - `admin`/`infra` are mapped by allowlist: `SUPABASE_ADMIN_EMAILS` and `SUPABASE_ADMIN_USER_IDS`.

2. Agent token (pairing bootstrap -> scoped runtime token)
   - Agent registers via one-time `pairing_code` (`POST /api/v1/agents/register`).
   - Backend returns `agent_token` bound to `agent_id` + `tenant_id`.
   - Agent uses this token for heartbeat and vm-ops command queue polling.
   - Agents are user-bound (`owner_user_id`); VM command dispatch validates ownership unless caller has `admin/infra`.
   - Non-privileged access to unassigned agents is blocked (`AGENT_OWNER_UNASSIGNED`).

Legacy internal API token auth is removed from runtime middleware.

## Agent Pairing UX Helpers

To reduce manual setup in desktop agent, `POST /api/v1/agents/pairings` also returns:

- `pairing_bundle` (base64url payload with pairing metadata)
- `pairing_uri` (`botmox://pair?bundle=...`)
- `pairing_url` (`https://.../agent/pair?bundle=...`) when server URL is resolvable
- `proxmox_defaults` (URL/username/node only, no secrets) for agent autofill

Public URL can be forced by env:

- `AGENT_PAIRING_PUBLIC_URL=https://api.example.com`

## Self-Hosted Supabase In Docker Stack (Prod / Prod-Sim)

Production-like stack (`deploy/compose.stack.yml`) runs Supabase core services (Postgres + GoTrue + PostgREST + Storage + Kong)
next to `frontend`, `backend`, `minio` and `caddy`.

Key env concepts:
1. `SUPABASE_PUBLIC_URL`: public base URL used by the browser and GoTrue for link generation (example: `https://supabase.example.com`).
2. `SUPABASE_URL`: backend/internal base URL used by `apps/backend` to talk to Supabase (default in stack: `http://supabase-kong:8000`).
3. `SUPABASE_ANON_KEY`: public key (safe for frontend).
4. `SUPABASE_SERVICE_ROLE_KEY`: server-only key (must never be exposed to frontend).

### Generate Keys

You can generate `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from a JWT secret:

```bash
pnpm run supabase:generate-keys -- --jwt-secret "<32+ char secret>" --issuer "supabase"
```

### Create The First User (Email/Password)

To create an operator user (admin API of GoTrue; requires service role key):

```bash
pnpm run supabase:create-user -- --email "admin@example.com" --password "ChangeMeNow!" --tenant "default"
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
