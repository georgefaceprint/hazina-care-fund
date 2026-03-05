import React, { useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Shield, Phone, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatKenyanPhone } from '../utils/phoneUtils';
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

    React.useEffect(() => {
        if (isDemoMode && user) {
            navigate('/dashboard');
        }
    }, [isDemoMode, user, navigate]);

    const onSignInSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const formatPhone = formatKenyanPhone(phoneNumber);

        try {
            // Because Firebase requires Recaptcha for real SMS, and the user requested to remove it for testing,
            // we will bypass the actual SMS verification step for this test environment and directly sign in anonymously,
            // then link the phone number to their Firestore profile.
            const result = await signInAnonymously(auth);
            const user = result.user;

            // Store phone in session for AuthContext to pick up (since anonymous auth has no phone)
            sessionStorage.setItem('hazina_temp_phone', formatPhone);

            // Check if user profile exists using phone number as the ID for persistence
            const userRef = doc(db, 'users', formatPhone);
            const userSnap = await getDoc(userRef);

            // Check if user profile exists
            if (!userSnap.exists()) {
                // Get referrer if any
                const referrerId = sessionStorage.getItem('hazina_referrer');

                // Create initial profile linked to phone number
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
                    referrer_id: referrerId || null
                });
                navigate('/complete-profile');
            } else {
                const userData = userSnap.data();
                // Update existing profile with current UID (important for session linking if UID changed)
                await setDoc(userRef, { uid: user.uid }, { merge: true });

                if (!userData.profile_completed) {
                    navigate('/complete-profile');
                } else {
                    navigate('/dashboard');
                }
            }
        } catch (error) {
            console.error('Sign-in error:', error);
            setError('Failed to sign in. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <div className="max-w-md w-full glass p-8 rounded-3xl space-y-8">
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
                        disabled={loading}
                        className="btn-primary w-full py-4 text-lg"
                    >
                        {loading ? 'Entering...' : t('enter_app')}
                        <ArrowRight className="w-5 h-5" />
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
                        className="w-full py-4 text-sm font-bold text-slate-500 hover:text-brand-primary bg-slate-100/80 rounded-2xl transition-colors shadow-inner"
                    >
                        {t('view_app_demo')}
                    </button>
                </form>



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
