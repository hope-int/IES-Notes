
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Download, Printer, Edit3, Eye, FileText,
    ChevronLeft, ChevronRight, Share2, Sparkles, Layout, Bot, Send
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DocumentViewer = ({ isOpen, onClose, content, title, onPrint, onDownload, onRefine, onExportToMain }) => {
    const [viewMode, setViewMode] = useState('split'); // 'edit', 'preview', 'split'
    const [editableContent, setEditableContent] = useState('');
    const [studioMessages, setStudioMessages] = useState([]);
    const [studioInput, setStudioInput] = useState('');
    const [isRefining, setIsRefining] = useState(false);

    // Initial hydration & Sync
    React.useEffect(() => {
        if (content && (!editableContent || !isOpen)) {
            setEditableContent(content);
            // Reset chat history if it's a new document
            setStudioMessages([]);
        }
    }, [content, isOpen]);

    const handleStudioSend = async () => {
        if (!studioInput.trim() || isRefining) return;

        const userMsg = { role: 'user', content: studioInput };
        setStudioMessages(prev => [...prev, userMsg]);
        setStudioInput('');
        setIsRefining(true);

        try {
            if (onRefine) {
                const updatedDoc = await onRefine(editableContent, studioInput, studioMessages);
                setEditableContent(updatedDoc);
                setStudioMessages(prev => [...prev, { role: 'assistant', content: 'Document updated per instructions.' }]);
            }
        } catch (e) {
            setStudioMessages(prev => [...prev, { role: 'assistant', content: 'Refinement failed. Please try again.' }]);
        } finally {
            setIsRefining(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-end" style={{ zIndex: 1100 }}>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-40"
                        style={{ backdropFilter: 'blur(8px)' }}
                    />

                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: "spring", stiffness: 200, damping: 25 }}
                        className="position-relative bg-white h-100 shadow-2xl d-flex flex-column"
                        style={{ width: '90%', maxWidth: '1200px' }}
                    >

                        {/* Header */}
                        <div className="px-5 py-4 border-bottom d-flex align-items-center justify-content-between bg-white sticky-top">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-2-5 rounded-circle bg-white shadow-sm">
                                    <Bot size={20} className="text-primary" />
                                </div>
                                <div>
                                    <h5 className="fw-bold mb-0 text-dark">HOPE Document Studio</h5>
                                    <span className="x-small fw-bold text-muted uppercase tracking-wider" style={{ fontSize: '10px' }}>AI Research Analysis</span>
                                </div>
                            </div>

                            <div className="d-flex align-items-center gap-3">
                                <div className="bg-light p-1 rounded-pill d-flex">
                                    {[
                                        { id: 'edit', icon: Edit3, label: 'Editor' },
                                        { id: 'split', icon: Layout, label: 'Split' },
                                        { id: 'preview', icon: Eye, label: 'Review' }
                                    ].map((mode) => (
                                        <button
                                            key={mode.id}
                                            onClick={() => setViewMode(mode.id)}
                                            className={`btn border-0 rounded-pill px-3 py-1-5 d-flex align-items-center gap-2 transition-all ${viewMode === mode.id ? 'bg-white shadow-sm' : 'text-muted'}`}
                                            style={{
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                color: viewMode === mode.id ? '#003366' : '#94a3b8'
                                            }}
                                        >
                                            <mode.icon size={14} />
                                            <span className="d-none d-md-inline">{mode.label}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="vr mx-2" style={{ height: '30px', opacity: 0.1 }}></div>

                                <button
                                    onClick={() => onExportToMain(editableContent)}
                                    className="btn btn-outline-primary rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-2 border-opacity-25"
                                    style={{ fontSize: '11px' }}
                                    title="Push to Main Chat"
                                >
                                    <Share2 size={14} /> Export to Chat
                                </button>

                                <button onClick={onDownload} className="btn btn-outline-secondary rounded-circle p-0 d-flex align-items-center justify-content-center border-opacity-25" style={{ width: 40, height: 40 }}><Download size={18} /></button>
                                <button
                                    onClick={onPrint}
                                    className="btn rounded-pill px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm border-0"
                                    style={{ backgroundColor: '#003366', color: 'white' }}
                                >
                                    <Printer size={18} /> <span className="d-none d-md-inline">Print PDF</span>
                                </button>
                                <button onClick={onClose} className="btn btn-light rounded-circle p-0 d-flex align-items-center justify-content-center ms-2" style={{ width: 40, height: 40 }}><X size={20} /></button>
                            </div>
                        </div>

                        {/* Document Content Area */}
                        <div className="flex-grow-1 overflow-auto bg-light bg-opacity-30 d-flex">
                            {/* Editor Panel */}
                            {(viewMode === 'edit' || viewMode === 'split') && (
                                <div className={`h-100 p-5 ${viewMode === 'split' ? 'w-50 border-end' : 'w-100'} bg-white position-relative`}>
                                    {isRefining && (
                                        <div className="position-absolute top-0 start-0 w-100 h-100 bg-white bg-opacity-50 d-flex align-items-center justify-content-center" style={{ zIndex: 10 }}>
                                            <div className="spinner-border text-primary" role="status"></div>
                                        </div>
                                    )}
                                    <textarea
                                        className="w-100 h-100 border-0 outline-none p-0 bg-transparent custom-scrollbar"
                                        style={{
                                            resize: 'none',
                                            fontFamily: "'Fira Code', monospace",
                                            fontSize: '14px',
                                            lineHeight: '1.8',
                                            color: '#334155'
                                        }}
                                        value={editableContent}
                                        onChange={(e) => setEditableContent(e.target.value)}
                                        placeholder="Start drafting your engineering document..."
                                    />
                                </div>
                            )}

                            {/* Studio Mode - Right Pane (Chat) */}
                            {viewMode === 'split' && (
                                <div className="w-50 h-100 d-flex flex-column bg-light bg-opacity-50">
                                    <div className="flex-grow-1 overflow-auto p-4 d-flex flex-column gap-3">
                                        <div className="p-3 bg-white rounded-4 border shadow-sm small">
                                            <div className="fw-bold mb-1 text-primary">Studio Assistant</div>
                                            <p className="mb-0 opacity-75">I can help you refine this document. Try commands like "Summarize", "Make it more technical", or "Add a table of contents".</p>
                                        </div>
                                        {studioMessages.map((msg, i) => (
                                            <div key={i} className={`p-3 rounded-4 shadow-sm max-w-85 ${msg.role === 'user' ? 'bg-primary text-white align-self-end' : 'bg-white border align-self-start'}`} style={{ fontSize: '13px' }}>
                                                {msg.content}
                                            </div>
                                        ))}
                                        {isRefining && (
                                            <div className="p-3 bg-white border rounded-4 align-self-start shadow-sm d-flex gap-2">
                                                <div className="spinner-grow spinner-grow-sm text-primary"></div>
                                                <span className="small fw-bold text-muted">Refining Architecture...</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 border-top bg-white">
                                        <div className="input-group">
                                            <input
                                                type="text"
                                                className="form-control border-light bg-light rounded-pill px-4 py-2 small"
                                                placeholder="Ask Studio to refine..."
                                                value={studioInput}
                                                onChange={(e) => setStudioInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleStudioSend()}
                                            />
                                            <button
                                                className="btn btn-primary rounded-pill px-4 ms-2 d-flex align-items-center justify-content-center"
                                                onClick={handleStudioSend}
                                                disabled={isRefining || !studioInput.trim()}
                                            >
                                                <Send size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Preview Panel (A4 Style) - Full view only */}
                            {viewMode === 'preview' && (
                                <div className="h-100 overflow-auto p-5 w-100">
                                    <div
                                        className="bg-white shadow-xl p-5 mb-5 mx-auto"
                                        style={{
                                            width: '210mm',
                                            minHeight: '297mm',
                                            height: 'auto',
                                            backgroundColor: 'white',
                                            position: 'relative',
                                            display: 'block'
                                        }}
                                    >
                                        <div className="document-render">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {editableContent}
                                            </ReactMarkdown>
                                        </div>
                                        {/* Preview Watermark - Flow naturally after content */}
                                        <div className="mt-5 pt-5 border-top text-center opacity-50">
                                            <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
                                                <div className="bg-primary rounded-circle" style={{ width: 4, height: 4 }}></div>
                                                <span className="x-small fw-bold text-muted uppercase tracking-widest" style={{ fontSize: '8px' }}>Security Verified Log</span>
                                            </div>
                                            <p className="text-muted x-small mb-0">Generated by HOPE AI Tutor • Engineering Workbench</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <style>{`
                            .document-render {
                                font-family: 'Merriweather', serif;
                                color: #1e293b;
                                line-height: 1.8;
                                word-break: break-word;
                                overflow-wrap: break-word;
                            }
                            .document-render h1, .document-render h2, .document-render h3 {
                                font-family: 'Outfit', sans-serif;
                                font-weight: 800;
                                border-bottom: 2px solid #f1f5f9;
                                padding-bottom: 1rem;
                                margin-top: 3rem;
                                color: #020617;
                            }
                            .document-render p { margin-bottom: 1.5rem; text-align: justify; }
                            .document-render blockquote {
                                border-left: 4px solid #3b82f6;
                                padding-left: 2rem;
                                font-style: italic;
                                background: #f8fafc;
                                padding: 2rem;
                                border-radius: 0 1rem 1rem 0;
                            }
                            /* Force images to fit */
                            .document-render img {
                                max-width: 100%;
                                height: auto;
                                display: block;
                                margin: 1.5rem auto;
                            }
                            /* Force Code Blocks to wrap or scroll internally */
                            .document-render pre {
                                background: #f1f5f9;
                                padding: 1rem;
                                border-radius: 4px;
                                overflow-x: auto;
                                white-space: pre-wrap;
                                word-break: break-all;
                                font-size: 0.85em;
                            }
                            .document-render table {
                                width: 100%;
                                display: block;
                                overflow-x: auto;
                                border-collapse: collapse;
                            }
                        `}</style>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default DocumentViewer;
