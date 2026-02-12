# План: Self-hosted MinIO S3 + персональная выдача артефактов по VM UUID и lease

## Краткое резюме
1. Используем self-hosted MinIO на том же VPS (не Google Drive API).
2. Раннер привязываем к машине по Windows SMBIOS UUID.
3. Доступ к установщикам только через короткий execution lease + short-lived presigned URL.
4. Метаданные релизов и назначений храним tenant-scoped, файлы в private bucket MinIO.
5. Fingerprint используем только как риск-сигнал, не как hard-block.

## Целевая архитектура
1. VPS: frontend + backend + Supabase + MinIO.
2. Клиент: локальный agent/runner, который:
   - читает UUID;
   - получает lease;
   - запрашивает персональный download URL;
   - скачивает и проверяет SHA-256.

## Инфраструктура S3
1. Добавить MinIO контейнер в VPS compose.
2. Bucket: `botmox-artifacts` (private).
3. TLS через reverse proxy (`s3.<domain>`).
4. Отдельный MinIO user для backend с ограниченными правами.
5. ENV backend:
   - `S3_ENDPOINT`
   - `S3_REGION`
   - `S3_BUCKET_ARTIFACTS`
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `S3_FORCE_PATH_STYLE`
   - `S3_PRESIGN_TTL_SECONDS`

## Модель данных (tenant-scoped)
1. `artifact_releases`: module/platform/channel/version/object_key/sha256/size/status.
2. `artifact_assignments`:
   - per-user;
   - default per-tenant.
3. `artifact_download_audit`: кто/что/когда/по какому lease получил URL.

## API изменения
1. `POST /api/v1/artifacts/resolve-download`
   - input: `lease_token`, `vm_uuid`, `module`, `platform`, `channel`;
   - output: `download_url`, `url_expires_at`, `release_id`, `version`, `sha256`, `size_bytes`.
2. `POST /api/v1/artifacts/releases` (admin/infra).
3. `POST /api/v1/artifacts/assign` (admin/infra).
4. `GET /api/v1/artifacts/assign/:userId/:module` (admin/infra).

## Логика проверки при выдаче URL
1. Проверить валидность lease token.
2. Проверить `vm_uuid` совпадает с lease.
3. Проверить lease активен/не истек/не revoked.
4. Проверить entitlement по module.
5. Найти назначенный release (user override -> tenant default).
6. Сгенерировать presigned URL на 60-300 сек.
7. Записать событие в audit.

## Поток раннера
1. UUID: `(Get-CimInstance Win32_ComputerSystemProduct).UUID`.
2. `POST /api/v1/vm/register`.
3. `POST /api/v1/license/lease`.
4. `POST /api/v1/artifacts/resolve-download`.
5. Скачать файл и проверить `sha256`.
6. При истечении URL запросить новый.

## Anti-piracy baseline
1. Файлы не публичные.
2. URL короткоживущие.
3. Lease TTL 1-5 минут, heartbeat 30-60 секунд.
4. После revoke новые URL не выдаются.
5. Аудит всех выдач/попыток.
6. Online-only по умолчанию (без интернета новый lease/URL не получить).

## Тесты приемки
1. Активная лицензия + зарегистрированный UUID -> lease и download URL выдаются.
2. Незарегистрированный UUID -> отказ.
3. UUID другого tenant -> `403`.
4. Истекшая подписка -> отказ в lease.
5. Perpetual entitlement -> lease выдается.
6. Истекший lease -> отказ на resolve-download.
7. Несовпадение module -> `403`.
8. Revoked lease -> новые URL не выдаются.
9. Секреты не попадают в API и логи.

Smoke automation:
- `npm run smoke:artifacts:e2e` (см. `scripts/artifacts-e2e-smoke.js`)

## Дефолты и assumptions
1. Storage: MinIO self-hosted.
2. Download auth: presigned URL 1-5 min.
3. Machine binding: UUID required only.
4. Fingerprint: risk-signal only.
5. Для прод-стека рекомендовано >= 4 GB RAM (2 GB только dev/test).
