import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { motion } from 'framer-motion';
import { User, Book, ChevronRight, Loader } from 'lucide-react';

export default function Registration({ onComplete }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [semesters, setSemesters] = useState([]);

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
        setFormData({
            ...formData,
            semester_id: semId,
            semester_name: sem?.name || ''
        });
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
                college: 'IES College', // Default or add field if needed
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
            localStorage.setItem('ies_student_profile', JSON.stringify(profileData));

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
                        <Book size={32} />
                    </div>
                    <h2 className="fw-bold mb-2">Welcome to IES Notes</h2>
                    <p className="text-muted">Set up your profile to get started.</p>
                </div>

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
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !formData.semester_id || !formData.full_name || !formData.phone_number}
                        className="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                        style={{ backgroundColor: 'var(--primary-accent)' }}
                    >
                        {loading ? <Loader className="animate-spin" /> : (
                            <>
                                Sign In <ChevronRight size={20} />
                            </>
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
