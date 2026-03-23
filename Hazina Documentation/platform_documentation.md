# Hazina Platform: Full Workflow Documentation (A-Z)

## 1. Executive Summary
Hazina is a community-driven digital protection fund designed for the Kenyan market. It operates as a sophisticated mutual-aid shield combining mobile payments (SasaPay), real-time recruitment hierarchies, and automated claims processing.

---

## 2. Organizational Hierarchy & Roles

### A. Super Master Agent (Global HQ)
*   **Role**: Top-level administrator with global network oversight.
*   **Key Capabilities**:
    *   Register and Manage Master Agents.
    *   System-wide analytics (Global Signups, Total Payouts, Total Field Strength).
    *   Authorization of major claims and financial audits.
    *   Triggering global data repairs and diagnostic utilities.

### B. Master Agent (Regional Leader)
*   **Role**: Regional manager responsible for specific geographic zones (e.g., Nairobi West, Mombasa).
*   **Key Capabilities**:
    *   Build and manage a team of Field Agents.
    *   View regional performance heatmaps and recruitment metrics.
    *   Performance monitoring for their entire tree (Team totals).
    *   *No direct commission* from signups (Management focuses).

### C. Field Agent (Recruiter)
*   **Role**: Direct sales and recruitment personnel working on the ground.
*   **Key Capabilities**:
    *   The primary interface for new user registration.
    *   Unique referral link (QR code/Short URL: `hazina.com/r/AGENT_CODE`).
    *   **Earnings**: KSh 15 commission per standardized user signup.
    *   Consolidated Agent Wallet with instant balance updates.

### D. User / Guardian (The Member)
*   **Role**: The end customer paying for protection (e.g., Medical, Funeral, or Education crisis).
*   **Key Capabilities**:
    *   Subscription to a "Shield" (Bronze, Silver, or Gold).
    *   Daily/Monthly contributions via M-Pesa.
    *   Adding dependents (up to 7) to their protection tier.
    *   Submitting claims for crisis payouts once the shield "matures" (180 days).

---

## 3. The Recruitment Lifecycle

### Step 1: Registration
The journey begins when a Field Agent registers a new Member.
*   The system captures the **Recruiter identity** (Phone or `agent_code`).
*   **ID Standardization**: All phone numbers are automatically converted to the canonical E.164 format (`+254...`).
*   **Auto-Migration**: Legacy non-formatted IDs are detected and migrated to the standard format upon initial login for data integrity.

### Step 2: Verification (`onUserCreated` Trigger)
As soon as the user record is written to Firestore, a Cloud Function triggers:
1.  **Identity Resolution**: Resolves the Recruiter ID (Agent Code vs Phone Number variations).
2.  **Hierarchy Discovery**: Traces the Agent back to their Master Agent and Super Master.
3.  **Revenue Distribution**:
    *   Field Agent: Credited KSh 15 + increment signup count.
    *   Master Agent: Increment signup count (no commission).
    *   Super Master: Global stats incremented.
4.  **Logging**: A unique `recruitment_log` entry is created for auditing.

---

## 4. The Protection Lifecycle (Financial Flow)

### A. Wallet Management
Members maintain a "Shield Balance."
*   **Funding**: STK Push via SasaPay M-Pesa interface.
*   **Daily Burn**: Every night at 2:00 AM, the system calculates the "Daily Cost of Protection" based on the member's tier and number of dependents.
*   **Shield Status**:
    *   **Green**: Sufficient funds; protection is active.
    *   **Red/Mismatch**: Insufficient funds; protection is suspended.

### B. Maturation & Claims
A shield must be maintained for **180 days (6 months)** before it is considered "matured" and eligible for payouts.
1.  **Claim Trigger**: Member undergoes a crisis (e.g., hospitalization).
2.  **Submission**: Uploads documentation (ID copy, medical bills, discharge summary).
3.  **Review**: Admin audits the evidence and shield history.
4.  **Payout**: If approved, funds are disbursed via SasaPay API directly to the user's M-Pesa.

---

## 5. Technical Stack Overview

*   **Frontend Framework**: React 18 (Vite-based PWA).
*   **State Management**: Unified `AuthContext` with recursive profile resolution.
*   **Serverless Layer**: Node.js 20 Cloud Functions (Callable, HTTPS, and Triggers).
*   **Database**: Firestore (NoSQL) with sub-second synchronization.
*   **File Storage**: Firebase Storage with secure URL generation.
*   **Payment Gateway**: SasaPay (Unified STK and Disbursement).
*   **Standardization Utility**: Persistent regex-based ID normalization logic (`formatTo254`).

---

## 6. System Workflows (Simplified)

### Member Recruitment
`AGENT QR` -> `USER SIGNUP` -> `CLOUDFUNC TRIGGER` -> `ID STANDARDIZED` -> `AGENT PAID` -> `STATS UPDATED`

### Shield Contribution
`TOPUP` -> `STK PUSH` -> `SASAPAY CALLBACK` -> `WALLET UPDATE` -> `DAILY DEDUCTION (CRON)` -> `PROTECTION ACTIVE`

### Claim Disbursement
`SUBMIT EVIDENCE` -> `ADMIN REVIEW` -> `APPRAISAL` -> `DISBURSEMENT API` -> `USER M-PESA` 

---

## 7. System Integrations Appendix (Infrastructure & 3rd Party)

### A. SasaPay (Financial Core)
*   **Purpose**: The primary liquidity and disbursement gateway.
*   **C2B (Consumer-to-Business)**: Triggers M-Pesa STK Push for real-time wallet funding and initial onboarding fees.
*   **B2C (Business-to-Consumer)**: Automates payouts for approved claims and Agent commission withdrawals.
*   **Callback Handling**: Secure webhook listeners in Cloud Functions for real-time transaction reconciliation.

### B. Africa's Talking (Communications)
*   **Purpose**: Identity verification and system-to-human alerting.
*   **SMS Layer**: Delivers One-Time Passwords (OTPs) for secure login and onboarding.
*   **Status Alerts**: Notifies agents of successful recruitments and members of shield status changes.
*   **2FA Logic**: Provides a fallback security layer for the Super Master and Administrative portals.

### C. Ratiba (SasaPay Standing Orders)
*   **Purpose**: Recurring billing and auto-pay automation.
*   **Subscription Engine**: Members can authorize "Standing Orders" to automatically fund their shields.
*   **Mismatch Detection**: Internal logic that warns members if their Ratiba amount (`KES X`) is insufficient to cover their current `Daily Burn` (Self + Dependents).
*   **Continuous Shield**: Ensures 100% protection uptime by preventing balance drop-offs.

### D. Sifuna Chatbot (Integrated AI Support)
*   **Purpose**: Tiered member support and platform navigation help.
*   **AI Context**: Trained on Hazina's specific rules (Grace periods, Tiers, Claims) to provide instant answers to members.
*   **Deep Linking**: Can guide users directly to top-up, claim, or setting pages within the PWA.

### E. Firebase Cloud Infrastructure
*   **Authentication**: Secure, phone-based identity tokenization.
*   **Firestore**: Sub-second real-time database with multi-regional redundancy.
*   **Cloud Functions (Gen 2)**: The "brain" of the platform handling hierarchy resolution, repairs, and scheduled tasks (Daily Burn).
*   **Cloud Storage**: High-fidelity document storage for medical records and ID evidence.

---
*Document Version: 2.2 - March 2026*
*Prepared for: Hazina Global HQ*
