# Bot-Mox - Статус проекта

> **Документ для будущих сессий**  
> Последнее обновление: 2026-01-30  
> Версия проекта: 0.0.0 (MVP)

---

## 1. Общая информация о проекте

**Bot-Mox** — админ-панель для управления игровыми ботами (WoW TBC, WoW Midnight), вдохновлённая дизайном Proxmox VE. Система обеспечивает мониторинг, финансовый учёт и аналитику ROI.

### Основные цели
- Управление ботами через единый интерфейс
- Мониторинг статуса и прогресса
- Финансовый учёт и расчёт ROI
- Архивация забаненных ботов

### Целевая аудитория
- Администраторы бот-ферм (2-3 пользователя)
- Операторы игровых ботов
- Финансовые аналитики

---

## 2. Технологический стек

| Компонент | Технология | Версия |
|-----------|------------|--------|
| Frontend | React | 19.2.0 |
| Framework | Refine | 5.0.8 |
| UI Library | Ant Design | 6.2.2 |
| Database | Firebase Realtime Database | 12.8.0 |
| Language | TypeScript | 5.9.3 |
| Build Tool | Vite | 7.2.4 |
| State Management | React Query (встроен в Refine) | - |
| Стили | CSS Modules + CSS Variables | - |

---

## 3. Структура папок

```
Bot-Mox/
├── ARCHITECTURE.md           # Архитектура проекта (требует обновления)
├── DATABASE_SCHEMA.json      # Полная схема Firebase RTDB
├── EXAMPLE_DATA.json         # Примеры данных для Firebase
├── PROJECT_STATUS.md         # Этот документ
├── TODO.md                   # Список задач
├── COMPONENTS.md             # Документация компонентов
├── DATABASE.md               # Документация базы данных
│
├── bot-mox/                  # React приложение
│   ├── src/
│   │   ├── components/
│   │   │   ├── bot/          # Компоненты страницы бота
│   │   │   ├── layout/       # Layout компоненты
│   │   │   └── ui/           # UI компоненты
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/            # Custom hooks
│   │   ├── pages/            # Страницы приложения
│   │   ├── providers/        # Refine providers
│   │   ├── styles/           # Глобальные стили
│   │   ├── types/            # TypeScript types
│   │   ├── utils/            # Утилиты
│   │   ├── App.tsx           # Корневой компонент
│   │   └── main.tsx          # Точка входа
│   ├── package.json
│   └── vite.config.ts
│
├── Assets/                   # Ресурсы проекта
│   ├── firebase-key.json     # Ключи Firebase
│   ├── style.css
│   └── *.csv                 # Тестовые данные
│
└── scripts/                  # Скрипты
    └── upload-to-firebase.js
```

---

## 4. Что реализовано

### 4.1 Инфраструктура
- [x] Настроен React + TypeScript + Vite
- [x] Интеграция Refine framework
- [x] Настроена Firebase Realtime Database
- [x] Создана структура проекта
- [x] Настроен Proxmox-style дизайн

### 4.2 Компоненты UI
- [x] **Layout**: Header, ResourceTree (sidebar), ContentPanel
- [x] **UI компоненты**: StatusBadge, MetricCard, LoadingState, ErrorBoundary
- [x] **Bot компоненты**:
  - BotSummary - сводка по боту
  - BotCharacter - информация о персонаже
  - BotLeveling - прогресс прокачки
  - BotProfession - профессии
  - BotSchedule - расписание
  - BotFarm - статистика фарма
  - BotAccount - данные аккаунта
  - BotPerson - данные персоны
  - BotLicense - лицензии
  - BotProxy - прокси
  - BotSubscription - подписки
  - BotLogs - логи событий

### 4.3 Страницы
- [x] **Dashboard** (`/`) - главная панель с метриками
- [x] **Datacenter** (`/`) - дерево ресурсов
- [x] **Bot Page** (`/bot/:id`) - детали бота с табами
- [x] **Finance** (`/finance`) - финансовый дашборд
- [x] **Notes** (`/notes`) - заметки
- [x] **Licenses** (`/licenses`) - управление лицензиями
- [x] **Proxies** (`/proxies`) - управление прокси
- [x] **Subscriptions** (`/subscriptions`) - подписки

### 4.4 Интеграции
- [x] Firebase Realtime Database подключена
- [x] Refine DataProvider для Firebase
- [x] Refine AuthProvider (заглушка)
- [x] Realtime подписки на данные через `onValue`
- [x] Генерация тестовых данных (`scripts/generate-data.js`)
- [x] Загрузка данных в Firebase (`scripts/upload-to-firebase.js`)
- [x] ResourceTree с realtime обновлениями ботов
- [x] BotPage с подпиской на конкретного бота
- [x] Dashboard с метриками из Firebase

### 4.5 Стили
- [x] Proxmox-style цветовая схема
- [x] CSS Variables для темизации
- [x] Глобальные стили для Ant Design
- [x] Компонентные CSS файлы

---

## 5. Что нужно исправить/доделать

### 5.1 Критические задачи
- [x] **Подключить реальные данные Firebase** - ✅ Готово (данные загружены, компоненты используют `onValue` подписки)
- [ ] **Реализовать аутентификацию** - authProvider сейчас заглушка
- [ ] **Добавить страницу логина**

### 5.2 Функциональность
- [ ] **Страница Projects** (`/project/:id`) - сейчас placeholder
- [ ] **Страница Metrics** (`/metrics/dashboard`) - сейчас placeholder
- [ ] **Страница Archive** (`/archive/banned`) - сейчас placeholder
- [ ] **Страница Logs** (`/logs`) - сейчас placeholder
- [ ] **Страница Settings** (`/settings`) - сейчас placeholder
- [ ] **Реализовать CRUD операции** для ботов
- [ ] **Добавить фильтрацию** в ResourceTree
- [ ] **Реализовать поиск** по ботам

### 5.3 Интеграции
- [ ] **Telegram уведомления** - настроить бота
- [ ] **Экспорт данных** в CSV/Excel
- [ ] **Импорт данных** из CSV

### 5.4 Оптимизация
- [ ] **Пагинация** для списков
- [ ] **Кэширование** данных
- [ ] **Оптимизация трафика** Firebase (лимит 360 МБ/день)
- [ ] **Virtual scrolling** для больших списков

### 5.5 Тестирование
- [ ] Unit тесты для компонентов
- [ ] Интеграционные тесты
- [ ] E2E тесты

---

## 6. Известные проблемы

### 6.1 Баги
1. ~~**Отсутствует dayjs импорт** в BotSchedule.tsx~~ - ✅ Исправлено
2. **Не работает переключение табов** в ContentPanel - children не передаются корректно
3. ~~**ResourceTree использует моковые данные**~~ - ✅ Исправлено - теперь подключается к Firebase с realtime обновлениями
4. ~~**StatusBadge не обновляется** в реальном времени~~ - ✅ Исправлено - данные теперь приходят через `onValue` подписки

### 6.2 Технический долг
- ~~Моковые данные разбросаны по компонентам~~ - ✅ Исправлено - ResourceTree, BotPage, Dashboard теперь используют Firebase
- Нет единого источника правды для типов
- CSS дублируется в некоторых компонентах
- ~~Нет обработки ошибок Firebase~~ - ✅ Исправлено - добавлена обработка ошибок в ResourceTree и BotPage

---

## 7. Как запустить проект

### Предварительные требования
- Node.js 18+
- npm или yarn
- Firebase проект (или доступ к существующему)

### Установка
```bash
# Перейти в директорию проекта
cd bot-mox

# Установить зависимости
npm install

# Запустить dev сервер
npm run dev
```

### Сборка
```bash
# Сборка для production
npm run build

# Предпросмотр production сборки
npm run preview
```

### Firebase конфигурация
Файл `bot-mox/src/utils/firebase.ts` содержит конфигурацию Firebase.  
Для продакшена замените на реальные ключи:
```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

---

## 8. Полезные команды

```bash
# Линтинг
npm run lint

# TypeScript проверка
cd bot-mox && npx tsc --noEmit

# Обновление зависимостей
npm update

# Установка нового пакета
npm install package-name
```

---

## 9. Ресурсы

- **Firebase Console**: https://console.firebase.google.com/project/botfarm-d69b7
- **Database URL**: https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/
- **Refine Docs**: https://refine.dev/docs/
- **Ant Design Docs**: https://ant.design/components/overview/
- **Firebase Docs**: https://firebase.google.com/docs/database

---

## 10. Контакты и команда

- **Проект**: Bot-Mox
- **Владелец**: @warfr
- **Репозиторий**: c:/Users/warfr/source/repos/Bot-Mox

---

## 11. История изменений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-01-30 | 0.0.0 | Создана базовая структура проекта, компоненты UI, интеграция Firebase |

---

**Примечание для будущих агентов**:  
Перед началом работы проверьте TODO.md для актуального списка задач.  
Все важные архитектурные решения документируются в ARCHITECTURE.md.
