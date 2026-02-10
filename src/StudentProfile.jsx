import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
    User, Upload, Link as LinkIcon, Youtube, Book,
    FileText, Globe, CheckCircle, AlertCircle, Loader,
    ChevronDown, MapPin, Calendar, Hash, Edit2, Save, X,
    LogOut, Shield, Copy
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
        const localData = localStorage.getItem('ies_student_profile');
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
                console.log("Profile missing in DB, using Metadata...");
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
            localStorage.setItem('ies_student_profile', JSON.stringify(updates));

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
            <button onClick={onBack} className="btn btn-link text-muted text-decoration-none mb-3 ps-0">
                ← Back to Home
            </button>

            <div className="row justify-content-center">
                {/* Profile Card */}
                <div className="col-lg-6">
                    <div className="clay-card p-5 text-center h-100 position-relative">
                        <div className="position-absolute top-0 end-0 p-3">
                            {!isEditing ? (
                                <button onClick={() => setIsEditing(true)} className="btn btn-sm btn-light rounded-circle shadow-sm" title="Edit Profile">
                                    <Edit2 size={16} className="text-secondary" />
                                </button>
                            ) : (
                                <div className="d-flex gap-2">
                                    <button onClick={() => setIsEditing(false)} className="btn btn-sm btn-light rounded-circle shadow-sm text-danger">
                                        <X size={16} />
                                    </button>
                                    <button onClick={handleSaveProfile} className="btn btn-sm btn-primary rounded-circle shadow-sm text-white">
                                        <Save size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="position-relative d-inline-block mb-3">
                            <div className="p-4 rounded-circle shadow-inner bg-light d-inline-flex align-items-center justify-content-center" style={{ width: 120, height: 120 }}>
                                <span className="display-4 fw-bold text-primary">
                                    {editForm.full_name?.charAt(0).toUpperCase() || <User size={48} />}
                                </span>
                            </div>
                            <div className="position-absolute bottom-0 end-0 bg-success border border-white rounded-circle p-2"></div>
                        </div>

                        {isEditing ? (
                            <div className="mb-4 d-flex flex-column gap-2 mx-auto" style={{ maxWidth: '300px' }}>
                                <input className="form-control form-control-sm text-center fw-bold" placeholder="Full Name" value={editForm.full_name || ''} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} />
                            </div>
                        ) : (
                            <>
                                <h3 className="fw-bold mb-1">{profile?.full_name || 'Student'}</h3>
                                <p className="text-muted mb-4">{profile?.phone_number || 'No Phone'}</p>
                            </>
                        )}

                        <div className="text-start d-flex flex-column gap-3 bg-white bg-opacity-50 p-4 rounded-4 mx-auto" style={{ maxWidth: '400px' }}>
                            <ProfileField isEditing={isEditing} icon={Hash} label="Semester" value={editForm.semester} onChange={v => setEditForm({ ...editForm, semester: v })} placeholder="e.g. S3" />
                            <ProfileField isEditing={isEditing} icon={Calendar} label="Year" value={editForm.year} onChange={v => setEditForm({ ...editForm, year: v })} placeholder="e.g. 2nd Year" />
                            <ProfileField isEditing={isEditing} icon={MapPin} label="Department" value={editForm.department} onChange={v => setEditForm({ ...editForm, department: v })} placeholder="e.g. CSE" />
                            <ProfileField isEditing={isEditing} icon={Building2} label="College" value={editForm.college} onChange={v => setEditForm({ ...editForm, college: v })} placeholder="College Name" />

                            {/* UID Display */}
                            {!isEditing && (
                                <div className="d-flex align-items-center gap-3 border-top pt-3 mt-2">
                                    <div className="p-2 rounded-circle bg-light text-muted shadow-sm"><User size={16} /></div>
                                    <div className="flex-grow-1 overflow-hidden">
                                        <div className="small text-muted fw-bold text-uppercase" style={{ fontSize: '0.7rem' }}>STUDENT UID (Secret Login Key)</div>
                                        <div className="fw-bold text-truncate" style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{profile?.id}</div>
                                    </div>
                                    <button onClick={handleCopyUID} className="btn btn-sm btn-light rounded-circle" title="Copy UID">
                                        <Copy size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {saveStatus === 'success' && <div className="mt-3 text-success small fw-bold">Profile updated!</div>}
                        {saveStatus === 'error' && <div className="mt-3 text-danger small fw-bold">Failed to update.</div>}

                        <hr className="my-4 opacity-25" />

                        {profile?.is_admin && (
                            <button onClick={onOpenAdmin} className="btn btn-outline-primary rounded-pill px-4 w-100 d-flex align-items-center justify-content-center gap-2 mb-2">
                                <Shield size={18} /> Admin Panel
                            </button>
                        )}

                        <button onClick={onLogout} className="btn btn-outline-danger rounded-pill px-4 w-100 d-flex align-items-center justify-content-center gap-2">
                            <LogOut size={18} /> Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const ProfileField = ({ isEditing, icon, label, value, onChange, placeholder }) => (
    isEditing ? (
        <div className="d-flex align-items-center gap-2">
            <div className="p-2 rounded-circle bg-white text-primary shadow-sm flex-shrink-0"><span className="small text-uppercase fw-bold" style={{ fontSize: 10 }}>{label.substring(0, 3)}</span></div>
            <input className="form-control form-control-sm border-0 bg-white" placeholder={placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />
        </div>
    ) : (
        <ProfileMeta icon={icon} label={label} value={value || 'N/A'} />
    )
);

// Helper for the icon in InputGroup
const Building2 = ({ className, size }) => (
    <Book className={className} size={size} /> // Shim if Building2 is missing from imports
);

const ProfileMeta = ({ icon: Icon, label, value }) => (
    <div className="d-flex align-items-center gap-3">
        <div className="p-2 rounded-circle bg-white text-primary shadow-sm"><Icon size={16} /></div>
        <div>
            <div className="small text-muted fw-bold text-uppercase" style={{ fontSize: '0.7rem' }}>{label}</div>
            <div className="fw-bold">{value}</div>
        </div>
    </div>
);
