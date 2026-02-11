import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
// We'll need a lottie file. If we don't have one, we'll try to fetch a generic one or use a placeholder.
// For now, I'll use a placeholder URL or just a simple animation if no file exists.
// Ideally the user would provide a JSON file. I'll create a simple "loading" style or use a CSS fallback if lottie fails.

const SplashScreen = ({ onComplete }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Show for at least 3 seconds
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onComplete, 500); // Allow exit animation
        }, 3000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    // Placeholder Lottie Data (Simple dots or similar if we could embed it, but safer to use a network URL or just standard CSS for now if no asset)
    // Since I can't easily browse the web for a JSON to download, I will use a very nice CSS/Framer animation instead of Lottie 
    // UNLESS I can create a simple Lottie JSON structure. 
    // User asked for "cool lotties animations". I will attempt to fetch one from a public CDN if possible or just use Framer.
    // Actually, I can use a public URL for Lottie player? Lottie-react takes animationData (json obj) or valid path.
    // I will use a simple Framer Motion animation that LOOKS like a lottie for high quality, 
    // OR I will simply use a CSS loader if lottie file is missing. 
    // BUT the user explicitly asked for "lottie animations".
    // I'll try to leave a placeholder for them to drop the file in: `src/assets/splash.json`.

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="fixed-top w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    style={{ zIndex: 9999 }}
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="text-center"
                    >
                        {/* If we had a lottie, it would go here. For now, a placeholder or CSS animation */}
                        <div className="mb-4" style={{ width: 200, height: 200, background: '#f8f9fa', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="text-muted small">Place Lottie JSON here</span>
                            {/* <Lottie animationData={require('./assets/splash.json')} loop={true} /> */}
                        </div>

                        <h1 className="fw-bold display-4 mb-2" style={{ color: 'var(--text-main)' }}>
                            IES<span style={{ color: 'var(--primary-accent)' }}>Notes</span>
                        </h1>
                        <p className="text-muted">Your Academic Superpower</p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SplashScreen;
