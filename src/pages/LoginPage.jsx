import React, { useState, useEffect } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, db, functions } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Phone, ArrowRight, CheckCircle2, RotateCcw, Camera, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatKenyanPhone, standardizeTo254 } from '../utils/phoneUtils';
import { generateReferralCode } from '../utils/referralUtils';
import { useLanguage } from '../context/LanguageContext';

const LoginPage = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState('phone'); // 'phone', 'passcode', 'otp', 'set_passcode'
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [passcode, setPasscode] = useState('');
    const [newPasscode, setNewPasscode] = useState('');
    const [confirmPasscode, setConfirmPasscode] = useState('');
    const [isNewUser, setIsNewUser] = useState(false);
    const { t } = useLanguage();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [facePhoto, setFacePhoto] = useState(null);
    const [fullName, setFullName] = useState('');
    const [nationalId, setNationalId] = useState('');
    const { enableDemoMode, isDemoMode, user, profile, loading: authLoading } = useAuth();

    useEffect(() => {
        if (isDemoMode && user) {
            navigate('/dashboard');
            return;
        }

        // If user is already authenticated and has a profile, redirect appropriately
        if (user && profile && !authLoading) {
            if (!profile.profile_completed) {
                navigate('/complete-profile');
            } else {
                navigate('/dashboard');
            }
        }

        // Capture Agent Recruitment Code from URL ?ref=AGENT001
        const params = new URLSearchParams(window.location.search);
        const refCode = params.get('ref');
        if (refCode) {
            sessionStorage.setItem('hazina_agent_code', refCode);
        }
    }, [isDemoMode, user, profile, loading, navigate]);





    const handleLoginSuccess = async (token, formatPhone) => {
        const authResult = await signInWithCustomToken(auth, token);
        const user = authResult.user;
        sessionStorage.setItem('hazina_temp_phone', formatPhone);
        
        // --- Resilient Profile Lookup ---
        const localPhone = formatKenyanPhone(formatPhone);
        const intlPhone = `+${standardizeTo254(formatPhone)}`;
        
        const localRef = doc(db, 'users', localPhone);
        const intlRef = doc(db, 'users', intlPhone);
        
        let userSnap = await getDoc(localRef);
        let userRef = localRef;

        if (!userSnap.exists()) {
            const intlSnap = await getDoc(intlRef);
            if (intlSnap.exists()) {
                userSnap = intlSnap;
                userRef = intlRef;
            }
        }
        // ------------------------------

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
                grace_period_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
                referrer_id: referrerId || null,
                recruited_by: sessionStorage.getItem('hazina_agent_code') || null,
                registration_fee_paid: false,
                referral_code: generateReferralCode(6)
            });
            navigate('/complete-profile');
        } else {
            const userData = userSnap.data();
            const updates = { uid: user.uid };
            if (!userData.referral_code) updates.referral_code = generateReferralCode(6);
            await setDoc(userRef, updates, { merge: true });

            if (!userData.profile_completed) {
                navigate('/complete-profile');
            } else {
                navigate('/dashboard');
            }
        }
    };

    const onSignInSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const formatPhone = formatKenyanPhone(phoneNumber);

        try {
            const checkUserExists = httpsCallable(functions, 'checkUserExists');
            const result = await checkUserExists({ phoneNumber: formatPhone });
            
            if (result.data.exists && result.data.hasPasscode) {
                setStep('passcode');
                setIsNewUser(false);
            } else {
                // Either new user, or existing user without a passcode
                const sendOtp = httpsCallable(functions, 'sendOtp');
                await sendOtp({ phoneNumber: formatPhone });
                setIsNewUser(!result.data.exists);
                setStep('otp');
            }
        } catch (error) {
            setError(error.message || 'Failed to communicate with server.');
        } finally {
            setLoading(false);
        }
    };

    const onForgotPasscode = async () => {
        setError('');
        setLoading(true);
        const formatPhone = formatKenyanPhone(phoneNumber);
        try {
            const sendOtp = httpsCallable(functions, 'sendOtp');
            await sendOtp({ phoneNumber: formatPhone });
            setIsNewUser(false);
            setStep('otp');
        } catch (error) {
            setError(error.message || 'Failed to send OTP.');
        } finally {
            setLoading(false);
        }
    };

    const onOtpSubmit = async (e) => {
        e.preventDefault();
        if (verificationCode.length !== 6) return;
        
        setError('');
        setLoading(true);
        const formatPhone = formatKenyanPhone(phoneNumber);
        try {
            const checkOtp = httpsCallable(functions, 'checkOtp');
            await checkOtp({ phoneNumber: formatPhone, validationCode: verificationCode });
            setStep('set_passcode');
        } catch (error) {
            setError(error.message || 'Invalid verification code.');
        } finally {
            setLoading(false);
        }
    };

    const onSetPasscodeSubmit = async (e) => {
        e.preventDefault();
        if (newPasscode !== confirmPasscode) {
            setError("Passcodes do not match.");
            return;
        }
        if (newPasscode.length < 4) {
            setError("Passcode must be at least 4 digits.");
            return;
        }

        if (isNewUser) {
            if (!facePhoto) {
                setError("Please capture your face photo to secure your account.");
                return;
            }
            if (!fullName.trim() || fullName.trim().split(/\s+/).length < 2) {
                setError("Please enter at least two names.");
                return;
            }
            if (!nationalId) {
                setError("Please enter your National ID number.");
                return;
            }
        }

        setError('');
        setLoading(true);
        const formatPhone = formatKenyanPhone(phoneNumber);
        try {
            let faceUrl = null;
            if (isNewUser && facePhoto) {
                const { uploadProfilePhoto } = await import('../services/storage');
                faceUrl = await uploadProfilePhoto(formatPhone, facePhoto, 'face');
            }

            const verifyAndSet = httpsCallable(functions, 'verifyAndSetPasscode');
            const result = await verifyAndSet({
                phoneNumber: formatPhone,
                validationCode: verificationCode,
                newPasscode: newPasscode,
                faceUrl: faceUrl,
                fullName: fullName,
                nationalId: nationalId
            });
            await handleLoginSuccess(result.data.token, formatPhone);
        } catch (error) {
            setError(error.message || 'Verification or Passcode setup failed.');
            if (error.message?.includes('OTP') || error.message?.includes('Code')) {
                setStep('otp'); // go back to OTP if it was wrong
            }
        } finally {
            setLoading(false);
        }
    };

    const onPasscodeSubmit = async (e) => {
        e.preventDefault();
        if (!passcode) return;

        setError('');
        setLoading(true);
        const formatPhone = formatKenyanPhone(phoneNumber);
        try {
            const login = httpsCallable(functions, 'loginWithPasscode');
            const result = await login({
                phoneNumber: formatPhone,
                passcode: passcode
            });
            await handleLoginSuccess(result.data.token, formatPhone);
        } catch (error) {
            setError(error.message || 'Invalid passcode.');
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



                {step === 'phone' && (
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
                            {loading ? 'Please Wait...' : 'Continue'}
                            <ArrowRight className="w-5 h-5 ml-2 inline-block" />
                        </button>
                    </form>
                )}

                {step === 'passcode' && (
                    <form onSubmit={onPasscodeSubmit} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                        <div className="text-center mb-6">
                            <p className="text-sm text-slate-600">Enter your secure passcode</p>
                            <p className="font-bold text-slate-900 text-lg mt-1 tracking-wider">{formatKenyanPhone(phoneNumber)}</p>
                        </div>
                        <div>
                            <input
                                type="password"
                                placeholder="• • • •"
                                className="w-full text-center bg-slate-100 border-none rounded-2xl py-4 focus:ring-2 focus:ring-brand-primary transition-all text-3xl font-bold tracking-[0.5em]"
                                value={passcode}
                                onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || passcode.length < 4}
                            className="btn-primary w-full py-4 text-lg disabled:opacity-50"
                        >
                            {loading ? 'Verifying...' : 'Login'}
                            <CheckCircle2 className="w-5 h-5 ml-2 inline-block" />
                        </button>
                        <div className="flex flex-col items-center gap-4 mt-4">
                            <button
                                type="button"
                                onClick={onForgotPasscode}
                                className="text-sm font-bold text-brand-primary hover:text-brand-dark transition-colors"
                            >
                                Forgot Passcode?
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setStep('phone');
                                    setPasscode('');
                                    setError('');
                                }}
                                className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" /> Change Phone Number
                            </button>
                        </div>
                    </form>
                )}

                {step === 'otp' && (
                    <form onSubmit={onOtpSubmit} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                        <div className="text-center mb-6">
                            <p className="text-sm text-slate-600">Enter the 6-digit code sent via SMS to</p>
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
                            Verify Code
                            <CheckCircle2 className="w-5 h-5 ml-2 inline-block" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setStep('phone');
                                setVerificationCode('');
                                setError('');
                            }}
                            className="w-full py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center gap-2 mt-4"
                        >
                            <RotateCcw className="w-4 h-4" /> Cancel
                        </button>
                    </form>
                )}

                {step === 'set_passcode' && (
                    <form onSubmit={onSetPasscodeSubmit} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                        <div className="text-center mb-6">
                            <p className="text-sm text-slate-600">
                                {isNewUser ? "Secure your new account" : "Set your new passcode"}
                            </p>
                            <p className="font-bold text-slate-900 mt-1">Create a numeric passcode</p>
                        </div>
                        <div className="space-y-4">
                            <input
                                type="password"
                                placeholder="New Passcode"
                                className="w-full text-center bg-slate-100 border-none rounded-2xl py-4 focus:ring-2 focus:ring-brand-primary transition-all text-xl font-bold tracking-[0.2em]"
                                value={newPasscode}
                                onChange={(e) => setNewPasscode(e.target.value.replace(/\D/g, ''))}
                                required
                            />
                            <input
                                type="password"
                                placeholder="Confirm Passcode"
                                className="w-full text-center bg-slate-100 border-none rounded-2xl py-4 focus:ring-2 focus:ring-brand-primary transition-all text-xl font-bold tracking-[0.2em]"
                                value={confirmPasscode}
                                onChange={(e) => setConfirmPasscode(e.target.value.replace(/\D/g, ''))}
                                required
                            />
                        </div>

                         {isNewUser && (
                             <div className="space-y-4 pt-4 border-t border-slate-50">
                                 <div className="space-y-4">
                                     <div className="space-y-2">
                                         <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Full Name (Min 2 Names)</label>
                                         <input
                                             type="text"
                                             placeholder="JOHN DOE"
                                             className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold uppercase outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                                             value={fullName}
                                             onChange={(e) => setFullName(e.target.value)}
                                             required
                                         />
                                     </div>
                                     <div className="space-y-2">
                                         <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">National ID Number</label>
                                         <input
                                             type="text"
                                             placeholder="12345678"
                                             className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold uppercase outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                                             value={nationalId}
                                             onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                                             required
                                         />
                                     </div>
                                 </div>

                                 <div className="space-y-2">
                                     <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Identity Face Capture</label>
                                     <div className="relative border-2 border-dashed border-slate-200 rounded-[2.5rem] p-6 text-center hover:border-brand-primary transition-colors cursor-pointer bg-slate-50/50 group overflow-hidden">
                                         <input
                                             type="file"
                                             accept="image/*"
                                             onChange={(e) => setFacePhoto(e.target.files[0])}
                                             className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                             required
                                         />
                                         {facePhoto ? (
                                             <div className="flex flex-col items-center justify-center">
                                                 <CheckCircle2 className="w-10 h-10 text-brand-primary mb-2" />
                                                 <p className="text-xs font-bold text-slate-700 truncate w-full px-4">{facePhoto.name}</p>
                                                 <p className="text-[10px] text-brand-primary uppercase font-bold mt-1 tracking-widest">Digital Face ID Set</p>
                                             </div>
                                         ) : (
                                             <div className="flex flex-col items-center justify-center">
                                                 <Camera className="w-12 h-12 text-slate-300 mb-2 group-hover:text-brand-primary transition-colors" />
                                                 <p className="text-sm font-bold text-slate-700">Tap to Take Selfie</p>
                                                 <p className="text-[9px] text-slate-400 uppercase mt-1 tracking-tighter">Required for community verification</p>
                                             </div>
                                         )}
                                     </div>
                                 </div>
                             </div>
                         )}

                         <button
                             type="submit"
                             disabled={loading || newPasscode.length < 4 || newPasscode !== confirmPasscode || (isNewUser && (!facePhoto || !fullName || !nationalId))}
                             className="btn-primary w-full py-4 text-lg disabled:opacity-50 mt-6"
                         >
                            {loading ? 'Saving...' : 'Set Passcode & Enter'}
                            <CheckCircle2 className="w-5 h-5 ml-2 inline-block" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setStep('otp');
                                setNewPasscode('');
                                setConfirmPasscode('');
                                setError('');
                            }}
                            className="w-full py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center gap-2 mt-4"
                        >
                            <RotateCcw className="w-4 h-4" /> Back to OTP
                        </button>
                    </form>
                )}

                <div className="pt-8 border-t border-slate-100 text-center space-y-4">
                    <button
                        onClick={() => navigate('/agent')}
                        className="text-[10px] font-black uppercase text-slate-400 hover:text-brand-primary tracking-widest transition-colors block w-full"
                    >
                        Management & Recruitment Portal
                    </button>
                    <p className="text-xs text-slate-400">
                        {t('by_continuing')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
