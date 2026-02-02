# Миграция базы данных Bot-Mox v1.0.0 → v1.1.0 (V6 Pixel Bridge Full Precision)

> **Дата**: 2026-01-31  
> **Версия схемы**: 1.1.0  
> **Статус**: ✅ Применено

---

## Сводка изменений

### 1. Добавлено: Секция `telemetry` в `bots` (V6 Pixel Bridge)

**Путь**: `/bots/{bot_id}/telemetry`

**Поля**:
- `smart_loot_session` (number) - накопленная ценность лута за сессию (TSM + Vendor)
- `deaths_session` (number) - количество смертей за текущую сессию
- `durability_avg` (number) - средняя прочность экипировки (0-100)
- `bag_slots_free` (number) - количество свободных слотов в сумках
- `last_sync_ts` (number) - timestamp последней синхронизации со сканнером
- `pixel_block_0_header` (string) - RGB значение header блока (должно быть "255,0,255")
- `pixel_block_12_footer` (string) - RGB значение footer блока (должно быть "0,255,255")
- `scan_status` (string) - статус сканирования: "valid" | "invalid" | "timeout"

### 2. Добавлено: Коллекция `hourly_stats`

**Путь**: `/hourly_stats/{project_id}/{date}/{bot_id}/{hour}`

**Поля**:
- `xp_gained` (number) - XP полученный за этот час
- `gold_farmed` (number) - чистое золото (loot)
- `smart_loot_value` (number) - оценочная стоимость (TSM + Vendor)
- `deaths` (number) - количество смертей
- `online_minutes` (number) - минут в онлайне (макс 60)

**Retention**: 14 дней

### 3. Удалено: Deprecated поля

Удалены следующие поля (теперь вычисляются на клиенте из `hourly_stats`):
- `bots.*.farm.gold_per_hour`
- `bots.*.leveling.xp_per_hour`
- `bots.*.leveling.estimated_time_to_level`

---

## Протокол Передачи (Pixel Bridge V6 - Full Precision)

**Размер блока:** 16x16 пикселей.  
**Количество блоков:** 13.  
**Частота:** 1 раз в секунду (аддон), Считывание — 1 раз в минуту.

| # | RGB Каналы (0-255) | Описание Данных | Тип/Логика |
|---|---|---|---|
| **0** | `255, 0, 255` | **Sync Header** (Magenta) | Маркер начала |
| **1** | `R: Level`<br>`G: HP%`<br>`B: Status` | `Status`: 0=Idle, 1=Combat, 2=Dead, 3=Mounted | Текущее состояние |
| **2** | `XP_Low`, `XP_Mid`, `XP_High` | **Current XP** (Absolute). | Int24 |
| **3** | `MaxXP_L`, `MaxXP_M`, `MaxXP_H` | **Max XP**. | Int24 |
| **4** | `Gold_L`, `Gold_M`, `Gold_H` | **Wallet Gold**. | Int24 |
| **5** | `Val_L`, `Val_M`, `Val_H` | **Smart Loot Value** (Session Accumulator). | Int24 |
| **6** | `Sk_Low`, `Sk_High`, `Mx_Low` | **Prof 1 (Part A)**. Low/High байты для Skill и Low для Max. | Split Int16 |
| **7** | `Mx_High`, `ID`, `0` | **Prof 1 (Part B)**. High байт для Max и ID профессии. | Split Int16 |
| **8** | `Sk_Low`, `Sk_High`, `Mx_Low` | **Prof 2 (Part A)**. | Split Int16 |
| **9** | `Mx_High`, `ID`, `0` | **Prof 2 (Part B)**. | Split Int16 |
| **10**| `Map_High`, `Map_Low`, `0` | **Map ID**. | Int16 |
| **11**| `BagSlots`, `Dur%`, `Deaths` | `Deaths`: Счетчик смертей за сессию. | Byte |
| **12**| `0, 255, 255` | **Sync Footer** (Cyan) | Маркер конца |

---

## Инструкции по миграции

### Шаг 1: Добавление telemetry к существующим ботам

Для каждого бота добавьте секцию `telemetry`:

```json
{
  "bots": {
    "{bot_id}": {
      "telemetry": {
        "smart_loot_session": 0,
        "deaths_session": 0,
        "durability_avg": 100,
        "bag_slots_free": 16,
        "last_sync_ts": 0,
        "pixel_block_0_header": "255,0,255",
        "pixel_block_12_footer": "0,255,255",
        "scan_status": "valid"
      }
    }
  }
}
```

**Начальные значения**:
- `smart_loot_session`: 0 (начало сессии)
- `deaths_session`: 0 (начало сессии)
- `durability_avg`: 100 (полная прочность)
- `bag_slots_free`: 16 (стандартное количество слотов)
- `last_sync_ts`: 0 (еще не синхронизировался)
- `pixel_block_0_header`: "255,0,255" (Magenta)
- `pixel_block_12_footer`: "0,255,255" (Cyan)
- `scan_status`: "valid"

### Шаг 2: Создание структуры hourly_stats

В Firebase Console (Realtime Database) создайте корневой узел:

```json
{
  "hourly_stats": {}
}
```

### Шаг 3: Удаление deprecated полей (опционально)

Если вы хотите очистить структуру, удалите следующие поля из каждого бота:
- `farm.gold_per_hour`
- `leveling.xp_per_hour`
- `leveling.estimated_time_to_level`

**Важно**: Убедитесь, что ваш frontend больше не использует эти поля!

### Шаг 4: Обновление правил безопасности

Добавьте правила для новой коллекции `hourly_stats`:

```json
{
  "rules": {
    "hourly_stats": {
      ".read": "auth != null",
      ".write": "auth != null && auth.token.admin === true"
    }
  }
}
```

---

## Скрипт миграции (Node.js)

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('../Assets/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/"
});

const db = admin.database();

const defaultTelemetry = {
  smart_loot_session: 0,
  deaths_session: 0,
  durability_avg: 100,
  bag_slots_free: 16,
  last_sync_ts: 0,
  pixel_block_0_header: "255,0,255",
  pixel_block_12_footer: "0,255,255",
  scan_status: "valid"
};

async function migrate() {
  console.log('🚀 Starting migration v1.0.0 → v1.1.0...\n');
  
  const botsSnapshot = await db.ref('bots').once('value');
  const bots = botsSnapshot.val();
  
  if (!bots) {
    console.log('⚠️ No bots found');
    return;
  }
  
  const updates = {};
  
  for (const [botId, botData] of Object.entries(bots)) {
    if (!botData.telemetry) {
      console.log(`📝 Bot ${botId}: adding telemetry...`);
      updates[`bots/${botId}/telemetry`] = {
        ...defaultTelemetry,
        last_sync_ts: Date.now()
      };
    }
  }
  
  // Создаем hourly_stats
  updates['hourly_stats'] = {};
  
  await db.ref().update(updates);
  console.log('\n✅ Migration completed!');
}

migrate().catch(console.error);
```

---

## Проверка миграции

После выполнения миграции проверьте:

1. **Структура telemetry**:
   ```bash
   # В Firebase Console перейдите к:
   /bots/{bot_id}/telemetry
   ```

2. **Наличие hourly_stats**:
   ```bash
   # Убедитесь, что узел создан:
   /hourly_stats
   ```

3. **Deprecated поля** (если удаляли):
   ```bash
   # Проверьте, что поля отсутствуют:
   /bots/{bot_id}/farm/gold_per_hour  # должно быть null или отсутствовать
   /bots/{bot_id}/leveling/xp_per_hour  # должно быть null или отсутствовать
   ```

---

## Откат миграции

Если нужно откатить изменения:

```javascript
async function rollback() {
  const updates = {};
  
  const botsSnapshot = await db.ref('bots').once('value');
  const bots = botsSnapshot.val();
  
  for (const botId of Object.keys(bots)) {
    // Удаляем telemetry
    updates[`bots/${botId}/telemetry`] = null;
  }
  
  // Удаляем hourly_stats
  updates['hourly_stats'] = null;
  
  await db.ref().update(updates);
  console.log('Rollback completed');
}
```

---

## Связанные документы

- [DATABASE_SCHEMA.json](../DATABASE_SCHEMA.json) - Полная схема базы данных
- [DATABASE.md](../DATABASE.md) - Документация по сущностям
- [PRD V6](../ARCHITECTURE.md) - Требования к системе
