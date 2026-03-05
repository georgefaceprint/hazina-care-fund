import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, User, Bot, ChevronRight, HelpCircle, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';

const SifunaChatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [chatLanguage, setChatLanguage] = useState(null); // 'en' or 'sw'

    // AI Initialization - Use env var in production
    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyD8zWheYt-GwnUS4MaYQ7pMoIrxmfXYGM0";
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // chatHistory is the source of truth for the conversation
    // Gemini format: [{ role: 'user' | 'model', parts: [{ text: string }] }]
    const [chatHistory, setChatHistory] = useState([]);

    const { profile, user, isDemoMode } = useAuth();
    const { t, language: appLanguage } = useLanguage();
    const location = useLocation();
    const chatEndRef = useRef(null);

    const [kbItems, setKbItems] = useState([]);
    const [tiers, setTiers] = useState({
        bronze: { cost: 10, limit: 15000 },
        silver: { cost: 30, limit: 50000 },
        gold: { cost: 50, limit: 150000 }
    });

    useEffect(() => {
        if (isDemoMode) return;
        const unsubKb = onSnapshot(collection(db, 'sifuna_kb'), (snapshot) => {
            setKbItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubTiers = onSnapshot(doc(db, 'config', 'tiers'), (docSnap) => {
            if (docSnap.exists()) setTiers(docSnap.data());
        });
        return () => { unsubKb(); unsubTiers(); };
    }, [isDemoMode]);

    // Dynamic Prompts based on Route
    const getDynamicPrompts = () => {
        const path = location.pathname;
        const basePrompts = [
            { id: 'membership', label: t('membership') || "Membership", icon: HelpCircle },
            { id: 'payments', label: t('payments') || "Payments", icon: HelpCircle },
        ];

        if (path === '/claim') {
            return [
                { id: 'file_claim', label: chatLanguage === 'sw' ? "Nitafunguaje dai?" : "How to file a claim?", icon: HelpCircle },
                { id: 'claim_status', label: chatLanguage === 'sw' ? "Hali ya dai?" : "Claim status?", icon: HelpCircle },
                ...basePrompts
            ];
        }

        if (path === '/referrals') {
            return [
                { id: 'share_link', label: chatLanguage === 'sw' ? "Nitashiriki vipi?" : "How to share?", icon: HelpCircle },
                { id: 'referral_bonus', label: chatLanguage === 'sw' ? "Zawadi za rufaa?" : "Referral bonuses?", icon: HelpCircle },
                ...basePrompts
            ];
        }

        if (path === '/family') {
            return [
                { id: 'add_dep', label: chatLanguage === 'sw' ? "Ongeza mtegemezi?" : "Add dependent?", icon: HelpCircle },
                { id: 'dep_cover', label: chatLanguage === 'sw' ? "Ulinzi wa familia?" : "Family coverage?", icon: HelpCircle },
                ...basePrompts
            ];
        }

        return [
            ...basePrompts,
            { id: 'claims', label: t('claims') || "Claims", icon: HelpCircle }
        ];
    };

    const currentPrompts = getDynamicPrompts();

    useEffect(() => {
        if (isOpen && chatHistory.length === 0 && !chatLanguage) {
            setChatHistory([{
                role: 'model',
                parts: [{ text: "Jambo! I am Sifuna. Which language would you prefer to use? / Unasema lugha gani?" }]
            }]);
        }
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [isOpen, chatHistory, chatLanguage]);

    const selectLanguage = (lang) => {
        setChatLanguage(lang);

        // Get first name if available
        const rawName = profile?.fullName || user?.displayName || null;
        const firstName = rawName ? rawName.trim().split(' ')[0] : null;

        let welcome;
        if (lang === 'sw') {
            welcome = firstName
                ? `Habari ${firstName}! Mimi ni Sifuna. Nawezaje kukusaidia leo?`
                : "Jambo! Mimi ni Sifuna. Nawezaje kukusaidia leo? Ningependa kujua jina lako tafadhali.";
        } else {
            welcome = firstName
                ? `Hello ${firstName}! I am Sifuna. How can I help you today?`
                : "Hello! I am Sifuna. How can I help you today? May I know your name?";
        }

        setChatHistory(prev => [
            ...prev,
            { role: 'user', parts: [{ text: lang === 'sw' ? 'Kiswahili' : 'English' }] },
            { role: 'model', parts: [{ text: welcome }] }
        ]);
    };

    const resetChat = () => {
        setChatHistory([]);
        setChatLanguage(null);
    };

    const handlePrompt = async (id) => {
        if (!chatLanguage) return;
        const userMsg = currentPrompts.find(p => p.id === id).label;
        await sendMessageToAI(userMsg);
    };

    const sendMessageToAI = async (text) => {
        const userMsg = text.trim();
        if (!userMsg || isTyping) return;

        // Optimistically add user message to history
        setChatHistory(prev => [...prev, { role: 'user', parts: [{ text: userMsg }] }]);
        setInputValue('');
        setIsTyping(true);

        try {
            if (isDemoMode) {
                setTimeout(() => {
                    setChatHistory(prev => [...prev, {
                        role: 'model',
                        parts: [{ text: "I'm in Demo Mode! Connect your Firebase to talk to my AI brain." }]
                    }]);
                    setIsTyping(false);
                }, 1000);
                return;
            }

            // Direct Frontend AI Call
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                systemInstruction: `
                    You are Sifuna, the official AI assistant for Hazina Care. Hazina is a community-driven protection platform in Kenya.
                    
                    TRAINING DATA (DYNAMNIC KNOWLEDGE BASE):
                    ${kbItems.map(item => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n')}

                    REFRESHED PRICING & LIMITS:
                    - Tiers & Benefits: 
                        * Bronze: KSh ${tiers.bronze?.cost}/day, Max Cover KSh ${tiers.bronze?.limit?.toLocaleString()}.
                        * Silver: KSh ${tiers.silver?.cost}/day, Max Cover KSh ${tiers.silver?.limit?.toLocaleString()}.
                        * Gold: KSh ${tiers.gold?.cost}/day, Max Cover KSh ${tiers.gold?.limit?.toLocaleString()}.
                    - Maturation (Waiting Period): 180-day grace period for new shields.
                    - Daily Burn: Calculated as User Tier Cost + Dependent Tier Costs.
                    - Crisis Types: Medical Emergencies, Bereavement/Funeral, School Fees gaps.
                    - Referral Program: 
                        * Users get unique IDs used as referral codes.
                        * Rewards at 10 and 30 successful referrals.
                        * Link format: hazina.vercel.app/signup?ref=YOUR_ID.
                    - USSD Access: Dial *384# for the USSD menu.
                    
                    USER CONTEXT:
                    - User Name: ${profile?.fullName || user?.displayName || 'Unknown (Always greet and ask for their name if not found in context)'}
                    - User Language Choice: ${chatLanguage === 'sw' ? 'Swahili' : 'English'}.
                    - STRICT LANGUAGE RULE: 
                        * Respond ONLY in the User Language Choice (${chatLanguage === 'sw' ? 'Swahili' : 'English'}).
                    - PERSONALIZATION:
                        * Greet with "Hello [Name]" or "Habari [Name]".
                        * Use the user's name naturally across the conversation.
                `
            });

            // COMPREHENSIVE HISTORY CLEANER FOR GEMINI
            // 1. Must alternate User -> Model -> User
            // 2. Must start with 'user'
            // 3. Must not have empty parts
            let cleanedHistory = [];
            let lastRole = null;

            chatHistory.forEach((h) => {
                if (!h.parts?.[0]?.text) return; // Skip empty
                const currentRole = h.role === 'model' ? 'model' : 'user';

                // Gemini Rule: Must alternate and start with User
                if (cleanedHistory.length === 0) {
                    if (currentRole === 'user') {
                        cleanedHistory.push({ role: 'user', parts: h.parts });
                        lastRole = 'user';
                    }
                } else if (currentRole !== lastRole) {
                    cleanedHistory.push({ role: currentRole, parts: h.parts });
                    lastRole = currentRole;
                }
            });

            // If we ended up with an empty history (e.g. only model greeting), 
            // the first user message is current userMsg anyway.

            const chat = model.startChat({
                history: cleanedHistory
            });

            const result = await chat.sendMessage(userMsg);
            const botResponse = result.response.text();

            setChatHistory(prev => [
                ...prev,
                { role: 'model', parts: [{ text: botResponse }] }
            ]);

        } catch (error) {
            console.error("Chat error:", error);
            // Fallback: Try local KB search before showing error
            const errorMsg = error?.message || '';
            if (kbItems.length > 0) {
                const query = userMsg.toLowerCase();
                const matched = kbItems.find(item =>
                    item.question?.toLowerCase().includes(query) ||
                    query.split(' ').some(w => w.length > 3 && item.question?.toLowerCase().includes(w))
                );
                if (matched) {
                    setChatHistory(prev => [...prev, {
                        role: 'model',
                        parts: [{ text: matched.answer }]
                    }]);
                    setIsTyping(false);
                    return;
                }
            }
            setChatHistory(prev => [...prev, {
                role: 'model',
                parts: [{
                    text: chatLanguage === 'sw'
                        ? `Samahani, kuna tatizo la kiufundi. Tafadhali wasiliana nasi kupitia WhatsApp au jaribu tena.`
                        : `Sorry, I'm having a technical issue. Please try again or contact support. (Error: ${errorMsg.includes('API') ? 'API key issue' : 'Network error'})`
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

    return (
        <div className="fixed bottom-28 right-6 z-[60]">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="absolute bottom-20 right-0 w-[85vw] max-w-sm bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col overflow-hidden h-[500px]"
                    >
                        {/* Header */}
                        <div className="bg-orange-500 p-6 text-white flex justify-between items-center relative">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                                    <Bot className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg">Sifuna</h3>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                                        <span className="text-[10px] uppercase font-bold tracking-widest opacity-80">Online</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                            {chatHistory.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-4 rounded-3xl text-sm ${msg.role === 'user'
                                        ? 'bg-orange-500 text-white rounded-tr-none shadow-orange-500/10'
                                        : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none font-medium'
                                        }`}>
                                        {msg.parts?.[0]?.text || ""}
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white p-4 rounded-3xl rounded-tl-none shadow-sm border border-slate-100 flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-bounce"></span>
                                        <span className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                        <span className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Language Selection / Quick Prompts */}
                        <div className="p-4 bg-white border-t border-slate-100">
                            {!chatLanguage ? (
                                <>
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-3 px-2 tracking-widest">Select Language</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => selectLanguage('en')} className="flex-1 py-3 bg-slate-50 hover:bg-orange-500 hover:text-white rounded-2xl text-xs font-bold transition-all border border-slate-100 font-black">English</button>
                                        <button onClick={() => selectLanguage('sw')} className="flex-1 py-3 bg-slate-50 hover:bg-orange-500 hover:text-white rounded-2xl text-xs font-bold transition-all border border-slate-100 font-black">Kiswahili</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-3 px-2 tracking-widest">Select Topic</p>
                                    <div className="flex flex-wrap gap-2">
                                        {currentPrompts.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => handlePrompt(p.id)}
                                                className="px-4 py-2 bg-slate-50 hover:bg-orange-500 hover:text-white rounded-full text-xs font-bold transition-all border border-slate-100 flex items-center gap-2"
                                            >
                                                {p.label}
                                                <ChevronRight className="w-3 h-3" />
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Input */}
                        <form onSubmit={handleFormSubmit} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={chatLanguage === 'sw' ? "Andika hapa..." : "Type a message..."}
                                className="flex-1 bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-0"
                                disabled={!chatLanguage}
                            />
                            <button
                                type="submit"
                                disabled={!chatLanguage || isTyping}
                                className="p-3 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Float Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-slate-900 rotate-90' : 'bg-orange-500 hover:scale-110 active:scale-90'
                    }`}
            >
                {isOpen ? <X className="text-white w-6 h-6" /> : <MessageCircle className="text-white w-7 h-7" />}
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>
                )}
            </button>
        </div >
    );
};

export default SifunaChatbot;
