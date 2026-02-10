import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { X, Lock, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminLoginModal({ isOpen, onClose, onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (data.session) {
                // Verify admin status
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('is_admin')
                    .eq('id', data.user.id)
                    .single();

                if (profileError || !profile?.is_admin) {
                    await supabase.auth.signOut(); // Force logout if not admin
                    throw new Error("Access Denied: Not an Administrator");
                }

                onLoginSuccess(data.session);
                onClose();
            }
        } catch (err) {
            console.error("Admin login failed:", err);
            setError(err.message || "Invalid credentials");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay d-flex align-items-center justify-content-center" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="clay-card p-4 rounded-4 shadow-lg position-relative bg-white"
                style={{ width: '100%', maxWidth: '400px' }}
            >
                <button
                    onClick={onClose}
                    className="btn btn-link position-absolute top-0 end-0 m-3 text-muted p-0"
                >
                    <X size={24} />
                </button>

                <div className="text-center mb-4">
                    <div className="bg-light rounded-circle d-inline-flex p-3 mb-3">
                        <Lock size={32} className="text-primary" />
                    </div>
                    <h3 className="fw-bold">Admin Login</h3>
                    <p className="text-muted small">Secure access for IES Notes administrators.</p>
                </div>

                {error && (
                    <div className="alert alert-danger py-2 small mb-3 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div className="mb-3">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-0"><Mail size={18} className="text-muted" /></span>
                            <input
                                type="email"
                                className="form-control bg-light border-0"
                                placeholder="Admin Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-0"><Lock size={18} className="text-muted" /></span>
                            <input
                                type="password"
                                className="form-control bg-light border-0"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary w-100 rounded-pill py-2 fw-bold d-flex align-items-center justify-content-center gap-2"
                        disabled={loading}
                    >
                        {loading ? <div className="spinner-border spinner-border-sm"></div> : "Access Dashboard"}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
