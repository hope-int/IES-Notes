
import React, { useState, useRef, useEffect } from 'react';
import { extractTextFromPDF } from '../../utils/pdfUtils';
import { generateHandbook, checkRateLimit } from '../../utils/handbookGenerator';
import { saveHandbookToPuter, getHandbookHistory } from '../../utils/handbookStorage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Upload, FileText, Printer, Loader2, ArrowLeft, Plus, History, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import AILoader from '../AILoader';
import './Handbook.css';

const HandbookGenerator = ({ onBack }) => {
    const [status, setStatus] = useState('idle'); // idle, extracting, generating, success, error
    const [file, setFile] = useState(null);
    const [handbookContent, setHandbookContent] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // History State
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [hasLocalItems, setHasLocalItems] = useState(false); // Track if we have risky local items

    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    // Custom Code Component for Print Optimization
    const codeComponent = {
        code({ node, inline, className, children, ...props }) {
            return !inline ? (
                <span className="code-block-container" style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflow: 'visible',
                    width: '100%',
                    display: 'block' // Maintain block layout
                }}>
                    <code className={className} {...props}>
                        {children}
                    </code>
                </span>
            ) : (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        }
    };

    // Load history on mount
    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const data = await getHandbookHistory();
            setHistory(data || []);
            // Check if any are local
            if (data && data.length > 0) {
                setHasLocalItems(data.some(d => d.source === 'local' || d.isLocal));
            }
        } catch (e) {
            console.error("Failed to load history UI", e);
        }
    };

    // Handle internal back or provided onBack prop
    const handleBack = () => {
        if (onBack) onBack();
        else navigate('/');
    };

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.type !== 'application/pdf') {
                setErrorMsg("Please upload a valid PDF file.");
                return;
            }
            if (selectedFile.size > 7 * 1024 * 1024) {
                setErrorMsg("File size exceeds 7MB limit. Please upload a smaller file.");
                return;
            }
            setFile(selectedFile);
            startProcess(selectedFile);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const selectedFile = e.dataTransfer.files[0];
        if (selectedFile) {
            if (selectedFile.type !== 'application/pdf') {
                setErrorMsg("Please drop a valid PDF file.");
                return;
            }
            if (selectedFile.size > 7 * 1024 * 1024) {
                setErrorMsg("File size exceeds 7MB limit. Please upload a smaller file.");
                return;
            }
            setFile(selectedFile);
            startProcess(selectedFile);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const startProcess = async (uploadedFile) => {
        // Pre-check rate limit logic before doing anything UI heavy
        try {
            checkRateLimit();
        } catch (err) {
            setErrorMsg(err.message);
            return;
        }

        setStatus('extracting');
        setErrorMsg('');

        try {
            // 1. Extract Text
            const text = await extractTextFromPDF(uploadedFile);

            if (!text || text.length < 50) {
                throw new Error("Could not extract enough text from this PDF. It might be scanned or image-based.");
            }

            // 2. Generate Handbook
            setStatus('generating');
            const markdown = await generateHandbook(text);

            setHandbookContent(markdown);
            setStatus('success');

            // 3. Auto-save to History
            await saveHandbookToPuter(uploadedFile.name, markdown);
            loadHistory(); // Refresh list

        } catch (err) {
            console.error(err);
            setErrorMsg(err.message || "Something went wrong during generation.");
            setStatus('error');
        }
    };

    const loadFromHistory = (item) => {
        setFile({ name: item.title });
        setHandbookContent(item.content);
        setStatus('success');
        setShowHistory(false);
    };

    const handlePrint = () => {
        window.print();
    };

    const reset = () => {
        setStatus('idle');
        setFile(null);
        setHandbookContent('');
        setErrorMsg('');
    };

    return (
        <div className="handbook-page position-relative">
            {/* Top Navigation Bar - Hidden on Print */}
            <nav className="handbook-header-nav container-fluid d-flex align-items-center justify-content-between">
                <button onClick={handleBack} className="btn-back btn btn-link text-decoration-none">
                    <ArrowLeft size={20} />
                    <span>Back to Home</span>
                </button>

                <button
                    onClick={() => setShowHistory(true)}
                    className="btn btn-light rounded-pill d-flex align-items-center gap-2 shadow-sm text-secondary font-weight-bold"
                >
                    <History size={18} /> History
                </button>
            </nav>

            {/* History Sidebar */}
            <AnimatePresence>
                {showHistory && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowHistory(false)}
                            className="position-fixed top-0 start-0 w-100 h-100 bg-dark z-index-100"
                            style={{ zIndex: 100 }}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="position-fixed top-0 end-0 h-100 history-drawer bg-white p-4 d-flex flex-column"
                        >
                            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                                <h5 className="fw-bold m-0 d-flex align-items-center gap-2">
                                    <History size={20} className="text-primary" /> History
                                </h5>
                                <button onClick={() => setShowHistory(false)} className="btn btn-light rounded-circle p-2">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Local Storage Warning */}
                            {hasLocalItems && (
                                <div className="alert alert-warning mx-3 mb-3 p-2 d-flex align-items-start gap-2" style={{ fontSize: '0.8rem' }}>
                                    <div className="mt-1"><span role="img" aria-label="warning">⚠️</span></div>
                                    <div>
                                        <strong>Data Risk:</strong> Some items are saved locally because Cloud was unreachable. These will be lost if you clear browser data.
                                    </div>
                                </div>
                            )}

                            <div className="flex-grow-1 overflow-auto custom-scrollbar">
                                {history.length === 0 ? (
                                    <div className="text-center text-muted py-5">
                                        <p>No history found.</p>
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column gap-3">
                                        {history.map(item => (
                                            <div
                                                key={item.id}
                                                onClick={() => loadFromHistory(item)}
                                                className="history-item p-3 rounded bg-light border cursor-pointer hover-bg-gray-100"
                                            >
                                                <div className="d-flex justify-content-between align-items-start mb-1">
                                                    <h6 className="text-truncate fw-bold text-dark m-0">{item.title}</h6>
                                                    {item.source === 'local' || item.isLocal ? (
                                                        <span className="badge bg-warning text-dark" style={{ fontSize: '0.6rem' }}>Local</span>
                                                    ) : (
                                                        <span className="badge bg-success" style={{ fontSize: '0.6rem' }}>Cloud</span>
                                                    )}
                                                </div>
                                                <small className="text-muted d-flex align-items-center gap-1">
                                                    <Clock size={12} /> {new Date(item.createdAt).toLocaleDateString()}
                                                </small>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <div className="container py-4">
                <AnimatePresence mode="wait">
                    {/* IDLE / UPLOAD STATE */}
                    {(status === 'idle' || status === 'error') && (
                        <motion.div
                            key="upload"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="handbook-card justify-content-center align-items-center text-center p-5"
                            style={{ minHeight: '60vh' }}
                        >
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onClick={() => fileInputRef.current?.click()}
                                className="upload-zone cursor-pointer p-5 rounded-4 border-2 border-dashed border-primary bg-light w-100"
                                style={{ maxWidth: '600px' }}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="application/pdf"
                                    style={{ display: 'none' }}
                                />
                                <div className="mb-4 text-primary bg-white p-4 rounded-circle d-inline-block shadow-sm">
                                    <Upload size={48} />
                                </div>
                                <h2 className="h3 fw-bold mb-3 text-dark">Upload Course Material</h2>
                                <p className="text-muted mb-2">Drag & drop your PDF here or click to browse</p>
                                <p className="text-muted small mb-4">
                                    <span className="fw-bold text-danger">Max 7MB.</span>
                                    <br />
                                    For best results, upload <strong>module-wise PDFs</strong> (e.g., Module 1 notes only).
                                </p>
                                {errorMsg && <div className="alert alert-danger mt-3">{errorMsg}</div>}
                            </div>
                        </motion.div>
                    )}

                    {/* LOADING STATE */}
                    {(status === 'extracting' || status === 'generating') && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="handbook-card justify-content-center p-5"
                        >
                            <AILoader
                                title={status === 'extracting' ? 'Reading Document...' : 'Compressing Knowledge...'}
                                subtitle={status === 'extracting'
                                    ? 'Extracting the key concepts from your PDF.'
                                    : 'The AI is structuring your revision sheet. This may take a minute.'}
                            />
                        </motion.div>
                    )}

                    {/* SUCCESS / CONTENT STATE */}
                    {status === 'success' && (
                        <motion.div
                            key="content"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="handbook-card"
                        >
                            {/* Card Header */}
                            <div className="handbook-card-header">
                                <div className="handbook-title-group">
                                    <div className="doc-icon-wrapper">
                                        <FileText size={24} />
                                    </div>
                                    <div className="handbook-meta text-start">
                                        <h3>Handbook Ready</h3>
                                        <p>{file?.name || 'Generated Document'}</p>
                                    </div>
                                </div>
                                <div className="handbook-actions">
                                    <button onClick={reset} className="btn btn-outline-secondary d-flex align-items-center gap-2 rounded-pill px-4">
                                        <Plus size={18} /> <span className="d-none d-sm-inline">New</span>
                                    </button>
                                    <button onClick={handlePrint} className="btn btn-primary d-flex align-items-center gap-2 rounded-pill px-4 shadow-sm">
                                        <Printer size={18} /> <span>Print Handbook</span>
                                    </button>
                                </div>
                            </div>

                            {/* Handbook Body */}
                            <div className="handbook-body">
                                <div className="handbook-content">
                                    <h1 className="display-4 fw-bold mb-2">Exam Survival Kit</h1>
                                    <span className="handbook-subtitle">
                                        Generated by HOPE Edu Hub • {new Date().toLocaleDateString()}
                                    </span>

                                    <div className="markdown-content">
                                        {/* Split content for Print Layout */}
                                        {(() => {
                                            // Split by H2, keeping the delimiter attached to the following string is hard with split, 
                                            // so we use a lookahead or just standard split and reduce or regex match.
                                            // Simple approach: Split by logic
                                            const parts = handbookContent.split(/\n(?=## )/g);

                                            if (parts.length > 1) {
                                                return (
                                                    <>
                                                        {/* Header/Intro Section (H1) */}
                                                        <div className="handbook-header-section mb-4">
                                                            <ReactMarkdown
                                                                remarkPlugins={[remarkGfm, remarkMath]}
                                                                rehypePlugins={[rehypeKatex]}
                                                                components={codeComponent}
                                                            >
                                                                {parts[0]}
                                                            </ReactMarkdown>
                                                        </div>

                                                        {/* Grid Modules (H2s) */}
                                                        <div className="handbook-container">
                                                            {parts.slice(1).map((part, index) => (
                                                                <div key={index} className="handbook-module">
                                                                    <ReactMarkdown
                                                                        remarkPlugins={[remarkGfm, remarkMath]}
                                                                        rehypePlugins={[rehypeKatex]}
                                                                        components={codeComponent}
                                                                    >
                                                                        {part}
                                                                    </ReactMarkdown>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                );
                                            } else {
                                                // Fallback if no schema matched
                                                return (
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm, remarkMath]}
                                                        rehypePlugins={[rehypeKatex]}
                                                        components={codeComponent}
                                                    >
                                                        {handbookContent}
                                                    </ReactMarkdown>
                                                );
                                            }
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default HandbookGenerator;
