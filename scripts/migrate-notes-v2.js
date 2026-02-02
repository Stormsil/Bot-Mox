/**
 * Миграция базы данных Bot-Mox → Notes v2 System
 *
 * Изменения:
 * 1. Создание корневого узла notes_v2 для новой системы заметок
 * 2. Создание корневого узла notes_index для быстрого поиска
 * 3. (Опционально) Миграция старых заметок из секции notes
 *
 * Предварительные требования:
 * - Файл сервисного аккаунта: Assets/firebase-key.json
 * - Node.js установлен
 *
 * Запуск:
 *   node scripts/migrate-notes-v2.js
 *
 * Запуск с миграцией старых заметок:
 *   node scripts/migrate-notes-v2.js --migrate-old-notes
 *
 * Проверка без изменений (dry-run):
 *   node scripts/migrate-notes-v2.js --dry-run
 */

const admin = require('firebase-admin');
const path = require('path');

// ============================================
// Configuration
// ============================================

const CONFIG = {
  // Путь к сервисному аккаунту Firebase
  serviceAccountPath: path.join(__dirname, '..', 'Assets', 'firebase-key.json'),

  // URL базы данных
  databaseURL: "https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/",

  // Корневые пути для новой системы заметок
  notesV2Path: 'notes_v2',
  notesIndexPath: 'notes_index',

  // Путь к старым заметкам (для миграции)
  oldNotesPath: 'notes',
};

// ============================================
// Command Line Arguments
// ============================================

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const MIGRATE_OLD_NOTES = args.includes('--migrate-old-notes');

// ============================================
// Initialize Firebase Admin
// ============================================

console.log('🔧 Initializing Firebase Admin...\n');

try {
  const serviceAccount = require(CONFIG.serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: CONFIG.databaseURL
  });
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:');
  console.error(`   ${error.message}`);
  console.error('\nУбедитесь, что файл Assets/firebase-key.json существует и содержит валидные credentials.');
  process.exit(1);
}

const db = admin.database();

// ============================================
// Utility Functions
// ============================================

/**
 * Генерирует уникальный ID для заметки
 * @returns {string} Уникальный ID
 */
function generateNoteId() {
  return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Генерирует уникальный ID для блока
 * @returns {string} Уникальный ID блока
 */
function generateBlockId() {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Конвертирует старую заметку в формат notes_v2
 * @param {string} oldNoteId - ID старой заметки
 * @param {Object} oldNote - Данные старой заметки
 * @returns {Object} Заметка в формате notes_v2
 */
function convertOldNoteToV2(oldNoteId, oldNote) {
  const now = Date.now();
  const blockId = generateBlockId();

  // Создаем один paragraph блок с текстом старой заметки
  const blocks = {
    [blockId]: {
      id: blockId,
      type: 'paragraph',
      content: oldNote.text || '',
      created_at: oldNote.created_at || now,
      updated_at: oldNote.updated_at || now,
    }
  };

  // Если старая заметка была выполнена, добавляем чекбокс
  if (oldNote.completed) {
    const checkboxBlockId = generateBlockId();
    blocks[checkboxBlockId] = {
      id: checkboxBlockId,
      type: 'checkbox',
      content: 'Задача выполнена',
      checked: true,
      created_at: oldNote.created_at || now,
      updated_at: oldNote.updated_at || now,
    };
  }

  const noteId = generateNoteId();

  return {
    id: noteId,
    title: oldNote.text ? oldNote.text.substring(0, 50) + (oldNote.text.length > 50 ? '...' : '') : 'Мигрированная заметка',
    blocks: blocks,
    tags: oldNote.completed ? ['completed', 'migrated'] : ['migrated'],
    bot_id: oldNote.bot_id || null,
    project_id: null,
    is_pinned: false,
    created_at: oldNote.created_at || now,
    updated_at: oldNote.updated_at || now,
  };
}

/**
 * Генерирует превью текста из блоков
 * @param {Object} blocks - Объект блоков
 * @returns {string} Превью текста (до 100 символов)
 */
function generatePreview(blocks) {
  if (!blocks || Object.keys(blocks).length === 0) {
    return '';
  }

  const blockList = Object.values(blocks).sort((a, b) => a.created_at - b.created_at);
  const text = blockList
    .map(b => {
      if (b.content) return b.content;
      if (b.items && Array.isArray(b.items)) {
        return b.items.map(i => i.content).join(' ');
      }
      return '';
    })
    .join(' ')
    .slice(0, 100);

  return text + (text.length >= 100 ? '...' : '');
}

/**
 * Создает индексную запись для заметки
 * @param {Object} note - Заметка в формате notes_v2
 * @returns {Object} Индексная запись
 */
function createNoteIndex(note) {
  return {
    id: note.id,
    title: note.title,
    preview: generatePreview(note.blocks),
    tags: note.tags || [],
    bot_id: note.bot_id || null,
    project_id: note.project_id || null,
    is_pinned: note.is_pinned || false,
    created_at: note.created_at,
    updated_at: note.updated_at,
  };
}

// ============================================
// Migration Functions
// ============================================

/**
 * Проверяет существование корневых узлов
 * @returns {Promise<Object>} Статус узлов
 */
async function checkExistingNodes() {
  console.log('🔍 Checking existing nodes...\n');

  const [notesV2Snapshot, notesIndexSnapshot, oldNotesSnapshot] = await Promise.all([
    db.ref(CONFIG.notesV2Path).once('value'),
    db.ref(CONFIG.notesIndexPath).once('value'),
    db.ref(CONFIG.oldNotesPath).once('value'),
  ]);

  return {
    notesV2Exists: notesV2Snapshot.exists(),
    notesIndexExists: notesIndexSnapshot.exists(),
    oldNotesExists: oldNotesSnapshot.exists(),
    oldNotesCount: oldNotesSnapshot.exists() ? Object.keys(oldNotesSnapshot.val()).length : 0,
    oldNotesData: oldNotesSnapshot.val(),
  };
}

/**
 * Инициализирует пустую структуру notes_v2 и notes_index
 * @returns {Promise<void>}
 */
async function initializeEmptyStructure() {
  console.log('📝 Initializing empty notes structure...\n');

  if (DRY_RUN) {
    console.log('   [DRY RUN] Would create empty notes_v2 and notes_index nodes');
    return;
  }

  const updates = {};

  // Создаем пустые корневые узлы (Firebase не хранит пустые объекты,
  // поэтому мы просто убеждаемся, что они существуют)
  updates[CONFIG.notesV2Path] = {};
  updates[CONFIG.notesIndexPath] = {};

  await db.ref().update(updates);
  console.log('✅ Empty structure initialized\n');
}

/**
 * Мигрирует старые заметки в новый формат
 * @param {Object} oldNotes - Старые заметки
 * @returns {Promise<Object>} Результат миграции
 */
async function migrateOldNotes(oldNotes) {
  console.log('🔄 Migrating old notes to v2 format...\n');

  if (!oldNotes || Object.keys(oldNotes).length === 0) {
    console.log('   No old notes to migrate\n');
    return { migrated: 0, notes: {} };
  }

  const updates = {};
  const migratedNotes = {};
  let count = 0;

  for (const [oldNoteId, oldNote] of Object.entries(oldNotes)) {
    console.log(`   Processing old note: ${oldNoteId}`);

    const newNote = convertOldNoteToV2(oldNoteId, oldNote);
    const noteIndex = createNoteIndex(newNote);

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would migrate note ${oldNoteId} → ${newNote.id}`);
    } else {
      updates[`${CONFIG.notesV2Path}/${newNote.id}`] = newNote;
      updates[`${CONFIG.notesIndexPath}/${newNote.id}`] = noteIndex;
      migratedNotes[newNote.id] = newNote;
    }

    count++;
  }

  if (!DRY_RUN && Object.keys(updates).length > 0) {
    await db.ref().update(updates);
  }

  console.log(`✅ Migrated ${count} note(s)\n`);
  return { migrated: count, notes: migratedNotes };
}

/**
 * Создает демо-заметку для тестирования
 * @returns {Promise<void>}
 */
async function createDemoNote() {
  console.log('🎨 Creating demo note...\n');

  if (DRY_RUN) {
    console.log('   [DRY RUN] Would create demo note\n');
    return;
  }

  const now = Date.now();
  const noteId = generateNoteId();

  const demoNote = {
    id: noteId,
    title: '🎉 Добро пожаловать в Notes v2!',
    blocks: {
      [`block_${now}_1`]: {
        id: `block_${now}_1`,
        type: 'heading_1',
        content: 'Новая система заметок',
        created_at: now,
        updated_at: now,
      },
      [`block_${now}_2`]: {
        id: `block_${now}_2`,
        type: 'paragraph',
        content: 'Это демо-заметка демонстрирует возможности новой системы. Вы можете создавать заметки с различными типами блоков: заголовки, параграфы, чекбоксы и списки.',
        created_at: now + 1,
        updated_at: now + 1,
      },
      [`block_${now}_3`]: {
        id: `block_${now}_3`,
        type: 'heading_2',
        content: 'Возможности',
        created_at: now + 2,
        updated_at: now + 2,
      },
      [`block_${now}_4`]: {
        id: `block_${now}_4`,
        type: 'bullet_list',
        items: [
          { id: `item_${now}_1`, content: 'Блоковая структура с drag-and-drop' },
          { id: `item_${now}_2`, content: 'Поддержка тегов для организации' },
          { id: `item_${now}_3`, content: 'Привязка к ботам и проектам' },
          { id: `item_${now}_4`, content: 'Закрепление важных заметок' },
        ],
        created_at: now + 3,
        updated_at: now + 3,
      },
      [`block_${now}_5`]: {
        id: `block_${now}_5`,
        type: 'checkbox',
        content: 'Ознакомиться с новой системой заметок',
        checked: true,
        created_at: now + 4,
        updated_at: now + 4,
      },
    },
    tags: ['demo', 'welcome', 'guide'],
    bot_id: null,
    project_id: null,
    is_pinned: true,
    created_at: now,
    updated_at: now,
  };

  const noteIndex = createNoteIndex(demoNote);

  const updates = {
    [`${CONFIG.notesV2Path}/${noteId}`]: demoNote,
    [`${CONFIG.notesIndexPath}/${noteId}`]: noteIndex,
  };

  await db.ref().update(updates);
  console.log(`✅ Demo note created: ${noteId}\n`);
}

/**
 * Проверяет целостность миграции
 * @returns {Promise<Object>} Результат проверки
 */
async function verifyMigration() {
  console.log('🔍 Verifying migration...\n');

  const [notesV2Snapshot, notesIndexSnapshot] = await Promise.all([
    db.ref(CONFIG.notesV2Path).once('value'),
    db.ref(CONFIG.notesIndexPath).once('value'),
  ]);

  const notesV2 = notesV2Snapshot.val() || {};
  const notesIndex = notesIndexSnapshot.val() || {};

  const notesV2Count = Object.keys(notesV2).length;
  const notesIndexCount = Object.keys(notesIndex).length;

  const issues = [];

  // Проверяем соответствие индекса и данных
  for (const noteId of Object.keys(notesV2)) {
    if (!notesIndex[noteId]) {
      issues.push(`Note ${noteId} exists in notes_v2 but missing from notes_index`);
    }
  }

  for (const noteId of Object.keys(notesIndex)) {
    if (!notesV2[noteId]) {
      issues.push(`Note ${noteId} exists in notes_index but missing from notes_v2`);
    }
  }

  // Проверяем структуру заметок
  for (const [noteId, note] of Object.entries(notesV2)) {
    if (!note.id) issues.push(`Note ${noteId} missing 'id' field`);
    if (!note.title) issues.push(`Note ${noteId} missing 'title' field`);
    if (!note.blocks) issues.push(`Note ${noteId} missing 'blocks' field`);
    if (!Array.isArray(note.tags)) issues.push(`Note ${noteId} 'tags' is not an array`);
    if (typeof note.is_pinned !== 'boolean') issues.push(`Note ${noteId} 'is_pinned' is not a boolean`);
  }

  return {
    notesV2Count,
    notesIndexCount,
    isConsistent: notesV2Count === notesIndexCount && issues.length === 0,
    issues,
  };
}

// ============================================
// Main Migration Function
// ============================================

async function migrate() {
  console.log('🚀 Starting Notes v2 Migration\n');
  console.log('=' .repeat(50));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Migrate old notes: ${MIGRATE_OLD_NOTES ? 'YES' : 'NO'}`);
  console.log('=' .repeat(50) + '\n');

  try {
    // 1. Проверяем существующие узлы
    const existingStatus = await checkExistingNodes();

    console.log('📊 Current Status:');
    console.log(`   • notes_v2 exists: ${existingStatus.notesV2Exists ? 'YES' : 'NO'}`);
    console.log(`   • notes_index exists: ${existingStatus.notesIndexExists ? 'YES' : 'NO'}`);
    console.log(`   • old notes exist: ${existingStatus.oldNotesExists ? 'YES' : 'NO'} (${existingStatus.oldNotesCount} notes)`);
    console.log();

    // 2. Инициализируем структуру
    if (!existingStatus.notesV2Exists || !existingStatus.notesIndexExists) {
      await initializeEmptyStructure();
    } else {
      console.log('⏭️  Structure already exists, skipping initialization\n');
    }

    // 3. Мигрируем старые заметки (если запрошено)
    let migrationResult = { migrated: 0 };
    if (MIGRATE_OLD_NOTES && existingStatus.oldNotesExists) {
      migrationResult = await migrateOldNotes(existingStatus.oldNotesData);
    } else if (MIGRATE_OLD_NOTES && !existingStatus.oldNotesExists) {
      console.log('⚠️  Old notes migration requested but no old notes found\n');
    }

    // 4. Создаем демо-заметку (только если нет других заметок)
    const notesV2Snapshot = await db.ref(CONFIG.notesV2Path).once('value');
    const currentNotesCount = notesV2Snapshot.exists() ? Object.keys(notesV2Snapshot.val()).length : 0;

    if (currentNotesCount === 0 && !DRY_RUN) {
      await createDemoNote();
    } else if (currentNotesCount > 0) {
      console.log(`⏭️  Found ${currentNotesCount} existing note(s), skipping demo note\n`);
    }

    // 5. Проверяем миграцию
    const verification = await verifyMigration();

    console.log('📋 Verification Results:');
    console.log(`   • Notes in notes_v2: ${verification.notesV2Count}`);
    console.log(`   • Notes in notes_index: ${verification.notesIndexCount}`);
    console.log(`   • Consistency: ${verification.isConsistent ? '✅ OK' : '❌ ISSUES FOUND'}`);

    if (verification.issues.length > 0) {
      console.log('\n   Issues found:');
      verification.issues.forEach(issue => console.log(`     - ${issue}`));
    }

    // 6. Итоговая сводка
    console.log('\n' + '=' .repeat(50));
    console.log('✨ Migration Summary:');
    console.log('=' .repeat(50));
    console.log(`   • notes_v2 node: ${existingStatus.notesV2Exists ? 'already existed' : 'created'}`);
    console.log(`   • notes_index node: ${existingStatus.notesIndexExists ? 'already existed' : 'created'}`);
    console.log(`   • Old notes migrated: ${migrationResult.migrated}`);
    console.log(`   • Total notes in system: ${verification.notesV2Count}`);
    console.log(`   • Verification: ${verification.isConsistent ? 'PASSED' : 'FAILED'}`);
    console.log('=' .repeat(50));

    if (DRY_RUN) {
      console.log('\n⚠️  This was a DRY RUN. No changes were made to the database.');
      console.log('   Run without --dry-run to apply changes.');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Закрываем соединение
    await admin.app().delete();
  }
}

// ============================================
// Run Migration
// ============================================

migrate();
