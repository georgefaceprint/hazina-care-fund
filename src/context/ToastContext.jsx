import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = {
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error'),
        info: (msg) => addToast(msg, 'info'),
        warning: (msg) => addToast(msg, 'warning'),
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-[320px]">
                <AnimatePresence>
                    {toasts.map((t) => (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, x: 50, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.2 } }}
                            className={`pointer-events-auto flex items-center gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-md ${t.type === 'success' ? 'bg-emerald-50/90 border-emerald-100 text-emerald-800' :
                                    t.type === 'error' ? 'bg-red-50/90 border-red-100 text-red-800' :
                                        t.type === 'warning' ? 'bg-amber-50/90 border-amber-100 text-amber-800' :
                                            'bg-slate-900/90 border-slate-700 text-white'
                                }`}
                        >
                            <div className="shrink-0">
                                {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                                {t.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                                {t.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500" />}
                                {t.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
                            </div>
                            <p className="text-sm font-bold flex-1 leading-tight">{t.message}</p>
                            <button
                                onClick={() => removeToast(t.id)}
                                className="p-1 hover:bg-black/5 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4 opacity-50" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
