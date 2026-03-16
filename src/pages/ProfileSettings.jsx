import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

import { User, LogOut, Shield, Phone, CreditCard, ChevronRight, Bell, Globe, Gift, Smartphone, Moon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { requestNotificationPermission, disableNotifications } from '../services/pushNotifications';
import { useInstall } from '../components/InstallPrompt';


const ProfileSettings = () => {
    const { user, profile, logout } = useAuth();
    const { t, language, setLanguage } = useLanguage();
    const navigate = useNavigate();
    const toast = useToast();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isPushEnabling, setIsPushEnabling] = useState(false);
    const { triggerInstall, canInstall, isIOS, isInstalled } = useInstall() || {};

    const handleNotificationToggle = async () => {
        if (!user?.uid) return;
        setIsPushEnabling(true);
        try {
            if (profile?.notificationsEnabled) {
                const success = await disableNotifications(user.uid);
                if (success) toast.success("Push notifications disabled.");
                else toast.error("Failed to disable notifications.");
            } else {
                const success = await requestNotificationPermission(user.uid);
                if (success) toast.success("Push notifications enabled!");
                else toast.error("Permission denied or not supported.");
            }
        } catch (error) {
            console.error("Error toggling notifications", error);
            toast.error("An error occurred.");
        } finally {
            setIsPushEnabling(false);
        }
    };
    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Failed to log out:", error);
            toast.error("Error logging out.");
            setIsLoggingOut(false);

        }
    };

    const isRecruiter = profile?.role === 'agent' || profile?.role === 'master_agent' || profile?.role === 'super_master';

    if (isRecruiter) {
        return (
            <div className="space-y-10 max-w-5xl mx-auto pb-20">
                <header>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Security & Preferences</h1>
                    <p className="text-slate-500 font-medium">Manage your professional identity and hub settings</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Profile Card */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center">
                            <div className="w-24 h-24 bg-gradient-to-br from-slate-800 to-slate-950 rounded-[2rem] flex items-center justify-center text-white font-black text-3xl shadow-xl mb-6 relative group">
                                {profile?.fullName?.charAt(0) || 'A'}
                            </div>
                            <h2 className="text-xl font-black text-slate-900 leading-tight">{profile?.fullName}</h2>
                            <p className="text-[10px] font-black uppercase text-brand-primary tracking-[0.2em] mt-2 italic">
                                {profile?.role?.replace('_', ' ')}
                            </p>

                            <div className="w-full mt-8 pt-8 border-t border-slate-50 space-y-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Phone</span>
                                    <span className="text-slate-900 font-bold">{profile?.phoneNumber}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">National ID</span>
                                    <span className="text-slate-900 font-bold">{profile?.nationalId || profile?.national_id || 'Not set'}</span>
                                </div>
                                {profile?.agentCode && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Agent Code</span>
                                        <span className="text-brand-primary font-black uppercase">{profile.agentCode}</span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                className="w-full mt-8 flex items-center justify-center gap-3 py-4 bg-rose-50 text-rose-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-rose-100 transition-all active:scale-95 border border-rose-100"
                            >
                                <LogOut className="w-4 h-4" />
                                {isLoggingOut ? "Signing Out..." : "Sign Out"}
                            </button>
                        </div>
                    </div>

                    {/* Middle/Right Column: Settings Groups */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Governance & Preferences */}
                        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Hub Preferences</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                                <Bell className="w-4 h-4 text-brand-primary" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">Push Alerts</span>
                                        </div>
                                        <button
                                            onClick={handleNotificationToggle}
                                            disabled={isPushEnabling}
                                            className={`w-10 h-5 rounded-full relative p-0.5 transition-colors ${profile?.notificationsEnabled ? 'bg-brand-primary' : 'bg-slate-300'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow transition-all ${profile?.notificationsEnabled ? 'ml-5' : 'ml-0'}`} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                                <Moon className="w-4 h-4 text-slate-600" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">Dark Interface</span>
                                        </div>
                                        <button
                                            onClick={() => document.documentElement.classList.toggle('dark')}
                                            className="w-10 h-5 bg-slate-300 rounded-full relative p-0.5"
                                        >
                                            <div className="w-4 h-4 bg-white rounded-full shadow" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                                <Globe className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">Display Language</span>
                                        </div>
                                        <select
                                            value={language}
                                            onChange={(e) => setLanguage(e.target.value)}
                                            className="bg-transparent text-xs font-black uppercase text-brand-primary border-none outline-none cursor-pointer"
                                        >
                                            <option value="en">EN</option>
                                            <option value="sw">SW</option>
                                        </select>
                                    </div>

                                    {!isInstalled && (canInstall || isIOS) && (
                                        <button
                                            onClick={!isIOS ? triggerInstall : undefined}
                                            className="w-full flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-900/10 active:scale-95 transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Smartphone className="w-4 h-4 text-white/50" />
                                                <span className="text-xs font-black uppercase tracking-widest">Install Hub</span>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-white/30" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Security Info */}
                        <div className="bg-emerald-50 rounded-[2.5rem] p-8 border border-emerald-100 flex items-start gap-4">
                            <Shield className="w-8 h-8 text-emerald-600 shrink-0 mt-1" />
                            <div>
                                <h4 className="text-lg font-black text-emerald-900">Secure Access Active</h4>
                                <p className="text-sm text-emerald-700 font-medium leading-relaxed mt-1">
                                    Your account is protected by hardware-based identity verification. Any changes to your bank details or agent identity require administrative verification from Hazina HQ.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pt-8 px-6 pb-32 font-sans relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary rounded-full -mr-32 -mt-32 blur-3xl opacity-10 pointer-events-none"></div>

            <div className="relative z-10 mb-8 mt-2">
                <h1 className="text-3xl font-bold font-heading text-slate-900">{t('profile')}</h1>
                <p className="text-sm font-medium text-slate-500 mt-1">Manage your account & preferences</p>
            </div>

            <div className="space-y-6 relative z-10">
                {/* Profile Card */}
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-center gap-5">
                    <div className="w-16 h-16 bg-gradient-to-br from-brand-secondary to-brand-primary rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-inner">
                        {profile?.national_id ? profile.national_id.substring(0, 2) : 'HZ'}
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 text-lg">Guardian Account</h2>
                        <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">Verified Secure</span>
                    </div>
                </div>

                {/* Account Settings */}
                <div className="space-y-3">
                    <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 ml-2">Account</h3>
                    <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 divide-y divide-slate-50">
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100" onClick={() => navigate('/complete-profile')}>
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-brand-50 text-brand-primary rounded-xl">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Personal Details</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                                        ID: {profile?.national_id || 'NOT SET'} • {profile?.currentCounty || 'NO COUNTY'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 italic">
                                        Residence: {profile?.currentTown || 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100" onClick={() => navigate('/topup')}>
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Subscription Tier</p>
                                    <p className="text-xs text-slate-500">Current: {profile?.active_tier?.toUpperCase() || 'BRONZE'}</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100" onClick={() => navigate('/topup')}>
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Payment Methods</p>
                                    <p className="text-xs text-slate-500">M-Pesa numbers</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100" onClick={() => navigate('/referrals')}>
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-teal-50 text-teal-500 rounded-xl">
                                    <Gift className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Target & Referrals</p>
                                    <p className="text-xs text-slate-500">Invite friends, earn points</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                    </div>
                </div>

                {/* Preferences */}
                <div className="space-y-3">
                    <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 ml-2">Preferences</h3>
                    <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 divide-y divide-slate-50">
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-indigo-50 text-indigo-500 rounded-xl">
                                    <Bell className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Notifications</p>
                                    <p className="text-xs text-slate-500">Push alerts</p>
                                </div>
                            </div>
                            <button
                                onClick={handleNotificationToggle}
                                disabled={isPushEnabling}
                                className={`w-12 h-6 rounded-full relative p-1 transition-colors outline-none ${profile?.notificationsEnabled ? 'bg-brand-primary' : 'bg-slate-200'} ${isPushEnabling ? 'opacity-50' : 'cursor-pointer'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${profile?.notificationsEnabled ? 'ml-6' : 'ml-0'}`}></div>
                            </button>
                        </div>

                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
                                    <Moon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Dark Mode</p>
                                    <p className="text-xs text-slate-500">Toggle dark theme</p>
                                </div>
                            </div>
                            <div className="w-12 h-6 bg-slate-200 rounded-full relative p-1 cursor-pointer" onClick={() => {
                                const isDark = document.documentElement.classList.toggle('dark');
                                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                            }}>
                                <div className="w-4 h-4 bg-white rounded-full transition-all duration-300 ml-0 dark:ml-6 shadow-sm"></div>
                            </div>
                        </div>

                        {/* Install App */}
                        {!isInstalled && (canInstall || isIOS) && (
                            <div
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100"
                                onClick={!isIOS ? triggerInstall : undefined}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl">
                                        <Smartphone className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">Install Hazina App</p>
                                        {isIOS ? (
                                            <p className="text-xs text-slate-500">Share ↑ → Add to Home Screen</p>
                                        ) : (
                                            <p className="text-xs text-slate-500">Add to your home screen</p>
                                        )}
                                    </div>
                                </div>
                                {!isIOS && <ChevronRight className="w-5 h-5 text-slate-300" />}
                            </div>
                        )}

                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-orange-50 text-orange-500 rounded-xl">
                                    <Globe className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Language</p>
                                    <p className="text-xs text-slate-500">Current: {language === 'en' ? 'English' : 'Kiswahili'}</p>
                                </div>
                            </div>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-700 outline-none"
                            >
                                <option value="en">English</option>
                                <option value="sw">Kiswahili</option>
                            </select>
                        </div>

                    </div>
                </div>

                {/* Danger Zone */}
                <div className="pt-6">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 font-bold rounded-2xl border border-red-100 hover:bg-red-100 active:scale-95 transition-all"
                    >
                        {isLoggingOut ? (
                            <span className="flex items-center gap-2">Logging out...</span>
                        ) : (
                            <>
                                <LogOut className="w-5 h-5" />
                                Log Out
                            </>
                        )}
                    </button>

                    <p className="text-center mt-6 mb-2 text-xs font-bold text-slate-400">
                        Hazina Care V.1.0.9
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ProfileSettings;
