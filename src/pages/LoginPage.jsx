import React, { useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Shield, Phone, ArrowRight, CheckCircle2 } from 'lucide-react';

const LoginPage = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const setupRecaptcha = () => {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
            });
        }
    };

    const onSignInSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        setupRecaptcha();

        const appVerifier = window.recaptchaVerifier;
        const formatPhone = phoneNumber.startsWith('+') ? phoneNumber : `+254${phoneNumber.replace(/^0/, '')}`;

        try {
            const result = await signInWithPhoneNumber(auth, formatPhone, appVerifier);
            setConfirmationResult(result);
        } catch (error) {
            console.error('Phone sign-in error:', error);
            setError('Failed to send verification code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const onCodeSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await confirmationResult.confirm(verificationCode);
            const user = result.user;

            // Check if user profile exists
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                // Create initial profile with maturation clock
                await setDoc(userRef, {
                    phoneNumber: user.phoneNumber,
                    role: 'guardian',
                    status: 'in-waiting',
                    active_tier: 'bronze', // default tier
                    eligible_tier: 'none',
                    tier_joined_date: serverTimestamp(),
                    balance: 0,
                    createdAt: serverTimestamp(),
                    grace_period_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // 180 days from now
                });
            }

            navigate('/dashboard');
        } catch (error) {
            console.error('Verification code error:', error);
            setError('Invalid verification code. Please try again.');
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
                    <h1 className="text-3xl font-bold font-heading text-slate-900">Hazina Care</h1>
                    <p className="text-slate-500 mt-2">Secure community-based care fund</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 italic">
                        {error}
                    </div>
                )}

                {!confirmationResult ? (
                    <form onSubmit={onSignInSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="tel"
                                    placeholder="07XX XXX XXX"
                                    className="w-full bg-slate-100 border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-brand-primary transition-all text-lg"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    required
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-2 italic px-2">Example: 0712 345 678</p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-4 text-lg"
                        >
                            {loading ? 'Sending...' : 'Get Security Code'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </form>
                ) : (
                    <form onSubmit={onCodeSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Verification Code</label>
                            <div className="relative">
                                <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="XXXXXX"
                                    className="w-full bg-slate-100 border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-brand-primary transition-all text-lg tracking-widest"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    required
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-2 italic px-2">Enter the 6-digit code sent to your phone</p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-4 text-lg"
                        >
                            {loading ? 'Verifying...' : 'Complete Sign In'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmationResult(null)}
                            className="w-full text-sm text-slate-500 hover:text-brand-primary transition-colors"
                        >
                            Change Phone Number
                        </button>
                    </form>
                )}

                <div id="recaptcha-container"></div>

                <div className="pt-8 border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-400">
                        By continuing, you participate in the community fund based on trust and transparency.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
