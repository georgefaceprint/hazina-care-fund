---
description: USSD Menu Workflow and Testing Guide
---

# Hazina Care USSD Workflow

This document outlines the USSD menu structure and confirms the active credentials for testing.

## 1. Visual Workflow

```mermaid
graph TD
    Start[*384#] --> CheckUser{User Exists?}
    
    CheckUser -- Yes --> MemberMenu[Member Menu]
    MemberMenu --> M1[1. Check Shield]
    MemberMenu --> M2[2. Claim Fund]
    MemberMenu --> M3[3. Add Dependent]
    MemberMenu --> M4[4. Topup Wallet]
    MemberMenu --> M5[5. Standing Order]
    
    M1 --> ShieldRes[Status: Active/Waiting]
    M2 --> ClaimType[Select: Medical/Bereavement/Fees]
    M3 --> DepPhone[Enter Phone] --> DepName[Enter Name] --> DepSuccess[Dependent Added]
    M4 --> TopupAmt[Enter Amount] --> TopupSTK[STK Push Sent]
    M5 --> Freeq[Select: Daily/Weekly/Monthly] --> SOAmt[Enter Amount] --> SOSTK[SO Prompt Sent]
    
    CheckUser -- No --> GuestMenu[Guest Menu]
    GuestMenu --> G1[1. Register]
    GuestMenu --> G2[2. Learn More]
    
    G1 --> RegID[Enter ID Number] --> RegApp[Directed to App/Agent]
```

## 2. API Configuration Status

The following keys are **already configured** in the project's environment (`functions/.env`) and `index.js` hardcoded fallbacks:

| Service | Key | Status |
| :--- | :--- | :--- |
| **Africa's Talking** | `AT_USERNAME`, `AT_API_KEY` | ✅ Configured |
| **SasaPay** | `CLIENT_ID`, `CLIENT_SECRET`, `MERCHANT_CODE` | ✅ Configured (Sandbox) |
| **Google AI** | `GEMINI_API_KEY` | ✅ Configured |

## 3. How to Test
1. Open the [Africa's Talking Simulator](https://simulator.africastalking.com:9246/).
2. Enter your phone number (use `07...` or `+254...`).
3. Dial `*384#` to see the live menu response from your deployed Firebase Functions.
