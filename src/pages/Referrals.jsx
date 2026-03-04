import React, { useState } from 'react';
import { Gift, Share2, Copy, Check, Users, ShieldCheck, Zap, ArrowLeft, TrendingUp, Info } from 'lucide-react';
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

    const handleShare = async () => {
        const shareData = {
            title: 'Join Hazina Protection',
            text: `Join me on Hazina and get instant crisis protection for your family! Use my code: ${referralCode}`,
            url: window.location.origin,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                copyToClipboard();
            }
        } catch (err) {
            console.error("Error sharing:", err);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pt-8 px-6 pb-32">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-95 transition-all"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-700" />
                </button>
                <h1 className="text-2xl font-black font-heading text-slate-900">{t('referrals') || "Hazina Referrals"}</h1>
            </div>

            {/* Stats Card */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white mb-8 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary rounded-full blur-[80px] opacity-20 -mr-24 -mt-24 animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500 rounded-full blur-[60px] opacity-10 -ml-16 -mb-16"></div>

                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest opacity-60 mb-1">Your Hazina Points</h4>
                        <div className="flex items-center gap-2">
                            <Zap className="w-8 h-8 text-amber-400 fill-amber-400 animate-bounce" style={{ animationDuration: '3s' }} />
                            <span className="text-5xl font-black">{hazinaPoints}</span>
                        </div>
                    </div>
                    <div className="bg-white/10 p-4 rounded-3xl border border-white/10 text-center backdrop-blur-md">
                        <Users className="w-6 h-6 mx-auto mb-1 text-brand-primary" />
                        <span className="text-lg font-black">{referralCount}</span>
                        <p className="text-[10px] font-bold uppercase opacity-60">Referrals</p>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/10 relative z-10">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-bold opacity-80">Next Reward: 7-Day Holiday</span>
                        <div className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase">On Track</span>
                        </div>
                    </div>
                    <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/5">
                        <div
                            className="h-full bg-gradient-to-r from-brand-primary via-brand-primary to-emerald-400 rounded-full transition-all duration-1000 relative overflow-hidden"
                            style={{ width: `${Math.min((referralCount / 10) * 100, 100)}%` }}
                        >
                            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-shimmer opacity-30"></div>
                        </div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-2 opacity-50 text-right">
                        {Math.max(10 - referralCount, 0)} more to go
                    </p>
                </div>
            </div>

            {/* Referral Code */}
            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm mb-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-all duration-700"></div>

                <h3 className="text-lg font-black text-slate-900 mb-2 relative z-10">Share & Earn</h3>
                <p className="text-sm text-slate-500 mb-6 relative z-10">Invite other guardians to Hazina. They get instant protection, and you get payment holidays!</p>

                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-100 relative z-10">
                    <span className="flex-1 px-4 font-black tracking-widest text-lg text-slate-900 truncate">{referralCode}</span>
                    <button
                        onClick={copyToClipboard}
                        className={`p-4 rounded-xl transition-all active:scale-95 ${copied ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'}`}
                    >
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={handleShare}
                        className="p-4 bg-slate-900 text-white rounded-xl active:scale-95 transition-all hover:bg-slate-800"
                    >
                        <Share2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Rewards List */}
            <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest">Reward Tiers</h3>
                    <Info className="w-4 h-4 text-slate-300" />
                </div>

                <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 flex items-center gap-5 hover:border-brand-primary/30 transition-all cursor-pointer group shadow-sm">
                    <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-[1.5rem] flex items-center justify-center group-hover:rotate-12 transition-transform shadow-inner">
                        <Gift className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-black text-slate-900">7 Day Payment Holiday</h4>
                        <p className="text-xs text-slate-500">Milestone: 10 referrals</p>
                    </div>
                    <div className="text-right">
                        <span className="block text-lg font-black text-amber-600">100 Pts</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 flex items-center gap-5 hover:border-emerald-500/30 transition-all cursor-pointer group shadow-sm">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-[1.5rem] flex items-center justify-center group-hover:rotate-12 transition-transform shadow-inner">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-black text-slate-900">14 Day Payment Holiday</h4>
                        <p className="text-xs text-slate-500">Milestone: 30 referrals</p>
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
