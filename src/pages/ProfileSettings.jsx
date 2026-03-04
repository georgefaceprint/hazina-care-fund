import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

import { User, LogOut, Shield, Phone, CreditCard, ChevronRight, Bell, HelpCircle, Download, FileText } from 'lucide-react';
import { generateWorkflowPDF } from '../utils/pdfGenerator';


const ProfileSettings = () => {
    const { user, profile, logout } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [isLoggingOut, setIsLoggingOut] = useState(false);


    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Failed to log out:", error);
            toast.error("Error logging out.");
            setIsLoggingOut(false);

        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pt-8 px-6 pb-32 font-sans relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary rounded-full -mr-32 -mt-32 blur-3xl opacity-10 pointer-events-none"></div>

            <div className="relative z-10 mb-8 mt-2">
                <h1 className="text-3xl font-bold font-heading text-slate-900">Settings</h1>
                <p className="text-sm font-medium text-slate-500 mt-1">Manage your account & preferences</p>
            </div>

            <div className="space-y-6 relative z-10">
                {/* Profile Card */}
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-center gap-5">
                    <div className="w-16 h-16 bg-gradient-to-br from-brand-secondary to-brand-primary rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-inner">
                        {profile?.national_id ? profile.national_id.substring(0, 2) : 'HZ'}
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 text-lg">Guardian Account</h2>
                        <div className="flex items-center gap-1.5 text-slate-500 mt-1">
                            <Phone className="w-4 h-4" />
                            <span className="text-sm font-mono tracking-tight">{user?.phoneNumber || 'No phone linked'}</span>
                        </div>
                    </div>
                </div>

                {/* Account Settings */}
                <div className="space-y-3">
                    <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 ml-2">Account</h3>
                    <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 divide-y divide-slate-50">
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-brand-50 text-brand-primary rounded-xl">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Personal Details</p>
                                    <p className="text-xs text-slate-500">National ID: {profile?.national_id}</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Subscription Tier</p>
                                    <p className="text-xs text-slate-500">Current: {profile?.active_tier?.toUpperCase() || 'BRONZE'}</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Payment Methods</p>
                                    <p className="text-xs text-slate-500">M-Pesa numbers</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                    </div>
                </div>

                {/* Preferences */}
                <div className="space-y-3">
                    <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 ml-2">Preferences</h3>
                    <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 divide-y divide-slate-50">
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-indigo-50 text-indigo-500 rounded-xl">
                                    <Bell className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Notifications</p>
                                    <p className="text-xs text-slate-500">SMS & push alerts</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100" onClick={generateWorkflowPDF}>
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-brand-50 text-brand-primary rounded-xl">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">System Workflows</p>
                                    <p className="text-xs text-slate-500">Download PDF documentation</p>
                                </div>
                            </div>
                            <Download className="w-5 h-5 text-slate-300" />
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="pt-6">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 font-bold rounded-2xl border border-red-100 hover:bg-red-100 active:scale-95 transition-all"
                    >
                        {isLoggingOut ? (
                            <span className="flex items-center gap-2">Logging out...</span>
                        ) : (
                            <>
                                <LogOut className="w-5 h-5" />
                                Log Out
                            </>
                        )}
                    </button>

                    <p className="text-center mt-6 mb-2 text-xs font-bold text-slate-400">
                        Hazina Care v1.0.0
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ProfileSettings;
