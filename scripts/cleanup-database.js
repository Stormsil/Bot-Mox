/**
 * Скрипт для очистки и реструктуризации базы данных Firebase
 * 
 * Выполняет:
 * 1. Удаление старых schedule (v1 формат)
 * 2. Миграцию schedule в v2 формат
 * 3. Очистку архаичных полей
 * 4. Проверку целостности данных
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, update, remove } = require('firebase/database');

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  databaseURL: process.env.FIREBASE_DATABASE_URL || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || ''
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

/**
 * Генерирует уникальный ID для сессии
 */
function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Создает пустое расписание v2
 */
function createEmptySchedule() {
  const emptyDay = () => ({
    enabled: false,
    sessions: []
  });

  return {
    version: 2,
    timezone: 'Europe/Moscow',
    days: {
      "0": emptyDay(),
      "1": emptyDay(),
      "2": emptyDay(),
      "3": emptyDay(),
      "4": emptyDay(),
      "5": emptyDay(),
      "6": emptyDay()
    },
    updated_at: Date.now()
  };
}

/**
 * Мигрирует schedule v1 → v2
 */
function migrateSchedule(oldSchedule) {
  if (!oldSchedule) {
    return createEmptySchedule();
  }

  // Если уже v2 - проверяем структуру
  if (oldSchedule.version === 2 && oldSchedule.days) {
    const schedule = { ...oldSchedule };
    for (let day = 0; day <= 6; day++) {
      const dayKey = day.toString();
      if (!schedule.days[dayKey]) {
        schedule.days[dayKey] = { enabled: false, sessions: [] };
      }
      if (!Array.isArray(schedule.days[dayKey].sessions)) {
        schedule.days[dayKey].sessions = [];
      }
    }
    return schedule;
  }

  // Миграция с v1
  const newSchedule = createEmptySchedule();

  for (let day = 0; day <= 6; day++) {
    const dayKey = day.toString();
    const oldDay = oldSchedule[dayKey];

    if (oldDay && Array.isArray(oldDay) && oldDay.length > 0) {
      const sessions = [];
      
      for (const slot of oldDay) {
        if (slot && typeof slot === 'object') {
          sessions.push({
            id: generateSessionId(),
            start: slot.start || '09:00',
            end: slot.end || '17:00',
            enabled: slot.enabled ?? false,
            profile: slot.profile || 'farming',
            type: 'active'
          });
        }
      }
      
      const hasEnabledSession = sessions.some(s => s.enabled);
      
      newSchedule.days[dayKey] = {
        enabled: hasEnabledSession,
        sessions: sessions
      };
    }
  }

  newSchedule.updated_at = Date.now();
  return newSchedule;
}

/**
 * Проверяет и очищает данные бота
 */
async function cleanupBot(botId, botData) {
  const updates = {};
  let needsUpdate = false;

  console.log(`\n📋 Processing bot: ${botId}`);

  // 1. Проверяем и мигрируем schedule
  if (botData.schedule) {
    const oldSchedule = botData.schedule;
    
    // Определяем версию schedule
    const isV2 = oldSchedule.version === 2 && oldSchedule.days;
    const isV1 = !isV2 && (oldSchedule["0"] || oldSchedule["1"] || oldSchedule["2"] || 
                           oldSchedule["3"] || oldSchedule["4"] || oldSchedule["5"] || oldSchedule["6"]);
    
    if (isV1) {
      console.log(`  🔄 Migrating schedule v1 → v2`);
      const newSchedule = migrateSchedule(oldSchedule);
      updates[`bots/${botId}/schedule`] = newSchedule;
      needsUpdate = true;
    } else if (isV2) {
      // Проверяем целостность v2
      let needsFix = false;
      for (let day = 0; day <= 6; day++) {
        const dayKey = day.toString();
        const dayData = oldSchedule.days?.[dayKey];
        if (!dayData || !Array.isArray(dayData.sessions)) {
          needsFix = true;
          console.log(`  ⚠️  Day ${dayKey} has invalid sessions array`);
        }
      }
      
      if (needsFix) {
        console.log(`  🔄 Fixing v2 schedule structure`);
        const fixedSchedule = migrateSchedule(oldSchedule);
        updates[`bots/${botId}/schedule`] = fixedSchedule;
        needsUpdate = true;
      } else {
        console.log(`  ✅ Schedule v2 is valid`);
      }
    }
  } else {
    console.log(`  ➕ Creating default schedule`);
    updates[`bots/${botId}/schedule`] = createEmptySchedule();
    needsUpdate = true;
  }

  // 2. Проверяем и удаляем архаичные поля
  const deprecatedFields = [
    'old_schedule',
    'schedule_v1',
    'temp_schedule',
    '_migration_backup'
  ];
  
  for (const field of deprecatedFields) {
    if (botData[field] !== undefined) {
      console.log(`  🗑️  Removing deprecated field: ${field}`);
      updates[`bots/${botId}/${field}`] = null;
      needsUpdate = true;
    }
  }

  // 3. Проверяем обязательные поля
  const requiredFields = ['id', 'project_id', 'status', 'character'];
  for (const field of requiredFields) {
    if (!botData[field]) {
      console.log(`  ⚠️  Missing required field: ${field}`);
    }
  }

  return { needsUpdate, updates };
}

/**
 * Главная функция очистки
 */
async function cleanupDatabase() {
  console.log('🚀 Starting database cleanup...\n');

  try {
    // Получаем всех ботов
    const botsRef = ref(database, 'bots');
    const snapshot = await get(botsRef);
    
    if (!snapshot.exists()) {
      console.log('❌ No bots found in database');
      return;
    }

    const bots = snapshot.val();
    const botIds = Object.keys(bots);
    console.log(`📊 Found ${botIds.length} bots\n`);

    let totalUpdates = 0;
    const allUpdates = {};

    // Обрабатываем каждого бота
    for (const botId of botIds) {
      const botData = bots[botId];
      const { needsUpdate, updates } = await cleanupBot(botId, botData);
      
      if (needsUpdate) {
        Object.assign(allUpdates, updates);
        totalUpdates++;
      }
    }

    // Применяем все обновления
    if (totalUpdates > 0) {
      console.log(`\n💾 Applying ${totalUpdates} updates...`);
      await update(ref(database), allUpdates);
      console.log('✅ Database cleanup completed successfully!');
    } else {
      console.log('\n✅ No updates needed - database is clean!');
    }

    // Выводим статистику
    console.log('\n📈 Statistics:');
    console.log(`  - Total bots: ${botIds.length}`);
    console.log(`  - Bots updated: ${totalUpdates}`);
    console.log(`  - Bots unchanged: ${botIds.length - totalUpdates}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Запускаем очистку
cleanupDatabase();
