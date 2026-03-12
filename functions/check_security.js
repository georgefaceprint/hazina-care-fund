const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'hazina-b1cc7' });
const db = admin.firestore();

async function checkSecurity() {
  const doc = await db.collection('config').doc('security').get();
  if (doc.exists) {
    console.log('Security Config:', JSON.stringify(doc.data(), null, 2));
  } else {
    console.log('Security Config document does not exist.');
  }
}

checkSecurity();
