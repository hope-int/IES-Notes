import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function PublicUploadModal({ subjectId, onClose, onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [linkUrl, setLinkUrl] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
            setLinkUrl(''); // Clear link if file selected
        }
    };

    const handleLinkChange = (e) => {
        setLinkUrl(e.target.value);
        if (e.target.value) setFile(null); // Clear file if link entered
    };

    const handleUpload = async (e) => {
        e.preventDefault();

        // 1. Validation (File OR Link)
        if ((!file && !linkUrl) || !title || !subjectId) {
            setMessage({ type: 'error', text: 'Please provide a Title and either a File or a Link.' });
            return;
        }

        // 2. File Size Check (6MB Limit)
        if (file) {
            const MAX_SIZE = 6 * 1024 * 1024; // 6MB
            if (file.size > MAX_SIZE) {
                setMessage({
                    type: 'error',
                    text: 'File exceeds 6MB limit. Please upload to Google Drive and paste the link below.'
                });
                return;
            }
        }

        setUploading(true);
        setMessage(null);

        try {
            let finalResourceUrl = linkUrl;

            // 3. Upload File if present
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `public_notes/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('notes')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('notes')
                    .getPublicUrl(filePath);

                finalResourceUrl = publicUrl;
            }

            // 4. Insert Record
            const { data: { user } } = await supabase.auth.getUser();
            const { error: dbError } = await supabase.from('notes').insert({
                title,
                description,
                file_url: finalResourceUrl,
                subject_id: subjectId,
                uploaded_by: user.id,
                resource_type: file ? 'note' : 'external_link',
                year: new Date().getFullYear()
            });

            if (dbError) throw dbError;

            setMessage({ type: 'success', text: 'Resource added successfully!' });
            setTimeout(() => {
                onUploadSuccess();
                onClose();
            }, 1000);

        } catch (error) {
            console.error(error);
            let msg = error.message;
            if (msg.includes('Rate Limit Exceeded')) {
                msg = msg.split('Rate Limit Exceeded:')[1] || msg;
            }
            setMessage({ type: 'error', text: msg });
        } finally {
            setUploading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-4"
            style={{ zIndex: 1050, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)' }}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="clay-card p-4 w-100"
                style={{ maxWidth: '450px', background: 'var(--bg-color)' }}
            >
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">
                        <Upload size={20} className="text-primary" /> Upload Resource
                    </h5>
                    <button onClick={onClose} className="btn-close shadow-none"></button>
                </div>

                {message && (
                    <div className={`alert ${message.type === 'error' ? 'alert-danger' : 'alert-success'} d-flex align-items-center gap-2 p-2 small mb-3`}>
                        {message.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleUpload}>
                    <div className="mb-3">
                        <label className="form-label small fw-bold text-muted">Title / Topic</label>
                        <input
                            type="text"
                            className="form-control border-0 bg-light"
                            placeholder="e.g. Module 1 Notes"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className="mb-3">
                        <label className="form-label small fw-bold text-muted">Description (Optional)</label>
                        <textarea
                            className="form-control border-0 bg-light"
                            rows="2"
                            placeholder="Brief details..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        ></textarea>
                    </div>

                    {/* File vs Link Selection */}
                    <div className="mb-3 p-3 bg-light rounded-3">
                        <div className="mb-3">
                            <label className="form-label small fw-bold text-muted">Option A: Upload File (Max 6MB)</label>
                            <input
                                type="file"
                                className="form-control"
                                onChange={handleFileChange}
                                disabled={!!linkUrl}
                                ref={input => input && !file && (input.value = '')}
                            />
                        </div>

                        <div className="text-center text-muted small fw-bold my-2">- OR -</div>

                        <div className="mb-0">
                            <label className="form-label small fw-bold text-muted">Option B: External Link</label>
                            <input
                                type="url"
                                className="form-control border-0 bg-white"
                                placeholder="https://drive.google.com/..."
                                value={linkUrl}
                                onChange={handleLinkChange}
                                disabled={!!file}
                            />
                            <div className="form-text x-small">Use this for large files (&gt;6MB) or videos.</div>
                        </div>
                    </div>

                    <div className="d-flex justify-content-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="btn btn-light text-muted fw-bold">Cancel</button>
                        <button type="submit" disabled={uploading} className="btn btn-primary fw-bold d-flex align-items-center gap-2">
                            {uploading ? <Loader size={18} className="animate-spin" /> : <Upload size={18} />}
                            {file ? 'Upload File' : 'Save Link'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}
