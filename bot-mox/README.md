# Bot-Mox Frontend

Frontend приложение Bot-Mox на `React + TypeScript + Vite` с `Refine + Ant Design`.

## Назначение

- работа с ресурсами (`licenses`, `proxies`, `subscriptions`)
- управление ботами и их жизненным циклом
- рабочее пространство (`notes`, `calendar`, `kanban`)
- настройки, финансы, datacenter/infra UI

Все бизнес-операции выполняются через backend API (`/api/v1/*`).

## Требования

- Node.js 20+
- npm 10+
- запущенный backend (`proxy-server`) на `http://localhost:3001`

## Локальный запуск

```bash
cd bot-mox
npm install
npm run dev
```

Приложение будет доступно на `http://localhost:5173`.

## Основные команды

```bash
npm run dev
npm run build
npm run lint
npx tsc -b --pretty false
```

## Структура (кратко)

- `src/pages` — страницы и контейнеры
- `src/components` — UI-компоненты и feature-блоки
- `src/services` — API-клиенты и доменные сервисы
- `src/providers` — провайдеры Refine/Auth/Data
- `src/types` — типы домена и DTO

## API контракт

Frontend ориентирован на canonical API:

- `GET /api/v1/health`
- `GET|POST /api/v1/ipqs/*`
- `GET /api/v1/wow-names`
- `GET|POST|PATCH|DELETE /api/v1/resources/*`
- `GET|POST|PATCH|DELETE /api/v1/workspace/*`
- `GET|PUT|PATCH /api/v1/settings/*`
- `GET|POST|PATCH|DELETE /api/v1/bots/*`
- `GET|POST|PATCH|DELETE /api/v1/finance/*`
- `GET|POST|PUT|DELETE /api/v1/infra/*`

Legacy `/api/*` маршруты не поддерживаются.
