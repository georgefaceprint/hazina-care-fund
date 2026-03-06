import React from 'react';
import { Home, Users, CreditCard, User, ShieldCheck } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { onMessageListener } from '../services/pushNotifications';
import SifunaChatbot from '../components/SifunaChatbot';
import { Zap } from 'lucide-react';

const AppLayout = () => {
    const { profile } = useAuth();
    const { t } = useLanguage();
    const { success, info } = useToast();
    const navigate = useNavigate();
    const isAdmin = profile?.role === 'admin';

    // Listen for foreground push notifications
    React.useEffect(() => {
        const listenForMessages = async () => {
            try {
                const payload = await onMessageListener();
                if (payload) {
                    info(payload.notification?.body || payload.notification?.title || "New notification received");
                    // Continue listening by calling it again
                    listenForMessages();
                }
            } catch (err) {
                console.log('Push listener error or timeout:', err);
            }
        };
        listenForMessages();
    }, [info]);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Background Decor */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-10">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-secondary rounded-full -ml-32 -mb-32 blur-3xl"></div>
            </div>

            <main className="relative z-0 w-full max-w-lg mx-auto min-h-screen pb-28 border-x border-slate-100/50 bg-white/40 shadow-2xl backdrop-blur-3xl">
                <Outlet />
            </main>

            <SifunaChatbot />

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
                <div className="w-full max-w-lg bg-white/95 backdrop-blur-lg px-6 pt-3 pb-[env(safe-area-inset-bottom,1.5rem)] border-t border-slate-100 rounded-t-[2.5rem] shadow-[0_-15px_40px_rgba(0,0,0,0.08)]">
                    <div className="flex justify-around items-center h-14 relative">
                        <NavLink to="/dashboard" className={({ isActive }) => `flex flex-col items-center gap-1 group transition-all ${isActive ? 'text-brand-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                            <Home className="w-6 h-6" />
                            <span className="text-[9px] font-black uppercase tracking-widest transition-all">{t('home')}</span>
                        </NavLink>
                        <NavLink to="/family" className={({ isActive }) => `flex flex-col items-center gap-1 group transition-all ${isActive ? 'text-brand-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                            <Users className="w-6 h-6" />
                            <span className="text-[9px] font-black uppercase tracking-widest transition-all">{t('family')}</span>
                        </NavLink>
                        <div
                            onClick={() => navigate('/claim')}
                            className="relative -mt-16 bg-white p-3 rounded-full shadow-2xl border-2 border-slate-50 group active:scale-90 transition-all cursor-pointer"
                        >
                            <div className="bg-gradient-to-br from-brand-primary to-emerald-600 p-4 rounded-full text-white shadow-[0_10px_20px_rgba(16,185,129,0.3)]">
                                <Zap className="w-8 h-8" />
                            </div>
                        </div>
                        {isAdmin ? (
                            <NavLink to="/admin" className={({ isActive }) => `flex flex-col items-center gap-1 group transition-all ${isActive ? 'text-brand-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                                <ShieldCheck className="w-6 h-6" />
                                <span className="text-[9px] font-black uppercase tracking-widest transition-all">{t('admin')}</span>
                            </NavLink>
                        ) : (
                            <NavLink to="/topup" className={({ isActive }) => `flex flex-col items-center gap-1 group transition-all ${isActive ? 'text-brand-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                                <CreditCard className="w-6 h-6" />
                                <span className="text-[9px] font-black uppercase tracking-widest transition-all">{t('wallet')}</span>
                            </NavLink>
                        )}
                        <NavLink to="/settings" className={({ isActive }) => `flex flex-col items-center gap-1 group transition-all ${isActive ? 'text-brand-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                            <User className="w-6 h-6" />
                            <span className="text-[9px] font-black uppercase tracking-widest transition-all">{t('profile')}</span>
                        </NavLink>
                    </div>
                </div>
            </nav>
        </div>
    );
};

export default AppLayout;
