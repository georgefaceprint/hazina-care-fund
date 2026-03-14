import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Shield, Phone, ArrowRight, Loader2, CheckCircle2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db, functions } from '../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { formatKenyanPhone, standardizeTo254 } from '../utils/phoneUtils';

const RecruitmentLogin = () => {
    const navigate = useNavigate();
    const { user, profile, loading: authLoading } = useAuth();
    const toast = useToast();
    
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [isTotpLogin, setIsTotpLogin] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedRole, setSelectedRole] = useState('agent'); // 'super_master', 'master_agent', 'agent'

    useEffect(() => {
        const testNumbers = ['+254755881991', '+254105845108', '0755881991', '0105845108'];
        const isTestUser = user && (testNumbers.includes(user.phoneNumber) || testNumbers.includes(user.uid));

        // If user is already authenticated and has a professional role, redirect appropriately
        // BUT: Let test users stay on the login page so they can switch between portals (SMA/Master/Agent)
        if (user && profile && !authLoading && !isTestUser) {
            if (profile.role === 'super_master') navigate('/smagent/dashboard');
            else if (profile.role === 'master_agent') navigate('/magent/dashboard');
            else if (profile.role === 'agent') navigate('/agent/dashboard');
            else navigate('/dashboard'); // Fallback for guardians
        }
    }, [user, profile, authLoading, navigate]);

    const roleConfig = {
        super_master: {
            title: "SMA HQ",
            subtitle: "Super Master Admin",
            color: "brand-primary"
        },
        master_agent: {
            title: "Master Portal",
            subtitle: "Territory Management",
            color: "emerald-500"
        },
        agent: {
            title: "Agent Hub",
            subtitle: "Field Recruitment",
            color: "slate-900"
        }
    };

    const onSignInSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const formatPhone = formatKenyanPhone(phoneNumber);

        try {
            const sendOtp = httpsCallable(functions, 'sendOtp');
            const result = await sendOtp({ phoneNumber: formatPhone });

            if (result.data?.success === false) {
                setError(result.data.message);
                return;
            }

            setConfirmationResult(true);
            setIsTotpLogin(!!result.data?.totpEnabled);
            if (result.data?.totpEnabled) {
                toast.success("Authenticator Token Required");
            } else {
                toast.success("Verification code sent to " + formatPhone);
            }
        } catch (error) {
            console.error('sendOtp error:', error);
            setError(error.message || 'Failed to send SMS. Please check your number.');
            toast.error("Bridge Connection Failed");
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

            const result = await verifyOtpFunc({
                phoneNumber: formatPhone,
                validationCode: verificationCode
            });

            const { token } = result.data;
            const authResult = await signInWithCustomToken(auth, token);
            
            // Check role immediately for redirection - Try both formats
            const localPhone = formatKenyanPhone(phoneNumber);
            const intlPhone = `+${standardizeTo254(phoneNumber)}`;
            
            let userSnap = await getDoc(doc(db, 'users', localPhone));
            let finalUserRef = doc(db, 'users', localPhone);

            if (!userSnap.exists()) {
                console.log("🔍 Local profile not found, trying international format:", intlPhone);
                const intlSnap = await getDoc(doc(db, 'users', intlPhone));
                if (intlSnap.exists()) {
                    userSnap = intlSnap;
                    finalUserRef = doc(db, 'users', intlPhone);
                }
            }

            // --- TESTING BYPASS: Force Role from Selection ---
            const testNumbers = ['+254755881991', '+254105845108', '0755881991', '0105845108'];
            const isTestUser = testNumbers.some(tn => phoneNumber.includes(tn.replace('+', '')));

            if (isTestUser) {
                console.log("🛠️ Forcing test role to:", selectedRole);
                await setDoc(finalUserRef, {
                    role: selectedRole,
                    fullName: `Test ${selectedRole.replace('_', ' ').toUpperCase()}`,
                    phoneNumber: phoneNumber.startsWith('+') ? phoneNumber : `+${standardizeTo254(phoneNumber)}`,
                    status: 'active',
                    updatedAt: serverTimestamp()
                }, { merge: true });
                userSnap = await getDoc(finalUserRef);
            }
            // -----------------------------------------------

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const userRef = finalUserRef;
                // MONITOR the profile until the role is correctly propagated
                const unsub = onSnapshot(userRef, (snap) => {
                    if (snap.exists()) {
                        const data = snap.data();
                        console.log("👀 Sync Monitor - Current Role in DB:", data.role);
                        
                        if (isTestUser && data.role === selectedRole) {
                            unsub();
                            console.log("🚀 Sync Complete! Redirecting to selection...");
                            toast.success(`${selectedRole.replace('_', ' ').toUpperCase()} Portal Authorized`);
                            if (selectedRole === 'super_master') navigate('/smagent/dashboard');
                            else if (selectedRole === 'master_agent') navigate('/magent/dashboard');
                            else navigate('/agent/dashboard');
                        } else if (!isTestUser && data.role) {
                            unsub();
                            console.log("🚀 Sync Complete! Redirecting to assigned role...");
                            if (data.role === 'super_master') {
                                toast.success("SMA HQ Authorized");
                                navigate('/smagent/dashboard');
                            } else if (data.role === 'master_agent') {
                                toast.success("Master Portal Authorized");
                                navigate('/magent/dashboard');
                            } else if (data.role === 'agent') {
                                toast.success("Agent Hub Authorized");
                                navigate('/agent/dashboard');
                            } else {
                                toast.info("Redirecting to Guardian Hub.");
                                navigate('/dashboard');
                            }
                        }
                    }
                });

                // Safety timeout: Navigate anyway if sync is slow
                setTimeout(() => {
                    unsub();
                    console.log("⚠️ Sync Timeout - Forcing navigation");
                    if (isTestUser) {
                        if (selectedRole === 'super_master') navigate('/smagent/dashboard');
                        else if (selectedRole === 'master_agent') navigate('/magent/dashboard');
                        else navigate('/agent/dashboard');
                    }
                }, 4000);
            } else {
                toast.error("Professional profile not found. Access denied.");
                await auth.signOut();
            }
        } catch (error) {
            console.error('OTP verification error:', error);
            setError(error.message || 'Invalid authorization code.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -mr-64 -mt-64"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] -ml-48 -mb-48"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full relative z-10"
            >
                {/* Role Switcher */}
                <div className="flex bg-white/50 backdrop-blur-md p-1 rounded-2xl border border-slate-200 mb-8 shadow-sm">
                    {Object.keys(roleConfig).map((role) => (
                        <button
                            key={role}
                            onClick={() => setSelectedRole(role)}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                                selectedRole === role 
                                ? 'bg-slate-900 text-white shadow-lg' 
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {role === 'super_master' ? 'SMA' : role === 'master_agent' ? 'Master' : 'Agent'}
                        </button>
                    ))}
                </div>

                <div className="bg-white border border-slate-200 p-10 rounded-[3rem] shadow-2xl">
                    <div className="text-center mb-10">
                        <div className={`w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-slate-900/20 transition-colors`}>
                            <Shield className={`w-10 h-10 text-brand-primary`} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">
                            {roleConfig[selectedRole].title}
                        </h1>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 bg-slate-50 inline-block px-4 py-1.5 rounded-full border border-slate-100 italic">
                            {roleConfig[selectedRole].subtitle}
                        </p>
                    </div>

                    <AnimatePresence mode='wait'>
                        {!confirmationResult ? (
                            <motion.form
                                key="phone"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onSubmit={onSignInSubmit} 
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest block">Authorization ID (Phone)</label>
                                    <div className="relative">
                                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                        <input
                                            type="tel"
                                            required
                                            placeholder="07XX XXX XXX"
                                            className="w-full bg-slate-50 border-none rounded-[1.5rem] pl-14 pr-6 py-5 text-slate-900 focus:ring-2 focus:ring-brand-primary transition-all text-sm outline-none font-bold"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || phoneNumber.length < 9}
                                    className="w-full py-5 bg-slate-900 hover:bg-brand-primary text-white font-black uppercase tracking-[0.2em] rounded-[1.5rem] transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 group active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                        <>Request Access <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                                    )}
                                </button>
                            </motion.form>
                        ) : (
                            <motion.form
                                key="otp"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onSubmit={onOtpSubmit} 
                                className="space-y-8"
                            >
                                <div className="text-center">
                                    <p className="text-sm font-bold text-slate-600 mb-1">
                                        {isTotpLogin ? "Authenticator Code Required" : "Authorization Code Sent"}
                                    </p>
                                    <p className="text-xs font-black text-brand-primary font-mono">{formatKenyanPhone(phoneNumber)}</p>
                                </div>

                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        maxLength="6"
                                        placeholder="••••••"
                                        className="w-full text-center bg-slate-50 border-none rounded-[1.5rem] py-6 focus:ring-2 focus:ring-brand-primary transition-all text-4xl font-black tracking-[0.5em] text-slate-900"
                                        value={verificationCode}
                                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                        required
                                    />
                                </div>

                                <div className="space-y-4">
                                    <button
                                        type="submit"
                                        disabled={loading || verificationCode.length !== 6}
                                        className="w-full py-5 bg-brand-primary text-white font-black uppercase tracking-[0.2em] rounded-[1.5rem] transition-all shadow-xl shadow-brand-primary/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                            <>Verify Identity <CheckCircle2 className="w-5 h-5" /></>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setConfirmationResult(null)}
                                        className="w-full py-3 text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <RotateCcw className="w-4 h-4" /> Reset Authorization
                                    </button>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    <div className="mt-12 pt-8 border-t border-slate-50 text-center">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] leading-relaxed">
                            Infrastructure Monitor: Active<br/>
                            <span className="text-brand-primary/50">Authorized Recruitment Personnel Only</span>
                        </p>
                    </div>
                </div>

                <div className="mt-10 text-center">
                    <button
                        onClick={() => navigate('/login')}
                        className="text-slate-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center mx-auto gap-2"
                    >
                        Switch to Guardian Login
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default RecruitmentLogin;
