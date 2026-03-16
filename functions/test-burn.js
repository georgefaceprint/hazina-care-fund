const admin = require("firebase-admin");

// Initialize Firebase Admin (Assuming you are running this in an authenticated environment or have GOOGLE_APPLICATION_CREDENTIALS)
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'hazina-b1cc7'
    });
}

const db = admin.firestore();

/**
 * Get the daily cost for a specific tier
 */
const getTierCost = async (tier) => {
    if (!tier) return 0;
    const tierConfigSnap = await db.collection("config").doc("tiers").get();
    const TIER_CONFIG = tierConfigSnap.exists ? tierConfigSnap.data() : {
        bronze: { cost: 50 },
        silver: { cost: 147 },
        gold: { cost: 229 }
    };
    const normalized = tier.toLowerCase();
    return TIER_CONFIG[normalized]?.cost || TIER_CONFIG[tier]?.cost || 0;
};

/**
 * Calculate total daily burn for a user and their dependents
 */
const calculateUserBurn = async (userId) => {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
        console.log(`❌ User ${userId} not found.`);
        return 0;
    }
    
    const profile = userDoc.data();
    let selfCost = await getTierCost(profile.active_tier || 'bronze');
    let total = selfCost;
    
    console.log(`\n--- Burn Calculation for ${profile.firstName || 'User'} (${userId}) ---`);
    console.log(`- Base Tier (${profile.active_tier || 'bronze'}): KES ${selfCost}`);
    
    // Sum dependents
    const dependentsSnap = await db.collection("dependents")
        .where("guardian_id", "==", userId)
        .get();
    
    if (dependentsSnap.empty) {
        console.log(`- No dependents found.`);
    } else {
        console.log(`- Dependents (${dependentsSnap.size}):`);
        for (const depDoc of dependentsSnap.docs) {
            const dep = depDoc.data();
            const cost = await getTierCost(dep.active_tier || 'bronze');
            console.log(`  * ${dep.firstName || 'Dependent'} (${dep.active_tier || 'bronze'}): KES ${cost}`);
            total += cost;
        }
    }
    
    console.log(`\n🔥 TOTAL DAILY BURN: KES ${total}`);
    console.log(`------------------------------------------\n`);
    
    return total;
};

// Replace with a valid userId from your Firestore to test
let testUserId = process.argv[2];

async function run() {
    if (!testUserId) {
        console.log("No userId provided. Looking for a test user...");
        const snap = await db.collection("users").limit(1).get();
        if (snap.empty) {
            console.log("❌ No users found in database.");
            process.exit(1);
        }
        testUserId = snap.docs[0].id;
    }
    await calculateUserBurn(testUserId);
}

run().catch(err => console.error("Error:", err));
