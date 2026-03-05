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

            <main className="relative z-0 max-w-md mx-auto min-h-screen pb-24 border-x border-slate-100/50 bg-white/40 shadow-2xl backdrop-blur-3xl">
                <Outlet />
            </main>

            <SifunaChatbot />

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white p-4 border-t border-slate-100 z-50 rounded-t-[2.5rem] shadow-[0_-10px_30px_rgba(16,185,129,0.08)]">
                <div className="flex justify-around items-center h-12">
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
            </nav>
        </div>
    );
};

// Simple Zap icon as it might not be imported from lucide-react in current scope if not redefined
const Zap = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" ><path d="M4 14.7l11.7-11c.7-.6 1.7-.2 1.7.7v7.3h4c.9 0 1.2 1.1.7 1.6l-11.7 11c-.7.6-1.7.2-1.7-.7v-7.3h-4c-.9 0-1.2-1.1-.7-1.6z" /></svg>
);

export default AppLayout;
