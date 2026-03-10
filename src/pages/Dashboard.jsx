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
    const { isAgent, isMasterAgent, isSuperMaster } = useAuth();

    useEffect(() => {
        if (!loading && profile) {
            if (isSuperMaster) navigate('/super');
            else if (isMasterAgent) navigate('/master');
            else if (isAgent) navigate('/agent');
        }
    }, [profile, loading, isSuperMaster, isMasterAgent, isAgent, navigate]);

    useEffect(() => {
        const fetchData = async () => {
            if (!profile) return;

            // Fetch Dependents
            if (isDemoMode) {
                setDependents([{ id: 'demo-1', name: 'Demo Dependent', active_tier: 'gold', is_matured: false }]);
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

                // Fetch Claims and Dependents for other UI elements
                const claimsQ = query(collection(db, 'claims'), where('guardian_id', '==', profile.id), orderBy('createdAt', 'desc'), limit(5));
                const claimsSnap = await getDocs(claimsQ);
                const depQ = query(collection(db, 'dependents'), where('guardian_id', '==', profile.id));
                const depSnap = await getDocs(depQ);
                setDependents(depSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

                // Combine with manual dependent added activity if needed
                const depActivity = depSnap.docs.map(doc => ({
                    id: doc.id,
                    type: 'dependent',
                    label: doc.data().name,
                    status: 'completed',
                    date: doc.data().createdAt?.toDate()
                }));

                // Combine and Final Sort
                const combined = [...transData, ...depActivity]
                    .sort((a, b) => (b.date || 0) - (a.date || 0))
                    .slice(0, 10);

                setActivities(combined);

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [profile, isDemoMode]);

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
        return () => unsub();
    }, []);

    const baseDailyBurn = tierConfig[profile.active_tier?.toLowerCase()]?.cost || 0;
    const dependentBurn = (dependents || []).reduce((sum, dep) => sum + (tierConfig[dep.active_tier?.toLowerCase()]?.cost || 0), 0);
    const totalDailyBurn = baseDailyBurn + dependentBurn;
    const peopleCount = 1 + (dependents?.length || 0);

    const multipliers = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };
    const calculatedBurn = totalDailyBurn * multipliers[burnPeriod];

    // Per-person rate (average or specific if we want to be detailed)
    const perPersonRate = peopleCount > 0 ? (totalDailyBurn / peopleCount).toFixed(0) : 0;


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
            {/* Header Profile Section */}
            <div className="bg-brand-secondary text-white pt-12 pb-24 rounded-b-[3rem] shadow-2xl relative overflow-hidden mobile-px">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                            <Shield className="w-7 h-7 text-brand-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold font-heading">{t('dashboard')}</h2>
                            <p className="text-white/60 text-sm">Community Member Since {joinedDate instanceof Date && !isNaN(joinedDate) ? format(joinedDate, 'MMM yyyy') : '...'}</p>
                        </div>
                    </div>
                    <button
                        onClick={toggleLanguage}
                        className="flex items-center gap-2 p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 hover:bg-white/20 transition-all font-bold text-xs uppercase min-h-[56px]"
                    >
                        <Globe className="w-5 h-5 text-white" />
                        <span>{language === 'en' ? 'SW' : 'EN'}</span>
                    </button>
                </div>

                <div className="relative group perspective-1000 -mt-2">
                    <div className="bg-gradient-to-br from-brand-primary via-brand-secondary to-[#1a0406] p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 relative overflow-hidden transform-gpu hover:rotate-y-3 transition-all duration-700">
                        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                        <div className="flex justify-between items-start mb-10">
                            <div className="flex items-center gap-4 sm:gap-5">
                                {profile.id_photo_url ? (
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-brand-accent/30 shadow-2xl flex-shrink-0 relative">
                                        <img
                                            src={profile.id_photo_url}
                                            alt="ID Photo"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.style.display = 'none';
                                                e.target.nextElementSibling.style.display = 'flex';
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-brand-primary text-white flex items-center justify-center font-bold text-2xl hidden fallback-icon">
                                            {profile.fullName ? profile.fullName.charAt(0).toUpperCase() : '?'}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-white/5 border-2 border-white/10 flex items-center justify-center shadow-inner flex-shrink-0">
                                        <User className="w-10 h-10 text-brand-accent/40" />
                                    </div>
                                )}
                                <div>
                                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-brand-accent/80 mb-1">{t('official_digital_id')}</p>
                                    <h3 className="text-xl font-black text-white leading-tight tracking-tight">{profile.fullName || 'Member'}</h3>
                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">ID: {profile.referral_code || profile.id.substring(0, 8).toUpperCase()}</p>
                                </div>
                            </div>
                            <div className="relative">
                                {!isMatured && (
                                    <div className="bg-brand-accent/10 backdrop-blur-md text-brand-accent px-4 py-1.5 rounded-full flex items-center gap-2 shadow-xl border border-brand-accent/30 scale-90 translate-x-2 -translate-y-2">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">{t('in_waiting')}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-between items-end">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-inner border flex items-center gap-2 ${profile.active_tier === 'gold' ? 'bg-amber-400 text-amber-950 border-amber-300' :
                                        profile.active_tier === 'silver' ? 'bg-slate-300 text-slate-800 border-slate-200' :
                                            'bg-orange-800/20 text-orange-200 border-orange-700/30'
                                        }`}>
                                        <Zap className="w-3 h-3" />
                                        {profile.active_tier} Member
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-brand-accent/50 mb-1 tracking-widest">{t('phone_number')}</p>
                                    <p className="font-bold font-mono tracking-[0.3em] text-white underline decoration-brand-accent/20 underline-offset-4">{profile.phoneNumber}</p>
                                </div>
                            </div>
                            <div className="bg-white p-3.5 rounded-[1.5rem] shadow-[0_20px_40px_rgba(0,0,0,0.4)] border border-brand-accent/20">
                                <QRCodeSVG value={profile.id} size={85} fgColor="#6B2324" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats and Info Area */}
            <div className="mobile-px -mt-10 space-y-6 relative">
                {profile?.status === 'pending_payment' && (
                    <div className="p-4 bg-amber-50 rounded-[2rem] border border-amber-200 shadow-lg animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-400 text-amber-950 rounded-2xl">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-amber-900 text-sm">{t('action_required')}</h4>
                                <p className="text-xs text-amber-800 opacity-80 mt-0.5">{t('activate_shield')}</p>
                                <button onClick={() => navigate('/topup')} className="mt-2 text-xs font-black uppercase text-amber-950 flex items-center gap-1 min-h-[56px]">
                                    {t('fund_now')} <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Daily Burn Card */}
                <div className="card-grid">
                    <div className="card bg-white border-none shadow-md overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-brand-primary/5 rounded-full -mr-8 -mt-8 transition-all group-hover:scale-150"></div>
                        <div className="flex items-center justify-between mb-3 relative z-10">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-brand-primary/10 rounded-xl">
                                    <TrendingUp className="w-5 h-5 text-brand-primary" />
                                </div>
                                <select
                                    value={burnPeriod}
                                    onChange={(e) => setBurnPeriod(e.target.value)}
                                    className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter bg-transparent border-none p-0 pr-4 focus:ring-0 cursor-pointer outline-none min-h-[56px]"
                                >
                                    <option value="daily">{t('daily_burn')}</option>
                                    <option value="weekly">{t('weekly_burn')}</option>
                                    <option value="monthly">{t('monthly_burn')}</option>
                                    <option value="yearly">{t('yearly_burn')}</option>
                                </select>
                            </div>
                        </div>
                        <p className="text-3xl font-black text-slate-900 relative z-10">KSh {calculatedBurn.toLocaleString()}</p>
                        <div className="flex flex-col mt-2 relative z-10">
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 italic">
                                <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {t('auto_deducted')}</span>
                                <span className="font-bold text-brand-primary/60 not-italic font-sans ml-auto">
                                    {peopleCount} {t('people')} Total
                                </span>
                            </p>
                            <div className="mt-2 p-2 bg-slate-50 rounded-xl space-y-1">
                                <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase">
                                    <span>You ({profile.active_tier})</span>
                                    <span>KSh {baseDailyBurn}/day</span>
                                </div>
                                {dependents.map(dep => (
                                    <div key={dep.id} className="flex justify-between text-[9px] font-medium text-slate-400 uppercase">
                                        <span>{dep.name} ({dep.active_tier})</span>
                                        <span>KSh {tierConfig[dep.active_tier?.toLowerCase()]?.cost || 0}/day</span>
                                    </div>
                                ))}
                                <div className="border-t border-slate-200 pt-1 mt-1 flex justify-between text-[10px] font-black text-brand-primary uppercase">
                                    <span>Total Rate</span>
                                    <span>KSh {totalDailyBurn}/day</span>
                                </div>
                            </div>
                        </div>

                    </div>
                    <div className="card bg-white border-none shadow-md overflow-hidden relative group cursor-pointer" onClick={() => navigate('/topup')}>
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full -mr-8 -mt-8 transition-all group-hover:scale-150"></div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-500/10 rounded-xl">
                                <CreditCard className="w-5 h-5 text-blue-500" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{t('your_fund')}</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900">KSh {profile.balance || 0}</p>
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 italic">
                            {t('top_up_via_mpesa')} <ChevronRight className="w-3 h-3" />
                        </p>
                    </div>
                </div>

                {/* Maturation Status */}
                <div className="card bg-white p-6 shadow-md border-none relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <Shield className={`w-6 h-6 ${isMatured ? 'text-brand-primary' : 'text-yellow-500 animate-pulse'}`} />
                            <div>
                                <h4 className="font-bold text-slate-900">{t('shield_growth')}</h4>
                                <p className="text-xs text-slate-400">
                                    {isMatured ? t('fully_protected') : `${tierConfig[profile.active_tier]?.maturation || 180} ${t('days')} ${t('maturation_desc')}`}
                                </p>
                            </div>
                        </div>
                        <span className="text-2xl font-black text-brand-primary">{progressPercent}%</span>
                    </div>

                    <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden p-1 shadow-inner border border-slate-50">
                        <div
                            className="h-full bg-gradient-to-r from-brand-primary to-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            style={{ width: `${progressPercent}%` }}
                        >
                            <div className="absolute top-0 right-0 h-full w-full bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:24px_24px] animate-shimmer"></div>
                        </div>
                    </div>

                    {/* Test Deduction Trigger (Only for testers/admin in this phase) */}
                    <div className="mt-8 pt-6 border-t border-slate-50">
                        <button
                            onClick={runTestDeduction}
                            disabled={loading}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            {loading ? "Processing..." : "Run Daily Burn Test"}
                        </button>
                        <p className="text-[9px] text-center text-slate-400 mt-3 font-bold uppercase tracking-tighter">
                            🛠️ Tester Tool: Trigger one-day deduction of KSh {totalDailyBurn}
                        </p>
                    </div>

                    {!isMatured && (
                        <div className="mt-6 p-4 bg-yellow-50/50 rounded-2xl border border-yellow-100/50 text-xs text-slate-600 flex gap-4 items-center">
                            <Clock className="w-10 h-10 text-yellow-600" />
                            <p className="leading-relaxed">
                                {t('shield_matured_on')} <strong className="text-yellow-700">{graceExpiry instanceof Date && !isNaN(graceExpiry) ? format(graceExpiry, 'PP') : '...'}</strong>.
                                {t('daily_contributions')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Referrals Banner */}
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
                            { id: 'referrals', icon: '🎁', label: language === 'sw' ? 'Zawadi' : 'Rewards' },
                        ].map(cat => (
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
                        <button
                            onClick={() => navigate('/referrals')}
                            className="flex flex-col items-center gap-3 p-6 bg-white rounded-[2rem] shadow-sm hover:shadow-md transition-all active:scale-95 border border-slate-100 group"
                        >
                            <div className="p-4 bg-emerald-50 text-emerald-500 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-500">
                                <Gift className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-bold text-slate-700">{t('referrals')}</span>
                        </button>
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
