import React from 'react';
import { ShieldCheck, TrendingUp, UserPlus, ArrowLeft } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { formatKenyanPhone } from '../../../utils/phoneUtils';
import { getSafeDate } from '../../../utils/dateUtils';
import { format } from 'date-fns';

const RecruitmentTab = ({ 
    recruitmentConfig, 
    setRecruitmentConfig, 
    recruitmentLogs, 
    recruitmentStats, 
    masterAgents, 
    agents, 
    navigate, 
    toast 
}) => {
    return (
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
                                    if (setRecruitmentConfig) setRecruitmentConfig(prev => ({ ...prev, agentCommission: val }));
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
                                    if (setRecruitmentConfig) setRecruitmentConfig(prev => ({ ...prev, masterCommission: val }));
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
                        onClick={() => navigate('/smagent/dashboard')}
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
    );
};

export default RecruitmentTab;
