# План: Production-like Docker Stack + CI/CD для VPS (Frontend, Backend, Supabase, MinIO, Caddy)

## Краткое резюме
1. Вводим единый production-like контейнерный стек: `caddy + frontend + backend + supabase(core) + minio`.
2. Делаем 2 режима запуска: `dev` (hot-reload) и `prod-sim` (максимально как VPS).
3. Оставляем текущий CI quality-gates и добавляем image pipeline + manual promote CD на VPS.
4. Фиксируем `Supabase-only` как целевую data-модель, но миграцию делаем phased через compatibility layer.
5. Деплой-секреты храним только на VPS; GitHub Actions хранит только ключи для доступа и деплоя.
6. Бэкапы: ежедневные для Postgres и MinIO, плюс rollback по image tag.

## Что уже есть (факты)
1. Есть базовый CI (`.github/workflows/ci.yml`) с lint/type/build/smoke.
2. Есть dev-compose (`docker-compose.local.yml`) на `node:20-bookworm` с bind mounts, без production Dockerfile/образов.
3. Есть Supabase локальный контур через CLI (`supabase/config.toml`, миграции).
4. Нет production compose, нет reverse proxy/TLS контура, нет CD на VPS.
5. Нет image registry workflow и rollback-процедуры в automation.

## Целевая архитектура
1. `caddy`: входная точка 80/443, auto HTTPS.
2. `frontend`: статическая сборка React/Vite в контейнере (serve через nginx или caddy static upstream).
3. `backend`: Express API + WS.
4. `supabase core`: Postgres + PostgREST + GoTrue + Storage (без Studio/Inbucket/Analytics в prod по умолчанию).
5. `minio`: S3 для artifacts/installers, private bucket.
6. Сети: `edge` (caddy), `app` (internal services), `data` (db/minio internal).
7. Для 2 vCPU / 4 GB RAM: включаем только необходимые Supabase сервисы и ограничиваем ресурсы контейнеров.

## Изменения в репозитории (структура и артефакты)
1. Добавить `deploy/compose.stack.yml` как канонический production-like стек.
2. Добавить `deploy/compose.dev.override.yml` для локального hot-reload режима.
3. Добавить `deploy/compose.prod-sim.env.example` и `deploy/compose.prod.env.example`.
4. Добавить `deploy/caddy/Caddyfile` с роутингом:
   - `app.<domain>` -> frontend
   - `api.<domain>` -> backend
   - `s3.<domain>` -> minio API
5. Добавить Dockerfile:
   - `bot-mox/Dockerfile` (multi-stage build + static runtime)
   - `proxy-server/Dockerfile` (production node runtime)
6. Добавить scripts:
   - `scripts/stack-dev-up.(ps1|sh)`, `stack-dev-down.(ps1|sh)`
   - `scripts/stack-prod-sim-up.(ps1|sh)`, `stack-prod-sim-down.(ps1|sh)`
   - `scripts/deploy-vps.sh`, `scripts/rollback-vps.sh`
   - `scripts/backup-postgres.sh`, `scripts/backup-minio.sh`
7. Обновить root `package.json` командами:
   - `stack:dev:up`, `stack:dev:down`
   - `stack:prod-sim:up`, `stack:prod-sim:down`
   - `stack:logs`, `stack:ps`
   - `deploy:plan` (dry-run в CI), `deploy:vps` (локально не используется, только в CI job).

## CI/CD дизайн
1. Оставить текущий `ci.yml` как PR/branch quality gate.
2. Добавить `.github/workflows/images.yml`:
   - trigger: `push main`
   - шаги: checkout -> test gates -> build docker images -> push в GHCR
   - теги: `sha-<shortsha>`, `main-latest`.
3. Добавить `.github/workflows/deploy-prod.yml`:
   - trigger: `workflow_dispatch`
   - inputs: `image_tag`
   - env protection: manual approval
   - шаги: SSH на VPS -> `docker compose pull` -> `docker compose up -d` -> smoke checks.
4. Добавить rollback процедуру:
   - manual dispatch `rollback-prod.yml` с `previous_tag`
   - выполняет `up -d` на предыдущих тегах и post-check.
5. Secrets в GitHub:
   - `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_DEPLOY_PATH`
   - `GHCR_PAT` (если нужен отдельный token), либо `GITHUB_TOKEN` c packages write/read.

## VPS deployment layout
1. Каталог: `/opt/bot-mox`.
2. Файлы на VPS:
   - `compose.stack.yml`
   - `.env.prod` (только на сервере, вне git)
   - `caddy-data/`, `caddy-config/`, `postgres-data/`, `minio-data/`, `backups/`.
3. Выпуск релиза:
   - CI пушит образы
   - manual promote запускает deploy job
   - deploy job обновляет сервисы без полного stop всей системы.
4. Проверки после деплоя:
   - `GET /api/v1/health`
   - frontend root status
   - minio readiness
   - db connection check.

## Supabase-only миграция (phased, compatibility layer)
1. Этап 1: ввести repository interfaces для доменов `resources`, `workspace`, `bots`, `finance`, `settings`.
2. Этап 2: реализовать Supabase repositories без изменения публичных `/api/v1/*` контрактов.
3. Этап 3: data migration script RTDB -> Supabase (`scripts/migrate-rtdb-to-supabase.js`) с idempotent upsert.
4. Этап 4: verification mode:
   - read parity checks по выборкам
   - отчеты несовпадений.
5. Этап 5: cutover с maintenance окном до 30 минут:
   - freeze writes
   - final sync
   - переключение `DATA_BACKEND=supabase` и отключение RTDB paths.
6. Этап 6: удаление legacy RTDB codepath после стабилизации.

## MinIO в первом этапе
1. Bucket: `botmox-artifacts` (private).
2. Создание bucket и policy через init job при старте стека.
3. Использование scope: только `artifacts/installers`.
4. Конфиг backend:
   - `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET_ARTIFACTS`
   - `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
   - `S3_FORCE_PATH_STYLE`, `S3_PRESIGN_TTL_SECONDS`.

## Изменения public APIs/interfaces/types
1. Public API path не ломаем: `/api/v1/*` остается.
2. Добавляем readiness endpoints для инфраструктуры:
   - `GET /api/v1/health/live`
   - `GET /api/v1/health/ready`
3. В ответ `GET /api/v1/health` добавляем fields:
   - `data_backend`
   - `supabase_ready`
   - `s3_ready`.
4. Internal interface changes:
   - единые repository interfaces для backend доменов
   - `StorageProvider` интерфейс для MinIO/S3 операций artifacts.

## Тесты и сценарии приемки
1. Local `dev` профиль:
   - hot-reload frontend/backend
   - backend health OK
   - integration checks проходят.
2. Local `prod-sim` профиль:
   - запуск только через production compose
   - frontend/backend доступны через caddy routes
   - supabase/minio готовы.
3. CI:
   - PR не проходит без quality gates.
   - `main` пушит образы в GHCR с тегами.
4. CD:
   - manual promote деплоит выбранный image tag на VPS.
   - после deploy smoke checks зелёные.
5. Rollback:
   - откат на предыдущий tag успешен и повторно проходит smoke.
6. Data migration:
   - контрольные выборки RTDB/Supabase совпадают по agreed fields.
7. Backups:
   - ежедневный backup создается
   - restore drill на test volume выполняется успешно.

## Операционные правила
1. Полные production `.env` не хранятся в git и не передаются как артефакт CI.
2. На VPS включается только необходимый Supabase subset для 2 vCPU/4 GB.
3. Любой deploy сопровождается health-check и фиксируется в release log.
4. Любой schema change идет через миграции и pre-deploy backup.
5. Rollback-план обязателен для каждого release.

## Явные assumptions и defaults
1. Deploy flow: `GitHub Actions -> GHCR -> SSH deploy`.
2. Release policy: manual promote from `main`.
3. Proxy/TLS: `Caddy + auto HTTPS`.
4. Окружения: `Prod only + local parity`.
5. Backup policy: daily DB + S3 backups.
6. Локальная разработка: `dev + prod-sim` профили.
7. Production secrets: только на VPS.
8. Data target: `Supabase-only now`, миграция phased.
9. MinIO scope phase 1: artifacts/installers only.
10. Допустимый cutover downtime: до 30 минут.
