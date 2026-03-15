import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, ShieldCheck, Clock, FileText, Bot, TrendingUp, LogOut, 
    ShieldAlert, DollarSign, Users, UserPlus, CreditCard, RefreshCcw, Search 
} from 'lucide-react';
import { useAdminData } from '../hooks/useAdminData';

// Tab Components
import ClaimsTab from '../components/admin/ClaimsTab';
import UsersTab from '../components/admin/UsersTab';
import SifunaTab from '../components/admin/tabs/SifunaTab';
import PricingTab from '../components/admin/tabs/PricingTab';
import SystemTab from '../components/admin/tabs/SystemTab';
import RecruitmentTab from '../components/admin/tabs/RecruitmentTab';
import WithdrawalsTab from '../components/admin/tabs/WithdrawalsTab';
import TransactionsTab from '../components/admin/tabs/TransactionsTab';
import AnalyticsTab from '../components/admin/tabs/AnalyticsTab';
import MaintenanceTab from '../components/admin/tabs/MaintenanceTab';

// Utils
import { getSafeDate } from '../utils/dateUtils';

const AdminPanel = () => {
    const { profile, logout, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('claims');

    const adminData = useAdminData();
    const {
        claims, users, transactions, globalStats, kbItems, tiers, 
        agents, masterAgents, recruitmentLogs, recruitmentStats, 
        recruitmentConfig, withdrawals, forcedTotpList, referralSystemActive,
        loading, isDemoMode, setTiers, setRecruitmentConfig,
        handleAction, handleAddKb, handleDeleteKb, handleAutoGenerateKb,
        toggleAdmin, handleUpdateTiers, handleToggleReferral,
        handleSetupTotp, handleVerifyTotp, handleDisableTotp,
        totpStep, totpSetup, totpCode, isTotpLoading, setTotpStep, setTotpCode,
        actionLoading, isGenerating
    } = adminData;

    if (authLoading || loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    if (profile?.role !== 'admin') {
        navigate('/dashboard');
        return null;
    }

    const handleLogout = async () => {
        await logout();
        navigate('/admin/login');
    };

    const tabs = [
        { id: 'claims', label: 'Claims', icon: FileText },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'transactions', label: 'Billing', icon: DollarSign },
        { id: 'recruitment', label: 'Recruitment', icon: UserPlus },
        { id: 'withdrawals', label: 'Agent Payouts', icon: CreditCard },
        { id: 'analytics', label: 'Analytics', icon: TrendingUp },
        { id: 'sifuna', label: 'Sifuna Lab', icon: Bot },
        { id: 'pricing', label: 'Pricing', icon: RefreshCcw },
        { id: 'system', label: 'Security', icon: ShieldCheck },
        { id: 'maintenance', label: 'Maintenance', icon: RefreshCcw },
    ];

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center">
                            <ShieldCheck className="w-6 h-6 text-brand-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Hazina HQ</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Global Control Terminal</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex flex-col items-end">
                            <p className="text-xs font-black text-slate-900">{profile?.email || profile?.phoneNumber}</p>
                            <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest">Administrator</p>
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="p-3 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 pt-10">
                {/* Horizontal Tab Navigation */}
                <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-10 no-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                                ${activeTab === tab.id 
                                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10 active:scale-95' 
                                    : 'bg-white text-slate-400 hover:bg-slate-100'}`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-brand-primary' : 'text-slate-300'}`} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {activeTab === 'claims' && (
                        <ClaimsTab 
                            claims={claims} 
                            handleAction={handleAction} 
                            actionLoading={actionLoading} 
                        />
                    )}

                    {activeTab === 'users' && (
                        <UsersTab 
                            users={users} 
                            forcedTotpList={forcedTotpList} 
                            toggleAdmin={toggleAdmin} 
                            toast={toast} 
                        />
                    )}

                    {activeTab === 'transactions' && <TransactionsTab transactions={transactions} />}

                    {activeTab === 'analytics' && (
                        <AnalyticsTab 
                            users={users} 
                            last7Days={adminData.last7Days} 
                            maxVolume={adminData.maxVolume} 
                            globalStats={globalStats} 
                        />
                    )}

                    {activeTab === 'sifuna' && (
                        <SifunaTab 
                            kbItems={kbItems}
                            newKb={adminData.newKb}
                            setNewKb={adminData.setNewKb}
                            handleAddKb={handleAddKb}
                            handleDeleteKb={handleDeleteKb}
                            handleAutoGenerateKb={handleAutoGenerateKb}
                            isGenerating={isGenerating}
                            toast={toast}
                        />
                    )}

                    {activeTab === 'pricing' && (
                        <PricingTab 
                            tiers={tiers} 
                            handleUpdateTiers={handleUpdateTiers} 
                            setTiers={setTiers} 
                        />
                    )}

                    {activeTab === 'system' && (
                        <SystemTab 
                            profile={profile}
                            referralSystemActive={referralSystemActive}
                            handleToggleReferral={handleToggleReferral}
                            totpStep={totpStep}
                            setTotpStep={setTotpStep}
                            totpSetup={totpSetup}
                            totpCode={totpCode}
                            setTotpCode={setTotpCode}
                            isTotpLoading={isTotpLoading}
                            handleSetupTotp={handleSetupTotp}
                            handleVerifyTotp={handleVerifyTotp}
                            handleDisableTotp={handleDisableTotp}
                            handleLogout={handleLogout}
                            toast={toast}
                        />
                    )}

                    {activeTab === 'recruitment' && (
                        <RecruitmentTab 
                            recruitmentConfig={recruitmentConfig}
                            setRecruitmentConfig={setRecruitmentConfig}
                            recruitmentLogs={recruitmentLogs}
                            recruitmentStats={recruitmentStats}
                            masterAgents={masterAgents}
                            agents={agents}
                            navigate={navigate}
                            toast={toast}
                        />
                    )}

                    {activeTab === 'withdrawals' && <WithdrawalsTab withdrawals={withdrawals} />}

                    {activeTab === 'maintenance' && <MaintenanceTab />}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
