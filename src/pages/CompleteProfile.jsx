import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Shield, User, CreditCard, ArrowRight, CheckCircle2, Upload } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const CompleteProfile = () => {
    const { user, profile } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const toast = useToast();

    const [fullName, setFullName] = useState('');
    const [nationalId, setNationalId] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                fullName,
                national_id: nationalId,
                profile_completed: true,
                updatedAt: serverTimestamp()
            });

            toast.success("Profile completed successfully!");
            navigate('/dashboard');
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8 space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>

                <div className="text-center relative">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary/10 rounded-2xl mb-4">
                        <User className="w-8 h-8 text-brand-primary" />
                    </div>
                    <h1 className="text-2xl font-bold font-heading text-slate-900">Complete Your Profile</h1>
                    <p className="text-slate-500 mt-2 text-sm italic">Verification required to activate your shield.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Full Name (As per ID)</label>
                        <input
                            type="text"
                            placeholder="John Doe"
                            className="w-full bg-slate-50 border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-primary transition-all text-slate-900 font-medium"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">National ID Number</label>
                        <input
                            type="text"
                            placeholder="12345678"
                            className="w-full bg-slate-50 border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-primary transition-all text-slate-900 font-medium"
                            value={nationalId}
                            onChange={(e) => setNationalId(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Identity Verification (KYC)</label>
                        <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center hover:border-brand-primary transition-colors cursor-pointer bg-slate-50/50 group">
                            <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3 group-hover:text-brand-primary transition-colors" />
                            <p className="text-sm font-bold text-slate-700">Upload ID Front Photo</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-tighter mt-1">JPG or PNG (Max 5MB)</p>
                        </div>
                    </div>

                    <div className="bg-emerald-50 rounded-2xl p-4 flex gap-4 items-center">
                        <Shield className="w-10 h-10 text-brand-primary" />
                        <p className="text-xs text-emerald-800 leading-relaxed italic">
                            Your documents are encrypted and only used for community verification.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-brand-primary text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? 'Processing...' : (
                            <>Confirm & Activate <ArrowRight className="w-5 h-5" /></>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CompleteProfile;
