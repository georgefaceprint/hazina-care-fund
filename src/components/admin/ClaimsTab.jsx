import React, { useState } from 'react';
import { Clock, ShieldCheck, Filter, FileText, XCircle, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { getSafeDate } from '../../utils/dateUtils';

const ClaimsTab = ({ claims, handleAction, actionLoading }) => {
    const [filter, setFilter] = useState('pending_review');

    const filteredClaims = claims.filter(c => {
        if (filter === 'all') return true;
        return c.status === filter;
    });

    return (
        <>
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center cursor-pointer hover:border-brand-primary transition-all" onClick={() => setFilter('pending_review')}>
                    <Clock className={`w-8 h-8 mx-auto mb-3 ${filter === 'pending_review' ? 'text-amber-500' : 'text-slate-300'}`} />
                    <p className="text-3xl font-black text-slate-900">{claims.filter(c => c.status === 'pending_review').length}</p>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Pending Review</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center cursor-pointer hover:border-brand-primary transition-all" onClick={() => setFilter('approved')}>
                    <ShieldCheck className={`w-8 h-8 mx-auto mb-3 ${filter === 'approved' ? 'text-emerald-500' : 'text-slate-300'}`} />
                    <p className="text-3xl font-black text-slate-900">{claims.filter(c => c.status === 'approved').length}</p>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Approved</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center cursor-pointer hover:border-brand-primary transition-all" onClick={() => setFilter('all')}>
                    <Filter className={`w-8 h-8 mx-auto mb-3 ${filter === 'all' ? 'text-brand-primary' : 'text-slate-300'}`} />
                    <p className="text-3xl font-black text-slate-900">{claims.length}</p>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Total Claims</p>
                </div>
            </div>

            {/* Claims List */}
            <div className="space-y-4">
                {filteredClaims.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <ShieldCheck className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-500 font-bold text-lg">No claims found in this category.</p>
                        <p className="text-slate-400 text-sm mt-1">Everything is up to date.</p>
                    </div>
                ) : (
                    filteredClaims.map((claim) => (
                        <div key={claim.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex gap-4">
                                    <div className={`p-4 rounded-2xl ${claim.type === 'medical' ? 'bg-red-50 text-red-600' :
                                        claim.type === 'bereavement' ? 'bg-slate-100 text-slate-800' :
                                            'bg-blue-50 text-blue-600'
                                        }`}>
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                                                {claim.type.replace('_', ' ')}
                                            </span>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                {format(getSafeDate(claim.createdAt), 'PP')}
                                            </span>
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">KSh {claim.amount.toLocaleString()}</h3>
                                        <p className="text-xs text-slate-500 font-mono mt-1 opacity-70">Case ID: {claim.id}</p>
                                    </div>
                                </div>
                                <div className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${claim.status === 'pending_review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    claim.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                    {claim.status === 'pending_review' ? <Clock className="w-3.5 h-3.5" /> :
                                        claim.status === 'approved' ? <ShieldCheck className="w-3.5 h-3.5" /> :
                                            <XCircle className="w-3.5 h-3.5" />}
                                    {claim.status.replace('_', ' ')}
                                </div>
                            </div>

                            <div className="bg-slate-50/50 p-4 rounded-2xl mb-6 text-sm text-slate-700 border border-slate-100/50">
                                <p className="font-bold text-[10px] uppercase text-slate-400 mb-2 tracking-widest">Description</p>
                                "{claim.description}"
                            </div>

                            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
                                        {claim.guardian_id?.substring(0, 2).toUpperCase() || '??'}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-900">Guardian ID</p>
                                        <p className="text-[10px] text-slate-500 font-mono italic">{claim.guardian_id}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    {claim.proof_url && (
                                        <a
                                            href={claim.proof_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                        >
                                            Review Proof
                                        </a>
                                    )}
                                    {claim.status === 'pending_review' && (
                                        <>
                                            <button
                                                onClick={() => handleAction(claim.id, claim.guardian_id, claim.amount, 'rejected')}
                                                disabled={actionLoading === claim.id}
                                                className="px-6 py-2.5 rounded-xl border border-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleAction(claim.id, claim.guardian_id, claim.amount, 'approved')}
                                                disabled={actionLoading === claim.id}
                                                className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all flex items-center gap-2 active:scale-95"
                                            >
                                                {actionLoading === claim.id ? 'Processing...' : (
                                                    <>Approve & Pay <DollarSign className="w-3.5 h-3.5" /></>
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </>
    );
};

export default ClaimsTab;
