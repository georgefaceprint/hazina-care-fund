import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc, addDoc, serverTimestamp, setDoc, deleteDoc, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ShieldAlert, Clock, XCircle, Search, DollarSign, Filter, FileText, Bot, TrendingUp, Zap, LogOut, Sparkles, Users, UserPlus, MapPin, QrCode, Clipboard, Trash2, RefreshCcw, Database } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { format, subDays, startOfDay } from 'date-fns';
import { formatKenyanPhone } from '../utils/phoneUtils';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';

const getSafeDate = (dateVal) => {
    if (!dateVal) return new Date();
    return typeof dateVal.toDate === 'function' ? dateVal.toDate() : new Date(dateVal);
};

const AdminPanel = () => {
    const { profile, isDemoMode, logout, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending_review');
    const [users, setUsers] = useState([]);
    const [activeTab, setActiveTab] = useState('claims'); // 'claims' | 'users' | 'transactions' | 'analytics'
    const [transactions, setTransactions] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);
    const [globalStats, setGlobalStats] = useState({ total_fund: 0, total_burn: 0, total_topups: 0, total_claims_paid: 0 });
    const [kbItems, setKbItems] = useState([]);
    const [tiers, setTiers] = useState({});
    const [newKb, setNewKb] = useState({ question: '', answer: '' });
    const [isGenerating, setIsGenerating] = useState(false);
    const [agents, setAgents] = useState([]);
    const [masterAgents, setMasterAgents] = useState([]);
    const [recruitmentLogs, setRecruitmentLogs] = useState([]);
    const [recruitmentStats, setRecruitmentStats] = useState({ today: 0, total_payouts: 0 });
    const [recruitmentConfig, setRecruitmentConfig] = useState({ agentCommission: 15, masterCommission: 5 });

    // TOTP States
    const [totpSetup, setTotpSetup] = useState(null); // { secret, otpauth, qrCodeUrl }
    const [totpStep, setTotpStep] = useState('idle'); // 'idle' | 'generated' | 'verifying'
    const [totpCode, setTotpCode] = useState('');
    const [isTotpLoading, setIsTotpLoading] = useState(false);
    const [forcedTotpList, setForcedTotpList] = useState([]);
    const [newForcedInput, setNewForcedInput] = useState('');


    // Hardcode admin role check for MVP purposes (In production this should be a role in Firestore/Custom Claims)
    // Here we'll just check if the user is an admin by an arbitrary flag we can set in db.
    const isAdmin = profile?.role === 'admin';

    useEffect(() => {
        if (authLoading) return;

        if (!isAdmin) {
            navigate('/dashboard');
            return;
        }

        if (isDemoMode) {
            setClaims([{ id: 'demo-claim', type: 'medical', amount: 5000, description: 'Medical Emergency', status: 'pending_review', guardian_id: 'demo-123', createdAt: { toDate: () => new Date() } }]);
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(query(collection(db, 'claims'), orderBy('createdAt', 'desc')), (snapshot) => {
            setClaims(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
            setLoading(false);
        });

        const usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const transUnsubscribe = onSnapshot(query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(50)), (snapshot) => {
            setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const statsUnsubscribe = onSnapshot(doc(db, 'totals', 'liquidity'), (docSnap) => {
            if (docSnap.exists()) {
                setGlobalStats(docSnap.data());
            }
        });

        const kbUnsubscribe = onSnapshot(collection(db, 'sifuna_kb'), (snapshot) => {
            setKbItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const tiersUnsubscribe = onSnapshot(doc(db, 'config', 'tiers'), (docSnap) => {
            if (docSnap.exists()) {
                setTiers(docSnap.data());
            } else {
                // Seed default tiers if they don't exist
                const defaultTiers = {
                    bronze: { cost: 50, limit: 100000, name: 'Bronze Shield', maturation: 180 },
                    silver: { cost: 147, limit: 250000, name: 'Silver Shield', maturation: 180 },
                    gold: { cost: 229, limit: 500000, name: 'Gold Shield', maturation: 180 }
                };
                setDoc(doc(db, 'config', 'tiers'), defaultTiers);
                setTiers(defaultTiers);
            }
        });

        // Recruitment Listeners
        const agentsUnsubscribe = onSnapshot(collection(db, 'agents'), (snapshot) => {
            setAgents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const masterAgentsUnsubscribe = onSnapshot(collection(db, 'master_agents'), (snapshot) => {
            setMasterAgents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const startOfToday = new Date().setHours(0, 0, 0, 0);
        const logsUnsubscribe = onSnapshot(
            query(collection(db, 'recruitment_logs'), orderBy('timestamp', 'desc'), limit(100)),
            (snapshot) => {
                const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setRecruitmentLogs(logs);

                const todayLogs = logs.filter(l => {
                    if (!l.timestamp) return false;
                    const logDate = getSafeDate(l.timestamp);
                    return logDate.getTime() >= startOfToday;
                });
                setRecruitmentStats({
                    today: todayLogs.length,
                    total_payouts: logs.length * 15
                });
            }
        );

        const configUnsubscribe = onSnapshot(doc(db, 'config', 'recruitment'), (docSnap) => {
            if (docSnap.exists()) {
                setRecruitmentConfig(docSnap.data());
            }
        });

        const securityUnsubscribe = onSnapshot(doc(db, 'config', 'security'), (snap) => {
            if (snap.exists()) setForcedTotpList(snap.data().forced_totp_list || []);
        });

        return () => {
            unsubscribe(); usersUnsubscribe(); transUnsubscribe();
            statsUnsubscribe(); kbUnsubscribe(); tiersUnsubscribe();
            agentsUnsubscribe(); masterAgentsUnsubscribe(); logsUnsubscribe();
            configUnsubscribe(); securityUnsubscribe();
        };
    }, [isAdmin, authLoading, navigate, isDemoMode]);


    const handleAction = async (claimId, guardianId, claimAmount, newStatus) => {
        setActionLoading(claimId);
        try {
            if (newStatus === 'approved') {
                // Trigger M-Pesa B2C Disbursement
                try {
                    const response = await fetch('https://sasapayb2c-l5mloh4jka-uc.a.run.app', {


                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phoneNumber: profile.phoneNumber,
                            amount: claimAmount,
                            claimId: claimId,
                            userId: guardianId
                        })
                    });

                    if (response.ok) {
                        toast.success("SasaPay B2C disbursement initiated.");
                    } else {
                        toast.warning("Claim approved, but SasaPay disbursement failed to initiate.");
                    }

                } catch (b2cError) {
                    console.error("B2C Error:", b2cError);
                    toast.warning("M-Pesa B2C error. Please process manually.");
                }

                // Actually update the claim status
                await updateDoc(doc(db, 'claims', claimId), { status: 'approved' });

                await addDoc(collection(db, 'transactions'), {
                    userId: guardianId,
                    type: 'payout',
                    amount: claimAmount,
                    status: 'completed',
                    source: 'claim_approval',
                    claimId: claimId,
                    createdAt: serverTimestamp()
                });
                toast.success("Claim approved and payout recorded.");
            } else {
                await updateDoc(doc(db, 'claims', claimId), { status: 'rejected' });
                toast.success("Claim rejected.");
            }
        } catch (error) {
            console.error("Error updating claim status: ", error);
            toast.error("Action failed.");
        } finally {
            setActionLoading(null);
        }
    };

    const toggleAdmin = async (userId, currentRole) => {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, { role: currentRole === 'admin' ? 'guardian' : 'admin' });
        } catch (error) {
            console.error("Error toggling role:", error);
        }
    };

    const handleAddKb = async (e) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, 'sifuna_kb'), {
                ...newKb,
                createdAt: serverTimestamp()
            });
            setNewKb({ question: '', answer: '' });
            toast.success("Knowledge item added.");
        } catch (error) {
            toast.error("Failed to add training item.");
        }
    };

    const handleDeleteKb = async (id) => {
        try {
            await deleteDoc(doc(db, 'sifuna_kb', id));
            toast.success("Item removed.");
        } catch (error) {
            toast.error("Delete failed.");
        }
    };

    const handleAutoGenerateKb = async () => {
        setIsGenerating(true);
        toast.success('🤖 Sifuna is generating Q&A pairs...');
        try {
            const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const existingQs = kbItems.map(k => k.question).join('\n');
            const tierInfo = `Bronze: KSh ${tiers.bronze?.cost}/day, KSh ${tiers.bronze?.limit?.toLocaleString()} cover. Silver: KSh ${tiers.silver?.cost}/day, KSh ${tiers.silver?.limit?.toLocaleString()} cover. Gold: KSh ${tiers.gold?.cost}/day, KSh ${tiers.gold?.limit?.toLocaleString()} cover.`;

            const prompt = `You are an expert on Hazina Care Fund, a community mutual protection platform in Kenya.
Hazina members pay daily premiums and can file crisis claims for Medical Emergencies, Bereavement, and School Fees after a 180-day grace period.
Tier pricing: ${tierInfo}
Members top up via M-Pesa. Referral program rewards at 10 and 30 referrals. USSD: *384#.

ALREADY EXISTING QUESTIONS (do NOT repeat these):
${existingQs || 'None yet'}

Generate exactly 12 NEW unique Q&A pairs that real Kenyan users would ask about Hazina. Cover: membership, tiers, claims, top-up, dependents, referrals, grace period, cancellation, USSD, maturation, M-Pesa issues, and daily burn.
Mix English and Kiswahili questions roughly 50/50.

Return ONLY a valid JSON array, no markdown, no explanation:
[
  { "question": "...", "answer": "..." },
  ...
]`;

            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();

            // Strip markdown code fences if present
            const jsonStr = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
            const pairs = JSON.parse(jsonStr);

            let added = 0;
            for (const pair of pairs) {
                if (pair.question && pair.answer) {
                    await addDoc(collection(db, 'sifuna_kb'), {
                        question: pair.question.trim(),
                        answer: pair.answer.trim(),
                        source: 'ai_generated',
                        createdAt: serverTimestamp()
                    });
                    added++;
                }
            }
            toast.success(`✅ Sifuna generated ${added} new Q&A pairs!`);
        } catch (err) {
            console.error('Auto-generate error:', err);
            toast.error('Generation failed. Check the console.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUpdateTiers = async (tierKey, field, value) => {
        try {
            const updatedTiers = { ...tiers };
            updatedTiers[tierKey][field] = Number(value);
            await setDoc(doc(db, 'config', 'tiers'), updatedTiers);
            toast.success(`${tierKey} pricing updated.`);
        } catch (error) {
            toast.error("Failed to update pricing.");
        }
    };

    const handleSetupTotp = async () => {
        setIsTotpLoading(true);
        try {
            const generateSecret = httpsCallable(functions, 'generateTotpSecret');
            const result = await generateSecret();
            setTotpSetup(result.data);
            setTotpStep('generated');
            toast.success("Authenticator secret generated.");
        } catch (error) {
            console.error("TOTP Setup Error:", error);
            toast.error(error.message || "Failed to initiate TOTP setup.");
        } finally {
            setIsTotpLoading(false);
        }
    };

    const handleVerifyTotp = async () => {
        if (!totpCode || totpCode.length !== 6) {
            toast.error("Enter a valid 6-digit code.");
            return;
        }

        setIsTotpLoading(true);
        try {
            const verifyAndEnable = httpsCallable(functions, 'verifyAndEnableTotp');
            await verifyAndEnable({
                token: totpCode,
                secret: totpSetup.secret,
                isInitialSetup: true
            });
            toast.success("Authenticator enabled successfully! 🛡️");
            setTotpStep('idle');
            setTotpSetup(null);
            setTotpCode('');
        } catch (error) {
            console.error("TOTP Verification Error:", error);
            toast.error(error.message || "Verification failed. Check the code.");
        } finally {
            setIsTotpLoading(false);
        }
    };

    const handleDisableTotp = async () => {
        if (!window.confirm("Are you sure you want to disable the Authenticator App? Your account will be less secure.")) return;

        try {
            const userRef = doc(db, 'users', profile.id);
            await updateDoc(userRef, {
                totpEnabled: false,
                totpSecret: null
            });
            toast.success("Authenticator app disabled.");
        } catch (error) {
            toast.error("Failed to disable TOTP.");
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/admin/login');
    };


    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    const filteredClaims = claims.filter(c => filter === 'all' || c.status === filter);

    // Calculate last 7 days of growth from transactions
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = subDays(new Date(), 6 - i);
        return { date: d, label: format(d, 'EEE'), volume: 0 };
    });

    transactions.forEach(t => {
        if (!t.createdAt) return;
        const tDate = getSafeDate(t.createdAt);
        const tStart = startOfDay(tDate).getTime();

        const dayMatch = last7Days.find(d => startOfDay(d.date).getTime() === tStart);
        if (dayMatch && t.type === 'top-up') {
            dayMatch.volume += (Number(t.amount) || 0);
        }
    });

    const maxVolume = Math.max(...last7Days.map(d => d.volume), 1); // avoid div by 0


    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Professional Management Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                            <ShieldCheck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Hazina Control</h1>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Management Portal</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 py-8 pb-32">
                {/* Tab Navigation */}
                <div className="flex gap-2 mb-8 bg-slate-200/50 p-1.5 rounded-2xl w-full overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 min-w-max">
                    {[
                        { id: 'claims', label: 'Claims' },
                        { id: 'users', label: 'Users' },
                        { id: 'system', label: 'Security & System' },
                        { id: 'sifuna', label: 'Sifuna Training' },
                        { id: 'pricing', label: 'Pricing' },
                        { id: 'recruitment', label: 'Recruitment' },
                        { id: 'transactions', label: 'Billing' },
                        { id: 'analytics', label: 'Stats' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'claims' && (
                    <>
                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center cursor-pointer hover:border-brand-primary transition-all" onClick={() => setFilter('pending_review')}>
                                <Clock className={`w-8 h-8 mx-auto mb-3 ${filter === 'pending_review' ? 'text-amber-500' : 'text-slate-300'}`} />
                                <p className="text-3xl font-black text-slate-900">{claims.filter(c => c.status === 'pending_review').length}</p>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Pending Review</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center cursor-pointer hover:border-brand-primary transition-all" onClick={() => setFilter('approved')}>
                                <ShieldCheck className={`w-8 h-8 mx-auto mb-3 ${filter === 'approved' ? 'text-emerald-500' : 'text-slate-300'}`} />
                                <p className="text-3xl font-black text-slate-900">{claims.filter(c => c.status === 'approved').length}</p>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Approved</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center cursor-pointer hover:border-brand-primary transition-all" onClick={() => setFilter('all')}>
                                <Filter className={`w-8 h-8 mx-auto mb-3 ${filter === 'all' ? 'text-brand-primary' : 'text-slate-300'}`} />
                                <p className="text-3xl font-black text-slate-900">{claims.length}</p>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Total Claims</p>
                            </div>
                        </div>

                        {/* Claims List */}
                        <div className="space-y-4">
                            {filteredClaims.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
                                    <ShieldCheck className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                                    <p className="text-slate-500 font-bold text-lg">No claims found in this category.</p>
                                    <p className="text-slate-400 text-sm mt-1">Everything is up to date.</p>
                                </div>
                            ) : (
                                filteredClaims.map((claim) => (
                                    <div key={claim.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex gap-4">
                                                <div className={`p-4 rounded-2xl ${claim.type === 'medical' ? 'bg-red-50 text-red-600' :
                                                    claim.type === 'bereavement' ? 'bg-slate-100 text-slate-800' :
                                                        'bg-blue-50 text-blue-600'
                                                    }`}>
                                                    <FileText className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                                                            {claim.type.replace('_', ' ')}
                                                        </span>
                                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            {format(getSafeDate(claim.createdAt), 'PP')}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">KSh {claim.amount.toLocaleString()}</h3>
                                                    <p className="text-xs text-slate-500 font-mono mt-1 opacity-70">Case ID: {claim.id}</p>
                                                </div>
                                            </div>
                                            <div className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${claim.status === 'pending_review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                claim.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                {claim.status === 'pending_review' ? <Clock className="w-3.5 h-3.5" /> :
                                                    claim.status === 'approved' ? <ShieldCheck className="w-3.5 h-3.5" /> :
                                                        <XCircle className="w-3.5 h-3.5" />}
                                                {claim.status.replace('_', ' ')}
                                            </div>
                                        </div>

                                        <div className="bg-slate-50/50 p-4 rounded-2xl mb-6 text-sm text-slate-700 border border-slate-100/50">
                                            <p className="font-bold text-[10px] uppercase text-slate-400 mb-2 tracking-widest">Description</p>
                                            "{claim.description}"
                                        </div>

                                        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
                                                    {claim.guardian_id?.substring(0, 2).toUpperCase() || '??'}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900">Guardian ID</p>
                                                    <p className="text-[10px] text-slate-500 font-mono italic">{claim.guardian_id}</p>
                                                </div>
                                            </div>

                                            <div className="flex gap-3">
                                                {claim.proof_url && (
                                                    <a
                                                        href={claim.proof_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                                    >
                                                        Review Proof
                                                    </a>
                                                )}
                                                {claim.status === 'pending_review' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleAction(claim.id, claim.guardian_id, claim.amount, 'rejected')}
                                                            disabled={actionLoading === claim.id}
                                                            className="px-6 py-2.5 rounded-xl border border-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95"
                                                        >
                                                            Reject
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction(claim.id, claim.guardian_id, claim.amount, 'approved')}
                                                            disabled={actionLoading === claim.id}
                                                            className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all flex items-center gap-2 active:scale-95"
                                                        >
                                                            {actionLoading === claim.id ? 'Processing...' : (
                                                                <>Approve & Pay <DollarSign className="w-3.5 h-3.5" /></>
                                                            )}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'users' && (
                    <div className="space-y-4">
                        {users.map(u => (
                            <div key={u.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-slate-900">{u.phoneNumber || u.email}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {u.role || 'guardian'}
                                        </span>
                                        {u.totpEnabled ? (
                                            <span className="flex items-center gap-1 text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase">
                                                <ShieldCheck className="w-2.5 h-2.5" /> 2FA Active
                                            </span>
                                        ) : forcedTotpList.includes(u.phoneNumber || u.email) && (
                                            <span className="flex items-center gap-1 text-[8px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded uppercase animate-pulse">
                                                <ShieldAlert className="w-2.5 h-2.5" /> 2FA Mandatory
                                            </span>
                                        )}
                                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter italic">ID: {u.id}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {u.totpEnabled && (
                                        <button
                                            onClick={async () => {
                                                if (window.confirm(`Are you sure you want to disable 2FA for ${u.phoneNumber || u.email}?`)) {
                                                    await setDoc(doc(db, 'users', u.id), { totpEnabled: false, totpSecret: null }, { merge: true });
                                                    toast.success("Security reset successful.");
                                                }
                                            }}
                                            className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-100 text-red-600 hover:bg-red-50 transition-all active:scale-95"
                                        >
                                            Reset 2FA
                                        </button>
                                    )}
                                        <button
                                            onClick={async () => {
                                                const identifier = u.phoneNumber || u.email;
                                                const isEnforced = forcedTotpList.includes(identifier);
                                                let updated;
                                                if (isEnforced) {
                                                    updated = forcedTotpList.filter(e => e !== identifier);
                                                    toast.success("Enforcement removed.");
                                                } else {
                                                    updated = [...forcedTotpList, identifier];
                                                    toast.success("Enforcement active.");
                                                }
                                                await setDoc(doc(db, 'config', 'security'), { forced_totp_list: updated }, { merge: true });
                                            }}
                                            className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all active:scale-95 ${forcedTotpList.includes(u.phoneNumber || u.email) ? 'bg-red-50 border-red-200 text-red-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            {forcedTotpList.includes(u.phoneNumber || u.email) ? 'Disable Forced 2FA' : 'Enforce 2FA'}
                                        </button>
                                        <button
                                            onClick={() => toggleAdmin(u.id, u.role)}
                                            className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
                                        >
                                            {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                                        </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'sifuna' && (
                    <div className="space-y-6">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black flex items-center gap-2 mb-1">
                                    <Bot className="w-5 h-5 text-orange-500" />
                                    Global Chatbot Status
                                </h3>
                                <p className="text-xs text-slate-500">Enable or disable Sifuna across the entire platform.</p>
                            </div>
                            <button
                                onClick={async () => {
                                    try {
                                        const docRef = doc(db, 'config', 'sifuna');
                                        const docSnap = await getDoc(docRef);
                                        const currentStatus = docSnap.exists() ? docSnap.data().isActive : true; // default true
                                        await setDoc(docRef, { isActive: !currentStatus }, { merge: true });
                                        toast.success(!currentStatus ? "Sifuna Activated!" : "Sifuna Deactivated!");
                                    } catch (e) {
                                        toast.error("Failed to update status");
                                    }
                                }}
                                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
                            >
                                Toggle Status
                            </button>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black flex items-center gap-2">
                                    <Bot className="w-6 h-6 text-orange-500" />
                                    Teach Sifuna
                                </h3>
                                <button
                                    onClick={handleAutoGenerateKb}
                                    disabled={isGenerating}
                                    className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-orange-200 hover:shadow-orange-300 transition-all active:scale-95 disabled:opacity-60"
                                >
                                    <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                                    {isGenerating ? 'Generating...' : 'AI Auto-Generate'}
                                </button>
                            </div>
                            <form onSubmit={handleAddKb} className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Example Question (English)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 p-4 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 font-bold"
                                        placeholder="How do I withdraw?"
                                        value={newKb.question}
                                        onChange={e => setNewKb({ ...newKb, question: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Auto-Response (English)</label>
                                    <textarea
                                        className="w-full bg-slate-50 p-4 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 h-32 font-medium"
                                        placeholder="Hazina is a social shield, not a bank. Funds are strictly for crisis coverage..."
                                        value={newKb.answer}
                                        onChange={e => setNewKb({ ...newKb, answer: e.target.value })}
                                        required
                                    />
                                </div>
                                <button type="submit" className="w-full py-4 bg-orange-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-200 transition-all active:scale-[0.98]">
                                    Add Training Item
                                </button>
                            </form>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Knowledge Base ({kbItems.length})</h4>
                            {kbItems.map(item => (
                                <div key={item.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 pr-4">
                                            <p className="font-bold text-slate-900 mb-1 leading-tight">Q: {item.question}</p>
                                            <p className="text-sm text-slate-600 line-clamp-2 italic">A: {item.answer}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteKb(item.id)}
                                            className="p-2 text-slate-200 hover:text-red-500 transition-colors"
                                        >
                                            <XCircle className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'pricing' && (
                    <div className="space-y-6">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                            <h3 className="text-xl font-black mb-8 flex items-center gap-2">
                                <TrendingUp className="w-6 h-6 text-brand-primary" />
                                Tier Configuration
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {Object.keys(tiers).length === 0 ? (
                                    <div className="col-span-3 py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                        <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500 font-bold">No tier configuration found.</p>
                                        <button
                                            onClick={() => {
                                                const defaultTiers = {
                                                    bronze: { cost: 50, limit: 100000, name: 'Bronze Shield', maturation: 180 },
                                                    silver: { cost: 147, limit: 250000, name: 'Silver Shield', maturation: 180 },
                                                    gold: { cost: 229, limit: 500000, name: 'Gold Shield', maturation: 180 }
                                                };
                                                setDoc(doc(db, 'config', 'tiers'), defaultTiers);
                                                setTiers(defaultTiers);
                                            }}
                                            className="mt-4 px-6 py-2 bg-brand-primary text-white rounded-xl text-xs font-black uppercase tracking-widest"
                                        >
                                            Reset Defaults
                                        </button>
                                    </div>
                                ) : (
                                    Object.entries(tiers).map(([key, data]) => (
                                        <div key={key} className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
                                            <div className="flex items-center gap-4 mb-8">
                                                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-slate-100">
                                                    <Zap className={`w-7 h-7 ${key === 'gold' ? 'text-amber-500' : key === 'silver' ? 'text-slate-400' : 'text-orange-700'}`} />
                                                </div>
                                                <h4 className="font-black text-slate-900 uppercase tracking-widest italic">{key} Tier</h4>
                                            </div>
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Daily Cost (KSh)</label>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">KSh</span>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-white p-4 pl-14 rounded-2xl border border-slate-200 font-black text-slate-900 focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                                            defaultValue={data.cost}
                                                            onBlur={e => handleUpdateTiers(key, 'cost', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Cover Limit (KSh)</label>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">KSh</span>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-white p-4 pl-14 rounded-2xl border border-slate-200 font-black text-slate-900 focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                                            defaultValue={data.limit}
                                                            onBlur={e => handleUpdateTiers(key, 'limit', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Maturation (Days)</label>
                                                    <div className="relative">
                                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                                        <input
                                                            type="number"
                                                            className="w-full bg-white p-4 pl-12 rounded-2xl border border-slate-200 font-black text-slate-900 focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                                            defaultValue={data.maturation || 180}
                                                            onBlur={e => handleUpdateTiers(key, 'maturation', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'transactions' && (
                    <div className="space-y-4">
                        {transactions.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
                                <DollarSign className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-500 font-bold text-lg">No transactions recorded yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {transactions.map(t => (
                                    <div key={t.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-6">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${t.type === 'payout' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {t.type === 'payout' ? <ArrowLeft className="w-6 h-6 rotate-45" /> : <DollarSign className="w-6 h-6" />}
                                            </div>
                                            <div>
                                                <p className="text-xl font-black text-slate-900 tracking-tight">KSh {t.amount.toLocaleString()}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">{t.userId} • {t.type}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">{format(getSafeDate(t.createdAt), 'PP')}</p>
                                            <span className={`text-[10px] px-3 py-1 rounded-lg font-black uppercase tracking-widest ${t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{t.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
                                <div className="relative z-10">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Membership</h4>
                                    <p className="text-5xl font-black text-slate-900 tracking-tighter">{users.length}</p>
                                    <div className="flex items-center gap-2 mt-4">
                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg">+12%</span>
                                        <span className="text-[10px] text-slate-400 font-bold">Growth this cycle</span>
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            </div>
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
                                <div className="relative z-10">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Active Shields</h4>
                                    <p className="text-5xl font-black text-slate-900 tracking-tighter">{users.filter(u => u.status === 'fully-active').length}</p>
                                    <div className="flex items-center gap-2 mt-4 text-[10px]">
                                        <span className="text-slate-400 font-bold uppercase tracking-widest">Pending Activation:</span>
                                        <span className="text-amber-600 font-black">{users.filter(u => u.status === 'in-waiting').length}</span>
                                    </div>
                                </div>
                                <div className="absolute bottom-0 right-0 w-32 h-32 bg-brand-secondary/5 rounded-full blur-3xl -mr-16 -mb-16"></div>
                            </div>
                        </div>

                        <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
                            <h4 className="text-lg font-black text-slate-900 mb-10 flex items-center gap-3">
                                <TrendingUp className="w-6 h-6 text-brand-primary" />
                                Fund Liquidity Growth (7D)
                            </h4>
                            <div className="h-64 flex items-end gap-4 px-4 overflow-hidden">
                                {last7Days.map((day, i) => {
                                    const heightPercent = Math.max((day.volume / maxVolume) * 100, 5);
                                    return (
                                        <div key={i} className="flex-1 group relative">
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                KSh {day.volume.toLocaleString()}
                                            </div>
                                            <div
                                                className="w-full bg-brand-primary/10 rounded-2xl group-hover:bg-brand-primary/20 transition-all cursor-crosshair pb-1"
                                                style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}
                                            >
                                                <div
                                                    className="w-full bg-brand-primary rounded-2xl transition-all shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                                                    style={{ height: `${heightPercent}%` }}
                                                ></div>
                                            </div>
                                            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{day.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 overflow-hidden relative shadow-2xl shadow-slate-200/50">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-[120px] -mr-48 -mt-48"></div>
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] -ml-32 -mb-32"></div>
                            <div className="relative z-10">
                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Total System Portfolio</h4>
                                <p className="text-6xl font-black tracking-tight italic text-slate-900">KSh {(globalStats.total_fund || 0).toLocaleString()}</p>
                                <div className="mt-8 flex items-center gap-4">
                                    <div className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 flex items-center gap-2 text-slate-600">
                                        <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse"></div>
                                        Live Liquidity
                                    </div>
                                    <div className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 text-slate-500">Community Trust: 98%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'system' && (
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
                                    <Zap className="w-6 h-6 text-amber-500" />
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

                        {/* Force 2FA Enforcement List */}
                        <div className="bg-slate-900 p-10 rounded-[3rem] shadow-xl text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                            <div className="relative z-10">
                                <h3 className="text-xl font-black mb-2 flex items-center gap-2">
                                    <ShieldAlert className="w-6 h-6 text-red-500" />
                                    Mandatory 2FA Enforcement
                                </h3>
                                <p className="text-sm text-slate-400 mb-8 leading-relaxed">Numbers or Emails in this list will be <span className="text-white font-bold underline">completely blocked</span> from logging in via SMS. They MUST use an Authenticator App.</p>

                                <div className="space-y-6">
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            placeholder="Enter Phone (+254...) or Email"
                                            className="flex-1 bg-white/10 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-white/20 focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                            value={newForcedInput}
                                            onChange={(e) => setNewForcedInput(e.target.value)}
                                        />
                                        <button
                                            onClick={async () => {
                                                if (!newForcedInput) return;
                                                const identifier = newForcedInput.trim();
                                                const updated = Array.from(new Set([...forcedTotpList, identifier]));
                                                await setDoc(doc(db, 'config', 'security'), { forced_totp_list: updated }, { merge: true });
                                                setNewForcedInput('');
                                                toast.success("Enforcement policy updated.");
                                            }}
                                            className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                                        >
                                            Add to List
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {forcedTotpList.length === 0 ? (
                                            <p className="text-xs text-slate-500 italic py-4">No accounts currently on the mandatory list.</p>
                                        ) : (
                                            forcedTotpList.map((entry, idx) => (
                                                <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-xl flex justify-between items-center group">
                                                    <span className="text-xs font-mono font-bold text-slate-300">{entry}</span>
                                                    <button
                                                        onClick={async () => {
                                                            const updated = forcedTotpList.filter(e => e !== entry);
                                                            await setDoc(doc(db, 'config', 'security'), { forced_totp_list: updated }, { merge: true });
                                                            toast.success("Removed from enforcement list.");
                                                        }}
                                                        className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Database Health Check */}
                        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                            <h3 className="text-lg font-black mb-6">Database Environment</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Users Document</p>
                                    <p className="font-bold text-slate-900">{users.length} Records</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Active Claims</p>
                                    <p className="font-bold text-slate-900">{claims.length} Records</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Knowledge Hub</p>
                                    <p className="font-bold text-slate-900">{kbItems.length} Pairs</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total Fund</p>
                                    <p className="font-bold text-emerald-600">KSh {globalStats.total_fund?.toLocaleString() || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'recruitment' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* System Administration - Super Master Creation */}
                        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-slate-900/20">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
                            <div className="relative z-10">
                                <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                                    <ShieldCheck className="w-6 h-6 text-brand-primary" />
                                    System Administration
                                </h3>
                                <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Register New Super Master</p>
                                    <form
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            const name = e.target.fullName.value;
                                            const phone = formatKenyanPhone(e.target.phone.value);
                                            if (!name || !phone) return;

                                            try {
                                                await setDoc(doc(db, 'users', phone), {
                                                    fullName: name,
                                                    phoneNumber: phone,
                                                    role: 'super_master',
                                                    status: 'active',
                                                    registration_fee_paid: true,
                                                    profile_completed: true,
                                                    createdAt: serverTimestamp()
                                                }, { merge: true });
                                                toast.success("Super Master created successfully!");
                                                e.target.reset();
                                            } catch (err) {
                                                toast.error("Failed to create super master.");
                                            }
                                        }}
                                        className="grid grid-cols-1 md:grid-cols-3 gap-4"
                                    >
                                        <input
                                            name="fullName"
                                            required
                                            placeholder="Full Name"
                                            className="bg-white/10 border-none rounded-2xl px-5 py-3 text-sm font-bold placeholder:text-white/30 focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                        />
                                        <input
                                            name="phone"
                                            required
                                            placeholder="Phone Number (ID)"
                                            className="bg-white/10 border-none rounded-2xl px-5 py-3 text-sm font-bold placeholder:text-white/30 focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                        />
                                        <button
                                            type="submit"
                                            className="bg-brand-primary hover:bg-brand-primary/90 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-brand-primary/20"
                                        >
                                            Authorize Admin
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>

                        {/* Recruitment Settings */}
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                            <h3 className="text-xl font-black mb-6 flex items-center gap-2 text-slate-900">
                                <TrendingUp className="w-6 h-6 text-brand-primary" />
                                Onboarding & Commission Configuration
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Field Agent Commission (KSh per Signup)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">KSh</span>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-50 p-4 pl-14 rounded-2xl border border-slate-100 font-black text-slate-900 focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                            value={recruitmentConfig.agentCommission || 15}
                                            onChange={async (e) => {
                                                const val = Number(e.target.value);
                                                setRecruitmentConfig(prev => ({ ...prev, agentCommission: val }));
                                                await setDoc(doc(db, 'config', 'recruitment'), { agentCommission: val }, { merge: true });
                                            }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 italic mt-1">Direct payout to the agent for every successfully onboarded user.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Master Agent Override (KSh per Signup)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">KSh</span>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-50 p-4 pl-14 rounded-2xl border border-slate-100 font-black text-slate-900 focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                            value={recruitmentConfig.masterCommission || 5}
                                            onChange={async (e) => {
                                                const val = Number(e.target.value);
                                                setRecruitmentConfig(prev => ({ ...prev, masterCommission: val }));
                                                await setDoc(doc(db, 'config', 'recruitment'), { masterCommission: val }, { merge: true });
                                            }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 italic mt-1">Override commission paid to the Master Agent for every signup in their network.</p>
                                </div>
                            </div>
                        </div>

                        {/* Recruitment Global Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Signups</p>
                                <h3 className="text-2xl font-black text-slate-900">{recruitmentLogs.length}</h3>
                                <p className="text-[10px] text-emerald-500 font-bold mt-1">+{recruitmentStats.today} Today</p>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Masters</p>
                                <h3 className="text-2xl font-black text-slate-900">{masterAgents.length}</h3>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Field Agents</p>
                                <h3 className="text-2xl font-black text-slate-900">{agents.length}</h3>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Commissions</p>
                                <h3 className="text-2xl font-black text-brand-primary">KSh {recruitmentStats.total_payouts.toLocaleString()}</h3>
                            </div>
                        </div>

                        {/* Master Agents Overview */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-2">
                                <h3 className="text-xl font-black text-slate-900">Master Networks</h3>
                                <button
                                    onClick={() => navigate('/super')}
                                    className="text-xs font-black text-brand-primary uppercase tracking-widest flex items-center gap-1 hover:underline"
                                >
                                    Go to Super Portal <ArrowLeft className="w-3 h-3 rotate-180" />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {masterAgents.map(master => (
                                    <div key={master.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-slate-400 border border-slate-100">
                                                {master.fullName?.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900">{master.fullName}</h4>
                                                <p className="text-[10px] text-slate-400 font-medium">{master.phoneNumber}</p>
                                                <div className="flex gap-1 mt-1">
                                                    {master.regions?.slice(0, 2).map((r, i) => (
                                                        <span key={i} className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md uppercase">{r}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-slate-900">
                                                {agents.filter(a => a.masterAgentId === master.id).length}
                                            </p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">Agents</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Recruitment Activity */}
                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                                <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm italic">Global Recruitment Feed</h3>
                                <div className="flex gap-2">
                                    <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-tighter animate-pulse">Live</div>
                                </div>
                            </div>
                            <div className="divide-y divide-slate-50 h-[400px] overflow-y-auto">
                                {recruitmentLogs.length === 0 ? (
                                    <div className="p-20 text-center text-slate-400 italic">No recruitment data available yet.</div>
                                ) : recruitmentLogs.map(log => (
                                    <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-brand-50 text-brand-primary rounded-xl flex items-center justify-center">
                                                <UserPlus className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-900">
                                                    New User <span className="text-[10px] font-mono opacity-60">({log.userId?.substring(0, 6)})</span>
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    Recruited by <span className="text-brand-primary font-black">{log.agentId}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-slate-900">KSh {log.tariffApplied}</p>
                                            <p className="text-[9px] text-slate-400 italic">
                                                {log.timestamp ? format(getSafeDate(log.timestamp), 'HH:mm') : 'Recent'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;
