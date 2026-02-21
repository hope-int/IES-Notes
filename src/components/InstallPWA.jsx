import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InstallPWA() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        // Check if already dismissed
        if (localStorage.getItem('hope_pwa_dismissed') === 'true') {
            return;
        }

        const handleBeforeInstallPrompt = (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI notify the user they can install the PWA
            setIsInstallable(true);
        };

        const handleAppInstalled = () => {
            // Log install successful
            setIsInstallable(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Also don't show if already in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
            setIsInstallable(false);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setIsInstallable(false);
        }

        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setIsDismissed(true);
        localStorage.setItem('hope_pwa_dismissed', 'true');
    };

    if (!isInstallable || isDismissed) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 150, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 150, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="position-fixed bottom-0 start-50 translate-middle-x mb-4 z-3"
            >
                <div className="clay-card rounded-pill d-flex align-items-center shadow-lg pe-2 ps-1 py-1" style={{ border: '2px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.9)' }}>
                    <button
                        onClick={handleInstallClick}
                        className="btn btn-primary rounded-pill px-4 py-2 d-flex align-items-center gap-2 border-0"
                    >
                        <Download size={18} />
                        <span className="fw-bold">Install HOPE App</span>
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="btn btn-link text-muted p-2 rounded-circle ms-1 d-flex align-items-center justify-content-center"
                        style={{ width: '32px', height: '32px' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
