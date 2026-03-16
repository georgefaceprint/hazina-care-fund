const axios = require('axios');

// SasaPay Credentials (DEBUG)
const SASAPAY_CLIENT_ID = 'B1tnESQjLEyaGAG9KXf7Og9vf7DLDpfL1Fkc7sgZ';
const SASAPAY_CLIENT_SECRET = 'aqRafb6tWAjw0MWVCllHIsk7AygSKylMwPR81VaoeevldIScPFx8qPX2GySaVvcBEwxbkgWGOZmsmcMlgfP41T8PXha4sEPCx7PUI6QX2as1lXr1CWK6RadskX9RpRzN';
const SASAPAY_MERCHANT_CODE = '600980';
const SASAPAY_BASE_URL = 'https://sandbox.sasapay.app/api/v1';

const testPhone = '254793717860';

async function testEndpoints() {
    try {
        console.log('--- 1. Authenticating ---');
        const auth = Buffer.from(`${SASAPAY_CLIENT_ID}:${SASAPAY_CLIENT_SECRET}`).toString('base64');
        const authRes = await axios.get(`${SASAPAY_BASE_URL}/auth/token/?grant_type=client_credentials`, {
            headers: { Authorization: `Basic ${auth}` }
        });
        const token = authRes.data.access_token;
        console.log('✅ Auth Success.');

        const payload = {
            MerchantCode: SASAPAY_MERCHANT_CODE,
            NetworkCode: "63902",
            Amount: "10",
            Currency: "KES",
            PhoneNumber: testPhone,
            CallBackURL: "https://example.com/callback",
            TransactionDesc: "Hazina Ratiba Test",
            AccountReference: "TEST-RATIBA-001",
            Frequency: "DAILY",
            MerchantRequestID: `TEST-${Date.now()}`
        };

        const endpoints = [
            '/payments/standing-order/',
            '/payments/standing-orders/',
            '/payments/request-payment/', // Some docs say use this with Frequency
            '/payments/subscription-payments/',
            '/payments/approved/'
        ];

        for (const endpoint of endpoints) {
            console.log(`\n--- Testing Endpoint: ${endpoint} ---`);
            try {
                const res = await axios.post(`${SASAPAY_BASE_URL}${endpoint}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log(`✅ Success for ${endpoint}`);
                console.log('Response:', JSON.stringify(res.data, null, 2));
                break; // Stop if we find one that works (not 404)
            } catch (err) {
                console.log(`❌ Error for ${endpoint}: ${err.response?.status} - ${err.response?.statusText}`);
                if (err.response?.data) {
                    console.log('Detail:', JSON.stringify(err.response.data, null, 2));
                }
            }
        }

    } catch (error) {
        console.error('\n❌ CRITICAL ERROR:', error.response?.data || error.message);
    }
}

testEndpoints();
