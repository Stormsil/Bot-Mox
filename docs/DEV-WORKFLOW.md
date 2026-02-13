# Руководство разработчика Bot-Mox

## Что нужно установить (один раз)

- **Node.js 20+** — https://nodejs.org
- **Docker Desktop** — https://docker.com (для Supabase и MinIO)
- **Supabase CLI** — `npm install -g supabase` (управление локальной БД)
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

### Режим 1: Лёгкий (рекомендуется для повседневной работы)

Поднимаешь только Supabase (БД) через CLI, фронт и бэк запускаешь напрямую с hot-reload.
MinIO (S3) не нужен если не работаешь с артефактами.

```powershell
# Терминал 1 — БД (Supabase: Postgres + Auth + REST API + Studio)
npx supabase start

# Терминал 2 — Бэкенд (Express, порт 3001)
cd proxy-server
npm run dev

# Терминал 3 — Фронтенд (Vite, порт 5173)
cd bot-mox
npm run dev
```

Открыть:
- **Приложение**: http://localhost:5173
- **Supabase Studio** (БД в браузере): http://localhost:54323
- **API напрямую**: http://localhost:3001/api/v1/health

### Режим 2: Полный стек (Docker Compose, имитация продакшена)

Всё в Docker: Caddy + фронт + бэк + Supabase + MinIO. Используй когда нужно проверить что всё работает вместе как на сервере.

```powershell
# Windows
.\scripts\stack-prod-sim-up.ps1

# Или Linux/Mac
./scripts/stack-prod-sim-up.sh
```

Открыть:
- **Приложение**: http://localhost (через Caddy)
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
- **Health**: http://localhost/api/v1/health/ready

Остановить:
```powershell
.\scripts\stack-prod-sim-down.ps1
```

## Ежедневный рабочий процесс

### Написал фичу — проверь

```powershell
# Полная проверка (линт + типы + сборка + бюджеты + секреты + бэкенд)
npm run check:all

# Или по частям:
npm run lint              # ESLint фронтенда
npm run check:types       # TypeScript проверка
npm run build             # Сборка фронтенда
npm run check:backend:syntax  # Синтаксис бэкенда
npm run check:backend:smoke   # Все модули грузятся без ошибок
npm run check:secrets     # Нет утечек секретов в коде
```

### Изменил схему БД — создай миграцию

```powershell
# 1. Создай файл миграции
npx supabase migration new имя_миграции
# Создаст файл: supabase/migrations/2026XXXXXXXXXX_имя_миграции.sql

# 2. Напиши SQL в этот файл (CREATE TABLE, ALTER TABLE и т.д.)

# 3. Применить все миграции (сбросит локальную БД и применит заново)
npx supabase db reset

# 4. Проверь в Studio что таблицы создались: http://localhost:54323
```

### Готов коммитить

```powershell
git add <конкретные файлы>
git commit -m "feat(domain): описание что сделал"
git push
```

CI на GitHub автоматически прогонит `npm run check:all`.

## Как работает аутентификация (dev)

В `.env` фронтенда стоит `VITE_DEV_BYPASS_AUTH=true` — логин пропускается, используется внутренний токен из `VITE_INTERNAL_API_TOKEN`.

Когда нужна реальная авторизация:
1. Поставь `VITE_DEV_BYPASS_AUTH=false`
2. Создай пользователя: `node scripts/supabase-create-user.js --email you@test.com --password test1234`
3. Логинься через UI

## Как работают секреты (E2E шифрование)

Пароли (Proxmox, SSH, сервисы) шифруются **в браузере** ключом AES-256-GCM.
Сервер хранит только шифротекст — не может прочитать пароль.

- Ключ хранится в `localStorage` браузера
- При смене браузера/устройства — нужно ввести пароли заново
- В БД хранятся: `ciphertext`, `nonce`, `key_id`, `label` (без plaintext)

## Как работает агент (vm-ops)

Агент — будущее десктопное приложение на машине клиента. В dev-режиме:
1. Без реального агента — VM операции через `/api/v1/vm-ops` вернут `AGENT_OFFLINE`
2. Для тестирования можно создать mock агента через API:
   - `POST /api/v1/agents/pairings` → получить pairing_code
   - `POST /api/v1/agents/register` с этим кодом
   - `POST /api/v1/agents/heartbeat` чтобы держать "онлайн"

## Переменные окружения

### Бэкенд (`proxy-server/.env`)

| Переменная | Что делает | Значение для dev |
|------------|-----------|-----------------|
| `DATA_BACKEND` | Какую БД использовать | `supabase` |
| `SUPABASE_URL` | Адрес Supabase | `http://127.0.0.1:54321` |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-ключ Supabase | (демо-ключ из `npx supabase status`) |
| `INTERNAL_API_TOKEN` | Токен для API без логина | любая строка |
| `LICENSE_LEASE_SECRET` | Подпись JWT лицензий | минимум 32 символа |
| `S3_ENDPOINT` | MinIO/S3 адрес | `http://127.0.0.1:9000` |
| `REQUIRE_S3_READY` | Блокировать старт если S3 недоступен | `false` |
| `REQUIRE_SUPABASE_READY` | Блокировать старт если Supabase недоступен | `true` |

### Фронтенд (`bot-mox/.env`)

| Переменная | Что делает | Значение для dev |
|------------|-----------|-----------------|
| `VITE_API_BASE_URL` | Адрес API | `http://localhost:3001` |
| `VITE_SUPABASE_URL` | Supabase для Auth | `http://127.0.0.1:54321` |
| `VITE_SUPABASE_ANON_KEY` | Публичный ключ Supabase | (демо-ключ) |
| `VITE_DEV_BYPASS_AUTH` | Пропуск логина | `true` |

## Полезные команды

| Команда | Описание |
|---------|----------|
| `npx supabase start` | Запуск локальной Supabase |
| `npx supabase stop` | Остановка Supabase |
| `npx supabase db reset` | Сброс БД + применение миграций |
| `npx supabase status` | Показать URL-ы и ключи |
| `npx supabase migration new <name>` | Создать новую миграцию |
| `npm run check:all` | Полная проверка качества |
| `npm run stack:dev:up` | Docker стек с hot-reload |
| `npm run stack:prod-sim:up` | Docker стек как в продакшене |

## Деплой на VPS (когда будет готово)

1. Пуш в `main` → GitHub Actions собирает Docker-образы → GHCR
2. Ручной запуск `deploy-prod.yml` с тегом образа → деплой на VPS
3. Откат: запуск `rollback-prod.yml` с предыдущим тегом

Подробности: `docs/runbooks/vps-operations.md`
