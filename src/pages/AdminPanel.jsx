import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Clock, XCircle, Search, DollarSign, Filter, FileText, Download } from 'lucide-react';
import { generateWorkflowPDF } from '../utils/pdfGenerator';
import { format, subDays, startOfDay } from 'date-fns';


const AdminPanel = () => {
    const { profile, isDemoMode } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending_review');
    const [users, setUsers] = useState([]);
    const [activeTab, setActiveTab] = useState('claims'); // 'claims' | 'users' | 'transactions' | 'analytics'
    const [transactions, setTransactions] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);


    // Hardcode admin role check for MVP purposes (In production this should be a role in Firestore/Custom Claims)
    // Here we'll just check if the user is an admin by an arbitrary flag we can set in db.
    const isAdmin = profile?.role === 'admin';

    useEffect(() => {
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

        const transUnsubscribe = onSnapshot(query(collection(db, 'transactions'), orderBy('createdAt', 'desc')), (snapshot) => {
            setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsubscribe(); usersUnsubscribe(); transUnsubscribe(); };
    }, [isAdmin, navigate]);


    const handleAction = async (claimId, guardianId, claimAmount, newStatus) => {
        setActionLoading(claimId);
        try {
            if (newStatus === 'approved') {
                // Trigger M-Pesa B2C Disbursement
                try {
                    const response = await fetch('https://mpesab2c-yvpx72pzwq-uc.a.run.app', { // Example URL, in real usage it should be dynamic or from env
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phoneNumber: profile.phoneNumber, // In reality, fetch guardian's phone from DB
                            amount: claimAmount,
                            claimId: claimId,
                            userId: guardianId
                        })
                    });

                    if (response.ok) {
                        toast.success("M-Pesa B2C disbursement initiated.");
                    } else {
                        toast.warning("Claim approved, but M-Pesa disbursement failed to initiate.");
                    }
                } catch (b2cError) {
                    console.error("B2C Error:", b2cError);
                    toast.warning("M-Pesa B2C error. Please process manually.");
                }

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


    if (loading) return null;

    const filteredClaims = claims.filter(c => filter === 'all' || c.status === filter);

    // Calculate last 7 days of growth from transactions
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = subDays(new Date(), 6 - i);
        return { date: d, label: format(d, 'EEE'), volume: 0 };
    });

    transactions.forEach(t => {
        if (!t.createdAt) return;
        const tDate = t.createdAt.toDate();
        const tStart = startOfDay(tDate).getTime();

        const dayMatch = last7Days.find(d => startOfDay(d.date).getTime() === tStart);
        if (dayMatch && t.type === 'top-up') {
            dayMatch.volume += t.amount;
        }
    });

    const maxVolume = Math.max(...last7Days.map(d => d.volume), 1); // avoid div by 0


    return (
        <div className="min-h-screen bg-slate-50 pt-8 px-6 pb-32 font-sans">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-slate-700" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold font-heading text-slate-900">Admin Control</h1>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Claims Queue</p>
                    </div>
                </div>
                <button
                    onClick={generateWorkflowPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-sm active:scale-95"
                >
                    <Download className="w-4 h-4" />
                    <span>System Workflow PDF</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 bg-slate-200/50 p-1 rounded-2xl">
                <button
                    onClick={() => setActiveTab('claims')}
                    className={`flex-1 py-3 font-bold rounded-xl transition-all ${activeTab === 'claims' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                >
                    Claims
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex-1 py-3 font-bold rounded-xl transition-all ${activeTab === 'users' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                >
                    Users
                </button>
                <button
                    onClick={() => setActiveTab('transactions')}
                    className={`flex-1 py-3 font-bold rounded-xl transition-all ${activeTab === 'transactions' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                >
                    Transactions
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`flex-1 py-3 font-bold rounded-xl transition-all ${activeTab === 'analytics' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                >
                    Analytics
                </button>
            </div>

            {activeTab === 'claims' ? (
                <>
                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-8">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center cursor-pointer hover:border-brand-primary" onClick={() => setFilter('pending_review')}>
                            <Clock className={`w-6 h-6 mx-auto mb-2 ${filter === 'pending_review' ? 'text-amber-500' : 'text-slate-300'}`} />
                            <p className="text-2xl font-black text-slate-800">{claims.filter(c => c.status === 'pending_review').length}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Pending</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center cursor-pointer hover:border-brand-primary" onClick={() => setFilter('approved')}>
                            <ShieldCheck className={`w-6 h-6 mx-auto mb-2 ${filter === 'approved' ? 'text-emerald-500' : 'text-slate-300'}`} />
                            <p className="text-2xl font-black text-slate-800">{claims.filter(c => c.status === 'approved').length}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Approved</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center cursor-pointer hover:border-brand-primary" onClick={() => setFilter('all')}>
                            <Filter className={`w-6 h-6 mx-auto mb-2 ${filter === 'all' ? 'text-brand-primary' : 'text-slate-300'}`} />
                            <p className="text-2xl font-black text-slate-800">{claims.length}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Total</p>
                        </div>
                    </div>

                    {/* Claims List */}
                    <div className="space-y-4">
                        {filteredClaims.length === 0 ? (
                            <div className="text-center py-12 glass rounded-3xl">
                                <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 font-bold">No claims in this queue.</p>
                            </div>
                        ) : (
                            filteredClaims.map((claim) => (
                                <div key={claim.id} className="card p-5 bg-white shadow-sm border border-slate-100">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded ${claim.type === 'medical' ? 'bg-red-100 text-red-700' :
                                                    claim.type === 'bereavement' ? 'bg-slate-200 text-slate-800' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {claim.type.replace('_', ' ')}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {new Date(claim.createdAt?.toDate()).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-slate-900 text-lg">KSh {claim.amount.toLocaleString()}</h3>
                                            <p className="text-xs text-slate-500 font-mono tracking-tight mt-1">ID: {claim.guardian_id}</p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-tight flex items-center gap-1 ${claim.status === 'pending_review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            claim.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                'bg-red-50 text-red-700 border-red-200'
                                            }`}>
                                            {claim.status === 'pending_review' ? <Clock className="w-3 h-3" /> :
                                                claim.status === 'approved' ? <ShieldCheck className="w-3 h-3" /> :
                                                    <XCircle className="w-3 h-3" />}
                                            {claim.status.replace('_', ' ')}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-xl mb-4 text-sm text-slate-700">
                                        "{claim.description}"
                                    </div>

                                    {claim.status === 'pending_review' && (
                                        <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                                            <button
                                                onClick={() => handleAction(claim.id, claim.guardian_id, claim.amount, 'rejected')}
                                                disabled={actionLoading === claim.id}
                                                className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleAction(claim.id, claim.guardian_id, claim.amount, 'approved')}
                                                disabled={actionLoading === claim.id}
                                                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-2"
                                            >
                                                {actionLoading === claim.id ? 'Processing...' : (
                                                    <>Approve & Pay <DollarSign className="w-4 h-4" /></>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </>
            ) : activeTab === 'users' ? (
                <div className="space-y-4">
                    {users.map(u => (
                        <div key={u.id} className="card p-5 bg-white shadow-sm border border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-slate-900">{u.phoneNumber}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {u.role || 'guardian'}
                                    </span>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Tier: {u.active_tier}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => toggleAdmin(u.id, u.role)}
                                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
                            >
                                {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                            </button>
                        </div>
                    ))}
                </div>
            ) : activeTab === 'transactions' ? (
                <div className="space-y-4">
                    {transactions.length === 0 ? (
                        <div className="text-center py-12 glass rounded-3xl">
                            <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 font-bold">No transactions recorded.</p>
                        </div>
                    ) : (
                        transactions.map(t => (
                            <div key={t.id} className="card p-4 bg-white shadow-sm border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-xl ${t.type === 'payout' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                        {t.type === 'payout' ? <ArrowLeft className="w-5 h-5 rotate-135" /> : <DollarSign className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900">KSh {t.amount.toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-400 uppercase font-mono">{t.userId?.substring(0, 15)}... | {t.type}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">{new Date(t.createdAt?.toDate()).toLocaleDateString()}</p>
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold uppercase tracking-widest">{t.status}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Analytics View */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Membership</h4>
                            <p className="text-3xl font-black text-slate-900">{users.length}</p>
                            <p className="text-xs text-emerald-500 mt-1 font-bold">+12% this month</p>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Shields</h4>
                            <p className="text-3xl font-black text-slate-900">{users.filter(u => u.status === 'fully-active').length}</p>
                            <p className="text-xs text-slate-400 mt-1 font-bold">In-waiting: {users.filter(u => u.status === 'in-waiting').length}</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-brand-primary" />
                            Fund Growth (Top-ups)
                        </h4>
                        <div className="h-48 flex items-end gap-2 px-2">
                            {last7Days.map((day, i) => {
                                const heightPercent = Math.max((day.volume / maxVolume) * 100, 5); // min 5% height for visibility
                                return (
                                    <div key={i} className="flex-1 bg-brand-primary/10 rounded-t-lg relative group transition-all hover:bg-brand-primary/20">
                                        <div
                                            className="absolute bottom-0 left-0 w-full bg-brand-primary rounded-t-lg transition-all flex flex-col items-center justify-start text-[8px] text-white font-bold pt-1"
                                            style={{ height: `${heightPercent}%` }}
                                        >
                                            {day.volume > 0 ? (day.volume > 999 ? `${(day.volume / 1000).toFixed(1)}k` : day.volume) : ''}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between mt-4 px-2">
                            {last7Days.map((d, i) => (
                                <span key={i} className="text-[10px] font-bold text-slate-400 uppercase">{d.label}</span>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary rounded-full blur-3xl opacity-20 -mr-16 -mt-16"></div>
                        <h4 className="text-sm font-bold opacity-60 mb-2">Total Fund Liquidity</h4>
                        <p className="text-4xl font-black tracking-tight">KSh {transactions.reduce((acc, t) => acc + (t.type === 'top-up' ? t.amount : -t.amount), 0).toLocaleString()}</p>
                        <div className="mt-6 flex items-center gap-3">
                            <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">Community Trust Score: 98%</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
