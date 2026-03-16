import React from 'react';
import { motion } from 'framer-motion';
import { Users, Search, Filter, MapPin, Edit2, Trash2 } from 'lucide-react';
import { stripPlus } from '../../utils/phoneUtils';

const AgentGrid = ({ 
    agents, 
    loading, 
    onAddFirst, 
    impersonate, 
    navigate, 
    setEditingAgent, 
    handleDeleteAgent 
}) => {
    return (
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
                        <button onClick={onAddFirst} className="bg-brand-primary text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest">Register First Agent</button>
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
                                    {(agent.fullName || 'A').charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-slate-900 truncate">{agent.fullName}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-black text-brand-primary uppercase tracking-tighter bg-brand-50 px-1.5 py-0.5 rounded-md">{stripPlus(agent.agentCode || '')}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => {
                                        impersonate(agent);
                                        navigate('/agent');
                                    }}
                                    className="px-3 py-1 bg-slate-50 text-[9px] font-black text-slate-500 rounded-lg hover:bg-brand-primary hover:text-white transition-all uppercase tracking-widest border border-slate-100"
                                >
                                    Console
                                </button>
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
    );
};

export default AgentGrid;
