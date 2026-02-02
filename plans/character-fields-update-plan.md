# План обновления: Поля персонажа и справочники

## Обзор

Данный план описывает обновление системы Bot-Mox для добавления полей персонажа (name, level, race, class, server, faction) и справочников (servers, races, classes, factions).

## Текущее состояние

### База данных (DATABASE_SCHEMA.json)

Секция `character` в `bots` уже содержит все необходимые поля:

```json
"character": {
  "name": "string - имя персонажа",
  "level": "number - текущий уровень",
  "race": "string - раса (orc, human, undead, etc.)",
  "class": "string - класс (warrior, mage, etc.)",
  "server": "string - название сервера",
  "faction": "string - фракция (alliance | horde)"
}
```

### Типы TypeScript (types/index.ts)

Интерфейс `Character` уже определён, но **отсутствует поле `faction`**:

```typescript
export interface Character {
  name: string;
  level: number;
  class: string;
  race: string;
  server: string;
  inventory?: InventoryItem[];
  // faction: string; // <-- НУЖНО ДОБАВИТЬ
}
```

### Компонент BotCharacter.tsx

Текущий компонент только **отображает** данные в режиме read-only:
- Использует Card, Avatar, Typography, Tag из Ant Design
- Показывает: имя, уровень, расу, класс, сервер
- **Отсутствует поле faction**
- **Нет возможности редактирования**

### Паттерны других вкладок

Изучены компоненты:
1. **BotAccount.tsx** - форма с редактированием, генерацией данных, Firebase интеграцией
2. **BotPerson.tsx** - форма с редактированием, генерацией персональных данных
3. **BotLeveling.tsx** - read-only отображение статистики

## Анализ: Что нужно сделать

### 1. Отсутствующие справочники в БД

В текущей схеме БД **нет отдельных коллекций** для справочников:
- `servers` - список серверов
- `races` - список рас
- `classes` - список классов
- `factions` - список фракций

Эти данные сейчас хранятся как строки в `projects` и `bots/character`.

### 2. Необходимые изменения

#### A. Типы TypeScript

**Файл:** `bot-mox/src/types/index.ts`

```typescript
// Добавить поле faction в Character
export interface Character {
  name: string;
  level: number;
  class: string;
  race: string;
  server: string;
  faction: 'alliance' | 'horde'; // <-- ДОБАВИТЬ
  inventory?: InventoryItem[];
}

// Добавить интерфейсы для справочников
export interface GameServer {
  id: string;
  name: string;
  region: string;
  type: 'pve' | 'pvp' | 'rp' | 'rppvp';
  project_id: string;
}

export interface GameRace {
  id: string;
  name: string;
  faction: 'alliance' | 'horde';
  available_classes: string[];
  project_id: string;
}

export interface GameClass {
  id: string;
  name: string;
  role: 'tank' | 'healer' | 'dps';
  resource: 'mana' | 'rage' | 'energy' | 'runic';
  project_id: string;
}

export interface GameFaction {
  id: 'alliance' | 'horde';
  name: string;
  icon: string;
}
```

#### B. Компонент BotCharacter.tsx

**Текущий функционал:**
- Read-only отображение данных персонажа
- Моковые данные инвентаря

**Необходимые изменения:**

1. **Добавить форму редактирования** (по аналогии с BotAccount)
2. **Добавить поле faction** с визуальным отображением
3. **Интеграция с Firebase** для сохранения/загрузки
4. **Валидация полей**
5. **Генерация имени персонажа** (опционально)

**Структура UI:**

```
BotCharacter
├── Row 1: Основная информация (Form)
│   ├── character.name (Input)
│   ├── character.level (InputNumber)
│   ├── character.race (Select)
│   ├── character.class (Select)
│   ├── character.server (Select)
│   └── character.faction (Select с цветовой индикацией)
├── Row 2: Действия
│   ├── Save Button
│   └── Generate Name Button (опционально)
└── Row 3: Инвентарь (read-only, как сейчас)
```

#### C. Стили BotCharacter.css

Добавить стили для:
- Формы редактирования
- Цветовой индикации фракций (Alliance - синий, Horde - красный)
- Адаптивности

#### D. Справочники в БД

**Вариант 1: Хранить в projects (рекомендуется)**

Расширить схему `projects`:

```json
{
  "wow_tbc": {
    "id": "wow_tbc",
    "name": "WoW TBC Classic",
    "servers": {
      "gehennas": { "id": "gehennas", "name": "Gehennas", "region": "EU", "type": "pvp" },
      "firemaw": { "id": "firemaw", "name": "Firemaw", "region": "EU", "type": "pvp" }
    },
    "races": {
      "orc": { "id": "orc", "name": "Orc", "faction": "horde", "available_classes": ["warrior", "hunter", "rogue", "shaman", "warlock"] },
      "human": { "id": "human", "name": "Human", "faction": "alliance", "available_classes": ["warrior", "paladin", "hunter", "rogue", "priest", "mage", "warlock"] }
    },
    "classes": {
      "warrior": { "id": "warrior", "name": "Warrior", "role": "tank", "resource": "rage" },
      "mage": { "id": "mage", "name": "Mage", "role": "dps", "resource": "mana" }
    }
  }
}
```

**Вариант 2: Отдельные корневые коллекции**

```json
{
  "servers": {
    "wow_tbc": {
      "gehennas": { "id": "gehennas", "name": "Gehennas", "region": "EU", "type": "pvp" }
    }
  },
  "races": {
    "wow_tbc": {
      "orc": { "id": "orc", "name": "Orc", "faction": "horde" }
    }
  }
}
```

**Рекомендация:** Вариант 1 - хранить внутри `projects` для лучшей локализации данных.

#### E. Firebase интеграция

**Загрузка справочников:**

```typescript
// В BotCharacter.tsx
const [servers, setServers] = useState<GameServer[]>([]);
const [races, setRaces] = useState<GameRace[]>([]);
const [classes, setClasses] = useState<GameClass[]>([]);

useEffect(() => {
  const projectRef = ref(database, `projects/${bot.project_id}`);
  onValue(projectRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      setServers(Object.values(data.servers || {}));
      setRaces(Object.values(data.races || {}));
      setClasses(Object.values(data.classes || {}));
    }
  });
}, [bot.project_id]);
```

**Сохранение данных персонажа:**

```typescript
const handleSave = async (values: CharacterFormValues) => {
  const characterRef = ref(database, `bots/${bot.id}/character`);
  await update(characterRef, {
    name: values.name,
    level: values.level,
    race: values.race,
    class: values.class,
    server: values.server,
    faction: values.faction,
    updated_at: Date.now(),
  });
};
```

## Детальный план реализации

### Phase 1: Обновление типов TypeScript

**Файл:** `bot-mox/src/types/index.ts`

- [ ] Добавить поле `faction` в интерфейс `Character`
- [ ] Добавить интерфейс `GameServer`
- [ ] Добавить интерфейс `GameRace`
- [ ] Добавить интерфейс `GameClass`
- [ ] Добавить интерфейс `GameFaction`
- [ ] Добавить тип `FactionType = 'alliance' | 'horde'`

### Phase 2: Обновление схемы БД

**Файл:** `DATABASE_SCHEMA.json`

- [ ] Расширить секцию `projects` полями `servers`, `races`, `classes`
- [ ] Обновить changelog до версии 1.3.0

**Файл:** `DATABASE.md`

- [ ] Документировать новые поля в `projects`
- [ ] Добавить примеры данных справочников

### Phase 3: Скрипт инициализации справочников

**Новый файл:** `scripts/init-reference-data.js`

```javascript
// Скрипт для заполнения справочников в Firebase
// WoW TBC Classic
const tbcData = {
  servers: [
    { id: 'gehennas', name: 'Gehennas', region: 'EU', type: 'pvp' },
    { id: 'firemaw', name: 'Firemaw', region: 'EU', type: 'pvp' },
    { id: 'mograine', name: 'Mograine', region: 'EU', type: 'pvp' },
    // ...
  ],
  races: [
    { id: 'orc', name: 'Orc', faction: 'horde', available_classes: ['warrior', 'hunter', 'rogue', 'shaman', 'warlock'] },
    { id: 'troll', name: 'Troll', faction: 'horde', available_classes: ['warrior', 'hunter', 'rogue', 'shaman', 'mage', 'priest'] },
    { id: 'undead', name: 'Undead', faction: 'horde', available_classes: ['warrior', 'rogue', 'mage', 'warlock', 'priest'] },
    { id: 'tauren', name: 'Tauren', faction: 'horde', available_classes: ['warrior', 'hunter', 'shaman', 'druid'] },
    { id: 'human', name: 'Human', faction: 'alliance', available_classes: ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'mage', 'warlock'] },
    { id: 'night_elf', name: 'Night Elf', faction: 'alliance', available_classes: ['warrior', 'hunter', 'rogue', 'priest', 'mage', 'druid'] },
    { id: 'dwarf', name: 'Dwarf', faction: 'alliance', available_classes: ['warrior', 'paladin', 'hunter', 'rogue', 'priest'] },
    { id: 'gnome', name: 'Gnome', faction: 'alliance', available_classes: ['warrior', 'rogue', 'mage', 'warlock'] },
    { id: 'draenei', name: 'Draenei', faction: 'alliance', available_classes: ['warrior', 'paladin', 'hunter', 'priest', 'mage', 'shaman'] },
    { id: 'blood_elf', name: 'Blood Elf', faction: 'horde', available_classes: ['paladin', 'hunter', 'rogue', 'priest', 'mage', 'warlock'] },
  ],
  classes: [
    { id: 'warrior', name: 'Warrior', role: 'tank', resource: 'rage' },
    { id: 'paladin', name: 'Paladin', role: 'healer', resource: 'mana' },
    { id: 'hunter', name: 'Hunter', role: 'dps', resource: 'mana' },
    { id: 'rogue', name: 'Rogue', role: 'dps', resource: 'energy' },
    { id: 'priest', name: 'Priest', role: 'healer', resource: 'mana' },
    { id: 'shaman', name: 'Shaman', role: 'healer', resource: 'mana' },
    { id: 'mage', name: 'Mage', role: 'dps', resource: 'mana' },
    { id: 'warlock', name: 'Warlock', role: 'dps', resource: 'mana' },
    { id: 'druid', name: 'Druid', role: 'healer', resource: 'mana' },
  ],
};
```

### Phase 4: Рефакторинг BotCharacter.tsx

**Структура компонента:**

```typescript
interface BotCharacterProps {
  bot: Bot;
}

interface CharacterFormValues {
  name: string;
  level: number;
  race: string;
  class: string;
  server: string;
  faction: 'alliance' | 'horde';
}

export const BotCharacter: React.FC<BotCharacterProps> = ({ bot }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Справочники
  const [servers, setServers] = useState<GameServer[]>([]);
  const [races, setRaces] = useState<GameRace[]>([]);
  const [classes, setClasses] = useState<GameClass[]>([]);
  
  // Загрузка данных из Firebase
  useEffect(() => {
    // Загрузка character
    // Загрузка справочников из projects
  }, [bot.id, bot.project_id]);
  
  // Обработчики
  const handleSave = async (values: CharacterFormValues) => { ... };
  const handleGenerateName = () => { ... };
  const handleRaceChange = (raceId: string) => {
    // Автоматически установить faction при выборе расы
  };
  
  return (
    <div className="bot-character">
      <Form form={form} onFinish={handleSave} layout="vertical">
        {/* Поля формы */}
      </Form>
    </div>
  );
};
```

**UI Layout:**

```jsx
<Row gutter={[16, 16]}>
  <Col span={16}>
    <Card title="Character Information" className="character-form-card">
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="name" label="Character Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name="level" label="Level" rules={[{ required: true, min: 1, max: 70 }]}>
            <InputNumber min={1} max={70} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name="faction" label="Faction" rules={[{ required: true }]}>
            <Select>
              <Option value="alliance">
                <Badge color="blue" text="Alliance" />
              </Option>
              <Option value="horde">
                <Badge color="red" text="Horde" />
              </Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name="race" label="Race" rules={[{ required: true }]}>
            <Select showSearch>
              {races.map(race => (
                <Option key={race.id} value={race.id}>{race.name}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="class" label="Class" rules={[{ required: true }]}>
            <Select showSearch>
              {classes.map(cls => (
                <Option key={cls.id} value={cls.id}>{cls.name}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="server" label="Server" rules={[{ required: true }]}>
            <Select showSearch>
              {servers.map(server => (
                <Option key={server.id} value={server.id}>{server.name}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
          Save Character
        </Button>
      </Form.Item>
    </Card>
  </Col>
  <Col span={8}>
    <Card title="Inventory" className="inventory-card">
      {/* Инвентарь (read-only) */}
    </Card>
  </Col>
</Row>
```

### Phase 5: Обновление стилей

**Файл:** `bot-mox/src/components/bot/BotCharacter.css`

```css
/* Новые стили для формы */
.character-form-card {
  background: var(--proxmox-bg-secondary);
  border: 1px solid var(--proxmox-border);
}

.character-form-card .ant-card-head {
  background: var(--proxmox-bg-tertiary);
  border-bottom: 1px solid var(--proxmox-border);
}

/* Стили для фракций */
.faction-alliance {
  color: #0078ff;
}

.faction-horde {
  color: #ff0000;
}

.faction-badge-alliance .ant-badge-status-dot {
  background-color: #0078ff;
}

.faction-badge-horde .ant-badge-status-dot {
  background-color: #ff0000;
}

/* Стили для селектов */
.character-form-card .ant-select {
  width: 100%;
}

.character-form-card .ant-input-number {
  width: 100%;
}
```

### Phase 6: Утилиты для работы с персонажем

**Новый файл:** `bot-mox/src/utils/characterUtils.ts`

```typescript
import type { GameRace, GameClass, GameServer } from '../types';

// Генерация случайного имени персонажа WoW
export const generateCharacterName = (): string => {
  const prefixes = ['Dark', 'Light', 'Shadow', 'Holy', 'Blood', 'Frost', 'Fire', 'Storm', 'Thunder', 'Iron'];
  const suffixes = ['blade', 'heart', 'soul', 'fury', 'rage', 'walker', 'hunter', 'mage', 'knight', 'warrior'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  return `${prefix}${suffix}${Math.floor(Math.random() * 100)}`;
};

// Получение доступных классов для расы
export const getAvailableClassesForRace = (raceId: string, races: GameRace[]): string[] => {
  const race = races.find(r => r.id === raceId);
  return race?.available_classes || [];
};

// Получение фракции для расы
export const getFactionForRace = (raceId: string, races: GameRace[]): 'alliance' | 'horde' | null => {
  const race = races.find(r => r.id === raceId);
  return race?.faction || null;
};

// Валидация имени персонажа WoW
export const validateCharacterName = (name: string): boolean => {
  // WoW naming rules: 2-12 characters, letters only, first letter capitalized
  const regex = /^[A-Z][a-zA-Z]{1,11}$/;
  return regex.test(name);
};

// Форматирование отображения персонажа
export const formatCharacterDisplay = (
  name: string,
  level: number,
  race: string,
  className: string
): string => {
  return `${name} (Level ${level} ${race} ${className})`;
};
```

## Список файлов для изменения

### TypeScript Types
| Файл | Изменения |
|------|-----------|
| `bot-mox/src/types/index.ts` | Добавить `faction` в `Character`, добавить интерфейсы справочников |

### Компоненты
| Файл | Изменения |
|------|-----------|
| `bot-mox/src/components/bot/BotCharacter.tsx` | Полный рефакторинг: добавить форму, Firebase интеграцию, селекторы |
| `bot-mox/src/components/bot/BotCharacter.css` | Добавить стили для формы и фракций |

### Утилиты
| Файл | Изменения |
|------|-----------|
| `bot-mox/src/utils/characterUtils.ts` | **Новый файл**: утилиты для работы с персонажем |

### Документация БД
| Файл | Изменения |
|------|-----------|
| `DATABASE_SCHEMA.json` | Добавить справочники в `projects`, обновить changelog |
| `DATABASE.md` | Документировать новые поля и справочники |

### Скрипты
| Файл | Изменения |
|------|-----------|
| `scripts/init-reference-data.js` | **Новый файл**: инициализация справочников |

## Миграция данных

### Для существующих ботов

Существующие боты уже имеют поля `character` с `name`, `level`, `race`, `class`, `server`. Нужно:

1. Добавить поле `faction` на основе `race`:
   - Horde races: orc, troll, undead, tauren, blood_elf
   - Alliance races: human, night_elf, dwarf, gnome, draenei

2. Скрипт миграции:

```javascript
// scripts/migrate-character-faction.js
const { database } = require('./firebase-admin');

const raceToFaction = {
  orc: 'horde',
  troll: 'horde',
  undead: 'horde',
  tauren: 'horde',
  blood_elf: 'horde',
  human: 'alliance',
  night_elf: 'alliance',
  dwarf: 'alliance',
  gnome: 'alliance',
  draenei: 'alliance',
};

async function migrateCharacterFaction() {
  const botsRef = database.ref('bots');
  const snapshot = await botsRef.once('value');
  const bots = snapshot.val();
  
  const updates = {};
  
  for (const [botId, bot] of Object.entries(bots)) {
    if (bot.character && !bot.character.faction) {
      const race = bot.character.race;
      const faction = raceToFaction[race] || 'horde';
      updates[`bots/${botId}/character/faction`] = faction;
      updates[`bots/${botId}/character/updated_at`] = Date.now();
    }
  }
  
  await database.ref().update(updates);
  console.log(`Migrated ${Object.keys(updates).length / 2} bots`);
}

migrateCharacterFaction();
```

## Проверочный чеклист

- [ ] Типы TypeScript обновлены и компилируются без ошибок
- [ ] Схема БД документирована
- [ ] Справочники инициализированы в Firebase
- [ ] Компонент BotCharacter отображает форму редактирования
- [ ] Все поля (name, level, race, class, server, faction) редактируются
- [ ] Селекторы race/class/server заполнены данными из справочников
- [ ] При выборе расы автоматически устанавливается faction
- [ ] Данные сохраняются в Firebase
- [ ] Стили соответствуют дизайн-системе (Proxmox тема)
- [ ] Миграция выполнена для существующих ботов
- [ ] Валидация работает корректно

## Примечания

1. **Инвентарь** остаётся в режиме read-only (моковые данные) - его реализация выходит за рамки текущей задачи
2. **Генерация имени** - опциональная функция, может быть добавлена позже
3. **Зависимости race-class** - можно добавить фильтрацию доступных классов при выборе расы
4. **Иконки** - для фракций можно использовать кастомные иконки или эмодзи
