import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SplashScreen = ({ onFinish }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (!onFinish) return; // Stay visible if used as a raw fallback (e.g. in Suspense)

        const timer = setTimeout(() => {
            setIsVisible(false);
            if (onFinish) setTimeout(onFinish, 1500); 
        }, 3000); 

        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-8 overflow-hidden"
                    style={{ height: '100dvh' }}
                >
                    {/* Abstract background subtle pattern */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary rounded-full blur-[120px]"></div>
                        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-primary rounded-full blur-[120px]"></div>
                    </div>

                    <div className="relative flex flex-col items-center">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                                duration: 1,
                                ease: [0.16, 1, 0.3, 1],
                                delay: 0.2
                            }}
                            className="w-48 h-48 mb-8"
                        >
                            <img
                                src="/logo.png"
                                alt="Hazina Logo"
                                className="w-full h-full object-contain drop-shadow-2xl"
                            />
                        </motion.div>

                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.6 }}
                            className="flex flex-col items-center"
                        >
                            <div className="h-1 w-12 bg-brand-primary rounded-full mb-4 animate-pulse"></div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                                Secure Community Care
                            </p>
                        </motion.div>
                    </div>

                    {/* Progress indicator at the bottom */}
                    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-32 h-0.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2.2, ease: "linear" }}
                            className="h-full bg-brand-primary"
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SplashScreen;
