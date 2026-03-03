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

// Environment variables (replace with actual Safaricom Daraja values)
const DARAJA_CONSUMER_KEY = "YOUR_CONSUMER_KEY";
const DARAJA_CONSUMER_SECRET = "YOUR_CONSUMER_SECRET";
const DARAJA_SHORTCODE = "174379"; // sandbox shortcode
const DARAJA_PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"; // sandbox passkey
const CALLBACK_URL = "https://your-region-your-project-id.cloudfunctions.net/mpesaCallback"; // Add actual URL later

async function generateAccessToken() {
    const credentials = Buffer.from(`${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`).toString("base64");
    const response = await axios.get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
        headers: { Authorization: `Basic ${credentials}` }
    });
    return response.data.access_token;
}

// 3. M-Pesa STK Push Initializer
exports.stkPush = onRequest({ cors: true }, async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        const { phoneNumber, amount, userId } = req.body;

        if (!phoneNumber || !amount || !userId) {
            res.status(400).send({ error: "Missing required fields" });
            return;
        }

        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;

        const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, -3);
        const password = Buffer.from(`${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${timestamp}`).toString("base64");

        const token = await generateAccessToken();

        const pushData = {
            BusinessShortCode: DARAJA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: formattedPhone, // phone number making payment
            PartyB: DARAJA_SHORTCODE,
            PhoneNumber: formattedPhone,
            CallBackURL: CALLBACK_URL,
            AccountReference: `Hazina-${userId.substring(0, 5)}`,
            TransactionDesc: "Hazina Care Top Up"
        };

        const response = await axios.post("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", pushData, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // Store checkout request to link the callback
        await db.collection("stk_requests").doc(response.data.CheckoutRequestID).set({
            userId,
            amount: Number(amount),
            status: "pending",
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).send({ success: true, data: response.data });
    } catch (error) {
        console.error("STK Push error: ", error.response?.data || error.message);
        res.status(500).send({ error: "Failed to initiate STK Push" });
    }
});

// 4. M-Pesa Callback Handler
exports.mpesaCallback = onRequest(async (req, res) => {
    try {
        const callbackData = req.body.Body.stkCallback;
        const checkoutRequestId = callbackData.CheckoutRequestID;
        const resultCode = callbackData.ResultCode;

        const requestDocRef = db.collection("stk_requests").doc(checkoutRequestId);
        const requestDoc = await requestDocRef.get();

        if (!requestDoc.exists) {
            console.log(`CheckoutRequestID not found: ${checkoutRequestId}`);
            res.status(200).send("Acknowledged");
            return;
        }

        const requestInfo = requestDoc.data();

        if (resultCode === 0) {
            // Payment successful
            const meta = callbackData.CallbackMetadata.Item;
            const amountItem = meta.find(item => item.Name === "Amount");
            const mpesaReceiptItem = meta.find(item => item.Name === "MpesaReceiptNumber");
            const sourcePhoneItem = meta.find(item => item.Name === "PhoneNumber");

            const amount = amountItem ? amountItem.Value : requestInfo.amount;
            const receipt = mpesaReceiptItem ? mpesaReceiptItem.Value : "UNKNOWN";

            const batch = db.batch();

            // 1. Update STK request
            batch.update(requestDocRef, {
                status: "completed",
                receipt,
                completedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. Add to User Balance
            const userRef = db.collection("users").doc(requestInfo.userId);
            batch.update(userRef, {
                balance: admin.firestore.FieldValue.increment(amount)
            });

            // 3. Log transaction
            const transRef = db.collection("transactions").doc();
            batch.set(transRef, {
                user_id: requestInfo.userId,
                amount,
                type: "top-up",
                method: "mpesa",
                receipt,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            await batch.commit();
            console.log(`Payment successful for user: ${requestInfo.userId}, Amount: ${amount}`);
        } else {
            // Payment failed or cancelled
            await requestDocRef.update({
                status: "failed",
                errorMsg: callbackData.ResultDesc
            });
            console.log(`Payment failed: ${callbackData.ResultDesc}`);
        }

        res.status(200).send("Success");
    } catch (error) {
        console.error("Callback processing error: ", error);
        res.status(200).send("Acknowledged with error");
    }
});
