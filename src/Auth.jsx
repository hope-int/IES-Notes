import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Mail, Lock, Loader, ArrowRight, User, Phone, BookOpen, Building2, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Auth() {
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [verificationPending, setVerificationPending] = useState(false);
    const [syncError, setSyncError] = useState(false);

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [details, setDetails] = useState({ sem: '', year: '', dept: '', college: '' });

    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        setError(null);
        setSyncError(false);

        try {
            if (isSignUp) {
                // 1. Sign Up
                const { data: { user }, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            phone_number: phone,
                            semester: details.sem,
                            year: details.year,
                            department: details.dept,
                            college: details.college
                        }
                    }
                });
                if (authError) throw authError;

                if (user) {
                    // Profile creation is handled automatically by Supabase Trigger 
                    // or via fallback sync on login if trigger fails.
                    setVerificationPending(true);
                }
            } else {
                // Login
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                // No extra check here. App.jsx handles the redirect after session sync.
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (verificationPending) {
        return <VerificationScreen email={email} syncError={syncError} onBack={() => { setVerificationPending(false); setIsSignUp(false); }} />;
    }

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center p-4 position-relative overflow-hidden"
            style={{ background: 'var(--bg-color)', transition: 'background 0.3s' }}>

            {/* Animated Background Blobs */}
            <div className="position-absolute w-100 h-100 top-0 start-0 overflow-hidden" style={{ zIndex: 0 }}>
                <motion.div
                    animate={{ x: [0, 100, 0], y: [0, -50, 0] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="position-absolute bg-primary opacity-10 rounded-circle blur-3xl"
                    style={{ width: '400px', height: '400px', top: '-10%', left: '-10%', filter: 'blur(80px)', opacity: 0.1 }}
                />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="clay-card p-4 p-md-5 w-100 overflow-auto hide-scrollbar position-relative z-1"
                style={{ maxWidth: '480px', maxHeight: '85vh' }}
            >
                <div className="text-center mb-5">
                    <motion.div
                        whileHover={{ rotate: 10, scale: 1.1 }}
                        className="d-inline-flex p-4 rounded-circle mb-3 shadow-inner"
                        style={{ background: 'var(--clay-bg)' }}
                    >
                        <User size={48} style={{ color: 'var(--primary-accent)' }} />
                    </motion.div>
                    <h2 className="fw-bolder mb-2 display-6" style={{ color: 'var(--text-main)' }}>
                        {isSignUp ? 'Join the Club' : 'Welcome Back'}
                    </h2>
                    <p className="text-muted fw-medium">{isSignUp ? 'Create your academic profile' : 'Sign in to access your notes'}</p>
                </div>

                {message && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="alert alert-success d-flex align-items-center gap-2 small mb-4 rounded-3 border-0 shadow-sm">
                        <CheckCircle size={16} /> {message}
                    </motion.div>
                )}
                {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="alert alert-danger d-flex align-items-center gap-2 small mb-4 rounded-3 border-0 shadow-sm">
                        <AlertCircle size={16} /> {error}
                    </motion.div>
                )}

                <form onSubmit={handleAuth} className="d-flex flex-column gap-3">
                    <AnimatePresence mode="popLayout">
                        {isSignUp && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="d-flex flex-column gap-3"
                            >
                                <InputGroup icon={User} placeholder="Full Name" value={fullName} onChange={setFullName} />
                                <InputGroup icon={Phone} placeholder="Phone Number" type="tel" value={phone} onChange={setPhone} />

                                <div className="row g-2">
                                    <div className="col-6">
                                        <InputGroup icon={Hash} placeholder="Sem (e.g. S3)" value={details.sem} onChange={v => setDetails({ ...details, sem: v })} />
                                    </div>
                                    <div className="col-6">
                                        <InputGroup icon={Hash} placeholder="Year" value={details.year} onChange={v => setDetails({ ...details, year: v })} />
                                    </div>
                                </div>

                                <InputGroup icon={BookOpen} placeholder="Department (e.g. CSE)" value={details.dept} onChange={v => setDetails({ ...details, dept: v })} />
                                <InputGroup icon={Building2} placeholder="College Name" value={details.college} onChange={v => setDetails({ ...details, college: v })} />

                                <div className="my-2 border-bottom opacity-10"></div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <InputGroup icon={Mail} type="email" placeholder="Email Address" value={email} onChange={setEmail} />
                    <InputGroup icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} />

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={loading}
                        className="btn btn-primary rounded-pill py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm mt-2 position-relative overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))',
                            border: 'none',
                            fontSize: '1.1rem'
                        }}
                    >
                        {loading ? <Loader className="animate-spin" size={24} /> : (
                            <>
                                {isSignUp ? 'Create Account' : 'Sign In'}
                                <ArrowRight size={20} />
                            </>
                        )}
                    </motion.button>
                </form>

                <div className="text-center mt-5">
                    <p className="mb-0 text-muted fw-medium">
                        {isSignUp ? "Already have an account?" : "New to IES Notes?"}
                        <button
                            onClick={() => { setIsSignUp(!isSignUp); setMessage(null); setError(null); }}
                            className="btn btn-link fw-bold text-decoration-none ms-2 p-0 position-relative"
                            style={{ color: 'var(--primary-accent)' }}
                        >
                            {isSignUp ? 'Login Here' : 'Create Account'}
                        </button>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

// Reusable Clay Input Component with Icon
const InputGroup = ({ icon: Icon, type = "text", placeholder, value, onChange }) => (
    <div className="position-relative">
        {Icon && <Icon className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted opacity-75" size={20} />}
        <input
            className="clay-input w-100 py-3 ps-5 border-0"
            type={type}
            placeholder={placeholder}
            value={value}
            required
            onChange={(e) => onChange(typeof e === 'string' ? e : e.target.value)}
            style={{
                backgroundColor: 'var(--bg-color)',
                transition: 'all 0.3s ease'
            }}
        />
    </div>
);

// Helper for the icon in InputGroup
const Hash = ({ className, size }) => (
    <span className={`fw-bold h5 mb-0 d-flex align-items-center justify-content-center ${className}`} style={{ width: size, height: size }}>
        #
    </span>
);

const VerificationScreen = ({ email, syncError, onBack }) => {
    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center p-4 position-relative overflow-hidden"
            style={{ background: 'var(--bg-color)', transition: 'background 0.3s' }}>

            {/* Background Animation */}
            <div className="position-absolute w-100 h-100 top-0 start-0 overflow-hidden" style={{ zIndex: 0 }}>
                <motion.div
                    animate={{ x: [0, -100, 0], y: [0, 50, 0] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="position-absolute bg-secondary opacity-10 rounded-circle blur-3xl"
                    style={{ width: '500px', height: '500px', bottom: '-10%', right: '-10%', filter: 'blur(80px)', opacity: 0.1 }}
                />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, type: "spring" }}
                className="clay-card p-4 p-md-5 w-100 text-center position-relative z-1"
                style={{ maxWidth: '500px' }}
            >
                <motion.div
                    initial={{ y: -10 }}
                    animate={{ y: 0 }}
                    transition={{ repeat: Infinity, repeatType: "mirror", duration: 1.5 }}
                    className="d-inline-flex p-4 rounded-circle mb-4 shadow-inner"
                    style={{ background: 'var(--clay-bg)' }}
                >
                    <Mail size={56} className="text-primary" style={{ color: 'var(--primary-accent)' }} />
                </motion.div>

                <h2 className="fw-bolder mb-3 display-6" style={{ color: 'var(--text-main)' }}>Check Your Inbox</h2>
                <p className="text-muted mb-4" style={{ fontSize: '1.1rem' }}>
                    We've sent a verification link to <br />
                    <span className="fw-bold text-dark">{email}</span>
                </p>

                {syncError && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="alert alert-warning d-flex align-items-start gap-2 text-start small mb-4 rounded-3 border-0 shadow-sm"
                    >
                        <AlertCircle size={18} className="mt-1 flex-shrink-0" />
                        <div>
                            <strong>Note:</strong> Account created, but automatic profile sync encountered an issue. You can still verify your email and complete your profile later.
                        </div>
                    </motion.div>
                )}

                <div className="d-grid gap-3 mb-4">
                    <a
                        href={`mailto:${email}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary rounded-pill py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                        style={{
                            background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))',
                            border: 'none',
                            fontSize: '1.1rem'
                        }}
                    >
                        <Mail size={20} /> Open Email App
                    </a>

                    <button
                        onClick={onBack}
                        className="btn btn-light rounded-pill py-3 fw-bold shadow-inner"
                        style={{ background: 'var(--bg-color)', color: 'var(--text-muted)' }}
                    >
                        I've Verified, Log In
                    </button>
                </div>

                {/* Tutorial Section */}
                <div className="text-start bg-light p-4 rounded-4 border border-opacity-10" style={{ background: 'rgba(0,0,0,0.02)' }}>
                    <h5 className="fw-bold mb-3 d-flex align-items-center gap-2 small text-uppercase text-muted">
                        <CheckCircle size={16} /> How to verify
                    </h5>
                    <ul className="list-unstyled d-flex flex-column gap-3 mb-0 small text-muted">
                        <li className="d-flex gap-3">
                            <span className="bg-white rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: 24, height: 24, minWidth: 24, fontWeight: 'bold', fontSize: '0.8rem' }}>1</span>
                            <span>Open the email from <strong>IES Notes</strong>.</span>
                        </li>
                        <li className="d-flex gap-3">
                            <span className="bg-white rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: 24, height: 24, minWidth: 24, fontWeight: 'bold', fontSize: '0.8rem' }}>2</span>
                            <span>Click the <strong>Confirm Email</strong> link inside.</span>
                        </li>
                        <li className="d-flex gap-3">
                            <span className="bg-white rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: 24, height: 24, minWidth: 24, fontWeight: 'bold', fontSize: '0.8rem' }}>3</span>
                            <span>Come back here and sign in to access your dashboard.</span>
                        </li>
                    </ul>
                </div>

            </motion.div>
        </div>
    );
};
