import React from 'react';
import { TrendingUp } from 'lucide-react';

const AnalyticsTab = ({ users, last7Days, maxVolume, globalStats }) => {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="relative z-10">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Membership</h4>
                        <p className="text-5xl font-black text-slate-900 tracking-tighter">{users.length}</p>
                        <div className="flex items-center gap-2 mt-4">
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg">+12%</span>
                            <span className="text-[10px] text-slate-400 font-bold">Growth this cycle</span>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="relative z-10">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Active Shields</h4>
                        <p className="text-5xl font-black text-slate-900 tracking-tighter">{users.filter(u => u.status === 'fully-active').length}</p>
                        <div className="flex items-center gap-2 mt-4 text-[10px]">
                            <span className="text-slate-400 font-bold uppercase tracking-widest">Pending Activation:</span>
                            <span className="text-amber-600 font-black">{users.filter(u => u.status === 'in-waiting').length}</span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-brand-secondary/5 rounded-full blur-3xl -mr-16 -mb-16"></div>
                </div>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h4 className="text-lg font-black text-slate-900 mb-10 flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 text-brand-primary" />
                    Fund Liquidity Growth (7D)
                </h4>
                <div className="h-64 flex items-end gap-4 px-4 overflow-hidden">
                    {last7Days.map((day, i) => {
                        const heightPercent = Math.max((day.volume / (maxVolume || 1)) * 100, 5);
                        return (
                            <div key={i} className="flex-1 group relative">
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    KSh {day.volume.toLocaleString()}
                                </div>
                                <div
                                    className="w-full bg-brand-primary/10 rounded-2xl group-hover:bg-brand-primary/20 transition-all cursor-crosshair pb-1"
                                    style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}
                                >
                                    <div
                                        className="w-full bg-brand-primary rounded-2xl transition-all shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                                        style={{ height: `${heightPercent}%` }}
                                    ></div>
                                </div>
                                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{day.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 overflow-hidden relative shadow-2xl shadow-slate-200/50">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-[120px] -mr-48 -mt-48"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] -ml-32 -mb-32"></div>
                <div className="relative z-10">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Total System Portfolio</h4>
                    <p className="text-6xl font-black tracking-tight italic text-slate-900">KSh {(globalStats.total_fund || 0).toLocaleString()}</p>
                    <div className="mt-8 flex items-center gap-4">
                        <div className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 flex items-center gap-2 text-slate-600">
                            <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse"></div>
                            Live Liquidity
                        </div>
                        <div className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 text-slate-500">Community Trust: 98%</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsTab;
