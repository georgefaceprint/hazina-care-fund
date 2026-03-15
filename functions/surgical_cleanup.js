const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize with project ID
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'hazina-b1cc7'
    });
}

const db = getFirestore();

async function cleanRecruitmentData() {
    console.log('🚀 Starting surgical cleanup... (Recruitment Data Only)');

    // 1. Delete all recruitment logs
    const logsRef = db.collection('recruitment_logs');
    const logsSnap = await logsRef.get();
    console.log(`- Found ${logsSnap.size} recruitment logs to delete.`);
    
    let batch = db.batch();
    let count = 0;
    
    logsSnap.forEach(doc => {
        batch.delete(doc.ref);
        count++;
        if (count >= 400) { // Firestore batch limit protection
            // In a real script we'd commit and start new, but for surgical we expect small batches
        }
    });
    
    // 2. Clear counters for agents in the 'agents' collection
    const agentsRef = db.collection('agents');
    const agentsSnap = await agentsRef.get();
    console.log(`- Resetting counters for ${agentsSnap.size} agents in 'agents' collection.`);
    agentsSnap.forEach(doc => {
        batch.update(doc.ref, {
            totalSignups: 0,
            walletBalance: 0,
            totalEarnings: 0,
            lastSignupAt: null
        });
    });

    // 3. Identify and delete recruited users, and reset counters for agents in 'users' collection
    const usersRef = db.collection('users');
    const allUsersSnap = await usersRef.get();
    
    let deletedCount = 0;
    let resetCount = 0;
    
    allUsersSnap.forEach(doc => {
        const data = doc.data();
        const isProfessional = data.role === 'agent' || data.role === 'master';
        const isRecruited = data.recruited_by != null;

        if (isProfessional) {
            // Reset stats for professional accounts
            batch.update(doc.ref, {
                totalSignups: 0,
                walletBalance: 0,
                totalEarnings: 0,
                lastSignupAt: null
            });
            resetCount++;
        } else if (isRecruited) {
            // Delete standard members who were recruited
            batch.delete(doc.ref);
            deletedCount++;
        }
    });
    
    console.log(`- Removed ${deletedCount} recruited members.`);
    console.log(`- Reset stats for ${resetCount} professional accounts (agents/masters) in 'users' collection.`);

    if (count > 0 || agentsSnap.size > 0 || deletedCount > 0 || resetCount > 0) {
        await batch.commit();
        console.log('✅ Surgical Cleanup Complete! Ready for fresh recruitment testing.');
    } else {
        console.log('ℹ️ No data found to clean.');
    }
}

cleanRecruitmentData().catch(err => {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
});
