const axios = require("axios");

// VERY IMPORTANT: Replace these with your actual Safaricom Daraja Sandbox keys
const DARAJA_CONSUMER_KEY = "dynrvGIy2cFwJStWnB7m9gNJAON7V7AITncKbczTvJIZDd69";
const DARAJA_CONSUMER_SECRET = "EI9ygGKeyl62BxioiKQoZwlp9vvdGR0siA9E1ypDZ7RS9McvPcMS7rHLPdQC6otb";
const DARAJA_SHORTCODE = "174379"; // default sandbox shortcode
const DARAJA_PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"; // default sandbox passkey
const CALLBACK_URL = "https://mydomain.com/callback"; // Dummy URL just for this local test

async function generateAccessToken() {
    const credentials = Buffer.from(`${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`).toString("base64");
    try {
        const response = await axios.get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
            headers: { Authorization: `Basic ${credentials}` }
        });
        return response.data.access_token;
    } catch (error) {
        console.error("Error generating access token:", error.response ? error.response.data : error.message);
        throw error;
    }
}

async function testSTKPush(phoneNumber, amount) {
    try {
        console.log(`Initialising M-Pesa STK Push for ${phoneNumber} with Ksh ${amount}...`);

        if (DARAJA_CONSUMER_KEY === "YOUR_REAL_CONSUMER_KEY_HERE") {
            console.error("❌ ERROR: You haven't added your real Consumer Key to this script yet!");
            return;
        }

        // Format to 254...
        let formattedPhone = phoneNumber;
        if (formattedPhone.startsWith("0")) formattedPhone = "254" + formattedPhone.substring(1);
        if (formattedPhone.startsWith("+")) formattedPhone = formattedPhone.substring(1);

        const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, -3);
        const password = Buffer.from(`${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${timestamp}`).toString("base64");

        const token = await generateAccessToken();
        console.log("✅ Access token generated securely!");

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
            AccountReference: `HazinaTests`,
            TransactionDesc: "Hazina Care Local Test"
        };

        const response = await axios.post("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", pushData, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("\n✅ STK PUSH REQUEST SUCCESSFUL!");
        console.log(response.data);
        console.log(`\n📲 Check the phone number (${phoneNumber}) - You should receive a prompt momentarily!`);

    } catch (error) {
        console.error("\n❌ STK Push error: ");
        console.error(error.response ? error.response.data : error.message);
    }
}

// Run the test
testSTKPush("0793717860", 1);
