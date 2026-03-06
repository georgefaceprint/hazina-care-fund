import React, { useState, useEffect, createContext, useContext } from 'react';

// Context so other components (like ProfileSettings) can trigger install
const InstallContext = createContext(null);
export const useInstall = () => useContext(InstallContext);

export const InstallProvider = ({ children }) => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        const standalone = window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;

        if (standalone) {
            setIsInstalled(true);
            return;
        }

        // 1. Check if window already has a prompt from main.jsx
        if (window.deferredPrompt) {
            console.log("📍 PWA: Found stale deferredPrompt on window");
            setDeferredPrompt(window.deferredPrompt);
            setShowBanner(true);
        }

        // 2. Catch beforeinstallprompt for Android/Chrome
        const handler = (e) => {
            console.log("📍 PWA: beforeinstallprompt event fired!");
            e.preventDefault();
            setDeferredPrompt(e);
            window.deferredPrompt = e; // Sync back to window just in case
            setShowBanner(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Fallback: Show banner after a delay even if no prompt (for instructions)
        const timer = setTimeout(() => {
            if (!isInstalled) {
                setShowBanner(true);
            }
        }, 5000);

        // iOS detection for specific instructions
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIosDevice) {
            setIsIOS(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            clearTimeout(timer);
        };
    }, [isInstalled]);

    const triggerInstall = async () => {
        if (!deferredPrompt) {
            if (isIOS) {
                // iOS doesn't use the prompt, they use the Share menu
                return;
            }
            alert("To install: Tap the three dots (menu) in your browser and select 'Add to Home Screen' or 'Install App'.");
            return;
        }

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                setShowBanner(false);
                setIsInstalled(true);
            }
        } catch (err) {
            console.error("📍 PWA: Install prompt failed:", err);
            alert("Please use your browser's 'Add to Home Screen' menu option to install.");
        }
    };

    const dismiss = () => {
        localStorage.setItem('hazina_install_dismissed', Date.now().toString());
        setShowBanner(false);
    };

    return (
        <InstallContext.Provider value={{ triggerInstall, isIOS, isInstalled, canInstall: true, isAndroid: !isIOS && !isInstalled }}>
            {children}
            {showBanner && !isInstalled && (
                <InstallBanner isIOS={isIOS} onInstall={triggerInstall} onDismiss={dismiss} canInstall={true} />
            )}
        </InstallContext.Provider>
    );
};

const InstallBanner = ({ isIOS, onInstall, onDismiss, canInstall }) => (
    <div className="fixed bottom-20 left-4 right-4 z-[200] animate-slide-up max-w-md mx-auto">
        <div className="bg-slate-900 text-white rounded-[2rem] p-5 shadow-2xl shadow-slate-900/40 border border-white/10 flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-primary rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-primary/30">
                <img src="/pwa-192x192.png" alt="Hazina" className="w-12 h-12 rounded-xl object-cover"
                    onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerText = 'H'; }} />
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="font-black text-sm text-white">Install Hazina App</h4>
                {isIOS ? (
                    <p className="text-[11px] text-white/60 mt-0.5 leading-snug">
                        Tap <strong className="text-white">Share ↑</strong> then <strong className="text-white">"Add to Home Screen"</strong>
                    </p>
                ) : (
                    <p className="text-[11px] text-white/60 mt-0.5 leading-snug">
                        Get instant access right from your home screen
                    </p>
                )}
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
                {!isIOS && (
                    <button onClick={onInstall}
                        className={`text-white text-[11px] font-black px-4 py-2 rounded-xl transition-colors active:scale-95 ${canInstall ? 'bg-brand-primary hover:bg-emerald-500' : 'bg-slate-700 opacity-50 cursor-not-allowed'}`}>
                        Install
                    </button>
                )}
                <button onClick={onDismiss}
                    className="text-white/40 hover:text-white/70 text-[11px] font-bold text-center transition-colors">
                    Later
                </button>
            </div>
        </div>
    </div>
);

export default InstallProvider;
