/**
 * Скрипт создания корневого узла hourly_stats в Firebase
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
  console.log('🚀 Creating hourly_stats node...\n');
  
  try {
    // Проверяем существует ли уже hourly_stats
    const hourlyStatsSnapshot = await db.ref('hourly_stats').once('value');
    
    if (hourlyStatsSnapshot.exists()) {
      console.log('⏭️ hourly_stats already exists');
      const hourlyStats = hourlyStatsSnapshot.val();
      const projectCount = Object.keys(hourlyStats).length;
      console.log(`✓ Projects in hourly_stats: ${projectCount}`);
    } else {
      // Создаем пустой узел hourly_stats
      await db.ref('hourly_stats').set({});
      console.log('✅ hourly_stats node created successfully!');
    }
    
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
