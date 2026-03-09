import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, getDocs, doc, setDoc, orderBy, serverTimestamp, limit, Timestamp } from 'firebase/firestore';
import { Globe, Shield, Users, Briefcase, Activity, Plus, TrendingUp, Map, UserCheck } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

const SuperMasterDashboard = () => {
    const { profile } = useAuth();
    const toast = useToast();
    const [masters, setMasters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMaster, setNewMaster] = useState({
        fullName: '',
        phoneNumber: '',
        regions: ''
    });
    const [stats, setStats] = useState({
        totalSignups: 0,
        activeMasters: 0,
        activeAgents: 0,
        todayGrowth: 0
    });

    useEffect(() => {
        const fetchGlobalData = async () => {
            setLoading(true);
            try {
                // Fetch Master Agents
                const mastersSnap = await getDocs(collection(db, 'master_agents'));
                const mastersList = mastersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setMasters(mastersList);

                // Fetch Agents count
                const agentsSnap = await getDocs(collection(db, 'agents'));

                // Fetch Global Signups (Today)
                const now = new Date();
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const logsRef = collection(db, 'recruitment_logs');
                const todayQuery = query(logsRef, where('timestamp', '>=', Timestamp.fromDate(startOfToday)));
                const todaySnap = await getDocs(todayQuery);

                // For total signups, we can sum from the agents collection totals for efficiency
                const totalSignups = agentsSnap.docs.reduce((sum, doc) => sum + (doc.data().totalSignups || 0), 0);

                setStats({
                    totalSignups,
                    activeMasters: mastersSnap.size,
                    activeAgents: agentsSnap.size,
                    todayGrowth: todaySnap.size
                });

            } catch (error) {
                console.error("Error fetching global data:", error);
                toast.error("Failed to load global metrics.");
            } finally {
                setLoading(false);
            }
        };

        fetchGlobalData();
    }, []);

    const handleAddMaster = async (e) => {
        e.preventDefault();
        try {
            const masterRef = doc(db, 'master_agents', newMaster.phoneNumber);
            const masterData = {
                ...newMaster,
                regions: newMaster.regions.split(',').map(r => r.trim()),
                role: 'master_agent',
                status: 'active',
                createdAt: serverTimestamp()
            };

            await setDoc(masterRef, masterData);

            // Update user role
            const userRef = doc(db, 'users', newMaster.phoneNumber);
            await setDoc(userRef, {
                fullName: newMaster.fullName,
                phoneNumber: newMaster.phoneNumber,
                role: 'master_agent',
                status: 'active'
            }, { merge: true });

            toast.success("Master Agent enabled!");
            setMasters([...masters, { id: newMaster.phoneNumber, ...masterData }]);
            setShowAddModal(false);
            setNewMaster({ fullName: '', phoneNumber: '', regions: '' });
        } catch (error) {
            console.error("Error adding master:", error);
            toast.error("Failed to register master agent.");
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-8 font-sans">
            <header className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Shield className="w-8 h-8 text-brand-primary" />
                        Hazina Global HQ
                    </h1>
                    <p className="text-slate-500 font-medium">System-wide recruitment oversight</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                >
                    <Plus className="w-5 h-5" />
                    New Master Agent
                </button>
            </header>

            {/* Global Multi-Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full -mr-12 -mt-12 transition-all group-hover:scale-150"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Global Signups</p>
                    <div className="flex items-center gap-2">
                        <h2 className="text-3xl font-black text-slate-900">{stats.totalSignups.toLocaleString()}</h2>
                        <span className="text-xs font-bold text-emerald-500 flex items-center"><TrendingUp className="w-3 h-3 mr-0.5" /> +{stats.todayGrowth}</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Master Agents</p>
                    <h2 className="text-3xl font-black text-slate-900">{stats.activeMasters}</h2>
                </div>
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Field Agents</p>
                    <h2 className="text-3xl font-black text-slate-900">{stats.activeAgents}</h2>
                </div>
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Payouts</p>
                    <h2 className="text-3xl font-black text-brand-primary">KES {(stats.totalSignups * 15).toLocaleString()}</h2>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Master Agents List */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xl font-black text-slate-900 ml-2">Master Agent Networks</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {loading ? (
                            <div className="col-span-2 p-12 text-center text-slate-400">Loading networks...</div>
                        ) : masters.map(master => (
                            <motion.div
                                key={master.id}
                                whileHover={{ scale: 1.02 }}
                                className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center font-black text-xl border border-slate-100 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                        {master.fullName.charAt(0)}
                                    </div>
                                    <Activity className="w-5 h-5 text-slate-200 group-hover:text-brand-primary/40 transition-colors" />
                                </div>
                                <h4 className="font-bold text-slate-900 text-lg mb-1">{master.fullName}</h4>
                                <p className="text-xs text-slate-400 mb-4">{master.phoneNumber}</p>

                                <div className="flex flex-wrap gap-2">
                                    {master.regions?.map((region, idx) => (
                                        <span key={idx} className="text-[9px] font-black text-brand-primary bg-brand-50 px-2 py-0.5 rounded-full uppercase">{region}</span>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Regional Activity / Heatmap Mockup */}
                <div className="space-y-4">
                    <h3 className="text-xl font-black text-slate-900 ml-2">Regional Performance</h3>
                    <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 h-[400px] flex flex-col">
                        <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 relative overflow-hidden group">
                            <Map className="w-24 h-24 text-slate-200 group-hover:scale-110 transition-transform duration-700" />
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent"></div>
                            <p className="absolute bottom-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Regional Activity Visualization</p>
                        </div>
                        <div className="mt-6 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-600">Nairobi West</span>
                                <div className="flex-1 mx-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-primary w-[75%]"></div>
                                </div>
                                <span className="text-xs font-black text-slate-900">75%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-600">Mombasa CBD</span>
                                <div className="flex-1 mx-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-primary w-[45%]"></div>
                                </div>
                                <span className="text-xs font-black text-slate-900">45%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Master Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-slate-900/60">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl"
                        >
                            <h2 className="text-3xl font-black text-slate-900 mb-8">Register Master</h2>

                            <form onSubmit={handleAddMaster} className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Master Agent Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold"
                                            placeholder="John Doe"
                                            value={newMaster.fullName}
                                            onChange={e => setNewMaster({ ...newMaster, fullName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number (ID)</label>
                                        <input
                                            type="tel"
                                            required
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold"
                                            placeholder="+2547..."
                                            value={newMaster.phoneNumber}
                                            onChange={e => setNewMaster({ ...newMaster, phoneNumber: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Regions (Comma separated)</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold"
                                            placeholder="Nairobi, Mombasa"
                                            value={newMaster.regions}
                                            onChange={e => setNewMaster({ ...newMaster, regions: e.target.value })}
                                        />
                                    </div>
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
                                        Authorize Network
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

export default SuperMasterDashboard;
