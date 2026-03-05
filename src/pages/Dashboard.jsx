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

const Dashboard = () => {
    const { profile, user, isDemoMode } = useAuth();
    const { t, language, toggleLanguage } = useLanguage();
    const navigate = useNavigate();
    const [dependents, setDependents] = useState([]);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [burnPeriod, setBurnPeriod] = useState('daily');

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

                // Fetch Dependents
                const depQ = query(collection(db, 'dependents'), where('guardian_id', '==', profile.id));
                const depSnap = await getDocs(depQ);
                setDependents(depSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

                // Fetch Claims
                const claimsQ = query(collection(db, 'claims'), where('guardian_id', '==', profile.id), orderBy('createdAt', 'desc'), limit(5));
                const claimsSnap = await getDocs(claimsQ);
                const claimsData = claimsSnap.docs.map(doc => ({
                    id: doc.id,
                    type: 'claim',
                    ...doc.data(),
                    date: doc.data().createdAt?.toDate()
                }));

                // Fetch Topups
                const topupsQ = query(collection(db, 'topups'), where('guardian_id', '==', profile.id), orderBy('createdAt', 'desc'), limit(5));
                const topupsSnap = await getDocs(topupsQ);
                const topupsData = topupsSnap.docs.map(doc => ({
                    id: doc.id,
                    type: 'topup',
                    ...doc.data(),
                    date: doc.data().createdAt?.toDate()
                }));

                // Treat recently added dependents as activity
                const depActivity = depSnap.docs.map(doc => ({
                    id: doc.id,
                    type: 'dependent',
                    label: doc.data().name,
                    status: 'completed',
                    date: doc.data().createdAt?.toDate()
                }));

                // Combine and Sort
                const combined = [...claimsData, ...topupsData, ...depActivity]
                    .sort((a, b) => (b.date || 0) - (a.date || 0))
                    .slice(0, 7);

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

    const baseDailyBurn = tierConfig[profile.active_tier]?.cost || 0;
    const dependentBurn = dependents.reduce((sum, dep) => sum + (tierConfig[dep.active_tier]?.cost || 0), 0);
    const totalDailyBurn = baseDailyBurn + dependentBurn;

    const multipliers = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };
    const calculatedBurn = totalDailyBurn * multipliers[burnPeriod];

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header Profile Section */}
            <div className="bg-brand-secondary text-white pt-12 pb-24 px-6 rounded-b-[3rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="flex justify-between items-center mb-10 relative">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                            <Shield className="w-8 h-8 text-brand-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold font-heading">{t('dashboard')}</h2>
                            <p className="text-white/60 text-sm">Community Member Since {joinedDate instanceof Date && !isNaN(joinedDate) ? format(joinedDate, 'MMM yyyy') : '...'}</p>
                        </div>
                    </div>
                    <button
                        onClick={toggleLanguage}
                        className="flex items-center gap-2 p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 hover:bg-white/20 transition-all font-bold text-xs uppercase"
                    >
                        <Globe className="w-5 h-5 text-white" />
                        <span>{language === 'en' ? 'SW' : 'EN'}</span>
                    </button>
                </div>

                {/* Digital ID Card */}
                <div className="relative group perspective-1000">
                    <div className="bg-gradient-to-br from-brand-primary via-brand-secondary to-[#2d060a] p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden transform-gpu hover:rotate-y-6 transition-all duration-700">
                        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                        <div className="flex justify-between items-start mb-10">
                            <div className="flex items-center gap-4">
                                {profile.id_photo_url ? (
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/20 shadow-inner flex-shrink-0 relative">
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
                                    <div className="w-16 h-16 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
                                        <User className="w-8 h-8 text-white/50" />
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs uppercase tracking-widest text-brand-accent/70 font-bold mb-1">{t('official_digital_id')}</p>
                                    <h3 className="text-lg font-black text-white mb-0.5 tracking-tight">{profile.fullName || 'Member'}</h3>
                                    <p className="text-[10px] font-bold text-brand-accent/50 uppercase tracking-widest">ID: {profile.national_id || profile.id.substring(0, 8).toUpperCase()}</p>
                                </div>
                            </div>
                            <div className="relative">
                                {!isMatured && (
                                    <div className="bg-brand-accent text-brand-secondary px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg animate-pulse border-2 border-white/20">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-tight">{t('in_waiting')}</span>
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
                                    <p className="text-[10px] uppercase font-bold text-brand-accent/40 mb-1">{t('phone_number')}</p>
                                    <p className="font-bold font-mono tracking-widest text-white">{profile.phoneNumber}</p>
                                </div>
                            </div>
                            <div className="bg-white p-2.5 rounded-2xl shadow-xl transform group-hover:scale-110 transition-transform duration-500">
                                <QRCodeSVG value={profile.id} size={70} fgColor="#3d080e" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats and Info Area */}
            <div className="px-6 -mt-10 space-y-6 relative">
                {profile?.status === 'pending_payment' && (
                    <div className="p-4 bg-amber-50 rounded-[2rem] border border-amber-200 shadow-lg animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-400 text-amber-950 rounded-2xl">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-amber-900 text-sm">{t('action_required')}</h4>
                                <p className="text-xs text-amber-800 opacity-80 mt-0.5">{t('activate_shield')}</p>
                                <button onClick={() => navigate('/topup')} className="mt-2 text-xs font-black uppercase text-amber-950 flex items-center gap-1">
                                    {t('fund_now')} <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Daily Burn Card */}
                <div className="grid grid-cols-2 gap-4">
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
                                    className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter bg-transparent border-none p-0 pr-4 focus:ring-0 cursor-pointer outline-none"
                                >
                                    <option value="daily">{t('daily_burn')}</option>
                                    <option value="weekly">{t('weekly_burn')}</option>
                                    <option value="monthly">{t('monthly_burn')}</option>
                                    <option value="yearly">{t('yearly_burn')}</option>
                                </select>
                            </div>
                        </div>
                        <p className="text-3xl font-black text-slate-900 relative z-10">KSh {calculatedBurn.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 italic relative z-10">
                            <AlertCircle className="w-3 h-3" /> {t('auto_deducted')}
                        </p>
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
                            className={`h-full rounded-full transition-all duration-1000 ease-out relative shadow-sm ${isMatured ? 'bg-gradient-to-r from-brand-primary to-brand-accent' : 'bg-gradient-to-r from-yellow-400 to-orange-400'
                                }`}
                            style={{ width: `${progressPercent}%` }}
                        >
                            <div className="absolute top-0 right-0 h-full w-full bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:24px_24px] animate-shimmer"></div>
                        </div>
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
