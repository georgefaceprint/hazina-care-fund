import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageCircle, X, Send, Bot, ChevronRight, HelpCircle, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';

// ==================================================================
// HAZINA FULL PLATFORM KNOWLEDGE
// This is the "scraped" platform knowledge base baked directly in.
// ==================================================================
const HAZINA_PLATFORM_KNOWLEDGE = `
## HAZINA CARE FUND — COMPLETE PLATFORM GUIDE

### WHAT IS HAZINA?
Hazina Care Fund is a community-driven mutual protection platform in Kenya. Members pay daily premiums into a shared pool. When a crisis hits (medical emergency, bereavement, school fees), members can claim from the pool. It is NOT insurance—it is a communal shield.

### MEMBERSHIP & ONBOARDING
- Sign up with a **Kenyan phone number** (M-Pesa verified via OTP)
- Choose a tier: Bronze, Silver, or Gold
- Pay setup/activation fee via M-Pesa STK push
- Immediately enter the **180-day Grace/Waiting Period**
- After 180 days, the shield is fully active and claims are allowed

### TIERS & COSTS
| Tier   | Daily Cost | Max Payout |
|--------|-----------|------------|
| Bronze | KSh 50/day | KSh 100,000 |
| Silver | KSh 147/day | KSh 250,000 |
| Gold   | KSh 229/day | KSh 500,000 |

### DAILY BURN
- Each day, the member's tier cost is deducted from their wallet balance
- If a dependent is added, their tier cost ALSO burns daily
- Example: Gold member + Silver dependent = KSh 80/day burn
- If the wallet runs empty, coverage lapses

### WALLET & TOP-UP
- Top up wallet anytime via M-Pesa STK Push from the Wallet page
- Minimum top-up: KSh 100
- Wallet page shows: current balance, burn rate, funding status
- Low balance triggers a warning banner on the Dashboard

### GRACE/WAITING PERIOD (MATURATION)
- All new shields have a 180-day waiting period before claims are allowed
- Progress shown as a percentage on the Dashboard
- Dependents also have their own 180-day waiting period from join date
- Once matured, the shield is "Fully Protected"

### CRISIS CLAIMS
- Crisis types allowed: **Medical Emergency**, **Bereavement/Funeral**, **School Fees**
- To file a claim:
  1. Go to Crisis Claim page
  2. Select claim type
  3. Enter amount needed (within tier limit)
  4. Upload proof/evidence (photo or document)
  5. Submit — admin reviews within 24–48 hours
- Claims require the shield to be **matured** (past waiting period)
- Claim payout is done via M-Pesa B2C to member's phone

### DEPENDENTS (FAMILY MEMBERS)
- Members can add family members as dependents
- Each dependent gets their own tier (Bronze/Silver/Gold)
- Each dependent has their own 180-day waiting period
- Dependents burn daily cost on the guardian's wallet
- Add via the Family Members page

### REFERRAL PROGRAM
- Each member has a unique 6-character alphanumeric referral code
- Share link format: myhazina.org/signup?ref=REFERRAL_CODE
- Milestone 1: 10 referrals = 7-day payment holiday (no daily burn for 7 days)
- Milestone 2: 30 referrals = 14-day payment holiday
- Referral tracking and rewards on the Referrals page
- Points system: earn Hazina Points per referral

### TIER UPGRADES
- Members can upgrade from Bronze → Silver → Gold anytime
- Upgrade is prorated (daily cost increases from upgrade date)
- Done via the Dashboard "Upgrade Tier" quick action

### ADMIN PANEL (STAFF ONLY)
- Accessible at /admin (admin role required)
- Features: Claims Review, User Management, Sifuna (AI) Training, Tier Pricing Config, Transaction Billing, Analytics
- Admins can approve/reject claims and trigger M-Pesa B2C payouts
- Admins can promote/demote users to admin role
- Admins can configure tier costs and cover limits

### PUSH NOTIFICATIONS
- Members can enable push alerts from Profile Settings
- Get notified: claim updates, low balance warnings, maturation milestones

### PWA (PROGRESSIVE WEB APP)
- Hazina is a full PWA — installable on Android, iOS, and Desktop
- On Android: browser shows an Install prompt
- On iOS: tap Share → Add to Home Screen
- Works offline with cached assets

### USSD ACCESS
- Dial *384# for USSD access on any phone (no smartphone required)

### CONTACT & SUPPORT
- WhatsApp: available from the platform
- Email: support@myhazina.org
- Website: myhazina.org

### SIFUNA AI
- Sifuna is the Hazina platform's AI assistant
- Speaks English and Kiswahili
- Helps members understand their shield, file claims, manage dependents, and more
`;

import { CHATBOT_CATEGORIES } from '../data/chatbotData';

const SifunaChatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [chatLanguage, setChatLanguage] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showSuggestions, setShowSuggestions] = useState(true);

    // Listen for external "Open Chatbot" events from Dashboard
    useEffect(() => {
        const handleOpenSifuna = (e) => {
            const { category, welcome } = e.detail || {};
            setIsOpen(true);
            if (category) setSelectedCategory(category);
            if (!chatLanguage) {
                // Default to English if no language selected yet, but keep original flow if possible
                // setChatLanguage('en'); 
            }
        };
        window.addEventListener('open-sifuna', handleOpenSifuna);
        return () => window.removeEventListener('open-sifuna', handleOpenSifuna);
    }, [chatLanguage]);

    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
    const genAI = useMemo(() => new GoogleGenerativeAI(GEMINI_API_KEY), [GEMINI_API_KEY]);

    const [chatHistory, setChatHistory] = useState([]);
    const { profile, user, isDemoMode } = useAuth();
    const { t } = useLanguage();
    const location = useLocation();
    const chatEndRef = useRef(null);

    const [kbItems, setKbItems] = useState([]);
    const [tiers, setTiers] = useState({
        bronze: { cost: 50, limit: 100000 },
        silver: { cost: 147, limit: 250000 },
        gold: { cost: 229, limit: 500000 }
    });
    const [isGlobalActive, setIsGlobalActive] = useState(true);

    useEffect(() => {
        if (isDemoMode) return;
        const unsubKb = onSnapshot(collection(db, 'sifuna_kb'), (snapshot) => {
            setKbItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubTiers = onSnapshot(doc(db, 'config', 'tiers'), (docSnap) => {
            if (docSnap.exists()) setTiers(docSnap.data());
        });
        const unsubConfig = onSnapshot(doc(db, 'config', 'sifuna'), (docSnap) => {
            if (docSnap.exists()) {
                setIsGlobalActive(docSnap.data().isActive !== false);
            }
        });
        return () => { unsubKb(); unsubTiers(); unsubConfig(); };
    }, [isDemoMode]);


    useEffect(() => {
        if (isOpen && chatHistory.length === 0 && !chatLanguage) {
            setChatHistory([{
                role: 'model',
                parts: [{ text: "Jambo! I am Sifuna 🛡️, your Hazina guide.\nWhich language do you prefer? / Unasema lugha gani?" }]
            }]);
        }
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [isOpen, chatHistory, chatLanguage]);

    const selectLanguage = (lang) => {
        setChatLanguage(lang);
        const firstName = (profile?.fullName || user?.displayName || '').trim().split(' ')[0] || null;
        const sw = lang === 'sw';
        const welcome = sw
            ? (firstName ? `Habari ${firstName}! Mimi ni Sifuna. Chagua mada unayohitaji msaada.` : "Jambo! Mimi ni Sifuna. Chagua mada unayohitaji msaada.")
            : (firstName ? `Hello ${firstName}! I'm Sifuna. Please choose a category you need help with.` : "Hello! I'm Sifuna. Please choose a category you need help with.");

        setChatHistory(prev => [
            ...prev,
            { role: 'user', parts: [{ text: sw ? 'Kiswahili' : 'English' }] },
            { role: 'model', parts: [{ text: welcome }] }
        ]);
    };

    const resetChat = () => {
        setChatHistory([]);
        setChatLanguage(null);
        setSelectedCategory(null);
        setShowSuggestions(true);
    };

    const sendMessageToAI = async (text) => {
        const userMsg = text.trim();
        if (!userMsg || isTyping) return;

        setChatHistory(prev => [...prev, { role: 'user', parts: [{ text: userMsg }] }]);
        setInputValue('');
        setIsTyping(true);
        setShowSuggestions(false);

        try {
            if (isDemoMode) {
                setTimeout(() => {
                    setChatHistory(prev => [...prev, {
                        role: 'model',
                        parts: [{ text: "Demo Mode active! Connect Firebase to use Sifuna's full AI." }]
                    }]);
                    setIsTyping(false);
                }, 1000);
                return;
            }

            const systemInstruction = `You are Sifuna, the official AI assistant for Hazina Care Fund — a community mutual protection platform in Kenya.

FULL PLATFORM KNOWLEDGE:
${HAZINA_PLATFORM_KNOWLEDGE}

CUSTOM TRAINED ANSWERS (from admin knowledge base):
${kbItems.map(item => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n')}

LIVE PRICING:
- Bronze: KSh ${tiers.bronze?.cost}/day | Cover: KSh ${tiers.bronze?.limit?.toLocaleString()}
- Silver: KSh ${tiers.silver?.cost}/day | Cover: KSh ${tiers.silver?.limit?.toLocaleString()}
- Gold: KSh ${tiers.gold?.cost}/day | Cover: KSh ${tiers.gold?.limit?.toLocaleString()}
- Maturation period: ${tiers.bronze?.maturation || 180} days

USER CONTEXT:
- Name: ${profile?.fullName || user?.displayName || 'Unknown'}
- Tier: ${profile?.active_tier || 'Not set'}
- Balance: KSh ${profile?.balance || 0}
- Referral Code: ${profile?.referral_code || 'None'}
- Member Since: ${profile?.tier_joined_date ? new Date(profile.tier_joined_date?.toDate ? profile.tier_joined_date.toDate() : profile.tier_joined_date).toLocaleDateString() : 'Unknown'}
- Current Page: ${location.pathname}
- Language: ${chatLanguage === 'sw' ? 'Kiswahili' : 'English'}

RULES:
- Always respond in ${chatLanguage === 'sw' ? 'Kiswahili' : 'English'} ONLY
- Be warm, concise and helpful
- Use the user's first name naturally when known
- For financial advice, always refer to their specific tier and balance
- Never make up payout amounts outside the tier limits
- If unsure, say so honestly and suggest they contact support`;

            let cleanedHistory = [];
            let lastRole = null;
            chatHistory.forEach((h) => {
                if (!h.parts?.[0]?.text) return;
                const role = h.role === 'model' ? 'model' : 'user';
                if (cleanedHistory.length === 0 && role !== 'user') return;
                if (role !== lastRole) {
                    cleanedHistory.push({ role, parts: h.parts });
                    lastRole = role;
                }
            });

            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction });
            const chat = model.startChat({ history: cleanedHistory });
            const result = await chat.sendMessage(userMsg);
            const botResponse = result.response.text();

            setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: botResponse }] }]);

        } catch (error) {
            console.error("Sifuna error:", error);
            // Fallback: search local KB
            if (kbItems.length > 0) {
                const query = userMsg.toLowerCase();
                const matched = kbItems.find(item =>
                    query.split(' ').some(w => w.length > 3 && item.question?.toLowerCase().includes(w))
                );
                if (matched) {
                    setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: matched.answer }] }]);
                    setIsTyping(false);
                    return;
                }
            }
            setChatHistory(prev => [...prev, {
                role: 'model',
                parts: [{
                    text: chatLanguage === 'sw'
                        ? "Samahani, kuna tatizo. Tafadhali jaribu tena au wasiliana nasi."
                        : `Sorry, I had a technical issue. Please try again. (${error?.message?.slice(0, 60)})`
                }]
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        sendMessageToAI(inputValue);
    };

    if (!isGlobalActive) return null;

    return (
        <div className="fixed bottom-28 right-6 z-[60]">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="absolute bottom-20 right-0 w-[85vw] max-w-sm bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col overflow-hidden h-[540px]"
                    >
                        {/* Header */}
                        <div className="bg-orange-500 p-5 text-white flex justify-between items-center relative flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                                    <Bot className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg leading-none">Sifuna</h3>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                                        <span className="text-[10px] uppercase font-bold tracking-widest opacity-80">Hazina AI Guide</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {/* Reset Button */}
                                <button
                                    onClick={resetChat}
                                    title="Reset conversation"
                                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                </button>
                                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100/30">
                            {chatHistory.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3.5 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                        ? 'bg-orange-500 text-white rounded-tr-none'
                                        : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none font-medium'
                                        }`}>
                                        {msg.parts?.[0]?.text || ""}
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white p-4 rounded-3xl rounded-tl-none shadow-sm border border-slate-100 flex gap-1.5 items-center">
                                        <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Simplified Subject & FAQ Flow */}
                        <div className="bg-white border-t border-slate-100 flex-shrink-0 transition-all duration-300">
                            {!chatLanguage ? (
                                <div className="p-4">
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-3 px-1 tracking-widest text-center">Select Language / Lugha</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => selectLanguage('en')} className="flex-1 py-4 bg-slate-50 hover:bg-orange-500 hover:text-white rounded-3xl text-sm font-black transition-all border border-slate-100 shadow-sm active:scale-95">English</button>
                                        <button onClick={() => selectLanguage('sw')} className="flex-1 py-4 bg-slate-50 hover:bg-orange-500 hover:text-white rounded-3xl text-sm font-black transition-all border border-slate-100 shadow-sm active:scale-95">Kiswahili</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center py-2 px-4 border-b border-slate-50">
                                        <div className="flex items-center gap-2">
                                            {selectedCategory && (
                                                <button
                                                    onClick={() => setSelectedCategory(null)}
                                                    className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                                                >
                                                    <ChevronRight className="w-4 h-4 rotate-180" />
                                                </button>
                                            )}
                                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                                {selectedCategory ? CHATBOT_CATEGORIES.find(c => c.id === selectedCategory)?.label[chatLanguage] : (chatLanguage === 'sw' ? 'MADA KUU' : 'TOPICS')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => setShowSuggestions(!showSuggestions)}
                                                className="text-[9px] font-black text-orange-500 uppercase tracking-widest hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors"
                                            >
                                                {showSuggestions ? (chatLanguage === 'sw' ? 'Ficha' : 'Hide') : (chatLanguage === 'sw' ? 'Mada' : 'Explore')}
                                            </button>
                                            <button onClick={resetChat} className="text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-red-400 transition-colors">Reset</button>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {showSuggestions && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden bg-slate-50/50"
                                            >
                                                <div className="p-4 max-h-[220px] overflow-y-auto no-scrollbar">
                                                    {!selectedCategory ? (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {CHATBOT_CATEGORIES.map(cat => (
                                                                <button
                                                                    key={cat.id}
                                                                    onClick={() => setSelectedCategory(cat.id)}
                                                                    className="flex flex-col items-center gap-2 p-3 bg-white hover:border-orange-200 border border-slate-100 rounded-[1.5rem] transition-all shadow-sm active:scale-95 group text-center"
                                                                >
                                                                    <span className="text-xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                                                                    <span className="text-[9px] font-black uppercase tracking-tight text-slate-600 group-hover:text-orange-600 leading-tight">
                                                                        {cat.label[chatLanguage]}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1.5 animate-in slide-in-from-right-2 duration-300">
                                                            {CHATBOT_CATEGORIES.find(c => c.id === selectedCategory)?.faqs.map(faq => (
                                                                <button
                                                                    key={faq.id}
                                                                    onClick={() => {
                                                                        const qText = faq.q[chatLanguage];
                                                                        setChatHistory(prev => [...prev,
                                                                        { role: 'user', parts: [{ text: qText }] },
                                                                        { role: 'model', parts: [{ text: faq.a }] }
                                                                        ]);
                                                                        setShowSuggestions(false);
                                                                    }}
                                                                    className="w-full flex items-center justify-between p-3 bg-white hover:bg-orange-50/50 border border-slate-100 rounded-xl transition-all shadow-sm active:scale-[0.98] text-left group"
                                                                >
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                                                                            <HelpCircle className="w-3.5 h-3.5" />
                                                                        </div>
                                                                        <span className="text-[10px] font-bold text-slate-700 leading-tight pr-4">
                                                                            {faq.q[chatLanguage]}
                                                                        </span>
                                                                    </div>
                                                                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </>
                            )}
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleFormSubmit} className="p-3 bg-white border-t border-slate-100 flex gap-2 flex-shrink-0">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={chatLanguage === 'sw' ? "Andika swali..." : "Ask me anything..."}
                                className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm focus:ring-0 focus:outline-none"
                                disabled={!chatLanguage}
                            />
                            <button
                                type="submit"
                                disabled={!chatLanguage || isTyping || !inputValue.trim()}
                                className="p-3.5 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-40"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 relative ${isOpen ? 'bg-slate-900 rotate-90' : 'bg-orange-500 hover:scale-110 active:scale-90'}`}
            >
                {isOpen ? <X className="text-white w-6 h-6" /> : <Bot className="text-white w-7 h-7" />}
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse"></span>
                )}
            </button>
        </div>
    );
};

export default SifunaChatbot;
