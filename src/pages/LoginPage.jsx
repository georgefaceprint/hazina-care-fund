import React, { useState, useEffect } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, db, functions } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Phone, ArrowRight, CheckCircle2, RotateCcw, Camera, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatKenyanPhone, standardizeTo254 } from '../utils/phoneUtils';
import { generateReferralCode } from '../utils/referralUtils';
import { useLanguage } from '../context/LanguageContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { kenyanCounties, countyTowns } from '../utils/kenyanGeog';
import { MapPin, Home } from 'lucide-react';

const DigitInput = ({ value, onChange, length = 6, type = "text", label = "" }) => {
    return (
        <div className="space-y-4">
            {label && <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 text-center mb-1">{label}</label>}
            <div className="relative group flex justify-center">
                {/* Hidden Input to capture raw text */}
                <input
                    type="tel"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    autoFocus
                    maxLength={length}
                    value={value}
                    onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
                    className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                />
                
                {/* Visual Segments */}
                <div className="flex justify-center gap-2 md:gap-3 w-full max-w-sm px-2">
                    {Array.from({ length }).map((_, i) => {
                        const isFocused = value.length === i || (value.length === length && i === length - 1);
                        const isFilled = i < value.length;
                        const char = value[i];
                        
                        return (
                            <div 
                                key={i}
                                className={`flex-1 aspect-square h-14 md:h-16 flex items-center justify-center bg-slate-50 rounded-2xl border-2 transition-all text-2xl font-black ${
                                    isFocused ? 'border-brand-primary bg-white shadow-xl shadow-brand-primary/10 ring-4 ring-brand-primary/5 scale-105 z-10' : 
                                    isFilled ? 'border-emerald-100 bg-white text-brand-primary' : 'border-slate-100 text-slate-300'
                                }`}
                            >
                                {char ? (type === 'password' ? '•' : char) : (
                                    <span className="opacity-20">0</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

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
    const [firstName, setFirstName] = useState('');
    const [surname, setSurname] = useState('');
    const [nationalId, setNationalId] = useState('');
    const [agentCodeInput, setAgentCodeInput] = useState('');
    
    // Geographical State
    const [currentCounty, setCurrentCounty] = useState('');
    const [currentTown, setCurrentTown] = useState('');
    const [homeCounty, setHomeCounty] = useState('');
    const [nearestTown, setNearestTown] = useState('');

    const { enableDemoMode, isDemoMode, user, profile, loading: authLoading } = useAuth();

    useEffect(() => {
        console.log("🚦 [LoginPage] Auth State:", { 
            hasUser: !!user, 
            hasProfile: !!profile, 
            authLoading, 
            isDemoMode,
            profileId: profile?.id,
            profileRole: profile?.role
        });

        if (isDemoMode && user) {
            navigate('/dashboard');
            return;
        }

        // If user is already authenticated and has a profile, redirect appropriately
        if (user && profile && !authLoading) {
            console.log("🚦 [LoginPage] Redirecting authorized user to dashboard/complete-profile");
            if (!profile.profile_completed) {
                navigate('/complete-profile');
            } else {
                navigate('/dashboard');
            }
        }

        // Capture Agent Recruitment Code from URL ?ref=AGENT001 or Session
        const params = new URLSearchParams(window.location.search);
        const refCode = params.get('ref') || sessionStorage.getItem('hazina_agent_code');
        if (refCode) {
            sessionStorage.setItem('hazina_agent_code', refCode.toUpperCase());
            setAgentCodeInput(refCode.toUpperCase());
        }
    }, [isDemoMode, user, profile, loading, navigate]);





    const handleLoginSuccess = async (token, formatPhone, optFaceUrl = null) => {
        console.log("🚀 [LoginPage] handleLoginSuccess started for:", formatPhone, "with faceUrl:", optFaceUrl);
        const authResult = await signInWithCustomToken(auth, token);
        const user = authResult.user;
        console.log("🚀 [LoginPage] Firebase Auth success, user UID:", user.uid);
        sessionStorage.setItem('hazina_temp_phone', formatPhone);
        
        // Ensure face capture is saved if provided
        if (optFaceUrl) {
            console.log("💾 [LoginPage] Saving portrait photo to profile:", optFaceUrl);
        }
        // --- Resilient Profile Lookup ---
        const localPhone = formatKenyanPhone(formatPhone);
        const intlPhone = `+${standardizeTo254(formatPhone)}`;
        const rawIntlPhone = intlPhone.replace('+', '');
        
        console.log("🚀 [LoginPage] Checking Firestore formats:", { localPhone, intlPhone, rawIntlPhone });

        const localRef = doc(db, 'users', localPhone);
        const intlRef = doc(db, 'users', intlPhone);
        const rawRef = doc(db, 'users', rawIntlPhone);
        
        let userSnap = null;
        let userRef = localRef;

        try {
            console.log("🔍 [LoginPage] Probing Local format...");
            const snap = await getDoc(localRef);
            if (snap.exists()) {
                userSnap = snap;
                userRef = localRef;
            }
        } catch (e) {
            console.warn("⚠️ [LoginPage] Local format lookup failed (permissions?):", e.message);
        }

        if (!userSnap) {
            console.log("🔍 [LoginPage] Local not found, checking Intl...");
            try {
                const intlSnap = await getDoc(intlRef);
                if (intlSnap.exists()) {
                    console.log("✅ [LoginPage] Intl format found!");
                    userSnap = intlSnap;
                    userRef = intlRef;
                }
            } catch (e) {
                console.warn("⚠️ [LoginPage] Intl format lookup failed:", e.message);
            }
            if (!userSnap) {
                console.log("🔍 [LoginPage] Intl not found, checking Raw Intl...");
                try {
                    const rawSnap = await getDoc(rawRef);
                    if (rawSnap.exists()) {
                        console.log("✅ [LoginPage] Raw Intl format found!");
                        userSnap = rawSnap;
                        userRef = rawRef;
                    }
                } catch (e) {
                    console.warn("⚠️ [LoginPage] Raw Intl format lookup failed:", e.message);
                }
                if (!userSnap) {
                    console.log("🔍 [LoginPage] Raw Intl not found, checking by UID...");
                    try {
                        const uidSnap = await getDoc(uidRef);
                        if (uidSnap.exists()) {
                            console.log("✅ [LoginPage] User document found via UID!");
                            userSnap = uidSnap;
                            userRef = uidRef;
                        }
                    } catch (e) {
                        console.warn("⚠️ [LoginPage] UID lookup failed:", e.message);
                    }
                    if (!userSnap) {
                        console.log("❌ [LoginPage] No profile found in any format.");
                        // If no profile found by phone or UID, it means it's a truly new user or an error.
                        // For existing users without a profile, this path might indicate data inconsistency.
                        // We'll proceed to create if userSnap.exists() is still false.
                    }
                }
            }
        } else {
            console.log("✅ [LoginPage] Local format found!");
        }
        // ------------------------------

        // --- Standardize Portrait Field and Ensure Consistency ---
        const userData = userSnap?.data() || {};
        const profileUpdate = {};
        
        // If we have a newly uploaded face, save it to BOTH faceUrl and photoURL
        if (optFaceUrl) {
            profileUpdate.faceUrl = optFaceUrl;
            profileUpdate.photoURL = optFaceUrl;
        }

        // If user already has faceUrl but missing photoURL, sync them
        if (userData.faceUrl && !userData.photoURL) {
            profileUpdate.photoURL = userData.faceUrl;
        }

        if (Object.keys(profileUpdate).length > 0 && userSnap?.exists()) { 
            console.log("💾 [LoginPage] Updating profile fields:", profileUpdate);
            await setDoc(userRef, profileUpdate, { merge: true });
        }
        // ------------------------------


        if (!userSnap.exists()) {
            console.log("📝 [LoginPage] Creating NEW user profile...");
            const referrerId = sessionStorage.getItem('hazina_referrer');
            await setDoc(userRef, {
                uid: user.uid,
                phoneNumber: formatPhone,
                firstName: firstName.toUpperCase(),
                surname: surname.toUpperCase(),
                role: 'guardian',
                status: 'in-waiting',
                active_tier: 'bronze',
                eligible_tier: 'none',
                tier_joined_date: serverTimestamp(),
                balance: 0,
                createdAt: serverTimestamp(),
                profile_completed: false,
                photoURL: optFaceUrl, // uses the optFaceUrl from the parent scope if available
                faceUrl: optFaceUrl, // also save to faceUrl
                grace_period_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
                referrer_id: referrerId || null,
                recruited_by: sessionStorage.getItem('hazina_agent_code') || null,
                registration_fee_paid: false,
                referral_code: generateReferralCode(6)
            });
            console.log("✅ [LoginPage] New profile created, navigating to complete-profile");
            navigate('/complete-profile');
        } else {
            console.log("📝 [LoginPage] Updating EXISTING user profile...");
            const userData = userSnap.data();
            const updates = { uid: user.uid };
            if (!userData.referral_code) updates.referral_code = generateReferralCode(6);
            await setDoc(userRef, updates, { merge: true });

            if (!userData.profile_completed) {
                console.log("✅ [LoginPage] Navigation: complete-profile");
                navigate('/complete-profile');
            } else {
                console.log("✅ [LoginPage] Navigation: dashboard");
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
                setIsNewUser(!result.data.exists || !result.data.profile_completed);
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
            if (!firstName.trim()) {
                setError("Please enter your First Name.");
                return;
            }
            if (!surname.trim()) {
                setError("Please enter your Surname.");
                return;
            }
            if (!nationalId) {
                setError("Please enter your National ID number.");
                return;
            }
            // Save referral code if entered manually
            if (agentCodeInput) {
                sessionStorage.setItem('hazina_agent_code', agentCodeInput.toUpperCase());
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
                firstName: firstName,
                surname: surname,
                national_id: nationalId,
                currentCounty: currentCounty,
                currentTown: currentTown,
                homeCounty: homeCounty,
                nearestTown: nearestTown
            });
            await handleLoginSuccess(result.data.token, formatPhone, faceUrl);
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
                        <DigitInput 
                            length={6}
                            value={passcode}
                            onChange={setPasscode}
                            type="password"
                            label="Secure Entry"
                        />
                        <button
                            type="submit"
                            disabled={loading || passcode.length < 6}
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
                        <DigitInput 
                            length={6}
                            value={verificationCode}
                            onChange={setVerificationCode}
                            type="text"
                            label="Verification Code"
                        />
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
                        <div className="space-y-8">
                            <DigitInput 
                                length={6}
                                value={newPasscode}
                                onChange={setNewPasscode}
                                type="password"
                                label="Create Passcode"
                            />
                            <DigitInput 
                                length={6}
                                value={confirmPasscode}
                                onChange={setConfirmPasscode}
                                type="password"
                                label="Confirm Passcode"
                            />
                        </div>

                         {isNewUser && (
                             <div className="space-y-4 pt-4 border-t border-slate-50">
                                 <div className="space-y-4">
                                     <div className="grid grid-cols-2 gap-4">
                                         <div className="space-y-2">
                                             <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">First Name</label>
                                             <input
                                                 type="text"
                                                 placeholder="JOHN"
                                                 className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold uppercase outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                                                 value={firstName}
                                                 onChange={(e) => setFirstName(e.target.value)}
                                                 required
                                             />
                                         </div>
                                         <div className="space-y-2">
                                             <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Surname</label>
                                             <input
                                                 type="text"
                                                 placeholder="DOE"
                                                 className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold uppercase outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                                                 value={surname}
                                                 onChange={(e) => setSurname(e.target.value)}
                                                 required
                                             />
                                         </div>
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
                                     <div className="space-y-2">
                                         <label className="text-[10px] font-black uppercase text-brand-primary ml-1 tracking-widest">Agent Referral Code (Optional)</label>
                                         <input
                                             type="text"
                                             placeholder="CT001"
                                             className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4 text-slate-900 font-bold uppercase outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                                             value={agentCodeInput}
                                             onChange={(e) => setAgentCodeInput(e.target.value.toUpperCase())}
                                         />
                                         <p className="text-[9px] text-slate-400 italic px-1">Ensures your agent gets credit for this activation.</p>
                                     </div>
                                 </div>

                                 <div className="space-y-4 pt-4 border-t border-slate-50">
                                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Current Residence</p>
                                     <div className="space-y-2">
                                         <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">County</label>
                                         <select
                                             className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold uppercase outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                                             value={currentCounty}
                                             onChange={(e) => { setCurrentCounty(e.target.value); setCurrentTown(''); }}
                                             required
                                         >
                                             <option value="">Select County</option>
                                             {kenyanCounties.map(county => (
                                                 <option key={county} value={county}>{county}</option>
                                             ))}
                                         </select>
                                     </div>
                                     <div className="space-y-2">
                                         <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Town</label>
                                         <select
                                             className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold uppercase outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                                             value={currentTown}
                                             onChange={(e) => setCurrentTown(e.target.value)}
                                             disabled={!currentCounty}
                                             required
                                         >
                                             <option value="">Select Town</option>
                                             {(countyTowns[currentCounty] || []).map(town => (
                                                 <option key={town} value={town}>{town}</option>
                                             ))}
                                         </select>
                                     </div>
                                 </div>

                                 <div className="space-y-4 pt-4 border-t border-slate-50">
                                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Home Location</p>
                                     <div className="space-y-2">
                                         <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">County</label>
                                         <select
                                             className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold uppercase outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                                             value={homeCounty}
                                             onChange={(e) => { setHomeCounty(e.target.value); setNearestTown(''); }}
                                             required
                                         >
                                             <option value="">Select County</option>
                                             {kenyanCounties.map(county => (
                                                 <option key={county} value={county}>{county}</option>
                                             ))}
                                         </select>
                                     </div>
                                     <div className="space-y-2">
                                         <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Nearest Town/Market Center</label>
                                         <input
                                             type="text"
                                             placeholder="e.g., Kutus, Sagana"
                                             className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold uppercase outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                                             value={nearestTown}
                                             onChange={(e) => setNearestTown(e.target.value)}
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
                                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Camera or Gallery</p>
                                                  <p className="text-[9px] text-slate-300 uppercase font-bold mt-1">Portrait Mode Recommended</p>
                                                 <p className="text-[9px] text-slate-400 uppercase mt-1 tracking-tighter">Required for community verification</p>
                                             </div>
                                         )}
                                     </div>
                                 </div>
                             </div>
                         )}

                         <button
                             type="submit"
                             disabled={loading || newPasscode.length < 6 || newPasscode !== confirmPasscode || (isNewUser && (!facePhoto || !firstName || !surname || !nationalId || !currentCounty || !currentTown || !homeCounty || !nearestTown))}
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
