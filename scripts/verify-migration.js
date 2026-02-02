/**
 * Скрипт проверки миграции v1.1.0
 * Проверяет, что все боты имеют telemetry и hourly_stats создан
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../Assets/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/"
});

const db = admin.database();

async function verifyMigration() {
  console.log('🔍 Verifying migration v1.1.0...\n');
  
  try {
    // 1. Проверяем ботов
    console.log('📊 Checking bots...');
    const botsSnapshot = await db.ref('bots').once('value');
    const bots = botsSnapshot.val();
    
    if (!bots) {
      console.log('❌ No bots found!');
      return;
    }
    
    let botsWithTelemetry = 0;
    let botsWithoutTelemetry = 0;
    const botsMissingTelemetry = [];
    
    for (const [botId, botData] of Object.entries(bots)) {
      if (botData && botData.telemetry) {
        botsWithTelemetry++;
        // Проверяем структуру telemetry
        const telemetry = botData.telemetry;
        const requiredFields = [
          'smart_loot_session',
          'deaths_session',
          'durability_avg',
          'bag_slots_free',
          'last_sync_ts',
          'pixel_block_0_header',
          'pixel_block_12_footer',
          'scan_status'
        ];
        
        const missingFields = requiredFields.filter(f => !(f in telemetry));
        if (missingFields.length > 0) {
          console.log(`⚠️  Bot ${botId}: missing fields: ${missingFields.join(', ')}`);
        }
      } else {
        botsWithoutTelemetry++;
        botsMissingTelemetry.push(botId);
      }
    }
    
    console.log(`✓ Bots with telemetry: ${botsWithTelemetry}`);
    console.log(`✓ Bots without telemetry: ${botsWithoutTelemetry}`);
    
    if (botsMissingTelemetry.length > 0) {
      console.log(`\n⚠️  Bots missing telemetry:`);
      botsMissingTelemetry.forEach(id => console.log(`   - ${id}`));
    }
    
    // 2. Проверяем hourly_stats
    console.log('\n📊 Checking hourly_stats...');
    const hourlyStatsSnapshot = await db.ref('hourly_stats').once('value');
    if (hourlyStatsSnapshot.exists()) {
      console.log('✓ hourly_stats exists');
      const hourlyStats = hourlyStatsSnapshot.val();
      const projectCount = Object.keys(hourlyStats).length;
      console.log(`✓ Projects in hourly_stats: ${projectCount}`);
    } else {
      console.log('❌ hourly_stats does not exist!');
    }
    
    // 3. Пример telemetry
    console.log('\n📋 Sample telemetry data:');
    const sampleBotId = Object.keys(bots)[0];
    if (sampleBotId && bots[sampleBotId].telemetry) {
      console.log(`   Bot: ${sampleBotId}`);
      console.log('   Telemetry:', JSON.stringify(bots[sampleBotId].telemetry, null, 4).replace(/\n/g, '\n   '));
    }
    
    // 4. Итоговый результат
    console.log('\n📊 Verification Summary:');
    console.log(`   • Total bots: ${Object.keys(bots).length}`);
    console.log(`   • Bots with telemetry: ${botsWithTelemetry} ✅`);
    console.log(`   • Bots without telemetry: ${botsWithoutTelemetry} ${botsWithoutTelemetry === 0 ? '✅' : '❌'}`);
    console.log(`   • hourly_stats: ${hourlyStatsSnapshot.exists() ? '✅' : '❌'}`);
    
    if (botsWithoutTelemetry === 0 && hourlyStatsSnapshot.exists()) {
      console.log('\n✨ Migration verified successfully!');
    } else {
      console.log('\n⚠️  Migration incomplete - some issues found');
    }
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

verifyMigration();
