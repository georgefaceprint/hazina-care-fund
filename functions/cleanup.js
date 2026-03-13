const admin = require('firebase-admin');

// Initialize with default credentials
// Make sure you have GOOGLE_APPLICATION_CREDENTIALS set or are logged in via gcloud
admin.initializeApp({
  projectId: 'hazina-b1cc7'
});

const db = admin.firestore();

const collections = [
  'users',
  'recruitment_logs',
  'standing_orders',
  'claims',
  'deductions'
];

async function deleteCollection(collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();

  if (snapshot.size === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  // Recurse on the next process tick, to avoid
  // exploding the stack.
  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

async function main() {
  console.log('🚀 Starting environment cleanup...');
  
  for (const collection of collections) {
    console.log(`🧹 Wiping collection: ${collection}...`);
    try {
      await deleteCollection(collection);
      console.log(`✅ ${collection} wiped.`);
    } catch (error) {
      console.error(`❌ Failed to wipe ${collection}:`, error.message);
    }
  }

  console.log('✨ Cleanup complete!');
  process.exit(0);
}

main();
