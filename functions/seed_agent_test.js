const admin = require("firebase-admin");

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'hazina-b1cc7'
    });
}

const db = admin.firestore();

const seedData = async () => {
    const agentId = "+254722973287";
    console.log(`🌱 Seeding 10 test conversions for Agent: ${agentId}`);

    for (let i = 0; i < 10; i++) {
        const phone = `+25479236011${i}`;
        const userDoc = {
            fullName: `Test Seeding ${i + 1}`,
            phoneNumber: phone,
            role: "user",
            recruited_by: agentId,
            status: "active",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            uid: phone.replace('+', '')
        };

        try {
            // Write to 'users' collection with the phone as the ID
            // This SHOULD trigger the onUserCreated function
            await db.collection("users").doc(phone).set(userDoc);
            console.log(`✅ Seeded: ${phone}`);
        } catch (error) {
            console.error(`❌ Failed to seed ${phone}:`, error.message);
        }
    }
    console.log("🏁 Seeding complete.");
};

seedData();
