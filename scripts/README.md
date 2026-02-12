# Scripts

Актуальный набор скриптов репозитория сведен к maintenance, quality-check и deploy задачам.

## Stack lifecycle

### Dev profile (hot reload)

- `scripts/stack-dev-up.ps1` / `scripts/stack-dev-up.sh`
- `scripts/stack-dev-down.ps1` / `scripts/stack-dev-down.sh`

Запускают `deploy/compose.stack.yml` c `deploy/compose.dev.override.yml`.

### Prod-sim profile (production-like)

- `scripts/stack-prod-sim-up.ps1` / `scripts/stack-prod-sim-up.sh`
- `scripts/stack-prod-sim-down.ps1` / `scripts/stack-prod-sim-down.sh`

Скрипт `up` собирает локальные образы:

- `bot-mox/frontend:prod-sim`
- `bot-mox/backend:prod-sim`

и поднимает стек по `deploy/compose.stack.yml`.

## Deployment and rollback

- `scripts/deploy-vps.sh`
- `scripts/rollback-vps.sh`

`deploy-vps.sh` поддерживает `--dry-run` (валидация compose-конфига без запуска).

## Backups

- `scripts/backup-postgres.sh`
- `scripts/backup-minio.sh`

По умолчанию создают архивы в `./backups/postgres` и `./backups/minio`.

## `check-bundle-budgets.js`

Проверяет размер frontend bundle относительно заданных бюджетов.

Запуск:

```bash
node scripts/check-bundle-budgets.js
```

## `check-secrets.js`

Проверяет только tracked-файлы (`git ls-files`) на признаки утечки секретов.
Локальные untracked файлы (например, `bot-mox/.env`) не участвуют в скане.

Запуск:

```bash
node scripts/check-secrets.js
```

## `cleanup-database.js`

Ручной maintenance-скрипт для Firebase RTDB (очистка/нормализация данных).
Используется точечно и требует валидной конфигурации доступа к базе.

Запуск:

```bash
node scripts/cleanup-database.js
```

## Removed Legacy

Одноразовые миграции, legacy Firebase upload-утилиты и локальные backup/node_modules из `scripts/` удалены в рамках зачистки репозитория.
