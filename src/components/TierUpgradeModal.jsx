import React, { useState } from 'react';
import { Shield, Zap, Check, X, CreditCard, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../services/firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';

const TIER_UI = {
    bronze: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-100', icon: Shield },
    silver: { color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', icon: Shield },
    gold: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Zap }
};

const TierUpgradeModal = ({ isOpen, onClose, currentTier, profileId, isDemoMode, onUpgradeSuccess }) => {
    const [selectedTier, setSelectedTier] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState('select'); // 'select' | 'payment' | 'success'
    const [upgradeFee, setUpgradeFee] = useState(0);
    const [tiers, setTiers] = useState({
        bronze: { cost: 10, limit: 15000, name: 'Bronze Shield' },
        silver: { cost: 30, limit: 50000, name: 'Silver Shield' },
        gold: { cost: 50, limit: 150000, name: 'Gold Shield' }
    });

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'config', 'tiers'), (docSnap) => {
            if (docSnap.exists()) setTiers(docSnap.data());
        });
        return () => unsub();
    }, []);

    const TIER_VALUES = { bronze: 1, silver: 2, gold: 3 };
    const BASE_UPGRADE_UNIT = 200; // KSh per step up

    const handleUpgrade = async () => {
        setLoading(true);
        // Simulate STK Push
        setTimeout(async () => {
            try {
                if (!isDemoMode) {
                    const userRef = doc(db, 'users', profileId);
                    await updateDoc(userRef, {
                        active_tier: selectedTier,
                        updatedAt: new Date()
                    });
                }
                setStep('success');
                if (onUpgradeSuccess) onUpgradeSuccess(selectedTier);
            } catch (error) {
                console.error("Upgrade failed:", error);
                alert("Upgrade failed. Please try again.");
            } finally {
                setLoading(false);
            }
        }, 2000);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-slate-900/40 backdrop-blur-sm">
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl"
                >
                    <div className="p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black font-heading text-slate-900">
                                {step === 'select' ? 'Upgrade Shield' : step === 'payment' ? 'Confirm Payment' : 'Shield Upgraded!'}
                            </h2>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        {step === 'select' && (
                            <div className="space-y-4">
                                {Object.entries(tiers).map(([key, data]) => {
                                    const isCurrent = key === currentTier;
                                    const ui = TIER_UI[key];
                                    const Icon = ui.icon;
                                    return (
                                        <button
                                            key={key}
                                            disabled={isCurrent}
                                            onClick={() => setSelectedTier(key)}
                                            className={`w-full p-5 rounded-3xl border-2 text-left transition-all relative ${selectedTier === key
                                                ? 'border-brand-primary bg-brand-primary/5 shadow-md scale-[1.02]'
                                                : isCurrent
                                                    ? 'border-slate-100 bg-slate-50 opacity-60 grayscale'
                                                    : 'border-slate-100 hover:border-slate-200'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-2xl ${ui.bg} ${ui.color}`}>
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center">
                                                        <h3 className="font-bold text-slate-900">{data.name || key}</h3>
                                                        <span className="text-xs font-black text-brand-primary uppercase">KSh {data.cost}/day</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500">Up to KSh {data.limit?.toLocaleString()} protection</p>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                                                        {data.maturation || 180} Days Maturation
                                                    </p>
                                                </div>
                                                {selectedTier === key && <Check className="w-6 h-6 text-brand-primary" />}
                                                {isCurrent && <span className="text-[10px] font-black uppercase text-slate-400">Active</span>}
                                            </div>
                                        </button>
                                    );
                                })}

                                <button
                                    disabled={!selectedTier}
                                    onClick={() => {
                                        const steps = TIER_VALUES[selectedTier] - TIER_VALUES[currentTier];
                                        setUpgradeFee(Math.max(steps * BASE_UPGRADE_UNIT, 100)); // Min 100 move fee
                                        setStep('payment');
                                    }}
                                    className="btn-primary w-full py-4 mt-4 disabled:opacity-50 disabled:grayscale transition-all"
                                >
                                    Continue to Upgrade
                                </button>
                            </div>
                        )}

                        {step === 'payment' && (
                            <div className="text-center space-y-6">
                                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CreditCard className="w-10 h-10" />
                                </div>
                                <div>
                                    <p className="text-slate-500 text-sm">You are upgrading to</p>
                                    <h3 className="text-3xl font-black text-slate-900">{tiers[selectedTier]?.name || selectedTier}</h3>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Upgrade Setup Fee</span>
                                        <span className="font-bold text-slate-900">KSh {upgradeFee}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">New Daily Burn</span>
                                        <span className="font-bold text-brand-primary">KSh {tiers[selectedTier]?.cost}</span>
                                    </div>
                                    <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-lg">
                                        <span>Total Due</span>
                                        <span>KSh {upgradeFee}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleUpgrade}
                                    disabled={loading}
                                    className="btn-primary w-full py-4 flex items-center justify-center gap-3"
                                >
                                    {loading ? 'Processing STK Push...' : (
                                        <>
                                            Pay via M-Pesa <ChevronRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Secure payment via Daraja API</p>
                            </div>
                        )}

                        {step === 'success' && (
                            <div className="text-center space-y-6 py-8">
                                <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-200">
                                    <Check className="w-12 h-12" strokeWidth={3} />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black text-slate-900 mb-2">Success!</h3>
                                    <p className="text-slate-500">Your shield has been upgraded to <strong className="text-slate-900">{tiers[selectedTier]?.name || selectedTier}</strong>. Enjoy enhanced protection.</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="btn-primary w-full py-4"
                                >
                                    Return to Dashboard
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default TierUpgradeModal;
