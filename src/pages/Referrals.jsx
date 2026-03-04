import React, { useState } from 'react';
import { Gift, Share2, Copy, Check, Users, ShieldCheck, Zap, ArrowLeft, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const Referrals = () => {
    const { profile } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);

    const referralCode = profile?.referral_code || `HAZINA-${profile?.id?.slice(0, 4).toUpperCase() || 'PROMO'}`;
    const referralCount = profile?.referral_count || 0;
    const hazinaPoints = profile?.hazina_points || 0;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-50 pt-8 px-6 pb-32">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-700" />
                </button>
                <h1 className="text-2xl font-black font-heading text-slate-900">{t('referrals') || "Hazina Referrals"}</h1>
            </div>

            {/* Stats Card */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary rounded-full blur-[80px] opacity-20 -mr-24 -mt-24"></div>

                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest opacity-60 mb-1">Your Hazina Points</h4>
                        <div className="flex items-center gap-2">
                            <Zap className="w-8 h-8 text-amber-400 fill-amber-400" />
                            <span className="text-5xl font-black">{hazinaPoints}</span>
                        </div>
                    </div>
                    <div className="bg-white/10 p-4 rounded-3xl border border-white/10 text-center">
                        <Users className="w-6 h-6 mx-auto mb-1 text-brand-primary" />
                        <span className="text-lg font-black">{referralCount}</span>
                        <p className="text-[10px] font-bold uppercase opacity-60">Referrals</p>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/10 relative z-10">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-bold opacity-80">Next Reward: 7-Day Holiday</span>
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-brand-primary to-emerald-400 transition-all duration-1000"
                            style={{ width: `${Math.min((referralCount / 10) * 100, 100)}%` }}
                        ></div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-2 opacity-50 text-right">
                        {Math.max(10 - referralCount, 0)} more to go
                    </p>
                </div>
            </div>

            {/* Referral Code */}
            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm mb-8">
                <h3 className="text-lg font-black text-slate-900 mb-2">Share & Earn</h3>
                <p className="text-sm text-slate-500 mb-6">Invite other guardians to Hazina. They get instant protection, and you get payment holidays!</p>

                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="flex-1 px-4 font-black tracking-widest text-lg text-slate-900">{referralCode}</span>
                    <button
                        onClick={copyToClipboard}
                        className={`p-4 rounded-xl transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'}`}
                    >
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                    <button className="p-4 bg-slate-900 text-white rounded-xl active:scale-95 transition-all">
                        <Share2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Rewards List */}
            <div className="space-y-4">
                <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest px-2">Reward Tiers</h3>

                <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-50 flex items-center gap-5">
                    <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                        <Gift className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-black text-slate-900">7 Day Payment Holiday</h4>
                        <p className="text-xs text-slate-500">Earned with 10 referrals</p>
                    </div>
                    <div className="text-right">
                        <span className="block text-lg font-black text-amber-600">100 Pts</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-50 flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-black text-slate-900">14 Day Payment Holiday</h4>
                        <p className="text-xs text-slate-500">Earned with 30 referrals</p>
                    </div>
                    <div className="text-right">
                        <span className="block text-lg font-black text-emerald-600">300 Pts</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Referrals;
