
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SplashScreen = ({ onComplete, isAppReady = false }) => {
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMinTimeElapsed(true), 1200);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (minTimeElapsed && isAppReady && !exiting) {
            setExiting(true);
            // Give the framer exit animation time (0.6s), then call onComplete
            const timer = setTimeout(onComplete, 700);
            return () => clearTimeout(timer);
        }
    }, [minTimeElapsed, isAppReady, exiting, onComplete]);

    return (
        <AnimatePresence>
            {!exiting && (
                <motion.div
                    key="splash"
                    className="fixed-top w-100 d-flex flex-column align-items-center justify-content-center bg-white"
                    style={{ zIndex: 9999, height: '100dvh' }}
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.05, filter: 'blur(8px)' }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                >
                    <motion.div
                        initial={{ scale: 0.85, opacity: 0, y: 24 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="d-flex flex-column align-items-center justify-content-center"
                    >
                        <div className="mb-4 d-flex justify-content-center align-items-center" style={{ width: 180, height: 180 }}>
                            <img
                                src="/hope-logo.png"
                                alt="HOPE-Edu-Hub Logo"
                                className="img-fluid rounded-4 shadow-sm"
                                style={{ objectFit: 'contain' }}
                            />
                        </div>

                        <div className="text-center" style={{ position: 'relative', zIndex: 2 }}>
                            <h1 className="fw-bold display-4 mb-2" style={{ color: '#1e293b', letterSpacing: '-1px' }}>
                                HOPE<span style={{ color: '#3b82f6' }}>-Edu-Hub</span>
                            </h1>
                            <p className="text-muted small text-uppercase fw-bold" style={{ letterSpacing: '0.15em' }}>
                                Your Academic Superpower
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SplashScreen;
