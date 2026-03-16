import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, Users, CreditCard, ChevronRight, Zap, TrendingUp, AlertCircle, Clock, Heart, PlusCircle, Globe, FileText, User, Gift, Info } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import TierUpgradeModal from '../components/TierUpgradeModal';
import RecentActivity from '../components/RecentActivity';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { formatKenyanPhone, stripPlus } from '../utils/phoneUtils';

const Dashboard = () => {
    const { profile, user, isDemoMode } = useAuth();
    const { t, language, toggleLanguage } = useLanguage();
    const navigate = useNavigate();
    const toast = useToast();
    const [dependents, setDependents] = useState([]);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [burnPeriod, setBurnPeriod] = useState('daily');
    const [referralSystemActive, setReferralSystemActive] = useState(false); // Forced Off for lightweight experience
    const { isAgent, isMasterAgent, isSuperMaster } = useAuth();

    useEffect(() => {
        if (profile) {
            if (profile.role === 'guardian' && !profile.registration_fee_paid && !isDemoMode) {
                navigate('/pay-registration');
            }
        }
    }, [profile, navigate, isDemoMode]);

    useEffect(() => {
        if (profile) {
            const depQ = query(
                collection(db, 'dependents'), 
                where('guardian_id', 'in', [profile.id, profile.phoneNumber, profile.uid].filter(Boolean))
            );
            const unsubDeps = onSnapshot(depQ, (depSnap) => {
                setDependents(depSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                if (loading) setLoading(false);
            }, (err) => {
                console.error("Error fetching dependents:", err);
                if (loading) setLoading(false);
            });
            return () => unsubDeps();
        }
    }, [profile]);

    useEffect(() => {
        const fetchData = async () => {
            if (!profile) return;

            // Fetch Transactions & Claims
            if (isDemoMode) {
                setActivities([
                    { id: '1', type: 'topup', amount: 500, status: 'success', date: new Date() },
                    { id: '2', type: 'claim', amount: 3000, status: 'pending_review', date: new Date(Date.now() - 86400000) }
                ]);
                setLoading(false);
                return;
            }

            try {
                if (!db) { setLoading(false); return; }

                // Fetch Unified Transactions for Activity Timeline
                const transQ = query(
                    collection(db, 'transactions'),
                    where('user_id', '==', profile.id),
                    orderBy('timestamp', 'desc'),
                    limit(10)
                );
                const transSnap = await getDocs(transQ);
                const transData = transSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    date: doc.data().timestamp?.toDate()
                }));

                const depActivity = dependents.map(doc => ({
                    id: doc.id,
                    type: 'dependent',
                    label: doc.name,
                    status: 'completed',
                    date: doc.createdAt?.toDate()
                }));

                // Combine and Final Sort
                const combined = [...transData, ...depActivity]
                    .sort((a, b) => (b.date || 0) - (a.date || 0))
                    .slice(0, 10);

                setActivities(combined);

            } catch (error) {
                console.error("Error fetching activity data:", error);
            }
        };

        fetchData();
    }, [profile, isDemoMode, dependents.length]);

    if (!profile) return null;

    // Calculate maturation progress
    // Calculate maturation progress
    const now = new Date();

    // Safely handle both Firestore Timestamps (which have .toDate()) and regular JS Dates (from Demo Mode)
    const getSafeDate = (dateVal) => {
        if (!dateVal) return new Date();
        return typeof dateVal.toDate === 'function' ? dateVal.toDate() : new Date(dateVal);
    };

    const joinedDate = getSafeDate(profile.tier_joined_date);
    const graceExpiry = getSafeDate(profile.grace_period_expiry);
    const totalDays = differenceInDays(graceExpiry, joinedDate);
    const daysPassed = differenceInDays(now, joinedDate);
    const progressPercent = totalDays > 0
        ? Math.min(Math.max(Math.round((daysPassed / totalDays) * 100), 0), 100)
        : (daysPassed >= totalDays ? 100 : 0);
    const isMatured = daysPassed >= totalDays && totalDays > 0;

    const [tierConfig, setTierConfig] = useState({
        bronze: { cost: 10 },
        silver: { cost: 30 },
        gold: { cost: 50 }
    });

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'config', 'tiers'), (docSnap) => {
            if (docSnap.exists()) setTierConfig(docSnap.data());
        });
        const unsubRefs = onSnapshot(doc(db, 'config', 'referrals'), (docSnap) => {
            // Overridden locally to false, but keeping listener for possible future use
            // setReferralSystemActive(docSnap.exists() && docSnap.data().referralSystemActive !== false);
        });
        return () => { unsub(); unsubRefs(); };
    }, []);

            const getTierCost = (tierName) => {
        if (!tierName) return 0;
        const normalizedKey = tierName.toLowerCase();
        const config = tierConfig[normalizedKey] ||
            tierConfig[tierName.charAt(0).toUpperCase() + tierName.slice(1)] ||
            tierConfig[tierName.toUpperCase()] ||
            { cost: 0 };
        return config.cost || 0;
    };

    const baseDailyBurn = getTierCost(profile.active_tier);
    const dependentBurn = (dependents || []).reduce((sum, dep) => sum + getTierCost(dep.active_tier), 0);
    const totalDailyBurn = baseDailyBurn + dependentBurn;
    const peopleCount = 1 + (dependents?.length || 0);

    const multipliers = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };
    const calculatedBurn = totalDailyBurn * multipliers[burnPeriod];

    const runTestDeduction = async () => {
        if (isDemoMode) {
            toast.info("Test deduction simulated in Demo Mode.");
            return;
        }
        setLoading(true);
        try {
            const { httpsCallable } = await import('firebase/functions');
            const { functions } = await import('../services/firebase');
            const manualDeduct = httpsCallable(functions, 'manualDeduction');
            await manualDeduct();
            toast.success("Daily deduction processed successfully!");
        } catch (error) {
            console.error("Test deduction failed:", error);
            toast.error("Failed to run deduction: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-slate-50 pb-24">
            {/* Header / Nav */}
            <div className="pt-8 pb-12 bg-brand-secondary rounded-b-[3rem] px-6 text-white relative overflow-hidden">
                <div className="flex justify-between items-center relative z-10">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
                            <Shield className="w-6 h-6 text-brand-primary" />
                        </div>
                        <h2 className="text-lg font-black tracking-tight">{t('dashboard')}</h2>
                    </div>
                    <button onClick={toggleLanguage} className="bg-white/10 p-3 rounded-xl border border-white/20 font-black text-[10px]">{language === 'en' ? 'SW' : 'EN'}</button>
                </div>
            </div>

            {/* Premium Digital ID Card */}
            <div className="mobile-px -mt-10 relative z-20">
                <div className="bg-gradient-to-br from-brand-secondary via-[#2a0a0d] to-black rounded-[2.5rem] p-6 shadow-2xl border border-white/10 relative overflow-hidden ring-1 ring-white/5">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                {profile.id_photo_url ? (
                                    <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-brand-accent/30 shadow-2xl">
                                        <img src={profile.id_photo_url} alt="ID" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                        <User className="w-10 h-10 text-white/20" />
                                    </div>
                                )}
                                <div className="absolute -bottom-2 -right-2 bg-brand-primary p-1.5 rounded-lg border border-white/20 shadow-lg">
                                    <Shield className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white leading-tight">{profile.fullName || 'Member'}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                                        profile.active_tier === 'gold' ? 'bg-amber-400 text-amber-950' :
                                        profile.active_tier === 'silver' ? 'bg-slate-300 text-slate-800' :
                                        'bg-brand-primary text-white'
                                    }`}>
                                        {profile.active_tier}
                                    </span>
                                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                                        ID: {stripPlus(profile.referral_code || profile.id.substring(0, 8)).toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-2.5 rounded-2xl shadow-xl">
                            <QRCodeSVG value={profile.id} size={65} fgColor="#1a0a0d" />
                        </div>
                    </div>

                    {/* Consolidated Stats Strip */}
                    <div className="grid grid-cols-2 gap-px bg-white/10 rounded-3xl overflow-hidden border border-white/5">
                        <div className="bg-white/5 backdrop-blur-md p-4 flex flex-col items-center border-r border-white/5 cursor-pointer" onClick={() => navigate('/topup')}>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">{t('wallet_balance') || 'Wallet'}</p>
                            <p className="text-lg font-black text-white">KSh {profile.balance?.toLocaleString() || 0}</p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md p-4 flex flex-col items-center relative group overflow-hidden">
                            <select
                                value={burnPeriod}
                                onChange={(e) => setBurnPeriod(e.target.value)}
                                className="text-[10px] font-black text-white/40 uppercase tracking-widest bg-transparent border-none p-0 pr-4 focus:ring-0 cursor-pointer outline-none appearance-none text-center"
                            >
                                <option value="daily" className="text-black">DAILY COST</option>
                                <option value="weekly" className="text-black">WEEKLY COST</option>
                                <option value="monthly" className="text-black">MONTHLY COST</option>
                            </select>
                            <p className="text-lg font-black text-brand-primary">KSh {calculatedBurn.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mobile-px mt-6 space-y-6">
                {/* Status Banners */}
                {profile?.balance < 0 && (
                    <div className="p-4 bg-red-500/10 rounded-[2rem] border border-red-500/20 flex items-center gap-4">
                        <div className="p-3 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-500/20">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[11px] text-red-100/80 font-medium">Overdraft Alert: KSh {Math.abs(profile.balance)}</p>
                            <button onClick={() => navigate('/topup')} className="text-[10px] font-black text-red-400 uppercase tracking-widest mt-1">Top up now &rarr;</button>
                        </div>
                    </div>
                )}

                {/* Shield Maturation Mini-Card */}
                <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${isMatured ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                                <Shield className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">{t('shield_growth')}</h4>
                                <p className="text-[10px] text-slate-400 uppercase font-black">{progressPercent}% Matured</p>
                            </div>
                        </div>
                        {isAgent && (
                             <button onClick={runTestDeduction} className="text-[10px] font-black text-brand-primary uppercase">Run Test</button>
                        )}
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-primary rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>

                {/* Referrals Banner */}
                {referralSystemActive && (
                    <div onClick={() => navigate('/referrals')} className="bg-gradient-to-r from-brand-primary to-brand-secondary rounded-[2rem] p-6 shadow-lg shadow-brand-primary/20 relative overflow-hidden cursor-pointer group transform hover:-translate-y-1 transition-all">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-150 transition-duration-700"></div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex-1">
                                <h4 className="text-white font-black text-lg mb-1 flex items-center gap-2">
                                    <Gift className="w-5 h-5 text-brand-accent" /> {t('refer_and_earn') || 'Refer & Earn'}
                                </h4>
                                <p className="text-white/80 text-xs font-medium opacity-90 max-w-[200px]">
                                    {t('invite_friends_desc') || 'Invite friends and get up to 14 days of free protection!'}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 group-hover:bg-white group-hover:text-brand-primary transition-colors">
                                <ChevronRight className="w-6 h-6 text-white group-hover:text-brand-primary" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Sifuna Hub / Concierge */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">{t('ask_sifuna') || 'Ask Sifuna AI'}</h4>
                    </div>
                    <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar -mx-2 px-2">
                        {[
                            { id: 'wallet', icon: '💰', label: language === 'sw' ? 'M-Pesa' : 'Wallet' },
                            { id: 'shield', icon: '🛡️', label: language === 'sw' ? 'Ngao' : 'Shield' },
                            { id: 'claims', icon: '🚑', label: language === 'sw' ? 'Madai' : 'Claims' },
                            { id: 'family', icon: '👨‍👩‍👧', label: language === 'sw' ? 'Familia' : 'Family' },
                            referralSystemActive ? { id: 'referrals', icon: '🎁', label: language === 'sw' ? 'Zawadi' : 'Rewards' } : null,
                        ].filter(Boolean).map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    window.dispatchEvent(new CustomEvent('open-sifuna', {
                                        detail: { category: cat.id }
                                    }));
                                }}
                                className="flex-shrink-0 flex flex-col items-center gap-2 p-4 bg-white rounded-3xl shadow-sm border border-slate-100 hover:border-brand-primary/30 hover:shadow-md transition-all active:scale-95 min-w-[85px]"
                            >
                                <span className="text-2xl">{cat.icon}</span>
                                <span className="text-[10px] font-black uppercase tracking-tight text-slate-600">{cat.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-3">
                    <h4 className="font-black text-xs uppercase tracking-widest text-slate-400 ml-1">{t('guardian_services')}</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => navigate('/claim')}
                            className="flex flex-col items-center gap-3 p-6 bg-white rounded-[2rem] shadow-sm hover:shadow-md transition-all active:scale-95 border border-slate-100 group"
                        >
                            <div className="p-4 bg-red-50 text-red-500 rounded-2xl group-hover:bg-red-500 group-hover:text-white transition-colors duration-500">
                                <Heart className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-bold text-slate-700">{t('crisis_claim')}</span>
                        </button>
                        <button
                            onClick={() => setIsUpgradeModalOpen(true)}
                            className="flex flex-col items-center gap-3 p-6 bg-white rounded-[2rem] shadow-sm hover:shadow-md transition-all active:scale-95 border border-slate-100 group"
                        >
                            <div className="p-4 bg-amber-50 text-amber-500 rounded-2xl group-hover:bg-amber-500 group-hover:text-white transition-colors duration-500">
                                <Zap className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-bold text-slate-700">{t('upgrade_tier')}</span>
                        </button>
                        <button
                            onClick={() => navigate('/benefits')}
                            className="flex flex-col items-center gap-3 p-6 bg-white rounded-[2rem] shadow-sm hover:shadow-md transition-all active:scale-95 border border-slate-100 group"
                        >
                            <div className="p-4 bg-blue-50 text-blue-500 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-colors duration-500">
                                <Info className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-bold text-slate-700">{t('package_info')}</span>
                        </button>
                        {referralSystemActive && (
                            <button
                                onClick={() => navigate('/referrals')}
                                className="flex flex-col items-center gap-3 p-6 bg-white rounded-[2rem] shadow-sm hover:shadow-md transition-all active:scale-95 border border-slate-100 group"
                            >
                                <div className="p-4 bg-emerald-50 text-emerald-500 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-500">
                                    <Gift className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-bold text-slate-700">{t('referrals')}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="card bg-white shadow-md border-none overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-black text-slate-900 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-brand-primary" />
                            {t('recent_activity')}
                        </h4>
                    </div>
                    <div className="space-y-1">
                        {activities.length > 0 ? (
                            activities.slice(0, 3).map(activity => (
                                <div key={activity.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-xl ${activity.type === 'topup' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {activity.type === 'topup' ? <CreditCard className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">
                                                {activity.type === 'topup' ? t('wallet_topup') : t('crisis_claim')}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                {activity.date ? format(activity.date, 'MMM d, yyyy') : 'Recently'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-slate-900 text-sm">KSh {activity.amount?.toLocaleString() || 0}</p>
                                        <p className={`text-[9px] font-black uppercase tracking-widest ${activity.status === 'completed' || activity.status === 'approved' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                            {(activity.status || 'pending').replace('_', ' ')}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6 text-slate-400 text-sm font-bold italic">
                                {t('no_recent_activity')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Family Members */}
                <div className="card bg-white shadow-md border-none pb-4">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-black text-slate-900 flex items-center gap-2">
                            <Users className="w-5 h-5 text-brand-primary" />
                            {t('dependents')} <span className="text-sm text-slate-400 font-normal">({dependents.length})</span>
                        </h4>
                        <button
                            onClick={() => navigate('/family')}
                            className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl hover:bg-brand-primary hover:text-white transition-all"
                        >
                            <PlusCircle className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {dependents.length > 0 ? dependents.map(dep => (
                            <div key={dep.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-500">
                                        {dep.name?.[0] || '?'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{dep.name}</p>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-tighter uppercase">{dep.active_tier} Coverage</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!dep.is_matured && (
                                        <Clock className="w-4 h-4 text-yellow-500" />
                                    )}
                                    <ChevronRight className="w-5 h-5 text-slate-300" />
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Users className="w-8 h-8 text-slate-300" />
                                </div>
                                <p className="text-xs text-slate-400 italic">{t('protect_family')}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                        <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">{t('activity_timeline')}</h4>
                        <button onClick={() => navigate('/topup')} className="text-[10px] font-black text-brand-primary uppercase tracking-tighter">{t('view_all')}</button>
                    </div>
                    <RecentActivity activities={activities} />
                </div>
            </div>

            <TierUpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                currentTier={profile.active_tier}
                profileId={profile.id}
                isDemoMode={isDemoMode}
                onUpgradeSuccess={(newTier) => {
                    // Refresh data or update local state if needed
                }}
            />
        </div>
    );
};

export default Dashboard;
