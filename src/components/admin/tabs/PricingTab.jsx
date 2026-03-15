import React from 'react';
import { TrendingUp, Zap, Clock } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

const PricingTab = ({ tiers, handleUpdateTiers, setTiers }) => {
    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-xl font-black mb-8 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-brand-primary" />
                    Tier Configuration
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {Object.keys(tiers).length === 0 ? (
                        <div className="col-span-3 py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 font-bold">No tier configuration found.</p>
                            <button
                                onClick={() => {
                                    const defaultTiers = {
                                        bronze: { cost: 50, limit: 100000, name: 'Bronze Shield', maturation: 180 },
                                        silver: { cost: 147, limit: 250000, name: 'Silver Shield', maturation: 180 },
                                        gold: { cost: 229, limit: 500000, name: 'Gold Shield', maturation: 180 }
                                    };
                                    setDoc(doc(db, 'config', 'tiers'), defaultTiers);
                                    if (setTiers) setTiers(defaultTiers);
                                }}
                                className="mt-4 px-6 py-2 bg-brand-primary text-white rounded-xl text-xs font-black uppercase tracking-widest"
                            >
                                Reset Defaults
                            </button>
                        </div>
                    ) : (
                        Object.entries(tiers).map(([key, data]) => (
                            <div key={key} className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-slate-100">
                                        <Zap className={`w-7 h-7 ${key === 'gold' ? 'text-amber-500' : key === 'silver' ? 'text-slate-400' : 'text-orange-700'}`} />
                                    </div>
                                    <h4 className="font-black text-slate-900 uppercase tracking-widest italic">{key} Tier</h4>
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Daily Cost (KSh)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">KSh</span>
                                            <input
                                                type="number"
                                                className="w-full bg-white p-4 pl-14 rounded-2xl border border-slate-200 font-black text-slate-900 focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                                defaultValue={data.cost}
                                                onBlur={e => handleUpdateTiers(key, 'cost', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Cover Limit (KSh)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">KSh</span>
                                            <input
                                                type="number"
                                                className="w-full bg-white p-4 pl-14 rounded-2xl border border-slate-200 font-black text-slate-900 focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                                defaultValue={data.limit}
                                                onBlur={e => handleUpdateTiers(key, 'limit', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Maturation (Days)</label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                            <input
                                                type="number"
                                                className="w-full bg-white p-4 pl-12 rounded-2xl border border-slate-200 font-black text-slate-900 focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                                defaultValue={data.maturation || 180}
                                                onBlur={e => handleUpdateTiers(key, 'maturation', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default PricingTab;
