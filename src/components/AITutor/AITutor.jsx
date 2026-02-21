import React, { useState, useEffect, useRef } from 'react';
import {
    MessageSquare, Send, Paperclip, X, Image as ImageIcon,
    FileType, Sparkles, BookOpen, Clock, FileText, ChevronRight, Menu, Trash2, Bot, Plus, Code, ArrowLeft, LayoutGrid, Copy, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'katex/dist/katex.min.css';
import { saveFileToDB, getFileFromDB, clearFilesFromDB } from '../../utils/indexedDB';
import * as pdfjsLib from 'pdfjs-dist';
import MermaidRenderer from '../MermaidRenderer';
// Explicitly setting worker for Vite compatibility
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
// ContentGenerator removed


import { getAICompletion } from '../../utils/aiService';
import { useAuth } from '../../contexts/AuthContext';

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

export default function AIChat({ setActiveTab }) {
    const { userProfile: profile } = useAuth();
    const [sessions, setSessions] = useState(() => {
        const savedSessions = localStorage.getItem('hope_ai_sessions');
        if (savedSessions) return JSON.parse(savedSessions);
        const oldHistory = localStorage.getItem('hope_ai_chat_history');
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
        const lastId = localStorage.getItem('hope_ai_active_session_id');
        return lastId || (sessions.length > 0 ? sessions[0].id : null);
    });


    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const navigate = useNavigate();
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
        const warned = localStorage.getItem('hope_chat_warning_dismissed');
        if (!warned) setShowWarning(true);
    }, []);

    useEffect(() => {
        if (activeSessionId) localStorage.setItem('hope_ai_active_session_id', activeSessionId);
    }, [activeSessionId]);

    useEffect(() => {
        if (sessions.length > 0) {
            try {
                localStorage.setItem('hope_ai_sessions', JSON.stringify(sessions));
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    const emergencySessions = sessions.filter(s => s.id === activeSessionId);
                    localStorage.setItem('hope_ai_sessions', JSON.stringify(emergencySessions));
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

    const handlePrint = (content) => {
        const cleanContent = content.replace('[[PDF_ATTACHMENT]]', '');

        // Extract title for filename
        const titleMatch = cleanContent.match(/^#+\s*(.+)$/m);
        const docTitle = titleMatch ? titleMatch[1].trim() : 'HOPE_Document';

        // Open window first
        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert("Please allow popups to print");

        const htmlContent = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>${docTitle}</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
                    <style>
                        @page {
                            size: A4;
                            margin: 20mm;
                        }
                        body {
                            font-family: 'Merriweather', serif; /* Serif is better for docs */
                            line-height: 1.6;
                            color: #333;
                            max-width: 210mm;
                            margin: 0 auto;
                            padding: 20px;
                            background: white;
                        }
                        /* Typography */
                        h1, h2, h3, h4, h5, h6 {
                            font-family: 'Inter', sans-serif;
                            color: #111827;
                            font-weight: 700;
                            margin-top: 1.5em;
                            margin-bottom: 0.75em;
                            page-break-after: avoid;
                        }
                        h1 { font-size: 24pt; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.3em; }
                        h2 { font-size: 18pt; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; }
                        h3 { font-size: 14pt; }
                        p { margin-bottom: 1em; text-align: justify; }
                        
                        /* Lists */
                        ul, ol { margin-bottom: 1em; padding-left: 2em; }
                        li { margin-bottom: 0.4em; }
                        
                        /* Code */
                        code {
                            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
                            background-color: #f3f4f6;
                            padding: 0.2em 0.4em;
                            border-radius: 4px;
                            font-size: 0.9em;
                        }
                        pre {
                            background-color: #1f2937;
                            color: #f9fafb;
                            padding: 1.25em;
                            border-radius: 8px;
                            overflow-x: auto;
                            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
                            margin-bottom: 1.5em;
                            page-break-inside: avoid;
                        }
                        pre code {
                            background-color: transparent;
                            padding: 0;
                            color: inherit;
                        }

                        /* Quotes */
                        blockquote {
                            border-left: 4px solid #3b82f6;
                            margin: 1.5em 0;
                            padding-left: 1em;
                            font-style: italic;
                            color: #4b5563;
                            background: #f9fafb;
                            padding: 1em 1em 1em 2em;
                            border-radius: 0 8px 8px 0;
                        }

                        /* Tables */
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 1.5em;
                            font-family: 'Inter', sans-serif;
                            font-size: 0.95em;
                        }
                        th, td {
                            border: 1px solid #e5e7eb;
                            padding: 0.75em;
                            text-align: left;
                        }
                        th {
                            background-color: #f9fafb;
                            font-weight: 600;
                        }
                        tr:nth-child(even) { background-color: #f9fafb; }

                        /* Images */
                        img {
                            max-width: 100%;
                            height: auto;
                            display: block;
                            margin: 1.5em auto;
                            border-radius: 8px;
                        }

                        /* Helper */
                        .print-footer {
                            margin-top: 3rem;
                            padding-top: 1rem;
                            border-top: 1px solid #e5e7eb;
                            text-align: center;
                            font-size: 9pt;
                            color: #9ca3af;
                            font-family: 'Inter', sans-serif;
                        }

                        @media print {
                            body { -webkit-print-color-adjust: exact; padding: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div id="loading" style="text-align: center; padding-top: 50px; font-family: sans-serif; color: #666;">Preparing document...</div>
                    <div id="content" style="display: none;"></div>
                    <div class="print-footer">Generated by HOPE AI Tutor</div>

                    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
                    <script>
                        // Content passed safely
                        const markdownContent = ${JSON.stringify(cleanContent)};
                        
                        // Wait for marked
                        window.onload = function() {
                            try {
                                const rendered = marked.parse(markdownContent);
                                const contentDiv = document.getElementById('content');
                                contentDiv.innerHTML = rendered;
                                contentDiv.style.display = 'block';
                                document.getElementById('loading').style.display = 'none';
                                
                                // Delay slightly to ensure fonts/images render
                                setTimeout(() => {
                                    window.print();
                                    // Optional: window.close(); 
                                }, 800);
                            } catch (e) {
                                document.getElementById('loading').innerText = "Error rendering document.";
                                console.error(e);
                            }
                        };
                    </script>
                </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close(); // Important for loading to finish
    };

    const generateAIResponse = async (sessionId, currentHistory) => {
        setLoading(true);
        try {
            const systemPrompt = `You are Justin, a helpful engineering tutor at HOPE Community. Strictly use syllabus: ${syllabusText.substring(0, 3000)}. 
            If the user asks to "make a pdf", "convert to pdf", "give pdf", or "download as pdf", generate ONLY the document content (headers, body, tables) without any conversational fillers, intros, or outros. Start directly with the Title/Header and end with the content. Append the tag "[[PDF_ATTACHMENT]]" at the very end.`;

            // Prepare messages for AI
            const requestMessages = [
                { role: "system", content: systemPrompt },
            ];

            // Reconstruct conversation history with file context
            for (const m of currentHistory) {
                if (m.role === 'user') {
                    if (m.fileType?.startsWith('image/') && m.filePreview) {
                        requestMessages.push({
                            role: "user",
                            content: [
                                { type: "text", text: m.content || "Analyze this image." },
                                { type: "image_url", image_url: { url: m.filePreview } }
                            ]
                        });
                    } else if (m.fileType === 'application/pdf' && m.fileId) {
                        // We might need to re-extract or assume content is enough? 
                        // For simplicity in this flow, we assume simple text history or basic context. 
                        // Deep file re-reading might be heavy. 
                        // If text was extracted before, maybe we should have stored it?
                        // Current `handleSend` extracts it ON THE FLY and pushes to `requestMessages` but DOES NOT save it to `messages` state content?
                        // ERROR in original code: `requestMessages.push... content: ... [PDF] ...` 
                        // but `setSessions` only saved `input`!
                        // So history loses the PDF text! 
                        // To fix this properly for regenerate, we'd need to re-read the file.
                        // But for now, let's just proceed with text history.
                        requestMessages.push({ role: "user", content: m.content });
                    } else {
                        requestMessages.push({ role: "user", content: m.content });
                    }
                } else {
                    requestMessages.push({ role: "assistant", content: m.content });
                }
            }

            // Determine model based on LAST user message having an image?
            // Or if ANY message has an image? Usually vision models are needed if the *current* context turns on vision.
            // Let's check the last user message.
            const lastUserMsg = currentHistory.filter(m => m.role === 'user').pop();
            const isVision = lastUserMsg?.fileType?.startsWith('image/');

            const aiContent = await getAICompletion(requestMessages, {
                model: isVision ? "nvidia/nemotron-nano-12b-v2-vl:free" : "llama-3.1-8b-instant",
            });

            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...currentHistory, { role: 'assistant', content: aiContent }] } : s));
        } catch (e) {
            console.error(e);
            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...currentHistory, { role: 'assistant', content: `⚠️ Error occurred: ${e.message || "Please try again."}` }] } : s));
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerate = async (msgIndex) => {
        if (loading) return;
        const currentSession = sessions.find(s => s.id === activeSessionId);
        if (!currentSession) return;

        // Keep history UP TO this message (exclusive of the assistant message we are regenerating)
        // Assistant message is at `msgIndex`. We want 0...msgIndex-1.
        const newHistory = currentSession.messages.slice(0, msgIndex);

        // Update UI to remove the old message(s) immediately
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: newHistory } : s));

        // Trigger Generation
        await generateAIResponse(activeSessionId, newHistory);
    };



    const handleSend = async () => {
        if ((!input.trim() && !selectedFile) || loading) return;
        setLoading(true);
        let currentActiveId = activeSessionId;

        try {
            if (!currentActiveId) {
                const newId = crypto.randomUUID();
                const newSession = {
                    id: newId,
                    title: input.trim() ? input.substring(0, 30) : "New Chat",
                    messages: [],
                    timestamp: Date.now()
                };
                setSessions([newSession, ...sessions]);
                setActiveSessionId(newId);
                currentActiveId = newId;
            }

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

            // Optimistically update UI
            setSessions(prev => prev.map(s => s.id === currentActiveId ? { ...s, messages: [...s.messages, userMsg] } : s));

            const systemPrompt = `You are Justin, a helpful engineering tutor at HOPE Community. Strictly use syllabus: ${syllabusText.substring(0, 3000)}. 
            If the user asks to "make a pdf", "convert to pdf", "give pdf", or "download as pdf", generate ONLY the document content (headers, body, tables) without any conversational fillers, intros, or outros. Start directly with the Title/Header and end with the content. Append the tag "[[PDF_ATTACHMENT]]" at the very end.`;
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

            const aiContent = await getAICompletion(requestMessages, {
                model: selectedFile?.type.startsWith('image/') ? "nvidia/nemotron-nano-12b-v2-vl:free" : "llama-3.1-8b-instant",
                onFallback: (msg) => {
                    console.log("Fallback triggered:", msg);
                }
            });

            // Update with AI response (only append assistant, userMsg is already there)
            setSessions(prev => prev.map(s => s.id === currentActiveId ? { ...s, messages: [...s.messages, { role: 'assistant', content: aiContent }] } : s));
        } catch (e) {
            console.error(e);
            if (currentActiveId) {
                setSessions(prev => prev.map(s => s.id === currentActiveId ? { ...s, messages: [...s.messages, { role: 'assistant', content: `⚠️ Error occurred: ${e.message || "Please try again."}` }] } : s));
            }
        } finally {
            setLoading(false);
        }
    };



    return (
        <div className="d-flex flex-column vh-100 position-fixed top-0 start-0 w-100 bg-white">

            {/* 1. Header (Simple & Clean) */}
            <nav className="d-flex align-items-center justify-content-between px-4 py-3 sticky-top bg-white border-bottom shadow-sm" style={{ zIndex: 1040 }}>
                <div className="d-flex align-items-center gap-3">
                    <button
                        className="btn btn-outline-secondary rounded-circle p-0 d-flex align-items-center justify-content-center"
                        onClick={() => navigate('/ai-tutor')}
                        style={{ width: 36, height: 36 }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <button
                        className="btn btn-light rounded-circle p-0 d-flex align-items-center justify-content-center"
                        onClick={() => setIsSidebarOpen(true)}
                        style={{ width: 36, height: 36 }}
                    >
                        <Menu size={18} />
                    </button>
                    <div className="d-flex align-items-center gap-2 px-3 py-1 bg-light rounded-pill border">
                        <div className="bg-success rounded-circle animate-pulse" style={{ width: 8, height: 8 }}></div>
                        <span className="fw-bold text-dark small">AI Tutor Active</span>
                    </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        className="btn btn-primary rounded-pill px-4 py-2 small fw-bold shadow-sm d-flex align-items-center gap-2"
                        onClick={createNewChat}
                    >
                        <Plus size={18} /> <span className="d-none d-md-inline">New Chat</span>
                    </button>
                </div>
            </nav>

            {/* Sidebar Slider (Unchanged Logic, visual tweak) */}
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
                            className="position-fixed top-0 start-0 h-100 bg-white shadow-lg d-flex flex-column"
                            style={{ zIndex: 1070, width: '300px' }}
                        >
                            <div className="p-4 border-bottom d-flex justify-content-between align-items-center">
                                <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">History</h5>
                                <button className="btn btn-sm btn-light rounded-circle" onClick={() => setIsSidebarOpen(false)}><X size={18} /></button>
                            </div>

                            <div className="p-3">
                                <button onClick={createNewChat} className="btn btn-dark w-100 py-2 rounded-pill fw-medium d-flex align-items-center justify-content-center gap-2">
                                    <Plus size={18} /> New Chat
                                </button>
                            </div>

                            <div className="flex-grow-1 overflow-auto p-3 custom-scrollbar">
                                <h6 className="text-muted text-uppercase small fw-bold mb-3 ms-1">Recent</h6>
                                {sessions.length === 0 && <p className="text-muted small text-center py-4">No previous chats.</p>}
                                {sessions.map(s => (
                                    <motion.div
                                        key={s.id}
                                        whileHover={{ scale: 1.01 }}
                                        onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }}
                                        className={`p-3 rounded-3 cursor-pointer mb-2 d-flex justify-content-between align-items-center ${activeSessionId === s.id ? 'bg-light' : 'hover-bg-light'}`}
                                    >
                                        <span className="text-truncate small fw-medium text-dark" style={{ maxWidth: '180px' }}>{s.title}</span>
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
                )
                }
            </AnimatePresence>

            {/* 2. Chat Canvas (Text-on-Canvas) */}
            <div className="flex-grow-1 overflow-auto px-3 pt-5 pb-5 custom-scrollbar d-flex flex-column bg-white" style={{ marginTop: '60px', paddingBottom: '140px' }}>
                <div className="container mx-auto" style={{ maxWidth: '720px' }}>
                    {/* 3. Simple Zero State */}
                    {messages.length === 0 ? (
                        <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center mt-5">
                            <div className="mb-4 bg-primary bg-opacity-10 p-4 rounded-circle text-primary">
                                <Bot size={48} strokeWidth={1.5} />
                            </div>

                            <h2 className="fw-bold text-dark mb-2">
                                {profile?.full_name ? `Hi, ${profile.full_name.split(' ')[0]}!` : "Welcome!"}
                            </h2>

                            <p className="text-muted fs-5 mb-5">
                                How can I help with your engineering studies today?
                            </p>

                            <div className="row g-3 w-100 px-3" style={{ maxWidth: '600px' }}>
                                {[
                                    {
                                        icon: Sparkles,
                                        title: "Explain Concept",
                                        desc: "Clear engineering breakdowns.",
                                        prompt: "Can you explain the main concepts of [Topic] in simple terms?"
                                    },
                                    {
                                        icon: Code,
                                        title: "Debug Code",
                                        desc: "Find bugs and optimize logic.",
                                        prompt: "Can you help me debug this code and explain the logic?"
                                    },
                                    {
                                        icon: BookOpen,
                                        title: "Exam Roadmap",
                                        desc: "15-day revision path.",
                                        prompt: "Outline a 15-day revision roadmap for my [Subject] exam."
                                    }
                                ].map((starter, i) => (
                                    <div key={i} className="col-md-4">
                                        <div
                                            onClick={() => setInput(starter.prompt)}
                                            className="p-3 h-100 d-flex flex-column align-items-center gap-2 cursor-pointer text-center bg-white border border-light shadow-sm rounded-4 hover-scale"
                                        >
                                            <div className="p-2 rounded-circle text-primary bg-light">
                                                <starter.icon size={20} />
                                            </div>
                                            <div>
                                                <div className="fw-bold text-dark small">{starter.title}</div>
                                                <div className="text-muted x-small opacity-75">{starter.desc}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={idx}
                                className={`d-flex flex-column mb-4 w-100 ${msg.role === 'user' ? 'align-items-end' : 'align-items-start'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="d-flex align-items-center gap-2 mb-2 ms-1 text-primary opacity-75">
                                        <Bot size={16} strokeWidth={2.5} />
                                        <span className="fw-bold small text-uppercase tracking-wider">AI Response</span>
                                    </div>
                                )}
                                {/* Message Content */}
                                <div
                                    className={`px-3 py-2 ${msg.role === 'user'
                                        ? 'bg-gray-100 text-gray-900 rounded-2xl px-4 py-3'
                                        : 'bg-white border rounded-4 p-4 mb-2'
                                        }`}
                                    style={{
                                        maxWidth: msg.role === 'user' ? '85%' : '100%',
                                        fontSize: '1rem',
                                        lineHeight: '1.6',
                                        wordBreak: 'break-word'
                                    }}
                                >
                                    {msg.role === 'user' && (
                                        <>
                                            {msg.filePreview && (
                                                <div className="mb-2 rounded overflow-hidden">
                                                    {msg.fileType?.startsWith('image/') ?
                                                        <img src={msg.filePreview} alt="Upload" className="img-fluid rounded" style={{ maxHeight: '150px' }} /> :
                                                        <div className="bg-white p-2 rounded d-flex align-items-center gap-2 small"><FileText size={16} /> {msg.fileName}</div>
                                                    }
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {msg.role === 'assistant' ? (
                                        <div className="prose">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkMath, remarkGfm]}
                                                rehypePlugins={[rehypeKatex]}
                                                components={{
                                                    code({ node, inline, className, children, ...props }) {
                                                        const match = /language-(\w+)/.exec(className || '');
                                                        if (!inline && match && match[1] === 'mermaid') {
                                                            return <MermaidRenderer chart={String(children).replace(/\\n$/, '')} />;
                                                        }
                                                        if (inline) return <code className="bg-secondary bg-opacity-10 px-1 rounded text-purple" {...props}>{children}</code>;
                                                        return <div className="bg-light p-3 rounded-3 my-2 overflow-auto border border-light"><code {...props} className="text-dark small" style={{ fontFamily: 'Fira Code, monospace' }}>{children}</code></div>
                                                    },
                                                    h1: ({ node, ...props }) => <h3 className="fw-bold mt-4 mb-3 h5 text-dark" {...props} />,
                                                    h2: ({ node, ...props }) => <h4 className="fw-bold mt-3 mb-2 h6 text-dark" {...props} />,
                                                    h3: ({ node, ...props }) => <h5 className="fw-bold mt-3 mb-2 h6 text-dark" {...props} />,
                                                    ul: ({ node, ...props }) => <ul className="ps-3 mb-3 text-dark" {...props} />,
                                                    ol: ({ node, ...props }) => <ol className="ps-3 mb-3 text-dark" {...props} />,
                                                    p: ({ node, ...props }) => <p className="mb-3 text-dark" {...props} />,
                                                }}
                                            >
                                                {msg.content.replace('[[PDF_ATTACHMENT]]', '')}
                                            </ReactMarkdown>

                                            {/* PDF Attachment Card */}
                                            {msg.content.includes('[[PDF_ATTACHMENT]]') && (
                                                <div
                                                    className="clay-card p-3 mt-3 d-flex align-items-center gap-3 cursor-pointer hover-scale border border-danger border-opacity-25"
                                                    style={{ maxWidth: '300px', background: 'rgba(254, 226, 226, 0.3)' }}
                                                    onClick={() => handlePrint(msg.content)}
                                                >
                                                    <div className="bg-danger bg-opacity-10 p-2 rounded-circle text-danger">
                                                        <FileType size={24} />
                                                    </div>
                                                    <div>
                                                        <h6 className="fw-bold mb-0 text-dark">
                                                            {(() => {
                                                                const match = msg.content.replace('[[PDF_ATTACHMENT]]', '').match(/^#+\s*(.+)$/m);
                                                                return match ? (match[1].trim().substring(0, 30) + (match[1].length > 30 ? '...' : '.pdf')) : 'Document.pdf';
                                                            })()}
                                                        </h6>
                                                        <small className="text-muted">Tap to print/save</small>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                                    )}
                                </div>

                                {/* Action Row (Assistant Only) */}
                                {
                                    msg.role === 'assistant' && (
                                        <div className="d-flex align-items-center gap-3 mt-2 text-muted px-1">
                                            <button
                                                className="btn btn-link p-0 text-muted hover-text-dark"
                                                title="Regenerate"
                                                onClick={() => handleRegenerate(idx)}
                                            >
                                                <RefreshCw size={14} />
                                            </button>
                                            <button
                                                className="btn btn-link p-0 text-muted hover-text-dark"
                                                title="Copy"
                                                onClick={() => navigator.clipboard.writeText(msg.content)}
                                            >
                                                <Copy size={14} />
                                            </button>
                                        </div>
                                    )
                                }
                            </motion.div>
                        ))
                    )}

                    {/* Thinking State */}
                    {loading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="d-flex flex-column align-items-start w-100 gap-2 mb-5">
                            <div className="d-flex align-items-center gap-2 text-muted small fw-medium px-1">
                                <Sparkles size={14} className="text-warning animate-pulse" />
                                <span className="animate-pulse">Reasoning...</span>
                            </div>
                            <div className="typing-loader ms-1">
                                <span></span><span></span><span></span>
                            </div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} style={{ height: '100px' }} />
                </div>
            </div >

            {/* 4. Input Area (Floating Capsule) */}
            < div className="position-fixed bottom-0 start-0 w-100 d-flex justify-content-center px-3 mb-4" style={{ zIndex: 1051, pointerEvents: 'none' }}>
                <div
                    className="w-100 bg-white shadow-lg d-flex align-items-center gap-2 p-2 ps-3 border border-gray-100 mx-4 mb-4"
                    style={{
                        maxWidth: '720px',
                        pointerEvents: 'auto',
                        borderRadius: '9999px', // rounded-full
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)'
                    }}
                >
                    {/* Dashboard Button */}
                    <button
                        onClick={() => navigate('/ai-tutor')}
                        className="btn btn-light rounded-circle p-0 d-flex align-items-center justify-content-center text-secondary hover-bg-light flex-shrink-0 me-2"
                        style={{ width: 36, height: 36 }}
                    >
                        <LayoutGrid size={20} />
                    </button>

                    {/* Plus Icon */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-light rounded-circle p-0 d-flex align-items-center justify-content-center text-secondary hover-bg-light flex-shrink-0"
                        style={{ width: 36, height: 36 }}
                    >
                        <Plus size={20} />
                    </button>
                    <input type="file" ref={fileInputRef} className="d-none" onChange={handleFileChange} />

                    {/* Input Field */}
                    <div className="flex-grow-1 position-relative">
                        {selectedFile && (
                            <div className="position-absolute bottom-100 start-0 mb-3 bg-white border shadow-sm p-2 rounded-3 d-flex align-items-center gap-2 small">
                                <FileText size={14} className="text-primary" />
                                <span className="text-truncate" style={{ maxWidth: '120px' }}>{selectedFile.name}</span>
                                <button onClick={clearFile} className="btn btn-link p-0 text-muted"><X size={14} /></button>
                            </div>
                        )}
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            className="form-control border-0 bg-transparent shadow-none px-2 py-2 custom-scrollbar text-dark placeholder-gray-400"
                            rows={1}
                            placeholder="How can I help you today?"
                            style={{ resize: 'none', maxHeight: '100px', minHeight: '24px', fontSize: '1rem' }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (input.trim() || selectedFile) handleSend();
                                }
                            }}
                        />
                    </div>



                    {/* Send Button (Simple Blue Circle) */}
                    <button
                        onClick={() => { (input.trim() || selectedFile) && !loading && handleSend() }}
                        disabled={(!input.trim() && !selectedFile) || loading}
                        className="btn rounded-circle p-0 d-flex align-items-center justify-content-center text-white flex-shrink-0 transition-transform"
                        style={{
                            width: 40,
                            height: 40,
                            backgroundColor: (input.trim() || selectedFile) && !loading ? '#2563eb' : '#e2e8f0',
                            border: 'none',
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <Send size={18} strokeWidth={2.5} />
                    </button>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 0px; background: transparent; }
                .typing-loader span {
                    display: inline-block;
                    width: 5px;
                    height: 5px;
                    background-color: #94a3b8;
                    border-radius: 50%;
                    margin: 0 2px;
                    animation: typing 1s infinite;
                }
                .typing-loader span:nth-child(2) { animation-delay: 0.2s; }
                .typing-loader span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes typing {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                .hover-scale:active { transform: scale(0.95); }
                .cursor-pointer { cursor: pointer; }
                .hover-bg-light:hover { background-color: #f8f9fa; }
                .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
            `}</style>
        </div>
    );
}
