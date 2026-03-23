require('dotenv').config();

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");
const { authenticator } = require("otplib");
const bcrypt = require("bcryptjs");



const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();
const db = admin.firestore();

/**
 * Internal helper for robust user lookup by UID.
 * Handles cases where doc ID is UID or something else (like phone).
 */
const fetchUserDoc = async (uid, auth = null) => {
    if (!uid) return null;
    let doc = await db.collection("users").doc(uid).get();
    if (doc.exists) return doc;
    
    let snap = await db.collection("users").where("uid", "==", uid).limit(1).get();
    if (!snap.empty) return snap.docs[0];

    // Fallback: search by phone number if available in auth context
    const phone = auth?.token?.phone_number;
    if (phone) {
        // Try normalized phone field
        snap = await db.collection("users").where("phoneNumber", "==", phone).limit(1).get();
        if (!snap.empty) return snap.docs[0];

        // Try direct doc ID as phone
        doc = await db.collection("users").doc(phone).get();
        if (doc.exists) return doc;
    }
    
    return null;
};

/**
 * Standardizes phone numbers to 254... format for SasaPay
 */
const formatTo254 = (phoneNumber) => {
    if (!phoneNumber) return "";
    let cleaned = phoneNumber.toString().replace(/\D/g, '');
    if (cleaned.startsWith('254') && cleaned.length === 12) {
        return cleaned;
    }
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        return `254${cleaned.substring(1)}`;
    }
    if (cleaned.length === 9) {
        return `254${cleaned}`;
    }
    return cleaned.startsWith('254') ? cleaned : `254${cleaned}`;
};

/**
 * Centralized test number check for OTP bypass (123456)
 */
const isTestNumber = (phoneNumber) => {
    if (!phoneNumber) return false;
    const formatPhone = formatTo254(phoneNumber);
    const testList = ['254755881991', '254105845108', '254793717860'];
    // Range prefix check: 07923600... (2547923600...) or 07923601... (2547923601...)
    if (formatPhone.startsWith('2547923600') || formatPhone.startsWith('2547923601') || formatPhone.startsWith('2547923602')) {
        return true;
    }
    return testList.some(tn => formatPhone.includes(tn));
};

const formatToLocal = (phoneNumber) => {
    if (!phoneNumber) return "";
    let cleaned = phoneNumber.toString().replace(/\D/g, '');
    if (cleaned.startsWith('254') && cleaned.length === 12) {
        return `0${cleaned.substring(3)}`;
    }
    if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
        if (cleaned.length === 9) return `0${cleaned}`;
    }
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        return cleaned;
    }
    return cleaned;
};

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
const calculateUserBurn = async (userId, profile) => {
    if (!profile) return 0;
    let total = await getTierCost(profile.active_tier || 'bronze');
    
    // Sum dependents
    const dependentsSnap = await db.collection("dependents")
        .where("guardian_id", "==", userId)
        .get();
    
    for (const depDoc of dependentsSnap.docs) {
        const dep = depDoc.data();
        const cost = await getTierCost(dep.active_tier || 'bronze');
        total += cost;
    }
    
    return total;
};

/**
 * Finds the latest active or pending standing order for a user
 */
const getActiveStandingOrder = async (userId) => {
    const snap = await db.collection("standing_orders")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
    
    if (snap.empty) return null;
    return snap.docs[0].data();
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCaAkDtu93ADVaDE0hy0MCK1n9E8ksUdN0";

if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    console.error("❌ ERROR: GEMINI_API_KEY is not set. Using fallback (if provided).");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");

// 1. Daily Deduction Engine (Cron Job)

// Runs every night at 2:00 AM EAT (+3:00 GMT)
exports.calculateDailyDeduction = onSchedule({
    schedule: "0 2 * * *",
    timeZone: "Africa/Nairobi"
}, async (event) => {
    try {
        // 1. Fetch Tier Config from DB (Fix for hardcoded discrepancy)
        const tierConfigSnap = await db.collection("config").doc("tiers").get();
        const TIER_CONFIG = tierConfigSnap.exists ? tierConfigSnap.data() : {
            bronze: { cost: 50 },
            silver: { cost: 147 },
            gold: { cost: 229 }
        };

        const getCost = (tier) => {
            if (!tier) return 0;
            const normalized = tier.toLowerCase();
            return TIER_CONFIG[normalized]?.cost || TIER_CONFIG[tier]?.cost || 0;
        };

        console.log("⚡ Starting daily deduction engine with synced tiers:", JSON.stringify(TIER_CONFIG));

        const usersSnap = await db.collection("users").get();
        let batch = db.batch();
        let opCount = 0;
        const BATCH_LIMIT = 450; // Firestore limit is 500, we use 450 for safety margin

        const commitBatch = async () => {
            if (opCount > 0) {
                await batch.commit();
                console.log(`📦 Committed batch of ${opCount} operations.`);
                batch = db.batch();
                opCount = 0;
            }
        };

        for (const userDoc of usersSnap.docs) {
            const profile = userDoc.data();
            let totalDeduction = getCost(profile.active_tier);

            // Sum up dependents costs
            const dependentsSnap = await db.collection("dependents")
                .where("guardian_id", "==", userDoc.id)
                .get();

            dependentsSnap.forEach(depDoc => {
                const dep = depDoc.data();
                totalDeduction += getCost(dep.active_tier);
            });

            // Check for Payment Holiday
            const holidayUntil = profile.payment_holiday_until?.toDate();
            if (holidayUntil && holidayUntil > new Date()) {
                console.log(`User ${userDoc.id} is on payment holiday until ${holidayUntil}`);
                continue;
            }

            if (totalDeduction <= 0) continue;

            // Deduct from Balance
            const newBalance = (profile.balance || 0) - totalDeduction;
            const now = admin.firestore.FieldValue.serverTimestamp();

            if (newBalance < 0) {
                const lastNegativeAt = profile.negative_since ? new Date(profile.negative_since._seconds * 1000) : null;
                const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

                if (lastNegativeAt && lastNegativeAt < fortyEightHoursAgo) {
                    batch.update(userDoc.ref, { 
                        balance: newBalance,
                        status: 'lapsed',
                        updatedAt: now,
                        last_deduction: now,
                        last_deduction_amount: totalDeduction
                    });
                } else if (!profile.negative_since) {
                    batch.update(userDoc.ref, { 
                        balance: newBalance,
                        negative_since: now,
                        updatedAt: now,
                        last_deduction: now,
                        last_deduction_amount: totalDeduction
                    });
                } else {
                    batch.update(userDoc.ref, { 
                        balance: newBalance,
                        updatedAt: now,
                        last_deduction: now,
                        last_deduction_amount: totalDeduction
                    });
                }
            } else {
                batch.update(userDoc.ref, { 
                    balance: newBalance,
                    negative_since: null,
                    status: profile.status === 'lapsed' ? 'fully-active' : profile.status,
                    updatedAt: now,
                    last_deduction: now,
                    last_deduction_amount: totalDeduction
                });
            }
            opCount++;

            // Log Transaction
            const transRef = db.collection("transactions").doc();
            batch.set(transRef, {
                user_id: userDoc.id,
                amount: -totalDeduction,
                type: "daily-burn",
                timestamp: now
            });
            opCount++;

            // Update global analytics
            const statsRef = db.collection("totals").doc("liquidity");
            batch.set(statsRef, {
                total_fund: admin.firestore.FieldValue.increment(-totalDeduction),
                total_burn: admin.firestore.FieldValue.increment(totalDeduction),
                last_updated: now
            }, { merge: true });
            opCount++;

            // Check if we need to commit this batch
            if (opCount >= BATCH_LIMIT) {
                await commitBatch();
            }
        }

        // Final commit for remaining operations
        await commitBatch();
        console.log("✅ Daily deductions processed successfully.");
    } catch (error) {
        console.error("❌ Critical error in calculateDailyDeduction:", error);
    }
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

// --- 3. SasaPay Configuration (Kenya) ---
const SASAPAY_CLIENT_ID = process.env.SASAPAY_CLIENT_ID || 'B1tnESQjLEyaGAG9KXf7Og9vf7DLDpfL1Fkc7sgZ';
const SASAPAY_CLIENT_SECRET = process.env.SASAPAY_CLIENT_SECRET || 'aqRafb6tWAjw0MWVCllHIsk7AygSKylMwPR81VaoeevldIScPFx8qPX2GySaVvcBEwxbkgWGOZmsmcMlgfP41T8PXha4sEPCx7PUI6QX2as1lXr1CWK6RadskX9RpRzN';

const SASAPAY_MERCHANT_CODE = process.env.SASAPAY_MERCHANT_CODE || '600980'; // Reverted to sandbox code
const SASAPAY_BASE_URL = 'https://sandbox.sasapay.app/api/v1'; // Sandbox URL

// Helper to get SasaPay Access Token
const getSasapayToken = async () => {
    try {
        const auth = Buffer.from(`${SASAPAY_CLIENT_ID}:${SASAPAY_CLIENT_SECRET}`).toString('base64');
        const response = await axios.get(`${SASAPAY_BASE_URL}/auth/token/?grant_type=client_credentials`, {
            headers: { Authorization: `Basic ${auth}` }
        });

        return response.data.access_token;
    } catch (error) {
        console.error("SasaPay Auth Error:", error.response?.data || error.message);
        throw new Error("Failed to authenticate with SasaPay");
    }
};

// Internal Helper to initiate SasaPay C2B
// Core logic for Standing Order (reusable by USSD and Cloud Functions)
async function performStandingOrderSetup(userId, amount, frequency, phoneNumber, networkCode = "63902") {
    const token = await getSasapayToken();
    const callbackUrl = "https://sasapaycallback-l5mloh4jka-uc.a.run.app";
    const merchantRequestID = `SO-${Date.now()}-${userId.substring(0, 5)}`;

    const payload = {
        MerchantCode: SASAPAY_MERCHANT_CODE,
        NetworkCode: networkCode,
        Amount: amount.toString(),
        Currency: "KES",
        PhoneNumber: formatTo254(phoneNumber),
        CallBackURL: callbackUrl,
        TransactionDesc: `Hazina M-Pesa Ratiba`,
        AccountReference: `HAZINA-RATIBA-${userId.substring(0, 8)}`,
        Frequency: frequency.toUpperCase(), // DAILY, WEEKLY, MONTHLY
        MerchantRequestID: merchantRequestID
    };

    const response = await axios.post(`${SASAPAY_BASE_URL}/payments/request-payment/`, payload, {
        headers: { Authorization: `Bearer ${token}` }
    });

    // Save record for callback tracking
    await db.collection("standing_orders").doc(merchantRequestID).set({
        userId,
        amount,
        frequency: frequency.toUpperCase(),
        phoneNumber,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, detail: response.data.detail || "Standing order request initiated", merchantRequestID };
}

const initiateSasapayC2B = async (phoneNumber, amount, userId, networkCode = "63902") => {
    const formattedPhone = formatTo254(phoneNumber);

    const token = await getSasapayToken();
    const callbackUrl = "https://sasapaycallback-l5mloh4jka-uc.a.run.app";



    const payload = {
        MerchantCode: SASAPAY_MERCHANT_CODE,
        NetworkCode: networkCode,
        "Transaction Fee": 0,
        Currency: "KES",
        Amount: amount.toString(),
        CallBackURL: callbackUrl,
        PhoneNumber: formattedPhone,
        TransactionDesc: "Hazina Wallet Top Up",
        AccountReference: `Hazina-${userId.substring(0, 5)}`
    };

    const response = await axios.post(`${SASAPAY_BASE_URL}/payments/request-payment/`, payload, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (response.data.status) {
        await admin.firestore().collection("stk_requests").doc(response.data.CheckoutRequestID).set({
            userId,
            amount: Number(amount),
            status: "pending",
            gateway: "SasaPay",
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    return response.data;
};

// 4. SasaPay C2B Request Payment
exports.sasapayC2B = onRequest({
    cors: true,
}, async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        const { phoneNumber, amount, userId, networkCode } = req.body;

        if (!phoneNumber || !amount || !userId) {
            res.status(400).send({ error: "Missing required fields: phoneNumber, amount, or userId" });
            return;
        }

        const result = await initiateSasapayC2B(phoneNumber, amount, userId, networkCode);

        if (result.status) {
            res.status(200).send({ success: true, data: result });
        } else {
            res.status(400).send({ error: result.detail || "SasaPay request failed" });
        }
    } catch (error) {
        console.error("SasaPay C2B Error: ", error.response?.data || error.message);
        const errorMsg = error.response?.data?.detail || error.message || "Failed to initiate SasaPay payment";
        res.status(500).send({ error: `SasaPay API Error: ${errorMsg}` });
    }
});



// 5. Manual Deduction (For Testing/Demo)
exports.manualDeduction = onCall(async (request) => {
    // In production, you would check auth here: if (!request.auth) throw new HttpsError('unauthenticated', '...');
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'User must be logged in.');

    // Find user by UID (Admin) or by phone (Regular)
    const usersSnap = await db.collection("users").where("uid", "==", uid).limit(1).get();
    if (usersSnap.empty) throw new HttpsError('not-found', 'User record not found.');

    const userDoc = usersSnap.docs[0];
    const profile = userDoc.data();

    // Fetch Tier Config from DB
    const tierConfigSnap = await db.collection("config").doc("tiers").get();
    const TIER_CONFIG = tierConfigSnap.exists ? tierConfigSnap.data() : {
        bronze: { cost: 50 },
        silver: { cost: 147 },
        gold: { cost: 229 }
    };

    const getCost = (tier) => {
        if (!tier) return 0;
        const normalized = tier.toLowerCase();
        return TIER_CONFIG[normalized]?.cost || TIER_CONFIG[tier]?.cost || 0;
    };

    let totalDeduction = getCost(profile.active_tier);

    // Sum up dependents costs
    const dependentsSnap = await db.collection("dependents")
        .where("guardian_id", "==", userDoc.id)
        .get();

    dependentsSnap.forEach(depDoc => {
        const dep = depDoc.data();
        totalDeduction += getCost(dep.active_tier);
    });

    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Deduct from Balance
    const newBalance = (profile.balance || 0) - totalDeduction;
    batch.update(userDoc.ref, {
        balance: newBalance,
        last_deduction: now,
        last_deduction_amount: totalDeduction
    });

    // Log Transaction
    const transRef = db.collection("transactions").doc();
    batch.set(transRef, {
        user_id: userDoc.id,
        amount: -totalDeduction,
        type: "daily-burn",
        timestamp: now
    });

    // Update global analytics
    const statsRef = db.collection("totals").doc("liquidity");
    batch.set(statsRef, {
        total_fund: admin.firestore.FieldValue.increment(-totalDeduction),
        total_burn: admin.firestore.FieldValue.increment(totalDeduction),
        last_updated: now
    }, { merge: true });

    await batch.commit();
    return { success: true, newBalance, deduction: totalDeduction };
});

// 5. SasaPay Callback Handler (Unified)
exports.sasapayCallback = onRequest(async (req, res) => {
    try {
        console.log("SasaPay Callback Received:", JSON.stringify(req.body));
        const {
            ResultCode,
            ResultDesc,
            MerchantRequestID,
            CheckoutRequestID,
            Amount,
            TransactionID,
            SubscriptionID, // For Standing Orders
        } = req.body;

        if (ResultCode === 0 || ResultCode === "0") {
            // Find request info from transactions or standing_orders collection
            let requestInfo = null;
            let isStandingOrder = !!SubscriptionID;

            if (isStandingOrder) {
                const soSnap = await db.collection("standing_orders").doc(MerchantRequestID || SubscriptionID).get();
                if (soSnap.exists) requestInfo = soSnap.data();
            } else {
                const requestDocRef = db.collection("stk_requests").doc(MerchantRequestID || CheckoutRequestID);
                const requestDoc = await requestDocRef.get();
                if (requestDoc.exists) requestInfo = requestDoc.data();
            }

            if (!requestInfo) {
                console.warn("No request info found for callback:", MerchantRequestID);
                return res.status(200).send("Acknowledged But Orphaned");
            }

            const amount = parseFloat(Amount || requestInfo.amount);

            if (isStandingOrder) {
                await db.collection("standing_orders").doc(MerchantRequestID || SubscriptionID).update({
                    status: 'active',
                    subscriptionId: SubscriptionID,
                    activatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                await db.collection("users").doc(requestInfo.userId).update({
                    auto_pay_enabled: true,
                    standing_order_id: SubscriptionID
                });

                console.log(`Standing Order ${SubscriptionID} activated for user ${requestInfo.userId}`);
            } else {
                const batch = db.batch();
                const requestDocRef = db.collection("stk_requests").doc(MerchantRequestID || CheckoutRequestID);
                
                // 1. Update STK request
                batch.update(requestDocRef, {
                    status: "completed",
                    receipt: TransactionID,
                    completedAt: admin.firestore.FieldValue.serverTimestamp(),
                    rawCallback: req.body
                });

                // 2. Add to User Balance
                const userRef = db.collection("users").doc(requestInfo.userId);
                batch.update(userRef, {
                    balance: admin.firestore.FieldValue.increment(amount),
                    last_topup: admin.firestore.FieldValue.serverTimestamp()
                });

                // 3. Log transaction
                const transRef = db.collection("transactions").doc();
                batch.set(transRef, {
                    user_id: requestInfo.userId,
                    amount,
                    type: "topup",
                    method: "sasapay",
                    receipt: TransactionID,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });

                // 4. Update global statistics
                const statsRef = db.collection("totals").doc("liquidity");
                batch.set(statsRef, {
                    total_fund: admin.firestore.FieldValue.increment(amount),
                    total_topups: admin.firestore.FieldValue.increment(amount),
                    last_updated: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                await batch.commit();
                
                // --- REGISTRATION ACTIVATION LOGIC ---
                // If user was pending payment, activate them
                if (requestInfo.userId && requestInfo.userId.startsWith('+')) {
                    const userRef = db.collection("users").doc(requestInfo.userId);
                    const userSnap = await userRef.get();
                    if (userSnap.exists && userSnap.data().status === 'pending_payment') {
                        const userData = userSnap.data();
                        const regFee = 100;
                        const gracePeriodDays = 180;
                        const expiry = new Date();
                        expiry.setDate(expiry.getDate() + gracePeriodDays);
                        
                        await userRef.update({
                            status: 'in-waiting',
                            registration_fee_paid: true,
                            balance: admin.firestore.FieldValue.increment(-regFee), // Deduct registration fee
                            grace_period_expiry: admin.firestore.Timestamp.fromDate(expiry),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        console.log(`User ${requestInfo.userId} activated from pending_payment status.`);
                    }
                }
                
                console.log(`Payment successful via SasaPay for user: ${requestInfo.userId}, Amount: ${amount}`);
            }
        } else {
            console.warn("SasaPay Payment Failed:", ResultDesc);
        }

        res.status(200).send("Callback Processed");
    } catch (error) {
        console.error("SasaPay Callback processing error: ", error);
        res.status(200).send("Acknowledged with error");
    }
});

// 6. SasaPay Standing Order Setup
// 6. SasaPay Standing Order Setup
exports.setupStandingOrder = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be logged in');

    const { amount, frequency, phoneNumber, networkCode } = request.data;
    const userId = request.auth.uid;

    try {
        return await performStandingOrderSetup(userId, amount, frequency, phoneNumber, networkCode);
    } catch (error) {
        console.error("Setup Standing Order Error:", error.response?.data || error.message);
        throw new HttpsError('internal', error.response?.data?.detail || error.message);
    }
});


/**
 * 4.5 M-Pesa B2C Disbursement (Disburse funds to member)
 * Triggered by Admin approval in the frontend
 */
// 6. SasaPay B2C Disbursement
exports.sasapayB2C = onRequest({
    cors: true,
}, async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        const { phoneNumber, amount, claimId, userId } = req.body;

        if (!phoneNumber || !amount || !claimId) {
            res.status(400).send({ error: "Missing required fields" });
            return;
        }

        const token = await getSasapayToken();
        const callbackUrl = "https://sasapaycallback-l5mloh4jka-uc.a.run.app";


        const payload = {

            MerchantCode: SASAPAY_MERCHANT_CODE,
            MerchantTransactionReference: claimId.substring(0, 12),
            Amount: Number(amount),
            Currency: "KES",
            ReceiverNumber: formatTo254(phoneNumber),
            Channel: "63902", // M-Pesa in Kenya
            Reason: `Hazina Claim Approval: ${claimId.substring(0, 8)}`,
            CallBackURL: callbackUrl
        };

        const response = await axios.post(`${SASAPAY_BASE_URL}/payments/b2c/`, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });

        return response.data;
    } catch (error) {
        console.error("Agent Withdrawal Error:", error.response?.data || error.message);
        throw new HttpsError('internal', "Disbursement failed.");
    }
});


// --- TOTP (Authenticator App) Integration ---

/**
 * Generates a TOPT secret for an admin user.
 * Should only be callable by authenticated admins.
 */
exports.generateTotpSecret = onCall({ cors: true }, async (request) => {
    try {
        const uid = request.auth?.uid;
        console.log(`[TOTP] generateTotpSecret requested by UID: ${uid}`);

        if (!uid) {
            throw new HttpsError('unauthenticated', 'User must be authenticated.');
        }

        // Verify user is an admin
        const userSnap = await fetchUserDoc(uid, request.auth);
        if (!userSnap || !userSnap.exists) {
            console.error(`[TOTP] Profile not found for UID: ${uid}`);
            throw new HttpsError('not-found', 'Hazina Identity Error: Your profile could not be found in the system.');
        }
        
        const userData = userSnap.data();
        if (userData.role !== 'admin' && userData.role !== 'super_master') {
            console.warn(`[TOTP] Unauthorized attempt by ${uid} with role ${userData.role}`);
            throw new HttpsError('permission-denied', 'Access Denied: Admin authorization required.');
        }

        const secret = authenticator.generateSecret();
        const userEmail = userData.email || userData.phoneNumber || "admin@hazinacare.org";
        const otpauth = authenticator.keyuri(userEmail, "Hazina Care", secret);

        return { 
            secret, 
            otpauth,
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(otpauth)}`
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error("[TOTP] generateTotpSecret Internal Error:", error);
        throw new HttpsError('internal', error.message || 'Failed to generate security token.');
    }
});

/**
 * Verifies a TOTP token and enables it for the admin if valid.
 */
exports.verifyAndEnableTotp = onCall({ cors: true }, async (request) => {
    try {
        const { token, secret, isInitialSetup } = request.data;
        const uid = request.auth?.uid;

        console.log(`[TOTP] verifyAndEnableTotp requested by UID: ${uid}, isInitial: ${isInitialSetup}`);

        if (!uid) {
            throw new HttpsError('unauthenticated', 'Identification Required: Please re-login.');
        }

        const userSnap = await fetchUserDoc(uid, request.auth);
        if (!userSnap || !userSnap.exists) {
            throw new HttpsError('not-found', 'Profile Mismatch: Account details not found.');
        }

        const userRef = userSnap.ref;
        let effectiveSecret = secret;

        // If not initial setup, we use the secret stored in DB
        if (!isInitialSetup) {
            effectiveSecret = userSnap.data().totpSecret;
            if (!effectiveSecret) {
                throw new HttpsError('failed-precondition', 'Security Setup Missing: TOTP is not active for this account.');
            }
        }

        if (!effectiveSecret) {
            throw new HttpsError('invalid-argument', 'Missing security parameters.');
        }

        const isValid = authenticator.check(token, effectiveSecret);

        if (!isValid) {
            throw new HttpsError('invalid-argument', 'Invalid Authorization Code: Check your Authenticator app.');
        }

        // If initial setup, save the secret to the user's profile
        if (isInitialSetup) {
            await userRef.update({
                totpSecret: secret,
                totpEnabled: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error("[TOTP] verifyAndEnableTotp Internal Error:", error);
        throw new HttpsError('internal', 'Bridge Connection Error: Security settings could not be updated.');
    }
});

/**
 * Validates a TOTP token during login.
 * This can be used as a second factor.
 */
exports.validateAdminTotp = onCall({ cors: true }, async (request) => {
    const { email, token, checkOnly } = request.data;

    if (!email) {
        throw new HttpsError('invalid-argument', 'Email is required.');
    }

    const userSnap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (userSnap.empty) {
        throw new HttpsError('not-found', 'Admin account not found.');
    }

    const userData = userSnap.docs[0].data();

    // Check Mandatory 2FA Policy
    const securitySnap = await db.collection('config').doc('security').get();
    const forcedList = (securitySnap.exists && securitySnap.data().forced_totp_list) || [];
    const isForced = forcedList.includes(email);

    // Check if TOTP is enabled
    if (!userData.totpEnabled || !userData.totpSecret) {
        if (checkOnly) {
            return { totpEnabled: isForced, forced: isForced };
        }
        if (isForced) {
             throw new HttpsError('permission-denied', 'Mandatory 2FA Enforcement Active. Contact system administrator.');
        }
        throw new HttpsError('permission-denied', 'TOTP not enabled for this account.');
    }

    if (checkOnly) {
        return { totpEnabled: true, forced: isForced };
    }

    if (!token) {
        throw new HttpsError('invalid-argument', 'Authenticator token is required.');
    }

    const isValid = authenticator.check(token, userData.totpSecret);

    if (!isValid) {
        throw new HttpsError('invalid-argument', 'Invalid authenticator code.');
    }

    // Generate a custom token for the admin
    const firebaseToken = await admin.auth().createCustomToken(userSnap.docs[0].id);
    return { token: firebaseToken };
});


// 5. Africa's Talking USSD Webhook Handler
exports.ussd = onRequest(async (req, res) => {
    try {
        const { sessionId, serviceCode, phoneNumber, text } = req.body;

        // Format phone to match our DB (+254...)
        const intlPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
        const localPhone = formatToLocal(phoneNumber);

        // Get user profile - Try international doc ID, then phone field, then local doc ID
        let userDoc = await db.collection("users").doc(intlPhone).get();
        if (!userDoc.exists) {
            const snap = await db.collection("users").where("phoneNumber", "in", [intlPhone, localPhone]).limit(1).get();
            if (!snap.empty) {
                userDoc = snap.docs[0];
            } else {
                userDoc = await db.collection("users").doc(localPhone).get();
            }
        }

        const userExists = userDoc.exists;
        let profile = userExists ? userDoc.data() : null;
        let userId = userExists ? (userDoc.id || profile.uid) : null;

        let response = "";
        const parts = text ? text.split("*") : [];
        const level = parts.length;

        if (text === "") {
            // Main Menu
            if (userExists) {
                const balance = profile.walletBalance || profile.balance || 0;
                response = `CON Welcome to Hazina Care\n` +
                    `Balance: KSh ${balance}\n` +
                    `1. Check Shield\n` +
                    `2. Claim Fund\n` +
                    `3. Add Dependent\n` +
                    `4. Top Up Wallet\n` +
                    `5. Setup Standing Order\n` +
                    `6. Upgrade Tier`;
            } else {
                response = `CON Welcome to Hazina Care.\n` +
                    `Register to protect your family.\n` +
                    `1. Register (KSh 1,500/mo Bronze)\n` +
                    `2. Learn More`;
            }
        } else if (parts[0] === "1") {
            if (userExists) {
                // Shield Status
                const now = new Date();
                const graceExpiry = (profile.grace_period_expiry && profile.grace_period_expiry.toDate()) || now;
                if (graceExpiry <= now) {
                    response = `END Your Hazina Shield is FULLY ACTIVE.\nTier: ${(profile.active_tier || 'bronze').toUpperCase()}`;
                } else {
                    const waitDays = Math.ceil((graceExpiry - now) / (1000 * 60 * 60 * 24));
                    response = `END Your Hazina Shield is IN WAITING.\nMatures in ${waitDays} days. Keep paying your daily contribution!`;
                }
            } else {
                // Register flow - Step 1: ID Number
                if (level === 1) {
                    response = `CON Enter your National ID number:`;
                } else if (level === 2) {
                    // Save temporary registration data or proceed to next step
                    response = `END Thank you. Visit a Hazina agent or download the app to complete registration.`;
                }
            }
        } else if (parts[0] === "2" && userExists) {
            // Claim flow
            const graceExpiry = (profile.grace_period_expiry && profile.grace_period_expiry.toDate()) || new Date();
            if (graceExpiry > new Date()) {
                response = `END Sorry, your shield is still maturing. You can claim after your 180-day grace period ends.`;
            } else {
                if (level === 1) {
                    response = `CON Select Claim Type:\n1. Medical Crisis\n2. Bereavement\n3. School Fees`;
                } else {
                    response = `END Your request has been received. A Hazina officer will contact you shortly.`;
                }
            }
        } else if (parts[0] === "3" && userExists) {
            // Add Dependent
            if (level === 1) {
                response = `CON Enter Dependent's Phone Number (07...):`;
            } else if (level === 2) {
                response = `CON Enter Dependent's Full Name:`;
            } else if (level === 3) {
                const depPhone = parts[1];
                const depName = parts.slice(2).join(" ");
                try {
                    // Standardized root collection with guardian_id
                    await db.collection("dependents").add({
                        guardian_id: userId,
                        fullName: depName,
                        phoneNumber: depPhone,
                        active_tier: 'bronze', // Default tier
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // Calculate new total burn
                    const totalBurn = await calculateUserBurn(userId, profile);
                    const activeSO = await getActiveStandingOrder(userId);
                    
                    if (activeSO && activeSO.amount < totalBurn) {
                         response = `CON Success! ${depName} added.\n` +
                                   `Your total daily cost is now KSh ${totalBurn}.\n` +
                                   `Update your Auto-Pay to KSh ${totalBurn}?\n` +
                                   `1. Yes (Authorize Now)\n` +
                                   `2. No (Keep current KSh ${activeSO.amount})`;
                    } else if (!activeSO) {
                        response = `CON Success! ${depName} added.\n` +
                                   `Daily cost: KSh ${totalBurn}.\n` +
                                   `Setup Auto-Pay now?\n` +
                                   `1. Yes\n` +
                                   `2. No`;
                    } else {
                        response = `END Success! ${depName} added. Your total daily cost is KSh ${totalBurn}.`;
                    }
                } catch (depError) {
                    console.error("USSD Add Dep Error:", depError);
                    response = `END Failed to add dependent. Please try again later.`;
                }
            } else if (level >= 4) {
                 const selection = parts[3];
                 if (selection === "1") {
                     const totalBurn = await calculateUserBurn(userId, profile);
                     // Trigger Standing Order Setup (Daily is the default for cost-matching)
                     response = `END Great! We are sending a SasaPay prompt to authorize your new KSh ${totalBurn} daily Auto-Pay.`;
                     performStandingOrderSetup(userId, totalBurn, "DAILY", phoneNumber).catch(e => console.error("USSD Smart SO Error:", e));
                 } else {
                     response = `END No problem. You can update your Auto-Pay anytime from Option 5.`;
                 }
            }
        } else if (parts[0] === "4" && userExists) {
            // Top Up
            if (level === 1) {
                response = `CON Enter amount to Top Up:`;
            } else if (level === 2) {
                const amount = parseInt(parts[1]);
                if (isNaN(amount) || amount < 10) {
                    response = `END Invalid amount. Min KSh 10.`;
                } else {
                    response = `END We are sending an M-Pesa prompt to your phone for KSh ${amount}. Please enter your PIN.`;
                    initiateSasapayC2B(phoneNumber, amount, userId).catch(e => console.error("USSD Topup Error:", e));
                }
            }
        } else if (parts[0] === "5" && userExists) {
            // Standing Order
            if (level === 1) {
                response = `CON Select Frequency:\n1. Daily\n2. Weekly\n3. Monthly`;
            } else if (level === 2) {
                response = `CON Enter amount per transaction:`;
            } else if (level === 3) {
                const freqMap = { "1": "DAILY", "2": "WEEKLY", "3": "MONTHLY" };
                const frequency = freqMap[parts[1]];
                const amount = parseInt(parts[2]);
                if (!frequency) {
                    response = `END Invalid frequency selection.`;
                } else if (isNaN(amount) || amount < 50) {
                    response = `END Invalid amount. Min KSh 50 for Auto-Pay.`;
                } else {
                    response = `END Setting up ${frequency} Standing Order for KSh ${amount}. You will receive a prompt to authorize.`;
                    performStandingOrderSetup(userId, amount, frequency, phoneNumber).catch(e => console.error("USSD SO Error:", e));
                }
            }
        } else if (parts[0] === "6" && userExists) {
            // Upgrade Tier
            const currentTier = (profile.active_tier || 'bronze').toLowerCase();
            
            if (level === 1) {
                if (currentTier === 'gold') {
                    response = `END You are already on the highest tier (GOLD).`;
                } else if (currentTier === 'silver') {
                    response = `CON Upgrade to GOLD?\nDaily Cost: KSh 229\n1. Confirm Upgrade\n2. Cancel`;
                } else {
                    response = `CON Select Upgrade Tier:\n1. SILVER (KSh 147/day)\n2. GOLD (KSh 229/day)`;
                }
            } else if (level === 2) {
                let targetTier = "";
                if (currentTier === 'silver') {
                    if (parts[1] === "1") targetTier = "gold";
                } else if (currentTier === 'bronze') {
                    if (parts[1] === "1") targetTier = "silver";
                    else if (parts[1] === "2") targetTier = "gold";
                }

                if (targetTier) {
                    try {
                        // Update User Tier
                        await db.collection("users").doc(userId).update({
                            active_tier: targetTier,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        
                        // Calculate new total burn
                        const totalBurn = await calculateUserBurn(userId, { ...profile, active_tier: targetTier });
                        const activeSO = await getActiveStandingOrder(userId);

                        if (activeSO && activeSO.amount < totalBurn) {
                            response = `CON Level Up! You are now a ${targetTier.toUpperCase()} member.\n` +
                                      `New daily cost is KSh ${totalBurn}.\n` +
                                      `Update your Auto-Pay to KSh ${totalBurn}?\n` +
                                      `1. Yes (Authorize Now)\n` +
                                      `2. No`;
                        } else if (!activeSO) {
                            response = `CON Success! Upgraded to ${targetTier.toUpperCase()}.\n` +
                                      `Daily cost: KSh ${totalBurn}.\n` +
                                      `Setup Auto-Pay now?\n` +
                                      `1. Yes\n` +
                                      `2. No`;
                        } else {
                            response = `END Success! You are now on ${targetTier.toUpperCase()} tier. Your daily cost is KSh ${totalBurn}.`;
                        }
                    } catch (err) {
                        console.error("USSD Upgrade Error:", err);
                        response = `END Failed to upgrade. Please try again later.`;
                    }
                } else {
                    response = `END Upgrade cancelled or invalid selection.`;
                }
            } else if (level >= 3) {
                const selection = parts[2];
                if (selection === "1") {
                    // Get updated profile
                    const uSnap = await db.collection("users").doc(userId).get();
                    const uProfile = uSnap.data();
                    const totalBurn = await calculateUserBurn(userId, uProfile);
                    
                    response = `END Great! We are sending a SasaPay prompt to authorize your new KSh ${totalBurn} daily Auto-Pay.`;
                    performStandingOrderSetup(userId, totalBurn, "DAILY", phoneNumber).catch(e => console.error("USSD Upgrade SO Error:", e));
                } else {
                    response = `END No problem. You can update your Auto-Pay anytime from Option 5.`;
                }
            }
        } else {
            response = "END Invalid option or service unavailable for your account.";
        }

        // Send the response back to Africa's Talking
        res.set("Content-Type", "text/plain");
        res.send(response);
    } catch (error) {
        console.error("USSD error: ", error);
        res.set("Content-Type", "text/plain");
        res.send("END An error occurred. Please try again later.");
    }
});

// 6. AI Assistant Hub (Sifuna AI)
exports.chatWithSifuna = onCall({ cors: true }, async (request) => {
    try {
        const { message, history, language = 'en', userId } = request.data;

        if (!message) {
            throw new HttpsError('invalid-argument', 'The function must be called with a "message" argument.');
        }

        // --- SELF-LEARNING MECHANISM (Retrieval) ---
        // Fetch long-term "learned" facts about this user from Firestore
        let persistentContext = "";
        // Retrieve user-specific memory if userId is provided
        let learnedFacts = [];
        if (userId) {
            const memoriesRef = db.collection('users').doc(userId).collection('memories');
            const memoriesSnapshot = await memoriesRef.orderBy('timestamp', 'desc').limit(20).get();
            learnedFacts = memoriesSnapshot.docs.map(doc => doc.data().fact);
        }
        if (learnedFacts.length > 0) {
            persistentContext = `\nLEARNED FACTS ABOUT THIS USER:\n- ${learnedFacts.join('\n- ')}`;
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: `
                You are Sifuna, the official AI assistant for Hazina Care. Hazina is a community-driven protection platform in Kenya.
                
                KNOWLEDGE BASE:
                - Tiers: 
                    * Bronze: KSh 50/day, KSh 100,000 cover.
                    * Silver: KSh 147/day, KSh 250,000 cover.
                    * Gold: KSh 229/day, KSh 500,000 cover.
                - Maturation: There is a 180-day grace period (waiting period) before a shield is fully active.
                - Crisis Types covered: Medical emergency, Bereavement, School Fees.
                - Payments: Handled via M-Pesa STK Push. Daily 'burn' is automatically deducted from the wallet.
                - USSD: Users can dial *384# (testing) to access services.
                - Philosophy: Community-driven, transparent, and built to protect families without the need for traditional insurance.
                
                ${persistentContext}

                TONE & STYLE:
                - Be helpful, empathetic, and professional.
                - Use a mix of English and Swahili if appropriate (Sheng is welcome for a friendly vibe).
                - Keep responses concise and formatted with bullet points if listing options.
                - If you don't know something about the user specifically, ask them to check their dashboard.
                - IF THE USER TELLS YOU A NEW PERSONAL FACT (e.g. "My name is John" or "I have 3 children"), acknowledge it.
                
                USER CONTEXT:
                - Current User Language: ${language === 'sw' ? 'Swahili' : 'English'}.
                - CRITICAL: You MUST respond in ${language === 'sw' ? 'Swahili' : 'English'}.
            `
        });

        const chat = model.startChat({
            history: history || [],
            generationConfig: {
                maxOutputTokens: 500,
            },
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        // --- SELF-LEARNING MECHANISM (Storage) ---
        // Detect if the AI thinks it learned something new (Basic heuristic or secondary model call)
        // For now, let's use a simple pattern check or just store specific types of info if the AI flags it.
        // Dynamic "Learning" trigger: Search for "I'll remember that" or "Noted" in AI response to trigger storage.
        if (userId && (text.includes("I'll remember that") || text.includes("Noted") || text.includes("Nitakumbuka") || text.includes("imehifadhiwa"))) {
            // We can extract the fact using another LLM call or just log the whole move for human review.
            // For this beta, we'll log the "learned" interaction to a dedicated collection.
            await db.collection("users").doc(userId).collection("memories").add({
                fact: `Learned from user: "${message}"`,
                ai_response: text,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        return { text };
    } catch (error) {
        console.error("Chat error:", error);
        throw new HttpsError('internal', error.message || 'An unknown error occurred.');
    }
});

// 7. Custom OTP SMS via Africa's Talking
const AT_API_KEY = process.env.AT_API_KEY || process.env.VITE_AT_API_KEY || 'PLACEHOLDER';
const AT_USERNAME = process.env.AT_USERNAME || process.env.VITE_AT_USERNAME || 'sandbox';

const africastalking = require('africastalking')({
    apiKey: AT_API_KEY,
    username: AT_USERNAME
});


exports.sendOtp = onCall({ cors: true }, async (request) => {
    try {
        const { phoneNumber } = request.data;
        const formatPhone = formatTo254(phoneNumber);
        console.log("SEND_OTP_CALLED for:", phoneNumber, "Standardized to:", formatPhone);

        if (!formatPhone) {
            throw new HttpsError('invalid-argument', 'Valid phone number is required.');
        }

        // 1. Check security policy (Mandatory TOTP List)
        const securitySnap = await db.collection('config').doc('security').get();
        const forcedList = (securitySnap.exists && securitySnap.data().forced_totp_list) || [];
        const isForced = forcedList.includes(formatPhone);

        // 2. Check user status
        const userSnap = await db.collection('users').doc(formatPhone).get();
        const userData = userSnap.exists ? userSnap.data() : null;

        if (userData?.totpEnabled && userData?.totpSecret) {
            console.log("TOTP enabled for user, skipping SMS OTP.");
            return { success: true, totpEnabled: true, message: "Use your authenticator app." };
        }

        if (isForced) {
            console.warn("User on Forced TOTP list but no secret found:", formatPhone);
            return {
                success: false,
                forcedSetupRequired: true,
                message: "Security Policy: Mandatory 2FA is active for this account but your device is not yet configured. Please contact the System Administrator to scan your QR code."
            };
        }

        // Generate a random 6-digit code
        const isTestNum = isTestNumber(formatPhone);
        console.log(`[SEND_OTP] isTestNumber: ${isTestNum}, phone: ${formatPhone}`);
        const code = isTestNum ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();

        // Save to Firestore with 1 hour expiration
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 1);

        await db.collection('otp_codes').doc(formatPhone).set({
            code: code,
            expiresAt: admin.firestore.Timestamp.fromDate(expiry),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`OTP code ${code} saved to Firestore for: ${formatPhone}`);

        // ACTUALLY SEND THE SMS via Africa's Talking
        if (!isTestNum) {
            try {
                const sms = africastalking.SMS;
                const result = await sms.send({
                    to: [formatPhone],
                    message: `Your Hazina Care verification code is: ${code}. Valid for 1 hour.`
                });
                console.log("Africa's Talking SMS Result:", result);
            } catch (smsError) {
                console.error("Africa's Talking SMS Send Error:", smsError);
            }
        } else {
            console.log("Test number detected, skipping SMS send.");
        }

        return { success: true, totpEnabled: false, message: "Code sent successfully" };

    } catch (error) {
        console.error("sendOtp error:", error);
        throw new HttpsError('internal', error.message || 'Failed to initiate OTP.');
    }
});

exports.verifyOtp = onCall({ cors: true }, async (request) => {
    try {
        const { phoneNumber, validationCode } = request.data;
        const formatPhone = formatTo254(phoneNumber);
        console.log("VERIFY_OTP_CALLED for:", phoneNumber, "Standardized to:", formatPhone, "with code:", validationCode);

        if (!phoneNumber || !validationCode) {
            throw new HttpsError('invalid-argument', 'Phone number and code are required.');
        }

        let shouldProduceToken = false;

        // --- TESTING BYPASS ---
        const isTestNum = isTestNumber(formatPhone);
        console.log(`[VERIFY_OTP] isTestNumber: ${isTestNum}, phone: ${formatPhone}, code: ${validationCode}`);

        if (isTestNum && String(validationCode) === '123456') {
            console.log("TEST_BYPASS triggered for:", formatPhone);
            const token = await admin.auth().createCustomToken(formatPhone, {
                phone_number: formatPhone
            });
            return { success: true, token };
        }
        // -----------------------
        // -----------------------
        // -----------------------

        // 1. Check security policy (Mandatory TOTP List)
        const securitySnap = await db.collection('config').doc('security').get();
        const forcedList = (securitySnap.exists && securitySnap.data().forced_totp_list) || [];
        const isForced = forcedList.includes(formatPhone);

        // 2. Check if user has TOTP enabled
        const userSnap = await db.collection('users').doc(formatPhone).get();
        const userData = userSnap.exists ? userSnap.data() : null;

        if (userData?.totpEnabled && userData?.totpSecret) {
            console.log("Verifying TOTP for:", formatPhone);
            const isValid = authenticator.check(validationCode, userData.totpSecret);
            if (isValid) {
                shouldProduceToken = true;
            } else {
                throw new HttpsError('invalid-argument', 'Invalid authenticator code.');
            }
        } else if (isForced) {
             throw new HttpsError('permission-denied', 'Mandatory 2FA required. SMS codes are disabled for this account.');
        } else {
            // 3. Regular SMS OTP Flow
            const docRef = db.collection('otp_codes').doc(formatPhone);
            const docSnap = await docRef.get();

            if (!docSnap.exists) {
                console.warn("No OTP code found in DB for:", formatPhone);
                throw new HttpsError('not-found', 'No pending verification found for this number.');
            }

            const data = docSnap.data();
            console.log("Found DB matching code:", data.code);

            if (data.expiresAt.toDate() < new Date()) {
                await docRef.delete();
                throw new HttpsError('deadline-exceeded', 'OTP has expired.');
            }

            const isTestOtp = isTestNumber(formatPhone);
            if (isTestOtp && String(validationCode) === '123456') {
                console.log("Test bypass successful for:", formatPhone);
            } else if (data.code !== String(validationCode)) {
                console.warn("Code mismatch! Entered:", validationCode, "Expected:", data.code);
                throw new HttpsError('invalid-argument', 'Invalid OTP code.');
            }

            shouldProduceToken = true;
            await docRef.delete();
        }

        if (shouldProduceToken) {
            // Use Phone number as UID for consistency with our rules
            const token = await admin.auth().createCustomToken(formatPhone, {
                phone_number: formatPhone
            });
            console.log("Custom Token generated successfully for UID:", formatPhone);
            return { token };
        }

        throw new HttpsError('internal', 'Verification failed without specific error.');

    } catch (error) {
        console.error("verifyOtp error:", error);
        // We throw http errors directly to frontend so don't mask valid specific ones.
        if (error instanceof HttpsError) { throw error; }
        throw new HttpsError('internal', `Verification failed: ${error.message || 'Unknown error'}`);
    }
});

exports.checkOtp = onCall({ cors: true }, async (request) => {
    try {
        const { phoneNumber, validationCode } = request.data;
        if (!phoneNumber || !validationCode) {
            throw new HttpsError('invalid-argument', 'Phone number and code are required.');
        }

        const formatPhone = formatTo254(phoneNumber);
        
        const docRef = db.collection('otp_codes').doc(formatPhone);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            throw new HttpsError('not-found', 'No pending verification found for this number.');
        }

        const data = docSnap.data();

        if (data.expiresAt.toDate() < new Date()) {
            throw new HttpsError('deadline-exceeded', 'OTP has expired.');
        }

        const isTest = isTestNumber(formatPhone);
        if (isTest && String(validationCode) === '123456') {
            return { valid: true };
        }

        if (data.code !== String(validationCode)) {
            throw new HttpsError('invalid-argument', 'Invalid OTP code.');
        }

        return { valid: true };
    } catch (error) {
        console.error("checkOtp error:", error);
        if (error instanceof HttpsError) { throw error; }
        throw new HttpsError('internal', 'Verification check failed.');
    }
});

exports.checkUserExists = onCall({ cors: true }, async (request) => {
    try {
        const { phoneNumber } = request.data;
        if (!phoneNumber) throw new HttpsError('invalid-argument', 'Phone number is required.');
        const formatPhone = formatTo254(phoneNumber);
        const localPhone = formatToLocal(phoneNumber);
        const intlPhone = `+${formatPhone}`;

        // Robust lookup
        let userSnap = await db.collection('users').doc(formatPhone).get();
        if (!userSnap.exists) {
            userSnap = await db.collection('users').doc(localPhone).get();
        }
        if (!userSnap.exists) {
            userSnap = await db.collection('users').doc(intlPhone).get();
        }
        if (!userSnap.exists) {
            const snap = await db.collection('users').where('phoneNumber', 'in', [formatPhone, localPhone, intlPhone]).limit(1).get();
            if (!snap.empty) userSnap = snap.docs[0];
        }

        if (!userSnap.exists) {
            return { exists: false };
        }
        
        const userData = userSnap.data();
        return { 
            exists: true, 
            hasPasscode: !!userData.passcodeHash,
            profile_completed: !!userData.profile_completed
        };
    } catch (error) {
        console.error("checkUserExists error:", error);
        throw new HttpsError('internal', error.message);
    }
});

exports.verifyAndSetPasscode = onCall({ cors: true }, async (request) => {
    try {
        const { phoneNumber, validationCode, newPasscode, national_id } = request.data;
        if (!phoneNumber || !validationCode || !newPasscode) {
            throw new HttpsError('invalid-argument', 'Missing required fields.');
        }

        const formatPhone = formatTo254(phoneNumber);
        const localPhone = formatToLocal(phoneNumber);
        const intlPhone = `+${formatPhone}`;

        // 1. Verify OTP
        let isValidOtp = false;
        // Try to find OTP by any format
        let docRef = db.collection('otp_codes').doc(formatPhone);
        let docSnap = await docRef.get();
        if (!docSnap.exists) {
            docRef = db.collection('otp_codes').doc(localPhone);
            docSnap = await docRef.get();
        }
        if (!docSnap.exists) {
            docRef = db.collection('otp_codes').doc(intlPhone);
            docSnap = await docRef.get();
        }

        if (!docSnap.exists) throw new HttpsError('not-found', 'No pending verification. Please request a new OTP.');
        const data = docSnap.data();
        if (data.expiresAt.toDate() < new Date()) {
            await docRef.delete();
            throw new HttpsError('deadline-exceeded', 'OTP has expired. Please try again.');
        }
        if (data.code !== String(validationCode)) {
            // Check if it's the test bypass code
            const isTestUser = isTestNumber(formatPhone);
            if (isTestUser && String(validationCode) === '123456') {
                console.log("PASSCODE_SET_BYPASS triggered for:", formatPhone);
                isValidOtp = true;
            } else {
                throw new HttpsError('invalid-argument', 'Invalid verification code. Please check and try again.');
            }
        } else {
            isValidOtp = true;
        }

        if (isValidOtp) {
            await docRef.delete();
        } else {
            throw new HttpsError('invalid-argument', 'OTP verification failed.');
        }

        // 2. Hash New Passcode
        const salt = await bcrypt.genSalt(10);
        const passcodeHash = await bcrypt.hash(String(newPasscode), salt);

        // 3. Robust User Lookup for Save
        let userRef = db.collection('users').doc(formatPhone);
        let userSnap = await userRef.get();
        if (!userSnap.exists) {
            userSnap = await db.collection('users').doc(localPhone).get();
            if (userSnap.exists) userRef = db.collection('users').doc(localPhone);
        }
        if (!userSnap.exists) {
            userSnap = await db.collection('users').doc(intlPhone).get();
            if (userSnap.exists) userRef = db.collection('users').doc(intlPhone);
        }
        
        const updateData = { passcodeHash };
        if (request.data.firstName) updateData.firstName = request.data.firstName.toString().toUpperCase();
        if (request.data.surname) updateData.surname = request.data.surname.toString().toUpperCase();
        if (request.data.firstName && request.data.surname) {
            updateData.fullName = `${request.data.firstName} ${request.data.surname}`.trim().toUpperCase();
        } else if (request.data.fullName) {
            updateData.fullName = request.data.fullName.toString().toUpperCase();
        }
        if (request.data.national_id) updateData.national_id = request.data.national_id.toString().toUpperCase();
        if (request.data.faceUrl) {
            updateData.faceUrl = request.data.faceUrl; // Legacy support
            updateData.photoURL = request.data.faceUrl; // Standardized portrait field
        }
        
        // Location data
        if (request.data.currentCounty) updateData.currentCounty = request.data.currentCounty;
        if (request.data.currentTown) updateData.currentTown = request.data.currentTown;
        if (request.data.homeCounty) updateData.homeCounty = request.data.homeCounty;
        if (request.data.nearestTown) updateData.nearestTown = request.data.nearestTown;

        if (request.data.faceUrl) updateData.profile_completed = true;

        await userRef.set(updateData, { merge: true });

        // 4. Generate Custom Token with Phone Claim for Rule ownership
        const token = await admin.auth().createCustomToken(userRef.id, {
            phone_number: formatPhone
        });
        return { success: true, token };

    } catch (error) {
        console.error("verifyAndSetPasscode error:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', `Passcode setup failed: ${error.message}`);
    }
});

exports.loginWithPasscode = onCall({ cors: true }, async (request) => {
    try {
        const { phoneNumber, passcode } = request.data;
        if (!phoneNumber || !passcode) {
            throw new HttpsError('invalid-argument', 'Phone and passcode are required.');
        }

        const formatPhone = formatTo254(phoneNumber);
        const localPhone = formatToLocal(phoneNumber);
        const intlPhone = `+${formatPhone}`;
        
        // Robust lookup: Standardize on +254 as primary key for all users
        let userSnap = await db.collection('users').doc(intlPhone).get();
        if (!userSnap.exists) {
            userSnap = await db.collection('users').doc(formatPhone).get();
        }
        if (!userSnap.exists) {
            userSnap = await db.collection('users').doc(localPhone).get();
        }
        if (!userSnap.exists) {
            // Field search fallback (if phone is stored in field but doc ID is different/UID)
            const snap = await db.collection('users').where('phoneNumber', 'in', [formatPhone, localPhone, intlPhone]).limit(1).get();
            if (!snap.empty) userSnap = snap.docs[0];
        }

        if (!userSnap.exists) {
            throw new HttpsError('not-found', 'User not found. Please register first.');
        }

        const userData = userSnap.data();
        const docId = userSnap.id;
        
        // --- TESTING BYPASS ---
        const isTestUser = isTestNumber(formatPhone);
        if (isTestUser && String(passcode) === '123456') {
            console.log("PASSCODE_BYPASS triggered for:", docId);
            
            // Auto-create test profile if missing
            if (!userSnap.exists) {
                console.log("🛠️ Auto-creating test profile for:", docId);
                let testRole = 'agent';
                let testName = 'TEST AGENT';
                
                if (formatPhone === '254792360091' || formatPhone === '2547923601') {
                    testRole = 'super_master';
                    testName = 'SMA TEST';
                } else if (formatPhone === '254792360092') {
                    testRole = 'master_agent';
                    testName = 'MASTER TEST';
                }

                await db.collection('users').doc(docId).set({
                    phoneNumber: formatPhone,
                    firstName: testName.split(' ')[0],
                    surname: testName.split(' ')[1],
                    fullName: testName,
                    role: testRole,
                    status: 'active',
                    agent_code: testRole === 'super-master' ? 'SMA001' : testRole === 'master-agent' ? 'MASTER001' : 'TEST001',
                    balance: 0,
                    walletBalance: 0,
                    totalEarnings: 0,
                    totalSignups: 0,
                    profile_completed: true,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            const token = await admin.auth().createCustomToken(docId);
            return { success: true, token };
        }
        // -----------------------

        if (!userData.passcodeHash) {
             throw new HttpsError('failed-precondition', 'Passcode not set for this account. Please use "Forgot Passcode" to reset.');
        }

        const isMatch = await bcrypt.compare(String(passcode), userData.passcodeHash);
        if (!isMatch) {
            throw new HttpsError('invalid-argument', 'Invalid passcode. Please try again.');
        }

        const token = await admin.auth().createCustomToken(docId, {
            phone_number: formatPhone
        });
        return { success: true, token };

    } catch (error) {
        console.error("loginWithPasscode error:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', `Login failed: ${error.message}`);
    }
});

/**
 * Super Master / Master Agent Recruitment Processor
 * Triggered when a new user profile is created.
 */
exports.onUserCreated = onDocumentWritten("users/{userId}", async (event) => {
    const snapshot = event.data?.after;
    const beforeSnapshot = event.data?.before;
    if (!snapshot || !snapshot.exists) return;

    const newUser = snapshot.data();
    const userId = event.params.userId;
    const agentCode = newUser.recruited_by;

    if (!agentCode) return;
    
    const isTestNode = isTestNumber(userId);
    const oldUser = beforeSnapshot && beforeSnapshot.exists ? beforeSnapshot.data() : null;
    
    // Only proceed if recruited_by just appeared or changed
    if (oldUser && oldUser.recruited_by === agentCode) {
        console.log(`[onUserCreated] Skipping ${userId} - no change in recruiter (${agentCode})`);
        return;
    }

    console.log(`[onUserCreated] Triggered for ${userId}. New/Changed Recruiter: ${agentCode}. Is test: ${isTestNumber}`);

    try {
        let agentData = {};
        let ResolvedAgentId = (agentCode || '').toString().trim().toUpperCase(); // Standardize to uppercase
        
        // 1. Try to find agent in 'users' collection
        // 1. Try to find agent in 'users' collection
        let userDoc = null;
        const isLikelyPhone = /^\+?\d+$/.test(agentCode);
        
        // Try direct ID lookup first
        userDoc = await db.collection("users").doc(agentCode).get();
        
        // If not found and looks like a phone, try formatted variants
        if (!userDoc.exists && isLikelyPhone) {
            const intlCode = agentCode.startsWith('+') ? agentCode : `+${formatTo254(agentCode)}`;
            const localCode = formatToLocal(agentCode);
            if (agentCode !== intlCode) {
                userDoc = await db.collection("users").doc(intlCode).get();
            }
            if (!userDoc?.exists && agentCode !== localCode) {
                userDoc = await db.collection("users").doc(localCode).get();
            }
        }

        // If still not found, try searching by agent_code field
        if (!userDoc || !userDoc.exists) {
            const agentByCode = await db.collection("users").where("agent_code", "==", agentCode).limit(1).get();
            if (!agentByCode.empty) {
                userDoc = agentByCode.docs[0];
                agentData = userDoc.data();
                ResolvedAgentId = agentCode;
            }
        } else {
            agentData = userDoc.data();
            // Important: Use agent_code if it exists, otherwise use agentCode (which is already uppercase)
            ResolvedAgentId = (agentData.agent_code || agentData.agentCode || agentCode).toString().toUpperCase();
        }

        // 2. Try to find agent in 'agents' collection (doc ID is agent code)
        const agentEntryDoc = await db.collection("agents").doc(agentCode).get();
        if (agentEntryDoc.exists) {
            agentData = { ...agentData, ...agentEntryDoc.data() };
            ResolvedAgentId = agentCode;
        }
        
        // Helper function to update agent wallets and logs in both 'users' and 'agents' collections
        const distributeCommission = async (targetAgentId, amount, roleLabel) => {
            if (!targetAgentId) return null;
            
            console.log(`[onUserCreated] Distributing ${amount} to ${roleLabel}: ${targetAgentId}`);
            
            // Normalize ID for lookup: Try intl format first
            const intlId = targetAgentId.startsWith('+') ? targetAgentId : `+${formatTo254(targetAgentId)}`;
            let targetUserDoc = await db.collection("users").doc(intlId).get();
            
            if (!targetUserDoc.exists) {
                // Try original ID
                targetUserDoc = await db.collection("users").doc(targetAgentId).get();
            }

            if (!targetUserDoc.exists) {
                // Try search by agent_code if doc ID fails
                const snap = await db.collection("users").where("agent_code", "==", targetAgentId).limit(1).get();
                if (!snap.empty) targetUserDoc = snap.docs[0];
            }

            if (!targetUserDoc.exists) {
                 // Try search by phoneNumber field (fallback for fragmented profiles)
                 const snap = await db.collection("users").where("phoneNumber", "in", [targetAgentId, formatTo254(targetAgentId), formatToLocal(targetAgentId)]).limit(1).get();
                 if (!snap.empty) targetUserDoc = snap.docs[0];
            }

            const updateData = {
                totalEarnings: admin.firestore.FieldValue.increment(amount),
                walletBalance: admin.firestore.FieldValue.increment(amount),
                lastSignupAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // 1. Update User Profile if found
            if (targetUserDoc && targetUserDoc.exists) {
                await targetUserDoc.ref.update({
                    ...updateData,
                    totalSignups: admin.firestore.FieldValue.increment(1)
                });
            }

            // 2. Update Agents Collection doc
            const agentEntryRef = db.collection("agents").doc(targetAgentId);
            const agentEntryDoc = await agentEntryRef.get();
            if (agentEntryDoc.exists) {
                await agentEntryRef.update({
                    ...updateData,
                    totalSignups: admin.firestore.FieldValue.increment(1)
                });
            }

            return targetUserDoc && targetUserDoc.exists ? targetUserDoc.data() : (agentEntryDoc.exists ? agentEntryDoc.data() : null);
        };

        // --- HIERARCHY DISTRIBUTION & ANALYTICS ---
        
        // 1. Level 1: Immediate Agent (Gets Commission + Signup Count)
        const agentTariff = agentData.tariffRate || 15;
        const agentRes = await distributeCommission(ResolvedAgentId, agentTariff, "AGENT");
        
        // Use the most up-to-date data for hierarchy resolution
        const currentAgentData = agentRes || agentData;
        const masterAgentId = currentAgentData.masterAgentId ? currentAgentData.masterAgentId.toString().trim().toUpperCase() : null;

        // 2. Level 2: Master Agent (Signup Count ONLY, no commission)
        let superMasterId = null;
        if (masterAgentId) {
            const masterRes = await distributeCommission(masterAgentId, 0, "MASTER_ANALYTICS");
            if (masterRes) {
                // Super Master is the Master's Master
                superMasterId = masterRes.masterAgentId || masterRes.superMasterId || null;
            }
        }

        // 3. Level 3: Super Master Agent (Signup Count ONLY, no commission)
        if (superMasterId) {
            await distributeCommission(superMasterId.toString().trim().toUpperCase(), 0, "SUPER_MASTER_ANALYTICS");
        }

        // Log the recruitment record with data needed by the dashboard
        const normalizedAgentId = ResolvedAgentId.toString().toUpperCase().replace('+', '');
        const logId = `recruitment_${normalizedAgentId}_${userId}`.replace(/[^\w\d_]/g, '');
        
        await db.collection("recruitment_logs").doc(logId).set({
            userId,
            userName: newUser.fullName,
            tier: newUser.active_tier || 'bronze',
            agentId: normalizedAgentId,
            originalAgentInput: agentCode,
            masterAgentId: masterAgentId ? masterAgentId.toString().toUpperCase().replace('+', '') : null,
            superMasterId: superMasterId ? superMasterId.toString().toUpperCase().replace('+', '') : null,
            tariffApplied: agentTariff,
            commissionEarned: agentTariff,
            // Carry forward residence data for analytics
            city: newUser.currentTown || '',
            county: newUser.currentCounty || '',
            homeCounty: newUser.homeCounty || '',
            nearestTown: newUser.nearestTown || '',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`User ${userId} recruited by ${agentCode} processed. Hierarchy: Agent(${ResolvedAgentId}) -> Master(${masterAgentId}) -> Super(${superMasterId})`);
    } catch (error) {
        console.error("Recruitment trigger error:", error);
    }
});

// 8. Agent Withdrawal (B2C)
exports.initiateAgentWithdrawal = onCall({ cors: true }, async (request) => {
    const { amount, phoneNumber } = request.data;
    const uid = request.auth?.uid;

    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    if (!amount || amount < 2500) {
        throw new HttpsError('invalid-argument', 'Minimum withdrawal is KSh 2,500.');
    }

    const formatPhone = formatTo254(phoneNumber);
    const userRef = db.collection("users").doc(uid);
    const withdrawalId = `WD-${Date.now().toString().substring(5)}`;
    const withdrawalRef = db.collection("withdrawals").doc(withdrawalId);

    try {
        // --- STEP 1: ATOMIC TRANSACTION ---
        // Subtract balance and create record in one atomic operation
        const result = await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                throw new Error('User record not found.');
            }

            const userData = userDoc.data();
            const currentBalance = userData.walletBalance || 0;
            const agentCode = userData.agent_code || userData.phoneNumber || uid;

            if (currentBalance < 2500) {
                throw new Error('Withdrawals are disabled until your wallet reaches KSh 2,500.');
            }

            if (currentBalance < amount) {
                throw new Error(`Insufficient wallet balance. Available: KSh ${currentBalance}`);
            }

            // Perform Atomic Writes
            transaction.update(userRef, {
                walletBalance: admin.firestore.FieldValue.increment(-amount),
                last_withdrawal_attempt: admin.firestore.FieldValue.serverTimestamp()
            });

            transaction.set(withdrawalRef, {
                userId: uid,
                agentId: agentCode,
                amount: amount,
                phoneNumber: formatPhone,
                status: 'payout_initiated',
                transactionReference: withdrawalId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                retryCount: 0
            });

            return { agentCode, withdrawalId };
        });

        const { agentCode } = result;

        // --- STEP 2: EXTERNAL SASAPAY CALL ---
        try {
            const token = await getSasapayToken();
            const callbackUrl = "https://sasapaycallback-l5mloh4jka-uc.a.run.app";

            const payload = {
                MerchantCode: SASAPAY_MERCHANT_CODE,
                MerchantTransactionReference: withdrawalId,
                Amount: Number(amount),
                Currency: "KES",
                ReceiverNumber: formatPhone,
                Channel: "63902", // M-Pesa
                Reason: `Hazina Agent Withdrawal: ${agentCode}`,
                CallBackURL: callbackUrl
            };

            const response = await axios.post(`${SASAPAY_BASE_URL}/payments/b2c/`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.status) {
                // Update with external reference
                await withdrawalRef.update({
                    status: 'processing',
                    externalReference: response.data.TransactionReference || null
                });
                return { success: true, message: "Withdrawal initiated successfully." };
            } else {
                throw new Error(response.data.detail || "SasaPay B2C API rejected the request.");
            }

        } catch (sasaError) {
            console.error("🔴 SasaPay Payout Error:", sasaError.message);
            
            // --- STEP 3: ATOMIC ROLLBACK ---
            // On external failure, refund the balance and mark as failed
            await db.runTransaction(async (transaction) => {
                transaction.update(userRef, {
                    walletBalance: admin.firestore.FieldValue.increment(amount)
                });
                transaction.update(withdrawalRef, {
                    status: 'failed',
                    errorMessage: sasaError.message,
                    failedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            throw new HttpsError('internal', `Payment Gateway Error: ${sasaError.message}. Funds have been returned to your wallet.`);
        }

    } catch (error) {
        console.error("❌ Withdrawal Logic Error:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || 'Withdrawal failed.');
    }
});

/**
 * Agent-Led Registration Processor
 * Creates a new user, sends SMS, and triggers STK push for registration + first tier payment.
 */
exports.registerUserByAgent = onCall({ cors: true }, async (request) => {
    const { firstName, surname, idNumber, phoneNumber, tier, photoUrl } = request.data;
    const uid = request.auth?.uid;

    if (!uid) {
        throw new HttpsError('unauthenticated', 'Agent must be logged in.');
    }

    if (!firstName || !surname || !idNumber || !phoneNumber || !tier) {
        console.warn("⚠️ [registerUserByAgent] Missing fields check failed:", {
            hasFirstName: !!firstName,
            hasSurname: !!surname,
            hasId: !!idNumber,
            hasPhone: !!phoneNumber,
            hasTier: !!tier,
            receivedData: request.data
        });
        throw new HttpsError('invalid-argument', 'Missing matching user profile fields.');
    }

    const formatPhone = formatTo254(phoneNumber);
    const fullName = `${firstName.toUpperCase()} ${surname.toUpperCase()}`;

    try {
        // 1. Verify Agent
        let agentDoc = await db.collection("users").doc(uid).get();
        if (!agentDoc.exists) {
            // Try query by 'uid' field if doc ID lookup failed (common if doc ID is phone number)
            const agentSnap = await db.collection("users").where("uid", "==", uid).limit(1).get();
            if (agentSnap.empty) {
                throw new HttpsError('permission-denied', 'Unauthorized. Agent profile not found.');
            }
            agentDoc = agentSnap.docs[0];
        }
        
        const agentData = agentDoc.data();
        const isTestAgent = isTestNumber(agentData.phoneNumber || agentDoc.id);

        if (!isTestAgent && !['agent', 'master_agent', 'super_master'].includes(agentData.role)) {
            throw new HttpsError('permission-denied', 'Unauthorized. Only agents can register users.');
        }
        
        const agentCode = (agentData.agent_code || agentData.phoneNumber || agentDoc.id).toString().toUpperCase().replace('+', '');

        const intlPhone = `+${formatPhone}`;
        const isTestUserEntry = isTestNumber(intlPhone);
        
        let userExists = await db.collection("users").doc(intlPhone).get();
        let userExistsDoc = await db.collection("users").doc(intlPhone).get();
        if (!userExistsDoc.exists) {
             // Fallback to legacy formats for registration block
             userExistsDoc = await db.collection("users").doc(formatPhone).get();
             if (!userExistsDoc.exists) {
                 userExistsDoc = await db.collection("users").doc(formatToLocal(phoneNumber)).get();
             }
        }

        if (userExistsDoc.exists && !isTestUserEntry) {
            throw new HttpsError('already-exists', 'A user with this phone number is already registered.');
        }

        // 3. Register User - Standardize on +254 doc ID
        const TIER_COSTS = { bronze: 50, silver: 147, gold: 229 };
        const registrationFee = 100;
        const totalAmount = registrationFee + TIER_COSTS[tier.toLowerCase()];

        const newUserRef = db.collection("users").doc(intlPhone);
        // Create user document with uppercase normalization
        await newUserRef.set({
            uid: null, // Will be set if user signs up via Firebase Auth later
            phoneNumber: intlPhone, // Standardized to intl
            localPhoneNumber: formatToLocal(phoneNumber),
            firstName: firstName.toString().toUpperCase(),
            surname: surname.toString().toUpperCase(),
            fullName: `${firstName} ${surname}`.trim().toUpperCase(),
            national_id: idNumber.toString().toUpperCase(),
            role: 'guardian',
            active_tier: tier.toLowerCase(),
            status: isTestUserEntry ? 'active' : 'pending_payment',
            recruited_by: agentCode,
            id_photo_url: photoUrl || null,
            photoURL: photoUrl || null, // Standardized portrait field
            registration_fee_paid: isTestUserEntry ? true : false, // Use isTestUserEntry for payment status
            masterAgentId: agentData.masterAgentId || null,
            superMasterId: agentData.superMasterId || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            profile_completed: false // User needs to complete profile after payment
        });

        // 4. Send SMS via Africa's Talking
        try {
            const sms = africastalking.SMS;
            await sms.send({
                to: [formatPhone],
                message: `Hazina: Karibu ${firstName}! You've been registered by agent ${agentCode}. Sign in at https://myhazina.org/login to manage your family protection shield.`
            });
            console.log(`Welcome SMS sent to ${formatPhone}`);
        } catch (smsError) {
            console.error("SMS Error during registration:", smsError);
        }

        // 5. Trigger SasaPay STK Push (Skip for test numbers to satisfy "assume payment went thru")
        let stkResult = { status: 'skipped_for_test' };
        if (!isTestNumber) {
            stkResult = await initiateSasapayC2B(formatPhone, totalAmount, formatPhone);
        }

        return { 
            success: true, 
            userId: formatPhone,
            stkStatus: stkResult.status,
            isTest: isTestNumber,
            message: isTestNumber ? 
                `Test Mode: Enrollment for ${fullName} finalized immediately.` : 
                `User ${fullName} registered. STK Push of KSh ${totalAmount} initiated.`
        };

    } catch (error) {
        console.error("Agent Registration Error:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || 'Registration flow failed.');
    }
});

// TEMPORARY: Create test account for verification
exports.createTestUser = onCall({ cors: true }, async (request) => {
    try {
        const testPhone = '+254105845108';
        await db.collection('users').doc(testPhone).set({
            fullName: 'TEST SUPER MASTER',
            phoneNumber: testPhone,
            role: 'super_master',
            status: 'active',
            profile_completed: true,
            registration_fee_paid: true,
            active_tier: 'gold',
            agent_code: 'TEST001',
            walletBalance: 1000,
            createdAt: new Date()
        }, { merge: true });

        return { success: true, message: "Test user created/updated as SUPER MASTER" };
    } catch (error) {
        throw new HttpsError('internal', error.message);
    }
});

// TEMPORARY: Backfill missing data in recruitment logs
exports.backfillRecruitmentLogs = onCall({ cors: true, memory: "512MiB" }, async (request) => {
    try {
        const logsSnap = await db.collection("recruitment_logs").get();
        let updatedCount = 0;
        let skipCount = 0;

        const updates = logsSnap.docs.map(async (logDoc) => {
            const data = logDoc.data();
            const logId = logDoc.id;
            
            // Check if log is missing critical fields or has faulty agentId
            const needsRepair = !data.userName || !data.agentId || data.agentId === "undefined";
            
            if (needsRepair) {
                const updatePayload = {};
                
                // 1. Repair agentId from originalAgentInput or logId if possible
                if (!data.agentId || data.agentId === "undefined") {
                    const recoveredId = data.originalAgentInput || logId.split('_')[1];
                    if (recoveredId && recoveredId !== "undefined") {
                        updatePayload.agentId = recoveredId.toUpperCase();
                    }
                }

                // 2. Repair userName and tier from user doc
                if (data.userId) {
                    const userDoc = await db.collection("users").doc(data.userId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        updatePayload.userName = userData.fullName || data.userName || 'Member';
                        updatePayload.tier = userData.active_tier || data.tier || 'bronze';
                        updatePayload.commissionEarned = data.tariffApplied || 15;
                    }
                }

                if (Object.keys(updatePayload).length > 0) {
                    await logDoc.ref.update(updatePayload);
                    updatedCount++;
                } else {
                    skipCount++;
                }
            } else {
                skipCount++;
            }
        });

        await Promise.all(updates);

        return { 
            success: true, 
            message: `Backfill complete. Updated: ${updatedCount}, Skipped/Already OK: ${skipCount}` 
        };
    } catch (error) {
        throw new HttpsError('internal', error.message);
    }
});

/**
 * SURGICAL DATA RESET (Debug Utility)
 * Only wipes recruitment-related data and resets agent stats.
 */
exports.debugPulseReset = onCall({ cors: true }, async (request) => {
    // Basic auth check
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Management authentication required.');
    }

    try {
        console.log('🚀 Starting surgical cleanup via Cloud Function...');
        
        // 1. Delete all recruitment logs
        const logsRef = db.collection('recruitment_logs');
        // The instruction provided a query for `collection(db, 'recruitment_logs')` and `where('masterAgentId', 'in', allMasterIds)`.
        // This implies filtering logs related to a specific master agent.
        // For a "surgical data reset" that wipes *all* recruitment logs, we would iterate and delete.
        // If the intent is to only delete logs *for a specific master agent*, then the query should be used.
        // Assuming "Delete all recruitment logs" means ALL, the original implementation is correct.
        // If it meant "delete logs related to the master agent identified by allMasterIds", then the query would be needed.
        // Sticking to the original intent of "Delete all recruitment logs" for a full reset.
        const logsSnap = await logsRef.get();
        const deleteLogs = logsSnap.docs.map(doc => doc.ref.delete());
        
        // 2. Clear counters for agents
        const agentsRef = db.collection('agents');
        const agentsSnap = await agentsRef.get();
        const resetAgents = agentsSnap.docs.map(doc => doc.ref.update({
            totalSignups: 0,
            walletBalance: 0,
            totalEarnings: 0,
            lastSignupAt: null
        }));

        // 3. Reset stats for professional users and delete standard recruited members
        const usersRef = db.collection('users');
        const allUsersSnap = await usersRef.get();
        
        let deletedCount = 0;
        let resetCount = 0;
        
        const userOps = allUsersSnap.docs.map(async (doc) => {
            const data = doc.data();
            const isProfessional = data.role === 'agent' || data.role === 'master' || data.role === 'super_master';
            const isRecruited = data.recruited_by != null;

            if (isProfessional) {
                await doc.ref.update({
                    totalSignups: 0,
                    walletBalance: 0,
                    totalEarnings: 0,
                    lastSignupAt: null
                });
                resetCount++;
            } else if (isRecruited) {
                await doc.ref.delete();
                deletedCount++;
            }
        });

        await Promise.all([...deleteLogs, ...resetAgents, ...userOps]);

        return { 
            success: true, 
            message: `Environment Reset! Removed ${deletedCount} members, cleared ${logsSnap.size} logs, reset ${resetAgents.length} agent files.` 
        };
    } catch (error) {
        console.error("Pulse Reset Error:", error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Triggers when a new dependent is added.
 * Checks if the guardian has auto-pay enabled and calculates the mismatch.
 */
exports.onDependentCreated = onDocumentCreated("dependents/{depId}", async (event) => {
    const depData = event.data.data();
    const guardianId = depData.guardian_id;
    
    if (!guardianId) return;

    try {
        const userRef = db.collection("users").doc(guardianId);
        const userSnap = await userRef.get();
        if (!userSnap.exists) return;

        const profile = userSnap.data();
        
        // Calculate new burn
        const selfCost = await getTierCost(profile.active_tier || 'bronze');
        let totalBurn = selfCost;
        
        const dependentsSnap = await db.collection("dependents")
            .where("guardian_id", "==", guardianId)
            .get();
            
        for (const doc of dependentsSnap.docs) {
            const d = doc.data();
            const cost = await getTierCost(d.active_tier || 'bronze');
            totalBurn += cost;
        }

        // Check for Ratiba mismatch
        const activeSO = await getActiveStandingOrder(guardianId);
        const soAmount = activeSO ? Number(activeSO.amount) : 0;
        
        // Update user profile with latest burn requirements
        await userRef.update({
            required_daily_burn: totalBurn,
            ratiba_mismatch: soAmount < totalBurn,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Updated burn req for ${guardianId}: Total ${totalBurn}, SO Amount ${soAmount}`);
        
    } catch (error) {
        console.error("Error in onDependentCreated:", error);
    }
});
