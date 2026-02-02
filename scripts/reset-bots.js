/**
 * Скрипт для полного сброса коллекции bots и создания одного бота с указанным ID
 * 
 * Выполняет:
 * 1. Удаление всех существующих ботов
 * 2. Создание одного бота с ID: b8cb5dbf-4587-43af-b804-b45dc934926a
 * 3. Заполнение всех полей согласно DATABASE_SCHEMA.json
 * 
 * Использует сервисный аккаунт из Assets/firebase-key.json
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
const NOW = Date.now();

/**
 * Создает пустое расписание v2
 */
function createEmptySchedule() {
  const emptyDay = () => ({
    enabled: false,
    sessions: []
  });

  const schedule = {
    version: 2,
    timezone: 'Europe/Moscow',
    days: {},
    updated_at: NOW
  };
  
  // Firebase преобразует объекты с числовыми ключами в массивы,
  // поэтому используем строковые ключи
  for (let i = 0; i <= 6; i++) {
    schedule.days[i.toString()] = emptyDay();
  }
  
  return schedule;
}

/**
 * Создает структуру бота согласно DATABASE_SCHEMA.json
 */
function createBotData() {
  return {
    id: BOT_ID,
    project_id: "wow_tbc",
    status: "offline",
    vm: {
      name: "",
      ip: "",
      created_at: ""
    },
    character: {
      name: "",
      level: 1,
      race: "",
      class: "",
      server: "",
      faction: ""
    },
    account: {
      email: "",
      password: "",
      mail_provider: "",
      mail_created_at: 0
    },
    person: {
      first_name: "",
      last_name: "",
      birth_date: "",
      country: "",
      city: "",
      address: "",
      zip: ""
    },
    proxy: {
      full_string: "",
      type: "none",
      ip: "",
      port: 0,
      login: "",
      password: "",
      provider: "",
      country: "",
      fraud_score: 0,
      VPN: false,
      Proxy: false,
      detect_country: false,
      created_at: 0,
      expires_at: 0
    },
    leveling: {
      current_level: 1,
      target_level: 70,
      xp_current: 0,
      xp_required: 0,
      location: "",
      started_at: 0,
      finished_at: 0
    },
    professions: {
      mining: {
        name: "Mining",
        skill_points: 0,
        max_skill_points: 375,
        started_at: 0,
        finished_at: 0
      },
      herbalism: {
        name: "Herbalism",
        skill_points: 0,
        max_skill_points: 375,
        started_at: 0,
        finished_at: 0
      }
    },
    schedule: createEmptySchedule(),
    farm: {
      total_gold: 0,
      session_start: 0,
      location: "",
      profile: "",
      all_farmed_gold: 0
    },
    telemetry: {
      custom_status_code: 1,
      wow_status_code: 0,
      smart_loot_session: 0,
      deaths_session: 0,
      durability_avg: 100,
      bag_slots_free: 0,
      last_sync_ts: 0,
      pixel_block_0_header: "255,0,255",
      pixel_block_12_footer: "0,255,255",
      scan_status: "valid"
    },
    monitor: {
      screenshot_request: false,
      screenshot_url: null,
      screenshot_timestamp: null,
      status: "idle"
    },
    last_seen: 0,
    updated_at: NOW,
    created_at: NOW
  };
}

/**
 * Главная функция сброса
 */
async function resetBots() {
  console.log('🚀 Starting bots reset...\n');

  try {
    // 1. Получаем всех существующих ботов
    const botsRef = database.ref('bots');
    const snapshot = await botsRef.get();
    
    if (snapshot.exists()) {
      const bots = snapshot.val();
      const botIds = Object.keys(bots);
      console.log(`📊 Found ${botIds.length} bots to delete\n`);

      // 2. Удаляем всех ботов
      for (const botId of botIds) {
        console.log(`  🗑️  Deleting bot: ${botId}`);
        await database.ref(`bots/${botId}`).remove();
      }
      console.log('\n✅ All bots deleted\n');
    } else {
      console.log('📭 No existing bots found\n');
    }

    // 3. Создаем нового бота с указанным ID
    console.log(`📝 Creating new bot with ID: ${BOT_ID}`);
    const botData = createBotData();
    await database.ref(`bots/${BOT_ID}`).set(botData);

    console.log('\n✅ Bot created successfully!');
    console.log('\n📋 Bot details:');
    console.log(`  - ID: ${BOT_ID}`);
    console.log(`  - Project: ${botData.project_id}`);
    console.log(`  - Status: ${botData.status}`);
    console.log(`  - Created at: ${new Date(botData.created_at).toISOString()}`);

  } catch (error) {
    console.error('❌ Error during reset:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Запускаем сброс
resetBots();
