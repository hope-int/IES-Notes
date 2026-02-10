import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FolderPlus, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function CreateFolderModal({ type, parentId, onClose, onSuccess }) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setLoading(true);
        setMessage(null);

        try {
            const tableName = type === 'sem' ? 'semesters' : 'subjects';
            const parentKey = type === 'sem' ? 'department_id' : 'semester_id';

            const { error } = await supabase.from(tableName).insert({
                name: name,
                [parentKey]: parentId
            });

            if (error) throw error;

            setMessage({ type: 'success', text: `${type === 'sem' ? 'Semester' : 'Subject'} created successfully!` });
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1000);

        } catch (error) {
            console.error(error);
            // Handle Custom SQL Errors (Rate Limits)
            let msg = error.message;
            if (msg.includes('Limit Reached')) {
                msg = msg.split('Limit Reached:')[1] || msg;
            }
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-4"
            style={{ zIndex: 1060, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)' }}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="clay-card p-4 w-100"
                style={{ maxWidth: '400px', background: 'var(--bg-color)' }}
            >
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">
                        <FolderPlus size={20} className="text-primary" />
                        New {type === 'sem' ? 'Semester' : 'Subject'}
                    </h5>
                    <button onClick={onClose} className="btn-close shadow-none"></button>
                </div>

                {message && (
                    <div className={`alert ${message.type === 'error' ? 'alert-danger' : 'alert-success'} d-flex align-items-center gap-2 p-2 small mb-3`}>
                        {message.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleCreate}>
                    <div className="mb-4">
                        <label className="form-label small fw-bold text-muted">Name</label>
                        <input
                            type="text"
                            className="form-control border-0 bg-light"
                            placeholder={type === 'sem' ? "e.g. Semester 9 (Extra)" : "e.g. Advanced AI"}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                        <div className="form-text small mt-2">
                            {type === 'sem' ? 'Max 8 Semesters allowed.' : 'Max 7 Subjects per Semester.'}
                        </div>
                    </div>

                    <div className="d-flex justify-content-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-light text-muted fw-bold">Cancel</button>
                        <button type="submit" disabled={loading} className="btn btn-primary fw-bold d-flex align-items-center gap-2">
                            {loading ? <Loader size={18} className="animate-spin" /> : <FolderPlus size={18} />}
                            Create
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}
