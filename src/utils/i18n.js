const translations = {
    en: {
        dashboard: "Dashboard",
        home: "Home",
        family: "Family",
        wallet: "Wallet",
        profile: "Profile",
        admin: "Admin",
        daily_burn: "Daily Burn",
        your_fund: "Your Fund",
        shield_growth: "Shield Growth",
        fully_protected: "Fully Protected",
        maturing: "Maturing toward full coverage",
        action_required: "Action Required",
        activate_shield: "Deposit funds to activate your shield and start coverage.",
        fund_now: "Fund Now",
        guardian_services: "Guardian Services",
        crisis_claim: "Crisis Claim",
        upgrade_tier: "Upgrade Tier",
        dependents: "Dependents",
        add_dependent: "Add Dependent",
        m_pesa_sent: "STK Sent to Phone",
        m_pesa_desc: "An M-Pesa prompt has been sent to your phone. Enter your PIN to complete the top up.",
        check_phone: "Check your phone!"
    },
    sw: {
        dashboard: "Dashibodi",
        home: "Nyumbani",
        family: "Familia",
        wallet: "Pochi",
        profile: "Wasifu",
        admin: "Usimamizi",
        daily_burn: "Gharama ya Kila Siku",
        your_fund: "Mfuko Wako",
        shield_growth: "Ukuaji wa Kinga",
        fully_protected: "Imelindwa Kikamilifu",
        maturing: "Inakomaa kuelekea ulinzi kamili",
        action_required: "Hatua Inahitajika",
        activate_shield: "Weka pesa ili kuamsha kinga yako na kuanza ulinzi.",
        fund_now: "Weka Pesa",
        guardian_services: "Huduma za Guardian",
        crisis_claim: "Ombi la Dharura",
        upgrade_tier: "Pandisha Daraja",
        dependents: "Wategemezi",
        add_dependent: "Ongeza Mtegemezi",
        m_pesa_sent: "Ombi limetumwa kwa Simu",
        m_pesa_desc: "Ombi la M-Pesa limetumwa kwa simu yako. Ingiza PIN yako ili kukamilisha.",
        check_phone: "Angalia simu yako!"
    }
};

export const getTranslation = (key, lang = 'en') => {
    return translations[lang]?.[key] || key;
};

export default translations;
