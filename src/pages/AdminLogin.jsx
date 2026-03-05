import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Shield, Mail, Lock, ArrowRight, Loader2, Wrench } from 'lucide-react';
import { motion } from 'framer-motion';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AdminLogin = () => {
    const navigate = useNavigate();
    const { loginWithEmail } = useAuth();
    const toast = useToast();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [setupClicks, setSetupClicks] = useState(0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await loginWithEmail(email, password);
            toast.success("Welcome, Administrator");
            navigate('/admin');
        } catch (error) {
            console.error("Login failed:", error);
            toast.error(error.message || "Identification failed. Check your admin credentials.");
        } finally {
            setLoading(false);
        }
    };

    const handleSetupAdmin = async () => {
        setLoading(true);
        try {
            const adminEmail = "faceeprint@icloud.com";
            const adminPass = "Jethro@#1973";

            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);

            // 2. Create Firestore Profile
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                uid: userCredential.user.uid,
                email: adminEmail,
                role: 'admin',
                fullName: 'System Admin',
                status: 'active',
                createdAt: new Date().toISOString()
            });

            toast.success("Admin account created successfully.");
            setEmail(adminEmail);
            setPassword(adminPass);
        } catch (error) {
            console.error("Setup failed:", error);
            toast.error(error.message || "Admin setup failed.");
        } finally {
            setLoading(false);
            setSetupClicks(0);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -ml-32 -mb-32"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full relative z-10"
            >
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
                    <div className="text-center mb-8">
                        <div
                            onClick={() => setSetupClicks(prev => prev + 1)}
                            className="w-16 h-16 bg-brand-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-primary/20 cursor-pointer active:scale-90 transition-transform"
                        >
                            <Shield className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic">Hazina Control</h1>
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Admin Portal Access</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Admin Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@hazinacare.org"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-2 focus:ring-brand-primary transition-all text-sm outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-2 focus:ring-brand-primary transition-all text-sm outline-none"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-brand-primary hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 group active:scale-95 disabled:opacity-50 disabled:grayscale"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Authorize Access <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    {setupClicks >= 5 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-6 pt-6 border-t border-white/10"
                        >
                            <button
                                onClick={handleSetupAdmin}
                                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
                            >
                                <Wrench className="w-4 h-4" />
                                Setup System Admin
                            </button>
                        </motion.div>
                    )}

                    <div className="mt-8 pt-8 border-t border-white/5 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            Secure System for Authorized Personnel Only
                        </p>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => navigate('/login')}
                        className="text-slate-500 hover:text-white text-xs font-bold transition-colors"
                    >
                        Return to Guardian App
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default AdminLogin;
