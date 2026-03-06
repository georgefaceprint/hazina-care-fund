export const CHATBOT_CATEGORIES = [
    {
        id: 'wallet',
        icon: '💰',
        label: { en: 'Wallet & M-Pesa', sw: 'Salio na M-Pesa' },
        faqs: [
            { id: 'how_to_topup', q: { en: 'How do I top up my wallet?', sw: 'Ninawezaje kuongeza salio?' }, a: 'Go to the Wallet page, enter the amount, and tap "Pay". You will receive an M-Pesa prompt on your phone. Minimum is KSh 100.' },
            { id: 'min_topup', q: { en: 'What is the minimum top-up?', sw: 'Kiwango cha chini cha kuweka ni kipi?' }, a: 'The minimum top-up amount is KSh 100.' },
            { id: 'daily_burn_check', q: { en: 'How is my daily cost deducted?', sw: 'Gharama yangu ya kila siku inakatwaje?' }, a: 'Each night at 2:00 AM, your tier cost (e.g. KSh 10 for Bronze) is automatically deducted from your wallet balance.' },
            { id: 'low_balance', q: { en: 'What happens if my balance is low?', sw: 'Nini hutokea ikiwa salio langu ni dogo?' }, a: 'If your balance runs out, your coverage will lapse. You will receive an SMS and a warning banner on your dashboard when funds are low.' }
        ]
    },
    {
        id: 'shield',
        icon: '🛡️',
        label: { en: 'Shield & Membership', sw: 'Ngao na Uanachama' },
        faqs: [
            { id: 'what_is_hazina', q: { en: 'How does Hazina work?', sw: 'Hazina inafanyaje kazi?' }, a: 'Hazina is a community mutual fund. Members contribute small daily amounts and can claim larger funds during medical or bereavement crises.' },
            { id: 'grace_period', q: { en: 'What is the waiting period?', sw: 'Kipindi cha kusubiri ni nini?' }, a: 'All new shields have a 180-day grace period (maturation) before you can file a claim. This ensures the fund remains stable for everyone.' },
            { id: 'tier_differences', q: { en: 'What are the different tiers?', sw: 'Kuna tofauti gani kati ya viwango?' }, a: 'Bronze: KSh 10/day (15k cover), Silver: KSh 30/day (50k cover), Gold: KSh 50/day (150k cover).' },
            { id: 'upgrade_how', q: { en: 'How do I upgrade my tier?', sw: 'Ninawezaje kupandisha daraja langu?' }, a: 'You can upgrade anytime from your Dashboard. Your daily burn will increase immediately, but your cover limit will also jump to the new tier level.' }
        ]
    },
    {
        id: 'claims',
        icon: '🚑',
        label: { en: 'Crisis Claims', sw: 'Madai ya Dharura' },
        faqs: [
            { id: 'claim_types', q: { en: 'What crises are covered?', sw: 'Ni dharura gani zinazoshughulikiwa?' }, a: 'We cover Medical Emergencies (hospital bills), Bereavement (funeral costs), and School Fees crises.' },
            { id: 'claim_docs', q: { en: 'What documents do I need?', sw: 'Nahitaji hati gani ili kudai?' }, a: 'You need a photo or PDF of a hospital discharge summary, death certificate, or school fee structure depending on your claim.' },
            { id: 'payout_speed', q: { en: 'How long does payout take?', sw: 'Malipo huchukua muda gani?' }, a: 'Once approved (within 24-48 hours), funds are sent instantly to your phone via M-Pesa B2C.' },
            { id: 'can_i_claim_now', q: { en: 'Can I file a claim today?', sw: 'Naweza kutoa dai leo?' }, a: 'You can file a claim if your status is "Protected" (matured past the 180-day waiting period).' }
        ]
    },
    {
        id: 'family',
        icon: '👨‍👩‍👧',
        label: { en: 'Family Coverage', sw: 'Madai ya Familia' },
        faqs: [
            { id: 'add_dep', q: { en: 'How do I add a family member?', sw: 'Ninawezaje kuongeza mwanafamilia?' }, a: 'Go to the Family page and tap the "+" button. You need their name and ID/Birth Certificate number.' },
            { id: 'dep_cost', q: { en: 'Is there an extra cost?', sw: 'Je, kuna gharama ya ziada?' }, a: 'Yes, each dependent has their own daily cost (e.g. KSh 10 if you choose Bronze for them). This is deducted from your main wallet.' },
            { id: 'dep_waiting', q: { en: 'Do family members wait too?', sw: 'Wanafamilia pia wanasubiri?' }, a: 'Yes, each dependent starting their own 180-day maturation period from the day they are added to the platform.' }
        ]
    },
    {
        id: 'referrals',
        icon: '🎁',
        label: { en: 'Rewards & Referrals', sw: 'Zawadi na Rufaa' },
        faqs: [
            { id: 'refer_earn', q: { en: 'How do I refer friends?', sw: 'Ninawezaje kualika marafiki?' }, a: 'Share your unique link from the Referrals page. When they join, you earn points and move towards a payment holiday.' },
            { id: 'holiday_desc', q: { en: 'What is a payment holiday?', sw: 'Likizo ya malipo ni nini?' }, a: 'It means your daily burn is paused for a few days as a reward. Reach 10 referrals for 7 days off, or 30 referrals for 14 days off!' },
            { id: 'points_use', q: { en: 'How do I use Hazina points?', sw: 'Nitatumiaje pointi za Hazina?' }, a: 'Points track your progress towards the payment holidays. We are also working on adding more merchandise rewards soon!' }
        ]
    },
    {
        id: 'settings',
        icon: '📱',
        label: { en: 'App & Settings', sw: 'Mpangilio wa App' },
        faqs: [
            { id: 'install_pwa', q: { en: 'How do I install the app?', sw: 'Ninawezaje kusakinisha app?' }, a: 'On Android, tap "Install" in Chrome. On iPhone, tap the Share icon and select "Add to Home Screen".' },
            { id: 'ussd_code', q: { en: 'What is the USSD code?', sw: 'Nambari ya USSD ni gani?' }, a: 'Hazina works on any phone! Just dial *384# even without internet access.' },
            { id: 'notifications_on', q: { en: 'How do I enable alerts?', sw: 'Nitawasha vipi arifa?' }, a: 'Go to Settings > Profile and toggle "Push Notifications" to get alerts about your shield status and claims.' }
        ]
    },
];
