import { Clock, CheckCircle2, XCircle, ArrowUpRight, ArrowDownLeft, Users, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '../context/LanguageContext';

const RecentActivity = ({ activities }) => {
    const { t } = useLanguage();
    if (!activities || activities.length === 0) {
        return (
            <div className="text-center py-10 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t('no_recent_activity')}</p>
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
                                act.type === 'dependent' ? 'bg-blue-50 text-blue-600' :
                                    act.type === 'upgrade' ? 'bg-amber-50 text-amber-600' :
                                        'bg-slate-50 text-slate-600'
                            }`}>
                            {act.type === 'topup' ? <ArrowUpRight className="w-5 h-5" /> :
                                act.type === 'claim' ? <ArrowDownLeft className="w-5 h-5" /> :
                                    act.type === 'dependent' ? <Users className="w-5 h-5" /> :
                                        act.type === 'upgrade' ? <Zap className="w-5 h-5" /> :
                                            <Clock className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 text-sm">
                                {act.label || (act.type === 'topup' ? t('wallet_topup') :
                                    act.type === 'claim' ? t('crisis_claim') :
                                        act.type === 'dependent' ? t('new_member') :
                                            act.type === 'upgrade' ? t('tier_upgrade_activity') :
                                                t('recent_activity'))}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                {act.date ? format(act.date, 'MMM dd, HH:mm') : t('in_waiting')}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={`font-black text-sm ${act.type === 'topup' ? 'text-emerald-600' : 'text-slate-900'
                            }`}>
                            {act.type === 'topup' ? '+' : '-'}{act.amount ? `KSh ${act.amount.toLocaleString()}` : ''}
                        </p>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                            {act.status === 'approved' || act.status === 'success' || act.status === 'completed' ? (
                                <span className="text-[8px] font-black uppercase text-emerald-500 tracking-tighter">{t('completed')}</span>
                            ) : act.status === 'pending' || act.status === 'pending_review' ? (
                                <span className="text-[8px] font-black uppercase text-amber-500 tracking-tighter">{t('processing')}</span>
                            ) : (
                                <span className="text-[8px] font-black uppercase text-red-500 tracking-tighter">{t('rejected')}</span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default RecentActivity;
