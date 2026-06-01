import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Sparkles, ArrowRight, AlertTriangle, Cloud, Zap, RefreshCw } from 'lucide-react';

export default function PuterAuthPopup({ onAuthComplete }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [puterAvailable, setPuterAvailable] = useState(true);
    const connectBtnRef = useRef(null);

    useEffect(() => {
        // Accessibility Focus
        if (connectBtnRef.current) {
            connectBtnRef.current.focus();
        }
        
        // Graceful degradation check
        if (!window.puter) {
            setPuterAvailable(false);
        }
    }, []);

    const onCancel = () => {
        if (onAuthComplete && !loading && !success) {
            localStorage.setItem('hope_puter_guest_confirmed', 'true');
            onAuthComplete(false);
        }
    };

    const handleSetup = async () => {
        if (!window.puter) {
            setPuterAvailable(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await window.puter.auth.signIn({ attempt_temp_user_creation: true });

            if (window.puter.auth.isSignedIn()) {
                setSuccess(true);
                localStorage.setItem('hope_puter_guest_confirmed', 'false');
                
                // Keep the modal open a bit longer for success animation
                setTimeout(() => {
                    if (onAuthComplete) onAuthComplete(true);
                }, 2000);
            } else {
                throw new Error("Connection incomplete. Please finish the Puter prompt.");
            }
        } catch (err) {
            console.error("Puter Auth Error:", err);
            setError(err.message || "Connection Lost. Please try again.");
        } finally {
            if (!success) setLoading(false);
        }
    };

    const retryScript = () => {
        window.location.reload();
    };

    // Phase 3: Radar Animation
    const RadarAnimation = () => (
        <div className="position-relative d-flex justify-content-center align-items-center" style={{ width: '120px', height: '120px' }}>
            <motion.div
                className="position-absolute rounded-circle border border-primary"
                initial={{ width: 0, height: 0, opacity: 1 }}
                animate={{ width: '100%', height: '100%', opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                style={{ borderWidth: '2px' }}
            />
            <motion.div
                className="position-absolute rounded-circle border border-info"
                initial={{ width: 0, height: 0, opacity: 1 }}
                animate={{ width: '100%', height: '100%', opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.75 }}
                style={{ borderWidth: '2px' }}
            />
            <Cloud size={48} className="text-primary z-1" />
        </div>
    );
    
    // Phase 5: Custom SVG circuit cloud
    const CircuitCloudSVG = () => (
        <svg width="120" height="120" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <motion.path d="M50 140 H150 C166.5 140 180 126.5 180 110 C180 93.5 166.5 80 150 80 C146.6 57 126.7 40 102.5 40 C75.6 40 53.8 61.8 53.8 88.7 C33.1 91 17 108.6 17 130 C17 152.1 34.9 170 57 170" stroke="url(#paint0_linear)" strokeWidth="8" strokeLinecap="round" />
            <motion.path d="M100 140 V180 M100 180 H80 M100 180 H120 M70 140 V160 H50 " stroke="url(#paint1_linear)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <motion.circle cx="80" cy="180" r="5" fill="#3b82f6" />
            <motion.circle cx="120" cy="180" r="5" fill="#8b5cf6" />
            <motion.circle cx="50" cy="160" r="5" fill="#3b82f6" />
            <defs>
                <linearGradient id="paint0_linear" x1="17" y1="105" x2="180" y2="105" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#3b82f6" />
                    <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
                <linearGradient id="paint1_linear" x1="50" y1="160" x2="120" y2="160" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#94a3b8" />
                    <stop offset="1" stopColor="#cbd5e1" />
                </linearGradient>
            </defs>
        </svg>
    );

    // Phase 5: Technical Binary Grid
    const BinaryBackground = () => (
        <div className="position-absolute top-0 start-0 w-100 h-100 overflow-hidden" style={{ zIndex: 0, opacity: 0.05, pointerEvents: 'none' }}>
            {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                    key={i}
                    className="position-absolute text-success font-monospace fw-bold"
                    style={{
                        left: `${Math.random() * 100}%`,
                        fontSize: `${10 + Math.random() * 14}px`,
                        whiteSpace: 'nowrap'
                    }}
                    initial={{ top: '-20%' }}
                    animate={{ top: '120%' }}
                    transition={{
                        duration: 15 + Math.random() * 20,
                        repeat: Infinity,
                        ease: "linear",
                        delay: Math.random() * 10
                    }}
                >
                    {Array.from({ length: 15 }).map(() => Math.random() > 0.5 ? '1' : '0').join('')}
                </motion.div>
            ))}
        </div>
    );

    // Phase 3: Success State Transition
    if (success) {
        return (
            <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 9999, background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)' }}>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: 50 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: -50 }}
                    className="theme-card rounded-pill d-flex align-items-center justify-content-center gap-3 px-5 py-3 shadow-lg border theme-border"
                >
                    <div className="rounded-circle bg-success d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                        <motion.div
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <motion.polyline points="20 6 9 17 4 12" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
                            </svg>
                        </motion.div>
                    </div>
                    <div className="fw-bold fs-5 theme-text">Secure Channel Activated</div>
                </motion.div>
            </div>
        );
    }

    return (
        <div 
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" 
            style={{ zIndex: 9999, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(20px)' }}
            onKeyDown={(e) => {
                // Focus trap for Tab key
                if (e.key === 'Tab' && connectBtnRef.current) {
                    if (document.activeElement !== connectBtnRef.current) {
                        e.preventDefault();
                        connectBtnRef.current.focus();
                    }
                }
            }}
        >
            <BinaryBackground />

            {/* Phase 1 & 3: Container overhaul and Shake on Error */}
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={error ? { x: [-10, 10, -10, 10, 0] } : { scale: 1, opacity: 1, y: 0 }}
                transition={error ? { duration: 0.4 } : { duration: 0.3 }}
                className="overflow-hidden d-flex flex-column flex-md-row position-relative theme-card"
                style={{ 
                    maxWidth: '850px', 
                    width: '100%',
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
                    borderRadius: '32px', // Softer, more modern corners
                    zIndex: 1
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Left Side: Visual / Brand (Hidden or stacked on mobile) */}
                <div className="col-12 col-md-5 d-flex flex-column justify-content-center align-items-center p-5 position-relative" style={{ background: '#0f172a', color: 'white' }}>
                    
                    {/* Faint technical grid */}
                    <div className="position-absolute top-0 start-0 w-100 h-100 overflow-hidden opacity-25">
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>
                    </div>
                    
                    <div className="z-1 text-center py-4 py-md-0">
                        <div className="mb-4">
                            {loading ? <RadarAnimation /> : <CircuitCloudSVG />}
                        </div>
                        <h3 className="fw-bold mb-2">HOPE <span className="text-primary">Studio</span></h3>
                        <p className="text-white-50 small mb-0">Distributed Cloud Intelligence</p>
                    </div>

                    <div className="position-absolute bottom-0 start-0 w-100 p-4 z-1 d-none d-md-block">
                        <div className="d-flex align-items-center justify-content-center gap-2 text-white-50 small">
                            <ShieldCheck size={16} className="text-success" />
                            <span>End-to-End Secure Protocol</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Content / Action */}
                <div className="col-12 col-md-7 p-4 p-md-5 d-flex flex-column justify-content-center text-dark">
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="text-center py-5"
                            >
                                <h3 className="fw-bold mb-3 text-dark">Establishing Secure Channel...</h3>
                                <p className="text-muted mb-4">Connecting to Puter's global network for optimal AI routing.</p>
                                <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="content"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                            >
                                <h2 id="modal-title" className="fw-bold mb-2 display-6 text-dark" style={{ letterSpacing: '-1px' }}>
                                    Unlock Unlimited <br/><span className="text-gradient">Intelligence</span>
                                </h2>

                                <p className="text-muted fs-6 mb-4 mt-3" style={{ lineHeight: '1.6' }}>
                                    Connect to activate free Cloud Computing, Advanced AI Models, and the J-Compiler.
                                </p>

                                {/* Phase 4: Graceful Degradation */}
                                {!puterAvailable ? (
                                    <div className="bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-4 p-4 mb-4">
                                        <div className="d-flex align-items-center gap-2 text-danger fw-bold mb-2">
                                            <AlertTriangle size={20} /> Cloud Services Unavailable
                                        </div>
                                        <p className="small text-danger opacity-75 mb-3">
                                            The core library (Puter.js) failed to load. Please check your connection or ad-blocker.
                                        </p>
                                        <button onClick={retryScript} className="btn btn-sm btn-outline-danger d-flex align-items-center gap-2">
                                            <RefreshCw size={14} /> Retry Connection
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="d-flex flex-column gap-3 mb-4">
                                            <div className="d-flex align-items-center gap-3">
                                                <div className="bg-primary bg-opacity-10 p-2 rounded-circle text-primary">
                                                    <Zap size={20} />
                                                </div>
                                                <div>
                                                    <div className="fw-bold text-dark">One-Click Setup</div>
                                                    <div className="small text-muted">No credit card or API keys required</div>
                                                </div>
                                            </div>
                                            <div className="d-flex align-items-center gap-3">
                                                <div className="bg-success bg-opacity-10 p-2 rounded-circle text-success">
                                                    <Sparkles size={20} />
                                                </div>
                                                <div>
                                                    <div className="fw-bold text-dark">Infinite Capabilities</div>
                                                    <div className="small text-muted">Access Claude & GPT cloud compute</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Phase 3: Visual Error Recovery */}
                                        {error && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: -10 }} 
                                                animate={{ opacity: 1, y: 0 }} 
                                                className="alert alert-danger py-2 px-3 small rounded-3 mb-4 border-0 bg-danger bg-opacity-10 text-danger text-start d-flex gap-2 align-items-center"
                                            >
                                                <AlertTriangle size={20} className="flex-shrink-0" />
                                                <div>{error}</div>
                                            </motion.div>
                                        )}

                                        <div className="d-flex flex-column mt-3">
                                            <div className="d-flex gap-3 align-items-center flex-column flex-sm-row">
                                                <button 
                                                    ref={connectBtnRef}
                                                    onClick={handleSetup} 
                                                    className={`btn ${error ? 'btn-danger' : 'btn-dark'} px-4 py-3 fw-bold rounded-pill d-flex justify-content-center align-items-center gap-2 flex-grow-1 shadow-sm w-100`}
                                                    style={!error ? { background: '#0f172a', border: 'none' } : {}}
                                                >
                                                    {error ? "Retry Connection" : "Connect & Launch"} <ArrowRight size={18} />
                                                </button>
                                                <button 
                                                    onClick={onCancel} 
                                                    tabIndex={0}
                                                    className="btn theme-surface hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-3 fw-medium rounded-pill theme-text border theme-border w-100 w-sm-auto mt-2 mt-sm-0"
                                                >
                                                    Skip
                                                </button>
                                            </div>
                                            
                                            {/* Phase 2: Copywriting - Secondary Text */}
                                            <div className="text-center mt-4">
                                                <span className="small text-muted" style={{ fontSize: '12px' }}>
                                                    Securely powered by Puter. 
                                                    <span 
                                                        className="ms-1 text-decoration-none text-primary" 
                                                        title="If a window pops up, click 'Sign Up' or use Google. It's free and takes 10 seconds!"
                                                        style={{ cursor: 'help' }}
                                                    >
                                                        What happens next?
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            <style>{`
                .text-gradient {
                    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
            `}</style>
        </div>
    );
}
