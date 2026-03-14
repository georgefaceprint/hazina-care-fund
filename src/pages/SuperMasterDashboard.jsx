import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatKenyanPhone } from '../utils/phoneUtils';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Shield, Activity, Plus, TrendingUp, Map, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

const SuperMasterDashboard = () => {
    const { profile, impersonate } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const activeTab = queryParams.get('tab') || 'overview';
    const toast = useToast();
    const [masters, setMasters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingMaster, setEditingMaster] = useState(null);
    const [newMaster, setNewMaster] = useState({
        fullName: '',
        phoneNumber: '',
        nationalId: '',
        regions: ''
    });
    const [stats, setStats] = useState({
        totalSignups: 0,
        activeMasters: 0,
        activeAgents: 0,
        todayGrowth: 0
    });

    useEffect(() => {
        fetchGlobalData();
    }, []);

    const fetchGlobalData = async () => {
        setLoading(true);
        try {
            if (!db) return;

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

            const totalSignups = agentsSnap.docs.reduce((sum, doc) => sum + (doc.data().totalSignups || 0), 0);

            setStats({
                totalSignups,
                activeMasters: mastersSnap.size,
                activeAgents: agentsSnap.size,
                todayGrowth: todaySnap.size
            });

        } catch (error) {
            console.error("Error fetching global data:", error);
            toast.error("Failed to load global metrics: " + (error.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    const handleAddMaster = async (e) => {
        e.preventDefault();
        try {
            const formattedPhone = formatKenyanPhone(newMaster.phoneNumber);
            const masterRef = doc(db, 'master_agents', formattedPhone);
            const masterData = {
                ...newMaster,
                phoneNumber: formattedPhone,
                nationalId: newMaster.nationalId,
                regions: newMaster.regions.split(',').map(r => r.trim()),
                role: 'master_agent',
                status: 'active',
                createdAt: serverTimestamp()
            };

            await setDoc(masterRef, masterData);

            const userRef = doc(db, 'users', formattedPhone);
            await setDoc(userRef, {
                fullName: newMaster.fullName,
                phoneNumber: formattedPhone,
                role: 'master_agent',
                status: 'active',
                registration_fee_paid: true,
                profile_completed: true
            }, { merge: true });

            toast.success("Master Agent enabled!");
            fetchGlobalData();
            setShowAddModal(false);
            setNewMaster({ fullName: '', phoneNumber: '', nationalId: '', regions: '' });
        } catch (error) {
            console.error("Error adding master:", error);
            toast.error("Failed to register master agent.");
        }
    };

    const handleUpdateMaster = async (e) => {
        e.preventDefault();
        try {
            const masterRef = doc(db, 'master_agents', editingMaster.id);
            const updateData = {
                fullName: editingMaster.fullName,
                nationalId: editingMaster.nationalId || '',
                regions: Array.isArray(editingMaster.regions) ? editingMaster.regions : editingMaster.regions.split(',').map(r => r.trim()),
                status: editingMaster.status || 'active'
            };

            await updateDoc(masterRef, updateData);

            // Update user profile too
            const userRef = doc(db, 'users', editingMaster.id);
            await updateDoc(userRef, {
                fullName: editingMaster.fullName,
                status: editingMaster.status || 'active'
            });

            toast.success("Master Agent updated!");
            fetchGlobalData();
            setEditingMaster(null);
        } catch (error) {
            console.error("Error updating master:", error);
            toast.error("Failed to update master agent.");
        }
    };

    const handleDeleteMaster = async (id) => {
        if (!window.confirm("Are you sure you want to remove this Master Agent? They will lose access to the portal.")) return;

        try {
            await deleteDoc(doc(db, 'master_agents', id));

            // Just demote the user role instead of deleting the user entirely
            await updateDoc(doc(db, 'users', id), {
                role: 'user', // demote back to standard user
                status: 'inactive'
            });

            toast.success("Master Agent removed.");
            fetchGlobalData();
        } catch (error) {
            console.error("Error deleting master:", error);
            toast.error("Failed to remove master agent.");
        }
    };

    // Extract the main UI into a render function to handle tabs
    const renderOverview = () => (
        <div className="space-y-10">
            <header className="mb-10 lg:flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Shield className="w-10 h-10 text-brand-primary" />
                        Hazina Global HQ
                    </h1>
                    <p className="text-slate-500 font-medium text-lg">System-wide recruitment oversight</p>
                </div>
                <div className="mt-4 lg:mt-0">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                    >
                        <Plus className="w-6 h-6" />
                        Register Master Agent
                    </button>
                </div>
            </header>

            {/* Global Multi-Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group">
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
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xl font-black text-slate-900 ml-2">Master Agent Networks</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {loading ? (
                            <div className="col-span-2 p-12 text-center text-slate-400 italic font-medium">Synchronizing network data...</div>
                        ) : masters.length === 0 ? (
                            <div className="col-span-2 p-12 text-center text-slate-400 bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
                                No Master Agents registered yet.
                            </div>
                        ) : masters.map(master => (
                            <motion.div
                                key={master.id}
                                className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all relative group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center font-black text-xl border border-slate-100 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                        {master.fullName.charAt(0)}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                impersonate(master);
                                                navigate('/magent/dashboard');
                                            }}
                                            className="px-3 py-1.5 bg-slate-50 text-[10px] font-black text-slate-600 rounded-xl hover:bg-brand-primary hover:text-white transition-all uppercase tracking-widest border border-slate-100"
                                        >
                                            Login As
                                        </button>
                                        <button
                                            onClick={() => setEditingMaster(master)}
                                            className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-50 rounded-xl transition-all"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteMaster(master.id)}
                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
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

        </div>
    );

    const renderModals = () => (
        <>
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
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold text-slate-900"
                                            placeholder="John Doe"
                                            value={newMaster.fullName}
                                            onChange={e => setNewMaster({ ...newMaster, fullName: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number (ID)</label>
                                        <input
                                            type="tel"
                                            required
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold text-slate-900"
                                            placeholder="+2547..."
                                            value={newMaster.phoneNumber}
                                            onChange={e => setNewMaster({ ...newMaster, phoneNumber: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">National ID Number</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold text-slate-900"
                                            placeholder="12345678"
                                            value={newMaster.nationalId}
                                            onChange={e => setNewMaster({ ...newMaster, nationalId: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Regions (Comma separated)</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold text-slate-900"
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

            {/* Edit Master Modal */}
            <AnimatePresence>
                {editingMaster && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-slate-900/60">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl"
                        >
                            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Modify Master</h2>

                            <form onSubmit={handleUpdateMaster} className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold text-slate-900"
                                            value={editingMaster.fullName}
                                            onChange={e => setEditingMaster({ ...editingMaster, fullName: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Regions (Comma separated)</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold text-slate-900"
                                            value={Array.isArray(editingMaster.regions) ? editingMaster.regions.join(', ') : editingMaster.regions}
                                            onChange={e => setEditingMaster({ ...editingMaster, regions: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                                        <select
                                            className="w-full bg-slate-50 rounded-2xl px-6 py-4 border-none focus:ring-2 focus:ring-brand-primary transition-all font-bold text-slate-900"
                                            value={editingMaster.status}
                                            onChange={e => setEditingMaster({ ...editingMaster, status: e.target.value })}
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
                                        onClick={() => setEditingMaster(null)}
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
        </>
    );

    const renderPerformance = () => (
        <div className="space-y-10">
            <header className="mb-10">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <TrendingUp className="w-10 h-10 text-brand-primary" />
                    Network Performance
                </h1>
                <p className="text-slate-500 font-medium text-lg">Detailed analytical overview</p>
            </header>

            <div className="bg-white rounded-[3rem] p-12 text-center border border-slate-100 shadow-sm">
                <Activity className="w-24 h-24 text-slate-200 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-slate-900 mb-2">Detailed Analytics Coming Soon</h2>
                <p className="text-slate-500 max-w-md mx-auto">We are building out comprehensive charts and historical performance data for the entire network.</p>
            </div>
        </div>
    );

    const renderActiveTab = () => {
        if (activeTab === 'networks') return renderNetworks();
        if (activeTab === 'performance') return renderPerformance();
        return renderOverview();
    };

    return (
        <>
            {renderActiveTab()}
            {renderModals()}
        </>
    );
};

export default SuperMasterDashboard;
