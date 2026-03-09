import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Users, TrendingUp, DollarSign, QrCode, Share2, Clipboard, ChevronRight, Award } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { motion } from 'framer-motion';

const AgentApp = () => {
    const { profile } = useAuth();
    const toast = useToast();
    const [stats, setStats] = useState({
        today: 0,
        yesterday: 0,
        total: 0,
        earnings: 0
    });
    const [loading, setLoading] = useState(true);

    const agentCode = profile?.agent_code || profile?.id; // Fallback to profile ID if no specific agent_code
    const registrationLink = `https://hazina-care-fund.web.app/login?ref=${agentCode}`;

    useEffect(() => {
        const fetchStats = async () => {
            if (!agentCode) return;

            try {
                const now = new Date();
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const startOfYesterday = new Date(startOfToday);
                startOfYesterday.setDate(startOfYesterday.getDate() - 1);

                const logsRef = collection(db, 'recruitment_logs');

                // Today's Query
                const todayQuery = query(
                    logsRef,
                    where('agentId', '==', agentCode),
                    where('timestamp', '>=', Timestamp.fromDate(startOfToday))
                );
                const todaySnap = await getDocs(todayQuery);

                // Yesterday's Query
                const yesterdayQuery = query(
                    logsRef,
                    where('agentId', '==', agentCode),
                    where('timestamp', '>=', Timestamp.fromDate(startOfYesterday)),
                    where('timestamp', '<', Timestamp.fromDate(startOfToday))
                );
                const yesterdaySnap = await getDocs(yesterdayQuery);

                const totalSignups = profile?.totalSignups || 0;

                setStats({
                    today: todaySnap.size,
                    yesterday: yesterdaySnap.size,
                    total: totalSignups,
                    earnings: totalSignups * 15
                });
            } catch (error) {
                console.error("Error fetching agent stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [agentCode, profile?.totalSignups]);

    const copyLink = () => {
        navigator.clipboard.writeText(registrationLink);
        toast.success("Link copied to clipboard!");
    };

    return (
        <div className="min-h-screen bg-[#FDFCFE] pt-8 px-6 pb-24 font-sans relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-brand-primary/5 to-transparent pointer-events-none"></div>

            <header className="relative z-10 mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Agent Portal</h1>
                    <p className="text-sm font-medium text-slate-500">Welcome back, {profile?.fullName?.split(' ')[0]}</p>
                </div>
                <div className="bg-white/80 backdrop-blur-md p-3 rounded-2xl shadow-sm border border-slate-100">
                    <Award className="w-6 h-6 text-amber-500" />
                </div>
            </header>

            {/* Performance Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-primary rounded-[2.5rem] p-8 text-white shadow-2xl shadow-brand-primary/20 relative overflow-hidden mb-8"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="relative z-10">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-80 mb-2">Total Earnings</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold opacity-80">KSh</span>
                        <h2 className="text-4xl font-black">{stats.earnings.toLocaleString()}</h2>
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Total Signups</p>
                            <p className="text-2xl font-black">{stats.total}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Current Tariff</p>
                            <p className="text-2xl font-black">15<span className="text-xs font-bold">/user</span></p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Daily Stats Section */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center mb-3">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Today</p>
                    <p className="text-2xl font-black text-slate-900">{stats.today}</p>
                </div>
                <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
                    <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-3">
                        <Users className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Yesterday</p>
                    <p className="text-2xl font-black text-slate-900">{stats.yesterday}</p>
                </div>
            </div>

            {/* Recruitment Tools */}
            <div className="space-y-4 relative z-10">
                <h3 className="section-title text-slate-400 ml-2">Recruitment Tools</h3>

                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center border border-slate-100">
                            <QrCode className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-slate-900 leading-none mb-1">Your Unique Code</p>
                            <p className="text-xs text-brand-primary font-black uppercase tracking-widest">{agentCode}</p>
                        </div>
                        <button
                            onClick={copyLink}
                            className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-brand-primary/10 hover:text-brand-primary transition-all active:scale-95"
                        >
                            <Clipboard className="w-5 h-5" />
                        </button>
                    </div>

                    <button
                        onClick={copyLink}
                        className="w-full bg-slate-900 text-white rounded-2xl py-4 font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-900/10"
                    >
                        <Share2 className="w-5 h-5" />
                        Share Registration Link
                    </button>
                </div>
            </div>

            {/* Recent Progress */}
            <div className="mt-8 space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h3 className="section-title text-slate-900">Recent Signups</h3>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                </div>

                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-slate-400 italic text-sm">Loading activity...</div>
                    ) : (
                        <div className="p-8 text-center text-slate-400 italic text-sm">
                            {stats.total === 0 ? "No signups yet. Start sharing your link!" : "View full history in detail portal"}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AgentApp;
