import React from 'react';
import { Shield, Zap, Check, ArrowLeft, Heart, Skull, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const TIER_BENEFITS = {
    bronze: {
        name: 'Bronze Shield',
        cost: 10,
        limit: '15,000',
        color: 'text-orange-700',
        bg: 'bg-orange-50',
        border: 'border-orange-100',
        icon: Shield,
        period: '30 Days'
    },
    silver: {
        name: 'Silver Shield',
        cost: 30,
        limit: '50,000',
        color: 'text-slate-700',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        icon: Shield,
        period: '60 Days'
    },
    gold: {
        name: 'Gold Shield',
        cost: 50,
        limit: '150,000',
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: Zap,
        period: '90 Days'
    }
};

const Benefits = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();

    return (
        <div className="min-h-screen bg-slate-50 pt-8 px-6 pb-32">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-700" />
                </button>
                <h1 className="text-2xl font-black font-heading text-slate-900">{t('package_info') || "Shield Packages"}</h1>
            </div>

            <div className="space-y-6">
                {Object.entries(TIER_BENEFITS).map(([key, data]) => {
                    const Icon = data.icon;
                    return (
                        <div key={key} className={`p-6 rounded-[2rem] border-2 bg-white ${data.border} shadow-sm relative overflow-hidden`}>
                            <div className={`absolute top-0 right-0 w-32 h-32 ${data.bg} rounded-full -mr-16 -mt-16 opacity-50`}></div>

                            <div className="flex items-center gap-4 mb-6 relative">
                                <div className={`p-4 rounded-2xl ${data.bg} ${data.color}`}>
                                    <Icon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">{data.name}</h3>
                                    <p className={`text-sm font-bold ${data.color} uppercase tracking-widest`}>KSh {data.cost}/Day</p>
                                </div>
                            </div>

                            <div className="space-y-4 relative">
                                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Max Claim Limit</span>
                                    <span className="font-black text-slate-900 text-lg">KSh {data.limit}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Maturation Period</span>
                                    <span className="font-black text-slate-900 text-lg">{data.period}</span>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-50 space-y-3">
                                <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                                    <Check className="w-5 h-5 text-emerald-500" />
                                    <span>24/7 Crisis Support</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                                    <Check className="w-5 h-5 text-emerald-500" />
                                    <span>Direct M-Pesa Disbursement</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                                    <Check className="w-5 h-5 text-emerald-500" />
                                    <span>Community Governance Rights</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Crisis Definition */}
            <div className="mt-12 bg-slate-900 rounded-[2.5rem] p-8 text-white">
                <h3 className="text-xl font-black mb-6">What counts as a Crisis?</h3>
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className="p-3 bg-white/10 rounded-xl text-emerald-400">
                            <Heart className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold">Medical Emergency</h4>
                            <p className="text-xs opacity-60 mt-1">Hospitalization or critical medication for any registered dependent.</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="p-3 bg-white/10 rounded-xl text-slate-300">
                            <Skull className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold">Bereavement</h4>
                            <p className="text-xs opacity-60 mt-1">Funeral and transport costs for immediate platform dependents.</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="p-3 bg-white/10 rounded-xl text-blue-400">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold">School Fees</h4>
                            <p className="text-xs opacity-60 mt-1">Emergency coverage for term fees to prevent student dropout.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Benefits;
