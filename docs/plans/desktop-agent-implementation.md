# Plan: Bot-Mox Desktop Agent (Windows Tray)

## Context

Все фазы A–D GREEN. Бэкенд API для агентов, vm-ops и секретов готовы. Нет самого десктоп-агента — без него vm-ops команды возвращают `AGENT_OFFLINE`. Нужен агент который:
- Живёт в трее Windows
- Подключается к облачному API
- Получает команды (start/stop/clone VM)
- Выполняет их через Proxmox API в локальной сети
- Отправляет результат обратно

## Решения по архитектуре

| Вопрос | Решение | Почему |
|--------|---------|--------|
| Формат | Electron (tray-only, без окна) | Нативный tray, пользователь хочет трей |
| Язык | TypeScript | Единообразие с фронтом и бэком |
| Авторизация | Internal API Token (MVP) | Уже есть, 1 поле вместо 4 |
| Секреты | Proxmox credentials хранятся локально в config.json | MVP: агент на машине пользователя, это безопасно |
| Обновление | Ручное (скачать новый .exe) | MVP |
| Сборка | electron-builder → portable .exe | Без установщика |

### Крипто-стратегия (рекомендация)

**Только пароли шифруются E2E** — как сейчас в браузере. Всё остальное (URL, порты, имена VM, настройки) хранится в Supabase как обычные данные и видно в админке.

Для MVP: агент хранит Proxmox-пароли локально в `%APPDATA%/botmox-agent/config.json`. Они никогда не покидают машину пользователя. Это стандартная модель (так работают Terraform, Ansible, kubectl — credentials на машине оператора).

В будущем: shared key между браузером и агентом (пользователь задаёт мастер-пароль при первой настройке, из него оба деривируют AES-ключ через PBKDF2).

---

## Структура проекта

```
agent/
  package.json
  tsconfig.json
  electron-builder.yml
  assets/
    icon.ico                  # Иконки для разных состояний
    icon-online.ico
    icon-offline.ico
  src/
    main/
      index.ts                # Electron entry — tray + lifecycle
      tray.ts                 # Tray icon + context menu
      pairing-window.ts       # BrowserWindow для ввода настроек
    core/
      agent-loop.ts           # Heartbeat (30с) + poll commands + execute
      api-client.ts           # HTTP-клиент к облачному API
      config-store.ts         # JSON persistence в %APPDATA%
      logger.ts               # Лог в файл + console
    executors/
      index.ts                # Роутер command_type → executor
      proxmox.ts              # Proxmox REST API (порт connectors.js)
    ui/
      pairing.html            # Форма привязки (static HTML)
      preload.ts              # contextBridge для IPC
```

---

## Фаза 1: Skeleton — Electron tray + config

**Файлы:** `package.json`, `tsconfig.json`, `electron-builder.yml`, `src/main/index.ts`, `src/main/tray.ts`, `src/core/config-store.ts`, `src/core/logger.ts`, `assets/icon.ico`

1. Создать `agent/` в корне монорепо
2. `package.json` с зависимостями: `electron`, `electron-builder`, `typescript`
3. `src/main/index.ts` — Electron app, single-instance lock, создаёт tray
4. `src/main/tray.ts` — иконка + контекстное меню (Status, Re-pair, Open Logs, Quit)
5. `src/core/config-store.ts` — read/write JSON в `%APPDATA%/botmox-agent/config.json`
6. `src/core/logger.ts` — append log в `%APPDATA%/botmox-agent/agent.log`

**Config interface:**
```typescript
interface AgentConfig {
  serverUrl: string;            // http://localhost:3001 (dev) или https://botmox.example.com
  apiToken: string;             // INTERNAL_API_TOKEN
  agentId: string;              // UUID из register response
  agentName: string;
  proxmox: {
    url: string;                // https://192.168.1.100:8006
    username: string;           // root
    password: string;           // plaintext (на машине пользователя)
    node: string;               // h1
  };
  pairedAt: string;
  version: string;
}
```

**Проверка:** `cd agent && npm run dev` → появляется иконка в трее, Quit закрывает.

---

## Фаза 2: Pairing window

**Файлы:** `src/main/pairing-window.ts`, `src/ui/pairing.html`, `src/ui/preload.ts`, `src/core/api-client.ts`

1. `src/core/api-client.ts` — HTTP-клиент (Node.js fetch/https) с `Authorization: Bearer <token>` и envelope unwrap
2. `src/main/pairing-window.ts` — BrowserWindow 450x550, форма:
   - Server URL
   - API Token
   - Pairing Code
   - Proxmox URL, Username, Password, Node
3. `src/ui/preload.ts` — `contextBridge.exposeInMainWorld('agentApi', { pair, getStatus })`
4. При нажатии "Pair": `POST /api/v1/agents/register { pairing_code, version, platform: 'win32', capabilities: ['proxmox'] }` → сохранить agentId в config

**API-клиент (api-client.ts):**
```typescript
class ApiClient {
  constructor(private serverUrl: string, private token: string) {}
  async get<T>(path: string): Promise<T>    // GET + unwrap envelope
  async post<T>(path: string, body): Promise<T>  // POST + unwrap
  async patch<T>(path: string, body): Promise<T> // PATCH + unwrap
}
```

**Проверка:** запустить бэкенд (`npm run stack:dev:up` или `cd proxy-server && npm run dev`), создать pairing через curl, ввести в агенте → агент привязан.

---

## Фаза 3: Agent loop — heartbeat + poll

**Файлы:** `src/core/agent-loop.ts`

Цикл каждые 30 секунд:
1. `POST /api/v1/agents/heartbeat { agent_id }` — обновить last_seen_at
2. `GET /api/v1/vm-ops/commands?agent_id=XXX&status=queued` — получить очередь
3. Для каждой команды:
   - `PATCH /api/v1/vm-ops/commands/:id { status: 'running' }`
   - Выполнить через executor
   - `PATCH /api/v1/vm-ops/commands/:id { status: 'succeeded', result }` или `{ status: 'failed', error_message }`

Tray-иконка меняется:
- Зелёная = онлайн
- Красная = ошибка/нет связи
- Серая = revoked

**Проверка:** агент отправляет heartbeat, виден как "active" через `GET /api/v1/agents`.

---

## Фаза 4: Proxmox executor

**Файлы:** `src/executors/proxmox.ts`, `src/executors/index.ts`

Порт `proxy-server/src/modules/infra/connectors.js` (строки 74-145) в TypeScript:
- `proxmoxLogin()` — POST `/api2/json/access/ticket` с `rejectUnauthorized: false`
- `proxmoxRequest(method, path, data)` — Cookie auth + CSRF token
- Кэш сессии на 90 минут

**Поддерживаемые команды:**

| command_type | Действие | Proxmox API |
|-------------|----------|-------------|
| `proxmox.start` | Запуск VM | `POST /nodes/{node}/qemu/{vmid}/status/start` |
| `proxmox.stop` | Остановка VM | `POST /nodes/{node}/qemu/{vmid}/status/stop` |
| `proxmox.shutdown` | Graceful shutdown | `POST /nodes/{node}/qemu/{vmid}/status/shutdown` |
| `proxmox.reset` | Перезагрузка | `POST /nodes/{node}/qemu/{vmid}/status/reset` |
| `proxmox.clone` | Клонирование | `POST /nodes/{node}/qemu/{vmid}/clone` |
| `proxmox.list` | Список VM | `GET /nodes/{node}/qemu` |
| `proxmox.status` | Статус Proxmox | `GET /version` |

**Роутер (executors/index.ts):**
```typescript
function getExecutor(commandType: string) {
  if (commandType.startsWith('proxmox.')) return proxmoxExecutor;
  throw new Error(`Unknown command type: ${commandType}`);
}
```

**Проверка:** отправить `POST /api/v1/vm-ops/proxmox/list` из фронта/curl → агент выполняет → результат виден через poll.

---

## Фаза 5: Build + интеграция

**Файлы:** `electron-builder.yml`, root `package.json`

1. `electron-builder.yml`:
   ```yaml
   appId: com.botmox.agent
   productName: Bot-Mox Agent
   win:
     target: portable
     icon: assets/icon.ico
   portable:
     artifactName: BotMox-Agent-${version}.exe
   ```

2. Root `package.json` — добавить скрипты:
   ```json
   "agent:dev": "cd agent && npm run dev",
   "agent:build": "cd agent && npm run build",
   "agent:install": "cd agent && npm install"
   ```

3. Обновить `install:all` чтобы включал `agent`

**Проверка:** `npm run agent:build` → `agent/dist/BotMox-Agent-0.1.0.exe`, запускается на чистой Windows.

---

## Dev workflow после реализации

```powershell
# Терминал 1 — Полный стек (БД + бэкенд + фронт в Docker)
npm run stack:dev:up

# Терминал 2 — Агент (локально, подключается к стеку)
npm run agent:dev
```

Или лёгкий режим:
```powershell
npx supabase start           # БД
cd proxy-server && npm run dev  # Бэкенд
cd bot-mox && npm run dev       # Фронт
npm run agent:dev               # Агент
```

---

## Ключевые файлы (reference)

| Назначение | Файл |
|-----------|------|
| Proxmox-клиент для порта | `proxy-server/src/modules/infra/connectors.js:74-145` |
| Agent API contract | `proxy-server/src/modules/agents/service.js` |
| VM-Ops command contract | `proxy-server/src/modules/vm-ops/service.js` |
| Zod-схемы для payload | `proxy-server/src/contracts/schemas.js` |
| Frontend dispatch pattern | `bot-mox/src/services/vmOpsService.ts` |
| Оригинальный план агента | `docs/plans/saas-control-plane-agent-e2e.md` |

---

## Verification

1. `npm run agent:dev` → иконка в трее
2. Привязка через pairing code → агент виден в `GET /api/v1/agents` как active
3. Heartbeat каждые 30с → `last_seen_at` обновляется
4. `POST /api/v1/vm-ops/proxmox/list` → агент выполняет → результат в poll response
5. `npm run agent:build` → `.exe` запускается и работает
6. `npm run check:all` продолжает проходить (agent не ломает существующие проверки)
