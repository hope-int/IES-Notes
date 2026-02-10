import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, RefreshCw, ChevronDown, BookOpen, Home, MessageCircle, History, Plus, Trash2, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'Outfit, sans-serif'
});

const Mermaid = ({ chart }) => {
    const ref = useRef(null);

    useEffect(() => {
        if (ref.current && chart) {
            mermaid.contentLoaded();
            mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, chart).then(({ svg }) => {
                if (ref.current) ref.current.innerHTML = svg;
            }).catch(err => {
                console.error("Mermaid error:", err);
                if (ref.current) ref.current.innerHTML = `<div class="alert alert-danger py-1 small">Invalid diagram syntax</div>`;
            });
        }
    }, [chart]);

    return <div ref={ref} className="mermaid-container my-3 bg-white p-3 rounded-3 shadow-sm overflow-auto" />;
};

export default function AIChat({ profile, setActiveTab }) {
    // State for Sessions
    const [sessions, setSessions] = useState(() => {
        const savedSessions = localStorage.getItem('ies_ai_sessions');
        if (savedSessions) return JSON.parse(savedSessions);

        // Migration from old single-session history
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

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [syllabusText, setSyllabusText] = useState('');
    const [showWarning, setShowWarning] = useState(false);
    const messagesEndRef = useRef(null);

    // Derived active messages
    const activeSession = sessions.find(s => s.id === activeSessionId);
    const messages = activeSession?.messages || [];

    // Load Syllabus Data & Check Warning
    useEffect(() => {
        fetch('/dataset.txt')
            .then(res => res.text())
            .then(text => setSyllabusText(text))
            .catch(err => console.error("Failed to load syllabus:", err));

        const warningDismissed = localStorage.getItem('ies_chat_warning_dismissed');
        if (!warningDismissed) setShowWarning(true);
    }, []);

    // Persistence
    useEffect(() => {
        localStorage.setItem('ies_ai_sessions', JSON.stringify(sessions));
        if (activeSessionId) {
            localStorage.setItem('ies_ai_active_session_id', activeSessionId);
        }
    }, [sessions, activeSessionId]);

    const createNewChat = () => {
        const newId = crypto.randomUUID();
        const newSession = {
            id: newId,
            title: "New Chat",
            messages: [{
                role: 'assistant',
                content: `Hello ${profile?.full_name?.split(' ')[0] || 'Student'}! How can I help you with your studies today?`
            }],
            timestamp: Date.now()
        };
        setSessions([newSession, ...sessions]);
        setActiveSessionId(newId);
        setIsSidebarOpen(false);
    };

    const deleteSession = (id, e) => {
        e.stopPropagation();
        if (window.confirm("Delete this chat session?")) {
            const updated = sessions.filter(s => s.id !== id);
            setSessions(updated);
            if (activeSessionId === id) {
                setActiveSessionId(updated.length > 0 ? updated[0].id : null);
            }
        }
    };

    const dismissWarning = () => {
        localStorage.setItem('ies_chat_warning_dismissed', 'true');
        setShowWarning(false);
    };

    const handleClearChat = () => {
        if (window.confirm("Clear all messages in THIS chat?")) {
            const updatedSessions = sessions.map(s => {
                if (s.id === activeSessionId) {
                    return {
                        ...s,
                        messages: [{ role: 'assistant', content: "Chat cleared. How can I help now?" }]
                    };
                }
                return s;
            });
            setSessions(updatedSessions);
        }
    };

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user', content: input };
        const updatedMessages = [...messages, userMsg];

        // Update session messages and title if first user message
        const updatedSessions = sessions.map(s => {
            if (s.id === activeSessionId) {
                const isFirstUserMsg = !s.messages.some(m => m.role === 'user');
                return {
                    ...s,
                    messages: updatedMessages,
                    title: isFirstUserMsg ? input.substring(0, 30) + (input.length > 30 ? '...' : '') : s.title,
                    timestamp: Date.now()
                };
            }
            return s;
        });

        // Ensure we have a session if none active
        if (!activeSessionId) {
            createNewChat(); // This might be tricky in async state, better handle it via useEffect or initial state
        } else {
            setSessions(updatedSessions);
        }

        setInput('');
        setLoading(true);

        try {
            // Construct System Prompt
            const systemPrompt = `
You are Justin, an expert engineering tutor at IES College of Engineering.
User Details: ${profile?.full_name}, ${profile?.department}, ${profile?.semester}, Year ${profile?.year}.
Context: The user is asking questions related to their engineering curriculum.

Below is the official Syllabus/Curriculum Data for verify facts:
---
${syllabusText.substring(0, 20000)} ... (truncated for token limit if needed)
---

INSTRUCTIONS:
1. Answer strictly based on the provided syllabus where applicable.
2. If the user asks for a diagram, flowchart, or block diagram, ALWAYS use Mermaid syntax in a \`mermaid\` code block.
3. For custom shapes or technical drawings, you can also use raw \`svg\` code blocks.
4. DO NOT use ASCII art for diagrams. Use Mermaid or SVG for better visual understanding.
5. Be encouraging, concise, and use markdown for formatting.
6. If the question is outside academic scope, politely steer back to engineering topics.
7. Use emojis to be friendly but professional.
`;

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.origin, // Required by OpenRouter
                    "X-Title": "IES Notes AI"
                },
                body: JSON.stringify({
                    "model": "openrouter/aurora-alpha",
                    "messages": [
                        { "role": "system", "content": systemPrompt },
                        ...messages.map(m => ({ role: m.role, content: m.content })),
                        { "role": "user", "content": input }
                    ]
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message || "API Error");
            }

            const aiContent = data.choices?.[0]?.message?.content || "I'm having trouble thinking right now. Try again?";

            setSessions(prev => prev.map(s => {
                if (s.id === activeSessionId) {
                    return { ...s, messages: [...s.messages, { role: 'assistant', content: aiContent }] };
                }
                return s;
            }));

        } catch (error) {
            console.error("AI Error:", error);
            setSessions(prev => prev.map(s => {
                if (s.id === activeSessionId) {
                    return { ...s, messages: [...s.messages, { role: 'assistant', content: "⚠️ Connection error. Please check your API Key or internet." }] };
                }
                return s;
            }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="d-flex flex-column vh-100 bg-light" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1050 }}>
            <AnimatePresence>
                {showWarning && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="position-absolute top-0 start-0 w-100 p-3 z-3"
                        style={{ zIndex: 1060, marginTop: '70px' }}
                    >
                        <div className="alert alert-warning shadow-lg border-0 rounded-4 d-flex align-items-start gap-3 fade show" role="alert">
                            <div className="bg-warning text-white rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 24, height: 24 }}>!</div>
                            <div className="small">
                                <strong>Privacy Notice:</strong> Your chat history is saved in <u>this browser</u>.
                                Clearing your browser data or app cache will delete these messages forever. We do not store them on our servers.
                            </div>
                            <button type="button" className="btn-close small" onClick={dismissWarning} aria-label="Close"></button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sidebar Overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="position-fixed top-0 start-0 w-100 h-100 bg-black bg-opacity-50"
                            style={{ zIndex: 1070 }}
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="position-fixed top-0 start-0 h-100 bg-white shadow-lg d-flex flex-column"
                            style={{ zIndex: 1080, width: '280px' }}
                        >
                            <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
                                <h6 className="fw-bold mb-0">Chat History</h6>
                                <button className="btn btn-light btn-sm rounded-circle" onClick={() => setIsSidebarOpen(false)}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-3">
                                <button
                                    onClick={createNewChat}
                                    className="btn btn-primary w-100 rounded-3 d-flex align-items-center justify-content-center gap-2 py-2"
                                >
                                    <Plus size={18} /> New Chat
                                </button>
                            </div>

                            <div className="flex-grow-1 overflow-auto p-2">
                                {sessions.length === 0 ? (
                                    <div className="text-center py-5 text-muted small">
                                        No chat history yet
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column gap-1">
                                        {sessions.map(s => (
                                            <div
                                                key={s.id}
                                                onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }}
                                                className={`p-3 rounded-3 cursor-pointer d-flex align-items-center justify-content-between transition-all ${activeSessionId === s.id ? 'bg-primary text-white shadow-sm' : 'hover-bg-gray'}`}
                                            >
                                                <div className="d-flex align-items-center gap-2 overflow-hidden">
                                                    <MessageCircle size={16} className="flex-shrink-0" />
                                                    <span className="text-truncate small fw-medium">{s.title}</span>
                                                </div>
                                                <button
                                                    onClick={(e) => deleteSession(s.id, e)}
                                                    className={`btn btn-link p-0 flex-shrink-0 ${activeSessionId === s.id ? 'text-white' : 'text-muted hover-text-danger'}`}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-3 border-top bg-light">
                                <small className="text-muted d-flex align-items-center gap-1">
                                    <Sparkles size={12} /> Justin AI v1.0
                                </small>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="d-flex align-items-center justify-content-between px-3 py-2 bg-white border-bottom shadow-sm flex-shrink-0" style={{ height: '60px' }}>
                <div className="d-flex align-items-center gap-2">
                    <button className="btn btn-light btn-sm rounded-circle" onClick={() => setIsSidebarOpen(true)}>
                        <Menu size={20} />
                    </button>
                    <div className="d-flex align-items-center gap-2 ps-2">
                        <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: 34, height: 34 }}>
                            <Bot size={20} />
                        </div>
                        <div className="d-none d-sm-block">
                            <h6 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.9rem' }}>
                                AI Tutor <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: '0.6rem' }}>BETA</span>
                            </h6>
                            <small className="text-muted" style={{ fontSize: '0.7rem' }}>Powered Data Science department</small>
                        </div>
                    </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <button
                        onClick={createNewChat}
                        className="btn btn-primary btn-sm rounded-pill d-flex align-items-center gap-1 px-3"
                    >
                        <Plus size={16} /> <span className="d-none d-sm-inline">New</span>
                    </button>
                    <button
                        onClick={handleClearChat}
                        className="btn btn-light btn-sm rounded-circle text-muted"
                        title="Clear Current Chat"
                        style={{ width: 36, height: 36 }}
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-grow-1 overflow-auto p-3 custom-scrollbar" style={{ background: '#f0f2f5', paddingBottom: '150px' }}>
                <div className="d-flex flex-column gap-3 py-2">
                    {messages.length === 0 && !loading && (
                        <div className="text-center py-5">
                            <div className="bg-white p-4 rounded-4 shadow-sm border d-inline-block mx-auto" style={{ maxWidth: '400px' }}>
                                <Bot size={48} className="text-primary mb-3" />
                                <h5>Start a conversation!</h5>
                                <p className="text-muted small">Ask Justin about your syllabus, exam preparation, or any engineering topic.</p>
                                <div className="d-flex flex-wrap gap-2 justify-content-center mt-3">
                                    <button onClick={() => setInput("Explain my current syllabus")} className="btn btn-outline-primary btn-sm rounded-pill">Explain Syllabus</button>
                                    <button onClick={() => setInput("Help me prepare for exams")} className="btn btn-outline-primary btn-sm rounded-pill">Exam Prep</button>
                                </div>
                            </div>
                        </div>
                    )}
                    {messages.map((msg, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`d-flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            <div className={`flex-shrink-0 rounded-circle d-flex align-items-center justify-content-center shadow-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white text-primary border'}`} style={{ width: 32, height: 32, marginTop: 'auto' }}>
                                {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
                            </div>
                            <div className={`p-3 shadow-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-3 rounded-tr-0' : 'bg-white text-dark border rounded-3 rounded-tl-0'}`} style={{ maxWidth: '85%', fontSize: '0.95rem' }}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkMath, remarkGfm]}
                                    rehypePlugins={[rehypeKatex]}
                                    components={{
                                        p: ({ node, ...props }) => <p className="mb-1" {...props} />,
                                        table: ({ node, ...props }) => (
                                            <div className="table-responsive my-3">
                                                <table className="table table-bordered table-sm table-hover bg-white mb-0 shadow-sm rounded overflow-hidden" {...props} />
                                            </div>
                                        ),
                                        thead: ({ node, ...props }) => <thead className="table-light text-primary small fw-bold" {...props} />,
                                        th: ({ node, ...props }) => <th className="p-2 border-bottom-0" {...props} />,
                                        td: ({ node, ...props }) => <td className="p-2 align-middle small" {...props} />,
                                        tr: ({ node, ...props }) => <tr {...props} />,
                                        ul: ({ node, ...props }) => <ul className="ps-3 mb-1" {...props} />,
                                        ol: ({ node, ...props }) => <ol className="ps-3 mb-1" {...props} />,
                                        li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                        code: ({ node, inline, className, children, ...props }) => {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const lang = match ? match[1] : '';

                                            if (!inline && lang === 'mermaid') {
                                                return <Mermaid chart={String(children).replace(/\n$/, '')} />;
                                            }

                                            if (!inline && lang === 'svg') {
                                                return (
                                                    <div
                                                        className="svg-container my-3 bg-white p-3 rounded-3 shadow-sm overflow-auto d-flex justify-content-center"
                                                        dangerouslySetInnerHTML={{ __html: String(children) }}
                                                    />
                                                );
                                            }

                                            return inline ?
                                                <code className="bg-dark-subtle px-1 rounded text-danger" {...props}>{children}</code> :
                                                <pre className="bg-dark text-light p-2 rounded small mt-2 overflow-auto" {...props}><code>{children}</code></pre>
                                        }
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                        </motion.div>
                    ))}
                    {loading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="d-flex gap-2">
                            <div className="bg-white text-primary border rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: 32, height: 32 }}>
                                <Sparkles size={16} className="spin-anim" />
                            </div>
                            <div className="bg-white border text-muted p-3 rounded-3 rounded-tl-0 shadow-sm">
                                <span className="typing-dots">Thinking</span>
                            </div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} style={{ height: '100px' }} /> {/* Spacer for bottom input */}
                </div>
            </div>

            {/* Input Area */}
            <div className="fixed-bottom p-3 pb-5 mb-4 d-flex justify-content-center" style={{ zIndex: 1051, pointerEvents: 'none' }}>
                <div className="w-100" style={{ maxWidth: '800px', pointerEvents: 'auto' }}>
                    {syllabusText.length < 100 && (
                        <div className="alert alert-warning py-1 small mb-2 text-center shadow-sm mx-3" style={{ fontSize: '0.7rem' }}>
                            ⚠️ Syllabus data loading...
                        </div>
                    )}

                    <div className="bg-white rounded-4 shadow-lg p-2 d-flex gap-2 align-items-end border">
                        {/* Navigation Buttons */}
                        <div className="d-flex gap-1 flex-shrink-0">
                            <button
                                onClick={() => setActiveTab('home')}
                                className="btn btn-light rounded-circle text-muted d-flex align-items-center justify-content-center hover-bg-gray"
                                style={{ width: 44, height: 44 }}
                                title="Home"
                            >
                                <Home size={20} />
                            </button>
                            <button
                                onClick={() => setActiveTab('community')}
                                className="btn btn-light rounded-circle text-muted d-flex align-items-center justify-content-center hover-bg-gray"
                                style={{ width: 44, height: 44 }}
                                title="Community"
                            >
                                <MessageCircle size={20} />
                            </button>
                        </div>

                        <textarea
                            className="form-control border-0 bg-light shadow-none py-2 px-3 rounded-3"
                            placeholder="Message Justin..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            rows={1}
                            style={{ resize: 'none', minHeight: '44px', maxHeight: '120px' }}
                            disabled={loading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className="btn btn-primary rounded-circle shadow-sm d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ width: 44, height: 44 }}
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .typing-dots:after {
                    content: '...';
                    animation: dots 1.5s steps(5, end) infinite;
                }
                @keyframes dots {
                    0%, 20% { content: ''; }
                    40% { content: '.'; }
                    60% { content: '..'; }
                    80%, 100% { content: '...'; }
                }
            `}</style>
        </div>
    );
}
