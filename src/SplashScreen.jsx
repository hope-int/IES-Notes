
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';

const SplashScreen = ({ onComplete, isAppReady = true }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [animationData, setAnimationData] = useState(null);
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);

    useEffect(() => {
        // Fetch a cool "Science/Tech" themed Lottie animation
        // URL Removed due to 403 error. Falling back to CSS loader.
        // fetch("https://lottie.host/98695034-3151-4091-9577-62dc22883393/D2pL0B5O0I.json") 
        //     .then(res => res.json())
        //     .then(data => setAnimationData(data))
        //     .catch(() => console.log("Using fallback loader"));
        console.log("Using fallback loader");

        // Minimum display time of 2.5s
        const timer = setTimeout(() => {
            setMinTimeElapsed(true);
        }, 2500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (minTimeElapsed && isAppReady) {
            setIsVisible(false);
            setTimeout(onComplete, 800); // Allow exit animation
        }
    }, [minTimeElapsed, isAppReady, onComplete]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="fixed-top w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                    transition={{ duration: 0.8 }}
                    style={{ zIndex: 9999 }}
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="d-flex flex-column align-items-center justify-content-center"
                    >
                        {/* Logo Container */}
                        <div className="mb-4 d-flex justify-content-center align-items-center" style={{ width: 180, height: 180 }}>
                            <img
                                src="/pwa-512x512.png"
                                alt="HOPE-Edu-Hub Logo"
                                className="img-fluid rounded-4 shadow-sm"
                                style={{ objectFit: 'contain' }}
                            />
                        </div>

                        <div className="text-center" style={{ position: 'relative', zIndex: 2 }}>
                            <h1 className="fw-bold display-4 mb-2 tracking-tight" style={{ color: '#1e293b', letterSpacing: '-1px' }}>
                                HOPE<span style={{ color: '#3b82f6' }}>-Edu-Hub</span>
                            </h1>
                            <p className="text-muted small text-uppercase tracking-widest fw-bold">Your Academic Superpower</p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SplashScreen;
