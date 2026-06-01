
import React, { useState, useEffect, useRef } from 'react';
import {
    Send, Paperclip, X, Sparkles, Bot, Plus,
    ArrowLeft, Copy, Check, Search, FileText, Code, Info,
    Image as ImageIcon, Zap, Command, Trash2, Download, Settings, AlertTriangle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import APIKeyVault from '../Settings/APIKeyVault';
import { extractPDFContext } from '../../utils/pdfUtils';

// Utilities
import { getAICompletion } from '../../utils/aiService';
import { ensurePuterReady } from '../../utils/puterInit';
import {
    saveSession, getAllSessions, deleteSessionFromDB,
    saveMessage, getMessagesBySession
} from '../../utils/indexedDB';

// Components
import StatusBar from './components/StatusBar';
import SessionSidebar from './components/SessionSidebar';
import ChatCanvas from './components/ChatCanvas';
import JCompilerWorkbench from './components/JCompilerWorkbench';
import DocumentViewer from './components/DocumentViewer';

const MotionDiv = motion.div;

const getInstantTutorReply = (text, profile) => {
    const raw = String(text || '').trim();
    if (!raw || raw.length > 48) return null;

    const normalized = raw
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const firstName = profile?.full_name?.split(' ')[0] || 'Engineer';

    if (/^(hi|hii|hiii|hai|hello|hey|yo|sup|gm|gn|good morning|good afternoon|good evening)$/.test(normalized)) {
        return `Hi ${firstName}. Drop the KTU topic, code, PDF, or exam question and I will answer directly.`;
    }

    if (/^(thanks|thank you|ty|ok|okay|k)$/.test(normalized)) {
        return `Done. Send the next topic when you are ready.`;
    }

    if (/^(who are you|what are you|your name|what is your name)$/.test(normalized)) {
        return `I am Justin, the HOPE Studio engineering tutor developed by Harinandan K for KTU students.`;
    }

    return null;
};

export default function AITutor() {
    const { userProfile: profile } = useAuth();
    const navigate = useNavigate();

    // --- State Management ---
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [, setProcessingStep] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Resiliency Stats
    const [providerStatus, setProviderStatus] = useState('Puter Cloud');
    const [activeModel, setActiveModel] = useState('Puter Fast Chat');
    const [latency, setLatency] = useState(0);
    const [rateLimit] = useState('98/100');

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

    // Preview State
    const [previewFile, setPreviewFile] = useState(null);

    // Toast System
    const [toasts, setToasts] = useState([]);
    const showToast = (message, type = 'info') => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    // Provider failure warning
    const [providerError, setProviderError] = useState(null);
    const [vaultOpen, setVaultOpen] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);

    const SLASH_COMMANDS = [
        { cmd: '/explain', icon: <Sparkles size={14} />, desc: 'Concept breakdown', prompt: 'Explain the governing equations of ' },
        { cmd: '/debug', icon: <Code size={14} />, desc: 'Code optimization', prompt: 'Debug and optimize the following logic:\n\n' },
        { cmd: '/doc', icon: <FileText size={14} />, desc: 'Generate Publication', prompt: 'Generate a comprehensive engineering document titled: ' },
    ];
    const MAX_PDF_CONTEXT_CHARS = 120000;

    useEffect(() => {
        ensurePuterReady({ timeoutMs: 10000 }).catch(() => {});
    }, []);

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

    useEffect(() => {
        const textarea = inputRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 154)}px`;
    }, [input]);

    // --- Session Actions ---
    const handleSelectSession = async (id) => {
        setActiveSessionId(id);
        localStorage.setItem('hope_ai_active_session_id', id);
        const sessionMessages = await getMessagesBySession(id);
        setMessages(sessionMessages);
        setIsSidebarOpen(false);
    };

    const handleNewSession = async () => {
        // Reuse existing empty session if possible
        const currentSession = sessions.find(s => s.id === activeSessionId);
        const currentHasUserMsg = messages.some(m => m.role === 'user');
        
        if (currentSession && !currentHasUserMsg) {
            setInput('');
            setFilePreview(null);
            setSelectedFile(null);
            setIsSidebarOpen(false);
            return;
        }

        const newSession = {
            id: crypto.randomUUID(),
            title: 'New Research Log',
            timestamp: Date.now(),
            hasPDF: false,
            hasCode: false,
            hasImage: false,
            messageCount: 0 // Will be corrected on first send
        };
        
        // DO NOT save to DB yet to avoid empty clutter
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);

        const welcomeMsg = {
            sessionId: newSession.id,
            role: 'assistant',
            content: `Hello ${profile?.full_name?.split(' ')[0] || 'Engineer'}! Target initialized. How can I assist your studies today?`,
            timestamp: Date.now()
        };
        
        // DO NOT save message to DB yet
        setMessages([welcomeMsg]);
        setIsSidebarOpen(false);
    };

    const handleDeleteSession = async (id) => {
        if (window.confirm("Delete this session and all its data?")) {
            await deleteSessionFromDB(id);
            setSessions(prev => prev.filter(s => s.id !== id));
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
            if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
                return showToast("Attach a PDF or image file for AI context.", "warning");
            }
            if (file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) {
                return showToast("Image exceeds 2MB limit for direct AI vision.", "warning");
            }
            setSelectedFile(file);
            setFileReviewOpen(true);
            if (file.type === 'application/pdf') {
                setFilePreview(null);
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFilePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // --- AI Interaction ---
    const handleSend = async () => {
        if ((!input.trim() && !selectedFile) || loading) return;
        setLoading(true); // Set loading IMMEDIATELY to prevent double-sends

        let sessionId = activeSessionId; // ← declared OUTSIDE try so catch can access it
        let activeAssistantMsgId = null;
        let streamFrame = null;
        let createdSession = null;
        let createdWelcomeMsg = null;

        try {
            
            // Atomic session creation if missing
            if (!sessionId) {
                const newSession = {
                    id: crypto.randomUUID(),
                    title: input.trim().substring(0, 30) || 'New Research Log',
                    timestamp: Date.now(),
                    hasPDF: selectedFile?.type === 'application/pdf',
                    hasCode: false,
                    hasImage: selectedFile?.type.startsWith('image/'),
                    messageCount: 0
                };
                
                createdSession = newSession;
                setSessions(prev => [newSession, ...prev]);
                setActiveSessionId(newSession.id);
                sessionId = newSession.id;

                const welcomeMsg = {
                    sessionId: newSession.id,
                    role: 'assistant',
                    content: `Hello ${profile?.full_name?.split(' ')[0] || 'Engineer'}! Target initialized. Let's start this session.`,
                    timestamp: Date.now()
                };
                createdWelcomeMsg = welcomeMsg;
                setMessages([welcomeMsg]);
                // No await here, keep it snappy
            }

            const currentInput = input;
            const currentFile = selectedFile;
            const currentFilePreview = filePreview;
            let pdfContext = null;

            if (currentFile?.type === 'application/pdf') {
                if (currentFile.extractedText) {
                    pdfContext = {
                        text: currentFile.extractedText,
                        pageCount: currentFile.pageCount || 0,
                        ocrPages: currentFile.ocrPages || 0,
                        selectablePages: currentFile.selectablePages || 0
                    };
                } else {
                    setProcessingStep({ step: 'ocr', message: 'Extracting PDF text and scanned pages...', provider: 'PDF.js OCR' });
                    pdfContext = await extractPDFContext(currentFile, {
                        onProgress: (p) => setProcessingStep({ provider: 'PDF.js OCR', ...p })
                    });
                }
            }

            const userMsg = {
                sessionId,
                role: 'user',
                content: currentInput || (currentFile?.type === 'application/pdf' ? 'Analyze the attached PDF.' : ''),
                fileName: currentFile?.name,
                fileType: currentFile?.type,
                filePreview: currentFile?.type.startsWith('image/') ? currentFilePreview : null,
                extractedText: pdfContext?.text,
                pdfContextMeta: pdfContext ? {
                    pageCount: pdfContext.pageCount,
                    ocrPages: pdfContext.ocrPages,
                    selectablePages: pdfContext.selectablePages,
                    storedAs: 'extracted-text'
                } : null,
                timestamp: Date.now()
            };

            // Clear inputs and update UI messages early
            setInput('');
            setSelectedFile(null);
            setFilePreview(null);
            setFileReviewOpen(false);
            setMessages(prev => [...prev, userMsg]);

            const userSavePromise = saveMessage(userMsg).catch((error) => {
                console.warn('Failed to save user message before streaming finished:', error);
            });

            const persistAssistantExchange = async (assistantMsg, finalAssistantContent) => {
                await userSavePromise;
                await saveMessage(assistantMsg);

                setSessions(prev => prev.map(s => s.id === sessionId ? {
                    ...s,
                    title: s.title === 'New Research Log' ? currentInput.substring(0, 30) : s.title,
                    messageCount: (s.messageCount || 0) + 2,
                    hasPDF: s.hasPDF || currentFile?.type === 'application/pdf',
                    hasCode: s.hasCode || finalAssistantContent.includes('```'),
                    hasImage: s.hasImage || currentFile?.type.startsWith('image/')
                } : s));

                const dbSessions = await getAllSessions();
                let sessionToUpdate = dbSessions.find(s => s.id === sessionId);

                if (!sessionToUpdate) {
                    sessionToUpdate = createdSession || sessions.find(s => s.id === sessionId);
                    if (sessionToUpdate) {
                        await saveSession(sessionToUpdate);
                        const welcomeToPersist = createdWelcomeMsg || (messages[0]?.role === 'assistant' ? messages[0] : null);
                        if (welcomeToPersist) await saveMessage(welcomeToPersist);
                    }
                }

                if (sessionToUpdate) {
                    await saveSession({
                        ...sessionToUpdate,
                        title: sessionToUpdate.title === 'New Research Log' ? currentInput.substring(0, 30) : sessionToUpdate.title,
                        messageCount: (messages.length + 2),
                        hasPDF: sessionToUpdate.hasPDF || currentFile?.type === 'application/pdf',
                        hasCode: sessionToUpdate.hasCode || finalAssistantContent.includes('```'),
                        hasImage: sessionToUpdate.hasImage || currentFile?.type.startsWith('image/')
                    });
                }
            };

            const assistantMsgId = crypto.randomUUID();
            activeAssistantMsgId = assistantMsgId;
            const assistantDraft = {
                id: assistantMsgId,
                sessionId,
                role: 'assistant',
                content: '',
                streaming: true,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, assistantDraft]);

            const instantReply = !currentFile && getInstantTutorReply(currentInput, profile);
            if (instantReply) {
                const assistantMsg = {
                    ...assistantDraft,
                    content: instantReply,
                    streaming: false
                };
                setActiveModel('Instant Reply');
                setProviderStatus('Instant');
                setLatency(0);
                setMessages(prev => prev.map(msg => msg.id === assistantMsgId ? assistantMsg : msg));
                await persistAssistantExchange(assistantMsg, instantReply);
                return;
            }

            const systemPrompt = `You are Justin, HOPE Studio's fast KTU engineering tutor for APJ Abdul Kalam Technological University B.Tech students at IES College of Engineering, Thrissur.

Current date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
Current time: ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}

Highest priority: answer immediately. Your first sentence must contain useful answer content, not filler like "Sure" or "I can help". Ask at most one clarification only when the task is impossible without it.

Style:
- Keep normal chat concise, direct, and exam-ready.
- Use KTU module framing when obvious, but do not force it into every answer.
- Use LaTeX for equations and fenced code blocks for programs.
- For code requests, infer the standard KTU context and provide runnable code first, then brief explanation.
- For uploaded PDFs/images, use the provided context and state assumptions when the source is unclear.
- If asked about origin, say: "I was developed by Harinandan K for the HOPE Studio initiative."

Commands:
- /explain: give a focused concept breakdown with steps, formulas, and common exam traps.
- /debug: identify the bug, explain the fix, and provide corrected code.
- /doc: generate a polished Markdown engineering document. If key details are missing, ask one compact question. When generating the final document, start with "# Title", avoid conversational intro/outro, and append [[PDF_ATTACHMENT]] as the final raw text.

Never append [[PDF_ATTACHMENT]] for normal chat, /explain, or /debug.`;

            const history = messages
                .filter(m => !m.streaming && m.content && String(m.content).trim() !== '')
                .map(m => ({ role: m.role, content: m.content }));

            const requestMessages = [{ role: 'system', content: systemPrompt }, ...history];

            // Attach processing context
            if (currentFile?.type === 'application/pdf') {
                const pdfText = pdfContext?.text || '';
                const contextText = pdfText.length > MAX_PDF_CONTEXT_CHARS
                    ? `${pdfText.slice(0, MAX_PDF_CONTEXT_CHARS)}\n\n[PDF Context Notice]: Full extracted text is stored locally on this message. This request includes the first ${MAX_PDF_CONTEXT_CHARS.toLocaleString()} characters to stay within model context.`
                    : pdfText;
                requestMessages.push({
                    role: 'user',
                    content: `${currentInput || 'Analyze the attached PDF.'}\n\n[PDF Context: extracted text stored locally, original PDF not persisted]\nPages: ${pdfContext?.pageCount || 'unknown'} | OCR pages: ${pdfContext?.ocrPages || 0}\n\n${contextText}`
                });
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

            const normalizedInput = currentInput.trim().toLowerCase();
            const isDocumentCommand = normalizedInput.startsWith('/doc');

            let targetModel = 'default';
            let targetModelLabel = 'Puter Fast Chat';
            if (isDocumentCommand) {
                targetModel = 'z-ai/glm-4.5';
                targetModelLabel = 'GLM-4.5';
            }
            if (currentFile?.type.startsWith('image/') || currentFile?.type === 'application/pdf') {
                targetModel = 'z-ai/glm-4.6v-flash';
                targetModelLabel = 'GLM-4.6V Flash';
            }
            setActiveModel(targetModelLabel);

            const responseTokenBudget = isDocumentCommand
                ? 32000
                : (currentFile ? 12000 : 8192);

            let streamedContent = '';
            const publishStreamContent = () => {
                streamFrame = null;
                setMessages(prev => prev.map(msg => (
                    msg.id === assistantMsgId
                        ? { ...msg, content: streamedContent, streaming: true }
                        : msg
                )));
            };
            const queueStreamPaint = () => {
                if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
                    publishStreamContent();
                    return;
                }
                if (streamFrame) return;
                streamFrame = window.requestAnimationFrame(publishStreamContent);
            };
            const aiResult = await getAICompletion(requestMessages, {
                actionType: 'chat',
                model: targetModel,
                max_tokens: responseTokenBudget,
                temperature: isDocumentCommand ? 0.45 : 0.55,
                includeMetadata: true,
                onToken: (token, fullContent) => {
                    streamedContent = fullContent || `${streamedContent}${token}`;
                    setProviderStatus('Streaming');
                    queueStreamPaint();
                },
                onProgress: (p) => {
                    setProcessingStep(p);
                    if (p.provider) setProviderStatus(p.provider);
                    if (p.duration) setLatency(p.duration);
                }
            });
            if (streamFrame && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(streamFrame);
                streamFrame = null;
            }
            if (streamedContent) publishStreamContent();
            if (aiResult?.provider) setProviderStatus(aiResult.provider);
            const finalAIContent = typeof aiResult === 'string' ? aiResult : aiResult?.content;

            const assistantMsg = {
                id: assistantMsgId,
                sessionId,
                role: 'assistant',
                content: finalAIContent || streamedContent,
                streaming: false,
                timestamp: assistantDraft.timestamp
            };
            const finalAssistantContent = assistantMsg.content;

            setMessages(prev => prev.map(msg => msg.id === assistantMsgId ? assistantMsg : msg));
            await persistAssistantExchange(assistantMsg, finalAssistantContent);
        } catch (e) {
            console.error("Chat Error:", e);
            if (streamFrame && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(streamFrame);
                streamFrame = null;
            }
            const isRateLimit    = e.message?.startsWith('RATE_LIMITED');
            const isProviderFail = isRateLimit ||
                                   e.message?.includes('All AI providers') ||
                                   e.message?.includes('No working API key') ||
                                   e.message?.includes('WebSocket') ||
                                   e.message?.includes('Failed to fetch');

            if (isProviderFail) {
                setProviderError(e.message); // popup reads this to choose the right copy
                if (activeAssistantMsgId) {
                    setMessages(prev => prev.filter(msg => msg.id !== activeAssistantMsgId));
                }
            } else {
                const errorMsg = {
                    sessionId: sessionId || 'unknown',
                    role: 'assistant',
                    content: `⚠️ ${e.message || 'Connection interrupted. Please try again.'}`,
                    timestamp: Date.now()
                };
                setMessages(prev => activeAssistantMsgId
                    ? prev.map(msg => msg.id === activeAssistantMsgId ? { ...errorMsg, id: activeAssistantMsgId } : msg)
                    : [...prev, errorMsg]
                );
                showToast("AI Service Unavailable. Please try again.", "error");
            }
        } finally {
            setLoading(false);
            setProcessingStep({ step: '' });
        }
    };

    // --- Specialized Actions ---
    const handleSimulate = async (msgIndex, code, lang) => {
        const key = `${msgIndex}-${code}`; // Unique ID for this specific code block
        setSimulatingKey(key);

        try {
            const { simulateCodeExecution } = await import('../../utils/aiService');
            let liveText = '';
            const result = await simulateCodeExecution(code, lang, [], [], {
                onToken: (token, fullContent) => {
                    liveText = fullContent || `${liveText}${token}`;
                    setSimulationResults(prev => ({
                        ...prev,
                        [key]: {
                            ...(prev[key] || {}),
                            output: liveText,
                            status: 'running',
                            isStreaming: true
                        }
                    }));
                }
            });

            // Store result by unique key, NOT in the messages array
            setSimulationResults(prev => ({
                ...prev,
                [key]: { ...result, isStreaming: false }
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
        if (userMsg.fileName) {
            setFilePreview(userMsg.filePreview);
            setSelectedFile({
                name: userMsg.fileName,
                type: userMsg.fileType,
                extractedText: userMsg.extractedText,
                pageCount: userMsg.pdfContextMeta?.pageCount,
                ocrPages: userMsg.pdfContextMeta?.ocrPages,
                selectablePages: userMsg.pdfContextMeta?.selectablePages
            });
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
            setSessions(prev => prev.map(s => s.id === id ? updated : s));
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
                        footer { margin-top: 50px; text-align: center; padding-top: 20px; color: #94a3b8; font-size: 11px; opacity: 0.7; }
                        .footer-main { font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; font-size: 10px; }
                        @media print { body { padding: 0; } footer { position: fixed; bottom: 30px; width: 100%; } }
                    </style>
                </head>
                <body>
                    <div id="content"></div>
                    <footer>
                        <div class="footer-main">Security Verified Document</div>
                        <div>Generated & Validated by HOPE AI Tutor Environment • Engineering Standard</div>
                    </footer>
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
            const systemPrompt = `You are HOPE Studio's KTU document refinement engine. Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}.

Rewrite the current document according to the user instruction.
Rules:
- Return only updated Markdown.
- Preserve meaning unless the instruction asks for a change.
- Use engineering/IEEE or KTU report formatting when relevant.
- No conversational intro, explanation, sign-off, or markdown code fence wrapper.
- Preserve [[PDF_ATTACHMENT]] at the end only if it already exists or the instruction explicitly asks for a generated PDF document.`;

            const studioHistory = history
                .filter(m => !m.streaming && m.content && String(m.content).trim() !== '')
                .map(m => ({ role: m.role, content: m.content }));
            const requestMessages = [
                { role: 'system', content: systemPrompt },
                ...studioHistory,
                { role: 'user', content: `CURRENT DOCUMENT:\n${currentContent}\n\nUSER INSTRUCTION: ${instruction}` }
            ];

            const result = await getAICompletion(requestMessages, {
                actionType: 'chat',
                model: 'z-ai/glm-4.5',
                max_tokens: 32000,
                temperature: 0.3
            });
            return result;
        } catch (e) {
            console.error(e);
            showToast("Document refinement failed.", "error");
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const handleExportToMain = async (text) => {
        const sessionId = activeSessionId;
        const msg = {
            sessionId,
            role: 'user',
            content: text,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, msg]);
        await saveMessage(msg);
        showToast("Exported to main thread.", "success");
        setDocViewer(prev => ({ ...prev, isOpen: false }));
    };

    return (
        <div className="ai-chat-shell flex flex-col h-dvh theme-page overflow-hidden relative"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileChange(e); }}
        >
            <div className="ai-chat-ambient" aria-hidden="true">
                <span className="ai-chat-ambient-one" />
                <span className="ai-chat-ambient-two" />
                <span className="ai-chat-ambient-grid" />
            </div>

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
                onFileClick={setPreviewFile}
                loading={loading}
                simulationResults={simulationResults}
                simulatingKey={simulatingKey}
                onRegenerate={handleRegenerate}
                className="flex-grow overflow-auto"
            />

            {/* 3. HOPE Composer */}
            <div className={`ai-composer-dock ${loading ? 'is-loading' : ''}`}>
                <div className="ai-composer-wrap">
                    <AnimatePresence>
                        {(selectedFile || input.startsWith('/')) && (
                            <MotionDiv
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="ai-context-strip"
                            >
                                {selectedFile && (
                                    <div className="ai-context-chip">
                                        {selectedFile.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                                        <span>{selectedFile.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                                            aria-label="Remove attached context"
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                )}
                                {input.startsWith('/') && (
                                    <div className="ai-context-chip is-command">
                                        <Command size={14} />
                                        <span>Command mode</span>
                                    </div>
                                )}
                            </MotionDiv>
                        )}
                    </AnimatePresence>

                    <div className={`ai-prompt-box ${isCodeInput(input) ? 'is-code' : ''} ${selectedFile ? 'has-context' : ''}`}>
                        <div className="ai-prompt-glow" aria-hidden="true" />
                        <div className="ai-prompt-main">
                            <div className="ai-prompt-mark" aria-hidden="true">
                                <Sparkles size={18} />
                            </div>

                            <div className="ai-prompt-field">
                                <AnimatePresence>
                                    {input.startsWith('/') && !input.includes(' ') && (
                                        <MotionDiv
                                            initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 12, scale: 0.98 }}
                                            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                                            className="ai-command-palette"
                                        >
                                            <div className="ai-command-header">
                                                <Zap size={14} />
                                                <span>Engineering shortcuts</span>
                                            </div>
                                            <div className="ai-command-list">
                                                {[
                                                    { cmd: '/explain', desc: 'Deep-dive architectural analysis', icon: Info },
                                                    { cmd: '/debug', desc: 'Identify logic bottlenecks', icon: Zap },
                                                    { cmd: '/doc', desc: 'Generate system documentation', icon: FileText },
                                                    { cmd: '/clear', desc: 'Reset current context', icon: Trash2 }
                                                ].map((c) => (
                                                    <button
                                                        type="button"
                                                        key={c.cmd}
                                                        onClick={() => { setInput(c.cmd + ' '); inputRef.current?.focus(); }}
                                                        className="ai-command-item"
                                                    >
                                                        <span className="ai-command-icon">
                                                            <c.icon size={16} />
                                                        </span>
                                                        <span className="ai-command-copy">
                                                            <strong>{c.cmd}</strong>
                                                            <small>{c.desc}</small>
                                                        </span>
                                                        <span className="ai-command-enter">ENTER</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </MotionDiv>
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
                                    placeholder="Ask HOPE AI, attach context, or type /"
                                    className={`ai-prompt-textarea custom-scrollbar ${isCodeInput(input) ? 'font-monospace' : ''}`}
                                    rows={1}
                                />
                            </div>
                        </div>

                        <div className="ai-prompt-toolbar">
                            <div className="ai-prompt-tools" aria-label="Prompt tools">
                                <button
                                    type="button"
                                    className="ai-tool-button is-icon"
                                    onClick={() => {
                                        if (fileInputRef.current) {
                                            fileInputRef.current.value = null;
                                            fileInputRef.current.click();
                                        }
                                    }}
                                    title="Attach engineering context"
                                >
                                    <Paperclip size={18} />
                                    <span className="visually-hidden">Attach engineering context</span>
                                </button>
                                <span className="ai-tool-divider" aria-hidden="true" />
                                {[
                                    { cmd: '/explain', label: 'Explain', icon: Sparkles },
                                    { cmd: '/debug', label: 'Debug', icon: Code },
                                    { cmd: '/doc', label: 'Doc', icon: FileText }
                                ].map((action) => (
                                    <button
                                        type="button"
                                        key={action.cmd}
                                        className={`ai-tool-button ${input.startsWith(action.cmd) ? 'is-active' : ''}`}
                                        onClick={() => { setInput(action.cmd + ' '); inputRef.current?.focus(); }}
                                        title={action.cmd}
                                    >
                                        <action.icon size={15} />
                                        <span>{action.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="ai-prompt-submit-row">
                                <div className="ai-provider-pill" aria-live="polite">
                                    <span className={loading ? 'is-busy' : ''} />
                                    {loading ? 'Thinking' : providerStatus}
                                </div>
                                <button
                                    type="button"
                                    className="ai-submit-button"
                                    onClick={handleSend}
                                    disabled={loading || (!input.trim() && !selectedFile)}
                                    title={loading ? 'Generating response' : 'Send message'}
                                >
                                    {loading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <p className="ai-composer-note">
                        Shift + Enter for a new line. Verify engineering data.
                    </p>
                </div>
            </div>

            {/* Hidden Utilities */}
            <input type="file" ref={fileInputRef} className="d-none" onChange={handleFileChange} />
            <div ref={messagesEndRef} />

            {/* Drag Overlay */}
            <AnimatePresence>
                {isDragging && (
                    <MotionDiv
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
                    </MotionDiv>
                )}
            </AnimatePresence>

            {/* File Context Review Modal */}
            <AnimatePresence>
                {fileReviewOpen && selectedFile && (
                    <MotionDiv
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                        style={{ zIndex: 3000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}
                    >
                        <MotionDiv
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="theme-card rounded-[2rem] shadow-2xl p-4 md:p-6 d-flex flex-column gap-3 md:gap-4 overflow-hidden"
                            style={{ width: '95%', maxWidth: '400px' }}
                        >
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <h5 className="fw-bold mb-0 theme-text">Attach Context</h5>
                                <button className="theme-card hover:bg-slate-100 dark:hover:bg-slate-800 rounded-circle p-2 flex items-center justify-center border theme-border theme-text" onClick={() => { setSelectedFile(null); setFileReviewOpen(false); }}><X size={20} /></button>
                            </div>

                            <div className="d-flex align-items-center gap-3 p-3 theme-surface rounded-xl border theme-border">
                                <div className="p-3 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--primary)' }}>
                                    {selectedFile.type.startsWith('image/') ? <ImageIcon size={32} /> : <FileText size={32} />}
                                </div>
                                <div className="overflow-hidden">
                                    <div className="fw-bold theme-text text-truncate small" style={{ maxWidth: '280px' }}>{selectedFile.name}</div>
                                    <span className="x-small fw-bold text-muted uppercase">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • READY</span>
                                </div>
                            </div>

                            {selectedFile.type.startsWith('image/') && (
                                <div className="rounded-xl overflow-hidden border theme-border shadow-sm" style={{ maxHeight: '180px' }}>
                                    <img src={filePreview} alt="Review" className="w-100 h-100 object-fit-cover" />
                                </div>
                            )}

                            <div className="d-flex flex-column gap-2">
                                <textarea
                                    className="form-control theme-input p-3 rounded-xl shadow-sm"
                                    placeholder="Add a message for the AI (optional)..."
                                    rows={3}
                                    style={{ fontSize: '14px' }}
                                    value={input} // Bind to input state
                                    onChange={(e) => setInput(e.target.value)}
                                ></textarea>
                            </div>

                            <div className="d-flex gap-3 mt-2">
                                <button
                                    className="theme-surface hover:bg-slate-100 dark:hover:bg-slate-800 flex-grow-1 py-3 rounded-xl fw-bold theme-text border theme-border"
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
                        </MotionDiv>
                    </MotionDiv>
                )}
            </AnimatePresence>

            {/* File Preview Popup */}
            <AnimatePresence>
                {previewFile && (
                    <MotionDiv
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                        style={{ zIndex: 4000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(15px)' }}
                        onClick={() => setPreviewFile(null)}
                    >
                        <MotionDiv
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="theme-card rounded-[2.5rem] shadow-2xl overflow-hidden relative d-flex flex-column"
                            style={{ width: '95%', maxWidth: '800px', height: '80vh' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-4 border-bottom theme-border d-flex justify-content-between align-items-center theme-card sticky-top">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="p-2 rounded-xl theme-surface text-primary">
                                        {previewFile.fileType?.startsWith('image/') ? <ImageIcon size={20} /> : <FileText size={20} />}
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="fw-bold theme-text text-truncate small" style={{ maxWidth: '200px' }}>{previewFile.fileName}</div>
                                        <div className="x-small text-muted uppercase fw-bold" style={{ fontSize: '9px' }}>Engineering Asset</div>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <button 
                                        className="theme-card hover:bg-slate-100 dark:hover:bg-slate-800 rounded-circle p-2 flex items-center justify-center border theme-border theme-text"
                                        onClick={() => setPreviewFile(null)}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-grow-1 overflow-auto p-4 d-flex align-items-center justify-content-center theme-surface">
                                {previewFile.fileType?.startsWith('image/') ? (
                                    <img 
                                        src={previewFile.filePreview} 
                                        alt="Preview" 
                                        className="max-w-full max-h-full object-fit-contain shadow-lg rounded-2xl" 
                                    />
                                ) : (
                                    <div className="text-center p-5">
                                        <div className="p-5 theme-card rounded-circle shadow-sm d-inline-block mb-4 text-primary">
                                            <FileText size={64} strokeWidth={1} />
                                        </div>
                                        <h3 className="fw-bold theme-text">Document Preview</h3>
                                        <p className="text-muted">Direct preview for this file type is not available in the chat. Use the button above to download and view.</p>
                                    </div>
                                )}
                            </div>
                        </MotionDiv>
                    </MotionDiv>
                )}
            </AnimatePresence>

            {/* Toast Container */}
            <div className="position-fixed top-0 end-0 p-4" style={{ zIndex: 9999 }}>
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <MotionDiv
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
                        </MotionDiv>
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

            {/* ── AI Provider Error Warning ── */}
            <AnimatePresence>
                {providerError && (
                    <MotionDiv
                        key="prov-err"
                        initial={{ opacity: 0, y: 20, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.97 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
                        style={{
                            position: 'fixed', bottom: 80, left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 2000, width: '100%', maxWidth: 440,
                            padding: '0 12px',
                        }}
                    >
                        <div style={{
                            background: '#fff',
                            border: '1.5px solid #fca5a5',
                            borderRadius: 16,
                            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                            overflow: 'hidden',
                        }}>
                            {/* Red header */}
                            <div style={{
                                background: 'linear-gradient(135deg,#fef2f2,#fff7f7)',
                                padding: '14px 16px 10px',
                                borderBottom: '1px solid #fee2e2',
                                display: 'flex', alignItems: 'center', gap: 10,
                            }}>
                                <div style={{
                                    background: '#fee2e2', borderRadius: 8, padding: 6,
                                    display: 'flex', alignItems: 'center', flexShrink: 0,
                                }}>
                                    <AlertTriangle size={16} style={{ color: '#dc2626' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                                        {providerError?.startsWith('RATE_LIMITED') ? 'Rate Limit Hit' : 'AI Connection Failed'}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                                        {providerError?.startsWith('RATE_LIMITED') ? 'Free-tier request limit reached' : 'No working provider available'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setProviderError(null)}
                                    style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding: 0 }}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Body */}
                            <div style={{ padding: '12px 16px' }}>
                                <p style={{ fontSize: 12, color: '#475569', margin: '0 0 12px', lineHeight: 1.6 }}>
                                    {providerError?.startsWith('RATE_LIMITED')
                                        ? <>OpenRouter's free tier limits requests per minute. <strong>Wait ~30 seconds</strong> then retry, or enable <strong>Groq</strong> in AI Settings as a backup (also free).</>
                                        : <>Puter.js is unavailable and no personal API key is configured. Add a free <strong>Groq</strong> or <strong>OpenRouter</strong> key to keep the AI working when Puter is offline.</>
                                    }
                                </p>

                                <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
                                    {!providerError?.startsWith('RATE_LIMITED') && (
                                    <button
                                        onClick={() => { setProviderError(null); setVaultOpen(true); }}
                                        style={{
                                            flex: '1 1 140px', height: 36, padding: '0 14px',
                                            borderRadius: 8, fontSize: 12, fontWeight: 700,
                                            background: '#6366f1', color: '#fff',
                                            border: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        }}
                                    >
                                        <Settings size={13} /> Add API Key
                                    </button>
                                    )}
                                    <button
                                        onClick={() => { setProviderError(null); handleSend(); }}
                                        style={{
                                            flex: '1 1 100px', height: 36, padding: '0 14px',
                                            borderRadius: 8, fontSize: 12, fontWeight: 700,
                                            background: '#f1f5f9', color: '#475569',
                                            border: '1.5px solid #e2e8f0', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        }}
                                    >
                                        <RefreshCw size={13} /> Retry
                                    </button>
                                </div>
                            </div>
                        </div>
                    </MotionDiv>
                )}
            </AnimatePresence>

            {/* AI Key Vault (accessible from chat too) */}
            <APIKeyVault isOpen={vaultOpen} onClose={() => setVaultOpen(false)} />
        </div>
    );
}
