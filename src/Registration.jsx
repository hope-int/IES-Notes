import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, GraduationCap, ChevronRight, Loader, LogIn, KeyRound, Check, X,
    Cloud, BookOpen, Code2, BrainCircuit, Fingerprint, ArrowLeft, ShieldCheck, FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { PrivacyPolicy, UserAgreement } from './assets/legalDocs';

const MotionDiv = motion.div;
const MotionButton = motion.button;

export default function Registration({ onComplete }) {
    const [step, setStep] = useState(1); // 1 = Puter Auth Welcome, 2 = Profile Setup, 3 = Legacy Secret UID Login
    const [puterUser, setPuterUser] = useState(null);
    const [loginUid, setLoginUid] = useState('');
    const [loading, setLoading] = useState(false);
    const [departmentsLoading, setDepartmentsLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [loginError, setLoginError] = useState(null);
    const [initialDataError, setInitialDataError] = useState(false);

    // Consent states
    const [privacyAgreed, setPrivacyAgreed] = useState(false);
    const [termsAgreed, setTermsAgreed] = useState(false);
    const [activeDocument, setActiveDocument] = useState(null); // 'privacy' | 'terms' | null
    const allAgreed = privacyAgreed && termsAgreed;

    const documents = {
        'privacy': { title: 'Privacy Policy', content: PrivacyPolicy },
        'terms': { title: 'User Agreement', content: UserAgreement }
    };

    const [formData, setFormData] = useState({
        full_name: '',
        phone_number: '',
        department_id: '',
        department_name: '',
        semester_id: '',
        semester_name: '',
        year: '1'
    });

    const fetchDepartments = useCallback(async (retryCount = 0) => {
        setDepartmentsLoading(true);
        setInitialDataError(false);

        const deptPromise = (async () => {
            try {
                const { data, error } = await supabase.from('departments').select('*');
                if (error) return { error };
                return { data };
            }
            catch (e) { return { error: e }; }
        })();

        const timeoutPromise = new Promise((resolve) =>
            setTimeout(() => resolve({ error: new Error("Server wake-up took too long.") }), 45000)
        );

        try {
            const { data, error } = await Promise.race([deptPromise, timeoutPromise]);

            if (error) {
                console.warn(`Dept fetch effort ${retryCount + 1}:`, error.message);
                if (retryCount < 5) {
                    const msg = retryCount === 0 ? "Waking up system..." : "Routing through secure proxy...";
                    console.log(`${msg} (${retryCount + 1}/6)`);
                    setTimeout(() => fetchDepartments(retryCount + 1), 5000);
                    return;
                }
                throw error;
            }

            if (data) {
                setDepartments(data);
                setDepartmentsLoading(false);
            }
        } catch (error) {
            console.error('Supabase Initialization Failed:', error.message);
            setInitialDataError(true);
            setDepartmentsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDepartments();
    }, [fetchDepartments]);

    const fetchSemesters = async (deptId) => {
        const semPromise = (async () => {
            try { return await supabase.from('semesters').select('*').eq('department_id', deptId).order('name'); }
            catch (e) { return { error: e }; }
        })();

        const timeoutPromise = new Promise((resolve) =>
            setTimeout(() => resolve({ error: new Error("Semesters fetch timeout") }), 15000)
        );

        try {
            const { data, error } = await Promise.race([semPromise, timeoutPromise]);
            if (error) throw error;
            if (data) setSemesters(data);
        } catch (error) {
            console.warn('Network timeout fetching semesters:', error.message);
        }
    };

    const handleDeptChange = (e) => {
        const deptId = e.target.value;
        const dept = departments.find(d => d.id === deptId);
        setFormData({
            ...formData,
            department_id: deptId,
            department_name: dept?.name || '',
            semester_id: '',
            semester_name: ''
        });
        if (deptId) fetchSemesters(deptId);
    };

    const handleSemChange = (e) => {
        const semId = e.target.value;
        const sem = semesters.find(s => s.id === semId);

        let year = "1";
        if (sem) {
            const match = sem.name.match(/\d+/);
            if (match) {
                const semNum = parseInt(match[0]);
                year = Math.ceil(semNum / 2).toString();
            }
        }

        setFormData({
            ...formData,
            semester_id: semId,
            semester_name: sem?.name || '',
            year: year
        });
    };

    const handlePuterAuth = async () => {
        setLoading(true);
        setLoginError(null);
        try {
            if (!window.puter || !window.puter.auth) {
                throw new Error("Puter SDK is not loaded yet. Please wait a moment.");
            }

            // 1. Trigger Puter Sign In
            await window.puter.auth.signIn({ attempt_temp_user_creation: true });

            if (!window.puter.auth.isSignedIn()) {
                throw new Error("Puter Authentication was cancelled or failed.");
            }

            // 2. Get Puter User details
            const pUser = await window.puter.auth.getUser();
            if (!pUser || !pUser.uuid) {
                throw new Error("Failed to retrieve Puter user details.");
            }

            setPuterUser(pUser);

            // 3. Query profiles table by Puter UUID
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', pUser.uuid)
                .maybeSingle();

            if (error) {
                console.error("Error looking up profile:", error);
                throw new Error("Database connection error. Please try again.");
            }

            if (data) {
                console.log("Puter profile found! Logging in...");
                localStorage.setItem('hope_student_profile', JSON.stringify(data));
                onComplete(data);
            } else {
                // Pre-fill setup form with Puter username
                setFormData(prev => ({
                    ...prev,
                    full_name: pUser.username || ''
                }));
                setStep(2);
            }
        } catch (err) {
            console.error("Puter Auth failed:", err);
            setLoginError(err.message || "Failed to authenticate with Puter.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e, retryCount = 0) => {
        if (e) e.preventDefault();
        setLoading(true);
        setLoginError(null);

        try {
            const loginPromise = (async () => {
                try { return await supabase.from('profiles').select('*').eq('id', loginUid.trim()).single(); }
                catch (err) { return { error: err }; }
            })();

            const timeoutPromise = new Promise((resolve) =>
                setTimeout(() => resolve({ error: new Error("Login timeout. Server might be waking up.") }), 25000)
            );

            const { data, error } = await Promise.race([loginPromise, timeoutPromise]);

            if (error) {
                if ((error.message?.includes('fetch') || error.message?.includes('timeout')) && retryCount < 4) {
                    console.log(`Login attempt failed, retrying... (${retryCount + 1}/5)`);
                    setLoginError(`Waking up server... attempt ${retryCount + 1}/5`);
                    setTimeout(() => handleLogin(null, retryCount + 1), 3000);
                    return;
                }
                throw error;
            }

            if (!data) {
                setLoginError("Account not found. Please check your UID.");
                setLoading(false);
                return;
            }

            console.log("Login successful, saving profile...");
            localStorage.setItem('hope_student_profile', JSON.stringify(data));
            onComplete(data);
        } catch (err) {
            console.error("Login Error:", err);
            setLoginError(err.message?.includes('fetch')
                ? "Network connection unstable. Please try again."
                : "Invalid UID or system error.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Puter UUID is used as the profile ID
            const newId = puterUser ? puterUser.uuid : crypto.randomUUID();

            const profileData = {
                id: newId,
                full_name: formData.full_name,
                phone_number: formData.phone_number,
                department: formData.department_name,
                semester: formData.semester_name,
                year: formData.year,
                department_id: formData.department_id,
                semester_id: formData.semester_id,
                college: 'HOPE Community',
                is_admin: false,
                created_at: new Date().toISOString()
            };

            const insertPromise = (async () => {
                try { return await supabase.from('profiles').insert(profileData); }
                catch (e) { return { error: e }; }
            })();

            const timeoutPromise = new Promise((resolve) =>
                setTimeout(() => resolve({ error: new Error("Registration timeout. Please check your network connection.") }), 20000)
            );

            const { error } = await Promise.race([insertPromise, timeoutPromise]);

            if (error) {
                console.error("Supabase Insert Error:", error);
                throw error;
            }

            localStorage.setItem('hope_student_profile', JSON.stringify(profileData));
            onComplete(profileData);

        } catch (error) {
            alert('Error registering. Please try again. ' + (error.message || ''));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`auth-fluid-page auth-cinematic-page auth-white-page theme-page auth-step-${step}`}>
            <div className="auth-cinematic-dots" aria-hidden="true" />
            <div className="auth-spotlight" aria-hidden="true" />
            <div className="auth-fluid-motion" aria-hidden="true">
                <span className="auth-color-field auth-color-field-one" />
                <span className="auth-color-field auth-color-field-two" />
                <span className="auth-color-field auth-color-field-three" />
                <span className="auth-color-field auth-color-field-four" />
            </div>
            <div className="auth-glare-layer" aria-hidden="true" />

            <nav className="auth-mini-nav" aria-label="Authentication modes">
                <div className="auth-mini-brand">
                    <span className="auth-mini-mark">
                        <GraduationCap size={18} aria-hidden="true" />
                    </span>
                    <span>HOPE</span>
                </div>
                <div className={`auth-mini-actions ${step === 3 ? 'is-uid' : 'is-puter'}`}>
                    <span className="auth-mini-liquid" aria-hidden="true" />
                    <button
                        type="button"
                        className={step !== 3 ? 'is-active' : ''}
                        onClick={() => { if (step !== 2) { setStep(1); setLoginError(null); } }}
                        disabled={step === 2}
                    >
                        Puter
                    </button>
                    <button
                        type="button"
                        className={step === 3 ? 'is-active' : ''}
                        onClick={() => { if (step !== 2) { setStep(3); setLoginError(null); } }}
                        disabled={step === 2}
                    >
                        UID
                    </button>
                </div>
            </nav>

            <main className="auth-layout">
                <section className="auth-story" aria-label="HOPE Studio access">
                    <div className="auth-brand-lockup">
                        <div className="auth-logo-wrap">
                            <GraduationCap size={34} aria-hidden="true" />
                        </div>
                        <div>
                            <span className="auth-brand-label">HOPE Studio</span>
                            <strong>Academic workspace</strong>
                        </div>
                    </div>

                    <div className="auth-story-copy">
                        <h1>HOPE Edu Hub</h1>
                        <p>Notes. AI. Projects.</p>
                    </div>

                    <div className="auth-prism" aria-hidden="true">
                        <div className="auth-prism-glass">
                            <div className="auth-prism-mark">
                                <GraduationCap size={44} />
                            </div>
                            <span className="auth-prism-line auth-prism-line-one" />
                            <span className="auth-prism-line auth-prism-line-two" />
                        </div>
                        <div className="auth-prism-chip auth-prism-chip-one"><BookOpen size={20} /></div>
                        <div className="auth-prism-chip auth-prism-chip-two"><Code2 size={20} /></div>
                        <div className="auth-prism-chip auth-prism-chip-three"><BrainCircuit size={20} /></div>
                        <div className="auth-prism-chip auth-prism-chip-four"><Cloud size={20} /></div>
                    </div>
                </section>

                <MotionDiv
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    className="auth-action-panel w-100 transition-all"
                >
                    {initialDataError ? (
                        <div className="auth-panel-content text-center">
                            <div className="auth-panel-icon mx-auto text-warning">
                                <X size={30} />
                            </div>
                            <h2 className="auth-title-sm">Connection issue</h2>
                            <p className="auth-subtitle-sm">Catalog unavailable. Try again.</p>
                            <button
                                onClick={fetchDepartments}
                                className={`auth-primary-action ${departmentsLoading ? 'is-disabled' : ''}`}
                                disabled={departmentsLoading}
                            >
                                {departmentsLoading ? <Loader className="animate-spin" size={20} /> : 'Retry Connection'}
                            </button>
                        </div>
                    ) : step === 1 ? (
                        <div className="auth-panel-content">
                            <div className="auth-panel-heading">
                                <div className="auth-panel-icon">
                                    <Fingerprint size={30} />
                                </div>
                                <span>Secure access</span>
                                <h2>Welcome back</h2>
                                <p>Puter account</p>
                            </div>

                            {/* Consent Checkboxes */}
                            <div className="auth-consent">
                                <label className="auth-check-row">
                                    <div className="position-relative flex-shrink-0 mt-1">
                                        <input
                                            type="checkbox"
                                            className="auth-checkbox"
                                            checked={privacyAgreed}
                                            onChange={(e) => setPrivacyAgreed(e.target.checked)}
                                        />
                                        <Check
                                            size={12}
                                            className="position-absolute top-50 start-50 translate-middle text-white pointer-events-none transition-opacity"
                                            style={{ opacity: privacyAgreed ? 1 : 0 }}
                                            strokeWidth={4}
                                        />
                                    </div>
                                    <span className="text-secondary small leading-relaxed select-none">
                                        Agree to{' '}
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); setActiveDocument('privacy'); }}
                                            className="auth-inline-link"
                                        >
                                            Privacy Policy
                                        </button>
                                    </span>
                                </label>

                                <label className="auth-check-row">
                                    <div className="position-relative flex-shrink-0 mt-1">
                                        <input
                                            type="checkbox"
                                            className="auth-checkbox"
                                            checked={termsAgreed}
                                            onChange={(e) => setTermsAgreed(e.target.checked)}
                                        />
                                        <Check
                                            size={12}
                                            className="position-absolute top-50 start-50 translate-middle text-white pointer-events-none transition-opacity"
                                            style={{ opacity: termsAgreed ? 1 : 0 }}
                                            strokeWidth={4}
                                        />
                                    </div>
                                    <span className="text-secondary small leading-relaxed select-none">
                                        Agree to{' '}
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); setActiveDocument('terms'); }}
                                            className="auth-inline-link"
                                        >
                                            User Agreement
                                        </button>
                                    </span>
                                </label>
                            </div>

                            {loginError && (
                                <MotionDiv
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="alert alert-danger border-0 small py-2 mb-4 d-flex align-items-center gap-2"
                                    style={{ borderRadius: '12px' }}
                                >
                                    <X size={16} /> {loginError}
                                </MotionDiv>
                            )}

                            <MotionButton
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={handlePuterAuth}
                                disabled={loading || !allAgreed}
                                className={`auth-primary-action ${(!allAgreed || loading) ? 'is-disabled' : ''}`}
                            >
                                {loading ? <Loader className="animate-spin" size={24} /> : (
                                    <>
                                        <Cloud size={20} />
                                        Continue with Puter
                                    </>
                                )}
                            </MotionButton>

                            <div className="text-center mt-4">
                                <p className="mb-0 text-muted fw-medium small">
                                    Secret UID?
                                    <button
                                        onClick={() => { setStep(3); setLoginError(null); }}
                                        className="auth-inline-link ms-2"
                                    >
                                        Legacy login
                                    </button>
                                </p>
                            </div>
                        </div>
                    ) : step === 2 ? (
                    // Step 2: Profile setup details
                    <form onSubmit={handleSubmit} className="auth-panel-content">
                        <div className="auth-panel-heading">
                            <div className="auth-panel-icon">
                                <User size={28} />
                            </div>
                            <span>Profile setup</span>
                            <h2>Your profile</h2>
                            <p>Department + semester</p>
                            {puterUser?.username && (
                                <div className="auth-connected-line">
                                    <Check size={15} />
                                    Connected as {puterUser.username}
                                </div>
                            )}
                        </div>

                        <div className="mb-4">
                            <label className="fw-bold small text-muted mb-2">Phone Number</label>
                            <div className="clay-input d-flex align-items-center p-3 gap-3">
                                <span className="text-muted fw-bold">+91</span>
                                <input
                                    required
                                    type="tel"
                                    className="border-0 bg-transparent w-100 fw-medium"
                                    style={{ color: 'inherit', outline: 'none' }}
                                    placeholder="Enter your phone number"
                                    value={formData.phone_number}
                                    onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="fw-bold small text-muted mb-2">Full Name</label>
                            <div className="clay-input d-flex align-items-center p-3 gap-3">
                                <User size={20} className="text-muted" />
                                <input
                                    required
                                    className="border-0 bg-transparent w-100 fw-medium"
                                    style={{ color: 'inherit', outline: 'none' }}
                                    placeholder="Enter your name"
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="row g-3 mb-4">
                            <div className="col-12">
                                <label className="fw-bold small text-muted mb-2">Department</label>
                                <select
                                    required
                                    className="clay-input w-100 p-3"
                                    value={formData.department_id}
                                    onChange={handleDeptChange}
                                    style={{ color: 'inherit' }}
                                >
                                    <option value="" style={{ color: '#0f172a', background: '#ffffff' }}>Select Department</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id} style={{ color: '#0f172a', background: '#ffffff' }}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-6">
                                <label className="fw-bold small text-muted mb-2">Semester</label>
                                <select
                                    required
                                    disabled={!formData.department_id}
                                    className="clay-input w-100 p-3"
                                    value={formData.semester_id}
                                    onChange={handleSemChange}
                                    style={{ color: 'inherit' }}
                                >
                                    <option value="" style={{ color: '#0f172a', background: '#ffffff' }}>Select Sem</option>
                                    {semesters.map(s => (
                                        <option key={s.id} value={s.id} style={{ color: '#0f172a', background: '#ffffff' }}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-6">
                                <label className="fw-bold small text-muted mb-2">Current Year</label>
                                <select
                                    required
                                    className="clay-input w-100 p-3"
                                    value={formData.year}
                                    onChange={e => setFormData({ ...formData, year: e.target.value })}
                                    style={{ color: 'inherit' }}
                                >
                                    {[1, 2, 3, 4].map(y => <option key={y} value={y} style={{ color: '#0f172a', background: '#ffffff' }}>{y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year</option>)}
                                </select>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !formData.semester_id || !formData.full_name || !formData.phone_number}
                            className={`auth-primary-action ${(!formData.semester_id || !formData.full_name || !formData.phone_number || loading) ? 'is-disabled' : ''}`}
                        >
                            {loading ? <Loader className="animate-spin" /> : (
                                <>
                                    Complete Setup <ChevronRight size={20} />
                                </>
                            )}
                        </button>

                        <div className="text-center mt-4">
                            <button
                                type="button"
                                onClick={() => { setStep(1); setPuterUser(null); }}
                                className="auth-back-link"
                            >
                                <ArrowLeft size={15} />
                                Back
                            </button>
                        </div>
                    </form>
                ) : (
                    // Step 3: Legacy UID Login
                    <form onSubmit={handleLogin} className="auth-panel-content">
                        <div className="auth-panel-heading">
                            <div className="auth-panel-icon">
                                <KeyRound size={28} />
                            </div>
                            <span>Legacy access</span>
                            <h2>Secret UID</h2>
                            <p>Paste your key</p>
                        </div>

                        <div className="mb-4">
                            <label className="fw-bold small text-muted mb-2">Secret UID</label>
                            <div className="clay-input d-flex align-items-center p-3 gap-3">
                                <KeyRound size={20} className="text-muted" />
                                <input
                                    required
                                    className="border-0 bg-transparent w-100 fw-medium"
                                    style={{ color: 'inherit', outline: 'none' }}
                                    placeholder="Paste your UID here..."
                                    value={loginUid}
                                    onChange={e => setLoginUid(e.target.value)}
                                />
                            </div>

                            {loginError && (
                                <MotionDiv
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="alert alert-danger border-0 small py-2 mb-4 d-flex align-items-center gap-2"
                                    style={{ borderRadius: '12px' }}
                                >
                                    <X size={16} /> {loginError}
                                </MotionDiv>
                            )}
                        </div>

                        {/* Consent Checkboxes for Legacy UID */}
                        <div className="auth-consent">
                            <label className="auth-check-row">
                                <div className="position-relative flex-shrink-0 mt-1">
                                    <input
                                        type="checkbox"
                                        className="auth-checkbox"
                                        checked={privacyAgreed}
                                        onChange={(e) => setPrivacyAgreed(e.target.checked)}
                                    />
                                    <Check
                                        size={12}
                                        className="position-absolute top-50 start-50 translate-middle text-white pointer-events-none transition-opacity"
                                        style={{ opacity: privacyAgreed ? 1 : 0 }}
                                        strokeWidth={4}
                                    />
                                </div>
                                <span className="text-secondary small leading-relaxed select-none">
                                    Agree to{' '}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); setActiveDocument('privacy'); }}
                                        className="auth-inline-link"
                                    >
                                        Privacy Policy
                                    </button>
                                </span>
                            </label>

                            <label className="auth-check-row">
                                <div className="position-relative flex-shrink-0 mt-1">
                                    <input
                                        type="checkbox"
                                        className="auth-checkbox"
                                        checked={termsAgreed}
                                        onChange={(e) => setTermsAgreed(e.target.checked)}
                                    />
                                    <Check
                                        size={12}
                                        className="position-absolute top-50 start-50 translate-middle text-white pointer-events-none transition-opacity"
                                        style={{ opacity: termsAgreed ? 1 : 0 }}
                                        strokeWidth={4}
                                    />
                                </div>
                                <span className="text-secondary small leading-relaxed select-none">
                                    Agree to{' '}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); setActiveDocument('terms'); }}
                                        className="auth-inline-link"
                                    >
                                        User Agreement
                                    </button>
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !loginUid || !allAgreed}
                            className={`auth-primary-action ${(!loginUid || !allAgreed || loading) ? 'is-disabled' : ''}`}
                        >
                            {loading ? <Loader className="animate-spin" /> : (
                                <>
                                    Login <LogIn size={20} />
                                </>
                            )}
                        </button>

                        <div className="text-center mt-4">
                            <button
                                type="button"
                                onClick={() => { setStep(1); setLoginError(null); }}
                                className="auth-back-link"
                            >
                                <ArrowLeft size={15} />
                                Back
                            </button>
                        </div>
                    </form>
                )}
            </MotionDiv>
            </main>

            {/* The Document View Modal */}
            <AnimatePresence>
                {activeDocument && (
                    <MotionDiv
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="auth-document-backdrop"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="auth-document-title"
                    >
                        <div
                            className="auth-document-dismiss"
                            onClick={() => setActiveDocument(null)}
                        />

                        <MotionDiv
                            initial={{ scale: 0.96, y: 22, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.96, y: 22, opacity: 0 }}
                            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                            className="auth-document-modal"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="auth-document-header">
                                <div className="auth-document-title-group">
                                    <div className="auth-document-icon">
                                        {activeDocument === 'privacy' ? (
                                            <ShieldCheck size={24} aria-hidden="true" />
                                        ) : (
                                            <FileText size={24} aria-hidden="true" />
                                        )}
                                    </div>
                                    <div>
                                        <span className="auth-document-kicker">
                                            {activeDocument === 'privacy' ? 'Data protection' : 'Platform terms'}
                                        </span>
                                        <h3 id="auth-document-title">
                                            {documents[activeDocument].title}
                                        </h3>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveDocument(null)}
                                    className="auth-document-close"
                                    aria-label="Close document"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="auth-document-body">
                                <div className="auth-document-scroll">
                                    <ReactMarkdown
                                        components={{
                                            hr: () => <div className="auth-document-rule" />,
                                        }}
                                    >
                                        {documents[activeDocument].content}
                                    </ReactMarkdown>
                                </div>
                            </div>

                            <div className="auth-document-footer">
                                <button
                                    type="button"
                                    onClick={() => setActiveDocument(null)}
                                    className="auth-document-secondary"
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (activeDocument === 'privacy') setPrivacyAgreed(true);
                                        if (activeDocument === 'terms') setTermsAgreed(true);
                                        setActiveDocument(null);
                                    }}
                                    className="auth-document-accept"
                                >
                                    <Check size={18} />
                                    Accept
                                </button>
                            </div>
                        </MotionDiv>
                    </MotionDiv>
                )}
            </AnimatePresence>
        </div >
    );
}
