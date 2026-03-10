import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, updateDoc, getDoc, increment, serverTimestamp, setDoc, collection } from 'firebase/firestore';
import { Shield, CreditCard, ArrowRight, CheckCircle2, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

const RegisterFeePage = () => {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState('idle'); // 'idle' | 'processing' | 'success'

    useEffect(() => {
        if (profile?.registration_fee_paid) {
            navigate('/dashboard');
        }
    }, [profile, navigate]);

    const handlePayment = async () => {
        setLoading(true);
        setPaymentStatus('processing');

        try {
            // 1. Simulate M-Pesa STK Push for KES 100
            // In production, this would call a Cloud Function for SasaPay/M-Pesa STK
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 2. Update user profile to fee paid
            const userRef = doc(db, 'users', profile.id);
            await updateDoc(userRef, {
                registration_fee_paid: true,
                status: 'fully-active',
                updatedAt: serverTimestamp()
            });

            // 3. Trigger Commission logic if recruited by an agent
            if (profile.recruited_by) {
                const agentCode = profile.recruited_by;

                // Find agent by agent_code
                const agentsRef = collection(db, 'agents');
                // Since agent_code is unique, we search for it.
                // For MVP, we'll assume the agent's document ID or a field.
                // Let's look for the agent document where field agentCode == agentCode
                // Actually, the user profile also has recruited_by.

                // Let's fetch the agent record
                // (In a real system, this would be a Cloud Function for security)

                // Fetch the agent config to get the commission percentage (default 15%)
                const configSnap = await getDoc(doc(db, 'config', 'recruitment'));
                const commissionRate = configSnap.exists() ? configSnap.data().agentCommission : 15;
                const earned = Math.floor(100 * (commissionRate / 100)); // e.g., 15 KES

                // Update agent wallet (In production, use batch or Cloud Function)
                // We'll search for the agent in 'users' collection with role 'agent' and agent_code
                // But wait, our 'agents' collection has the wallet.
                // Let's find agent by code.

                // FOR MVP: We find the agent doc in 'agents' collection
                // We'll use a query here.
                const { getDocs, query, where } = await import('firebase/firestore');
                const aq = query(collection(db, 'agents'), where('agentCode', '==', agentCode));
                const aqSnap = await getDocs(aq);

                if (!aqSnap.empty) {
                    const agentDoc = aqSnap.docs[0];
                    const agentRef = doc(db, 'agents', agentDoc.id);

                    await updateDoc(agentRef, {
                        walletBalance: increment(earned),
                        totalSignups: increment(1)
                    });

                    // Log the recruitment
                    await setDoc(doc(collection(db, 'recruitment_logs')), {
                        agentId: agentDoc.id,
                        agentCode: agentCode,
                        userId: profile.id,
                        userName: profile.fullName,
                        tier: 'registration_fee',
                        amount: 100,
                        commissionEarned: earned,
                        timestamp: serverTimestamp()
                    });
                }
            }

            setPaymentStatus('success');
            toast.success("Registration fee paid successfully!");

            setTimeout(() => {
                navigate('/dashboard');
            }, 2000);

        } catch (error) {
            console.error("Payment error:", error);
            toast.error("Payment failed. Please try again.");
            setPaymentStatus('idle');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center mobile-px">
            <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl border border-slate-100 responsive-p-box space-y-8 relative overflow-hidden">
                <div className="text-center relative">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-primary/10 rounded-[2rem] mb-6">
                        {paymentStatus === 'success' ? (
                            <CheckCircle2 className="w-10 h-10 text-brand-primary animate-bounce-slow" />
                        ) : (
                            <CreditCard className="w-10 h-10 text-brand-primary" />
                        )}
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Activate Your Shield</h1>
                    <p className="text-slate-500 mt-2 font-medium">One-time registration fee to join Hazina</p>
                </div>

                <div className="bg-slate-50 rounded-3xl p-8 border border-white shadow-inner text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Registration Fee</p>
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl font-bold text-slate-400">KSh</span>
                        <span className="text-6xl font-black text-slate-900 tracking-tighter">100</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <Shield className="w-6 h-6 text-brand-primary shrink-0" />
                        <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                            This one-time activation fee enables your access to the Hazina mutual shield and all its benefits.
                        </p>
                    </div>
                </div>

                <button
                    onClick={handlePayment}
                    disabled={loading || paymentStatus === 'success'}
                    className={`w-full py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${paymentStatus === 'success'
                            ? 'bg-brand-primary text-white'
                            : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/10'
                        }`}
                >
                    {loading ? (
                        <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : paymentStatus === 'success' ? (
                        <>Activated! <CheckCircle2 className="w-6 h-6" /></>
                    ) : (
                        <>Pay KSh 100 via M-Pesa <ArrowRight className="w-6 h-6" /></>
                    )}
                </button>

                <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest italic">
                    Secure payment powered by SasaPay
                </p>
            </div>
        </div>
    );
};

export default RegisterFeePage;
