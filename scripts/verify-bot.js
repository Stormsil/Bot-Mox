/**
 * Скрипт для проверки созданного бота
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const path = require('path');

// Путь к сервисному аккаунту
const serviceAccountPath = path.join(__dirname, '..', 'Assets', 'firebase-key.json');
const serviceAccount = require(serviceAccountPath);

// Инициализация Firebase Admin SDK
initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/"
});

const database = getDatabase();

const BOT_ID = 'b8cb5dbf-4587-43af-b804-b45dc934926a';

async function verifyBot() {
  console.log('🔍 Verifying bot in database...\n');

  try {
    const snapshot = await database.ref(`bots/${BOT_ID}`).get();
    
    if (!snapshot.exists()) {
      console.log('❌ Bot not found!');
      process.exit(1);
    }

    const bot = snapshot.val();
    
    console.log('✅ Bot found!\n');
    console.log('📋 Full bot data:');
    console.log(JSON.stringify(bot, null, 2));
    
    // Проверяем структуру
    console.log('\n🔍 Structure validation:');
    const requiredFields = [
      'id', 'project_id', 'status', 'vm', 'character', 
      'account', 'person', 'proxy', 'leveling', 
      'professions', 'schedule', 'farm', 'telemetry', 
      'monitor', 'last_seen', 'updated_at', 'created_at'
    ];
    
    for (const field of requiredFields) {
      const exists = bot[field] !== undefined;
      console.log(`  ${exists ? '✅' : '❌'} ${field}`);
    }
    
    // Проверяем schedule.days структуру
    console.log('\n📅 Schedule days structure:');
    if (bot.schedule && bot.schedule.days) {
      const days = bot.schedule.days;
      if (Array.isArray(days)) {
        console.log('  ⚠️  WARNING: days is an array (should be object with string keys)');
        days.forEach((day, index) => {
          console.log(`    Day ${index}: enabled=${day.enabled}, sessions=${JSON.stringify(day.sessions)}`);
        });
      } else {
        Object.keys(days).forEach(dayKey => {
          const day = days[dayKey];
          console.log(`    Day ${dayKey}: enabled=${day.enabled}, sessions=${JSON.stringify(day.sessions)}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

verifyBot();
