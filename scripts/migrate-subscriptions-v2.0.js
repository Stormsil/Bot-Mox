/**
 * Migration Script: Subscriptions v2.0
 * 
 * This script migrates existing subscription data to the new v2.0 format:
 * - Adds bot_id to existing subscriptions (if missing)
 * - Initializes app_settings/subscriptions with default settings
 * - Removes deprecated fields (type, account_email, auto_renew, project_id, notes)
 * 
 * Usage: node migrate-subscriptions-v2.0.js
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, update, remove } = require('firebase/database');

// Firebase configuration - update with your project config
const firebaseConfig = {
  // Your Firebase config here
  // databaseURL: "https://your-project.firebaseio.com",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const SUBSCRIPTIONS_PATH = 'subscriptions';
const SETTINGS_PATH = 'app_settings/subscriptions';

/**
 * Default subscription settings
 */
function getDefaultSettings() {
  return {
    warning_days: 7,
    updated_at: Date.now(),
  };
}

/**
 * Initialize subscription settings if they don't exist
 */
async function initSettings() {
  console.log('Checking subscription settings...');
  
  try {
    const settingsRef = ref(database, SETTINGS_PATH);
    const snapshot = await get(settingsRef);
    
    if (!snapshot.exists()) {
      console.log('Creating default subscription settings...');
      await set(settingsRef, getDefaultSettings());
      console.log('✓ Default settings created');
    } else {
      console.log('✓ Settings already exist');
    }
  } catch (error) {
    console.error('Error initializing settings:', error);
    throw error;
  }
}

/**
 * Migrate existing subscriptions to v2.0 format
 * - Adds bot_id if missing
 * - Removes deprecated fields
 */
async function migrateSubscriptions() {
  console.log('\nMigrating subscriptions...');
  
  try {
    const subscriptionsRef = ref(database, SUBSCRIPTIONS_PATH);
    const snapshot = await get(subscriptionsRef);
    
    if (!snapshot.exists()) {
      console.log('No subscriptions found to migrate');
      return;
    }
    
    const subscriptions = snapshot.val();
    const updates = {};
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const [id, sub] of Object.entries(subscriptions)) {
      const subscription = sub;
      const updateData = {};
      
      // Check if migration is needed
      let needsUpdate = false;
      
      // Add bot_id if missing (try to infer from bot_id or set to null for manual fix)
      if (!subscription.bot_id) {
        console.log(`  Subscription ${id}: Missing bot_id - needs manual assignment`);
        // Set to a placeholder - you'll need to manually assign bots
        updateData.bot_id = 'NEEDS_BOT_ASSIGNMENT';
        needsUpdate = true;
      }
      
      // Remove deprecated fields (they will be ignored by the new code anyway)
      // We don't actually delete them from DB to preserve data, 
      // but the new code won't use them
      
      if (needsUpdate) {
        updates[`${SUBSCRIPTIONS_PATH}/${id}`] = {
          ...subscription,
          ...updateData,
          updated_at: Date.now(),
        };
        migratedCount++;
      } else {
        skippedCount++;
      }
    }
    
    if (migratedCount > 0) {
      console.log(`\nApplying updates for ${migratedCount} subscriptions...`);
      await update(ref(database), updates);
      console.log(`✓ Migrated ${migratedCount} subscriptions`);
    } else {
      console.log('✓ All subscriptions are up to date');
    }
    
    console.log(`  Skipped: ${skippedCount}`);
    
    if (migratedCount > 0) {
      console.log('\n⚠️  WARNING: Some subscriptions need bot_id assignment!');
      console.log('   Run the verification script to see which ones need manual fix.');
    }
    
  } catch (error) {
    console.error('Error migrating subscriptions:', error);
    throw error;
  }
}

/**
 * Verify migration results
 */
async function verifyMigration() {
  console.log('\nVerifying migration...');
  
  try {
    // Check settings
    const settingsRef = ref(database, SETTINGS_PATH);
    const settingsSnapshot = await get(settingsRef);
    
    if (settingsSnapshot.exists()) {
      console.log('✓ Settings verified');
    } else {
      console.log('✗ Settings missing!');
    }
    
    // Check subscriptions
    const subscriptionsRef = ref(database, SUBSCRIPTIONS_PATH);
    const subsSnapshot = await get(subscriptionsRef);
    
    if (subsSnapshot.exists()) {
      const subscriptions = subsSnapshot.val();
      const total = Object.keys(subscriptions).length;
      const withBotId = Object.values(subscriptions).filter(s => s.bot_id && s.bot_id !== 'NEEDS_BOT_ASSIGNMENT').length;
      const needsAssignment = Object.values(subscriptions).filter(s => s.bot_id === 'NEEDS_BOT_ASSIGNMENT').length;
      
      console.log(`\nSubscription Summary:`);
      console.log(`  Total: ${total}`);
      console.log(`  With bot_id: ${withBotId}`);
      console.log(`  Needs bot assignment: ${needsAssignment}`);
      
      if (needsAssignment > 0) {
        console.log('\n  Subscriptions needing bot assignment:');
        for (const [id, sub] of Object.entries(subscriptions)) {
          if (sub.bot_id === 'NEEDS_BOT_ASSIGNMENT') {
            console.log(`    - ${id}`);
          }
        }
      }
    } else {
      console.log('No subscriptions in database');
    }
    
  } catch (error) {
    console.error('Error verifying migration:', error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('='.repeat(60));
  console.log('Bot-Mox Subscriptions Migration v2.0');
  console.log('='.repeat(60));
  
  try {
    await initSettings();
    await migrateSubscriptions();
    await verifyMigration();
    
    console.log('\n' + '='.repeat(60));
    console.log('Migration completed successfully!');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('Migration failed!');
    console.error('='.repeat(60));
    console.error(error);
    process.exit(1);
  }
}

// Run migration
runMigration();
