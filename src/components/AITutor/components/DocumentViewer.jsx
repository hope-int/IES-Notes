
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Download, Printer, Edit3, Eye, FileText,
    ChevronLeft, ChevronRight, Share2, Sparkles, Layout, Bot
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DocumentViewer = ({ isOpen, onClose, content, title, onPrint, onDownload }) => {
    const [viewMode, setViewMode] = useState('split'); // 'edit', 'preview', 'split'

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

                                <button onClick={onDownload} className="btn btn-outline-secondary rounded-circle p-0 d-flex align-items-center justify-content-center border-opacity-25" style={{ width: 40, height: 40 }}><Download size={18} /></button>
                                <button
                                    onClick={onPrint}
                                    className="btn rounded-pill px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm border-0"
                                    style={{ backgroundColor: '#003366', color: 'white' }}
                                >
                                    <Printer size={18} /> Print PDF
                                </button>
                                <button onClick={onClose} className="btn btn-light rounded-circle p-0 d-flex align-items-center justify-content-center ms-2" style={{ width: 40, height: 40 }}><X size={20} /></button>
                            </div>
                        </div>

                        {/* Document Content Area */}
                        <div className="flex-grow-1 overflow-auto bg-light bg-opacity-30 d-flex">
                            {/* Editor Panel */}
                            {(viewMode === 'edit' || viewMode === 'split') && (
                                <div className={`h-100 p-5 ${viewMode === 'split' ? 'w-50 border-end' : 'w-100'} bg-white`}>
                                    <textarea
                                        className="w-100 h-100 border-0 outline-none p-0 bg-transparent"
                                        style={{
                                            resize: 'none',
                                            fontFamily: "'Fira Code', monospace",
                                            fontSize: '14px',
                                            lineHeight: '1.8',
                                            color: '#334155'
                                        }}
                                        defaultValue={content}
                                    />
                                </div>
                            )}

                            {/* Preview Panel (A4 Style) */}
                            {(viewMode === 'preview' || viewMode === 'split') && (
                                <div className={`h-100 overflow-auto p-5 ${viewMode === 'split' ? 'w-50' : 'w-100'} d-flex justify-content-center`}>
                                    <div className="bg-white shadow-xl p-5 mb-5 d-flex flex-column" style={{ width: '100%', maxWidth: '210mm', minHeight: '297mm' }}>
                                        <div className="document-render flex-grow-1">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {content}
                                            </ReactMarkdown>
                                        </div>
                                        {/* Preview Watermark */}
                                        <div className="mt-5 pt-4 border-top text-center opacity-50">
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
                        `}</style>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default DocumentViewer;
