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

            let uid;
            try {
                // 1. Try Create Auth User
                const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
                uid = userCredential.user.uid;
            } catch (authError) {
                if (authError.code === 'auth/email-already-in-use') {
                    // 1b. If exists, just sign in to get the UID
                    const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPass);
                    uid = userCredential.user.uid;
                } else {
                    throw authError;
                }
            }

            // 2. Create/Restore Firestore Profile
            await setDoc(doc(db, 'users', uid), {
                uid: uid,
                email: adminEmail,
                role: 'admin',
                fullName: 'System Admin',
                status: 'active',
                createdAt: new Date().toISOString()
            });

            toast.success("Admin system account restored.");
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-[100px] -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] -ml-32 -mb-32"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full relative z-10"
            >
                <div className="bg-white border border-slate-200 p-10 rounded-[2.5rem] shadow-2xl">
                    <div className="text-center mb-8">
                        <div
                            onClick={() => setSetupClicks(prev => prev + 1)}
                            className="w-16 h-16 bg-brand-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-brand-primary/20 cursor-pointer active:scale-90 transition-transform"
                        >
                            <Shield className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Hazina Control</h1>
                        <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1">Admin Portal Access</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest text-center block">Admin Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@hazinacare.org"
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-slate-900 focus:ring-2 focus:ring-brand-primary transition-all text-sm outline-none font-bold"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest text-center block">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-slate-900 focus:ring-2 focus:ring-brand-primary transition-all text-sm outline-none font-bold"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-slate-900 hover:bg-brand-primary text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 group active:scale-95 disabled:opacity-50 disabled:grayscale mt-6"
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
                            className="mt-6 pt-6 border-t border-slate-100"
                        >
                            <button
                                onClick={handleSetupAdmin}
                                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
                            >
                                <Wrench className="w-4 h-4" />
                                Setup System Admin
                            </button>
                        </motion.div>
                    )}

                    <div className="mt-8 pt-6 border-t border-slate-50 text-center">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                            Secured Management Infrastructure<br/>Authorized Personnel Only
                        </p>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <button
                        onClick={() => navigate('/login')}
                        className="text-slate-400 hover:text-slate-900 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center mx-auto gap-2"
                    >
                        Return to Guardian Hub
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default AdminLogin;
