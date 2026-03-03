const { onRequest, onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

const WHITELISTED_IPS = [
  '196.201.214.200', '196.201.214.206', '196.201.213.114', 
  '196.201.214.207', '196.201.214.208', '196.201.213.44', 
  '196.201.212.127', '196.201.212.138', '196.201.212.129', 
  '196.201.212.136', '196.201.212.74', '196.201.212.69'
];

// --- 1. INITIATE STK PUSH (Called by PWA) ---
exports.initiateRegistration = onCall({ 
    secrets: ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_PASSKEY"] 
}, async (request) => {
    const { phoneNumber, fullName } = request.data;
    const shortCode = "YOUR_PAYBILL_OR_TILL"; // <--- CHANGE THIS
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    
    // Auth with Safaricom
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
    const tokenRes = await axios.get('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
        headers: { Authorization: `Basic ${auth}` }
    });
    
    const password = Buffer.from(`${shortCode}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');

    // Request STK Push
    const stk = await axios.post('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: 100,
        PartyA: phoneNumber,
        PartyB: shortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: "https://mpesacallback-YOUR_URL_HERE", // <--- UPDATE AFTER DEPLOY
        AccountReference: "HazinaReg",
        TransactionDesc: "Registration"
    }, { headers: { Authorization: `Bearer ${tokenRes.data.access_token}` } });

    // Log pending transaction
    await admin.firestore().collection('transactions').doc(stk.data.CheckoutRequestID).set({
        phoneNumber, fullName, status: 'PENDING', createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
});

// --- 2. MPESA CALLBACK (IP WHITELISTED) ---
exports.mpesaCallback = onRequest(async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    if (!WHITELISTED_IPS.includes(ip)) return res.status(403).send("Unauthorized IP");

    const callback = req.body.Body.stkCallback;
    if (callback.ResultCode === 0) {
        const snap = await admin.firestore().collection('transactions').doc(callback.CheckoutRequestID).get();
        const data = snap.data();

        // 180-DAY RULE CALCULATION
        const now = new Date();
        const matDate = new Date();
        matDate.setDate(now.getDate() + 180);

        await admin.firestore().collection('guardians').doc(data.phoneNumber).set({
            fullName: data.fullName,
            phoneNumber: data.phoneNumber,
            status: 'ACTIVE',
            joinedDate: admin.firestore.Timestamp.fromDate(now),
            maturationDate: admin.firestore.Timestamp.fromDate(matDate),
            activeTier: 'BRONZE'
        });
    }
    res.send({ ResultCode: 0, ResultDesc: "Success" });
});
