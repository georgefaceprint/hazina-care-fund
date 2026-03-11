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
        // 1. Check if already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;

        if (isStandalone) {
            setIsInstalled(true);
            return;
        }

        // 2. Check dismissal status
        const checkDismissal = () => {
            const lastDismiss = localStorage.getItem('hazina_install_dismissed');
            if (!lastDismiss) return false;
            const expiration = 6 * 60 * 60 * 1000; // 6 hours
            return (Date.now() - parseInt(lastDismiss)) < expiration;
        };

        // 3. iOS Detection
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(isIosDevice);

        // 4. Handle stale prompt from main.jsx
        if (window.deferredPrompt) {
            setDeferredPrompt(window.deferredPrompt);
            if (!checkDismissal()) {
                setShowBanner(true);
            }
        }

        // 5. Catch beforeinstallprompt for Android/Chrome
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            window.deferredPrompt = e;
            if (!checkDismissal()) {
                setShowBanner(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        // 6. Fallback delay (for iOS instructions or manual install help)
        const timer = setTimeout(() => {
            if (!isStandalone && !checkDismissal()) {
                setShowBanner(true);
            }
        }, 12000); // Wait 12s before bothering the user

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            clearTimeout(timer);
        };
    }, []);

    const triggerInstall = async () => {
        if (!deferredPrompt) {
            if (isIOS) {
                // For iOS, the banner already provides text instructions
                alert("To Install: Tap the 'Share' icon at the bottom of Safari, scroll down, and select 'Add to Home Screen'.");
                return;
            }
            alert("To Install: Open your browser menu and select 'Install App' or 'Add to Home Screen'.");
            return;
        }

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`📍 PWA: User choice: ${outcome}`);
            
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                window.deferredPrompt = null;
                setShowBanner(false);
                setIsInstalled(true);
            }
        } catch (err) {
            console.error("📍 PWA: Install prompt failed:", err);
            setShowBanner(false);
        }
    };

    const dismiss = () => {
        localStorage.setItem('hazina_install_dismissed', Date.now().toString());
        setShowBanner(false);
    };

    return (
        <InstallContext.Provider value={{ triggerInstall, isIOS, isInstalled, canInstall: !!deferredPrompt || isIOS }}>
            {children}
            {showBanner && !isInstalled && (
                <InstallBanner isIOS={isIOS} onInstall={triggerInstall} onDismiss={dismiss} />
            )}
        </InstallContext.Provider>
    );
};

const InstallBanner = ({ isIOS, onInstall, onDismiss }) => (
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
                        className="bg-brand-primary hover:bg-emerald-500 text-white text-[11px] font-black px-4 py-2 rounded-xl transition-colors active:scale-95 shadow-lg shadow-brand-primary/20">
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
