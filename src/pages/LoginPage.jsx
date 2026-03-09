import React, { useState, useEffect } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, db, functions } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Phone, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatKenyanPhone } from '../utils/phoneUtils';
import { generateReferralCode } from '../utils/referralUtils';
import { useLanguage } from '../context/LanguageContext';

const LoginPage = () => {
    const navigate = useNavigate();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState(null);
    const { t } = useLanguage();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { enableDemoMode, isDemoMode, user } = useAuth();

    useEffect(() => {
        if (isDemoMode && user) {
            navigate('/dashboard');
        }

        // Capture Agent Recruitment Code from URL ?ref=AGENT001
        const params = new URLSearchParams(window.location.search);
        const refCode = params.get('ref');
        if (refCode) {
            sessionStorage.setItem('hazina_agent_code', refCode);
        }
    }, [isDemoMode, user, navigate]);





    const onSignInSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const formatPhone = formatKenyanPhone(phoneNumber);

        try {
            // The 'functions' object imported from '../services/firebase' should already be configured with the region.
            // The instruction "Update services/firebase.js to specify us-central1 region for functions" implies this configuration happens there.
            // The provided snippet `functions = getFunctions(app, 'us-central1');` is not valid syntax here.
            const sendOtp = httpsCallable(functions, 'sendOtp');
            await sendOtp({ phoneNumber: formatPhone });

            // On success, set a local state to reveal OTP UI
            setConfirmationResult(true);
        } catch (error) {
            console.error('sendOtp error:', error);
            // Display the actual error message from the exception for better debugging.
            setError(error.message || 'Failed to send SMS. Please check your number and try again.');
        } finally {
            setLoading(false);
        }
    };

    const onOtpSubmit = async (e) => {
        e.preventDefault();
        if (!verificationCode) return;

        setError('');
        setLoading(true);

        try {
            const formatPhone = formatKenyanPhone(phoneNumber);
            const verifyOtpFunc = httpsCallable(functions, 'verifyOtp');

            // Validate code and get custom token
            const result = await verifyOtpFunc({
                phoneNumber: formatPhone,
                validationCode: verificationCode
            });

            const { token } = result.data;

            // Sign in to Firebase Auth using Custom Token
            const authResult = await signInWithCustomToken(auth, token);
            const user = authResult.user;

            // Store phone in session
            sessionStorage.setItem('hazina_temp_phone', formatPhone);

            // Check if user profile exists using phone number as the ID for persistence
            const userRef = doc(db, 'users', formatPhone);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                const referrerId = sessionStorage.getItem('hazina_referrer');

                await setDoc(userRef, {
                    uid: user.uid,
                    phoneNumber: formatPhone,
                    role: 'guardian',
                    status: 'in-waiting',
                    active_tier: 'bronze',
                    eligible_tier: 'none',
                    tier_joined_date: serverTimestamp(),
                    balance: 0,
                    createdAt: serverTimestamp(),
                    profile_completed: false,
                    profile_completed: false,
                    grace_period_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
                    referrer_id: referrerId || null,
                    recruited_by: sessionStorage.getItem('hazina_agent_code') || null,
                    referral_code: generateReferralCode(6)
                });
                navigate('/complete-profile');
            } else {
                const userData = userSnap.data();
                const updates = { uid: user.uid };

                // Ensure legacy users have a referral code
                if (!userData.referral_code) {
                    updates.referral_code = generateReferralCode(6);
                }

                await setDoc(userRef, updates, { merge: true });

                if (!userData.profile_completed) {
                    navigate('/complete-profile');
                } else {
                    navigate('/dashboard');
                }
            }
        } catch (error) {
            console.error('OTP verification error:', error);
            // Show the actual error message from Firebase if available
            setError(error.message || 'Invalid code or code expired. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center mobile-px">
            <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl border border-slate-100 responsive-p-box space-y-8 relative overflow-hidden">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary/10 rounded-2xl mb-4">
                        <Shield className="w-8 h-8 text-brand-primary" />
                    </div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900">{t('hazina_care')}</h1>
                    <p className="text-slate-500 mt-2">{t('secure_community')}</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 italic">
                        {error}
                    </div>
                )}



                {!confirmationResult ? (
                    <form onSubmit={onSignInSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{t('phone_number')}</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="tel"
                                    placeholder="07XX XXX XXX"
                                    className="w-full bg-slate-100 border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-brand-primary transition-all text-lg uppercase"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value.toUpperCase())}
                                    required
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-2 italic px-2">{t('example_phone')}</p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || phoneNumber.length < 9}
                            className="btn-primary w-full py-4 text-lg disabled:opacity-50"
                        >
                            {loading ? 'Sending Code...' : 'Send Verification Code'}
                            <ArrowRight className="w-5 h-5 ml-2 inline-block" />
                        </button>

                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-slate-200"></div>
                            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase tracking-widest">or</span>
                            <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                const formatPhone = formatKenyanPhone(phoneNumber);
                                enableDemoMode(phoneNumber ? formatPhone : '+254712345678');
                            }}
                            className="w-full py-4 text-sm font-bold text-slate-500 hover:text-brand-primary bg-slate-100/80 rounded-2xl transition-colors shadow-inner min-h-[56px]"
                        >
                            {t('view_app_demo')}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={onOtpSubmit} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                        <div className="text-center mb-6">
                            <p className="text-sm text-slate-600">Enter the 6-digit code sent to</p>
                            <p className="font-bold text-slate-900 text-lg mt-1 tracking-wider">{formatKenyanPhone(phoneNumber)}</p>
                        </div>

                        <div>
                            <input
                                type="text"
                                maxLength="6"
                                placeholder="• • • • • •"
                                className="w-full text-center bg-slate-100 border-none rounded-2xl py-4 focus:ring-2 focus:ring-brand-primary transition-all text-3xl font-bold tracking-[0.5em]"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || verificationCode.length !== 6}
                            className="btn-primary w-full py-4 text-lg disabled:opacity-50"
                        >
                            {loading ? 'Verifying...' : 'Verify & Enter'}
                            <CheckCircle2 className="w-5 h-5 ml-2 inline-block" />
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setConfirmationResult(null);
                                setVerificationCode('');
                                setError('');
                            }}
                            className="w-full py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <RotateCcw className="w-4 h-4" /> Change Phone Number
                        </button>
                    </form>
                )}

                <div className="pt-8 border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-400">
                        {t('by_continuing')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
