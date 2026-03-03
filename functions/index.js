const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

// 1. Daily Deduction Engine (Cron Job)
// Runs every night at 2:00 AM EAT (+3:00 GMT)
exports.calculateDailyDeduction = onSchedule({
    schedule: "0 2 * * *",
    timeZone: "Africa/Nairobi"
}, async (event) => {
    const usersSnap = await db.collection("users").get();
    const TIER_COSTS = { bronze: 10, silver: 30, gold: 50 };

    const batch = db.batch();

    for (const userDoc of usersSnap.docs) {
        const profile = userDoc.data();
        let totalDeduction = TIER_COSTS[profile.active_tier] || 0;

        // Sum up dependents costs
        const dependentsSnap = await db.collection("dependents")
            .where("guardian_id", "==", userDoc.id)
            .get();

        dependentsSnap.forEach(depDoc => {
            const dep = depDoc.data();
            totalDeduction += TIER_COSTS[dep.active_tier] || 0;
        });

        // Deduct from Balance
        const newBalance = (profile.balance || 0) - totalDeduction;
        batch.update(userDoc.ref, {
            balance: newBalance,
            last_deduction: admin.firestore.FieldValue.serverTimestamp(),
            last_deduction_amount: totalDeduction
        });

        // Log Transaction
        const transRef = db.collection("transactions").doc();
        batch.set(transRef, {
            user_id: userDoc.id,
            amount: -totalDeduction,
            type: "daily-burn",
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    await batch.commit();
    console.log("Daily deductions processed.");
});

// 2. Maturation Status Checker
// Checks for members who have completed their 180-day grace period
exports.checkMaturation = onSchedule({
    schedule: "30 2 * * *",
    timeZone: "Africa/Nairobi"
}, async (event) => {
    const now = new Date();
    const waitingSnap = await db.collection("users")
        .where("status", "==", "in-waiting")
        .get();

    const batch = db.batch();

    waitingSnap.forEach(doc => {
        const profile = doc.data();
        if (profile.grace_period_expiry.toDate() <= now) {
            batch.update(doc.ref, {
                status: "fully-active",
                eligible_tier: profile.active_tier
            });
        }
    });

    await batch.commit();
    console.log("Maturation statuses updated.");
});

// 3. M-Pesa STK Push Initializer (Placeholder)
exports.stkPush = onRequest(async (req, res) => {
    // Logic to trigger Safaricom Daraja STK Push would go here
    // Authentication with Daraja, building the request, and sending to STK Push endpoint.
    res.status(200).send({ message: "STK Push initialized" });
});

// 4. M-Pesa Callback Handler
exports.mpesaCallback = onRequest(async (req, res) => {
    const callbackData = req.body.Body.stkCallback;

    if (callbackData.ResultCode === 0) {
        // Payment successful
        // 1. Get transaction details and amount
        // 2. Identify user by checkoutRequestId
        // 3. Update Firestore balance
    }

    res.status(200).send("Success");
});
