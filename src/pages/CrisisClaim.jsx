import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, BookOpen, Skull, AlertCircle } from 'lucide-react';

const CrisisClaim = () => {
    const { profile, isDemoMode } = useAuth();
    const navigate = useNavigate();
    const [claimType, setClaimType] = useState('medical');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('idle');

    // Maturation Check
    const now = new Date();
    const graceExpiry = profile?.grace_period_expiry?.toDate() || new Date();
    const isMatured = profile?.isDemoMode || graceExpiry <= now;

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Prevent submission if not matured
        if (!isMatured) {
            setStatus('error');
            return;
        }

        setLoading(true);
        setStatus('pending');

        try {
            if (isDemoMode) {
                setTimeout(() => {
                    setStatus('success');
                    setLoading(false);
                    setTimeout(() => navigate('/dashboard'), 3000);
                }, 1000);
                return;
            }

            if (!db) { throw new Error("Database not initialized"); }

            await addDoc(collection(db, 'claims'), {
                guardian_id: profile.id,
                type: claimType,
                amount: Number(amount),
                description,
                status: 'pending_review',
                tier_at_claim: profile.active_tier,
                createdAt: serverTimestamp()
            });

            setStatus('success');
            // Navigate back after delay
            setTimeout(() => navigate('/dashboard'), 3000);
        } catch (error) {
            console.error("Error submitting claim: ", error);
            setStatus('error');
        } finally {
            if (!isDemoMode) setLoading(false);
        }
    };

    if (!profile) return null;

    return (
        <div className="min-h-screen bg-slate-50 pt-8 px-6 pb-32">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-700" />
                </button>
                <h1 className="text-2xl font-bold font-heading text-slate-900">Crisis Claim</h1>
            </div>

            {!isMatured ? (
                <div className="card bg-red-50 border-red-100 flex flex-col items-center text-center p-8">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-lg text-red-900 mb-2">Shield Not Matured</h3>
                    <p className="text-red-700 text-sm leading-relaxed mb-6">
                        You cannot file a claim yet. Your 180-day grace period is still active.
                        Your shield matures on <strong className="whitespace-nowrap">{profile.grace_period_expiry?.toDate().toLocaleDateString()}</strong>.
                    </p>
                    <button onClick={() => navigate('/dashboard')} className="btn-primary w-full bg-red-600 hover:bg-red-700">
                        Return to Dashboard
                    </button>
                </div>
            ) : status === 'success' ? (
                <div className="card bg-emerald-50 border-emerald-100 flex flex-col items-center text-center p-8">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 border-4 border-emerald-50">
                        <Heart className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-lg text-emerald-900 mb-2">Claim Submitted</h3>
                    <p className="text-emerald-700 text-sm leading-relaxed mb-6">
                        We have received your request. The community committee is reviewing it. Funds will be disbursed directly to your M-Pesa once approved.
                    </p>
                </div>
            ) : (
                <div className="card border-none shadow-md">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-3">Type of Crisis</label>
                            <div className="grid grid-cols-1 gap-3">
                                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${claimType === 'medical' ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100 hover:border-slate-200'}`}>
                                    <input type="radio" value="medical" checked={claimType === 'medical'} onChange={(e) => setClaimType(e.target.value)} className="hidden" />
                                    <div className={`p-2 rounded-lg ${claimType === 'medical' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        <Heart className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900">Medical Emergency</p>
                                        <p className="text-xs text-slate-500">Hospital bills, immediate care</p>
                                    </div>
                                </label>
                                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${claimType === 'bereavement' ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100 hover:border-slate-200'}`}>
                                    <input type="radio" value="bereavement" checked={claimType === 'bereavement'} onChange={(e) => setClaimType(e.target.value)} className="hidden" />
                                    <div className={`p-2 rounded-lg ${claimType === 'bereavement' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        <Skull className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900">Bereavement</p>
                                        <p className="text-xs text-slate-500">Funeral and rites</p>
                                    </div>
                                </label>
                                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${claimType === 'school_fees' ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100 hover:border-slate-200'}`}>
                                    <input type="radio" value="school_fees" checked={claimType === 'school_fees'} onChange={(e) => setClaimType(e.target.value)} className="hidden" />
                                    <div className={`p-2 rounded-lg ${claimType === 'school_fees' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900">School Fees</p>
                                        <p className="text-xs text-slate-500">Education support</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Requested Amount (KSh)</label>
                            <input
                                type="number"
                                required
                                min="1000"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-lg font-bold focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                                placeholder="e.g. 15000"
                            />
                            <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-tight font-bold">Max allowed per tier: Bronze (15k), Silver (50k), Gold (150k)</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Brief Description</label>
                            <textarea
                                required
                                value={description}
                                onChange={(e) => setDescription(e.target.value.toUpperCase())}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all resize-none h-32 uppercase"
                                placeholder="PLEASE PROVIDE BRIEF DETAILS ABOUT THE CRISIS..."
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !amount || !description}
                            className="btn-primary w-full py-4 text-lg"
                        >
                            {loading ? 'Submitting...' : 'Submit Claim Request'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default CrisisClaim;
