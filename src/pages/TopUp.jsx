import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, CheckCircle2, AlertCircle, Phone } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const TopUp = () => {
    const { profile, user, isDemoMode } = useAuth();
    const { t } = useLanguage();
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
            const formattedPhone = profile.phoneNumber.startsWith('+') ? profile.phoneNumber.substring(1) : profile.phoneNumber;

            // Call the Firebase Cloud Function instead of direct Daraja API
            // Use the standard function URL format or proxy to the local emulator if running locally
            // Alternatively, since the app is using Vite proxy potentially or deployed on Firebase Hosting
            // The function in index.js is an HTTP function named stkPush

            // To be safe across local and production environments, we call it directly via the correct Cloud Function URL
            // Since this is a test environment, let's use the explicit cloud function domain if deployed or localhost
            const functionUrl = window.location.hostname === 'localhost'
                ? 'http://127.0.0.1:5001/hazina-b1cc7/us-central1/stkPush'
                : 'https://us-central1-hazina-b1cc7.cloudfunctions.net/stkPush';

            const stkResponse = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phoneNumber: formattedPhone,
                    amount: Number(amount),
                    userId: profile.id
                })
            });

            if (!stkResponse.ok) {
                const errorData = await stkResponse.json().catch(() => ({}));
                console.error("STK Push error: ", errorData);
                throw new Error(errorData.error || 'Failed to initiate M-Pesa STK Push on phone.');
            }

            // The function has successfully sent the prompt to the phone.
            // In a real app, you would listen for the callback to update the balance.
            // Here we assume the user will enter their PIN.
            setStatus('success');
        } catch (error) {
            console.error('Top up error:', error);
            setStatus('error');
            setErrorMsg(error.message.includes('upstream') || error.message.includes('timeout')
                ? 'Safaricom Sandbox is currently offline/timing out. Please try again later.'
                : error.message || 'Failed to connect to M-Pesa. Please try again later.');
        } finally {
            if (!isDemoMode) setLoading(false);
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
                <h1 className="text-2xl font-bold font-heading text-slate-900">{t('fund_wallet')}</h1>
            </div>

            <div className="card bg-white p-6 shadow-md border-none mb-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-brand-primary/10 rounded-xl">
                            <CreditCard className="w-6 h-6 text-brand-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-700">{t('current_balance')}</p>
                            <p className="text-2xl font-black text-slate-900">KSh {profile?.balance || 0}</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleTopUp} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">{t('select_amount')}</label>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {[300, 600, 1000, 3000, 5000, 10000].map(val => (
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
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3 text-slate-600 mb-2">
                            <Phone className="w-5 h-5" />
                            <span className="text-sm font-bold">{t('mpesa_number')}</span>
                        </div>
                        <p className="text-lg font-mono font-bold tracking-wider">{profile?.phoneNumber}</p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || status === 'success' || !amount}
                        className="btn-primary w-full py-4 text-lg mt-8"
                    >
                        {loading ? t('initiating_mpesa') : status === 'success' ? t('stk_sent') : `${t('pay_ksh')} ${amount}`}
                    </button>
                </form>
            </div>

            {status === 'success' && (
                <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                    <CheckCircle2 className="w-8 h-8 shrink-0 mt-0.5 text-brand-primary" />
                    <div>
                        <h4 className="font-bold text-lg mb-1">{t('check_phone')}</h4>
                        <p className="text-sm opacity-90 leading-relaxed">
                            {t('m_pesa_desc')}
                        </p>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold">{t('error')}</h4>
                        <p className="text-sm opacity-90">{errorMsg}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TopUp;
