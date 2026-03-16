import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AgentModals = ({
    showAddModal,
    setShowAddModal,
    editingAgent,
    setEditingAgent,
    newAgent,
    setNewAgent,
    handleAddAgent,
    handleUpdateAgent
}) => {
    return (
        <AnimatePresence>
            {/* Add Agent Modal */}
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
                                    className="flex-[2] py-4 bg-brand-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-primary/20 active:scale-95 transition-all hover:bg-brand-secondary"
                                >
                                    Authorize Agent
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Edit Agent Modal */}
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
                                    className="flex-[2] py-4 bg-brand-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-primary/20 active:scale-95 transition-all outline-none"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default AgentModals;
