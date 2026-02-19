# Руководство разработчика Bot-Mox

## Что нужно установить (один раз)

- **Node.js 20+** — https://nodejs.org
- **Docker Desktop** — https://docker.com (для Supabase и MinIO)
- **Supabase CLI** — `pnpm add -g supabase` (управление локальной БД)
- **Git** — для версионирования

## Структура проекта

```
Bot-Mox/
  bot-mox/          — React фронтенд (Vite + Ant Design)
  proxy-server/     — Express бэкенд (API)
  supabase/         — Миграции БД + конфиг Supabase
  deploy/           — Docker Compose для полного стека
  scripts/          — Утилиты (бэкапы, миграции, проверки)
  docs/             — Архитектура, планы, runbooks
```

## Два режима разработки

### Режим 1: Лёгкий (hot-reload, быстрые итерации)

Поднимаешь только Supabase (БД) через CLI, фронт и бэк запускаешь напрямую с hot-reload.
MinIO (S3) не нужен если не работаешь с артефактами.

```powershell
# Терминал 1 — БД (Supabase: Postgres + Auth + REST API + Studio)
corepack pnpm exec supabase start

# Терминал 2 — Бэкенд (Express, порт 3001)
cd proxy-server
pnpm run dev

# Терминал 3 — Фронтенд (Vite, порт 5173)
cd bot-mox
pnpm run dev
```

Открыть:
- **Приложение**: http://localhost:5173
- **Supabase Studio** (БД в браузере): http://localhost:54323
- **API напрямую**: http://localhost:3001/api/v1/health

### Режим 2: Полный стек (Docker Compose, имитация продакшена)

Всё в Docker: Caddy + фронт + бэк + Supabase + MinIO.
Это максимально похоже на то, как будет на VPS (один входной URL, reverse-proxy, контейнеры, env как в проде).

```powershell
# Windows (рекомендуемая команда)
pnpm run deploy:local:up

# Или Linux/Mac
./scripts/stack-prod-sim-up.sh
```

Открыть:
- **Приложение**: http://localhost (через Caddy)
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
- **Health**: http://localhost/api/v1/health/ready

Остановить:
```powershell
pnpm run deploy:local:down
```

### Prod-sim env (локально, без коммита в git)

Для prod-sim режима используется файл `deploy/compose.prod-sim.env` (локальный, в `.gitignore`).
Если его нет, скрипты берут шаблон `deploy/compose.prod-sim.env.example`.

### Важно: не запускай 2 Supabase-стека одновременно

Есть два источника Supabase:

- Supabase CLI (`corepack pnpm exec supabase start`) поднимает контейнеры вида `supabase_*_bot-mox-local`
- Docker Compose стек приложения (`deploy/compose.stack.yml`) поднимает `botmox-stack-*`

Одновременно держать оба стека часто приводит к путанице (пользователи/таблицы/ключи в разных БД).
Если работаешь в Docker-стеке (prod-sim/dev stack), останови Supabase CLI:

```powershell
corepack pnpm exec supabase stop
```

### URLs и порты (чтобы не путаться)

- Dev (Vite + node напрямую): UI `http://localhost:5173`, API `http://localhost:3001`
- Prod-sim (всё через Caddy): UI `http://localhost`, API тоже через `http://localhost/api/*`
  - `http://localhost:3001` в этом режиме не опубликован на хост и может быть `connection refused`.

Домены `app.localhost/api.localhost/...` из Caddyfile не будут открываться без записи в hosts/DNS.
Для локалки всегда можно использовать `http://localhost`.

## Рекомендуемый режим для разработки "как на VPS" (prod-like + hot-reload)

Если хочешь, чтобы было максимально похоже на VPS, но при этом изменения появлялись сразу без ручных перезапусков:

```powershell
# Поднять prod-like стек с hot-reload (Caddy + Supabase + MinIO + Vite + nodemon)
pnpm run dev:prodlike:up

# Логи/статус
pnpm run dev:prodlike:ps
pnpm run dev:prodlike:logs

# Остановить
pnpm run dev:prodlike:down
```

Открывать в браузере: `http://localhost` (одна точка входа, как будет на VPS).

Примечание: `deploy:local:*` оставь для проверки "чистого" prod-sim (собранные образы, без hot-reload).

## Ежедневный рабочий процесс

### Написал фичу — проверь

```powershell
# Полная проверка (линт + типы + сборка + бюджеты + секреты + бэкенд)
pnpm run check:all

# Или по частям:
pnpm run lint              # ESLint фронтенда
pnpm run check:types       # TypeScript проверка
pnpm run build             # Сборка фронтенда
pnpm run check:backend:syntax  # Синтаксис бэкенда
pnpm run check:backend:smoke   # Все модули грузятся без ошибок
pnpm run check:secrets     # Нет утечек секретов в коде
```

### Изменил схему БД — создай миграцию

```powershell
# 1. Создай файл миграции
corepack pnpm exec supabase migration new имя_миграции
# Создаст файл: supabase/migrations/2026XXXXXXXXXX_имя_миграции.sql

# 2. Напиши SQL в этот файл (CREATE TABLE, ALTER TABLE и т.д.)

# 3. Применить все миграции (сбросит локальную БД и применит заново)
corepack pnpm exec supabase db reset

# 4. Проверь в Studio что таблицы создались: http://localhost:54323
```

### Firebase decommission audit (living report)

```powershell
pnpm run audit:firebase:decommission
```

Отчет обновляется в `docs/audits/firebase-decommission-audit.md`.

### Готов коммитить

```powershell
git add <конкретные файлы>
git commit -m "feat(domain): описание что сделал"
git push
```

CI на GitHub автоматически прогонит `pnpm run check:all`.

## Добавление новой themed-страницы (обязательно)

Чтобы новая страница не вносила техдолг по стилям:

1. Используй только дизайн-токены (`--boxmox-color-*`, `--font-*`, `--radius-*`), без raw-цветов "по месту".
2. Для Ant Design не добавляй `.ant-*` селекторы в CSS Modules.
: Все визуальные правки вноси через `styles`/`className` props компонентов (`Card.styles`, `Modal.styles`, классы ячеек таблиц и т.д.).
3. Не используй `!important` в frontend CSS.
4. Перед коммитом прогоняй:
```powershell
pnpm run check:styles:guardrails
pnpm run check:theme:contrast
```
5. Если страница добавляет новые цветовые пары текста/фона, обнови `scripts/check-theme-contrast.js` (список `checks`) и убедись, что проверка проходит для light/dark.
6. Если используется visual background, учитывай `prefers-reduced-motion` (без принудительного blur-анимационного слоя).

## AI-Native Observability & Testing

Цель: чтобы человек и ИИ-агенты могли расследовать проблемы по артефактам, а не "наугад".

### Что включено
- Backend: JSON-логи (pino) + OpenTelemetry (trace_id/span_id в каждом логе) + `x-trace-id` в ответах.
- Frontend: OpenTelemetry Web (user-interaction + fetch) и прокидывание W3C headers (`traceparent`, `tracestate`, `baggage`).
- Frontend logging: единый `uiLogger` с intake в backend (`POST /api/v1/client-logs`) и структурой `scope=client_log`.
- E2E: Playwright с `trace.zip` на падениях.
- Local trace UI: Jaeger (`deploy/compose.observability.yml`).

### Старт Jaeger (локально)
```powershell
pnpm run obs:up
```
UI: http://localhost:16686

Остановить:
```powershell
pnpm run obs:down
```

### Запуск дев-стека с трейсингом
```powershell
pnpm run dev:trace
```

`dev:trace` автоматически выставляет переменные окружения для OTel и запускает `start-dev.js` (backend + Vite).
Если порт `3001` занят:
```powershell
$env:BOTMOX_PROXY_PORT=3101; pnpm run dev:trace
```

### Конфигурация (где включать/выключать)
Dev (без Docker):
- Backend env: `proxy-server/.env` (см. `proxy-server/.env.example`)
- Frontend env: `bot-mox/.env` (см. `bot-mox/.env.example`)
- Быстро включить без правки файлов: `pnpm run dev:trace`

Prod-like / Docker (Caddy на `http://localhost/`):
- env-файл: `deploy/compose.prod-sim.env` (локальный, gitignored) или `deploy/compose.prod-sim.env.example`
- сервисы поднимаются через `deploy/compose.stack.yml` (+ dev override для hot reload)

### Быстрая проверка "все работает" (без сценариев)
Команда `doctor` делает быстрые проверки доступности UI/API и наличия debug сигналов (health + trace headers).

```powershell
pnpm run doctor
```

Комбо-проверка (doctor + Playwright smoke против `http://localhost/`):
```powershell
pnpm run smoke:prodlike
```

Prod-like (Caddy на `http://localhost/`): `doctor` авто-детектит этот режим.
Если стек только что поднялся и сервисы еще устанавливают зависимости/стартуют, можно увеличить ожидание:
- `BOTMOX_DOCTOR_RETRIES` (по умолчанию 5)
- `BOTMOX_DOCTOR_RETRY_DELAY_MS` (по умолчанию 2000)
- или добавить единоразовую задержку: `BOTMOX_DOCTOR_DELAY_MS`

Чтобы прод-like стек подхватил свежий код (новые роуты/логи/diag):
```powershell
pnpm run stack:prod-sim:down
pnpm run stack:prod-sim:up
```

В Docker-режиме трейсинг включается через env vars (см. `deploy/compose.prod-sim.env.example`):
- `BOTMOX_OTEL_ENABLED=1` (backend tracing)
- `BOTMOX_OTEL_PROXY_ENABLED=1` (proxy для browser spans -> Jaeger)
- `BOTMOX_DIAGNOSTICS_ENABLED=1` (включает `/api/v1/diag/*`)
- `VITE_OTEL_ENABLED=1` (frontend propagation, runtime-config.js)

### E2E тесты (Playwright)
Запуск:
```powershell
pnpm run test:e2e
```

Если ты уже поднял prod-like стек на `http://localhost/` (Caddy) и не хочешь, чтобы Playwright сам запускал webServer:
```powershell
pnpm run test:e2e:prodlike
```

Если порт `3001` занят, E2E webServer по умолчанию использует `BOTMOX_PROXY_PORT=3101` (см. `bot-mox/playwright.config.ts`).

Отчет:
```powershell
pnpm run test:e2e:report
```

Артефакты:
- `bot-mox/test-results/` (включая `trace.zip` на падениях)
- `bot-mox/playwright-report/`

### Локальные quality-gates (чтобы быстро понять что сломалось)
```powershell
pnpm run check:all
```

Важный guardrail: `pnpm run check:backend:logging` валит сборку, если в `proxy-server/src` появился `console.*`
(кроме короткого allowlist). Это защищает структурированное логирование.

Дополнительно: `pnpm run check:frontend:logging` валит сборку, если `console.*` появился в критичных frontend-слоях:
- `bot-mox/src/services/**`
- `bot-mox/src/hooks/**`
- `bot-mox/src/pages/**`
- `bot-mox/src/observability/**`
- `bot-mox/src/components/ui/ErrorBoundary.tsx`

### Как расследовать баг/падение (для ИИ-агентов)
1. Открой Playwright отчет и trace (`trace.zip`) и найди failing request.
2. Возьми `x-trace-id` (или `traceparent`) из Network.
3. Найди backend request-логи по `trace_id` и восстанови серверную цепочку.
4. Найди frontend ingest-логи по `scope=client_log` и тому же `trace_id`/`correlation_id`.
5. В Jaeger найди Trace ID и посмотри spans (HTTP inbound/outbound).

### Правила логирования frontend (wave-1)
- Не использовать `console.*` в guarded scope, только `uiLogger`.
- Для ошибок использовать нормализованные `event` в snake_case (пример: `api.request_failed`, `settings.load_failed`).
- Payload policy: `Whitelist + safe extras` (санитизация и редактирование секретов).

Подробный runbook и конфиги: `docs/plans/ai-native-observability-testing.md`.

### CI: где взять артефакты (trace.zip) для анализа
В CI артефакты загружаются как `playwright-artifacts`.

Скачать через GitHub CLI:
```bash
gh run list --workflow CI
gh run download <run_id> -n playwright-artifacts
```

### Для новых/измененных frontend-страниц (обязательно)

Перед коммитом пройди чеклист из `docs/frontend/STYLING.md`:
1. `Adding A New Themed Page (Checklist)`
2. `Regression Matrix For New/Changed Pages`

## Как работает аутентификация (dev)

Dev auth bypass отключен. Локальная разработка использует тот же поток авторизации, что и прод:
1. Создай пользователя: `pnpm run supabase:create-user -- --email you@test.com --password test1234 --tenant default`
2. Открой UI и выполни обычный вход email/password
3. Проверка токена идет через `GET /api/v1/auth/verify` (Bearer Supabase JWT)

### Роли admin/infra (локально и в проде)

Backend мапит роли `admin`/`infra` для операторов через allowlist:

- `SUPABASE_ADMIN_EMAILS` (через email)
- `SUPABASE_ADMIN_USER_IDS` (через user id)

В Docker-стеке эти переменные должны быть в `.env.prod` / `deploy/compose.prod-sim.env.example` и прокинуты в backend.

## Как работают секреты (E2E шифрование)

Пароли (Proxmox, SSH, сервисы) шифруются **в браузере** ключом AES-256-GCM.
Сервер хранит только шифротекст — не может прочитать пароль.

- Ключ хранится в `localStorage` браузера
- При смене браузера/устройства — нужно ввести пароли заново
- В БД хранятся: `ciphertext`, `nonce`, `key_id`, `label` (без plaintext)

## Как работает агент (vm-ops)

Агент уже реализован в `agent/` (Electron tray app) и работает через command bus:
1. Pairing/регистрация: `POST /api/v1/agents/pairings` -> `POST /api/v1/agents/register` (без ручного API token в UI агента).
   Pairings API возвращает `pairing_uri` / `pairing_bundle` для one-paste онбординга агента.
   Кнопка генерации находится в UI: `VM Generator -> верхняя панель -> Agent Pairing`.
   Новые pairings привязываются к текущему пользователю (`owner_user_id`), а VM-команды к чужому/непривязанному агенту блокируются.
2. Heartbeat: агент отправляет `POST /api/v1/agents/heartbeat` каждые ~30 секунд
3. Команды: агент опрашивает `GET /api/v1/vm-ops/commands?agent_id=...&status=queued`
4. Выполнение: `PATCH /api/v1/vm-ops/commands/:id` (`running` -> `succeeded|failed`)

`/api/v1/agents/register` выдает `agent_token` (scoped token для конкретного агента), который агент хранит локально и использует для heartbeat/command polling.

Локальный запуск агента:

```powershell
pnpm run agent:dev
```

### Pairing агента (актуально для текущего UI)

- В агенте используется только quick-pair по логину/паролю Bot-Mox аккаунта (manual/advanced pairing убран).
- URL сервера в UI не вводится: агент сам пытается определить куда стучаться.
  - в `prod-sim` это `http://localhost`
  - в `dev` режиме без Caddy это `http://localhost:3001`
  - если нужно принудительно (например на VPS), можно задать `BOTMOX_SERVER_URL` в окружении агента.

Диагностика агента:

- Логи: `%APPDATA%\\botmox-agent\\agent.log`
- Конфиг: `%APPDATA%\\botmox-agent\\config.json` (пароли/токены хранятся в зашифрованном payload, если доступно шифрование)

Если агент не запущен/не активен, VM операции через `/api/v1/vm-ops/*` возвращают `AGENT_OFFLINE`.

## VM Generator: Storage Targets (usage)

В `VM Generator -> Settings -> Proxmox -> Storage Targets` полосы использования дисков берутся из Proxmox API:

- команда: `proxmox.cluster-resources` с `type=storage`
- proxmox endpoint: `/api2/json/cluster/resources?type=storage`
- поля: `disk` (used bytes) и `maxdisk` (total bytes)

Если видишь только счётчик `X VMs`, но нет progress bar:
- агент либо оффлайн, либо вернул ресурсы без `type=storage` (часто после обновления кода агента нужно перезапустить агент)
- UI делает несколько авто-повторов обновления, но можно вручную нажать `Reset` на странице VM Generator или просто перезагрузить страницу.

Legacy заметка:
- старый плейсхолдер стораджа `disk` больше не используется; настройки нормализуются к реальным storage names.

### Manual vs Auto (как сейчас работает)

- `Auto-select best disk`:
  - UI показывает текущий выбранный target (по статам свободного места).
  - При обработке очереди выбор делается на каждый VM отдельно и старается распределять по дискам (учитывая оценку будущего размера диска VM).
- Ручной режим (Auto-select выключен):
  - Можно выбрать только один storage target (single-select).
  - Этот storage используется как дефолт для клонирования, если в конкретной VM в очереди не указан другой.

## VM Generator: Project Resources (disk size)

В `VM Generator -> Settings -> Resources` можно задать ресурсы по проектам, включая размер диска (GiB).

Как применяется размер диска:
- После клонирования VM, если включен `resourceMode=project` и `diskGiB` больше текущего размера, выполняется Proxmox resize.
- Resize делается только на увеличение (grow-only) через Proxmox API: `PUT /api2/json/nodes/<node>/qemu/<vmid>/resize` с `disk=<sata0>` и `size=+<N>G`.
- Уменьшение диска не делаем (это реально сложнее и рискованнее): если `diskGiB` меньше текущего, VM оставляется с текущим размером и в лог пишется предупреждение.

## Переменные окружения

### Бэкенд (`proxy-server/.env`)

| Переменная | Что делает | Значение для dev |
|------------|-----------|-----------------|
| `DATA_BACKEND` | Какую БД использовать | `supabase` |
| `SUPABASE_URL` | Адрес Supabase | `http://127.0.0.1:54321` |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-ключ Supabase | (демо-ключ из `corepack pnpm exec supabase status`) |
| `LICENSE_LEASE_SECRET` | Подпись JWT лицензий | минимум 32 символа |
| `AGENT_PAIRING_PUBLIC_URL` | Публичный URL API для генерации pairing-link | `http://localhost:3001` |
| `S3_ENDPOINT` | MinIO/S3 адрес | `http://127.0.0.1:9000` |
| `REQUIRE_S3_READY` | Блокировать старт если S3 недоступен | `false` |
| `REQUIRE_SUPABASE_READY` | Блокировать старт если Supabase недоступен | `true` |

### Фронтенд (`bot-mox/.env`)

| Переменная | Что делает | Значение для dev |
|------------|-----------|-----------------|
| `VITE_API_BASE_URL` | Адрес API | `http://localhost:3001` |
| `VITE_SUPABASE_URL` | Supabase для Auth | `http://127.0.0.1:54321` |
| `VITE_SUPABASE_ANON_KEY` | Публичный ключ Supabase | (демо-ключ) |

## Полезные команды

| Команда | Описание |
|---------|----------|
| `corepack pnpm exec supabase start` | Запуск локальной Supabase |
| `corepack pnpm exec supabase stop` | Остановка Supabase |
| `corepack pnpm exec supabase db reset` | Сброс БД + применение миграций |
| `corepack pnpm exec supabase status` | Показать URL-ы и ключи |
| `corepack pnpm exec supabase migration new <name>` | Создать новую миграцию |
| `pnpm run check:all` | Полная проверка качества |
| `pnpm run check:styles:guardrails` | Guardrails по стилям (глобальные `.ant-*`, порог `!important`) |
| `pnpm run stack:dev:up` | Docker стек с hot-reload |
| `pnpm run stack:prod-sim:up` | Docker стек как в продакшене |

### Frontend styling

Конвенции и чеклист для добавления новых страниц: `docs/frontend/STYLING.md`.

## Деплой на VPS (когда будет готово)

1. Пуш в `main` → GitHub Actions собирает Docker-образы → GHCR
2. Ручной запуск `deploy-prod.yml` с тегом образа → деплой на VPS
3. Откат: запуск `rollback-prod.yml` с предыдущим тегом

Подробности: `docs/runbooks/vps-operations.md`

