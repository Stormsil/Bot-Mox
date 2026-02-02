/**
 * Миграция: Добавление поля faction к существующим ботам
 * 
 * Логика миграции:
 * - Horde расы: orc, troll, tauren, undead, blood_elf → faction: 'horde'
 * - Alliance расы: human, dwarf, gnome, night_elf, draenei → faction: 'alliance'
 * - Если раса не указана или неизвестна → faction: null
 * 
 * Запуск:
 *   node scripts/migrate-add-faction.js           # Выполнить миграцию
 *   node scripts/migrate-add-faction.js --dry-run # Только предварительный просмотр
 */

const admin = require('firebase-admin');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Initialize Firebase Admin
const serviceAccount = require('../Assets/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/"
});

const db = admin.database();

// Определение фракций по расам
const RACE_TO_FACTION = {
  // Horde
  'orc': 'horde',
  'troll': 'horde',
  'tauren': 'horde',
  'undead': 'horde',
  'blood_elf': 'horde',
  
  // Alliance
  'human': 'alliance',
  'dwarf': 'alliance',
  'gnome': 'alliance',
  'night_elf': 'alliance',
  'draenei': 'alliance'
};

/**
 * Определяет фракцию на основе расы
 * @param {string} race - ID расы
 * @returns {string|null} - фракция или null если раса неизвестна
 */
function getFactionByRace(race) {
  if (!race) return null;
  const normalizedRace = race.toLowerCase().trim();
  return RACE_TO_FACTION[normalizedRace] || null;
}

async function migrate() {
  console.log('🚀 Starting migration: Add faction field to bots\n');
  
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be applied\n');
  }
  
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
    
    // Статистика
    const stats = {
      total: botIds.length,
      updated: 0,
      skipped: 0,
      errors: 0,
      byFaction: {
        horde: 0,
        alliance: 0,
        null: 0
      }
    };
    
    const updates = {};
    const details = [];
    
    // 2. Анализируем каждого бота
    for (const [botId, botData] of Object.entries(bots)) {
      try {
        const character = botData?.character || {};
        const existingFaction = character.faction;
        const race = character.race;
        
        // Проверяем, есть ли уже поле faction
        if (existingFaction !== undefined) {
          console.log(`⏭️  Bot ${botId}: faction already exists (${existingFaction})`);
          stats.skipped++;
          details.push({
            botId,
            action: 'skipped',
            reason: 'faction already exists',
            race,
            existingFaction
          });
          continue;
        }
        
        // Определяем фракцию по расе
        const faction = getFactionByRace(race);
        
        if (isDryRun) {
          console.log(`🔍 Bot ${botId}: would add faction="${faction}" (race="${race}")`);
        } else {
          console.log(`📝 Bot ${botId}: adding faction="${faction}" (race="${race}")`);
          updates[`bots/${botId}/character/faction`] = faction;
        }
        
        stats.updated++;
        stats.byFaction[faction || 'null']++;
        details.push({
          botId,
          action: isDryRun ? 'would_update' : 'updated',
          race,
          faction
        });
        
      } catch (error) {
        console.error(`❌ Bot ${botId}: error - ${error.message}`);
        stats.errors++;
        details.push({
          botId,
          action: 'error',
          error: error.message
        });
      }
    }
    
    // 3. Применяем изменения (если не dry-run)
    if (!isDryRun && Object.keys(updates).length > 0) {
      console.log(`\n📝 Applying ${Object.keys(updates).length} update(s)...`);
      await db.ref().update(updates);
      console.log('✅ Updates applied successfully!');
    } else if (isDryRun) {
      console.log(`\n🔍 Dry run complete - ${stats.updated} bot(s) would be updated`);
    } else {
      console.log('\n✅ No updates needed - all bots already have faction field');
    }
    
    // 4. Выводим статистику
    console.log('\n' + '='.repeat(50));
    console.log('📋 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`   Total bots:      ${stats.total}`);
    console.log(`   Updated:         ${stats.updated}`);
    console.log(`   Skipped:         ${stats.skipped}`);
    console.log(`   Errors:          ${stats.errors}`);
    console.log('');
    console.log('   Faction distribution:');
    console.log(`     • Horde:       ${stats.byFaction.horde}`);
    console.log(`     • Alliance:    ${stats.byFaction.alliance}`);
    console.log(`     • Unknown:     ${stats.byFaction.null}`);
    console.log('='.repeat(50));
    
    // 5. Выводим детали (если есть ошибки или unknown фракции)
    if (stats.errors > 0 || stats.byFaction.null > 0) {
      console.log('\n⚠️  Details:');
      const problematicBots = details.filter(d => 
        d.action === 'error' || 
        (d.action === 'updated' && d.faction === null) ||
        (d.action === 'would_update' && d.faction === null)
      );
      
      for (const detail of problematicBots) {
        if (detail.error) {
          console.log(`   ❌ ${detail.botId}: ${detail.error}`);
        } else if (detail.faction === null) {
          console.log(`   ⚠️  ${detail.botId}: unknown race "${detail.race}"`);
        }
      }
    }
    
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
