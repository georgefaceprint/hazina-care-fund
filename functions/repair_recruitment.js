const admin = require("firebase-admin");

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'hazina-b1cc7'
    });
}

const db = admin.firestore();

// Formatter mimics the updated logic in onUserCreated
const formatTo254 = (phoneNumber) => {
    if (!phoneNumber) return "";
    let cleaned = phoneNumber.toString().replace(/\D/g, '');
    if (cleaned.startsWith('254') && cleaned.length === 12) return cleaned;
    if (cleaned.startsWith('0') && cleaned.length === 10) return `254${cleaned.substring(1)}`;
    if (cleaned.length === 9) return `254${cleaned}`;
    return cleaned.startsWith('254') ? cleaned : `254${cleaned}`;
};

const formatToLocal = (phoneNumber) => {
    if (!phoneNumber) return "";
    let cleaned = phoneNumber.toString().replace(/\D/g, '');
    if (cleaned.startsWith('254') && cleaned.length === 12) return `0${cleaned.substring(3)}`;
    if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
        if (cleaned.length === 9) return `0${cleaned}`;
    }
    if (cleaned.startsWith('0') && cleaned.length === 10) return cleaned;
    return cleaned;
};

async function repairRecruitment() {
    console.log("🚀 Starting Global Recruitment Log & Stats Repair...");
    
    // 1. Fetch all users
    const usersSnap = await db.collection("users").get();
    console.log(`Found ${usersSnap.size} total users. Checking recruitment links...`);
    
    let logsCreated = 0;
    let statsFixed = 0;
    let totalSignupsMissing = 0;

    for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        const recruitedByRaw = userData.recruited_by;

        if (!recruitedByRaw) continue;

        // 2. Resolve Agent
        const agentInput = recruitedByRaw.toString().trim().toUpperCase();
        let agentDoc = null;
        
        // Lookup variants
        const lookups = [
            agentInput,
            agentInput.startsWith('+') ? agentInput : `+${formatTo254(agentInput)}`,
            formatToLocal(agentInput)
        ];

        for (const id of [...new Set(lookups)]) {
            const d = await db.collection("users").doc(id).get();
            if (d.exists) {
                agentDoc = d;
                break;
            }
        }

        if (!agentDoc) {
            const snap = await db.collection("users").where("agent_code", "==", agentInput).limit(1).get() || 
                           await db.collection("users").where("phoneNumber", "in", lookups).limit(1).get();
            if (!snap.empty) agentDoc = snap.docs[0];
        }

        if (!agentDoc) {
            console.warn(`⚠️ User ${userId} was recruited by ${agentInput}, but no matching Agent profile was found.`);
            continue;
        }

        const agentData = agentDoc.data();
        const agentId = agentDoc.id;
        
        // Canonical ID for logging (the one the dashboard query uses)
        const logAgentId = /^\d+$/.test(agentId) ? (agentId.startsWith('+') ? agentId : `+${formatTo254(agentId)}`) : agentId.toString().toUpperCase();
        
        // Standardized Log ID
        const logId = `recruitment_${logAgentId}_${userId}`.replace(/[^\w\d_]/g, '');
        const logRef = db.collection("recruitment_logs").doc(logId);
        const logSnap = await logRef.get();

        if (!logSnap.exists) {
            console.log(`✨ Creating missing log: ${logId} (Agent: ${logAgentId}, User: ${userId})`);
            
            const agentTariff = agentData.tariffRate || 15;
            const isMaster = ['master_agent', 'super_master'].includes(agentData.role);
            const commission = isMaster ? 0 : agentTariff;

            // Update Log
            await logRef.set({
                userId,
                userName: userData.fullName || userData.firstName || 'Member',
                tier: userData.active_tier || 'bronze',
                agentId: logAgentId,
                originalAgentInput: recruitedByRaw,
                masterAgentId: agentData.masterAgentId || null,
                superMasterId: agentData.superMasterId || null,
                tariffApplied: agentTariff,
                commissionEarned: commission,
                timestamp: userData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
                repaired: true
            });
            logsCreated++;

            // Update Agent Stats
            // Be careful: only increment if the stats definitely look "zeroed" or missing this entry
            // For safety in this script, we'll increment if the log was missing.
            const updatePayload = {
                totalSignups: admin.firestore.FieldValue.increment(1),
                totalEarnings: admin.firestore.FieldValue.increment(commission),
                walletBalance: admin.firestore.FieldValue.increment(commission),
                lastSignupAt: userData.createdAt || admin.firestore.FieldValue.serverTimestamp()
            };

            await agentDoc.ref.update(updatePayload);
            
            // Also sync to 'agents' or 'master_agents' collections
            const coll = isMaster ? "master_agents" : "agents";
            await db.collection(coll).doc(agentId).set(updatePayload, { merge: true });
            if (agentData.agent_code) await db.collection(coll).doc(agentData.agent_code).set(updatePayload, { merge: true });
            
            statsFixed++;
        }
    }

    console.log(`\n✅ Repair Complete!`);
    console.log(` - Missing Logs Created: ${logsCreated}`);
    console.log(` - Agent Stats Incremented: ${statsFixed}`);
}

repairRecruitment().catch(err => {
    console.error("❌ Repair Script Failed:", err);
    process.exit(1);
});
