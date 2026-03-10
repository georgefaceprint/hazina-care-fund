import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, orderBy, Timestamp, limit, serverTimestamp } from 'firebase/firestore';
import { Users, UserPlus, MapPin, Search, Filter, TrendingUp, DollarSign, ChevronRight, MoreVertical, Activity, Briefcase, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

const MasterDashboard = () => {
    const { profile } = useAuth();
    const toast = useToast();
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAgent, setEditingAgent] = useState(null);
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

    const masterId = profile?.phoneNumber || profile?.id;

    useEffect(() => {
        if (masterId) {
            fetchData();
        }
    }, [masterId]);

    const fetchData = async () => {
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
            fetchData();
        } catch (error) {
            console.error("Error adding agent:", error);
            toast.error("Failed to register agent.");
        }
    };

    const handleUpdateAgent = async (e) => {
        e.preventDefault();
        try {
            const agentRef = doc(db, 'agents', editingAgent.id);
            const updateData = {
                fullName: editingAgent.fullName,
                region: editingAgent.region,
                status: editingAgent.status || 'active'
            };

            await updateDoc(agentRef, updateData);

            // Update user profile too
            const userRef = doc(db, 'users', editingAgent.phoneNumber);
            await updateDoc(userRef, {
                fullName: editingAgent.fullName,
                status: editingAgent.status || 'active'
            });

            toast.success("Agent updated!");
            fetchData();
            setEditingAgent(null);
        } catch (error) {
            console.error("Error updating agent:", error);
            toast.error("Failed to update agent.");
        }
    };

    const handleDeleteAgent = async (id, phoneNumber) => {
        if (!window.confirm("Are you sure you want to remove this Agent? They will lose recruitment access.")) return;

        try {
            await deleteDoc(doc(db, 'agents', id));

            // Demote user role
            await updateDoc(doc(db, 'users', phoneNumber), {
                role: 'user',
                status: 'inactive'
            });

            toast.success("Agent removed.");
            fetchData();
        } catch (error) {
            console.error("Error deleting agent:", error);
            toast.error("Failed to remove agent.");
        }
    };

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Briefcase className="w-8 h-8 text-brand-primary" />
                        Master Agent Console
                    </h1>
                    <p className="text-slate-500 font-medium">Recruitment management for {profile?.fullName}</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                >
                    <UserPlus className="w-5 h-5" />
                    Expand Team
                </button>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col justify-between group">
                    <div className="flex justify-between items-center mb-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Team Performance</p>
                        <TrendingUp className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div>
                        <div className="flex items-baseline gap-3">
                            <h2 className="text-4xl font-black text-slate-900">{stats.signupsToday}</h2>
                            <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">Today</span>
                        </div>
                        <p className="text-xs font-bold text-slate-400 mt-2">Yesterday: <span className="text-slate-900">{stats.signupsYesterday}</span></p>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Force</p>
                        <Users className="w-5 h-5 text-slate-300" />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black text-slate-900">{stats.totalAgents}</h2>
                        <p className="text-xs font-bold text-slate-400 mt-2">Field agents authorized</p>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Earnings</p>
                        <DollarSign className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black text-emerald-600">KES {(stats.signupsToday * 15).toLocaleString()}</h2>
                        <p className="text-xs font-bold text-slate-400 mt-2">Current daily accrual</p>
                    </div>
                </div>
            </div>

            {/* Agents List */}
            <div className="space-y-6">
                <div className="flex justify-between items-center px-2">
                    <h3 className="text-xl font-black text-slate-900">Your Agent Network</h3>
                    <div className="flex gap-4">
                        <Search className="w-5 h-5 text-slate-300 cursor-pointer hover:text-brand-primary transition-colors" />
                        <Filter className="w-5 h-5 text-slate-300 cursor-pointer hover:text-brand-primary transition-colors" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? (
                        <div className="col-span-full p-20 text-center text-slate-400 italic font-medium">Synchronizing agent team...</div>
                    ) : agents.length === 0 ? (
                        <div className="col-span-full bg-white rounded-[2.5rem] p-16 text-center border-2 border-dashed border-slate-100">
                            <Users className="w-16 h-16 text-slate-100 mx-auto mb-6" />
                            <p className="text-slate-900 font-bold mb-2 text-lg">No agents registered yet.</p>
                            <p className="text-slate-400 text-sm mb-6">Start expanding your network to begin recruitment.</p>
                            <button onClick={() => setShowAddModal(true)} className="bg-brand-primary text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest">Register First Agent</button>
                        </div>
                    ) : agents.map(agent => (
                        <motion.div
                            key={agent.id}
                            whileHover={{ y: -5 }}
                            className="bg-white rounded-[2rem] p-6 flex flex-col shadow-sm border border-slate-100 hover:shadow-md transition-all relative group overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-16 h-16 bg-brand-primary/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 text-brand-primary rounded-xl flex items-center justify-center font-black text-xl border border-slate-100 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                        {agent.fullName.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-slate-900 truncate">{agent.fullName}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-black text-brand-primary uppercase tracking-tighter bg-brand-50 px-1.5 py-0.5 rounded-md">{agent.agentCode}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setEditingAgent(agent); }}
                                        className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-50 rounded-xl transition-all"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent.agentCode, agent.phoneNumber); }}
                                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4 mt-auto relative z-10">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Region</p>
                                    <p className="text-xs font-bold text-slate-700 mt-0.5 flex items-center gap-1 leading-none"><MapPin className="w-3 h-3 text-brand-primary" /> {agent.region}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Signups</p>
                                    <p className="text-xl font-black text-slate-900 leading-none mt-0.5">{agent.totalSignups || 0}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Add Agent Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-slate-900/40 text-left">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl"
                        >
                            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Register Agent</h2>

                            <form onSubmit={handleAddAgent} className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Identity</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold text-slate-900"
                                        placeholder="David Kamau"
                                        value={newAgent.fullName}
                                        onChange={e => setNewAgent({ ...newAgent, fullName: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                                        <input
                                            type="tel"
                                            required
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold text-slate-900"
                                            placeholder="+2547..."
                                            value={newAgent.phoneNumber}
                                            onChange={e => setNewAgent({ ...newAgent, phoneNumber: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unique Agent Code</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-black text-brand-primary uppercase"
                                            placeholder="DK001"
                                            value={newAgent.agentCode}
                                            onChange={e => setNewAgent({ ...newAgent, agentCode: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Operation Region</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold text-slate-900"
                                        placeholder="Nairobi West"
                                        value={newAgent.region}
                                        onChange={e => setNewAgent({ ...newAgent, region: e.target.value })}
                                    />
                                </div>

                                <div className="pt-6 flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl active:scale-95 transition-all hover:bg-slate-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-900/10 active:scale-95 transition-all hover:bg-slate-800"
                                    >
                                        Authorize Agent
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Agent Modal */}
            <AnimatePresence>
                {editingAgent && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-slate-900/40 text-left">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl"
                        >
                            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Modify Agent</h2>

                            <form onSubmit={handleUpdateAgent} className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Identity</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold text-slate-900"
                                        value={editingAgent.fullName}
                                        onChange={e => setEditingAgent({ ...editingAgent, fullName: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Operation Region</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold text-slate-900"
                                            value={editingAgent.region}
                                            onChange={e => setEditingAgent({ ...editingAgent, region: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Status</label>
                                        <select
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold text-slate-900"
                                            value={editingAgent.status}
                                            onChange={e => setEditingAgent({ ...editingAgent, status: e.target.value })}
                                        >
                                            <option value="active">Active</option>
                                            <option value="suspended">Suspended</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-6 flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setEditingAgent(null)}
                                        className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl active:scale-95 transition-all outline-none"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-900/10 active:scale-95 transition-all outline-none"
                                    >
                                        Save Changes
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
