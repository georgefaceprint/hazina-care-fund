# Hazina Platform: Systems Engineer Handover (Technical)

This document provides a technical deep-dive into the integrations powering Hazina. It is intended for systems engineers, backend developers, and DevSecOps personnel responsible for platform maintenance.

---

## 1. Cloud Architecture (Firebase)

The platform is a Serverless architecture deployed on **Firebase (GCP)**.

*   **Runtime**: Node.js 20 (Gen 2 Cloud Functions).
*   **Database**: Firestore (NoSQL) utilizing real-time snapshots and multi-document consistency.
*   **Authentication**: Firebase Auth (Phone Number) with cross-collection profile resolution.
*   **Primary Logic Hub**: `functions/index.js` - Contains the orchestration for all 3rd party APIs.

---

## 2. SasaPay Integration (Financial Layer)

Hazina uses **SasaPay** as the unified gateway for all fiat movements.

### A. C2B - Member Top-Ups (`sasapayC2B`)
*   **Method**: `HTTPS POST` (Request-Response).
*   **Logic**: Triggers an M-Pesa STK Push to the user.
*   **Validation**: Uses `formatTo254()` to ensure the MSISDN is compatible with the gateway.
*   **Callback**: The `callbackUrl` is directed to `exports.sasapayCallback`.

### B. B2C - Disbursements (`sasapayB2C`)
*   **Method**: `HTTPS POST`.
*   **Use Cases**:
    *   **Agent Commissions**: Instant payout of KSh 15 referral fees.
    *   **Claims**: Large-scale crisis payouts to members.
*   **Security**: Requires internal admin token verification and balance availability checks.

### C. The Callback Engine (`sasapayCallback`)
*   **Type**: Webhook (Asynchronous).
*   **Payload**: `MerchantRequestID`, `ResultCode`, `TransID`.
*   **Process**:
    1.  Verifies the transaction signature.
    2.  Locates the pending `transaction` document by `MerchantRequestID`.
    3.  Atomically increments the user's `walletBalance` and `totalContributions` in Firestore.
    4.  Triggers a success notification via SMS.

---

## 3. Africa's Talking Integration (Communication Layer)

Used for secure identity verification and transactional transparency.

*   **SDK**: `require('africastalking')`.
*   **SMS Layer**:
    *   **OTP**: Sent during registration and 2FA.
    *   **Alerts**: System notifies members of "Daily Burn" failures or successful top-ups.
*   **OTP Bypass**: A helper `isTestNumber()` allows internal testers and Google Play Reviewers to bypass SMS costs using code `123456`.

---

## 4. Ratiba / Standing Order Logic (Auto-Pay)

This is a business-logic integration between SasaPay mandates and Hazina wallets.

*   **Function**: `calculateDailyDeduction` (Cron @ 2:00 AM EAT).
*   **Logic**:
    1.  Calculates `totalBurn = (User Tier Cost) + (Dependents Tier Costs)`.
    2.  Queries the `Ratiba` (Standing Order) amount from the user's SasaPay profile.
    3.  **Conflict Resolution**: if `soAmount < totalBurn`, it sets `ratiba_mismatch: true`.
    4.  **Suspension**: If `walletBalance < totalBurn` and no active Ratiba, the shield is marked as `Inactive`.

---

## 5. Environment Variables & Security

Sensitive configuration is stored in `.env` and injected into the Cloud Runtime.

| Variable | Use Case |
| :--- | :--- |
| `SASAPAY_CLIENT_ID` / `SECRET` | OAuth token generation for SasaPay APIs. |
| `AT_USERNAME` / `API_KEY` | Authentication for Africa's Talking SMS/Voice. |
| `GENAI_API_KEY` | Powers the Sifuna AI support chatbot context. |
| `ENCRYPTION_KEY` | Used for hashing sensitive session identifiers. |

### Security Model:
*   **CORS**: Restricted to `hazina.com` origins.
*   **Rules**: Firestore Security Rules enforce that an Agent can ONLY read users where `recruited_by == AgentID`.

---

## 6. Maintenance & Monitoring

*   **Logs**: Visible via `gcloud functions logs read`.
*   **Repairs**: The `backfillRecruitmentLogs` function is the primary utility for repairing broken data trees or missing commissions.
*   **Health Checks**: Transaction summaries are emailed to HQ daily at 12:00 PM via a scheduled worker.

---
*Technical Handover Doc v2.1*
*Engineering Contact: Hazina Systems HQ*
