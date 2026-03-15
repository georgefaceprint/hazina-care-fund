import React from 'react';
import { RefreshCcw, Zap, Database } from 'lucide-react';
import { db } from '../../services/firebase';

const MaintenanceTab = () => {
    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/10 rounded-full blur-3xl -mr-64 -mt-64"></div>
                <div className="relative z-10">
                    <h3 className="text-3xl font-black mb-4 flex items-center gap-3">
                        <RefreshCcw className="w-10 h-10 text-brand-primary animate-spin-slow" />
                        System Maintenance
                    </h3>
                    <p className="text-slate-400 text-lg mb-12 max-w-2xl leading-relaxed">
                        Force-clear cached application data and synchronize state across all client devices. 
                        Use this if you notice UI inconsistencies or if a major update was recently deployed.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/10 hover:bg-white/10 transition-all cursor-pointer group"
                            onClick={async () => {
                                if (window.confirm("This will force-clear your local browser cache and reload the application. Continue?")) {
                                    localStorage.clear();
                                    sessionStorage.clear();
                                    try {
                                        await db.terminate();
                                        await db.clearPersistence();
                                    } catch (e) {}
                                    window.location.reload(true);
                                }
                            }}
                        >
                            <div className="w-16 h-16 bg-brand-primary rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-brand-primary/20 group-hover:scale-110 transition-transform">
                                <Zap className="w-8 h-8 text-white" />
                            </div>
                            <h4 className="text-xl font-black mb-2">Clear Application Cache</h4>
                            <p className="text-sm text-slate-500 font-medium">Forcibly reloads all assets and clears local storage. Solves 90% of UI bugs.</p>
                        </div>

                        <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/10 opacity-50 cursor-not-allowed">
                            <div className="w-16 h-16 bg-slate-700 rounded-2xl flex items-center justify-center mb-6">
                                <Database className="w-8 h-8 text-white/40" />
                            </div>
                            <h4 className="text-xl font-black mb-2 text-white/40">Sync Global State</h4>
                            <p className="text-sm text-slate-600 font-medium">Broadcasts a refresh signal to all active sessions via SasaPay webhooks. (Coming Soon)</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaintenanceTab;
