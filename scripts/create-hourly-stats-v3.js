/**
 * Скрипт создания корневого узла hourly_stats в Firebase
 * Версия 3 - создаем с placeholder данными
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../Assets/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/"
});

const db = admin.database();

async function createHourlyStats() {
  console.log('🚀 Creating hourly_stats node (v3)...\n');
  
  try {
    // Проверяем существует ли уже hourly_stats
    const hourlyStatsSnapshot = await db.ref('hourly_stats').once('value');
    
    if (hourlyStatsSnapshot.exists()) {
      console.log('⏭️ hourly_stats already exists');
    } else {
      // Создаем узел hourly_stats с placeholder
      // Firebase не хранит пустые объекты, поэтому добавляем placeholder
      const placeholderData = {
        _meta: {
          description: "Hourly statistics collection",
          created_at: Date.now(),
          version: "1.0.0"
        }
      };
      
      await db.ref('hourly_stats').set(placeholderData);
      console.log('✅ hourly_stats node created successfully!');
    }
    
    // Проверяем результат
    const checkSnapshot = await db.ref('hourly_stats').once('value');
    console.log('\n📊 Verification:');
    console.log('   Exists:', checkSnapshot.exists());
    console.log('   Value:', JSON.stringify(checkSnapshot.val(), null, 2));
    
    console.log('\n✨ Done!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

createHourlyStats();
