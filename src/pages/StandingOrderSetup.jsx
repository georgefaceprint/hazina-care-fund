import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { Shield, Zap, Calendar, ArrowLeft, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';

const StandingOrderSetup = () => {
    const { profile } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Select Freq, 2: Confirm, 3: Success

    const [setupData, setSetupData] = useState({
        amount: 50, // Default for Bronze
        frequency: 'DAILY',
        phoneNumber: profile?.phoneNumber || ''
    });

    const TIER_COSTS = { bronze: 50, silver: 147, gold: 229 };
    const dailyRate = TIER_COSTS[profile?.active_tier?.toLowerCase()] || 50;

    const handleSetup = async () => {
        setLoading(true);
        try {
            const setupStandingOrder = httpsCallable(functions, 'setupStandingOrder');
            const result = await setupStandingOrder({
                amount: dailyRate,
                frequency: setupData.frequency,
                phoneNumber: setupData.phoneNumber,
                networkCode: "63902" // M-Pesa
            });

            if (result.data.success) {
                setStep(3);
                toast.success("Standing order request sent!");
            }
        } catch (error) {
            console.error("SO Setup Error:", error);
            toast.error("Failed to initiate setup: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-slate-50 mobile-px py-12 flex items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-8 sm:p-10 relative overflow-hidden">
                <button 
                    onClick={() => step === 1 ? navigate(-1) : setStep(1)} 
                    className="absolute top-8 left-8 p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="text-center mb-10 pt-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-primary/10 rounded-[2.5rem] mb-6 relative">
                        <Zap className="w-10 h-10 text-brand-primary" />
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight text-center">M-Pesa Ratiba</h1>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2 px-4 text-center">
                        Automated {profile?.active_tier} Shield Protection
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div 
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Select Frequency</p>
                                <div className="grid grid-cols-1 gap-3">
                                    {['DAILY', 'WEEKLY', 'MONTHLY'].map(freq => (
                                        <button
                                            key={freq}
                                            onClick={() => setSetupData({...setupData, frequency: freq})}
                                            className={`p-5 rounded-2xl border-2 transition-all flex items-center justify-between group ${setupData.frequency === freq ? 'border-brand-primary bg-brand-primary/5' : 'border-white bg-white hover:border-slate-200'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-xl transition-colors ${setupData.frequency === freq ? 'bg-brand-primary text-white' : 'bg-slate-50 text-slate-400 group-hover:text-slate-600'}`}>
                                                    <Calendar className="w-5 h-5" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-black text-slate-900 uppercase tracking-tight">{freq}</p>
                                                    <p className="text-[10px] font-bold text-slate-400">
                                                        KSh {freq === 'DAILY' ? dailyRate : freq === 'WEEKLY' ? dailyRate * 7 : dailyRate * 30} per cycle
                                                    </p>
                                                </div>
                                            </div>
                                            {setupData.frequency === freq && <CheckCircle2 className="w-6 h-6 text-brand-primary" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl shadow-slate-900/10 active:scale-95 transition-all"
                            >
                                CONTINUE
                            </button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div 
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm">
                                        <Shield className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <p className="text-sm font-bold text-emerald-900">Confirmation</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-emerald-700/60 font-bold uppercase tracking-widest">Tier</span>
                                        <span className="text-emerald-900 font-black uppercase">{profile?.active_tier}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-emerald-700/60 font-bold uppercase tracking-widest">Amount</span>
                                        <span className="text-emerald-900 font-black">KSh {dailyRate}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-emerald-700/60 font-bold uppercase tracking-widest">Frequency</span>
                                        <span className="text-emerald-900 font-black">{setupData.frequency}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Authorize via Phone</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                    <input 
                                        type="tel"
                                        placeholder="254..."
                                        className="w-full bg-slate-50 border-none rounded-2xl py-5 pl-14 pr-6 font-black text-slate-900 focus:ring-2 focus:ring-brand-primary transition-all"
                                        value={setupData.phoneNumber}
                                        onChange={(e) => setSetupData({...setupData, phoneNumber: e.target.value})}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium italic text-center px-4">
                                    Funds will be automatically deducted from your M-Pesa via SasaPay Ratiba. You will receive a prompt to authorize this setup.
                                </p>
                            </div>

                            <button
                                onClick={handleSetup}
                                disabled={loading}
                                className="w-full py-5 bg-brand-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>AUTHORIZE NOW</>
                                )}
                            </button>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div 
                            key="step3"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-6 space-y-6"
                        >
                            <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900">Request Sent!</h3>
                                <p className="text-slate-500 font-medium mt-2">
                                    Please check your phone for the M-Pesa Ratiba authorization prompt. Once confirmed, your shield will be automatically protected on your chosen schedule.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
                            >
                                BACK TO DASHBOARD
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="mt-10 pt-8 border-t border-slate-50 flex items-center gap-3 justify-center">
                    <AlertCircle className="w-4 h-4 text-slate-300" />
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Secure recurring billing powered by SasaPay</p>
                </div>
            </div>
        </div>
    );
};

export default StandingOrderSetup;
