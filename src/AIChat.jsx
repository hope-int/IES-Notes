import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, RefreshCw, ChevronDown, BookOpen, Home, MessageCircle, History, Plus, Trash2, Menu, X, Share2, LayoutGrid, FileText } from 'lucide-react';
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

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// mermaid.initialize removed to avoid conflicts. Initialized inside component with specific settings.

const Mermaid = ({ chart }) => {
    const ref = useRef(null);
    const [svgContent, setSvgContent] = useState('');
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        // Reset state on chart change
        setSvgContent('');
        setIsError(false);

        if (chart) {
            const renderDiagram = async () => {
                try {
                    // Configure mermaid to NOT throw on error if possible, but we catch importantly
                    mermaid.initialize({
                        startOnLoad: false, // We handle manual rendering
                        theme: 'default',
                        securityLevel: 'loose',
                        fontFamily: 'Outfit, sans-serif',
                        suppressErrorRendering: true, // IMPORTANT: Stop mermaid from auto-injecting error UI
                    });

                    const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                    // parse first to check validity if possible, or just render and catch
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

    if (!svgContent) {
        return <div className="p-3 text-center text-muted small">Loading diagram...</div>;
    }

    return (
        <div
            className="mermaid-container my-3 bg-white p-3 rounded-3 shadow-sm overflow-auto d-flex justify-content-center"
            dangerouslySetInnerHTML={{ __html: svgContent }}
        />
    );
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

    // Feature List State
    const [showFeatures, setShowFeatures] = useState(!activeSessionId); // Show features if no active session initially

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [syllabusText, setSyllabusText] = useState('');
    const [showWarning, setShowWarning] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const fileInputRef = useRef(null);
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

        // Clear temporary files on unmount (closing chat)
        return () => {
            clearFilesFromDB();
        };
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
            clearFilesFromDB();
        }
    };

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Limit to 5MB for AI Analysis to prevent request timeout/crash
            if (file.size > 5 * 1024 * 1024) {
                alert("File is too large for AI analysis (Max 5MB).");
                return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setFilePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const extractTextFromPDF = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += `\n[Page ${i} Content]: ${pageText}\n`;
            }
            return fullText;
        } catch (error) {
            console.error("PDF Extraction failed:", error);
            throw new Error("Failed to extract text from PDF.");
        }
    };

    const handleSend = async () => {
        if ((!input.trim() && !selectedFile) || loading) return;

        const fileId = selectedFile ? `file-${crypto.randomUUID()}` : null;
        if (selectedFile) {
            await saveFileToDB(fileId, selectedFile);
        }

        const userMsg = {
            role: 'user',
            content: input,
            fileId: fileId,
            fileType: selectedFile?.type,
            fileName: selectedFile?.name,
            filePreview: filePreview // Preview for session consistency
        };
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
            const newId = crypto.randomUUID();
            const newSession = {
                id: newId,
                title: input.substring(0, 30),
                messages: [{ role: 'assistant', content: "Hello! How can I help?" }, userMsg],
                timestamp: Date.now()
            };
            setSessions([newSession, ...sessions]);
            setActiveSessionId(newId);
        } else {
            setSessions(updatedSessions);
        }

        setInput('');
        setLoading(true);

        // Timeout Promise
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Request timed out")), 20000) // 20s timeout
        );

        try {
            const systemPrompt = `You are Justin, a helpful engineering tutor at IES College of Engineering. 
PERSONALITY:
1. BE INQUISITIVE: Always ask a follow-up question.
2. ACCURACY: Follow the syllabus data strictly: ${selectedFile ? syllabusText.substring(0, 500) : syllabusText.substring(0, 3000)}
3. VISION: You can see and analyze images and documents.

TECHNICAL:
- DIAGRAMS: Use mermaid blocks (graph TD).
- MATH: Use LaTeX symbols inside $$ blocks.`;

            // Preparing request body for multi-modal support
            const filteredHistory = messages.filter(m => m.content && m.content.trim() && !m.content.startsWith('⚠️'));
            const requestMessages = [
                { "role": "system", "content": systemPrompt },
                ...filteredHistory.map(m => ({ role: m.role, content: m.content })),
            ];

            // Current message processing
            let currentMessageContent = [];

            if (selectedFile) {
                if (selectedFile.type.startsWith('image/')) {
                    // Images work well with Nemotron Vision
                    if (!input.trim()) currentMessageContent.push({ type: "text", text: "Analyze this image." });
                    currentMessageContent.push({
                        type: "image_url",
                        image_url: { url: filePreview }
                    });
                    // Append current message for Image
                    if (currentMessageContent.length > 0) {
                        requestMessages.push({ role: "user", content: currentMessageContent });
                    }
                } else if (selectedFile.type === 'application/pdf') {
                    // Use client-side extracted text for PDF to avoid 400 errors and ensure accuracy
                    const pdfText = await extractTextFromPDF(selectedFile);

                    if (!pdfText || pdfText.trim().length < 50) {
                        alert("Could not extract text from this PDF! It might be a scanned image.\n\nPlease take a Screenshot and upload it as an Image for the AI to analyze.");
                        setLoading(false);
                        return;
                    }

                    const promptText = input.trim()
                        ? `${input}\n\n[Attached PDF Content]:\n${pdfText}`
                        : `Analyze this document:\n\n[Attached PDF Content]:\n${pdfText}`;

                    // Send as pure text user message
                    requestMessages.push({ role: "user", content: promptText });
                }
            } else {
                // Text only message
                if (input.trim()) {
                    requestMessages.push({ role: "user", content: input });
                }
            }

            const fetchPromise = fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.origin,
                    "X-Title": "IES Notes AI"
                },
                body: JSON.stringify({
                    "model": selectedFile?.type.startsWith('image/') ? "nvidia/nemotron-nano-12b-v2-vl:free" : "openrouter/aurora-alpha",
                    "messages": requestMessages
                })
            });

            // Race fetch against timeout
            const response = await Promise.race([fetchPromise, timeoutPromise]);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("OpenRouter Error Detail:", errorData);
                throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown'}`);
            }

            const data = await response.json();

            if (data.error) {
                // Specific handling for OpenRouter empty response error
                if (data.error.message?.toLowerCase().includes('empty')) {
                    throw new Error("The model (Nemotron) failed to generate a response. This often happens with complex PDFs on smaller models. Try using an image or asking a simpler question.");
                }
                throw new Error(data.error.message || "API logical Error");
            }

            const aiRawContent = data.choices?.[0]?.message?.content;
            const aiContent = aiRawContent && aiRawContent.trim()
                ? aiRawContent
                : "The AI returned an empty response. This can happen if the content is flagged by a safety filter or if the model is having technical issues. Try rephrasing your question.";

            setSessions(prev => prev.map(s => {
                if (s.id === activeSessionId) {
                    return { ...s, messages: [...s.messages, { role: 'assistant', content: aiContent }] };
                }
                return s;
            }));

        } catch (error) {
            console.error("AI Error:", error);
            const errorMsg = error.message === "Request timed out"
                ? "⚠️ The AI is taking too long to respond. Please try again."
                : "⚠️ detailed error: " + error.message;

            setSessions(prev => prev.map(s => {
                if (s.id === activeSessionId) {
                    return { ...s, messages: [...s.messages, { role: 'assistant', content: errorMsg }] };
                }
                return s;
            }));
        } finally {
            setLoading(false);
            clearFile();
        }
    };

    if (showFeatures) {
        return (
            <div className="container py-5 d-flex flex-column align-items-center justify-content-center min-vh-100 pb-5 mb-5">
                <div className="text-center mb-5">
                    <div className="bg-white p-3 rounded-circle shadow-sm d-inline-block mb-3">
                        <Sparkles size={48} className="text-primary" />
                    </div>
                    <h2 className="fw-bold display-5">AI Tutor Features</h2>
                    <p className="text-muted fs-5">Select a tool to enhance your learning</p>
                </div>

                <div className="row g-4 justify-content-center w-100" style={{ maxWidth: '800px' }}>
                    {/* Chat Feature */}
                    <div className="col-md-8">
                        <motion.div
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowFeatures(false)}
                            className="card border-0 shadow-sm h-100 cursor-pointer overflow-hidden feature-card"
                            style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)' }}
                        >
                            <div className="card-body p-4 text-center d-flex flex-column align-items-center gap-3">
                                <div className="p-3 rounded-circle bg-primary bg-opacity-10 text-primary mb-2">
                                    <MessageCircle size={32} />
                                </div>
                                <h4 className="fw-bold mb-1">AI Chat Tutor</h4>
                                <p className="text-muted small mb-0">
                                    Ask questions, get explanations, and verify facts from your official syllabus.
                                </p>
                                <button className="btn btn-primary rounded-pill px-4 mt-3 fw-bold">Open Chat</button>
                            </div>
                        </motion.div>
                    </div>
                </div>

                <button onClick={() => setActiveTab('home')} className="btn btn-link text-muted mt-5">
                    <Home size={20} /> Back to Home
                </button>
            </div>
        );
    }


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
                    <button className="btn btn-light btn-sm rounded-circle d-md-none" onClick={() => setIsSidebarOpen(true)}>
                        <Menu size={20} />
                    </button>
                    <div className="d-flex align-items-center gap-2 ps-2 cursor-pointer" onClick={() => setShowFeatures(true)}>
                        <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: 34, height: 34 }}>
                            <Bot size={20} />
                        </div>
                        <div>
                            <h6 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.9rem' }}>
                                AI Tutor <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: '0.6rem' }}>BETA</span>
                            </h6>
                            <small className="text-muted d-none d-sm-block" style={{ fontSize: '0.7rem' }}>Tap for features</small>
                        </div>
                    </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <button
                        onClick={() => setShowFeatures(true)}
                        className="btn btn-light btn-sm rounded-pill d-flex align-items-center gap-1 px-3 border"
                        title="All AI Features"
                    >
                        <LayoutGrid size={16} /> <span className="d-none d-md-inline">Apps</span>
                    </button>
                    <button
                        onClick={createNewChat}
                        className="btn btn-primary btn-sm rounded-pill d-flex align-items-center gap-1 px-3"
                    >
                        <Plus size={16} /> <span className="d-none d-md-inline">New</span>
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
                                                // Cleaner for common AI failures in mermaid
                                                let chartCode = String(children).replace(/\n$/, '');

                                                // Basic cleanup for parens/brackets in labels if not properly quoted
                                                // This is a heuristic.

                                                // Ensure 'graph TD' or similar exists
                                                if (!chartCode.includes('graph ') && !chartCode.includes('sequenceDiagram') && !chartCode.includes('mindmap') && !chartCode.includes('flowchart')) {
                                                    chartCode = 'graph TD\n' + chartCode;
                                                }
                                                return <Mermaid chart={chartCode} />;
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
                                {msg.filePreview && (
                                    <div className="mt-2 rounded overflow-hidden shadow-sm border bg-light" style={{ maxWidth: '200px' }}>
                                        {msg.fileType?.startsWith('image/') ? (
                                            <img src={msg.filePreview} alt="Uploaded" className="w-100 d-block" style={{ maxHeight: '200px', objectFit: 'contain' }} />
                                        ) : (
                                            <div className="p-3 d-flex align-items-center gap-2">
                                                <FileText size={24} className="text-danger" />
                                                <span className="small fw-bold text-truncate">{msg.fileName || 'Document'}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
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
            <div className="fixed-bottom p-3 pb-4 pb-md-5 mb-0 mb-md-2 d-flex justify-content-center" style={{ zIndex: 1051, pointerEvents: 'none' }}>
                <div className="w-100" style={{ maxWidth: '800px', pointerEvents: 'auto' }}>
                    {syllabusText.length < 100 && (
                        <div className="alert alert-warning py-1 small mb-2 text-center shadow-sm mx-3" style={{ fontSize: '0.7rem' }}>
                            ⚠️ Syllabus data loading...
                        </div>
                    )}

                    {/* File Preview Area */}
                    <AnimatePresence>
                        {filePreview && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                className="bg-white rounded-3 shadow border p-2 mb-2 mx-3 d-flex align-items-center gap-2"
                                style={{ pointerEvents: 'auto' }}
                            >
                                {selectedFile?.type.startsWith('image/') ? (
                                    <img src={filePreview} alt="Preview" className="rounded" style={{ width: '40px', height: '40px', objectFit: 'cover' }} />
                                ) : (
                                    <div className="bg-danger text-white rounded d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                                        <FileText size={20} />
                                    </div>
                                )
                                }
                                <div className="flex-grow-1 overflow-hidden">
                                    <div className="small fw-bold text-truncate">{selectedFile?.name}</div>
                                    <div className="text-muted" style={{ fontSize: '0.65rem' }}>{Math.round(selectedFile?.size / 1024)} KB</div>
                                </div>
                                <button onClick={clearFile} className="btn btn-sm btn-light rounded-circle">
                                    <X size={14} />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="bg-white rounded-4 shadow-lg p-2 d-flex gap-2 align-items-end border border-secondary-subtle mx-2 mx-md-0">
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

                        <input
                            type="file"
                            ref={fileInputRef}
                            className="d-none"
                            accept="image/*,application/pdf"
                            onChange={handleFileChange}
                        />

                        <textarea
                            className="form-control bg-light shadow-none py-2 px-3"
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
                            style={{
                                resize: 'none',
                                minHeight: '44px',
                                maxHeight: '120px',
                                borderRadius: '24px',
                                border: '1px solid #e2e8f0' // Very thin subtle border
                            }}
                            disabled={loading}
                        />
                        <button
                            onClick={() => {
                                if (!input.trim() && !selectedFile) {
                                    fileInputRef.current?.click();
                                } else {
                                    handleSend();
                                }
                            }}
                            disabled={loading}
                            className="btn btn-primary rounded-circle shadow-sm d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ width: 44, height: 44 }}
                        >
                            {(!input.trim() && !selectedFile) ? <Plus size={20} /> : <Send size={20} />}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
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
