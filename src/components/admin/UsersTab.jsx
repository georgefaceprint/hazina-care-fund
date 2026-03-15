import React from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

const UsersTab = ({ users, forcedTotpList, toggleAdmin, toast }) => {
    return (
        <div className="space-y-4">
            {users.map(u => (
                <div key={u.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-slate-900">{u.phoneNumber || u.email}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                {u.role || 'guardian'}
                            </span>
                            {u.totpEnabled ? (
                                <span className="flex items-center gap-1 text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase">
                                    <ShieldCheck className="w-2.5 h-2.5" /> 2FA Active
                                </span>
                            ) : forcedTotpList.includes(u.phoneNumber || u.email) && (
                                <span className="flex items-center gap-1 text-[8px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded uppercase animate-pulse">
                                    <ShieldAlert className="w-2.5 h-2.5" /> 2FA Mandatory
                                </span>
                            )}
                            <span className="text-[10px] text-slate-400 uppercase tracking-tighter italic">ID: {u.id}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {u.totpEnabled && (
                            <button
                                onClick={async () => {
                                    if (window.confirm(`Are you sure you want to disable 2FA for ${u.phoneNumber || u.email}?`)) {
                                        await setDoc(doc(db, 'users', u.id), { totpEnabled: false, totpSecret: null }, { merge: true });
                                        toast.success("Security reset successful.");
                                    }
                                }}
                                className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-100 text-red-600 hover:bg-red-50 transition-all active:scale-95"
                            >
                                Reset 2FA
                            </button>
                        )}
                        <button
                            onClick={async () => {
                                const identifier = u.phoneNumber || u.email;
                                const isEnforced = forcedTotpList.includes(identifier);
                                let updated;
                                if (isEnforced) {
                                    updated = forcedTotpList.filter(e => e !== identifier);
                                    toast.success("Enforcement removed.");
                                } else {
                                    updated = [...forcedTotpList, identifier];
                                    toast.success("Enforcement active.");
                                }
                                await setDoc(doc(db, 'config', 'security'), { forced_totp_list: updated }, { merge: true });
                            }}
                            className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all active:scale-95 ${forcedTotpList.includes(u.phoneNumber || u.email) ? 'bg-red-50 border-red-200 text-red-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                            {forcedTotpList.includes(u.phoneNumber || u.email) ? 'Disable Forced 2FA' : 'Enforce 2FA'}
                        </button>
                        <button
                            onClick={() => toggleAdmin(u.id, u.role)}
                            className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
                        >
                            {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default UsersTab;
