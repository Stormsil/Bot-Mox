/**
 * Проверка наличия hourly_stats
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../Assets/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/"
});

const db = admin.database();

async function checkHourlyStats() {
  console.log('🔍 Checking hourly_stats...\n');
  
  try {
    // Получаем корень базы данных
    const rootSnapshot = await db.ref().once('value');
    const root = rootSnapshot.val();
    
    console.log('📋 Root keys:', Object.keys(root || {}).join(', '));
    console.log('');
    
    // Проверяем hourly_stats
    if (root && root.hourly_stats !== undefined) {
      console.log('✅ hourly_stats exists');
      console.log('📊 Value:', JSON.stringify(root.hourly_stats, null, 2));
    } else {
      console.log('❌ hourly_stats does not exist in root');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await admin.app().delete();
  }
}

checkHourlyStats();
