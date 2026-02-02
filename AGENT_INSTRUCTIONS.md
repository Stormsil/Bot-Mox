# Bot-Mox - Инструкции для будущих агентов

> **Руководство по работе с проектом для AI-агентов**  
> Последнее обновление: 2026-01-30

---

## Быстрый старт

### 1. Прочитайте документацию

Перед началом работы обязательно ознакомьтесь с:

1. **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - текущее состояние проекта
2. **[TODO.md](TODO.md)** - список задач и багов
3. **[ARCHITECTURE.md](ARCHITECTURE.md)** - архитектура системы
4. **[COMPONENTS.md](COMPONENTS.md)** - документация компонентов
5. **[DATABASE.md](DATABASE.md)** - структура базы данных

### 2. Проверьте статус задач

Всегда проверяйте [TODO.md](TODO.md) перед началом работы. Там указаны:
- Критические баги (🔴)
- Высокоприоритетные задачи (🟠)
- Зависимости между задачами

### 3. Запустите проект

```bash
cd bot-mox
npm install
npm run dev
```

---

## Архитектура проекта

### Технологический стек

```
React 19 + TypeScript 5.9
├── Refine 5 (Framework)
├── Ant Design 6 (UI Library)
├── Firebase 12 (Realtime Database)
└── Vite 7 (Build Tool)
```

### Структура папок

```
bot-mox/src/
├── components/
│   ├── bot/           # Компоненты страницы бота
│   ├── layout/        # Layout компоненты
│   └── ui/            # UI компоненты
├── contexts/          # React contexts
├── hooks/             # Custom hooks
├── pages/             # Страницы приложения
├── providers/         # Refine providers
├── styles/            # Глобальные стили
├── types/             # TypeScript types
├── utils/             # Утилиты
├── App.tsx            # Корневой компонент
└── main.tsx           # Точка входа
```

---

## Ключевые принципы

### 1. Proxmox-стиль дизайна

Все компоненты должны следовать стилю Proxmox VE:

```css
/* Основные цвета */
--proxmox-bg-primary: #1e1e1e;
--proxmox-bg-secondary: #2d2d2d;
--proxmox-accent: #e57000;
--proxmox-text-primary: #ffffff;
--proxmox-text-secondary: #cccccc;

/* Статусы */
--proxmox-status-online: #2ecc71;
--proxmox-status-offline: #7f8c8d;
--proxmox-status-error: #e74c3c;
```

### 2. Работа с Firebase

Всегда используйте провайдеры для доступа к Firebase:

```typescript
// Правильно
import { useFirebase } from '../contexts/FirebaseContext';
import { ref, onValue } from 'firebase/database';

const MyComponent = () => {
  const { database } = useFirebase();
  
  useEffect(() => {
    const botRef = ref(database, `bots/${botId}`);
    const unsubscribe = onValue(botRef, (snapshot) => {
      // handle data
    });
    return () => unsubscribe();
  }, [botId]);
};
```

### 3. Типизация

Всегда используйте типы из [`types/index.ts`](bot-mox/src/types/index.ts):

```typescript
import type { Bot, BotStatus, Character } from '../types';

interface MyComponentProps {
  bot: Bot;
  onStatusChange: (status: BotStatus) => void;
}
```

### 4. Статусы ботов

| Статус | Описание | Цвет |
|--------|----------|------|
| `offline` | Неактивен | Серый |
| `prepare` | Подготовка | Синий |
| `leveling` | Прокачка уровня | Фиолетовый |
| `profession` | Прокачка профессии | Розовый |
| `farming` | Фарм | Зелёный |
| `banned` | Забанен | Красный |

---

## Работа с компонентами

### Создание нового компонента

1. Создайте файл в соответствующей папке:
   - UI компоненты → `components/ui/`
   - Bot компоненты → `components/bot/`
   - Layout → `components/layout/`

2. Базовая структура:

```typescript
import React from 'react';
import type { Bot } from '../../types';
import './MyComponent.css';

interface MyComponentProps {
  bot: Bot;
  // другие пропсы
}

export const MyComponent: React.FC<MyComponentProps> = ({ bot }) => {
  return (
    <div className="my-component">
      {/* content */}
    </div>
  );
};
```

3. Экспортируйте из `index.ts`:

```typescript
// components/bot/index.ts
export { MyComponent } from './MyComponent';
```

### Стилизация

Используйте CSS Modules + CSS Variables:

```css
/* MyComponent.css */
.my-component {
  background: var(--proxmox-bg-secondary);
  border: 1px solid var(--proxmox-border);
  padding: var(--spacing-md);
}

.my-component:hover {
  background: var(--proxmox-bg-hover);
}
```

---

## Работа с Firebase

### Чтение данных

```typescript
import { ref, onValue, get } from 'firebase/database';
import { useFirebase } from '../contexts/FirebaseContext';

// Realtime подписка
const useBotData = (botId: string) => {
  const { database } = useFirebase();
  const [data, setData] = useState<Bot | null>(null);
  
  useEffect(() => {
    const botRef = ref(database, `bots/${botId}`);
    const unsubscribe = onValue(botRef, (snapshot) => {
      setData(snapshot.val());
    });
    return () => unsubscribe();
  }, [botId, database]);
  
  return data;
};

// Одноразовое чтение
const fetchBot = async (botId: string) => {
  const botRef = ref(database, `bots/${botId}`);
  const snapshot = await get(botRef);
  return snapshot.val() as Bot;
};
```

### Запись данных

```typescript
import { ref, set, update, push } from 'firebase/database';

// Создание
const createBot = async (botData: Partial<Bot>) => {
  const botsRef = ref(database, 'bots');
  const newBotRef = push(botsRef);
  await set(newBotRef, {
    ...botData,
    id: newBotRef.key,
    created_at: Date.now(),
    updated_at: Date.now(),
  });
  return newBotRef.key;
};

// Обновление
const updateBot = async (botId: string, updates: Partial<Bot>) => {
  const botRef = ref(database, `bots/${botId}`);
  await update(botRef, {
    ...updates,
    updated_at: Date.now(),
  });
};
```

---

## Чек-лист перед коммитом

- [ ] Код компилируется без ошибок (`npm run build`)
- [ ] Нет ошибок линтера (`npm run lint`)
- [ ] TypeScript проверка пройдена (`npx tsc --noEmit`)
- [ ] Новые компоненты экспортированы из `index.ts`
- [ ] Стили соответствуют Proxmox теме
- [ ] Типы используются корректно
- [ ] Нет `console.log` (только `console.error` для ошибок)
- [ ] Firebase подписки отменяются в cleanup

---

## Частые проблемы

### 1. Отсутствует импорт dayjs

**Проблема**: `dayjs is not defined`

**Решение**:
```typescript
import dayjs from 'dayjs';
```

### 2. Проблема с Firebase подписками

**Проблема**: Утечка памяти

**Решение**:
```typescript
useEffect(() => {
  const unsubscribe = onValue(ref, callback);
  return () => unsubscribe(); // Важно!
}, []);
```

### 3. Типизация событий Ant Design

**Пример**:
```typescript
import type { TabsProps } from 'antd';

const handleTabChange: TabsProps['onChange'] = (key) => {
  // key is string
};
```

---

## Полезные ссылки

### Документация
- [Refine Docs](https://refine.dev/docs/)
- [Ant Design Components](https://ant.design/components/overview/)
- [Firebase Realtime Database](https://firebase.google.com/docs/database)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

### Внутренние ресурсы
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - Статус проекта
- [TODO.md](TODO.md) - Задачи
- [ARCHITECTURE.md](ARCHITECTURE.md) - Архитектура
- [COMPONENTS.md](COMPONENTS.md) - Компоненты
- [DATABASE.md](DATABASE.md) - База данных

---

## Контакты

- **Проект**: Bot-Mox
- **Владелец**: @warfr
- **Репозиторий**: `c:/Users/warfr/source/repos/Bot-Mox`

---

## Обновление документации

При внесении существенных изменений:

1. Обновите [PROJECT_STATUS.md](PROJECT_STATUS.md)
2. Отметьте выполненные задачи в [TODO.md](TODO.md)
3. Добавьте новые компоненты в [COMPONENTS.md](COMPONENTS.md)
4. Обновите схему в [DATABASE.md](DATABASE.md) при изменении структуры БД

---

**Удачной работы! 🚀**
