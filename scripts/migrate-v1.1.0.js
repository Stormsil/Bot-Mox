/**
 * Миграция базы данных Bot-Mox v1.0.0 → v1.1.0 (V6 Telemetry)
 * 
 * Изменения:
 * 1. Добавление секции telemetry ко всем ботам
 * 2. Создание корневого узла hourly_stats
 * 3. (Опционально) Удаление deprecated полей
 * 
 * Запуск: node scripts/migrate-v1.1.0.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../Assets/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/"
});

const db = admin.database();

// Начальные значения telemetry
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
  
  try {
    // 1. Получаем всех ботов
    console.log('📊 Fetching bots from database...');
    const botsSnapshot = await db.ref('bots').once('value');
    const bots = botsSnapshot.val();
    
    if (!bots) {
      console.log('⚠️ No bots found in database');
      return;
    }
    
    const botIds = Object.keys(bots);
    console.log(`✓ Found ${botIds.length} bot(s)\n`);
    
    const updates = {};
    let botsWithTelemetry = 0;
    let botsWithoutTelemetry = 0;
    
    // 2. Анализируем и добавляем telemetry каждому боту
    for (const [botId, botData] of Object.entries(bots)) {
      const hasTelemetry = botData && botData.telemetry !== undefined;
      
      if (hasTelemetry) {
        console.log(`⏭️  Bot ${botId}: telemetry already exists`);
        botsWithTelemetry++;
      } else {
        console.log(`📝 Bot ${botId}: adding telemetry...`);
        updates[`bots/${botId}/telemetry`] = {
          ...defaultTelemetry,
          last_sync_ts: Date.now() // Устанавливаем текущий timestamp
        };
        botsWithoutTelemetry++;
      }
    }
    
    // 3. Создаем корневой узел hourly_stats (если не существует)
    console.log('\n📊 Checking hourly_stats...');
    const hourlyStatsSnapshot = await db.ref('hourly_stats').once('value');
    if (!hourlyStatsSnapshot.exists()) {
      console.log('📝 Creating hourly_stats root node...');
      updates['hourly_stats'] = {};
    } else {
      console.log('⏭️ hourly_stats already exists');
    }
    
    // 4. Применяем все изменения
    if (Object.keys(updates).length > 0) {
      console.log(`\n📝 Applying ${Object.keys(updates).length} update(s)...`);
      await db.ref().update(updates);
      console.log('✅ Updates applied successfully!');
    } else {
      console.log('\n✅ No updates needed - all bots already have telemetry');
    }
    
    // 5. Сводка
    console.log('\n📋 Migration Summary:');
    console.log(`   • Total bots: ${botIds.length}`);
    console.log(`   • Bots with telemetry: ${botsWithTelemetry}`);
    console.log(`   • Bots updated: ${botsWithoutTelemetry}`);
    console.log(`   • hourly_stats: ${hourlyStatsSnapshot.exists() ? 'already exists' : 'created'}`);
    
    console.log('\n✨ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Закрываем соединение
    await admin.app().delete();
  }
}

// Запуск миграции
migrate();
