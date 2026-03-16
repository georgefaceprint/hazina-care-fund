const axios = require('axios');

// SasaPay Credentials
const SASAPAY_CLIENT_ID = 'B1tnESQjLEyaGAG9KXf7Og9vf7DLDpfL1Fkc7sgZ';
const SASAPAY_CLIENT_SECRET = 'aqRafb6tWAjw0MWVCllHIsk7AygSKylMwPR81VaoeevldIScPFx8qPX2GySaVvcBEwxbkgWGOZmsmcMlgfP41T8PXha4sEPCx7PUI6QX2as1lXr1CWK6RadskX9RpRzN';
const SASAPAY_MERCHANT_CODE = '9348463';
const SASAPAY_BASE_URL = 'https://sandbox.sasapay.app/api/v1';

const testPhone = '254793717860';

async function testSasaPayC2B() {
    try {
        console.log('--- 1. Authenticating with SasaPay ---');
        const auth = Buffer.from(`${SASAPAY_CLIENT_ID}:${SASAPAY_CLIENT_SECRET}`).toString('base64');
        const authRes = await axios.get(`${SASAPAY_BASE_URL}/auth/token/?grant_type=client_credentials`, {
            headers: { Authorization: `Basic ${auth}` }
        });



        const token = authRes.data.access_token;
        console.log('✅ Auth Success. Token acquired.');

        console.log(`\n--- 2. Initiating C2B for ${testPhone} ---`);
        const payload = {
            MerchantCode: SASAPAY_MERCHANT_CODE,
            NetworkCode: "63902", // M-Pesa
            "Transaction Fee": 0,
            Currency: "KES",
            Amount: "1.00",
            CallBackURL: "https://example.com/callback",
            PhoneNumber: testPhone,
            TransactionDesc: "Hazina Test Payment",
            AccountReference: "TEST-HAZINA-001"
        };

        const payRes = await axios.post(`${SASAPAY_BASE_URL}/payments/request-payment/`, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('✅ SasaPay Response:', JSON.stringify(payRes.data, null, 2));

        if (payRes.data.status) {
            console.log('\n🚀 SUCCESS! Please check your phone for the M-Pesa/SasaPay prompt.');
        } else {
            console.log('\n❌ FAILED:', payRes.data.detail || 'Unknown error');
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.response?.data || error.message);
    }
}

testSasaPayC2B();
