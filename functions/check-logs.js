const admin = require("firebase-admin");

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'hazina-b1cc7'
    });
}

const db = admin.firestore();

async function checkLogs(agentInput) {
    console.log(`\n🔍 Searching logs for Agent ID: ${agentInput}`);
    
    // Check various casing/formats
    const idsToSearch = [
        agentInput.toUpperCase(),
        agentInput.toLowerCase(),
        agentInput
    ];

    const logsRef = db.collection("recruitment_logs");
    
    for (const id of [...new Set(idsToSearch)]) {
        console.log(`Checking matching agentId: ${id}...`);
        const q = await logsRef.where("agentId", "==", id).get();
        if (!q.empty) {
            console.log(`✅ Found ${q.size} logs for ${id}!`);
            q.forEach(doc => {
                const data = doc.data();
                console.log(` - Member: ${data.userName} (${data.userId}) | Date: ${data.timestamp?.toDate().toLocaleString()}`);
            });
        } else {
            console.log(`❌ No logs found for ${id}`);
        }
    }

    // List last 3 total logs regardless of agent
    console.log("\n📋 Last 3 global recruitment logs:");
    const globalQ = await logsRef.orderBy("timestamp", "desc").limit(3).get();
    globalQ.forEach(doc => {
        const data = doc.data();
        console.log(` - Agent: ${data.agentId} | Member: ${data.userName} | Date: ${data.timestamp?.toDate().toLocaleString()}`);
    });
}

const input = process.argv[2];
if (!input) {
    console.log("Usage: node functions/check-logs.js <AGENT_CODE_OR_PHONE>");
} else {
    checkLogs(input).catch(console.error);
}
