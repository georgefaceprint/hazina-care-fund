import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * UpdatePrompt — listens for a new service worker waiting to activate
 * and prompts the user to refresh for the latest version.
 *
 * Works by listening to the 'vite-plugin-pwa:sw-updated' custom event
 * dispatched by vite-plugin-pwa's registerSW auto-update callback, OR
 * by polling navigator.serviceWorker for a waiting worker.
 */
const UpdatePrompt = () => {
    const [showUpdate, setShowUpdate] = useState(false);
    const [waitingSW, setWaitingSW] = useState(null);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const checkForUpdate = async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            if (!reg) return;

            const onUpdateFound = () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        setWaitingSW(newWorker);
                        setShowUpdate(true);
                    }
                });
            };

            // Already waiting
            if (reg.waiting && navigator.serviceWorker.controller) {
                setWaitingSW(reg.waiting);
                setShowUpdate(true);
            }

            reg.addEventListener('updatefound', onUpdateFound);
        };

        checkForUpdate();

        // Detect controller change (new SW activated) -> reload to get fresh assets
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }, []);

    const handleUpdate = () => {
        if (waitingSW) {
            waitingSW.postMessage({ type: 'SKIP_WAITING' });
        }
        setShowUpdate(false);
    };

    if (!showUpdate) return null;

    return (
        <div className="fixed top-4 left-4 right-4 z-[300] max-w-md mx-auto animate-slide-up">
            <div className="bg-brand-secondary text-white rounded-[2rem] px-6 py-4 shadow-2xl border border-white/10 flex items-center gap-4">
                <div className="p-2.5 bg-brand-primary/20 rounded-xl flex-shrink-0">
                    <RefreshCw className="w-5 h-5 text-brand-primary animate-spin" style={{ animationDuration: '3s' }} />
                </div>
                <div className="flex-1">
                    <h4 className="font-black text-sm">Update Available!</h4>
                    <p className="text-xs text-white/60 mt-0.5">A new version of Hazina is ready.</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={handleUpdate}
                        className="bg-brand-primary text-white text-xs font-black px-4 py-2 rounded-xl hover:bg-emerald-500 transition-colors active:scale-95"
                    >
                        Update
                    </button>
                    <button onClick={() => setShowUpdate(false)} className="p-1 text-white/40 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdatePrompt;
