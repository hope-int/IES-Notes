import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';

const SplashScreen = ({ onComplete }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [animationData, setAnimationData] = useState(null);

    useEffect(() => {
        // Fetch a cool Lottie animation
        fetch('https://lottie.host/980b18dc-8319-4d69-beeb-09af7658c49e/H6bJ2y5yjJ.json')
            .then(res => res.json())
            .then(data => setAnimationData(data))
            .catch(err => {
                console.error("Failed to load Lottie:", err);
                // Fallback to a simple dot loader if fetch fails
            });

        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onComplete, 500); // Allow exit animation
        }, 3500); // Slightly longer to show off the animation
        return () => clearTimeout(timer);
    }, [onComplete]);

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
                        <div className="mb-4 d-flex justify-content-center align-items-center" style={{ width: 200, height: 200 }}>
                            {animationData ? (
                                <Lottie animationData={animationData} loop={true} style={{ width: 180, height: 180 }} />
                            ) : (
                                <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            )}
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
