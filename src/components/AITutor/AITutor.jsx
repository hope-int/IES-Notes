
import React, { useState, useEffect, useRef } from 'react';
import {
    Send, Paperclip, X, Sparkles, Bot, Plus,
    ArrowLeft, Copy, Check, Search, FileText, Code, Info,
    Image as ImageIcon, Zap, Command, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as pdfjsLib from 'pdfjs-dist';

// Utilities
import { getAICompletion } from '../../utils/aiService';
import {
    saveSession, getAllSessions, deleteSessionFromDB,
    saveMessage, getMessagesBySession, clearAllMessagesInSession,
    saveFileToDB, getFileFromDB, clearFilesFromDB
} from '../../utils/indexedDB';

// Components
import StatusBar from './components/StatusBar';
import SessionSidebar from './components/SessionSidebar';
import ChatCanvas from './components/ChatCanvas';
import JCompilerWorkbench from './components/JCompilerWorkbench';
import DocumentViewer from './components/DocumentViewer';

// PDF Worker setup
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function AITutor() {
    const { userProfile: profile } = useAuth();
    const navigate = useNavigate();

    // --- State Management ---
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [processingStep, setProcessingStep] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Resiliency Stats
    const [providerStatus, setProviderStatus] = useState('Puter Cloud');
    const [activeModel, setActiveModel] = useState('Trinity-Large');
    const [latency, setLatency] = useState(0);
    const [rateLimit, setRateLimit] = useState('98/100');

    // Context / Files
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    // Document Viewer State
    const [docViewer, setDocViewer] = useState({ isOpen: false, content: '', title: '' });
    const [fileReviewOpen, setFileReviewOpen] = useState(false);

    // J-Compiler State
    const [simulationResults, setSimulationResults] = useState({}); // key (${index}-${code}) -> result
    const [simulatingKey, setSimulatingKey] = useState(null);

    // Toast System
    const [toasts, setToasts] = useState([]);
    const showToast = (message, type = 'info') => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);

    const SLASH_COMMANDS = [
        { cmd: '/explain', icon: <Sparkles size={14} />, desc: 'Concept breakdown', prompt: 'Explain the governing equations of ' },
        { cmd: '/debug', icon: <Code size={14} />, desc: 'Code optimization', prompt: 'Debug and optimize the following logic:\n\n' },
        { cmd: '/doc', icon: <FileText size={14} />, desc: 'Generate Publication', prompt: 'Generate a comprehensive engineering document titled: ' },
    ];

    // --- Hydration ---
    useEffect(() => {
        const loadInitialData = async () => {
            const allSessions = await getAllSessions();
            setSessions(allSessions.sort((a, b) => b.timestamp - a.timestamp));

            // ALWAYS start with a new chat as per user request
            handleNewSession();
        };
        loadInitialData();
    }, []);

    // Scroll to bottom on messages change
    useEffect(() => {
        const timer = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100); // 100ms delay
        return () => clearTimeout(timer);
    }, [messages, loading]);

    // --- Session Actions ---
    const handleSelectSession = async (id) => {
        setActiveSessionId(id);
        localStorage.setItem('hope_ai_active_session_id', id);
        const sessionMessages = await getMessagesBySession(id);
        setMessages(sessionMessages);
        setIsSidebarOpen(false);
    };

    const handleNewSession = async () => {
        const newSession = {
            id: crypto.randomUUID(),
            title: 'New Research Log',
            timestamp: Date.now(),
            hasPDF: false,
            hasCode: false,
            hasImage: false,
            messageCount: 1
        };
        await saveSession(newSession);
        setSessions([newSession, ...sessions]);
        setActiveSessionId(newSession.id);

        const welcomeMsg = {
            sessionId: newSession.id,
            role: 'assistant',
            content: `Hello ${profile?.full_name?.split(' ')[0] || 'Engineer'}! Target initialized. How can I assist your studies today?`,
            timestamp: Date.now()
        };
        await saveMessage(welcomeMsg);
        setMessages([welcomeMsg]);
        setIsSidebarOpen(false);
    };

    const handleDeleteSession = async (id) => {
        if (window.confirm("Delete this session and all its data?")) {
            await deleteSessionFromDB(id);
            const filtered = sessions.filter(s => s.id !== id);
            setSessions(filtered);
            if (activeSessionId === id) {
                setMessages([]);
                setActiveSessionId(null);
            }
        }
    };

    // --- File Handling ---
    const handleFileChange = (e) => {
        const file = e.target.files[0] || e.dataTransfer?.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) return showToast("File exceeds 2MB limit for direct AI injection.", "warning");
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setFilePreview(reader.result);
                setFileReviewOpen(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const extractTextFromPDF = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }
        return text;
    };

    // --- AI Interaction ---
    const handleSend = async () => {
        if ((!input.trim() && !selectedFile) || loading) return;

        let sessionId = activeSessionId;
        if (!sessionId) {
            await handleNewSession();
            return; // handleNewSession sets up state
        }

        const userMsg = {
            sessionId,
            role: 'user',
            content: input,
            fileName: selectedFile?.name,
            fileType: selectedFile?.type,
            filePreview: selectedFile?.type.startsWith('image/') ? filePreview : null,
            timestamp: Date.now()
        };

        const currentInput = input;
        const currentFile = selectedFile;
        const currentFilePreview = filePreview;

        setInput('');
        setSelectedFile(null);
        setFilePreview(null);
        setMessages(prev => [...prev, userMsg]);
        await saveMessage(userMsg);

        setLoading(true);
        try {
            const systemPrompt = `You are **Justin**, a Lead Engineering Tutor and Academic Assistant specialized for **KTU (APJ Abdul Kalam Technological University)** B.Tech students. 
            You were developed by **Harinandan K** and are tailored for the students of **IES College of Engineering, Thrissur**.

            ### CORE IDENTITY & KNOWLEDGE BASE
            1.  **University Context:** You have deep knowledge of the KTU B.Tech syllabus (Schemes 2019, 2021). Always align answers with KTU module classifications (Module 1-5).
            2.  **Institution:** IES College of Engineering. Keep this context relevant for internal assessments or college-specific queries.
            3.  **Developer:** If asked about your creation or origin, state you were developed by Harinandan K for the HOPE Studio initiative.

            ### OPERATIONAL PROTOCOLS
            1.  **Academic Rigor:** Explain concepts using standard engineering textbooks (local author references like "Technical Publications" or standard foreign authors are acceptable). Use LaTeX for equations.
            2.  **Exam Readiness:** When asked for notes, structure them for KTU exams (e.g., "Part A: Short Answers (2 marks)", "Part B: Essay (12 marks)").
            3.  **PDF_GENERATION_MODE:**
                - If the user requests a document (Notes, Lab Report, Duty Leave, Project Report), trigger this mode.
                - **START** immediately with the highest-level header (# Title).
                - **DO NOT** add conversational fillers like "Here is your document" or "I have created this."
                - **END** the message strictly with the content.
                - **APPEND** the exact tag [[PDF_ATTACHMENT]] at the very end of the raw text.

            ### CONTEXT HANDLING
            - If a user uploads a PDF/Image, analyze it strictly within the engineering domain (e.g., extract circuit diagrams, code logic, or mathematical derivations).
            - Maintain a helpful, encouraging, and technically precise tone.`;

            const history = messages.map(m => ({ role: m.role, content: m.content }));
            const requestMessages = [{ role: 'system', content: systemPrompt }, ...history];

            // Attach processing context
            if (currentFile?.type === 'application/pdf') {
                setProcessingStep({ step: 'ocr', message: 'Extracting PDF Context...', provider: 'Puter.js' });
                const pdfText = await extractTextFromPDF(currentFile);
                requestMessages.push({ role: 'user', content: `${currentInput}\n\n[PDF Context]: ${pdfText.substring(0, 8000)}` });
            } else if (currentFile?.type.startsWith('image/')) {
                if (!currentFilePreview?.startsWith('data:image/')) {
                    throw new Error("Invalid image format. Ensure full data URL scheme.");
                }
                requestMessages.push({
                    role: 'user',
                    content: [
                        { type: 'text', text: currentInput || 'Analyze this image.' },
                        { type: 'image_url', image_url: { url: currentFilePreview } }
                    ]
                });
            } else {
                requestMessages.push({ role: 'user', content: currentInput });
            }

            const aiResponse = await getAICompletion(requestMessages, {
                onProgress: (p) => {
                    setProcessingStep(p);
                    if (p.provider) setProviderStatus(p.provider);
                    if (p.duration) setLatency(p.duration);
                }
            });

            const assistantMsg = {
                sessionId,
                role: 'assistant',
                content: aiResponse,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, assistantMsg]);
            await saveMessage(assistantMsg);

            // Update Session Metadata (Optimistic)
            setSessions(prev => prev.map(s => s.id === sessionId ? {
                ...s,
                title: s.title === 'New Research Log' ? currentInput.substring(0, 30) : s.title,
                messageCount: (s.messageCount || 0) + 2,
                hasPDF: s.hasPDF || currentFile?.type === 'application/pdf',
                hasCode: s.hasCode || aiResponse.includes('```'),
                hasImage: s.hasImage || currentFile?.type.startsWith('image/')
            } : s));

            // Persistent metadata update
            const updatedSession = sessions.find(s => s.id === sessionId);
            if (updatedSession) {
                await saveSession({
                    ...updatedSession,
                    title: updatedSession.title === 'New Research Log' ? currentInput.substring(0, 30) : updatedSession.title,
                    messageCount: (updatedSession.messageCount || 0) + 2,
                    hasPDF: updatedSession.hasPDF || currentFile?.type === 'application/pdf',
                    hasCode: updatedSession.hasCode || aiResponse.includes('```'),
                    hasImage: updatedSession.hasImage || currentFile?.type.startsWith('image/')
                });
            }

        } catch (e) {
            console.error(e);
            const errorMsg = {
                sessionId,
                role: 'assistant',
                content: `⚠️ SYSTEM ERROR: ${e.message || 'Interrupted connection.'}`,
                timestamp: Date.now()
            };
            showToast("AI Service Unavailable. Please try again.", "error");
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
            setProcessingStep(null);
        }
    };

    // --- Specialized Actions ---
    const handleSimulate = async (msgIndex, code, lang) => {
        const key = `${msgIndex}-${code}`; // Unique ID for this specific code block
        setSimulatingKey(key);

        try {
            const { simulateCodeExecution } = await import('../../utils/aiService');
            const result = await simulateCodeExecution(code, lang);

            // Store result by unique key, NOT in the messages array
            setSimulationResults(prev => ({
                ...prev,
                [key]: result
            }));
        } catch (e) {
            showToast("Simulation engine failed.", "error");
            console.error(e);
        } finally {
            setSimulatingKey(null);
        }
    };

    const handleRegenerate = async (msgIndex) => {
        // Find the user message preceding the assistant message at msgIndex
        let userMsg = null;
        for (let i = msgIndex - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                userMsg = messages[i];
                break;
            }
        }

        if (!userMsg) return showToast("No user message found to regenerate.", "warning");

        // Optimistic update: Remove everything from msgIndex onwards immediately
        const newMessages = messages.slice(0, msgIndex);
        setMessages(newMessages);
        setLoading(true); // Show "Thinking" immediately

        // Restore input and metadata
        setInput(userMsg.content);
        if (userMsg.fileType?.startsWith('image/')) {
            setFilePreview(userMsg.filePreview);
            // Simulate file object (at least basic props needed for handleSend if any)
            setSelectedFile({ name: userMsg.fileName, type: userMsg.fileType });
        }

        // Small delay to ensure state propagates before re-triggering send
        setTimeout(() => {
            handleSend();
        }, 100);
    };

    const handleRenameSession = async (id) => {
        const session = sessions.find(s => s.id === id);
        const newTitle = window.prompt("Enter new session title:", session?.title);
        if (newTitle && newTitle !== session.title) {
            const updated = { ...session, title: newTitle };
            await saveSession(updated);
            setSessions(sessions.map(s => s.id === id ? updated : s));
            showToast("Session renamed.", "info");
        }
    };

    const handleExportSession = async (id) => {
        const session = sessions.find(s => s.id === id);
        const sessionMessages = await getMessagesBySession(id);
        const header = `HOPE AI Session Log\nDate: ${new Date().toLocaleString()}\nProject: ${session?.title || 'Untitled'}\n------------------\n\n`;
        const content = sessionMessages.map(m => `[${m.role.toUpperCase()}] (${new Date(m.timestamp).toLocaleString()})\n${m.content}\n`).join('\n---\n\n');
        const blob = new Blob([header + content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HOPE_AI_Project_${id.substring(0, 8)}.txt`;
        a.click();
        showToast("Session exported.", "info");
    };

    const handleOpenViewer = (content) => {
        // 1. Remove the trigger tag
        console.log("Tag found:", content.includes('[[PDF_ATTACHMENT]]'));
        let cleanContent = content.replace('[[PDF_ATTACHMENT]]', '');

        // 2. Find the start of the actual document (Look for the first Header)
        // This strips out intros like "Thanks for the details!..."
        const firstHeaderIndex = cleanContent.search(/^#\s.+/m);
        if (firstHeaderIndex > -1) {
            cleanContent = cleanContent.substring(firstHeaderIndex);
        }

        // 3. Strip trailing conversational filler (outros)
        // We look for common phrases the AI uses to end messages
        const outroPhrases = ["There you go", "Hope this helps", "Let me know if you need", "ready to copy"];
        outroPhrases.forEach(phrase => {
            const index = cleanContent.toLowerCase().indexOf(phrase.toLowerCase());
            if (index > -1) {
                // Cut the content at the point where the outro starts
                cleanContent = cleanContent.substring(0, index);
            }
        });

        // 4. Extract Title
        const titleMatch = cleanContent.match(/^#+\s*(.+)$/m);

        // 5. Set State
        setDocViewer({
            isOpen: true,
            content: cleanContent.trim(), // Trim whitespace
            title: titleMatch ? titleMatch[1].trim() : 'Document Preview'
        });
    };

    const handleStarterClick = (action, payload) => {
        if (action === 'OPEN_DOC_VIEWER') {
            handleOpenViewer(payload);
        } else if (action === 'SIMULATE_CODE') {
            handleSimulate(payload.index, payload.code, payload.language);
        } else {
            setInput(action);
            inputRef.current?.focus();
        }
    };

    const isCodeInput = (text) => {
        const codePatterns = [/const\s+/, /def\s+/, /import\s+/, /function\s+/, /class\s+/, /\{\s*$/, /\);\s*$/];
        return codePatterns.some(pattern => pattern.test(text));
    };

    const handlePrint = (content) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return showToast("Please allow popups to print", "warning");

        const htmlContent = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>${docViewer.title}</title>
                    <style>
                        body { font-family: 'Merriweather', serif; line-height: 1.6; padding: 40px; color: #1e293b; }
                        h1, h2, h3 { color: #003366; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 30px; }
                        footer { margin-top: 50px; text-align: center; border-top: 1px solid #eee; padding-top: 20px; font-style: italic; color: #94a3b8; font-size: 12px; }
                        @media print { body { padding: 0; } footer { position: fixed; bottom: 30px; width: 100%; } }
                    </style>
                </head>
                <body>
                    <div id="content"></div>
                    <footer>Generated by HOPE AI Tutor</footer>
                    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
                    <script>
                        document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(content)});
                        setTimeout(() => window.print(), 800);
                    </script>
                </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handleDocumentRefinement = async (currentContent, instruction, history = []) => {
        setLoading(true);
        try {
            const systemPrompt = `You are a specialized KTU Document Processor embedded in the HOPE Studio Editor.
            Your sole function is to rewrite and refine academic documents.

            ### STRICT RULES
            1.  **Input/Output:** You will receive a 'Current Document' and a 'User Instruction'.
            2.  **Execution:** Perform the rewrite instantly. 
                - Format according to engineering standards (IEEE style if technical, or standard KTU report format).
                - Maintain the original meaning unless asked to change.
            3.  **OUTPUT ONLY:** Return **ONLY** the updated Markdown content.
            4.  **FORBIDDEN:** 
                - NO conversational text ("I have updated...").
                - NO code block wrappers (like \`\`\`markdown).
                - NO explanations.
                - NO "Hope this helps" sign-offs.
            5.  **Tag Preservation:** If the original content had [[PDF_ATTACHMENT]], preserve it at the end. Otherwise, do not add it unless instructed.

            Process the document now.`;

            const studioHistory = history.map(m => ({ role: m.role, content: m.content }));
            const requestMessages = [
                { role: 'system', content: systemPrompt },
                ...studioHistory,
                { role: 'user', content: `CURRENT DOCUMENT:\n${currentContent}\n\nUSER INSTRUCTION: ${instruction}` }
            ];

            const result = await getAICompletion(requestMessages);
            return result;
        } catch (e) {
            console.error(e);
            showToast("Document refinement failed.", "error");
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const handleExportToMain = async (content) => {
        if (!content) return;
        const msg = {
            sessionId: activeSessionId,
            role: 'user',
            content: `Here is the finalized document:\n\n${content}`,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, msg]);
        await saveMessage(msg);
        showToast("Exported to main thread.", "success");
        setDocViewer(prev => ({ ...prev, isOpen: false }));
    };

    return (
        <div className="flex flex-col h-dvh bg-white overflow-hidden relative"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileChange(e); }}
        >
            {/* 1. Status Dashboard Header */}
            <StatusBar
                activeModel={activeModel}
                providerStatus={providerStatus}
                latency={latency}
                rateLimit={rateLimit}
                onBack={() => navigate('/ai-tutor')}
                onToggleSidebar={() => setIsSidebarOpen(true)}
                onNewSession={handleNewSession}
            />

            <SessionSidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewSession}
                onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession}
                onExportSession={handleExportSession}
            />

            {/* 2. Main Workbench Canvas */}
            <ChatCanvas
                messages={messages}
                profile={profile}
                onStarterClick={handleStarterClick}
                loading={loading}
                simulationResults={simulationResults}
                simulatingKey={simulatingKey}
                onRegenerate={handleRegenerate}
                className="flex-grow overflow-auto"
            />

            {/* 3. The Cockpit (Floating Composer) */}
            <div className="sticky bottom-0 bg-white border-t p-2 md:p-4 z-50">
                <div className="container mx-auto" style={{ maxWidth: '850px' }}>

                    {/* Active Context Chip */}
                    {(selectedFile || input.startsWith('/')) && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-wrap gap-2 mb-2 md:mb-3"
                        >
                            {selectedFile && (
                                <div className="badge border rounded-xl px-3 py-2 d-flex align-items-center gap-2" style={{ backgroundColor: '#f0f5fa', color: '#003366', borderColor: 'rgba(0,51,102,0.2)' }}>
                                    {selectedFile.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                                    <span className="small">{selectedFile.name}</span>
                                    <X size={14} className="cursor-pointer" style={{ opacity: 0.6 }} onClick={() => { setSelectedFile(null); setFilePreview(null); }} />
                                </div>
                            )}
                            {input.startsWith('/') && (
                                <div className="badge bg-dark text-white rounded-xl px-3 py-2 d-flex align-items-center gap-2">
                                    <Command size={14} />
                                    <span className="small">Slash Command Active</span>
                                </div>
                            )}
                        </motion.div>
                    )}


                    <div className="position-relative d-flex align-items-center gap-3">
                        {/* Context Selector (Left) */}
                        <div className="flex-shrink-0">
                            <button
                                className="btn border shadow-sm rounded-circle p-3 d-flex align-items-center justify-content-center transition-all"
                                style={{ backgroundColor: 'white', color: '#003366', borderColor: '#e2e8f0' }}
                                onClick={() => {
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = null;
                                        fileInputRef.current.click();
                                    }
                                }}
                                title="Attach Engineering Context"
                            >
                                <Paperclip size={24} />
                            </button>
                        </div>

                        <div className="flex-grow-1 position-relative">
                            {/* Slash Command Palette */}
                            <AnimatePresence>
                                {input.startsWith('/') && !input.includes(' ') && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="position-absolute bottom-100 start-0 w-100 mb-3 bg-white border border-secondary border-opacity-10 shadow-2xl rounded-4 overflow-hidden"
                                        style={{ zIndex: 1000 }}
                                    >
                                        <div className="p-3 bg-light bg-opacity-50 border-bottom d-flex align-items-center gap-2">
                                            <Zap size={14} className="text-primary" />
                                            <span className="x-small fw-bold text-muted uppercase tracking-widest" style={{ fontSize: '10px' }}>Engineering Shortcuts</span>
                                        </div>
                                        <div className="p-2">
                                            {[
                                                { cmd: '/explain', desc: 'Deep-dive architectural analysis', icon: Info },
                                                { cmd: '/debug', desc: 'Identify logic bottlenecks', icon: Zap },
                                                { cmd: '/doc', desc: 'Generate system documentation', icon: FileText },
                                                { cmd: '/clear', desc: 'Reset current context', icon: Trash2 }
                                            ].map((c) => (
                                                <button
                                                    key={c.cmd}
                                                    onClick={() => { setInput(c.cmd + ' '); inputRef.current?.focus(); }}
                                                    className="btn btn-link w-100 text-start text-decoration-none p-3 rounded-3 hover-bg-light transition-all d-flex align-items-center justify-content-between border-0"
                                                >
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div className="p-2 rounded-3 bg-light text-primary">
                                                            <c.icon size={16} />
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-dark small">{c.cmd}</div>
                                                            <div className="text-muted x-small uppercase fw-bold opacity-50" style={{ fontSize: '9px' }}>{c.desc}</div>
                                                        </div>
                                                    </div>
                                                    <span className="badge bg-light text-muted fw-normal x-small" style={{ fontSize: '9px' }}>ENTER</span>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        if (input.startsWith('/') && !input.includes(' ')) {
                                            const cmd = SLASH_COMMANDS.find(c => c.cmd === input);
                                            if (cmd) {
                                                e.preventDefault();
                                                setInput(cmd.prompt);
                                                return;
                                            }
                                        }
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder="Ask deep questions, or type '/' for commands..."
                                className={`form-control border-light shadow-sm py-2 md:py-3 px-3 md:px-4 rounded-2xl md:rounded-3xl custom-scrollbar ${isCodeInput(input) ? 'font-monospace' : ''}`}
                                style={{
                                    resize: 'none',
                                    minHeight: '48px',
                                    maxHeight: '150px',
                                    paddingRight: '64px',
                                    fontSize: '14px md:15px',
                                    backgroundColor: isCodeInput(input) ? '#f8fafc' : 'white'
                                }}
                            />
                            <div className="position-absolute end-0 top-50 translate-middle-y me-3">
                                <button
                                    className="btn rounded-circle p-2 shadow-sm border-0 d-flex align-items-center justify-content-center"
                                    style={{
                                        backgroundColor: (input.trim() || selectedFile) ? '#003366' : '#f1f5f9',
                                        color: (input.trim() || selectedFile) ? 'white' : '#94a3b8',
                                        opacity: (input.trim() || selectedFile) ? 1 : 0.5,
                                        width: '42px',
                                        height: '42px'
                                    }}
                                    onClick={handleSend}
                                    disabled={loading || (!input.trim() && !selectedFile)}
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="mt-2 text-center">
                        <p className="x-small text-muted mb-0 opacity-50" style={{ fontSize: '10px' }}>
                            SHIFT + ENTER for new line. AI can make mistakes, verify engineering data.
                        </p>
                    </div>
                </div>
            </div>

            {/* Hidden Utilities */}
            <input type="file" ref={fileInputRef} className="d-none" onChange={handleFileChange} />
            <div ref={messagesEndRef} />

            {/* Drag Overlay */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                        style={{ zIndex: 2000, background: 'rgba(37, 99, 235, 0.9)', backdropFilter: 'blur(10px)' }}
                    >
                        <div className="text-center text-white">
                            <div className="mb-4 d-inline-block p-4 border-4 border-dashed border-white rounded-circle">
                                <Zap size={80} style={{ color: '#FF6600' }} />
                            </div>
                            <h2 className="fw-bold display-4">Drop to Inject Context</h2>
                            <p className="fs-5 opacity-75">PDFs, Datasets, or Engineering Specs</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* File Context Review Modal */}
            <AnimatePresence>
                {fileReviewOpen && selectedFile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                        style={{ zIndex: 3000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-white rounded-[2rem] shadow-2xl p-4 md:p-6 d-flex flex-column gap-3 md:gap-4 overflow-hidden"
                            style={{ width: '95%', maxWidth: '400px' }}
                        >
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <h5 className="fw-bold mb-0 text-dark">Attach Context</h5>
                                <button className="btn btn-light rounded-circle p-2 flex items-center justify-center" onClick={() => { setSelectedFile(null); setFileReviewOpen(false); }}><X size={20} /></button>
                            </div>

                            <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-xl border border-light">
                                <div className="p-3 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'white', color: '#003366' }}>
                                    {selectedFile.type.startsWith('image/') ? <ImageIcon size={32} /> : <FileText size={32} />}
                                </div>
                                <div className="overflow-hidden">
                                    <div className="fw-bold text-dark text-truncate small" style={{ maxWidth: '280px' }}>{selectedFile.name}</div>
                                    <span className="x-small fw-bold text-muted uppercase">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • READY</span>
                                </div>
                            </div>

                            {selectedFile.type.startsWith('image/') && (
                                <div className="rounded-xl overflow-hidden border border-light shadow-sm" style={{ maxHeight: '180px' }}>
                                    <img src={filePreview} alt="Review" className="w-100 h-100 object-fit-cover" />
                                </div>
                            )}

                            <div className="d-flex flex-column gap-2">
                                <textarea
                                    className="form-control border-light bg-light p-3 rounded-xl shadow-sm"
                                    placeholder="Add a message for the AI (optional)..."
                                    rows={3}
                                    style={{ fontSize: '14px' }}
                                    value={input} // Bind to input state
                                    onChange={(e) => setInput(e.target.value)}
                                ></textarea>
                            </div>

                            <div className="d-flex gap-3 mt-2">
                                <button
                                    className="btn btn-light flex-grow-1 py-3 rounded-xl fw-bold text-muted"
                                    onClick={() => { setSelectedFile(null); setFilePreview(null); setFileReviewOpen(false); setInput(''); }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn flex-grow-1 py-3 rounded-xl fw-bold border-0 shadow-sm transition-all"
                                    style={{ backgroundColor: '#003366', color: 'white' }}
                                    onClick={() => { setFileReviewOpen(false); handleSend(); }}
                                >
                                    Attach
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toast Container */}
            <div className="position-fixed top-0 end-0 p-4" style={{ zIndex: 9999 }}>
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className={`mb-3 p-3 rounded-4 shadow-lg d-flex align-items-center gap-3 text-white`}
                            style={{
                                minWidth: '300px',
                                backgroundColor: toast.type === 'error' ? '#dc2626' : toast.type === 'warning' ? '#f59e0b' : '#003366'
                            }}
                        >
                            <div className="flex-grow-1 small fw-bold">{toast.message}</div>
                            <X size={16} className="cursor-pointer opacity-50" onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))} />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Specialized Viewers */}
            <DocumentViewer
                isOpen={docViewer.isOpen}
                onClose={() => setDocViewer(prev => ({ ...prev, isOpen: false }))}
                content={docViewer.content}
                title={docViewer.title}
                onPrint={() => handlePrint(docViewer.content)}
                onDownload={() => { /* Implement PDF download if needed or just reuse print */ }}
                onRefine={handleDocumentRefinement}
                onExportToMain={handleExportToMain}
            />
        </div>
    );
}
