
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Download, Printer, Edit3, Eye, FileText,
    ChevronLeft, ChevronRight, Share2, Sparkles, Layout, Bot, Send
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DocumentViewer = ({ isOpen, onClose, content, title, onPrint, onDownload, onRefine, onExportToMain }) => {
    const [viewMode, setViewMode] = useState('edit'); // 'edit', 'preview'
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
                        className="relative bg-white h-full w-full md:w-[90%] md:max-w-[1200px] shadow-2xl flex flex-col"
                    >

                        {/* Header */}
                        <div className="px-3 md:px-5 py-3 md:py-4 border-b flex items-center justify-between bg-white sticky top-0 z-10">
                            <div className="flex items-center gap-2 md:gap-3">
                                <div className="p-2 md:p-2.5 rounded-full bg-white shadow-sm">
                                    <Bot size={20} className="text-primary" />
                                </div>
                                <div>
                                    <h5 className="font-bold mb-0 text-gray-900 text-sm md:text-base">HOPE Studio</h5>
                                    <span className="hidden md:inline text-[10px] font-bold text-gray-400 uppercase tracking-widest">AI Research Analysis</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 md:gap-3">
                                <div className="bg-gray-100 p-1 rounded-full flex">
                                    {[
                                        { id: 'edit', icon: Edit3, label: 'Editor' },
                                        { id: 'preview', icon: Eye, label: 'Review' }
                                    ].map((mode) => (
                                        <button
                                            key={mode.id}
                                            onClick={() => setViewMode(mode.id)}
                                            className={`border-0 rounded-xl px-2 md:px-3 py-1.5 flex items-center gap-1 md:gap-2 transition-all ${viewMode === mode.id ? 'bg-white shadow-sm' : 'text-gray-400'} text-xs font-bold`}
                                            style={{ color: viewMode === mode.id ? '#003366' : undefined }}
                                        >
                                            <mode.icon size={14} />
                                            <span className="hidden md:inline">{mode.label}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="vr mx-2" style={{ height: '30px', opacity: 0.1 }}></div>

                                <button
                                    onClick={() => onExportToMain(editableContent)}
                                    className="btn btn-outline-primary rounded-xl px-2 md:px-3 py-2 font-bold flex items-center justify-center gap-1 md:gap-2 border-opacity-25"
                                    style={{ fontSize: '11px' }}
                                    title="Push to Main Chat"
                                >
                                    <Share2 size={14} /> <span className="hidden md:inline">Export</span>
                                </button>

                                <button
                                    onClick={onPrint}
                                    className="btn rounded-xl px-3 md:px-4 py-2 font-bold flex items-center justify-center gap-1 md:gap-2 shadow-sm border-0"
                                    style={{ backgroundColor: '#003366', color: 'white' }}
                                >
                                    <Printer size={18} /> <span className="hidden md:inline">Print PDF</span>
                                </button>
                                <button
                                    onClick={onClose}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full flex items-center justify-center ms-1 md:ms-2 w-9 h-9 md:w-10 md:h-10 transition-colors shadow-sm"
                                    aria-label="Close Studio"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Document Content Area */}
                        <div className="flex-grow overflow-hidden bg-gray-50 flex flex-col">
                            {/* EDITOR MODE: Vertical Split (Editor on top, Assistant on bottom) */}
                            {viewMode === 'edit' && (
                                <div className="flex flex-col h-full overflow-hidden">
                                    {/* Top: Editor (80%) */}
                                    <div className="h-[75%] md:h-[80%] p-4 md:p-8 bg-white relative overflow-auto custom-scrollbar">
                                        {isRefining && (
                                            <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] flex items-center justify-center z-10">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="spinner-border text-primary" role="status"></div>
                                                    <span className="text-[10px] font-bold uppercase text-primary tracking-widest">Refining Document...</span>
                                                </div>
                                            </div>
                                        )}
                                        <textarea
                                            className="w-full h-full border-0 outline-none p-0 bg-transparent custom-scrollbar"
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

                                    {/* Bottom: Studio Assistant (20%) */}
                                    <div className="h-[25%] md:h-[20%] border-t bg-white flex flex-col shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
                                        <div className="flex-grow overflow-auto p-4 flex flex-col gap-3 custom-scrollbar">
                                            {studioMessages.length === 0 && (
                                                <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-[11px] text-gray-500">
                                                    <span className="font-bold text-primary mr-1">TIPS:</span>
                                                    Try "Format this as a technical specification" or "Summarize the key findings".
                                                </div>
                                            )}
                                            {studioMessages.map((msg, i) => (
                                                <div key={i}
                                                    className={`p-3 rounded-xl shadow-sm max-w-[85%] text-[12.5px] ${msg.role === 'user'
                                                        ? 'bg-primary text-white self-end rounded-tr-none'
                                                        : 'bg-gray-50 border border-gray-100 self-start rounded-tl-none'
                                                        }`}
                                                >
                                                    {msg.content}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Bottom Sticky Input */}
                                        <div className="p-3 px-4 border-t bg-white">
                                            <div className="flex items-center gap-2 max-w-[800px] mx-auto">
                                                <input
                                                    type="text"
                                                    className="form-control border-gray-100 bg-gray-50 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/10 transition-all"
                                                    placeholder="Instruct Studio Assistant..."
                                                    value={studioInput}
                                                    onChange={(e) => setStudioInput(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && !isRefining && handleStudioSend()}
                                                />
                                                <button
                                                    className="btn btn-primary rounded-xl px-4 h-10 flex items-center justify-center transition-all disabled:opacity-50"
                                                    onClick={handleStudioSend}
                                                    disabled={isRefining || !studioInput.trim()}
                                                >
                                                    <Send size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* REVIEW MODE: Clean A4 Container */}
                            {viewMode === 'preview' && (
                                <div className="h-full overflow-auto p-4 md:p-8 w-full flex justify-center bg-gray-100/50 custom-scrollbar">
                                    <div
                                        className="bg-white shadow-2xl p-8 md:p-16 mb-8 mx-auto hover:shadow-3xl transition-shadow duration-500 rounded-sm"
                                        style={{
                                            maxWidth: '210mm',
                                            width: '100%',
                                            minHeight: 'fit-content',
                                            height: 'auto',
                                        }}
                                    >
                                        <div className="document-render">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {editableContent}
                                            </ReactMarkdown>
                                        </div>

                                        <div className="mt-16 pt-8 border-t border-gray-100 text-center opacity-40">
                                            <div className="flex items-center justify-center gap-2 mb-2">
                                                <div className="bg-primary rounded-full w-1 h-1"></div>
                                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em]">Security Verified Document</span>
                                            </div>
                                            <p className="text-gray-400 text-[9px]">Generated & Validated by HOPE AI Tutor Environment • Engineering Standard</p>
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
