import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Users, TrendingUp, DollarSign, QrCode, Share2, Clipboard, ChevronRight, Award, Zap, Activity } from 'lucide-react';
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
        <div className="space-y-10 max-w-5xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Zap className="w-8 h-8 text-brand-primary" />
                        Agent Performance Console
                    </h1>
                    <p className="text-slate-500 font-medium">Welcome, {profile?.fullName}</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <span className="text-xs font-black uppercase text-slate-700">Verified Agent Account</span>
                </div>
            </header>

            {/* Performance Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-brand-primary/20 transition-all duration-700"></div>

                    <div className="relative z-10 flex flex-col h-full">
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-primary mb-4 italic">Earnings Statement</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold text-slate-500">KSh</span>
                            <h2 className="text-6xl font-black tracking-tight">{stats.earnings.toLocaleString()}</h2>
                        </div>

                        <div className="mt-auto pt-10 grid grid-cols-2 gap-8 border-t border-white/5">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Conversions</p>
                                <p className="text-3xl font-black">{stats.total}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Active Tariff</p>
                                <p className="text-2xl font-black text-brand-primary">15.00 <span className="text-xs font-bold text-slate-500">/user</span></p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Daily Status */}
                <div className="space-y-4">
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col justify-between h-1/2">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Activity</p>
                            <TrendingUp className="w-5 h-5 text-brand-primary" />
                        </div>
                        <h2 className="text-4xl font-black text-slate-900">{stats.today}</h2>
                    </div>
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col justify-between h-1/2">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yesterday</p>
                            <Activity className="w-5 h-5 text-slate-300" />
                        </div>
                        <h2 className="text-4xl font-black text-slate-700">{stats.yesterday}</h2>
                    </div>
                </div>
            </div>

            {/* Recruitment Tools */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                    <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                        <QrCode className="w-6 h-6 text-brand-primary" />
                        Recruitment Tools
                    </h3>

                    <div className="bg-slate-50 rounded-2xl p-6 mb-6 flex items-center justify-between group">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unique Agent Identity</p>
                            <p className="text-2xl font-black text-slate-900 tracking-tighter group-hover:text-brand-primary transition-colors">{agentCode}</p>
                        </div>
                        <button
                            onClick={copyLink}
                            className="p-4 bg-white text-slate-400 rounded-xl shadow-sm border border-slate-100 hover:text-brand-primary hover:border-brand-primary/20 transition-all active:scale-90"
                        >
                            <Clipboard className="w-6 h-6" />
                        </button>
                    </div>

                    <button
                        onClick={copyLink}
                        className="w-full bg-slate-900 text-white rounded-2xl py-5 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-900/10"
                    >
                        <Share2 className="w-5 h-5" />
                        Generate Link & Share
                    </button>
                </div>

                {/* Progress Log */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-slate-900">Recent Conversions</h3>
                        <ChevronRight className="w-6 h-6 text-slate-300" />
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100">
                        {loading ? (
                            <p className="text-slate-400 italic">Syncing activity log...</p>
                        ) : stats.total === 0 ? (
                            <>
                                <Users className="w-12 h-12 text-slate-100 mb-4" />
                                <p className="text-slate-400 font-bold">No signups recorded.</p>
                            </>
                        ) : (
                            <p className="text-slate-500 font-medium text-center">Historical data and details are summarized in the master portal.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentApp;
