import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, setDoc, orderBy, Timestamp, limit, serverTimestamp } from 'firebase/firestore';
import { Users, UserPlus, MapPin, Search, Filter, TrendingUp, DollarSign, ChevronRight, MoreVertical } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

const MasterDashboard = () => {
    const { profile } = useAuth();
    const toast = useToast();
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newAgent, setNewAgent] = useState({
        fullName: '',
        phoneNumber: '',
        nationalId: '',
        region: '',
        agentCode: ''
    });
    const [stats, setStats] = useState({
        totalAgents: 0,
        signupsToday: 0,
        signupsYesterday: 0
    });

    const masterId = profile?.id;

    useEffect(() => {
        const fetchData = async () => {
            if (!masterId) return;
            setLoading(true);
            try {
                // Fetch Agents
                const agentsRef = collection(db, 'agents');
                const q = query(agentsRef, where('masterAgentId', '==', masterId));
                const snap = await getDocs(q);
                const agentsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAgents(agentsList);

                // Fetch Aggregated Signups
                const now = new Date();
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const startOfYesterday = new Date(startOfToday);
                startOfYesterday.setDate(startOfYesterday.getDate() - 1);

                const logsRef = collection(db, 'recruitment_logs');
                const todayQuery = query(
                    logsRef,
                    where('masterAgentId', '==', masterId),
                    where('timestamp', '>=', Timestamp.fromDate(startOfToday))
                );
                const yesterdayQuery = query(
                    logsRef,
                    where('masterAgentId', '==', masterId),
                    where('timestamp', '>=', Timestamp.fromDate(startOfYesterday)),
                    where('timestamp', '<', Timestamp.fromDate(startOfToday))
                );

                const [todaySnap, yesterdaySnap] = await Promise.all([
                    getDocs(todayQuery),
                    getDocs(yesterdayQuery)
                ]);

                setStats({
                    totalAgents: snap.size,
                    signupsToday: todaySnap.size,
                    signupsYesterday: yesterdaySnap.size
                });

            } catch (error) {
                console.error("Error fetching master data:", error);
                toast.error("Failed to load dashboard data.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [masterId]);

    const handleAddAgent = async (e) => {
        e.preventDefault();
        if (!newAgent.agentCode) return;

        try {
            const agentRef = doc(db, 'agents', newAgent.agentCode.toUpperCase());
            await setDoc(agentRef, {
                ...newAgent,
                agentCode: newAgent.agentCode.toUpperCase(),
                masterAgentId: masterId,
                tariffRate: 15,
                totalSignups: 0,
                status: 'active',
                createdAt: serverTimestamp()
            });

            // Also create/update user document for the agent if they exist or just flag them
            const userRef = doc(db, 'users', newAgent.phoneNumber);
            await setDoc(userRef, {
                fullName: newAgent.fullName,
                phoneNumber: newAgent.phoneNumber,
                role: 'agent',
                agent_code: newAgent.agentCode.toUpperCase(),
                status: 'active'
            }, { merge: true });

            toast.success("Agent registered successfully!");
            setShowAddModal(false);
            setNewAgent({ fullName: '', phoneNumber: '', nationalId: '', region: '', agentCode: '' });

            // Refresh list
            setAgents([{ id: newAgent.agentCode.toUpperCase(), ...newAgent, totalSignups: 0, status: 'active' }, ...agents]);
        } catch (error) {
            console.error("Error adding agent:", error);
            toast.error("Failed to register agent.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pt-8 px-6 pb-24 font-sans relative">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Master Console</h1>
                    <p className="text-sm font-medium text-slate-500">Recruitment management for {profile?.fullName}</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="p-3 bg-brand-primary text-white rounded-2xl shadow-lg shadow-brand-primary/20 hover:scale-105 transition-all active:scale-95"
                >
                    <UserPlus className="w-6 h-6" />
                </button>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 col-span-2">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Recruitment</p>
                        <TrendingUp className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div className="flex items-end gap-4">
                        <h2 className="text-4xl font-black text-slate-900">{stats.signupsToday}</h2>
                        <div className="mb-1 text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Today
                        </div>
                        <div className="flex-1 text-right">
                            <p className="text-xs font-bold text-slate-400">Yesterday: <span className="text-slate-900">{stats.signupsYesterday}</span></p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Agents</p>
                    <p className="text-2xl font-black text-slate-900">{stats.totalAgents}</p>
                </div>
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Earnings</p>
                    <p className="text-2xl font-black text-brand-primary">KES {(stats.signupsToday * 15).toLocaleString()}</p>
                </div>
            </div>

            {/* Agents List */}
            <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                    <h3 className="section-title text-slate-900">Your Agents</h3>
                    <div className="flex gap-2">
                        <Search className="w-5 h-5 text-slate-300" />
                        <Filter className="w-5 h-5 text-slate-300" />
                    </div>
                </div>

                <div className="space-y-3">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400 italic">Loading your team...</div>
                    ) : agents.length === 0 ? (
                        <div className="bg-white rounded-[2rem] p-12 text-center border-2 border-dashed border-slate-200">
                            <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold">No agents registered yet.</p>
                            <button onClick={() => setShowAddModal(true)} className="mt-4 text-brand-primary font-black text-sm uppercase">Add your first agent</button>
                        </div>
                    ) : agents.map(agent => (
                        <div key={agent.id} className="bg-white rounded-[1.5rem] p-4 flex items-center gap-4 shadow-sm border border-slate-100 hover:border-brand-primary/30 transition-all cursor-pointer">
                            <div className="w-12 h-12 bg-slate-50 text-brand-primary rounded-xl flex items-center justify-center font-black text-lg border border-slate-100">
                                {agent.fullName.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-900 leading-tight">{agent.fullName}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-black text-brand-primary uppercase tracking-tighter bg-brand-50 px-1.5 py-0.5 rounded-md">{agent.agentCode}</span>
                                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {agent.region}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-black text-slate-900">{agent.totalSignups || 0}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signups</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Agent Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 backdrop-blur-sm bg-slate-900/40">
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl relative"
                        >
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8 sm:hidden"></div>
                            <h2 className="text-2xl font-black text-slate-900 mb-6">Register Agent</h2>

                            <form onSubmit={handleAddAgent} className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-50 rounded-2xl px-5 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold"
                                        placeholder="David Kamau"
                                        value={newAgent.fullName}
                                        onChange={e => setNewAgent({ ...newAgent, fullName: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                                        <input
                                            type="tel"
                                            required
                                            className="w-full bg-slate-50 rounded-2xl px-5 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold"
                                            placeholder="+2547..."
                                            value={newAgent.phoneNumber}
                                            onChange={e => setNewAgent({ ...newAgent, phoneNumber: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Agent Code</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-slate-50 rounded-2xl px-5 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-black text-brand-primary uppercase"
                                            placeholder="DK001"
                                            value={newAgent.agentCode}
                                            onChange={e => setNewAgent({ ...newAgent, agentCode: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Region</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-50 rounded-2xl px-5 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold"
                                        placeholder="Nairobi West"
                                        value={newAgent.region}
                                        onChange={e => setNewAgent({ ...newAgent, region: e.target.value })}
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl active:scale-95 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] py-4 bg-brand-primary text-white font-black rounded-2xl shadow-xl shadow-brand-primary/20 active:scale-95 transition-all"
                                    >
                                        Activate Agent
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MasterDashboard;
