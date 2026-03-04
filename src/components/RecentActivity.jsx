import React from 'react';
import { Clock, CheckCircle2, XCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { format } from 'date-fns';

const RecentActivity = ({ activities }) => {
    if (!activities || activities.length === 0) {
        return (
            <div className="text-center py-10 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No Recent Activity</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {activities.map((act) => (
                <div key={act.id} className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${act.type === 'topup' ? 'bg-emerald-50 text-emerald-600' :
                                act.type === 'claim' ? 'bg-red-50 text-red-600' :
                                    'bg-slate-50 text-slate-600'
                            }`}>
                            {act.type === 'topup' ? <ArrowUpRight className="w-5 h-5" /> :
                                act.type === 'claim' ? <ArrowDownLeft className="w-5 h-5" /> :
                                    <Clock className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 text-sm">
                                {act.label || (act.type === 'topup' ? 'Wallet Top-up' : 'Crisis Claim')}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                                {act.date ? format(act.date, 'MMM dd, HH:mm') : 'Recent'}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={`font-black text-sm ${act.type === 'topup' ? 'text-emerald-600' : 'text-slate-900'
                            }`}>
                            {act.type === 'topup' ? '+' : '-'}{act.amount ? `KSh ${act.amount.toLocaleString()}` : ''}
                        </p>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                            {act.status === 'approved' || act.status === 'success' ? (
                                <span className="text-[8px] font-black uppercase text-emerald-500 tracking-tighter">Completed</span>
                            ) : act.status === 'pending' || act.status === 'pending_review' ? (
                                <span className="text-[8px] font-black uppercase text-amber-500 tracking-tighter">Processing</span>
                            ) : (
                                <span className="text-[8px] font-black uppercase text-red-500 tracking-tighter">Rejected</span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default RecentActivity;
