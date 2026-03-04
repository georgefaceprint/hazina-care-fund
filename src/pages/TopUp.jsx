import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, CheckCircle2, AlertCircle, Phone } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const TopUp = () => {
    const { profile, user, isDemoMode } = useAuth();
    const navigate = useNavigate();
    const [amount, setAmount] = useState('300'); // Default to month for bronze
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, pending, success, error
    const [errorMsg, setErrorMsg] = useState('');

    const handleTopUp = async (e) => {
        e.preventDefault();
        if (!profile) return;

        setLoading(true);
        setStatus('pending');
        setErrorMsg('');

        try {
            if (isDemoMode) {
                setTimeout(async () => {
                    await addDoc(collection(db, 'transactions'), {
                        userId: profile.id,
                        type: 'topup',
                        amount: Number(amount),
                        status: 'completed',
                        source: 'demo_topup',
                        createdAt: serverTimestamp()
                    });
                    setStatus('success');
                    setLoading(false);
                }, 1500);
                return;
            }

            // In a real app, point this to your deployed Firebase Function URL
            const cloudFunctionUrl = "http://localhost:5001/YOUR_PROJECT_ID/your-region/stkPush";

            const response = await fetch(cloudFunctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phoneNumber: profile.phoneNumber,
                    amount: Number(amount),
                    userId: profile.id
                })
            });

            if (!response.ok) {
                throw new Error('Failed to initiate M-Pesa STK Push');
            }

            const data = await response.json();
            console.log('STK initiated:', data);

            // Since it's an STK push, the user needs to enter their PIN on their phone
            // The callback will update Firestore when done. We just show success message for initiating.
            setStatus('success');
        } catch (error) {
            console.error('Top up error:', error);
            setStatus('error');
            setErrorMsg('Failed to connect to M-Pesa. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pt-8 px-6 pb-32">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate(-1)}
                    className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-700" />
                </button>
                <h1 className="text-2xl font-bold font-heading text-slate-900">Fund Wallet</h1>
            </div>

            <div className="card bg-white p-6 shadow-md border-none mb-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-brand-primary/10 rounded-xl">
                            <CreditCard className="w-6 h-6 text-brand-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-700">Current Balance</p>
                            <p className="text-2xl font-black text-slate-900">KSh {profile?.balance || 0}</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleTopUp} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">Select Amount (KSh)</label>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {[100, 300, 500, 1000, 1500].map(val => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setAmount(val.toString())}
                                    className={`py-3 rounded-xl border-2 font-bold transition-all ${amount === val.toString()
                                        ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                                        : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                                        }`}
                                >
                                    {val}
                                </button>
                            ))}
                            <div className="relative col-span-1">
                                <input
                                    type="number"
                                    min="10"
                                    placeholder="Other"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full h-full py-3 px-2 border-2 border-slate-100 rounded-xl outline-none focus:border-brand-primary text-center font-bold text-slate-700 bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3 text-slate-600 mb-2">
                            <Phone className="w-5 h-5" />
                            <span className="text-sm font-bold">M-Pesa Number</span>
                        </div>
                        <p className="text-lg font-mono font-bold tracking-wider">{profile?.phoneNumber}</p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || status === 'success' || !amount}
                        className="btn-primary w-full py-4 text-lg mt-8"
                    >
                        {loading ? 'Initiating M-Pesa...' : status === 'success' ? 'STK Sent to Phone' : `Pay KSh ${amount}`}
                    </button>
                </form>
            </div>

            {status === 'success' && (
                <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                    <CheckCircle2 className="w-8 h-8 shrink-0 mt-0.5 text-brand-primary" />
                    <div>
                        <h4 className="font-bold text-lg mb-1">Check your phone!</h4>
                        <p className="text-sm opacity-90 leading-relaxed">
                            An M-Pesa prompt has been sent to your phone. Enter your PIN to complete the top up. Your balance will update automatically.
                        </p>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold">Error</h4>
                        <p className="text-sm opacity-90">{errorMsg}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TopUp;
