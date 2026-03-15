import React from 'react';
import { DollarSign, ArrowLeft } from 'lucide-react';
import { getSafeDate } from '../../utils/dateUtils';
import { format } from 'date-fns';

const TransactionsTab = ({ transactions }) => {
    return (
        <div className="space-y-4">
            {transactions.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <DollarSign className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold text-lg">No transactions recorded yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {transactions.map(t => (
                        <div key={t.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-6">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${t.type === 'payout' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    {t.type === 'payout' ? <ArrowLeft className="w-6 h-6 rotate-45" /> : <DollarSign className="w-6 h-6" />}
                                </div>
                                <div>
                                    <p className="text-xl font-black text-slate-900 tracking-tight">KSh {t.amount.toLocaleString()}</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">{t.userId} • {t.type}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">{format(getSafeDate(t.createdAt), 'PP')}</p>
                                <span className={`text-[10px] px-3 py-1 rounded-lg font-black uppercase tracking-widest ${t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{t.status}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TransactionsTab;
