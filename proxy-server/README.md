# Bot-Mox Proxy Server

Express backend для Bot-Mox. Единственный поддерживаемый API-контур: `/api/v1/*`.

## Требования

- Node.js 20+
- pnpm 10+

## Установка

```bash
cd proxy-server
pnpm install
```

## Конфигурация

Опционально создайте `.env` на основе `.env.example`.

### Data backend mode

Runtime mode:

1. `DATA_BACKEND=supabase` (по умолчанию и единственный runtime режим) — Supabase/Postgres.

Для `supabase` режима обязательны:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Ключ IPQS может задаваться:

1. через app settings path: `settings/api_keys/ipqs/api_key` (предпочтительно)
2. через `IPQS_API_KEY` в `.env`

## Запуск

Из корня репозитория:

```bash
pnpm run dev
```

Только backend:

```bash
cd proxy-server
pnpm start
```

По умолчанию сервер доступен на `http://localhost:3001`.

## API (canonical)

- `GET /api/v1/health`
- `GET /api/v1/auth/verify`
- `GET|POST /api/v1/ipqs/*`
- `GET /api/v1/wow-names`
- `GET|POST|PATCH|DELETE /api/v1/resources/*`
- `GET|POST|PATCH|DELETE /api/v1/workspace/*`
- `GET|PUT|PATCH /api/v1/settings/*`
- `GET|POST|PATCH|DELETE /api/v1/bots/*`
- `GET|POST|PATCH|DELETE /api/v1/finance/*`
- `GET|POST|PUT|DELETE /api/v1/infra/*`

Полный контракт: `docs/api/openapi.yaml`.

Legacy `/api/*` маршруты удалены.
