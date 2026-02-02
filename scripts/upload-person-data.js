const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Initialize Firebase Admin
const serviceAccount = require('../Assets/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/"
});

const db = admin.database();

// Helper function to read CSV file
async function readCSV(filePath) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function uploadPersonData() {
  console.log('Starting upload of person data to Firebase...\n');

  try {
    // Read Ukrainian names
    console.log('Reading Ukrainian names...');
    const ukrainianNames = await readCSV(path.join(__dirname, '..', 'Assets', 'ukrainian_names.csv'));
    console.log(`✓ Loaded ${ukrainianNames.length} Ukrainian names`);

    // Read Ukrainian addresses
    console.log('Reading Ukrainian addresses...');
    const ukrainianAddresses = await readCSV(path.join(__dirname, '..', 'Assets', 'ukraine-address.csv'));
    console.log(`✓ Loaded ${ukrainianAddresses.length} Ukrainian addresses`);

    // Read Turkish names
    console.log('Reading Turkish names...');
    const turkishNames = await readCSV(path.join(__dirname, '..', 'Assets', 'turkish_names.csv'));
    console.log(`✓ Loaded ${turkishNames.length} Turkish names`);

    // Read Turkish addresses
    console.log('Reading Turkish addresses...');
    const turkishAddresses = await readCSV(path.join(__dirname, '..', 'Assets', 'turkey-address.csv'));
    console.log(`✓ Loaded ${turkishAddresses.length} Turkish addresses`);

    // Prepare data structure
    const personData = {
      ukraine: {
        names: ukrainianNames.map(row => ({
          firstName: row['First Name'] || row.firstName,
          lastName: row['Last Name'] || row.lastName
        })),
        addresses: ukrainianAddresses.map(row => ({
          street: row.Street,
          houseNumber: row.HouseNumber,
          locality: row.Locality,
          region: row.Region,
          province: row.Province,
          postalCode: row.PostalCode,
          country: row.Country,
          latitude: row.Latitude,
          longitude: row.Longitude
        }))
      },
      turkey: {
        names: turkishNames.map(row => ({
          firstName: row['First Name'] || row.firstName,
          lastName: row['Last Name'] || row.lastName
        })),
        addresses: turkishAddresses.map(row => ({
          street: row.Street,
          houseNumber: row.HouseNumber,
          locality: row.Locality,
          region: row.Region,
          province: row.Province,
          postalCode: row.PostalCode,
          country: row.Country,
          latitude: row.Latitude,
          longitude: row.Longitude
        }))
      }
    };

    // Upload to Firebase
    console.log('\nUploading to Firebase...');
    await db.ref('person_data').set(personData);

    console.log('\n✅ Person data uploaded successfully!');
    console.log('\nUploaded data:');
    console.log(`  - Ukraine: ${personData.ukraine.names.length} names, ${personData.ukraine.addresses.length} addresses`);
    console.log(`  - Turkey: ${personData.turkey.names.length} names, ${personData.turkey.addresses.length} addresses`);

  } catch (error) {
    console.error('❌ Error uploading person data:', error);
    process.exit(1);
  }

  process.exit(0);
}

uploadPersonData();
