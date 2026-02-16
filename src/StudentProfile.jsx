import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
    User, Upload, Link as LinkIcon, Youtube, Book,
    FileText, Globe, CheckCircle, AlertCircle, Loader,
    ChevronDown, MapPin, Calendar, Hash, Edit2, Save, X,
    LogOut, Shield, Copy, GraduationCap, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ... (imports remain)

export default function StudentProfile({ session, onBack, refreshProfile, onLogout, onOpenAdmin }) {
    // ... (state remains)
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [saveStatus, setSaveStatus] = useState(null);

    useEffect(() => {
        fetchProfile();
    }, [session]);

    const fetchProfile = async () => {
        // 1. Try Local Storage (Primary for Students)
        const localData = localStorage.getItem('hope_student_profile');
        if (localData) {
            const parsed = JSON.parse(localData);
            setProfile(parsed);
            setEditForm(parsed);
            setLoading(false);
            return;
        }

        // 2. Try Supabase Session (Secondary/Admins)
        if (session?.user?.id) {
            let { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();

            // Fallback: If DB is empty (sync delay), use Auth Metadata
            if (!data && session?.user?.user_metadata?.full_name) {

                const meta = session.user.user_metadata;
                data = {
                    id: session.user.id,
                    full_name: meta.full_name,
                    phone_number: meta.phone_number,
                    semester: meta.semester,
                    year: meta.year,
                    department: meta.department,
                    college: meta.college
                };
            }
            if (data) {
                setProfile(data);
                setEditForm(data);
            }
        }
        setLoading(false);
    };

    const handleSaveProfile = async () => {
        setSaveStatus('saving');
        try {
            const updates = {
                ...editForm,
                // Ensure ID is present. Use existing profile ID if session is missing (local storage case)
                id: session?.user?.id || profile.id,
                updated_at: new Date()
            };

            // 1. Update Supabase
            // Note: Since we allowed public updates on profiles in SQL, this works even without auth session
            const { error } = await supabase.from('profiles').upsert(updates);
            if (error) throw error;

            // 2. Update Local Storage (Crucial for No-Login Flow)
            localStorage.setItem('hope_student_profile', JSON.stringify(updates));

            setProfile(updates);
            setIsEditing(false);
            setSaveStatus('success');
            if (refreshProfile) refreshProfile();

            setTimeout(() => setSaveStatus(null), 3000);
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
        }
    };

    const handleCopyUID = () => {
        if (!profile?.id) return;
        navigator.clipboard.writeText(profile.id);
        alert("UID copied to clipboard! Keep it safe.");
    };

    return (
        <div className="container py-4">
            <button onClick={onBack} className="btn btn-link text-muted text-decoration-none mb-3 ps-0 d-flex align-items-center gap-2">
                <ArrowLeft size={18} /> Back to Home
            </button>

            <div className="row justify-content-center">
                {/* Modern ID Card Design */}
                <div className="col-12 col-md-8 col-lg-6">
                    <div className="clay-card overflow-hidden position-relative">
                        {/* Header Background */}
                        <div className="bg-primary bg-gradient p-4 text-center position-relative" style={{ height: '140px' }}>
                            <div className="position-absolute top-0 end-0 p-3">
                                {!isEditing ? (
                                    <button onClick={() => setIsEditing(true)} className="btn btn-sm btn-white-glass rounded-circle" title="Edit Profile">
                                        <Edit2 size={16} className="text-white" />
                                    </button>
                                ) : (
                                    <div className="d-flex gap-2">
                                        <button onClick={() => setIsEditing(false)} className="btn btn-sm btn-white-glass rounded-circle text-white">
                                            <X size={16} />
                                        </button>
                                        <button onClick={handleSaveProfile} className="btn btn-sm btn-white rounded-circle text-primary shadow-sm">
                                            <Save size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Profile Image & Info */}
                        <div className="px-4 pb-5 text-center" style={{ marginTop: '-60px' }}>
                            <div className="d-inline-block position-relative mb-3">
                                <div className="p-1 bg-white rounded-circle shadow-lg">
                                    <div className="rounded-circle bg-light d-flex align-items-center justify-content-center text-primary" style={{ width: 110, height: 110, fontSize: '2.5rem', fontWeight: 'bold' }}>
                                        {editForm.full_name?.charAt(0).toUpperCase() || <User size={48} />}
                                    </div>
                                </div>
                                <div className="position-absolute bottom-0 end-0 bg-success border border-4 border-white rounded-circle p-2" title="Active"></div>
                            </div>

                            {isEditing ? (
                                <div className="mb-3 d-flex flex-column gap-2 mx-auto" style={{ maxWidth: '300px' }}>
                                    <input
                                        className="form-control text-center fw-bold fs-4 border-0 shadow-none bg-light"
                                        placeholder="Full Name"
                                        value={editForm.full_name || ''}
                                        onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                                    />
                                    <input
                                        className="form-control text-center text-muted border-0 shadow-none bg-light"
                                        placeholder="Phone Number"
                                        value={editForm.phone_number || ''}
                                        onChange={e => setEditForm({ ...editForm, phone_number: e.target.value })}
                                    />
                                </div>
                            ) : (
                                <>
                                    <h3 className="fw-bold mb-1 text-dark">{profile?.full_name || 'Student'}</h3>
                                    <p className="text-muted mb-4">{profile?.phone_number || 'No Phone Linked'}</p>
                                </>
                            )}

                            {/* Stats / Details Grid */}
                            <div className="row g-3 text-start mt-2">
                                <div className="col-6">
                                    <ProfileCardItem isEditing={isEditing} icon={Hash} label="Semester" value={editForm.semester} onChange={v => setEditForm({ ...editForm, semester: v })} placeholder="S3" color="blue" />
                                </div>
                                <div className="col-6">
                                    <ProfileCardItem isEditing={isEditing} icon={Calendar} label="Year" value={editForm.year} onChange={v => setEditForm({ ...editForm, year: v })} placeholder="2nd" color="purple" />
                                </div>
                                <div className="col-12">
                                    <ProfileCardItem isEditing={isEditing} icon={MapPin} label="Department" value={editForm.department} onChange={v => setEditForm({ ...editForm, department: v })} placeholder="Computer Science" color="indigo" />
                                </div>
                                <div className="col-12">
                                    <ProfileCardItem isEditing={isEditing} icon={GraduationCap} label="College" value={editForm.college} onChange={v => setEditForm({ ...editForm, college: v })} placeholder="College Name" color="cyan" />
                                </div>
                            </div>

                            {/* UID Section */}
                            {!isEditing && (
                                <div className="mt-4 p-3 rounded-3 bg-light border border-secondary border-opacity-10 text-start d-flex align-items-center gap-3">
                                    <div className="p-2 rounded-circle bg-white shadow-sm text-muted"><User size={16} /></div>
                                    <div className="flex-grow-1 overflow-hidden">
                                        <div className="small text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>STUDENT UID (SECRET LOGIN KEY)</div>
                                        <div className="font-monospace fw-bold text-dark text-truncate">{profile?.id}</div>
                                    </div>
                                    <button onClick={handleCopyUID} className="btn btn-white shadow-sm p-2 rounded-circle" title="Copy">
                                        <Copy size={16} />
                                    </button>
                                </div>
                            )}

                            {saveStatus === 'success' && <div className="mt-3 text-success fw-bold animate-pulse">Profile updated successfully!</div>}
                            {saveStatus === 'error' && <div className="mt-3 text-danger fw-bold">Failed to update profile.</div>}
                        </div>

                        {/* Actions Footer */}
                        <div className="bg-light p-3 border-top d-flex gap-2 justify-content-center">
                            {profile?.is_admin && (
                                <button onClick={onOpenAdmin} className="btn btn-white shadow-sm flex-grow-1 text-primary fw-bold d-flex align-items-center justify-content-center gap-2">
                                    <Shield size={16} /> Admin
                                </button>
                            )}
                            <button onClick={onLogout} className="btn btn-white shadow-sm flex-grow-1 text-danger fw-bold d-flex align-items-center justify-content-center gap-2">
                                <LogOut size={16} /> Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                {`
                .btn-white-glass {
                    background: rgba(255, 255, 255, 0.2);
                    backdrop-filter: blur(4px);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
                .btn-white-glass:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
                .btn-white {
                    background: white;
                    border: 1px solid #e5e7eb;
                }
                `}
            </style>
        </div>
    );
}

const ProfileCardItem = ({ isEditing, icon: Icon, label, value, onChange, placeholder, color }) => (
    <div className="d-flex align-items-center gap-3 p-2 rounded-3 h-100" style={{ background: isEditing ? '#fff' : 'transparent' }}>
        <div className={`p-2 rounded-circle text-${color}-600 bg-${color}-50 shadow-sm flex-shrink-0`} style={{ background: `var(--bst-${color}-opacity, #eff6ff)`, color: `var(--bst-${color}, #2563eb)` }}>
            <Icon size={18} />
        </div>
        <div className="flex-grow-1 overflow-hidden">
            <div className="small text-muted fw-bold text-uppercase" style={{ fontSize: '0.65rem' }}>{label}</div>
            {isEditing ? (
                <input
                    className="form-control form-control-sm p-0 border-0 bg-transparent fw-bold shadow-none"
                    placeholder={placeholder}
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                />
            ) : (
                <div className="fw-bold text-dark text-truncate">{value || 'N/A'}</div>
            )}
        </div>
    </div>
);


