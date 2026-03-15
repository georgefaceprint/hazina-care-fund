import React from 'react';
import { Trash2, RefreshCcw, Database, Gift, ShieldCheck, QrCode, ShieldAlert } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

const SystemTab = ({ 
    profile, 
    referralSystemActive, 
    handleToggleReferral, 
    totpStep, 
    setTotpStep,
    totpSetup, 
    totpCode, 
    setTotpCode, 
    isTotpLoading, 
    handleSetupTotp, 
    handleVerifyTotp, 
    handleDisableTotp,
    handleLogout,
    toast 
}) => {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Local Cache Management */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                        <Trash2 className="w-6 h-6 text-red-500" />
                        Client Device Tools
                    </h3>
                    <p className="text-sm text-slate-500 mb-6 font-medium">Use these if the app feels "stuck" or isn't showing new data on your device.</p>
                    
                    <div className="space-y-4">
                        <button
                            onClick={async () => {
                                if (window.confirm("This will clear your local sessions and log you out. Continue?")) {
                                    localStorage.clear();
                                    sessionStorage.clear();
                                    toast.success("Local storage cleared. Logging out...");
                                    setTimeout(() => handleLogout(), 1000);
                                }
                            }}
                            className="w-full py-4 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 font-black uppercase tracking-widest rounded-2xl transition-all border border-slate-200 flex items-center justify-center gap-2"
                        >
                            <RefreshCcw className="w-5 h-5" />
                            Nuke Local Storage
                        </button>

                        <button
                            onClick={async () => {
                                if ('serviceWorker' in navigator) {
                                    const registrations = await navigator.serviceWorker.getRegistrations();
                                    for (let registration of registrations) {
                                        await registration.unregister();
                                    }
                                    const cacheNames = await caches.keys();
                                    for (let cacheName of cacheNames) {
                                        await caches.delete(cacheName);
                                    }
                                    toast.success("Service Workers and Caches cleared.");
                                    setTimeout(() => window.location.reload(), 1000);
                                }
                            }}
                            className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase tracking-widest rounded-2xl transition-all border border-slate-200 flex items-center justify-center gap-2"
                        >
                            <Database className="w-5 h-5" />
                            Purge PWA Assets
                        </button>
                    </div>
                </div>

                {/* Global Cache Management */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                        <RefreshCcw className="w-6 h-6 text-amber-500" />
                        Global System Cache
                    </h3>
                    <p className="text-sm text-slate-500 mb-6 font-medium">Forces <strong>ALL</strong> connected users to clear their cache and reload the latest version of Hazina.</p>
                    
                    <div className="space-y-4">
                        <button
                            onClick={async () => {
                                if (window.confirm("CRITICAL: This will force ALL users to reload their app. Only use after a major database change or wipe. Proceed?")) {
                                    try {
                                        const newVersion = Date.now();
                                        await setDoc(doc(db, 'config', 'system'), {
                                            cache_version: newVersion,
                                            last_purge_by: profile.id,
                                            timestamp: serverTimestamp()
                                        }, { merge: true });
                                        toast.success("Global cache-bust signal sent!");
                                    } catch (e) {
                                        toast.error("Failed to send global signal: " + e.message);
                                    }
                                }
                            }}
                            className="w-full py-8 bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 hover:bg-brand-primary active:scale-95 italic"
                        >
                            <RefreshCcw className="w-6 h-6 animate-spin-slow" />
                            Force Global Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Referral System Toggle */}
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex items-center justify-between group overflow-hidden relative">
                <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -ml-16 -mt-16"></div>
                <div className="relative z-10">
                    <h3 className="text-xl font-black mb-1 flex items-center gap-3 italic">
                        <Gift className="w-6 h-6 text-emerald-500" />
                        Refer & Earn System
                    </h3>
                    <p className="text-sm text-slate-500 font-medium">Enable or disable the global referral rewards program.</p>
                </div>
                <button
                    onClick={handleToggleReferral}
                    className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors focus:outline-none ${referralSystemActive ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                    <span className="sr-only">Toggle Global Referrals</span>
                    <span
                        className={`${referralSystemActive ? 'translate-x-11' : 'translate-x-1'} inline-block h-8 w-8 transform rounded-full bg-white transition-transform`}
                    />
                </button>
            </div>

            {/* Two-Factor Authentication (TOTP) */}
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 italic relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                
                <div className="relative z-10">
                    <h3 className="text-xl font-black mb-2 flex items-center gap-3">
                        <ShieldCheck className="w-6 h-6 text-brand-primary" />
                        Security: Authenticator App (TOTP)
                    </h3>
                    <p className="text-sm text-slate-500 mb-8 max-w-2xl font-medium">Use apps like Google Authenticator or Authy to log into any portal on Hazina. This replaces SMS OTP for faster and more secure access.</p>

                    {profile?.totpEnabled ? (
                        <div className="flex items-center justify-between bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                                    <ShieldCheck className="w-7 h-7" />
                                </div>
                                <div>
                                    <p className="font-black text-emerald-900 tracking-tight">Authenticator Active</p>
                                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Enhanced Security Enabled</p>
                                </div>
                            </div>
                            <button
                                onClick={handleDisableTotp}
                                className="px-6 py-2.5 bg-white text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 hover:bg-red-50 transition-all active:scale-95"
                            >
                                Disable App
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {totpStep === 'idle' && (
                                <button
                                    onClick={handleSetupTotp}
                                    disabled={isTotpLoading}
                                    className="px-8 py-4 bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-slate-900/20 flex items-center gap-3 hover:bg-brand-primary transition-all active:scale-95"
                                >
                                    {isTotpLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                                    Setup Authenticator App
                                </button>
                            )}

                            {totpStep === 'generated' && totpSetup && (
                                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 animate-in zoom-in-95 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                                        <div className="flex flex-col items-center justify-center bg-white p-6 rounded-3xl shadow-inner border border-slate-100">
                                            <img src={totpSetup.qrCodeUrl} alt="QR Code" className="w-48 h-48 mb-4 border-4 border-white shadow-sm" />
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Scan with your app</p>
                                        </div>
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="font-black text-slate-900 mb-2">Configure and Verify</h4>
                                                <p className="text-xs text-slate-500 mb-4 leading-relaxed">1. Open your Authenticator app (Google, Authy, etc).<br/>2. Scan the QR code shown here.<br/>3. Enter the 6-digit code from the app below.</p>
                                            </div>
                                            <div className="space-y-4">
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    className="w-full bg-white p-5 rounded-2xl border border-slate-200 text-center text-3xl font-black tracking-[0.5em] focus:ring-2 focus:ring-brand-primary outline-none transition-all placeholder:text-slate-200"
                                                    placeholder="000000"
                                                    value={totpCode}
                                                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                                />
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => setTotpStep('idle')}
                                                        className="flex-1 py-4 bg-white text-slate-500 font-black uppercase tracking-widest rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleVerifyTotp}
                                                        disabled={isTotpLoading}
                                                        className="flex-[2] py-4 bg-brand-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition-all active:scale-[0.98] disabled:opacity-50"
                                                    >
                                                        {isTotpLoading ? 'Verifying...' : 'Verify & Activate'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SystemTab;
