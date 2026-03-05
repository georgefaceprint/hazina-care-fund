import React, { useState, useEffect } from 'react';

const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Basic iOS detection
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        // Check if the app is already in standalone mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone || false;

        if (isIosDevice && !isStandalone) {
            setIsIOS(true);
            setShowPrompt(true);
        }

        // Android/Chrome beforeinstallprompt event
        const handleBeforeInstallPrompt = (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI notify the user they can install the PWA
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            // Show the install prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
                setDeferredPrompt(null);
                setShowPrompt(false);
            } else {
                console.log('User dismissed the install prompt');
            }
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 bg-white border-t border-slate-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)] flex items-center justify-between gap-3 safe-bottom animate-slide-up">
            <div className="flex-1 flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm">
                    <img src="/pwa-192x192.png" alt="Hazina Logo" className="w-10 h-10 object-contain rounded-lg" onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerText = 'H'; }} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-slate-800">Install Hazina App</h4>
                    {isIOS ? (
                        <p className="text-xs text-slate-500 leading-snug mt-0.5">
                            Tap <span className="inline-block mx-0.5 font-medium text-slate-700"><svg className="w-4 h-4 inline align-bottom" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> Share</span> then "Add to Home Screen"
                        </p>
                    ) : (
                        <p className="text-xs text-slate-500 leading-snug mt-0.5">Add to home screen for a better, faster experience</p>
                    )}
                </div>
            </div>

            {!isIOS && (
                <button
                    onClick={handleInstallClick}
                    className="flex-shrink-0 bg-green-600 text-white text-xs font-bold px-4 py-2.5 rounded-full hover:bg-green-700 transition-colors shadow-sm active:scale-95 transform"
                >
                    Install
                </button>
            )}

            <button
                onClick={handleDismiss}
                className="flex-shrink-0 text-slate-400 hover:text-slate-600 p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors ml-1"
                aria-label="Close"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};

export default InstallPrompt;
