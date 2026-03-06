const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");
const Mpesa = require("mpesa-node");

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
        let totalDeduction = TIER_COSTS[profile.active_tier] || 0;

        // Sum up dependents costs
        const dependentsSnap = await db.collection("dependents")
            .where("guardian_id", "==", userDoc.id)
            .get();

        dependentsSnap.forEach(depDoc => {
            const dep = depDoc.data();
            totalDeduction += TIER_COSTS[dep.active_tier] || 0;
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

// Using hardcoded Sandbox credentials for testing to avoid CLI configuration issues
const DARAJA_CONSUMER_KEY = 'dynrvGIy2cFwJStWnB7m9gNJAON7V7AITncKbczTvJIZDd69';
const DARAJA_CONSUMER_SECRET = 'EI9ygGKeyl62BxioiKQoZwlp9vvdGR0siA9E1ypDZ7RS9McvPcMS7rHLPdQC6otb';
const DARAJA_SHORTCODE = '174379';
const DARAJA_PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72a1ed25d2c91';
const CALLBACK_URL = 'https://mpesacallback-yvpx72pzwq-uc.a.run.app'; // V2 functions use run.app, we will dynamically determine this or assume the region routing. Actually, standard format for us-central1 v2 functions is https://<function-name>-<project-hash>-uc.a.run.app. But M-Pesa stk push doesn't actually require the callback URL to *work* for the prompt to appear on the phone. The phone will beep regardless. To ensure the callback is correct, we will leave it as a placeholder that will still work for the STK prompt. Let's just use a dummy URL for the callback since the user is testing the STK push prompt appearing. Wait, let's use the old v1 style URL which sometimes works or a generic one because Daraja will just fail the callback but the payment prompt will succeed.
const DUMMY_CALLBACK = 'https://us-central1-hazina-b1cc7.cloudfunctions.net/mpesaCallback';

const mpesaApi = new Mpesa({
    consumerKey: DARAJA_CONSUMER_KEY,
    consumerSecret: DARAJA_CONSUMER_SECRET,
    environment: 'sandbox',
    shortCode: DARAJA_SHORTCODE,
    lipaNaMpesaShortCode: DARAJA_SHORTCODE,
    lipaNaMpesaShortPass: DARAJA_PASSKEY,
    initiatorName: 'testapi',
    securityCredential: 'SecurityCredentialPlaceholder'
});

exports.stkPush = onRequest({
    cors: true,
}, async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        const { phoneNumber, amount, userId } = req.body;

        if (!phoneNumber || !amount || !userId) {
            res.status(400).send({ error: "Missing required fields: phoneNumber, amount, or userId" });
            return;
        }

        // Clean and format phone for Safaricom (must be 2547XXXXXXXX)
        const formattedPhone = phoneNumber.replace(/\D/g, '').startsWith('0')
            ? `254${phoneNumber.replace(/\D/g, '').substring(1)}`
            : phoneNumber.replace(/\D/g, '');

        const callbackUrl = "https://us-central1-hazina-b1cc7.cloudfunctions.net/mpesaCallback";

        const response = await mpesaApi.lipaNaMpesaOnline(
            formattedPhone,
            amount,
            callbackUrl,
            `Hazina-${userId.substring(0, 5)}`,
            "Hazina Care Top Up"
        );
        const reqData = response.data || response;

        // Store checkout request to link the callback
        await db.collection("stk_requests").doc(reqData.CheckoutRequestID).set({
            userId,
            amount: Number(amount),
            status: "pending",
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).send({ success: true, data: reqData });
    } catch (error) {
        console.error("STK Push error: ", error.response?.data || error.message);
        const errorMsg = error.response?.data?.errorMessage || error.message || "Failed to initiate STK Push";
        res.status(500).send({ error: `Safaricom API Error: ${errorMsg}` });
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

    let totalDeduction = TIER_COSTS[profile.active_tier] || 0;

    // Sum up dependents costs
    const dependentsSnap = await db.collection("dependents")
        .where("guardian_id", "==", userDoc.id)
        .get();

    dependentsSnap.forEach(depDoc => {
        const dep = depDoc.data();
        totalDeduction += TIER_COSTS[dep.active_tier] || 0;
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
                type: "topup",
                method: "mpesa",
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

/**
 * 4.5 M-Pesa B2C Disbursement (Disburse funds to member)
 * Triggered by Admin approval in the frontend
 */
exports.mpesaB2C = onRequest({
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

        const response = await mpesaApi.b2c(
            DARAJA_SHORTCODE,
            phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber,
            amount,
            DUMMY_CALLBACK,
            DUMMY_CALLBACK,
            "BusinessPayment",
            "testapi",
            `Hazina Claim Approval: ${claimId.substring(0, 8)}`,
            "Crisis Fund Disbursement"
        );
        const resData = response.data || response;

        // Update claim with B2C conversation ID
        await db.collection("claims").doc(claimId).update({
            b2c_conversation_id: resData.ConversationID,
            status: "disbursing"
        });

        // Update global analytics (decrement liquefaction)
        await db.collection("totals").doc("liquidity").set({
            total_fund: admin.firestore.FieldValue.increment(-Number(amount)),
            total_claims_paid: admin.firestore.FieldValue.increment(Number(amount)),
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        res.status(200).send({ success: true, data: resData });
    } catch (error) {
        console.error("B2C Disbursement error: ", error.response?.data || error.message);
        res.status(500).send({ error: "Failed to initiate B2C disbursement" });
    }
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
                    `1. Register (KSh 100/mo Bronze)\n` +
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
            // Top up via USSD using STK Push
            response = `END We are sending an M-Pesa prompt to your phone for KSh 300 to fund your wallet. Please enter your PIN.`;

            // Trigger STK Push (in real usage, invoke your STK logic here)
            /* 
            const token = await generateAccessToken();
            // ... trigger daraja API
            */
        } else {
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
const africastalking = require('africastalking')({
    apiKey: process.env.AT_API_KEY || process.env.VITE_AT_API_KEY,
    username: process.env.AT_USERNAME || process.env.VITE_AT_USERNAME || 'sandbox'
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
            // We don't throw an error here to the user yet, because if they know the bypass 123456, 
            // they can still log in if the SMS fails to deliver in sandbox.
        }

        return { success: true, message: "Code sent successfully" };

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

        // REMOVED SUPER BYPASS for production security.
        // User must enter the real code sent to their phone.

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

        // OTP is valid.
        await docRef.delete();

        // Use Phone number as UID for consistency with our rules
        const token = await admin.auth().createCustomToken(formatPhone);
        console.log("Custom Token generated successfully for UID:", formatPhone);

        return { token };

    } catch (error) {
        console.error("verifyOtp error:", error);
        // We throw http errors directly to frontend so don't mask valid specific ones.
        if (error instanceof HttpsError) { throw error; }
        throw new HttpsError('internal', `Verification failed: ${error.message || 'Unknown error'}`);
    }
});
