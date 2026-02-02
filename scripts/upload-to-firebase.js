const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../Assets/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/"
});

const db = admin.database();

// Load example data
const exampleDataPath = path.join(__dirname, '..', 'EXAMPLE_DATA.json');
const exampleData = JSON.parse(fs.readFileSync(exampleDataPath, 'utf8'));

// Remove _meta field before upload
const { _meta, ...dataToUpload } = exampleData;

async function uploadData() {
  console.log('Starting upload to Firebase...');
  console.log('Data entities to upload:', Object.keys(dataToUpload).join(', '));

  try {
    // Check if vm-info exists (we should not touch it)
    const vmInfoSnapshot = await db.ref('vm-info').once('value');
    if (vmInfoSnapshot.exists()) {
      console.log('✓ vm-info exists in Firebase - will be preserved');
    }

    // Upload each entity
    for (const [key, value] of Object.entries(dataToUpload)) {
      console.log(`\nUploading ${key}...`);
      await db.ref(key).set(value);
      console.log(`✓ ${key} uploaded successfully`);
    }

    console.log('\n✅ All data uploaded successfully!');
    console.log('\nUploaded entities:');
    Object.keys(dataToUpload).forEach(key => {
      const count = Object.keys(dataToUpload[key]).length;
      console.log(`  - ${key}: ${count} entries`);
    });

  } catch (error) {
    console.error('❌ Error uploading data:', error);
    process.exit(1);
  }

  process.exit(0);
}

uploadData();
