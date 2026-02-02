const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../Assets/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/"
});

const db = admin.database();

// Reference data for WoW Classic Anniversary EU TBC
const REFERENCE_DATA = {
  servers: {
    // EU servers
    spineshatter: { id: 'spineshatter', name: 'Spineshatter', region: 'EU', type: 'pvp', language: 'en' },
    thunderstrike: { id: 'thunderstrike', name: 'Thunderstrike', region: 'EU', type: 'pve', language: 'en' },
    // NA servers
    nightslayer: { id: 'nightslayer', name: 'Nightslayer', region: 'NA', type: 'pvp', language: 'en' },
    dreamscythe: { id: 'dreamscythe', name: 'Dreamscythe', region: 'NA', type: 'pve', language: 'en' },
    maladath: { id: 'maladath', name: 'Maladath', region: 'NA', type: 'pvp', language: 'en' }
  },
  races: {
    // Horde
    orc: { id: 'orc', name: 'Orc', faction: 'horde', available_classes: ['warrior', 'hunter', 'rogue', 'shaman', 'warlock'], icon: 'https://wow.zamimg.com/images/wow/icons/large/race_orc_male.jpg' },
    troll: { id: 'troll', name: 'Troll', faction: 'horde', available_classes: ['warrior', 'hunter', 'rogue', 'shaman', 'mage', 'priest'], icon: 'https://wow.zamimg.com/images/wow/icons/large/race_troll_male.jpg' },
    tauren: { id: 'tauren', name: 'Tauren', faction: 'horde', available_classes: ['warrior', 'hunter', 'shaman', 'druid'], icon: 'https://wow.zamimg.com/images/wow/icons/large/race_tauren_male.jpg' },
    undead: { id: 'undead', name: 'Undead', faction: 'horde', available_classes: ['warrior', 'rogue', 'mage', 'warlock', 'priest'], icon: 'https://wow.zamimg.com/images/wow/icons/large/race_undead_male.jpg' },
    blood_elf: { id: 'blood_elf', name: 'Blood Elf', faction: 'horde', available_classes: ['paladin', 'hunter', 'rogue', 'priest', 'mage', 'warlock'], icon: 'https://wow.zamimg.com/images/wow/icons/large/race_bloodelf_male.jpg' },
    // Alliance
    human: { id: 'human', name: 'Human', faction: 'alliance', available_classes: ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'mage', 'warlock'], icon: 'https://wow.zamimg.com/images/wow/icons/large/race_human_male.jpg' },
    dwarf: { id: 'dwarf', name: 'Dwarf', faction: 'alliance', available_classes: ['warrior', 'paladin', 'hunter', 'rogue', 'priest'], icon: 'https://wow.zamimg.com/images/wow/icons/large/race_dwarf_male.jpg' },
    gnome: { id: 'gnome', name: 'Gnome', faction: 'alliance', available_classes: ['warrior', 'rogue', 'mage', 'warlock'], icon: 'https://wow.zamimg.com/images/wow/icons/large/race_gnome_male.jpg' },
    night_elf: { id: 'night_elf', name: 'Night Elf', faction: 'alliance', available_classes: ['warrior', 'hunter', 'rogue', 'priest', 'mage', 'druid'], icon: 'https://wow.zamimg.com/images/wow/icons/large/race_nightelf_male.jpg' },
    draenei: { id: 'draenei', name: 'Draenei', faction: 'alliance', available_classes: ['warrior', 'paladin', 'hunter', 'priest', 'mage', 'shaman'], icon: 'https://wow.zamimg.com/images/wow/icons/large/race_draenei_male.jpg' }
  },
  classes: {
    warrior: { id: 'warrior', name: 'Warrior', role: 'tank', resource: 'rage' },
    paladin: { id: 'paladin', name: 'Paladin', role: 'healer', resource: 'mana' },
    hunter: { id: 'hunter', name: 'Hunter', role: 'dps', resource: 'mana' },
    rogue: { id: 'rogue', name: 'Rogue', role: 'dps', resource: 'energy' },
    priest: { id: 'priest', name: 'Priest', role: 'healer', resource: 'mana' },
    shaman: { id: 'shaman', name: 'Shaman', role: 'healer', resource: 'mana' },
    mage: { id: 'mage', name: 'Mage', role: 'dps', resource: 'mana' },
    warlock: { id: 'warlock', name: 'Warlock', role: 'dps', resource: 'mana' },
    druid: { id: 'druid', name: 'Druid', role: 'healer', resource: 'mana' }
  },
  factions: {
    alliance: { id: 'alliance', name: 'Alliance', icon: '/icons/factions/alliance.png' },
    horde: { id: 'horde', name: 'Horde', icon: '/icons/factions/horde.png' }
  }
};

/**
 * Check if reference data already exists
 * @param {string} projectId - Project ID
 * @param {string} collection - Collection name (servers, races, classes, factions)
 * @returns {Promise<boolean>}
 */
async function checkDataExists(projectId, collection) {
  const snapshot = await db.ref(`projects/${projectId}/referenceData/${collection}`).once('value');
  const data = snapshot.val();
  return data && Object.keys(data).length > 0;
}

/**
 * Upload reference data to Firebase
 * @param {string} projectId - Project ID
 * @param {string} collection - Collection name
 * @param {Object} data - Data to upload
 */
async function uploadCollection(projectId, collection, data) {
  const ref = db.ref(`projects/${projectId}/referenceData/${collection}`);
  await ref.set(data);
  const count = Object.keys(data).length;
  console.log(`  ✓ ${collection}: ${count} entries uploaded`);
}

/**
 * Initialize reference data for a project
 * @param {string} projectId - Project ID
 * @param {Object} options - Options
 * @param {boolean} options.force - Force overwrite existing data
 */
async function initReferenceData(projectId, options = {}) {
  const { force = false } = options;

  console.log(`\n🎮 Initializing reference data for project: ${projectId}`);
  console.log('=' .repeat(50));

  try {
    // Check if project exists
    const projectSnapshot = await db.ref(`projects/${projectId}`).once('value');
    if (!projectSnapshot.exists()) {
      console.error(`❌ Project '${projectId}' does not exist in Firebase`);
      return false;
    }

    console.log(`✓ Project '${projectId}' found`);

    // Process each collection
    const collections = ['servers', 'races', 'classes', 'factions'];
    let uploadedCount = 0;
    let skippedCount = 0;

    for (const collection of collections) {
      const exists = await checkDataExists(projectId, collection);

      if (exists && !force) {
        console.log(`  ⏭️  ${collection}: already exists (use --force to overwrite)`);
        skippedCount++;
        continue;
      }

      if (exists && force) {
        console.log(`  📝 ${collection}: overwriting existing data...`);
      } else {
        console.log(`  📝 ${collection}: uploading...`);
      }

      await uploadCollection(projectId, collection, REFERENCE_DATA[collection]);
      uploadedCount++;
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Reference data initialization complete!`);
    console.log(`   Uploaded: ${uploadedCount} collections`);
    console.log(`   Skipped: ${skippedCount} collections`);

    return true;
  } catch (error) {
    console.error(`\n❌ Error initializing reference data:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔥 Firebase Reference Data Initialization');
  console.log('==========================================\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const projectId = args.find(arg => !arg.startsWith('--')) || 'wow_tbc';
  const force = args.includes('--force');

  console.log(`Project: ${projectId}`);
  console.log(`Force overwrite: ${force ? 'yes' : 'no'}`);

  const success = await initReferenceData(projectId, { force });

  // Close Firebase connection
  await admin.app().delete();

  if (success) {
    console.log('\n🎉 Done!');
    process.exit(0);
  } else {
    console.log('\n💥 Failed!');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for use as module
module.exports = { initReferenceData, REFERENCE_DATA };
