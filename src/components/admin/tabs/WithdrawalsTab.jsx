import React from 'react';
import { CreditCard } from 'lucide-react';
import { getSafeDate } from '../../utils/dateUtils';
import { format } from 'date-fns';

const WithdrawalsTab = ({ withdrawals }) => {
    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">Agent Withdrawals</h3>
                        <p className="text-xs text-slate-500 mt-1">Real-time disbursement logs for commissions.</p>
                    </div>
                    <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">
                        {withdrawals.length} Recent
                    </div>
                </div>
                <div className="divide-y divide-slate-50">
                    {withdrawals.length === 0 ? (
                        <div className="p-20 text-center text-slate-400 italic font-medium">No withdrawal records found.</div>
                    ) : (
                        withdrawals.map(wd => (
                            <div key={wd.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-100 shadow-sm">
                                        <CreditCard className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900">
                                            Agent <span className="text-brand-primary">{wd.agentId}</span>
                                        </p>
                                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">Ref: {wd.transactionReference || 'PENDING'}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                                wd.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 
                                                wd.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {wd.status}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                {wd.timestamp ? format(getSafeDate(wd.timestamp), 'PPpp') : 'Recent'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <h4 className="text-lg font-black text-slate-900">KSh {wd.amount?.toLocaleString()}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Disbursement</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default WithdrawalsTab;
