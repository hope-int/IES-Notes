import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, ShieldCheck, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function PuterAuthPopup({ onAuthComplete }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const onCancel = () => {
        if (onAuthComplete) onAuthComplete(false);
    };

    const handleSetup = async () => {
        setLoading(true);
        setError(null);
        try {
            if (!window.puter) {
                throw new Error("Puter.js library not loaded. Please refresh the page.");
            }

            // Trigger Automatic Guest Auth via AI Request
            // Puter.js automatically creates a guest account on first request if not signed in
            const response = await window.puter.ai.chat([{ role: 'user', content: 'hello' }], { model: 'gpt-4o-mini' });

            if (response) {
                setSuccess(true);
                // Mark guest mode as active so we don't ask again
                localStorage.setItem('hope_puter_guest_confirmed', 'true');

                // Wait a bit to show success state before closing
                setTimeout(() => {
                    onAuthComplete(true);
                }, 1500);
            }
        } catch (err) {
            console.error("Puter Auth/Guest Error:", err);
            setError(err.message || "Failed to initialize Puter AI.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 9999, background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)' }}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="clay-card p-4 p-md-5 text-center overflow-hidden position-relative"
                style={{ maxWidth: '500px', background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
                {/* Decorative background element */}
                <div className="position-absolute top-0 start-0 w-100 h-2 bg-primary opacity-50"></div>

                <div className="mb-4 d-inline-block p-4 rounded-circle clay-card bg-primary bg-opacity-10 text-primary">
                    <Cpu size={48} className={loading ? "animate-spin" : ""} />
                </div>

                <h2 className="fw-bold mb-3 display-6" style={{ color: 'var(--text-main)' }}>
                    Activate <span className="text-gradient">Puter AI</span>
                </h2>

                <p className="text-muted fs-5 mb-4">
                    To unlock the full potential of your AI Tutor and J-Compiler, please set up your Puter account.
                </p>

                <div className="glass-panel p-3 mb-4 rounded-4 text-start small border-0" style={{ background: 'rgba(0,0,0,0.02)' }}>
                    <div className="d-flex align-items-center gap-2 mb-2 text-success">
                        <ShieldCheck size={16} /> <strong>Secure & Free</strong>
                    </div>
                    <ul className="list-unstyled mb-0 opacity-75">
                        <li className="d-flex gap-2 mb-1"><Sparkles size={14} className="mt-1 text-primary" /> Free Cloud AI access</li>
                        <li className="d-flex gap-2 mb-1"><Sparkles size={14} className="mt-1 text-primary" /> Enhanced J-Compiler reliability</li>
                        <li className="d-flex gap-2"><Sparkles size={14} className="mt-1 text-primary" /> Collaborative AI workspace</li>
                    </ul>
                </div>

                {error && (
                    <div className="alert alert-danger py-2 px-3 small rounded-3 mb-4 border-0 bg-danger bg-opacity-10 text-danger">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleSetup}
                    disabled={loading || success}
                    className={`clay-button w-100 py-3 d-flex align-items-center justify-content-center gap-3 fw-bold fs-5 transition-all ${success ? 'bg-success border-success' : ''}`}
                >
                    {loading ? (
                        <>
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                            Setting up...
                        </>
                    ) : success ? (
                        <>
                            <CheckCircle2 size={24} /> Activated!
                        </>
                    ) : (
                        <>
                            Tap to Setup <ArrowRight size={20} />
                        </>
                    )}
                </button>

                <button
                    onClick={onCancel}
                    disabled={loading || success}
                    className="btn btn-link text-muted text-decoration-none mt-3 small"
                >
                    Not now, I'll set it up later
                </button>

                <p className="mt-4 text-muted small px-4">
                    By setting up, you verify your account and authorize the Puter AI environment for HOPE Community.
                </p>

                <motion.div
                    className="position-absolute bottom-0 start-0 w-100 h-1 bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: loading ? '100%' : 0 }}
                    transition={{ duration: 2, repeat: loading ? Infinity : 0 }}
                />
            </motion.div>

            <style>{`
                .text-gradient {
                    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .animate-spin {
                    animation: spin 2s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
