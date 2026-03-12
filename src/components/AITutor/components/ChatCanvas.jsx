
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, Code, FileText, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { Copy, RefreshCw } from 'lucide-react';
import 'katex/dist/katex.min.css';

import JCompilerWorkbench from './JCompilerWorkbench';

const ChatCanvas = ({ messages, profile, onStarterClick, loading, simulationResults, simulatingKey, onRegenerate }) => {
    return (
        <div className="flex-grow-1 overflow-auto custom-scrollbar relative" style={{ background: '#fcfdfe' }}>
            {/* Engineering Grid Background */}
            <div className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    zIndex: 0,
                    opacity: 0.02
                }}
            />

            <div className="container mx-auto px-2 py-4 md:px-4 md:py-5" style={{ maxWidth: '850px', position: 'relative', zIndex: 1 }}>
                <AnimatePresence mode="popLayout">
                    {messages.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="d-flex flex-column align-items-center justify-content-center min-vh-50 text-center mt-5"
                        >
                            <div className="mb-4 bg-opacity-10 p-5 rounded-circle shadow-sm border border-opacity-10" style={{ backgroundColor: '#f0f5fa', color: '#003366', borderColor: '#003366' }}>
                                <Bot size={64} strokeWidth={1} />
                            </div>
                            <h2 className="fw-bold mb-2 display-6" style={{ letterSpacing: '-1px', color: '#003366' }}>
                                Engineering Workbench
                            </h2>
                            <p className="text-muted fs-5 mb-5 mx-auto" style={{ maxWidth: '500px' }}>
                                Ask deep questions, upload datasets, and simulate logic chains with the HOPE Studio core.
                            </p>

                            <div className="row g-3 w-100 px-3 mt-4" style={{ maxWidth: '750px' }}>
                                {[
                                    { icon: Sparkles, title: "Deep Explanation", desc: "Complex concept breakdown", prompt: "Explain the governing equations of [Topic] in-depth." },
                                    { icon: Code, title: "Engine Simulation", desc: "J-Compiler Logic Flow", prompt: "Write and simulate the control logic for [System] in Python." },
                                    { icon: FileText, title: "Syllabus Query", desc: "Context-aware research", prompt: "Summarize the key exam objectives for [Module] from my syllabus." }
                                ].map((starter, i) => (
                                    <div key={i} className="col-md-4">
                                        <motion.div
                                            whileHover={{ y: -5, scale: 1.02 }}
                                            onClick={() => onStarterClick(starter.prompt)}
                                            className="p-4 h-100 d-flex flex-column align-items-center gap-3 cursor-pointer text-center bg-white border border-light shadow-sm rounded-4"
                                        >
                                            <div className="p-3 rounded-circle flex items-center justify-center" style={{ backgroundColor: '#f0f5fa', color: '#003366' }}>
                                                <starter.icon size={24} />
                                            </div>
                                            <div>
                                                <div className="fw-bold text-dark small mb-1">{starter.title}</div>
                                                <div className="text-muted x-small opacity-75">{starter.desc}</div>
                                            </div>
                                            <ChevronRight size={14} className="mt-auto text-muted opacity-50" />
                                        </motion.div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        messages.map((msg, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-8 last:mb-0 max-w-full overflow-hidden"
                            >
                                <div className={`d-flex flex-column ${msg.role === 'user' ? 'align-items-end' : 'align-items-start'} w-100`}>
                                    {/* Role Indicator */}
                                    <div className="d-flex align-items-center gap-2 mb-2 px-1">
                                        {msg.role === 'assistant' && (
                                            <div className="p-1 rounded-full bg-gray-50 border shadow-sm flex items-center justify-center">
                                                <Bot size={12} className="text-primary" />
                                            </div>
                                        )}
                                        <span className="x-small fw-bold text-muted uppercase tracking-wider" style={{ fontSize: '9px' }}>
                                            {msg.role === 'user' ? 'Justin (Lead Engineer)' : 'HOPE Systems'}
                                        </span>
                                    </div>

                                    {/* Message Bubble */}
                                    <div
                                        className={`p-0 md:p-3 ${msg.role === 'user'
                                            ? 'p-4 rounded-xl shadow-sm text-white'
                                            : 'w-full max-w-full bg-transparent border-0 shadow-none'
                                            }`}
                                        style={{
                                            maxWidth: msg.role === 'user' ? '85%' : '100%',
                                            backgroundColor: msg.role === 'user' ? 'rgba(0, 51, 102, 0.9)' : 'transparent',
                                            lineHeight: '1.8',
                                            paddingRight: msg.role === 'assistant' ? '2rem' : undefined
                                        }}
                                    >
                                        {(() => {
                                            const hasAttachment = msg.content.includes('[[PDF_ATTACHMENT]]');
                                            const displayContent = hasAttachment
                                                ? msg.content.replace('[[PDF_ATTACHMENT]]', '')
                                                : msg.content;

                                            return (
                                                <div className="message-content">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm, remarkMath]}
                                                        rehypePlugins={[rehypeKatex]}
                                                        components={{
                                                            code: ({ node, inline, className, children, ...props }) => {
                                                                const match = /language-(\w+)/.exec(className || '');
                                                                const language = match ? match[1] : '';

                                                                if (!inline && language) {
                                                                    const codeContent = String(children).replace(/\n$/, '');
                                                                    const key = `${idx}-${codeContent}`;

                                                                    return (
                                                                        <div className="overflow-x-auto my-4 rounded-xl">
                                                                            <JCompilerWorkbench
                                                                                code={codeContent}
                                                                                language={language}
                                                                                simulationResult={simulationResults[key]}
                                                                                isSimulating={key === simulatingKey}
                                                                                onSimulate={() => onStarterClick('SIMULATE_CODE', { index: idx, code: codeContent, language })}
                                                                            />
                                                                        </div>
                                                                    );
                                                                }
                                                                return (
                                                                    <code
                                                                        className={`${className} px-2 py-0.5 rounded fw-bold font-monospace`}
                                                                        style={{
                                                                            backgroundColor: msg.role === 'user' ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
                                                                            color: msg.role === 'user' ? '#fff' : '#003366',
                                                                            fontSize: '13px'
                                                                        }}
                                                                        {...props}
                                                                    >
                                                                        {children}
                                                                    </code>
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        {displayContent}
                                                    </ReactMarkdown>

                                                    {hasAttachment && (
                                                        <div className="my-4 p-4 border rounded-4 d-flex align-items-center justify-content-between shadow-sm bg-light bg-opacity-50">
                                                            <div className="d-flex align-items-center gap-3">
                                                                <div className="p-2 rounded-3 text-white flex items-center justify-center" style={{ backgroundColor: '#FF6600' }}>
                                                                    <FileText size={20} />
                                                                </div>
                                                                <div>
                                                                    <div className="fw-bold text-dark small">HOPE Document</div>
                                                                    <div className="text-muted x-small uppercase fw-bold" style={{ fontSize: '9px' }}>Ready for Engineering Review</div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => onStarterClick('OPEN_DOC_VIEWER', msg.content)}
                                                                className="btn btn-sm rounded-xl px-4 fw-bold shadow-sm"
                                                                style={{ fontSize: '11px', backgroundColor: '#003366', color: 'white' }}
                                                            >
                                                                Open Studio
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Actions Bar */}
                                    {msg.role === 'assistant' && (
                                        <div className="flex items-center gap-3 mt-2 px-1 opacity-100 md:opacity-0 md:hover:opacity-100 transition-all">
                                            <button
                                                className="btn btn-link p-0 text-muted d-flex align-items-center gap-1 text-decoration-none"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(msg.content);
                                                    // Trigger a local visual feedback if possible, but keep it simple
                                                }}
                                                title="Copy Content"
                                            >
                                                <Copy size={12} /> <span style={{ fontSize: '10px', fontWeight: 'bold' }}>COPY</span>
                                            </button>
                                            <button
                                                className="btn btn-link p-0 text-muted d-flex align-items-center gap-1 text-decoration-none"
                                                onClick={() => onRegenerate(idx)}
                                                title="Regenerate Response"
                                            >
                                                <RefreshCw size={12} /> <span style={{ fontSize: '10px', fontWeight: 'bold' }}>REGENERATE</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}

                    {/* Minimal Loading Indicator */}
                    {loading && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="d-flex align-items-center gap-3 px-3 py-4"
                        >
                            <div className="p-2 rounded-circle bg-white border shadow-sm">
                                <Bot size={18} className="text-primary" />
                            </div>
                            <div className="d-flex gap-1 align-items-center">
                                <span className="small text-muted fw-bold me-2">Thinking</span>
                                {[0, 1, 2].map((i) => (
                                    <motion.div
                                        key={i}
                                        animate={{ y: [0, -4, 0] }}
                                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                                        className="bg-primary rounded-circle"
                                        style={{ width: 4, height: 4, backgroundColor: '#003366' }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style>{`
                .message-content blockquote {
                    border-left: 4px solid #3b82f6;
                    padding-left: 1.5rem;
                    margin: 1.5rem 0;
                    font-style: italic;
                    color: #64748b;
                }
                .message-content table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 1.5rem 0;
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .message-content th, .message-content td {
                    border: 1px solid #f1f5f9;
                    padding: 0.75rem 1rem;
                    text-align: left;
                }
                .message-content th {
                    background: #f8fafc;
                    font-weight: 700;
                    color: #334155;
                }
            `}</style>
        </div>
    );
};

export default ChatCanvas;
