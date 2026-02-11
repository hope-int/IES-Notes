import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, RefreshCw, ChevronDown, BookOpen, Home, MessageSquare, MessageCircle, Presentation, History, Plus, Trash2, Menu, X, Share2, LayoutGrid, FileText } from 'lucide-react';
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

        try {
            const systemPrompt = `You are Justin, a helpful engineering tutor at IES College of Engineering. Strictly use syllabus: ${syllabusText.substring(0, 3000)}`;
            const filteredHistory = messages.filter(m => m.content && !m.content.startsWith('⚠️'));
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

            setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, userMsg, { role: 'assistant', content: aiContent }] } : s));
        } catch (e) {
            console.error(e);
            setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, userMsg, { role: 'assistant', content: "⚠️ Error occurred." }] } : s));
        } finally {
            setLoading(false);
        }
    };

    if (showFeatures) {
        if (selectedFeature === 'content-tools') {
            return (
                <div className="container py-5 min-vh-100 pb-5 mb-5">
                    <ContentGenerator onBack={() => setSelectedFeature(null)} />
                </div>
            );
        }
        return (
            <div className="container py-5 d-flex flex-column align-items-center justify-content-center min-vh-100 pb-5 mb-5">
                <div className="text-center mb-5">
                    <Sparkles size={48} className="text-primary mb-3" />
                    <h2 className="fw-bold">AI Tutor Features</h2>
                </div>
                <div className="row g-4 justify-content-center w-100" style={{ maxWidth: '800px' }}>
                    <div className="col-md-6">
                        <div className="card h-100 border-0 shadow-sm hover-shadow cursor-pointer p-4 text-center" onClick={() => setShowFeatures(false)}>
                            <MessageSquare size={32} className="text-primary mx-auto mb-3" />
                            <h4>AI Chat Tutor</h4>
                            <p className="text-muted small">Q&A and explanations.</p>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="card h-100 border-0 shadow-sm hover-shadow cursor-pointer p-4 text-center" onClick={() => setSelectedFeature('content-tools')}>
                            <Presentation size={32} className="text-success mx-auto mb-3" />
                            <h4>Content Generator</h4>
                            <p className="text-muted small">Create PPTs and Reports.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="d-flex flex-column vh-100 bg-light" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1050 }}>
            <AnimatePresence>
                {showWarning && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="position-absolute top-0 start-0 w-100 p-3 z-3" style={{ marginTop: '70px' }}>
                        <div className="alert alert-warning shadow border-0 rounded-4 d-flex gap-3">
                            <div className="small"><strong>Privacy:</strong> Data saved locally.</div>
                            <button className="btn-close small" onClick={() => setShowWarning(false)}></button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isSidebarOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="position-fixed top-0 start-0 w-100 h-100 bg-black bg-opacity-50" style={{ zIndex: 1070 }} />
                        <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="position-fixed top-0 start-0 h-100 bg-white shadow-lg d-flex flex-column" style={{ zIndex: 1080, width: '280px' }}>
                            <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
                                <h6 className="fw-bold mb-0">History</h6>
                                <button className="btn btn-sm" onClick={() => setIsSidebarOpen(false)}><X size={18} /></button>
                            </div>
                            <div className="p-3"><button onClick={createNewChat} className="btn btn-primary w-100 py-2"><Plus size={18} /> New Chat</button></div>
                            <div className="flex-grow-1 overflow-auto p-2">
                                {sessions.map(s => (
                                    <div key={s.id} onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }} className={`p-3 rounded-3 cursor-pointer d-flex justify-content-between align-items-center ${activeSessionId === s.id ? 'bg-primary text-white' : 'hover-bg-gray'}`}>
                                        <div className="d-flex align-items-center gap-2 overflow-hidden"><MessageCircle size={16} /><span className="text-truncate small">{s.title}</span></div>
                                        <button onClick={(e) => deleteSession(s.id, e)} className="btn btn-link p-0 text-white"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div className="d-flex align-items-center justify-content-between px-3 py-2 bg-white border-bottom shadow-sm flex-shrink-0" style={{ height: '60px' }}>
                <div className="d-flex align-items-center gap-2">
                    <button className="btn btn-light btn-sm d-md-none" onClick={() => setIsSidebarOpen(true)}><Menu size={20} /></button>
                    <div className="ps-2 cursor-pointer" onClick={() => setShowFeatures(true)}><Bot size={24} className="text-primary" /></div>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <button onClick={() => setShowFeatures(true)} className="btn btn-light btn-sm rounded-pill"><LayoutGrid size={16} /></button>
                    <button onClick={handleClearChat} className="btn btn-light btn-sm rounded-circle"><RefreshCw size={16} /></button>
                </div>
            </div>

            <div className="flex-grow-1 overflow-auto p-3 custom-scrollbar" style={{ background: '#f0f2f5', paddingBottom: '150px' }}>
                <div className="d-flex flex-column gap-3">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`d-flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`p-3 rounded-3 ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white border'}`} style={{ maxWidth: '85%' }}>
                                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
                            </div>
                        </div>
                    ))}
                    {loading && <div className="text-muted small">Thinking...</div>}
                    <div ref={messagesEndRef} style={{ height: '20px' }} />
                </div>
            </div>

            <div className="fixed-bottom p-3 d-flex justify-content-center" style={{ zIndex: 1051, pointerEvents: 'none' }}>
                <div className="w-100 d-flex gap-2 bg-white rounded-4 shadow-lg p-2 border" style={{ maxWidth: '800px', pointerEvents: 'auto' }}>
                    <button onClick={() => setActiveTab('home')} className="btn btn-light btn-sm"><Home size={20} /></button>
                    <input type="file" ref={fileInputRef} className="d-none" onChange={handleFileChange} />
                    <textarea value={input} onChange={e => setInput(e.target.value)} className="form-control" rows={1} placeholder="Ask Justin..." />
                    <button onClick={() => { input.trim() || selectedFile ? handleSend() : fileInputRef.current?.click() }} className="btn btn-primary">{(input.trim() || selectedFile) ? <Send size={20} /> : <Plus size={20} />}</button>
                </div>
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; }`}</style>
        </div>
    );
}
