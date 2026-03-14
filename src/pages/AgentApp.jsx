import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, orderBy, limit, Timestamp, doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Users, TrendingUp, DollarSign, QrCode, Share2, Clipboard, ChevronRight, Award, Zap, Activity, ArrowUpRight, Wallet, User, Smartphone, XCircle, Camera, CheckCircle2, ShieldCheck, Loader2, RotateCcw } from 'lucide-react';
import { functions, db } from '../services/firebase';
import { useToast } from '../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadProfilePhoto } from '../services/storage';
import { formatKenyanPhone } from '../utils/phoneUtils';

const AgentApp = () => {
    const { profile } = useAuth();
    const toast = useToast();
    const [stats, setStats] = useState({
        today: 0,
        yesterday: 0,
        total: 0,
        earnings: 0,
        walletBalance: 0
    });
    const [recentLogs, setRecentLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);
    const [withdrawPhone, setWithdrawPhone] = useState(profile?.phoneNumber || '');

    // Registration Form State
    const [regForm, setRegForm] = useState({
        firstName: '',
        surname: '',
        idNumber: '',
        phoneNumber: '',
        tier: 'bronze',
        photo: null
    });
    const [regLoading, setRegLoading] = useState(false);
    const [regStep, setRegStep] = useState(1); // 1: Personal, 2: Phone, 3: Photo, 4: Review
    const [otpStep, setOtpStep] = useState('phone'); // 'phone' | 'otp' | 'verified'
    const [verificationCode, setVerificationCode] = useState('');
    const [showRegModal, setShowRegModal] = useState(false);

    const agentCode = profile?.agent_code || '';
    const agentPhone = profile?.phoneNumber || '';
    const agentUid = profile?.id || '';
    const basePhoneRaw = agentPhone.replace('+', '');
    const localPhone = basePhoneRaw.startsWith('254') ? '0' + basePhoneRaw.slice(3) : agentPhone;
    const internationalPhone = agentPhone.startsWith('0') ? '+254' + agentPhone.slice(1) : agentPhone;
    
    // De-duplicate and filter empty strings
    const allAgentIds = [...new Set([agentCode, agentPhone, localPhone, internationalPhone, agentUid].filter(id => id && id.length > 0))];
    const displayCode = agentCode || agentPhone || agentUid;
    const registrationLink = `${window.location.origin}/r/${displayCode}`;

    const fetchStats = async () => {
        if (allAgentIds.length === 0) return;

        try {
            console.log("🔍 [fetchStats] Querying logs for agent ids:", allAgentIds);
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfYesterday = new Date(startOfToday);
            startOfYesterday.setDate(startOfYesterday.getDate() - 1);

            const logsRef = collection(db, 'recruitment_logs');

            // 1. Fetch recruitment counts from logs
            const todayQuery = query(logsRef, where('agentId', 'in', allAgentIds), where('timestamp', '>=', Timestamp.fromDate(startOfToday)));
            const yesterdayQuery = query(logsRef, where('agentId', 'in', allAgentIds), where('timestamp', '>=', Timestamp.fromDate(startOfYesterday)), where('timestamp', '<', Timestamp.fromDate(startOfToday)));

            const [todaySnap, yesterdaySnap] = await Promise.all([getDocs(todayQuery), getDocs(yesterdayQuery)]);

            // 2. Fetch Recent Logs
            const recentQuery = query(logsRef, where('agentId', 'in', allAgentIds), orderBy('timestamp', 'desc'), limit(15));
            const recentSnap = await getDocs(recentQuery);
            console.log(`✅ [fetchStats] Found ${recentSnap.size} recent logs.`);
            setRecentLogs(recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            setStats({
                today: todaySnap.size || 0,
                yesterday: yesterdaySnap.size || 0,
                total: profile?.totalSignups || 0,
                earnings: profile?.totalEarnings || 0,
                walletBalance: profile?.walletBalance || 0
            });
        } catch (error) {
            console.error("Error fetching agent stats:", error);
            toast.error("Analytics Error: " + (error.message || "Failed to sync recruitment logs."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [agentCode, profile?.totalSignups, profile?.walletBalance]);

    useEffect(() => {
        if (profile?.phoneNumber && !withdrawPhone) {
            setWithdrawPhone(profile.phoneNumber);
        }
    }, [profile?.phoneNumber]);

    const handleWithdraw = async (e) => {
        e.preventDefault();
        if (!withdrawAmount || Number(withdrawAmount) < 50) {
            toast.error("Minimum withdrawal is KSh 50");
            return;
        }

        setWithdrawing(true);
        try {
            const initiateWithdrawal = httpsCallable(functions, 'initiateAgentWithdrawal');
            const result = await initiateWithdrawal({
                amount: Number(withdrawAmount),
                phoneNumber: withdrawPhone
            });

            if (result.data.success) {
                toast.success("Withdrawal initiated! Funds will be sent shortly.");
                setShowWithdrawModal(false);
                setWithdrawAmount('');
                // Refresh stats
                fetchStats();
            }
        } catch (error) {
            console.error("Withdrawal error:", error);
            toast.error(error.message || "Failed to initiate withdrawal.");
        } finally {
            setWithdrawing(false);
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(registrationLink);
        toast.success("Link copied to clipboard!");
    };

    const handleSendOtp = async () => {
        if (!regForm.phoneNumber) return;
        setRegLoading(true);
        try {
            const formattedPhone = formatKenyanPhone(regForm.phoneNumber);
            const sendOtp = httpsCallable(functions, 'sendOtp');
            await sendOtp({ phoneNumber: formattedPhone });
            setOtpStep('otp');
            toast.success("OTP sent to user.");
        } catch (error) {
            toast.error(error.message || "Failed to send OTP");
        } finally {
            setRegLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!verificationCode) return;
        setRegLoading(true);
        try {
            const formattedPhone = formatKenyanPhone(regForm.phoneNumber);
            const checkOtp = httpsCallable(functions, 'checkOtp');
            const result = await checkOtp({ phoneNumber: formattedPhone, validationCode: verificationCode });
            if (result.data.valid) {
                setOtpStep('verified');
                toast.success("Phone verified successfully!");
            }
        } catch (error) {
            toast.error(error.message || "Invalid OTP");
        } finally {
            setRegLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (otpStep !== 'verified') {
            toast.error("Please verify the phone number first.");
            return;
        }

        if (!regForm.photo) {
            toast.error("Please capture the member's photo.");
            return;
        }

        setRegLoading(true);
        try {
            let photoUrl = null;

            // 1. Upload Photo
            toast.info("Uploading identity capture...");
            const tempId = regForm.phoneNumber.replace(/\D/g, '');
            photoUrl = await uploadProfilePhoto(tempId, regForm.photo, 'agent_captured');

            // 2. Register Member
            toast.info("Registering member and triggering STK Push...");
            const registerFunc = httpsCallable(functions, 'registerUserByAgent');
            const result = await registerFunc({
                ...regForm,
                photoUrl,
                // Pass formatted phone to match backend storage
                phoneNumber: formatKenyanPhone(regForm.phoneNumber)
            });

            if (result.data.success) {
                toast.success("Registration Successful! STK Push Sent to member.");
                handleResetReg();
                setShowRegModal(false);
                // Stats will auto-refresh via useEffect dependency on profile.totalSignups
                if (fetchStats) fetchStats();
            }
        } catch (error) {
            console.error("Registration error details:", error);
            toast.error(error.message || "Registration failed.");
        } finally {
            setRegLoading(false);
        }
    };
    const handleResetReg = () => {
        setRegForm({ firstName: '', surname: '', idNumber: '', phoneNumber: '', tier: 'bronze', photo: null });
        setOtpStep('phone');
        setVerificationCode('');
        setRegStep(1);
        toast.info("Registration form reset.");
    };

    const nextStep = () => {
        if (regStep === 1) {
            if (!regForm.firstName || !regForm.surname || !regForm.idNumber) {
                toast.error("Please fill all personal details.");
                return;
            }
        }
        if (regStep === 2) {
            if (otpStep !== 'verified') {
                toast.error("Please verify phone number first.");
                return;
            }
        }
        if (regStep === 3) {
            if (!regForm.photo) {
                toast.error("Please capture member identity photo.");
                return;
            }
        }
        setRegStep(prev => prev + 1);
    };

    const prevStep = () => setRegStep(prev => prev - 1);

    return (
        <div className="space-y-10 max-w-5xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Zap className="w-8 h-8 text-brand-primary" />
                        Agent Performance Console
                    </h1>
                    <p className="text-slate-500 font-medium">Welcome, {profile?.fullName}</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <span className="text-xs font-black uppercase text-slate-700">Verified Agent Account</span>
                </div>
            </header>

            {/* Performance Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-brand-primary/20 transition-all duration-700"></div>

                    <div className="relative z-10 flex flex-col h-full">
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-primary mb-4 italic">Earnings Statement</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold text-slate-500">KSh</span>
                            <h2 className="text-6xl font-black tracking-tight">{stats.walletBalance.toLocaleString()}</h2>
                        </div>

                        <div className="mt-auto pt-10 flex justify-between items-end border-t border-white/5">
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Conversions</p>
                                    <p className="text-3xl font-black">{stats.total}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Commission Rate</p>
                                    <p className="text-2xl font-black text-brand-primary">15.00 <span className="text-xs font-bold text-slate-500">/user</span></p>
                                </div>
                            </div>

                            <button
                                onClick={() => stats.walletBalance >= 2500 && setShowWithdrawModal(true)}
                                disabled={stats.walletBalance < 2500}
                                className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center gap-2 ${stats.walletBalance >= 2500
                                        ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:scale-105'
                                        : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                                    }`}
                            >
                                <ArrowUpRight className="w-4 h-4" />
                                {stats.walletBalance >= 2500 ? 'Withdraw' : 'Locked'}
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Daily Status */}
                <div className="space-y-4">
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col justify-between h-1/2">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Activity</p>
                            <TrendingUp className="w-5 h-5 text-brand-primary" />
                        </div>
                        <h2 className="text-4xl font-black text-slate-900">{stats.today}</h2>
                    </div>
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col justify-between h-1/2">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yesterday</p>
                            <Activity className="w-5 h-5 text-slate-300" />
                        </div>
                        <h2 className="text-4xl font-black text-slate-700">{stats.yesterday}</h2>
                    </div>
                </div>
            </div>

            {/* Recruitment Tools */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                    <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                        <QrCode className="w-6 h-6 text-brand-primary" />
                        Recruitment Tools
                    </h3>

                    <div className="bg-slate-50 rounded-2xl p-6 mb-6 flex items-center justify-between group">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unique Agent Identity</p>
                            <p className="text-2xl font-black text-slate-900 tracking-tighter group-hover:text-brand-primary transition-colors">{agentCode}</p>
                        </div>
                        <button
                            onClick={copyLink}
                            className="p-4 bg-white text-slate-400 rounded-xl shadow-sm border border-slate-100 hover:text-brand-primary hover:border-brand-primary/20 transition-all active:scale-90"
                        >
                            <Clipboard className="w-6 h-6" />
                        </button>
                    </div>

                    <button
                        onClick={() => setShowRegModal(true)}
                        className="w-full bg-brand-primary text-white rounded-2xl py-5 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all active:scale-95 shadow-xl shadow-brand-primary/20 mb-4"
                    >
                        <User className="w-5 h-5" />
                        Register New Member
                    </button>

                    <button
                        onClick={copyLink}
                        className="w-full bg-slate-900 text-white rounded-2xl py-5 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-900/10"
                    >
                        <Share2 className="w-5 h-5" />
                        Share Invitation Link
                    </button>
                </div>

                {/* Progress Log */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-slate-900">Recent Conversions</h3>
                        <ChevronRight className="w-6 h-6 text-slate-300" />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {loading ? (
                            <p className="text-slate-400 italic text-center py-10">Syncing activity log...</p>
                        ) : recentLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 opacity-30">
                                <Users className="w-12 h-12 text-slate-300 mb-4" />
                                <p className="text-slate-400 font-bold">No signups recorded.</p>
                            </div>
                        ) : (
                            recentLogs.map(log => (
                                <div key={log.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-slate-100 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-xl shadow-sm">
                                            <User className="w-5 h-5 text-brand-primary" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm">{log.userName || 'New Member'}</p>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                                                {log.tier ? log.tier.replace('_', ' ') : 'Processing...'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-emerald-600 text-sm">+ KSh {log.commissionEarned}</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                            {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleDateString() : 'Just now'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
            {/* Withdrawal Modal */}
            {/* Withdrawal Modal */}
            {showWithdrawModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
                        onClick={() => !withdrawing && setShowWithdrawModal(false)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative z-10"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-900">Withdraw Earnings</h3>
                            <button
                                onClick={() => setShowWithdrawModal(false)}
                                className="text-slate-300 hover:text-slate-900 transition-colors"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleWithdraw} className="space-y-6">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                                <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">Available Balance</p>
                                <p className="text-4xl font-black text-slate-900 text-brand-primary">KSh {stats.walletBalance.toLocaleString()}</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 ml-1">Withdraw Amount (KSh)</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">KSh</div>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-100 border-none rounded-2xl pl-14 pr-4 py-4 focus:ring-2 focus:ring-brand-primary transition-all font-black text-lg"
                                        placeholder="Min 50"
                                        value={withdrawAmount}
                                        onChange={(e) => setWithdrawAmount(e.target.value)}
                                        required
                                        min="50"
                                        max={stats.walletBalance}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 ml-1">M-Pesa Number</label>
                                <div className="relative">
                                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input
                                        type="tel"
                                        className="w-full bg-slate-100 border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-brand-primary transition-all font-bold"
                                        placeholder="07XX XXX XXX"
                                        value={withdrawPhone}
                                        onChange={(e) => setWithdrawPhone(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={withdrawing || !withdrawAmount || Number(withdrawAmount) > stats.walletBalance}
                                className="w-full bg-slate-900 text-white rounded-2xl py-5 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-900/10 disabled:opacity-50"
                            >
                                {withdrawing ? (
                                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>Initiate M-Pesa Transfer <ArrowUpRight className="w-5 h-5" /></>
                                )}
                            </button>

                            <p className="text-[10px] text-center text-slate-400 font-medium italic">
                                * This will be sent as a B2C transfer to your M-Pesa number.
                            </p>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Registration Modal */}
            {showRegModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
                        onClick={() => !regLoading && setShowRegModal(false)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <h3 className="text-2xl font-black text-slate-900">
                                    Member Enrollment
                                </h3>
                                <div className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full">
                                    <div className={`w-2 h-2 rounded-full ${regStep >= 1 ? 'bg-brand-primary' : 'bg-slate-300'}`} />
                                    <div className={`w-2 h-2 rounded-full ${regStep >= 2 ? 'bg-brand-primary' : 'bg-slate-300'}`} />
                                    <div className={`w-2 h-2 rounded-full ${regStep >= 3 ? 'bg-brand-primary' : 'bg-slate-300'}`} />
                                    <div className={`w-2 h-2 rounded-full ${regStep >= 4 ? 'bg-brand-primary' : 'bg-slate-300'}`} />
                                    <span className="text-[10px] font-black uppercase text-slate-500 ml-1">Step {regStep}/4</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleResetReg}
                                    className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-xl"
                                    title="Start Afresh"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => !regLoading && setShowRegModal(false)}
                                    className="text-slate-300 hover:text-slate-900 transition-colors"
                                >
                                    <XCircle className="w-7 h-7" />
                                </button>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 h-2 rounded-full mb-8 overflow-hidden">
                            <motion.div
                                className="h-full bg-brand-primary"
                                initial={{ width: 0 }}
                                animate={{ width: `${(regStep / 4) * 100}%` }}
                            />
                        </div>

                        <form onSubmit={handleRegister} className="space-y-8">
                            <AnimatePresence mode="wait">
                                {regStep === 1 && (
                                    <motion.div
                                        key="step1"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                                    >
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">First Name</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-primary transition-all font-bold uppercase"
                                                    placeholder="EX: JOHN"
                                                    value={regForm.firstName}
                                                    onChange={(e) => setRegForm({ ...regForm, firstName: e.target.value.toUpperCase() })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Surname / Family Name</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-primary transition-all font-bold uppercase"
                                                    placeholder="EX: DOE"
                                                    value={regForm.surname}
                                                    onChange={(e) => setRegForm({ ...regForm, surname: e.target.value.toUpperCase() })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">National ID Number</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-primary transition-all font-bold"
                                                    placeholder="12345678"
                                                    value={regForm.idNumber}
                                                    onChange={(e) => setRegForm({ ...regForm, idNumber: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Shield Protection Tier</label>
                                                <select
                                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-primary transition-all font-bold"
                                                    value={regForm.tier}
                                                    onChange={(e) => setRegForm({ ...regForm, tier: e.target.value })}
                                                >
                                                    <option value="bronze">Bronze (KSh 50/day)</option>
                                                    <option value="silver">Silver (KSh 147/day)</option>
                                                    <option value="gold">Gold (KSh 229/day)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {regStep === 2 && (
                                    <motion.div
                                        key="step2"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="max-w-md mx-auto w-full space-y-6"
                                    >
                                        <div className="space-y-4">
                                            <label className="block text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Security Verification</label>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <input
                                                        type="tel"
                                                        className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-4 focus:ring-2 focus:ring-brand-primary transition-all font-bold disabled:opacity-50"
                                                        placeholder="07XX XXX XXX"
                                                        value={regForm.phoneNumber}
                                                        onChange={(e) => setRegForm({ ...regForm, phoneNumber: e.target.value })}
                                                        disabled={otpStep !== 'phone'}
                                                        required
                                                    />
                                                </div>
                                                {otpStep === 'phone' && (
                                                    <button
                                                        type="button"
                                                        onClick={handleSendOtp}
                                                        disabled={regLoading || regForm.phoneNumber.length < 10}
                                                        className="bg-slate-900 text-white px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-primary transition-all disabled:opacity-50"
                                                    >
                                                        Send Code
                                                    </button>
                                                )}
                                            </div>

                                            <AnimatePresence>
                                                {otpStep === 'otp' && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        className="space-y-3"
                                                    >
                                                        <input
                                                            type="text"
                                                            maxLength="6"
                                                            className="w-full bg-emerald-50 border-emerald-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-primary transition-all font-black text-2xl tracking-[0.5em] text-center"
                                                            placeholder="••••••"
                                                            value={verificationCode}
                                                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleVerifyOtp}
                                                            disabled={regLoading || verificationCode.length !== 6}
                                                            className="w-full bg-brand-primary text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            {regLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify Identity"}
                                                        </button>
                                                    </motion.div>
                                                )}
                                                {otpStep === 'verified' && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm"
                                                    >
                                                        <CheckCircle2 className="w-5 h-5" />
                                                        Identity Confirmed
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </motion.div>
                                )}

                                {regStep === 3 && (
                                    <motion.div
                                        key="step3"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="max-w-md mx-auto w-full"
                                    >
                                        <label className="block text-center text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Member Identity (Portrait)</label>
                                        <div className="relative aspect-[3/4] max-w-[280px] mx-auto bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden hover:border-brand-primary transition-colors group shadow-inner">
                                            {regForm.photo ? (
                                                <>
                                                    <img
                                                        src={URL.createObjectURL(regForm.photo)}
                                                        alt="Captured"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <p className="text-white text-[10px] font-black uppercase tracking-widest bg-slate-900/50 px-4 py-2 rounded-full backdrop-blur-sm">Tap to Retake</p>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center p-6 text-center">
                                                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                        <Camera className="w-8 h-8 text-slate-300 group-hover:text-brand-primary transition-colors" />
                                                    </div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight leading-relaxed">
                                                        Position ID or Face <br /> within Vertical Frame
                                                    </p>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="user"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => e.target.files[0] && setRegForm({ ...regForm, photo: e.target.files[0] })}
                                                required
                                            />
                                        </div>
                                    </motion.div>
                                )}

                                {regStep === 4 && (
                                    <motion.div
                                        key="step4"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-6"
                                    >
                                        <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-200 pb-2">Enrollment Summary</h4>

                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase">Full Name</p>
                                                        <p className="font-bold text-slate-900">{regForm.firstName} {regForm.surname}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase">Phone Number</p>
                                                        <p className="font-bold text-slate-900">{regForm.phoneNumber}</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase">Selected Tier</p>
                                                        <p className="font-black text-brand-primary uppercase">{regForm.tier}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase">ID Number</p>
                                                        <p className="font-bold text-slate-900">{regForm.idNumber}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-slate-400">Initial Payment</p>
                                                    <p className="text-2xl font-black text-slate-900">KSh {regForm.tier === 'bronze' ? 150 : regForm.tier === 'silver' ? 247 : 329}</p>
                                                </div>
                                                <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                    <span className="text-[10px] font-black text-emerald-700 uppercase">Validated</span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="pt-6 border-t border-slate-50 flex gap-4">
                                {regStep > 1 && (
                                    <button
                                        type="button"
                                        onClick={prevStep}
                                        className="px-8 py-5 bg-slate-100 text-slate-600 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                                    >
                                        Back
                                    </button>
                                )}

                                {regStep < 4 ? (
                                    <button
                                        type="button"
                                        onClick={nextStep}
                                        className="flex-1 py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-brand-primary transition-all active:scale-95 shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
                                    >
                                        Next Phase <ChevronRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={regLoading}
                                        className="flex-1 bg-brand-primary text-white rounded-3xl py-5 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all active:scale-95 shadow-2xl shadow-brand-primary/20 disabled:opacity-50"
                                    >
                                        {regLoading ? (
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                        ) : (
                                            <>Confirm & Trigger Payment <ArrowUpRight className="w-6 h-6" /></>
                                        )}
                                    </button>
                                )}
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default AgentApp;
