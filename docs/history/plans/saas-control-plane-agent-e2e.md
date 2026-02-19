# План: SaaS Control-Plane + Windows Tray Agent + E2E-секреты для Proxmox automation

## Краткое резюме
1. Архитектура: `VPS frontend/backend` + `desktop Windows tray agent`.
2. UI-стратегия: только `API-only` в SaaS, без iframe-туннелей локальных UI.
3. Infra-операции (Proxmox/SSH/Syncthing actions) выполняет только agent через исходящий WSS.
4. Секреты: не plaintext в cloud; используем `E2E encrypted vault` (client-managed key), сервер хранит только ciphertext + `secret_ref`.
5. Привязка: `bot_id/vm_uuid -> secret_ref map`; доступ и выполнение команд только при `VPN/LAN route` от agent к Proxmox/VM.

## Зафиксированные решения
1. `SaaS control-plane + tray agent (Start/Stop)`.
2. `Syncthing v1`: только action-команды (approve и базовые операции), без UI embed.
3. `Секреты`: шифруем, ключ у клиента (`Client-managed key`).
4. `Доступность`: desktop-agent обязан иметь сетевой маршрут к Proxmox (`Require VPN/LAN route`).
5. `Recovery`: без cloud-backup секретов в MVP (при потере ключа/устройства — повторный ввод).

## Анализ текущего состояния (что мешает целевой модели)
1. Infra сейчас исполняется напрямую на backend (`/api/v1/infra/*`), а не через agent.
2. Секретные поля (`proxmox.password`, `ssh.password`, `tinyFmPassword`, `syncThingPassword`) доступны через settings-контур и используются фронтом.
3. Основной settings-контур частично глобальный; tenant-изоляция не везде.
4. Уже есть готовая основа для запуска-гейтинга: `vm_registry` и `license lease`.

## Целевая архитектура и поток
1. Web UI (VPS) отправляет команду VM operation.
2. Backend проверяет auth/tenant/license/vm ownership.
3. Backend создает command в tenant command queue.
4. Agent по WSS получает command, подтягивает ciphertext секретов по `secret_ref`, расшифровывает локально своим ключом.
5. Agent выполняет Proxmox/SSH/Syncthing action.
6. Agent возвращает статус/логи результата (без секретов) в backend.
7. UI показывает прогресс и итог.

## Изменения API/интерфейсов/типов
1. Новый API модуль `agents`:
   - `POST /api/v1/agents/pairings`
   - `POST /api/v1/agents/register`
   - `POST /api/v1/agents/heartbeat`
   - `GET /api/v1/agents`
   - `POST /api/v1/agents/:id/revoke`
2. Новый WSS канал:
   - `wss /ws/v1/agents/connect`
3. Новый API модуль `vm-ops` (через command bus):
   - `POST /api/v1/vm-ops/proxmox/*`
   - `POST /api/v1/vm-ops/syncthing/*`
4. Новый API модуль `secrets` (ciphertext-only):
   - `POST /api/v1/secrets`
   - `GET /api/v1/secrets/:id/meta`
   - `POST /api/v1/secrets/:id/rotate`
5. Ограничение legacy:
   - `/api/v1/infra/*` оставить только internal/admin path, убрать из customer flow.
6. Новые типы:
   - `AgentRecord`, `AgentCommand`, `SecretCiphertextRecord`, `SecretRefBinding`.

## Модель данных
1. `tenants/{tenantId}/agents/{agentId}`: статус, версия, capabilities, last_seen.
2. `tenants/{tenantId}/agent_commands/{commandId}`: тип команды, payload, status, result, audit.
3. `tenants/{tenantId}/secrets_ciphertext/{secretId}`: `ciphertext`, `alg`, `key_id`, `nonce`, `aad_meta`.
4. `tenants/{tenantId}/secret_bindings/{scopeId}`: `scope_type(bot|vm)`, `scope_id`, `secret_ref`.
5. `tenants/{tenantId}/infra_settings_public`: только non-secret поля.
6. Секреты не попадают в обычные settings-ответы.

## Криптомодель (MVP)
1. Agent генерирует локальный ключ и хранит его через Windows DPAPI.
2. Шифрование выполняется на agent до отправки в cloud (server blind).
3. Backend хранит только ciphertext и metadata.
4. Дешифрование только на agent при выполнении команды.
5. При потере ключа/устройства секреты считаются утраченными и вводятся заново.

## Рефакторинг и миграция
1. Удалить/депрекейтить секретные поля из `vmgenerator` публичного контракта.
2. Перенести фронт `VMService/VM settings` с password-input в модель `secret_ref status`.
3. Внедрить tenant-scoped paths для infra/settings, где еще глобально.
4. Переключить `vmService.ts` с `/api/v1/infra/*` на `/api/v1/vm-ops/*`.
5. Добавить redaction middleware для логов и error payload.

## Тесты и сценарии приемки
1. Agent online + активная лицензия + валидный vm binding -> команда выполняется успешно.
2. Agent offline -> операция завершается `Agent offline` без silent queue (fail-fast).
3. Tenant A не может вызвать/прочитать команды и секреты tenant B.
4. Backend не может вернуть plaintext секрета ни одним endpoint.
5. Логи не содержат секреты (mask/redaction проверка).
6. Proxmox action проходит через agent при наличии VPN/LAN route.
7. При отсутствии маршрута backend/UI получают понятную диагностическую ошибку.
8. Смена/rotate секрета обновляет `secret_ref` и новые команды используют новый материал.
9. Потеря ключа agent -> расшифровка невозможна, UI показывает необходимость re-enter.
10. Legacy `/api/v1/infra/*` недоступен обычному tenant user.

## Rollout
1. Feature flags:
   - `AGENT_COMMAND_BUS_ENABLED`
   - `SECRETS_E2E_ENABLED`
   - `INFRA_LEGACY_ADMIN_ONLY`
2. Canary: внутренний tenant -> beta tenants -> production.
3. Параллельный режим на переходе: чтение старых настроек только для миграции, новые операции только через agent.
4. Cutover: отключить customer flow к direct infra connectors.

## Явные assumptions и defaults
1. Agent устанавливается на рабочий ПК пользователя (не на каждую VM).
2. Пользователь обязан обеспечить сетевой доступ agent -> Proxmox/VM (LAN/VPN).
3. Cloud хранит только ciphertext секретов и refs, не plaintext.
4. В MVP нет cloud-backup ключей/секретов.
5. UI остается централизованным на VPS; локальные сервисные web UI не встраиваются.
