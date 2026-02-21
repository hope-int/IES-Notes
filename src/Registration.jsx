import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { User, GraduationCap, ChevronRight, Loader, LogIn, KeyRound, Check, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { PrivacyPolicy, UserAgreement } from './assets/legalDocs';

export default function Registration({ onComplete }) {
    const [step, setStep] = useState(1);
    const [isLoginMode, setIsLoginMode] = useState(false);
    const [loginUid, setLoginUid] = useState('');
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [semesters, setSemesters] = useState([]);

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

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        const { data } = await supabase.from('departments').select('*');
        if (data) setDepartments(data);
    };

    const fetchSemesters = async (deptId) => {
        const { data } = await supabase
            .from('semesters')
            .select('*')
            .eq('department_id', deptId)
            .order('name');
        if (data) setSemesters(data);
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
            // Extract semester number from name if possible, or assume based on logic
            // Assuming sem.name contains the number or we map it. 
            // Better approach: if we have the order, or just simple math if names are "Semester 1", etc.
            // Let's rely on the user input for now or try to parse `sem.name`

            // Simple parsing: "Semester 3" -> 3. "S3" -> 3.
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

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', loginUid.trim())
                .single();

            if (error || !data) {
                alert("Invalid UID. User not found.");
                setLoading(false);
                return;
            }

            // Save and Complete
            localStorage.setItem('hope_student_profile', JSON.stringify(data));
            onComplete(data);
        } catch (err) {
            console.error(err);
            alert("Login failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Generate a random UUID for the student since we aren't using Auth
            const newId = crypto.randomUUID();

            const profileData = {
                id: newId,
                full_name: formData.full_name,
                phone_number: formData.phone_number,
                department: formData.department_name,
                semester: formData.semester_name,
                year: formData.year, // "1", "2", etc
                department_id: formData.department_id, // Important for deep linking
                semester_id: formData.semester_id,     // Important for deep linking
                college: 'HOPE Community', // Default or add field if needed
                is_admin: false,
                created_at: new Date().toISOString()
            };

            // 1. Insert into Supabase (Public insert allowed by our new SQL)
            const { error } = await supabase.from('profiles').insert(profileData);

            if (error) {
                console.error("Supabase Insert Error:", error);
                throw error;
            }

            // 2. Save to Local Storage
            localStorage.setItem('hope_student_profile', JSON.stringify(profileData));

            // 3. Complete
            onComplete(profileData);

        } catch (error) {
            alert('Error registering. Please try again. ' + (error.message || ''));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center p-4 bg-light">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="clay-card p-4 p-md-5 w-100"
                style={{ maxWidth: '500px' }}
            >
                <div className="text-center mb-5">
                    <div className="bg-primary rounded-circle d-inline-flex p-3 mb-3 text-white shadow-sm">
                        <GraduationCap size={32} />
                    </div>
                    <h2 className="fw-bold mb-2">Welcome to HOPE Edu Hub</h2>
                    <p className="text-muted">
                        {isLoginMode ? "Enter your Secret UID to continue." : "Set up your profile to get started."}
                    </p>

                    <div className="d-flex justify-content-center gap-2 mt-3 p-1 bg-white rounded-pill border d-inline-flex">
                        <button
                            onClick={() => setIsLoginMode(false)}
                            className={`btn btn-sm rounded-pill px-3 fw-bold ${!isLoginMode ? 'btn-secondary text-white' : 'text-muted'}`}
                        >
                            Register
                        </button>
                        <button
                            onClick={() => setIsLoginMode(true)}
                            className={`btn btn-sm rounded-pill px-3 fw-bold ${isLoginMode ? 'btn-primary text-white' : 'text-muted'}`}
                        >
                            Login
                        </button>
                    </div>
                </div>

                {isLoginMode ? (
                    <form onSubmit={handleLogin}>
                        <div className="mb-4">
                            <label className="fw-bold small text-muted mb-2">Secret UID</label>
                            <div className="clay-input d-flex align-items-center p-3 gap-3">
                                <KeyRound size={20} className="text-muted" />
                                <input
                                    required
                                    className="border-0 bg-transparent w-100 fw-medium"
                                    placeholder="Paste your UID here..."
                                    value={loginUid}
                                    onChange={e => setLoginUid(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Consent Checkboxes */}
                        <div className="space-y-4 mb-4 text-start">
                            <label className="d-flex align-items-start gap-3 w-100 mb-2 cursor-pointer group">
                                <div className="position-relative flex-shrink-0 mt-1">
                                    <input
                                        type="checkbox"
                                        className="appearance-none rounded-circle border border-secondary transition-all cursor-pointer"
                                        style={{ width: '24px', height: '24px', backgroundColor: privacyAgreed ? 'purple' : 'transparent', borderColor: privacyAgreed ? 'purple' : '#ccc' }}
                                        checked={privacyAgreed}
                                        onChange={(e) => setPrivacyAgreed(e.target.checked)}
                                    />
                                    <Check
                                        size={14}
                                        className="position-absolute top-50 start-50 translate-middle text-white pointer-events-none transition-opacity"
                                        style={{ opacity: privacyAgreed ? 1 : 0 }}
                                        strokeWidth={4}
                                    />
                                </div>
                                <span className="text-secondary small leading-relaxed select-none">
                                    I have read and agree to the{' '}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); setActiveDocument('privacy'); }}
                                        className="btn btn-link p-0 text-decoration-none fw-bold"
                                        style={{ color: 'purple' }}
                                    >
                                        Privacy Policy
                                    </button>
                                </span>
                            </label>

                            <label className="d-flex align-items-start gap-3 w-100 mb-4 cursor-pointer group">
                                <div className="position-relative flex-shrink-0 mt-1">
                                    <input
                                        type="checkbox"
                                        className="appearance-none rounded-circle border border-secondary transition-all cursor-pointer"
                                        style={{ width: '24px', height: '24px', backgroundColor: termsAgreed ? 'purple' : 'transparent', borderColor: termsAgreed ? 'purple' : '#ccc' }}
                                        checked={termsAgreed}
                                        onChange={(e) => setTermsAgreed(e.target.checked)}
                                    />
                                    <Check
                                        size={14}
                                        className="position-absolute top-50 start-50 translate-middle text-white pointer-events-none transition-opacity"
                                        style={{ opacity: termsAgreed ? 1 : 0 }}
                                        strokeWidth={4}
                                    />
                                </div>
                                <span className="text-secondary small leading-relaxed select-none">
                                    I have read and agree to the{' '}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); setActiveDocument('terms'); }}
                                        className="btn btn-link p-0 text-decoration-none fw-bold"
                                        style={{ color: 'indigo' }}
                                    >
                                        User Agreement
                                    </button>
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !loginUid || !allAgreed}
                            className={`btn w-100 py-3 rounded-pill fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 ${(!loginUid || !allAgreed) ? 'btn-secondary text-white-50' : 'btn-primary'}`}
                        >
                            {loading ? <Loader className="animate-spin" /> : (
                                <>
                                    Login <LogIn size={20} />
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="fw-bold small text-muted mb-2">Phone Number</label>
                            <div className="clay-input d-flex align-items-center p-3 gap-3">
                                <span className="text-muted fw-bold">+91</span>
                                <input
                                    required
                                    type="tel"
                                    className="border-0 bg-transparent w-100 fw-medium"
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
                                    className="clay-input w-100 p-3 bg-white border-0"
                                    value={formData.department_id}
                                    onChange={handleDeptChange}
                                >
                                    <option value="">Select Department</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-6">
                                <label className="fw-bold small text-muted mb-2">Semester</label>
                                <select
                                    required
                                    disabled={!formData.department_id}
                                    className="clay-input w-100 p-3 bg-white border-0"
                                    value={formData.semester_id}
                                    onChange={handleSemChange}
                                >
                                    <option value="">Select Sem</option>
                                    {semesters.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-6">
                                <label className="fw-bold small text-muted mb-2">Current Year</label>
                                <select
                                    required
                                    className="clay-input w-100 p-3 bg-white border-0"
                                    value={formData.year}
                                    onChange={e => setFormData({ ...formData, year: e.target.value })}
                                >
                                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Consent Checkboxes */}
                        <div className="space-y-4 mb-4 text-start">
                            <label className="d-flex align-items-start gap-3 w-100 mb-2 cursor-pointer group">
                                <div className="position-relative flex-shrink-0 mt-1">
                                    <input
                                        type="checkbox"
                                        className="appearance-none rounded-circle border border-secondary transition-all cursor-pointer"
                                        style={{ width: '24px', height: '24px', backgroundColor: privacyAgreed ? 'purple' : 'transparent', borderColor: privacyAgreed ? 'purple' : '#ccc' }}
                                        checked={privacyAgreed}
                                        onChange={(e) => setPrivacyAgreed(e.target.checked)}
                                    />
                                    <Check
                                        size={14}
                                        className="position-absolute top-50 start-50 translate-middle text-white pointer-events-none transition-opacity"
                                        style={{ opacity: privacyAgreed ? 1 : 0 }}
                                        strokeWidth={4}
                                    />
                                </div>
                                <span className="text-secondary small leading-relaxed select-none">
                                    I have read and agree to the{' '}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); setActiveDocument('privacy'); }}
                                        className="btn btn-link p-0 text-decoration-none fw-bold"
                                        style={{ color: 'purple' }}
                                    >
                                        Privacy Policy
                                    </button>
                                </span>
                            </label>

                            <label className="d-flex align-items-start gap-3 w-100 mb-4 cursor-pointer group">
                                <div className="position-relative flex-shrink-0 mt-1">
                                    <input
                                        type="checkbox"
                                        className="appearance-none rounded-circle border border-secondary transition-all cursor-pointer"
                                        style={{ width: '24px', height: '24px', backgroundColor: termsAgreed ? 'purple' : 'transparent', borderColor: termsAgreed ? 'purple' : '#ccc' }}
                                        checked={termsAgreed}
                                        onChange={(e) => setTermsAgreed(e.target.checked)}
                                    />
                                    <Check
                                        size={14}
                                        className="position-absolute top-50 start-50 translate-middle text-white pointer-events-none transition-opacity"
                                        style={{ opacity: termsAgreed ? 1 : 0 }}
                                        strokeWidth={4}
                                    />
                                </div>
                                <span className="text-secondary small leading-relaxed select-none">
                                    I have read and agree to the{' '}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); setActiveDocument('terms'); }}
                                        className="btn btn-link p-0 text-decoration-none fw-bold"
                                        style={{ color: 'indigo' }}
                                    >
                                        User Agreement
                                    </button>
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !formData.semester_id || !formData.full_name || !formData.phone_number || !allAgreed}
                            className={`btn w-100 py-3 rounded-pill fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 ${(!formData.semester_id || !formData.full_name || !formData.phone_number || !allAgreed) ? 'btn-secondary text-white-50' : 'btn-primary'}`}
                            style={{ backgroundColor: (!formData.semester_id || !formData.full_name || !formData.phone_number || !allAgreed) ? '' : 'var(--primary-accent)' }}
                        >
                            {loading ? <Loader className="animate-spin" /> : (
                                <>
                                    Sign In <ChevronRight size={20} />
                                </>
                            )}
                        </button>

                    </form>
                )}
            </motion.div>

            {/* The Document View Modal */}
            <AnimatePresence>
                {activeDocument && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 z-3"
                        style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
                    >
                        {/* Backdrop for the inner modal */}
                        <div
                            className="position-absolute top-0 start-0 w-100 h-100"
                            onClick={() => setActiveDocument(null)}
                        />

                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="position-relative bg-white w-100 rounded-4 shadow-lg d-flex flex-column overflow-hidden"
                            style={{ maxWidth: '600px', maxHeight: '90vh' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="d-flex align-items-center justify-content-between p-4 border-bottom bg-light">
                                <h4 className="fw-bold mb-0 text-dark">
                                    {documents[activeDocument].title}
                                </h4>
                                <button
                                    onClick={() => setActiveDocument(null)}
                                    className="btn btn-light rounded-circle p-2 d-flex align-items-center justify-content-center"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-4 overflow-auto prose prose-sm" style={{ maxHeight: '60vh', textAlign: 'left' }}>
                                <ReactMarkdown>
                                    {documents[activeDocument].content}
                                </ReactMarkdown>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-top bg-light d-flex justify-content-end">
                                <button
                                    onClick={() => {
                                        if (activeDocument === 'privacy') setPrivacyAgreed(true);
                                        if (activeDocument === 'terms') setTermsAgreed(true);
                                        setActiveDocument(null);
                                    }}
                                    className="btn btn-dark fw-bold px-4 py-2"
                                >
                                    Accept & Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
