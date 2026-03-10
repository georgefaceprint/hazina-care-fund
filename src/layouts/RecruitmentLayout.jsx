import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
    LayoutDashboard,
    Users,
    TrendingUp,
    Settings,
    LogOut,
    Shield,
    UserCircle,
    Menu,
    X,
    Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const RecruitmentLayout = () => {
    const { profile, logout, impersonatedProfile, stopImpersonating, realProfile } = useAuth();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const isSuperMaster = profile?.role === 'super_master';
    const isMasterAgent = profile?.role === 'master_agent';
    const isAgent = profile?.role === 'agent';

    const menuItems = [
        {
            name: 'Dashboard',
            path: isSuperMaster ? '/super' : isMasterAgent ? '/master' : '/agent',
            icon: LayoutDashboard
        },
        ...(isSuperMaster || isMasterAgent ? [
            {
                name: isSuperMaster ? 'Master Networks' : 'My Agents',
                path: '#', // Placeholder for now, can be specific routes later
                icon: Users
            }
        ] : []),
        {
            name: 'Performance',
            path: '#',
            icon: TrendingUp
        },
        {
            name: 'Profile Settings',
            path: '/settings',
            icon: Settings
        },
    ];

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-72 bg-slate-900 text-white h-screen sticky top-0 p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-12 px-2">
                    <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tighter uppercase italic">HazinaHQ</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Recruitment Hub</p>
                    </div>
                </div>

                <nav className="flex-1 space-y-2">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            className={({ isActive }) => `
                                flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group
                                ${isActive ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                            `}
                        >
                            <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110`} />
                            <span className="font-bold text-sm tracking-tight">{item.name}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="mt-auto space-y-6">
                    <div className="bg-white/5 rounded-[2rem] p-4 flex items-center gap-3 border border-white/5">
                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 border border-white/10">
                            <UserCircle className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{profile?.fullName}</p>
                            <p className="text-[10px] font-black uppercase text-brand-primary tracking-widest">
                                {profile?.role?.replace('_', ' ')}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-all font-bold text-sm group"
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Header Section */}
                <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 px-8 py-4 flex items-center justify-between border-b border-slate-100 lg:hidden">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-lg font-black tracking-tighter uppercase italic text-slate-900">Hazina</h2>
                    </div>

                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 bg-slate-50 rounded-xl text-slate-600"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </header>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto w-full max-w-[1600px] mx-auto relative">
                    {/* Impersonation Banner */}
                    <AnimatePresence>
                        {impersonatedProfile && (
                            <motion.div
                                initial={{ y: -50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -50, opacity: 0 }}
                                className="sticky top-0 z-[60] bg-slate-900 border-b border-white/10 px-8 py-3 flex items-center justify-between shadow-2xl"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center animate-pulse">
                                        <Users className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400">Viewing Dashboard as:</p>
                                        <p className="text-sm font-black text-white">{impersonatedProfile.fullName} <span className="text-[10px] text-brand-primary ml-2">({impersonatedProfile.role?.replace('_', ' ')})</span></p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        stopImpersonating();
                                        navigate(realProfile?.role === 'super_master' ? '/super' : '/master');
                                    }}
                                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 border border-white/10"
                                >
                                    Exit View & Back to HQ
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="p-8">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <div className="fixed inset-0 z-[100] lg:hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            className="absolute inset-y-0 left-0 w-80 bg-slate-900 p-8 shadow-2xl flex flex-col"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center">
                                        <Shield className="w-6 h-6 text-white" />
                                    </div>
                                    <h2 className="text-xl font-black tracking-tighter uppercase text-white">HazinaHQ</h2>
                                </div>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 text-slate-400 hover:text-white"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <nav className="flex-1 space-y-4">
                                {menuItems.map((item) => (
                                    <NavLink
                                        key={item.name}
                                        to={item.path}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={({ isActive }) => `
                                            flex items-center gap-4 px-4 py-4 rounded-2xl transition-all
                                            ${isActive ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:text-white'}
                                        `}
                                    >
                                        <item.icon className="w-5 h-5" />
                                        <span className="font-bold">{item.name}</span>
                                    </NavLink>
                                ))}
                            </nav>

                            <button
                                onClick={handleLogout}
                                className="mt-auto flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-400 font-bold"
                            >
                                <LogOut className="w-5 h-5" />
                                Sign Out
                            </button>
                        </motion.aside>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RecruitmentLayout;
