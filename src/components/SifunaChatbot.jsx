import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, User, Bot, ChevronRight, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';

const SifunaChatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const { t, language } = useLanguage();
    const chatEndRef = useRef(null);

    const prompts = [
        { id: 'membership', label: t('membership') || "Membership", icon: HelpCircle },
        { id: 'payments', label: t('payments') || "Payments", icon: HelpCircle },
        { id: 'claims', label: t('claims') || "Claims", icon: HelpCircle }
    ];

    const responses = {
        en: {
            membership: "Hazina offers three shield tiers: Bronze, Silver, and Gold. Each provides different levels of protection ranging from KSh 15,000 to 150,000. You can upgrade any time in your profile.",
            payments: "Payments are made via M-Pesa. Each shield has a daily 'burn' cost. You top up your wallet, and the daily amount is automatically deducted to keep your shield active.",
            claims: "You can file a claim for Medical, Bereavement, or School Fees. Once your shield matures (30-90 days), you can request immediate funds which are disbursed to M-Pesa upon review.",
            default: "Hello! I am Sifuna, your Hazina assistant. How can I help you today?"
        },
        sw: {
            membership: "Hazina inatoa ngazi tatu za usalama: Bronze, Silver, na Gold. Kila moja inatoa viwango tofauti vya ulinzi kuanzia KSh 15,000 hadi 150,000. Unaweza kupandisha daraja wakati wowote.",
            payments: "Malipo yanafanywa kupitia M-Pesa. Kila usalama una gharama ya kila siku. Unaongeza salio kwenye pochi yako, na kiasi hicho hukatwa kiotomatiki kila siku.",
            claims: "Unaweza kuwasilisha ombi la dharura la Matibabu, Msiba, au Ada za Shule. Mara tu usalama wako utakapokamilika (siku 30-90), unaweza kuomba fedha ambazo hutolewa kupitia M-Pesa.",
            default: "Hujambo! Mimi ni Sifuna, msaidizi wako wa Hazina. Nawezaje kukusaidia leo?"
        }
    };

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([{ role: 'bot', content: responses[language].default }]);
        }
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [isOpen, messages, language]);

    const handlePrompt = (id) => {
        const userMsg = prompts.find(p => p.id === id).label;
        const botMsg = responses[language][id];
        setMessages(prev => [...prev,
        { role: 'user', content: userMsg },
        { role: 'bot', content: botMsg }
        ]);
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        setMessages(prev => [...prev, { role: 'user', content: inputValue }]);
        setInputValue('');

        setTimeout(() => {
            setMessages(prev => [...prev, { role: 'bot', content: language === 'sw' ? "Samahani, bado ninashughulikia swali hilo. Tafadhali chagua moja ya mada hapa chini." : "I'm still learning that one! Please try selecting one of our main topics below." }]);
        }, 1000);
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
                        <div className="bg-brand-primary p-6 text-white flex justify-between items-center relative">
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
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-4 rounded-3xl text-sm ${msg.role === 'user'
                                            ? 'bg-brand-primary text-white rounded-tr-none'
                                            : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none font-medium'
                                        }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Quick Prompts */}
                        <div className="p-4 bg-white border-t border-slate-100">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-3 px-2 tracking-widest">Select Topic</p>
                            <div className="flex flex-wrap gap-2">
                                {prompts.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handlePrompt(p.id)}
                                        className="px-4 py-2 bg-slate-50 hover:bg-brand-primary hover:text-white rounded-full text-xs font-bold transition-all border border-slate-100 flex items-center gap-2"
                                    >
                                        {p.label}
                                        <ChevronRight className="w-3 h-3" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-0"
                            />
                            <button type="submit" className="p-3 bg-brand-primary text-white rounded-2xl shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all">
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Float Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-slate-900 rotate-90' : 'bg-brand-primary hover:scale-110 active:scale-90'
                    }`}
            >
                {isOpen ? <X className="text-white w-6 h-6" /> : <MessageCircle className="text-white w-7 h-7" />}
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>
                )}
            </button>
        </div>
    );
};

export default SifunaChatbot;
