/**
 * Миграция лицензий v1.5.0
 * 
 * Упрощает структуру bot_licenses:
 * - Удаляет bot_names (имена берутся из bots.character.name)
 * - Удаляет устаревшие поля bot_id и botName
 * 
 * Запуск: node scripts/migrate-licenses-v1.5.0.js
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, update } = require('firebase/database');

// Firebase конфигурация
const firebaseConfig = {
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
  console.log('Starting license migration v1.5.0...');
  console.log('This will remove bot_names and old bot_id/botName fields');
  
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
      let needsUpdate = false;
      
      // Удаляем bot_names если есть
      if (lic.bot_names !== undefined) {
        updates[`bot_licenses/${licenseId}/bot_names`] = null;
        needsUpdate = true;
        console.log(`License ${licenseId}: removing bot_names`);
      }
      
      // Удаляем устаревшее поле bot_id если есть
      if (lic.bot_id !== undefined) {
        updates[`bot_licenses/${licenseId}/bot_id`] = null;
        needsUpdate = true;
        console.log(`License ${licenseId}: removing old bot_id`);
      }
      
      // Удаляем устаревшее поле botName если есть
      if (lic.botName !== undefined) {
        updates[`bot_licenses/${licenseId}/botName`] = null;
        needsUpdate = true;
        console.log(`License ${licenseId}: removing old botName`);
      }
      
      // Проверяем что bot_ids существует
      if (lic.bot_ids === undefined) {
        // Если нет bot_ids, но есть bot_id, конвертируем
        const botIds = lic.bot_id ? [lic.bot_id] : [];
        updates[`bot_licenses/${licenseId}/bot_ids`] = botIds;
        needsUpdate = true;
        console.log(`License ${licenseId}: creating bot_ids from bot_id`);
      }
      
      if (needsUpdate) {
        updates[`bot_licenses/${licenseId}/updated_at`] = Date.now();
        migratedCount++;
      } else {
        console.log(`License ${licenseId} already clean, skipping...`);
      }
    }
    
    if (migratedCount > 0) {
      // Применяем все обновления
      await update(ref(database), updates);
      console.log(`\nMigration completed! ${migratedCount} licenses migrated.`);
      console.log('bot_names, bot_id, and botName fields have been removed.');
      console.log('Bot names are now fetched from bots.character.name');
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
