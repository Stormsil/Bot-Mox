/**
 * Миграция лицензий v1.4.0
 * 
 * Преобразует структуру bot_licenses:
 * - bot_id (string | null) -> bot_ids (string[])
 * - Добавляет bot_names (string[])
 * 
 * Запуск: node scripts/migrate-licenses-v1.4.0.js
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, update } = require('firebase/database');

// Firebase конфигурация
const firebaseConfig = {
  // Замените на вашу конфигурацию или используйте переменные окружения
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function migrateLicenses() {
  console.log('Starting license migration v1.4.0...');
  
  try {
    // Получаем все лицензии
    const licensesRef = ref(database, 'bot_licenses');
    const snapshot = await get(licensesRef);
    
    if (!snapshot.exists()) {
      console.log('No licenses found to migrate');
      return;
    }
    
    const licenses = snapshot.val();
    const updates = {};
    let migratedCount = 0;
    
    for (const [licenseId, license] of Object.entries(licenses)) {
      const lic = license;
      
      // Проверяем, нужна ли миграция
      if (lic.bot_ids !== undefined) {
        console.log(`License ${licenseId} already migrated, skipping...`);
        continue;
      }
      
      // Преобразуем bot_id в bot_ids
      const botIds = lic.bot_id ? [lic.bot_id] : [];
      const botNames = lic.bot_id ? [lic.botName || 'Unknown'] : [];
      
      updates[`bot_licenses/${licenseId}/bot_ids`] = botIds;
      updates[`bot_licenses/${licenseId}/bot_names`] = botNames;
      updates[`bot_licenses/${licenseId}/updated_at`] = Date.now();
      
      // Удаляем старое поле (опционально, можно оставить для совместимости)
      // updates[`bot_licenses/${licenseId}/bot_id`] = null;
      // updates[`bot_licenses/${licenseId}/botName`] = null;
      
      migratedCount++;
      console.log(`Migrated license ${licenseId}: bot_id="${lic.bot_id}" -> bot_ids=[${botIds.join(', ')}]`);
    }
    
    if (migratedCount > 0) {
      // Применяем все обновления
      await update(ref(database), updates);
      console.log(`\nMigration completed! ${migratedCount} licenses migrated.`);
    } else {
      console.log('\nNo licenses needed migration.');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Запуск миграции
migrateLicenses();
