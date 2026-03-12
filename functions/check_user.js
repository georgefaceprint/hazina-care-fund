const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'hazina-b1cc7' });
const db = admin.firestore();

async function checkUser() {
  const email = 'faceprint@icloud.com';
  const snap = await db.collection('users').where('email', '==', email).get();
  if (snap.empty) {
    console.log('No user found');
    return;
  }
  const data = snap.docs[0].data();
  console.log('User Data:', JSON.stringify(data, null, 2));
}

checkUser();
