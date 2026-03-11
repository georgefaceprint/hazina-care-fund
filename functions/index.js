const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");
const { authenticator } = require("otplib");




const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();
const db = admin.firestore();

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
    const usersSnap = await db.collection("users").get();
    const TIER_COSTS = { bronze: 10, silver: 30, gold: 50 };

    const batch = db.batch();

    for (const userDoc of usersSnap.docs) {
        const profile = userDoc.data();
        const getCost = (tier) => TIER_COSTS[tier?.toLowerCase()] || 0;
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

        // Update global analytics
        const statsRef = db.collection("totals").doc("liquidity");
        batch.set(statsRef, {
            total_fund: admin.firestore.FieldValue.increment(-totalDeduction),
            total_burn: admin.firestore.FieldValue.increment(totalDeduction),
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
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

// --- 3. SasaPay Configuration (Kenya) ---
const SASAPAY_CLIENT_ID = process.env.SASAPAY_CLIENT_ID || 'B1tnESQjLEyaGAG9KXf7Og9vf7DLDpfL1Fkc7sgZ';
const SASAPAY_CLIENT_SECRET = process.env.SASAPAY_CLIENT_SECRET || 'aqRafb6tWAjw0MWVCllHIsk7AygSKylMwPR81VaoeevldIScPFx8qPX2GySaVvcBEwxbkgWGOZmsmcMlgfP41T8PXha4sEPCx7PUI6QX2as1lXr1CWK6RadskX9RpRzN';

const SASAPAY_MERCHANT_CODE = process.env.SASAPAY_MERCHANT_CODE || '600980'; // Default sandbox merchant code
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
const initiateSasapayC2B = async (phoneNumber, amount, userId, networkCode = "63902") => {
    const formattedPhone = phoneNumber.replace(/\D/g, '').startsWith('0')
        ? `254${phoneNumber.replace(/\D/g, '').substring(1)}`
        : phoneNumber.replace(/\D/g, '');

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
    const TIER_COSTS = { bronze: 10, silver: 30, gold: 50 };

    const getCost = (tier) => TIER_COSTS[tier?.toLowerCase()] || 0;
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

    // Update global analytics
    const statsRef = db.collection("totals").doc("liquidity");
    batch.set(statsRef, {
        total_fund: admin.firestore.FieldValue.increment(-totalDeduction),
        total_burn: admin.firestore.FieldValue.increment(totalDeduction),
        last_updated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
    return { success: true, newBalance, deduction: totalDeduction };
});

// 5. SasaPay Callback Handler (Unified)
exports.sasapayCallback = onRequest(async (req, res) => {
    try {
        console.log("SasaPay Callback Received:", JSON.stringify(req.body));

        const callbackData = req.body;
        const checkoutRequestId = callbackData.CheckoutRequestID;
        const resultCode = callbackData.ResultCode;

        if (!checkoutRequestId) {
            console.log("No CheckoutRequestID in callback body");
            res.status(200).send("Acknowledged");
            return;
        }

        const requestDocRef = db.collection("stk_requests").doc(checkoutRequestId);
        const requestDoc = await requestDocRef.get();

        if (!requestDoc.exists) {
            console.log(`CheckoutRequestID not found in DB: ${checkoutRequestId}`);
            res.status(200).send("Acknowledged");
            return;
        }

        const requestInfo = requestDoc.data();

        if (resultCode === "0" || resultCode === 0) {
            // Payment successful
            const amount = Number(callbackData.TransAmount || requestInfo.amount);
            const receipt = callbackData.TransactionCode || callbackData.ThirdPartyTransID || "UNKNOWN";

            const batch = db.batch();

            // 1. Update STK request
            batch.update(requestDocRef, {
                status: "completed",
                receipt,
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                rawCallback: callbackData
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
                type: "topup",
                method: "sasapay",
                provider: callbackData.SourceChannel || "UNKNOWN",
                receipt,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            await batch.commit();

            // 4. Update global analytics
            await db.collection("totals").doc("liquidity").set({
                total_fund: admin.firestore.FieldValue.increment(amount),
                total_topups: admin.firestore.FieldValue.increment(amount),
                last_updated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log(`Payment successful via SasaPay for user: ${requestInfo.userId}, Amount: ${amount}`);
        } else {
            // Payment failed or cancelled
            await requestDocRef.update({
                status: "failed",
                errorMsg: callbackData.ResultDesc,
                rawCallback: callbackData
            });
            console.log(`Payment failed: ${callbackData.ResultDesc}`);
        }

        res.status(200).send("Success");
    } catch (error) {
        console.error("SasaPay Callback processing error: ", error);
        res.status(200).send("Acknowledged with error");
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
            ReceiverNumber: phoneNumber.replace(/\D/g, ''),
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
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    // Verify user is an admin
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists || userSnap.data().role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can setup TOTP.');
    }

    const secret = authenticator.generateSecret();
    const userEmail = userSnap.data().email || "admin@hazinacare.org";
    const otpauth = authenticator.keyuri(userEmail, "Hazina Care", secret);

    // We don't save it yet. The user must verify a code first.
    return { 
        secret, 
        otpauth,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`
    };
});

/**
 * Verifies a TOTP token and enables it for the admin if valid.
 */
exports.verifyAndEnableTotp = onCall({ cors: true }, async (request) => {
    const { token, secret, isInitialSetup } = request.data;
    const uid = request.auth?.uid;

    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
    }

    let effectiveSecret = secret;

    // If not initial setup, we use the secret stored in DB
    if (!isInitialSetup) {
        effectiveSecret = userSnap.data().totpSecret;
        if (!effectiveSecret) {
            throw new HttpsError('failed-precondition', 'TOTP is not set up for this account.');
        }
    }

    const isValid = authenticator.check(token, effectiveSecret);

    if (!isValid) {
        throw new HttpsError('invalid-argument', 'Invalid verification code.');
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
        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

        // Get user profile
        const usersSnap = await db.collection("users").where("phoneNumber", "==", formattedPhone).limit(1).get();
        const userExists = !usersSnap.empty;
        let profile = userExists ? usersSnap.docs[0].data() : null;
        let userId = userExists ? usersSnap.docs[0].id : null;

        let response = "";

        if (text === "") {
            // First time accessing the USSD menu
            if (userExists) {
                const balance = profile.balance || 0;
                response = `CON Welcome to Hazina Care\n` +
                    `Your balance: KSh ${balance}\n` +
                    `1. Check Shield Status\n` +
                    `2. Claim Crisis Fund\n` +
                    `3. Add Dependent\n` +
                    `4. Top Up Wallet`;
            } else {
                response = `CON Welcome to Hazina Care.\n` +
                    `Register to protect your family.\n` +
                    `1. Register (KSh 300/mo Bronze)\n` +
                    `2. Learn More`;
            }
        } else if (text === "1") {
            if (userExists) {
                // Check Shield Status
                const now = new Date();
                const graceExpiry = profile.grace_period_expiry.toDate();
                if (graceExpiry <= now) {
                    response = `END Your Hazina Shield is FULLY ACTIVE.\nTier: ${profile.active_tier.toUpperCase()}`;
                } else {
                    const waitDays = Math.ceil((graceExpiry - now) / (1000 * 60 * 60 * 24));
                    response = `END Your Hazina Shield is IN WAITING.\nMatures in ${waitDays} days. Keep paying your daily contribution!`;
                }
            } else {
                // Register flow
                response = `CON Enter your National ID number:`;
            }
        } else if (text === "2" && userExists) {
            // Claim flow
            const graceExpiry = profile.grace_period_expiry.toDate();
            if (graceExpiry > new Date()) {
                response = `END Sorry, your shield is still maturing. You can claim after your 180-day grace period ends.`;
            } else {
                response = `CON Select Claim Type:\n1. Medical Crisis\n2. Bereavement\n3. School Fees`;
            }
        } else if (text === "4" && userExists) {
            // Top up via USSD using SasaPay C2B
            response = `END We are sending an M-Pesa prompt to your phone for KSh 300 to fund your wallet. Please enter your PIN.`;

            // Trigger SasaPay C2B
            try {
                await initiateSasapayC2B(phoneNumber, 300, userId);
            } catch (ussdPayError) {
                console.error("USSD Pay Error:", ussdPayError);
            }
        }
        else {
            response = "END Invalid option selected. Please dial again.";
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
                    * Bronze: KSh 10/day, KSh 15,000 cover.
                    * Silver: KSh 30/day, KSh 50,000 cover.
                    * Gold: KSh 50/day, KSh 150,000 cover.
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
        console.log("SEND_OTP_CALLED for:", phoneNumber);

        if (!phoneNumber) {
            throw new HttpsError('invalid-argument', 'Phone number is required.');
        }

        const formatPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
        console.log("Formatted Phone:", formatPhone);

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
        const code = Math.floor(100000 + Math.random() * 900000).toString();

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

        return { success: true, totpEnabled: false, message: "Code sent successfully" };

    } catch (error) {
        console.error("sendOtp error:", error);
        throw new HttpsError('internal', error.message || 'Failed to initiate OTP.');
    }
});

exports.verifyOtp = onCall({ cors: true }, async (request) => {
    try {
        const { phoneNumber, validationCode } = request.data;
        console.log("VERIFY_OTP_CALLED for:", phoneNumber, "with code:", validationCode);

        if (!phoneNumber || !validationCode) {
            throw new HttpsError('invalid-argument', 'Phone number and code are required.');
        }

        const formatPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
        let shouldProduceToken = false;

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
            // TEST BYPASS: Allows 123456 for easier onboarding during this phase
            if (String(validationCode) === '123456') {
                console.log("Using Test OTP Bypass for:", formatPhone);
                shouldProduceToken = true;
                // Delete any existing real OTP for this number so it doesn't linger
                await db.collection('otp_codes').doc(formatPhone).delete().catch(() => { });
            } else {
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

                if (data.code !== String(validationCode)) {
                    console.warn("Code mismatch! Entered:", validationCode, "Expected:", data.code);
                    throw new HttpsError('invalid-argument', 'Invalid OTP code.');
                }

                shouldProduceToken = true;
                await docRef.delete();
            }
        }

        if (shouldProduceToken) {
            // Use Phone number as UID for consistency with our rules
            const token = await admin.auth().createCustomToken(formatPhone);
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

/**
 * Super Master / Master Agent Recruitment Processor
 * Triggered when a new user profile is created.
 */
exports.onUserCreated = onDocumentCreated("users/{userId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const newUser = snapshot.data();
    const userId = event.params.userId;
    const agentCode = newUser.recruited_by;

    if (!agentCode) return;

    try {
        const agentDoc = await db.collection("agents").doc(agentCode).get();
        if (!agentDoc.exists) {
            console.log(`Agent ${agentCode} not found in DB.`);
            return;
        }

        const agentData = agentDoc.data();
        const masterAgentId = agentData.masterAgentId || null;
        const tariff = agentData.tariffRate || 15;

        // Log the recruitment record
        await db.collection("recruitment_logs").add({
            userId,
            agentId: agentCode,
            masterAgentId,
            tariffApplied: tariff,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update Agent's total count
        await db.collection("agents").doc(agentCode).update({
            totalSignups: admin.firestore.FieldValue.increment(1),
            lastSignupAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`User ${userId} recruited by ${agentCode} processed.`);
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

    if (!amount || amount < 50) {
        throw new HttpsError('invalid-argument', 'Minimum withdrawal is KSh 50.');
    }

    const formatPhone = phoneNumber.replace(/\D/g, '').startsWith('0')
        ? `254${phoneNumber.replace(/\D/g, '').substring(1)}`
        : phoneNumber.replace(/\D/g, '');

    try {
        // 1. Find user to get their agent_code
        // Note: Auth UID is the phone number for SMS users
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) {
            throw new HttpsError('not-found', 'User profile not found.');
        }

        const userData = userDoc.data();
        const agentCode = userData.agent_code || userData.phoneNumber || uid;

        // 2. Check Agent Balance
        const agentRef = db.collection("agents").doc(agentCode);
        const agentDoc = await agentRef.get();

        if (!agentDoc.exists) {
            throw new HttpsError('not-found', 'Agent record not found.');
        }

        const agentData = agentDoc.data();
        const currentBalance = agentData.walletBalance || 0;

        if (currentBalance < amount) {
            throw new HttpsError('failed-precondition', `Insufficient wallet balance. Available: KSh ${currentBalance}`);
        }

        // 3. Initiate SasaPay B2C
        const token = await getSasapayToken();
        const callbackUrl = "https://sasapaycallback-l5mloh4jka-uc.a.run.app";

        const payload = {
            MerchantCode: SASAPAY_MERCHANT_CODE,
            MerchantTransactionReference: `WD-${Date.now().toString().substring(5)}`,
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
            // 4. Update Balance and Log
            await agentRef.update({
                walletBalance: admin.firestore.FieldValue.increment(-amount)
            });

            await db.collection("recruitment_logs").add({
                agentId: agentCode,
                type: 'withdrawal',
                amount: amount,
                phoneNumber: formatPhone,
                status: 'processing',
                transactionReference: response.data.TransactionReference,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, message: "Withdrawal initiated successfully." };
        } else {
            throw new HttpsError('internal', response.data.detail || "SasaPay B2C failed.");
        }

    } catch (error) {
        console.error("Withdrawal Error:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || 'Withdrawal failed.');
    }
});
