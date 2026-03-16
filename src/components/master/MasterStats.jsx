import React from 'react';
import { TrendingUp, Users, DollarSign } from 'lucide-react';

const MasterStats = ({ stats }) => {
    return (
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
    );
};

export default MasterStats;
