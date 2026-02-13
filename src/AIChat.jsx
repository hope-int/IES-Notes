import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, RefreshCw, ChevronDown, BookOpen, Home, MessageSquare, MessageCircle, Presentation, History, Plus, Trash2, Menu, X, Share2, LayoutGrid, FileText, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import { saveFileToDB, getFileFromDB, clearFilesFromDB } from './utils/indexedDB';
import * as pdfjsLib from 'pdfjs-dist';
// Explicitly setting worker for Vite compatibility
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import ContentGenerator from './components/ContentGenerator';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const Mermaid = ({ chart }) => {
    const ref = useRef(null);
    const [svgContent, setSvgContent] = useState('');
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        setSvgContent('');
        setIsError(false);

        if (chart) {
            const renderDiagram = async () => {
                try {
                    mermaid.initialize({
                        startOnLoad: false,
                        theme: 'default',
                        securityLevel: 'loose',
                        fontFamily: 'Outfit, sans-serif',
                        suppressErrorRendering: true,
                    });

                    const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                    const { svg } = await mermaid.render(id, chart);
                    setSvgContent(svg);
                } catch (err) {
                    console.error("Mermaid rendering failed:", err);
                    setIsError(true);
                }
            };
            renderDiagram();
        }
    }, [chart]);

    if (isError) {
        return (
            <div className="p-3 bg-light border rounded text-muted small">
                <p className="mb-1 fw-bold text-danger">⚠️ Diagram Syntax Error</p>
                <code className="d-block bg-white p-2 rounded border mt-2 overflow-auto text-wrap" style={{ fontSize: '0.75rem', maxHeight: '200px' }}>
                    {chart}
                </code>
            </div>
        );
    }
    if (!svgContent) return <div className="p-3 text-center text-muted small">Loading diagram...</div>;
    return (
        <div
            className="mermaid-container my-3 bg-white p-3 rounded-3 shadow-sm overflow-auto d-flex justify-content-center"
            dangerouslySetInnerHTML={{ __html: svgContent }}
        />
    );
};

export default function AIChat({ profile, setActiveTab }) {
    const [sessions, setSessions] = useState(() => {
        const savedSessions = localStorage.getItem('ies_ai_sessions');
        if (savedSessions) return JSON.parse(savedSessions);
        const oldHistory = localStorage.getItem('ies_ai_chat_history');
        if (oldHistory) {
            const messages = JSON.parse(oldHistory);
            const initialSession = {
                id: crypto.randomUUID(),
                title: messages.find(m => m.role === 'user')?.content?.substring(0, 30) || "Previous Chat",
                messages: messages,
                timestamp: Date.now()
            };
            return [initialSession];
        }
        return [];
    });

    const [activeSessionId, setActiveSessionId] = useState(() => {
        const lastId = localStorage.getItem('ies_ai_active_session_id');
        return lastId || (sessions.length > 0 ? sessions[0].id : null);
    });

    const [showFeatures, setShowFeatures] = useState(!activeSessionId);
    const [selectedFeature, setSelectedFeature] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [syllabusText, setSyllabusText] = useState('');
    const [showWarning, setShowWarning] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    const activeSession = sessions.find(s => s.id === activeSessionId);
    const messages = activeSession?.messages || [];

    useEffect(() => {
        fetch('/dataset.txt')
            .then(res => res.text())
            .then(text => setSyllabusText(text))
            .catch(err => console.error("Failed to load syllabus:", err));
        const warned = localStorage.getItem('ies_chat_warning_dismissed');
        if (!warned) setShowWarning(true);
    }, []);

    useEffect(() => {
        if (activeSessionId) localStorage.setItem('ies_ai_active_session_id', activeSessionId);
    }, [activeSessionId]);

    useEffect(() => {
        if (sessions.length > 0) {
            try {
                localStorage.setItem('ies_ai_sessions', JSON.stringify(sessions));
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    const emergencySessions = sessions.filter(s => s.id === activeSessionId);
                    localStorage.setItem('ies_ai_sessions', JSON.stringify(emergencySessions));
                    setSessions(emergencySessions);
                }
            }
        }
    }, [sessions, activeSessionId]);

    const createNewChat = () => {
        const newId = crypto.randomUUID();
        const newSession = {
            id: newId,
            title: "New Chat",
            messages: [{
                role: 'assistant',
                content: `Hello ${profile?.full_name?.split(' ')[0] || 'Student'}! How can I help you today?`
            }],
            timestamp: Date.now()
        };
        setSessions([newSession, ...sessions]);
        setActiveSessionId(newId);
        setIsSidebarOpen(false);
        setShowFeatures(false);
    };

    const deleteSession = (id, e) => {
        e.stopPropagation();
        if (window.confirm("Delete this session?")) {
            const updated = sessions.filter(s => s.id !== id);
            setSessions(updated);
            if (activeSessionId === id) setActiveSessionId(updated.length > 0 ? updated[0].id : null);
        }
    };

    const handleClearChat = () => {
        if (window.confirm("Clear THIS chat?")) {
            setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [{ role: 'assistant', content: "Chat cleared." }] } : s));
            clearFilesFromDB();
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { alert("Max 5MB"); return; }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setFilePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const clearFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const extractTextFromPDF = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        return fullText;
    };

    const handleSend = async () => {
        if ((!input.trim() && !selectedFile) || loading) return;
        const fileId = selectedFile ? `file-${crypto.randomUUID()}` : null;
        if (selectedFile) await saveFileToDB(fileId, selectedFile);

        const userMsg = {
            role: 'user',
            content: input,
            fileId,
            fileType: selectedFile?.type,
            fileName: selectedFile?.name,
            filePreview: filePreview
        };

        const currentInput = input;
        setInput('');
        setLoading(true);

        // Optimistically update UI
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, userMsg] } : s));

        try {
            const systemPrompt = `You are Justin, a helpful engineering tutor at IES College of Engineering. Strictly use syllabus: ${syllabusText.substring(0, 3000)}`;
            const filteredHistory = messages.filter(m => m.content && !m.content.startsWith('⚠️'));
            // Include the new user message in the history for the API call
            const requestMessages = [
                { role: "system", content: systemPrompt },
                ...filteredHistory.map(m => ({ role: m.role, content: m.content })),
            ];

            if (selectedFile?.type.startsWith('image/')) {
                requestMessages.push({ role: "user", content: [{ type: "text", text: currentInput || "Analyze this image." }, { type: "image_url", image_url: { url: filePreview } }] });
            } else if (selectedFile?.type === 'application/pdf') {
                const pdfText = await extractTextFromPDF(selectedFile);
                requestMessages.push({ role: "user", content: `${currentInput}\n\n[PDF]: ${pdfText}` });
            } else {
                requestMessages.push({ role: "user", content: currentInput });
            }

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": selectedFile?.type.startsWith('image/') ? "nvidia/nemotron-nano-12b-v2-vl:free" : "openrouter/aurora-alpha",
                    "messages": requestMessages
                })
            });

            clearFile();
            const data = await response.json();
            const aiContent = data.choices[0].message.content;

            // Update with AI response
            setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, { role: 'assistant', content: aiContent }] } : s));
        } catch (e) {
            console.error(e);
            setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, { role: 'assistant', content: "⚠️ Error occurred." }] } : s));
        } finally {
            setLoading(false);
        }
    };

    if (showFeatures) {
        if (selectedFeature?.type === 'content-tools') {
            return (
                <div className="container py-5 min-vh-100 pb-5 mb-5 relative z-10">
                    <ContentGenerator
                        onBack={() => setSelectedFeature(null)}
                        initialType={selectedFeature.tool}
                    />
                </div>
            );
        }
        return (
            <div className="container py-5 d-flex flex-column align-items-center justify-content-center min-vh-100 pb-5 mb-5 relative z-10">
                <div className="text-center mb-5">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="d-inline-block p-4 rounded-circle mb-4 clay-card"
                    >
                        <Sparkles size={48} className="text-primary" />
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="fw-bold display-5 mb-3"
                    >
                        AI Tutor Features
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-muted fs-5"
                    >
                        Your personal learning assistant
                    </motion.p>
                </div>

                <div className="w-100" style={{ maxWidth: '1000px' }}>
                    {/* Chat Hero Card */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="clay-card p-5 mb-4 text-center cursor-pointer position-relative overflow-hidden"
                        onClick={() => setShowFeatures(false)}
                    >
                        <div className="position-absolute top-0 start-0 w-100 h-100 bg-primary opacity-10" style={{ zIndex: 0 }}></div>
                        <div className="position-relative" style={{ zIndex: 1 }}>
                            <div className="bg-white p-4 rounded-circle d-inline-block mb-4 shadow-sm">
                                <MessageSquare size={48} className="text-primary" />
                            </div>
                            <h3 className="fw-bold mb-2 display-6">AI Chat Tutor</h3>
                            <p className="text-white fs-5">Interactive Q&A and detailed explanations for your studies.</p>
                        </div>
                    </motion.div>

                    {/* Content Generator Tools Grid */}
                    <h4 className="fw-bold mb-4 mt-5 text-center">Create Content</h4>
                    <div className="row g-4">
                        {[
                            { id: 'presentation', icon: Presentation, title: "Presentation", desc: "Generate PPT slides.", color: 'text-primary', bg: 'bg-primary' },
                            { id: 'report', icon: FileText, title: "Report", desc: "Create academic reports.", color: 'text-success', bg: 'bg-success' },
                            { id: 'assignment', icon: Sparkles, title: "Assignment", desc: "Generate quizzes & questions.", color: 'text-warning', bg: 'bg-warning' }
                        ].map(tool => (
                            <div key={tool.id} className="col-md-4">
                                <motion.div
                                    whileHover={{ y: -5 }}
                                    className="clay-card h-100 p-4 text-center cursor-pointer"
                                    onClick={() => setSelectedFeature({ type: 'content-tools', tool: tool.id })}
                                >
                                    <div className={`${tool.bg} bg-opacity-10 p-3 rounded-circle d-inline-block mb-3 ${tool.color}`}>
                                        <tool.icon size={32} />
                                    </div>
                                    <h5 className="fw-bold mb-1">{tool.title}</h5>
                                    <p className="text-muted small mb-0">{tool.desc}</p>
                                </motion.div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="d-flex flex-column vh-100 position-fixed top-0 start-0 w-100" style={{ zIndex: 1050, background: 'var(--bg-color)' }}>

            {/* Background Orbs (inherited from body but ensured here if needed, transparent bg allows body orbs to show) */}

            <AnimatePresence>
                {showWarning && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="position-absolute top-0 start-0 w-100 p-3"
                        style={{ zIndex: 1100, pointerEvents: 'none' }}
                    >
                        <div className="clay-card p-3 d-flex gap-3 align-items-center mx-auto" style={{ maxWidth: '600px', pointerEvents: 'auto', background: 'rgba(255,255,255,0.95)' }}>
                            <div className="text-warning"><FileText size={20} /></div>
                            <div className="small flex-grow-1"><strong>Privacy Notice:</strong> Conversations are saved locally on your device.</div>
                            <button className="btn-close small" onClick={() => setShowWarning(false)}></button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sidebar Slider */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="position-fixed top-0 start-0 w-100 h-100 bg-black bg-opacity-25"
                            style={{ zIndex: 1060, backdropFilter: 'blur(2px)' }}
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="position-fixed top-0 start-0 h-100 clay-card border-0 rounded-0 d-flex flex-column"
                            style={{ zIndex: 1070, width: '300px', background: 'rgba(255,255,255,0.95)' }}
                        >
                            <div className="p-4 border-bottom d-flex justify-content-between align-items-center">
                                <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">
                                    <History size={20} className="text-primary" /> History
                                </h5>
                                <button className="btn btn-sm btn-light rounded-circle" onClick={() => setIsSidebarOpen(false)}><X size={18} /></button>
                            </div>

                            <div className="p-3">
                                <button onClick={createNewChat} className="clay-button w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2">
                                    <Plus size={20} /> New Chat
                                </button>
                            </div>

                            <div className="flex-grow-1 overflow-auto p-3 custom-scrollbar">
                                <h6 className="text-muted text-uppercase small fw-bold mb-3 ms-1">Previous 7 Days</h6>
                                {sessions.length === 0 && <p className="text-muted small text-center py-4">No previous chats.</p>}
                                {sessions.map(s => (
                                    <motion.div
                                        key={s.id}
                                        whileHover={{ scale: 1.02 }}
                                        onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }}
                                        className={`p-3 rounded-4 cursor-pointer mb-2 d-flex justify-content-between align-items-center border ${activeSessionId === s.id ? 'bg-white border-primary shadow-sm' : 'bg-transparent border-transparent hover-bg-light'}`}
                                    >
                                        <div className="d-flex align-items-center gap-3 overflow-hidden">
                                            <div className={`p-2 rounded-circle ${activeSessionId === s.id ? 'bg-primary text-white' : 'bg-light text-muted'}`}>
                                                <MessageCircle size={16} />
                                            </div>
                                            <span className="text-truncate small fw-medium" style={{ maxWidth: '140px' }}>{s.title}</span>
                                        </div>
                                        <button
                                            onClick={(e) => deleteSession(s.id, e)}
                                            className="btn btn-link p-0 text-muted hover-text-danger"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="d-flex align-items-center justify-content-between px-4 py-3 bg-white bg-opacity-80 backdrop-blur border-bottom flex-shrink-0" style={{ height: '70px', zIndex: 1040 }}>
                <div className="d-flex align-items-center gap-3">
                    <button
                        className="btn btn-light rounded-circle p-2 d-flex align-items-center justify-content-center shadow-sm"
                        onClick={() => setIsSidebarOpen(true)}
                        title="History"
                    >
                        <History size={20} className="text-muted" />
                    </button>
                    <div className="d-none d-md-block w-1px h-24px bg-secondary opacity-25"></div>
                    <div>
                        <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">
                            Justin <span className="badge bg-primary rounded-pill px-2 py-1 text-white" style={{ fontSize: '0.6rem' }}>AI</span>
                        </h5>
                        <small className="text-muted d-none d-sm-block">Always here to help.</small>
                    </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <button onClick={() => setShowFeatures(true)} className="btn btn-light rounded-pill px-3 py-2 d-flex align-items-center gap-2 shadow-sm">
                        <LayoutGrid size={16} /> <span className="d-none d-sm-inline small fw-bold">Features</span>
                    </button>
                    <button onClick={handleClearChat} className="btn btn-light rounded-circle p-2 shadow-sm text-muted hover-text-danger" title="Clear Chat">
                        <RefreshCw size={20} />
                    </button>
                    <button onClick={() => setActiveTab('home')} className="btn btn-light rounded-circle p-2 shadow-sm text-muted" title="Close">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-grow-1 overflow-auto p-3 p-md-5 custom-scrollbar d-flex flex-column" style={{ paddingBottom: '160px' }}>
                <div className="container" style={{ maxWidth: '800px' }}>
                    {messages.length === 0 && (
                        <div className="text-center py-5 mt-5 opacity-50">
                            <Bot size={64} className="text-muted mb-3" />
                            <h3>How can I help you today?</h3>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={idx}
                            className={`d-flex gap-3 mb-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            <div className={`rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white text-primary'}`} style={{ width: 40, height: 40 }}>
                                {msg.role === 'user' ? <User size={20} /> : <Bot size={24} />}
                            </div>

                            <div
                                className={`p-4 rounded-4 shadow-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'clay-card border-0'}`}
                                style={{ maxWidth: '80%', borderTopLeftRadius: msg.role === 'assistant' ? 0 : 20, borderTopRightRadius: msg.role === 'user' ? 0 : 20 }}
                            >
                                {msg.role === 'assistant' ? (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath, remarkGfm]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            code({ node, inline, className, children, ...props }) {
                                                if (inline) return <code className="bg-light px-1 rounded text-danger" {...props}>{children}</code>;
                                                return <div className="bg-dark text-white p-3 rounded-3 my-2 overflow-auto"><code {...props}>{children}</code></div>
                                            }
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                ) : (
                                    <>
                                        {msg.filePreview && (
                                            <div className="mb-2 rounded overflow-hidden">
                                                {msg.fileType?.startsWith('image/') ?
                                                    <img src={msg.filePreview} alt="Upload" className="img-fluid rounded" style={{ maxHeight: '200px' }} /> :
                                                    <div className="bg-white bg-opacity-20 p-2 rounded d-flex align-items-center gap-2 small"><FileText size={16} /> {msg.fileName}</div>
                                                }
                                            </div>
                                        )}
                                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    ))}
                    {loading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="d-flex gap-3 text-muted align-items-center">
                            <div className="bg-white p-2 rounded-circle shadow-sm"><Bot size={24} className="text-primary" /></div>
                            <div className="typing-loader">
                                <span></span><span></span><span></span>
                            </div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} style={{ height: '40px' }} />
                </div>
            </div>

            {/* Input Area */}
            <div className="position-fixed bottom-0 start-0 w-100 p-3 p-md-4 d-flex justify-content-center" style={{ zIndex: 1051, pointerEvents: 'none' }}>
                <div className="w-100 glass-panel shadow-lg p-2 rounded-pill d-flex align-items-center gap-2 pe-2 border-white border-2" style={{ maxWidth: '800px', pointerEvents: 'auto', background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(20px)' }}>

                    <button
                        onClick={() => setActiveTab('home')}
                        className="btn btn-light rounded-circle p-0 d-flex align-items-center justify-content-center text-muted hover-bg-gray flex-shrink-0"
                        style={{ width: 44, height: 44 }}
                        title="Home"
                    >
                        <Home size={20} />
                    </button>

                    {/* Community Button */}
                    <button
                        onClick={() => setActiveTab('community')}
                        className="btn btn-light rounded-circle p-0 d-flex align-items-center justify-content-center text-primary bg-primary bg-opacity-10 hover-bg-primary hover-text-white transition-all flex-shrink-0"
                        style={{ width: 44, height: 44 }}
                        title="Community"
                    >
                        <Users size={20} />
                    </button>

                    <input type="file" ref={fileInputRef} className="d-none" onChange={handleFileChange} />

                    <div className="flex-grow-1 position-relative">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            className="form-control border-0 bg-transparent shadow-none py-2 px-1 custom-scrollbar"
                            rows={1}
                            placeholder="Ask Justin..."
                            style={{ resize: 'none', maxHeight: '120px', minHeight: '44px', lineHeight: '24px' }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (input.trim() || selectedFile) handleSend();
                                }
                            }}
                        />
                        {selectedFile && (
                            <div className="position-absolute bottom-100 start-0 mb-2 p-2 bg-white rounded shadow-sm border d-flex align-items-center gap-2 small">
                                <FileText size={14} className="text-primary" />
                                <span className="text-truncate" style={{ maxWidth: '150px' }}>{selectedFile.name}</span>
                                <button onClick={clearFile} className="btn btn-link p-0 text-muted"><X size={14} /></button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-light rounded-circle p-0 d-flex align-items-center justify-content-center text-muted hover-text-primary flex-shrink-0"
                        style={{ width: 44, height: 44, alignSelf: 'flex-end' }}
                    >
                        <Plus size={22} />
                    </button>

                    <button
                        onClick={() => { input.trim() || selectedFile ? handleSend() : null }}
                        disabled={!input.trim() && !selectedFile}
                        className={`btn rounded-circle p-0 d-flex align-items-center justify-content-center text-white flex-shrink-0 transition-transform ${input.trim() || selectedFile ? 'bg-primary hover-scale' : 'bg-secondary'}`}
                        style={{ width: 48, height: 48, opacity: input.trim() || selectedFile ? 1 : 0.5 }}
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .typing-loader span {
                    display: inline-block;
                    width: 6px;
                    height: 6px;
                    background-color: #cbd5e1;
                    border-radius: 50%;
                    margin: 0 2px;
                    animation: typing 1s infinite;
                }
                .typing-loader span:nth-child(2) { animation-delay: 0.2s; }
                .typing-loader span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes typing {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
            `}</style>
        </div>
    );
}
