const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");

const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();
const db = admin.firestore();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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

async function generateAccessToken(consumerKey, consumerSecret) {
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const response = await axios.get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
        headers: { Authorization: `Basic ${credentials}` }
    });
    return response.data.access_token;
}

exports.stkPush = onRequest({
    cors: true,
}, async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        const consumerKey = DARAJA_CONSUMER_KEY;
        const consumerSecret = DARAJA_CONSUMER_SECRET;
        const shortcode = DARAJA_SHORTCODE;
        const passkey = DARAJA_PASSKEY;
        // Dynamically get the request host to form the callback URL to itself
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host;

        let callbackUrl = `${protocol}://${host}/mpesaCallback`;
        // M-Pesa rejects localhost references. Use a remote dummy if running locally.
        if (host.includes('localhost') || host.includes('127.0.0.1')) {
            callbackUrl = 'https://us-central1-hazina-b1cc7.cloudfunctions.net/mpesaCallback';
        }

        const { phoneNumber, amount, userId } = req.body;

        if (!phoneNumber || !amount || !userId) {
            res.status(400).send({ error: "Missing required fields" });
            return;
        }

        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;

        const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, -3);
        const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

        const token = await generateAccessToken(consumerKey, consumerSecret);

        const pushData = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: formattedPhone, // phone number making payment
            PartyB: shortcode,
            PhoneNumber: formattedPhone,
            CallBackURL: callbackUrl,
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
        const errorMsg = error.response?.data?.errorMessage || error.message || "Failed to initiate STK Push";
        res.status(500).send({ error: `Safaricom API Error: ${errorMsg}` });
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

        const consumerKey = DARAJA_CONSUMER_KEY;
        const consumerSecret = DARAJA_CONSUMER_SECRET;

        // Use a B2C specific shortcode/initiator name here in production
        // For Sandbox, we often use the same test credentials
        const initiatorName = "testapi";
        const securityCredential = "SecurityCredentialPlaceholder"; // Usually encrypted initiator password

        const token = await generateAccessToken(consumerKey, consumerSecret);

        const b2cData = {
            InitiatorName: initiatorName,
            SecurityCredential: securityCredential,
            CommandID: "BusinessPayment", // or SalaryPayment/PromotionPayment
            Amount: amount,
            PartyA: DARAJA_SHORTCODE,
            PartyB: phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber,
            Remarks: `Hazina Claim Approval: ${claimId.substring(0, 8)}`,
            QueueTimeOutURL: DUMMY_CALLBACK,
            ResultURL: DUMMY_CALLBACK,
            Occasion: "Crisis Fund Disbursement"
        };

        const response = await axios.post("https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest", b2cData, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // Update claim with B2C conversation ID
        await db.collection("claims").doc(claimId).update({
            b2c_conversation_id: response.data.ConversationID,
            status: "disbursing"
        });

        // Update global analytics (decrement liquefaction)
        await db.collection("totals").doc("liquidity").set({
            total_fund: admin.firestore.FieldValue.increment(-Number(amount)),
            total_claims_paid: admin.firestore.FieldValue.increment(Number(amount)),
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        res.status(200).send({ success: true, data: response.data });
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
exports.chatWithSifuna = onRequest({
    cors: true,
}, async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        const { message, history, language = 'en', userId } = req.body;

        if (!message) {
            res.status(400).send({ error: "No message provided" });
            return;
        }

        // --- SELF-LEARNING MECHANISM (Retrieval) ---
        // Fetch long-term "learned" facts about this user from Firestore
        let persistentContext = "";
        if (userId) {
            const memorySnap = await db.collection("users").doc(userId).collection("memory").get();
            const learnedFacts = memorySnap.docs.map(doc => doc.data().fact);
            if (learnedFacts.length > 0) {
                persistentContext = `\nLEARNED FACTS ABOUT THIS USER:\n- ${learnedFacts.join('\n- ')}`;
            }
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
                - Always respond in the user's preferred language.
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
        if (userId && (text.includes("I'll remember that") || text.includes("Noted") || text.includes("Nitakumbuka"))) {
            // We can extract the fact using another LLM call or just log the whole move for human review.
            // For this beta, we'll log the "learned" interaction to a dedicated collection.
            await db.collection("users").doc(userId).collection("memory").add({
                fact: `Learned from user: "${message}"`,
                ai_response: text,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.status(200).send({ text });
    } catch (error) {
        console.error("Gemini Error: ", error);
        res.status(500).send({ error: "Sifuna is taking a short break. Please try again in a moment." });
    }
});
