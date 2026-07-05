
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

const ChatMessageContext = React.createContext(null);
const MotionDiv = motion.div;
const MotionButton = motion.button;

const CodeBlockWrapper = ({ codeContent, language }) => {
    const { idx, simulationResults, simulatingKey, onStarterClick, streaming } = React.useContext(ChatMessageContext);
    const key = `${idx}-${codeContent}`;

    if (streaming) {
        return (
            <pre className="overflow-x-auto my-4 rounded-xl p-4 bg-dark text-light" style={{ fontFamily: "'Fira Code', monospace", fontSize: '13px' }}>
                <code className={`language-${language}`}>
                    {codeContent}
                </code>
            </pre>
        );
    }

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
};

const InlineCode = ({ className, children, ...props }) => {
    const { role } = React.useContext(ChatMessageContext);
    return (
        <code
            className={`${className} px-2 py-0.5 rounded fw-bold font-monospace`}
            style={{
                backgroundColor: role === 'user' ? 'rgba(255,255,255,0.1)' : 'var(--bg-surface)',
                color: role === 'user' ? '#fff' : 'var(--primary)',
                fontSize: '13px'
            }}
            {...props}
        >
            {children}
        </code>
    );
};

const chatMarkdownComponents = {
    code: ({ inline, className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || '');
        const language = match ? match[1] : '';

        if (!inline && language) {
            const codeContent = String(children).replace(/\n$/, '');
            return (
                <CodeBlockWrapper
                    codeContent={codeContent}
                    language={language}
                />
            );
        }
        return (
            <InlineCode className={className} {...props}>
                {children}
            </InlineCode>
        );
    }
};

const PremiumThinkingIndicator = () => {
    const steps = [
        "Analyzing syllabus context...",
        "Calculated vector embeddings.",
        "Auditing logic structures...",
        "Computing math representations...",
        "Formulating pedagogical guidance..."
    ];
    const [currentStep, setCurrentStep] = React.useState(0);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStep(prev => (prev + 1) % steps.length);
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="ai-premium-thinking">
            <div className="ai-thinking-radar">
                <span className="ai-radar-ring ring-1" />
                <span className="ai-radar-ring ring-2" />
                <div className="ai-radar-core">
                    <Bot size={16} />
                </div>
            </div>
            <div className="ai-thinking-details">
                <div className="ai-thinking-header">
                    <span className="ai-thinking-label">PROCESSING</span>
                    <span className="ai-thinking-percentage">{Math.min(99, Math.round((currentStep + 1) * 20))}%</span>
                </div>
                <div className="ai-thinking-status">
                    <span className="ai-thinking-pulse-dot" />
                    <span className="ai-thinking-text">{steps[currentStep]}</span>
                </div>
            </div>
        </div>
    );
};

// ── Suggestion Bubble Chips ──────────────────────────────────────────────────
const SuggestionChips = ({ suggestions, onSelect, disabled }) => {
    if (!suggestions || suggestions.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className="suggestion-chips-row"
            aria-label="Suggested follow-up questions"
        >
            {suggestions.map((text, i) => (
                <motion.button
                    key={i}
                    type="button"
                    initial={{ opacity: 0, scale: 0.88, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.18 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => !disabled && onSelect(text)}
                    disabled={disabled}
                    className="suggestion-chip"
                    aria-label={`Suggested: ${text}`}
                >
                    <span className="suggestion-chip-text">{text}</span>
                    <span className="suggestion-chip-arrow">›</span>
                </motion.button>
            ))}
        </motion.div>
    );
};

// ── Welcome Screen ───────────────────────────────────────────────────────────
const WelcomeScreen = ({ onStarterClick }) => (
    <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="ai-chat-empty"
    >
        <div className="ai-chat-empty-mark">
            <Bot size={64} strokeWidth={1} />
        </div>
        <span className="ai-chat-kicker">HOPE Studio Core</span>
        <h2>Engineering Workbench</h2>
        <p>Ask deep questions, upload context, and turn rough academic prompts into usable engineering output.</p>

        <div className="ai-starter-grid">
            {[
                { icon: Sparkles, title: "Deep Explanation", desc: "Complex concept breakdown", prompt: "Explain the governing equations of [Topic] in-depth." },
                { icon: Code, title: "Engine Simulation", desc: "J-Compiler Logic Flow", prompt: "Write and simulate the control logic for [System] in Python." },
                { icon: FileText, title: "Syllabus Query", desc: "Context-aware research", prompt: "Summarize the key exam objectives for [Module] from my syllabus." }
            ].map((starter, i) => (
                <MotionButton
                    type="button"
                    key={i}
                    whileHover={{ y: -5, scale: 1.02 }}
                    onClick={() => onStarterClick(starter.prompt)}
                    className="ai-starter-card"
                >
                    <span className="ai-starter-icon">
                        <starter.icon size={22} />
                    </span>
                    <span>
                        <strong>{starter.title}</strong>
                        <small>{starter.desc}</small>
                    </span>
                    <ChevronRight size={14} />
                </MotionButton>
            ))}
        </div>
    </MotionDiv>
);

// ── Main ChatCanvas ──────────────────────────────────────────────────────────
const ChatCanvas = ({ messages, profile, onStarterClick, onSuggestedReply, onFileClick, loading, simulationResults, simulatingKey, onRegenerate }) => {
    // Track which message was just copied for visual feedback
    const [copiedId, setCopiedId] = React.useState(null);

    const handleCopy = (id, content) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="ai-chat-canvas flex-grow-1 overflow-auto custom-scrollbar relative chat-workspace chat-grid">
            <div className="ai-chat-stream container mx-auto px-2 py-4 md:px-4 md:py-5">
                <AnimatePresence mode="popLayout">
                    {messages.length === 0 ? (
                        <WelcomeScreen onStarterClick={onStarterClick} />
                    ) : (
                        messages.map((msg, idx) => (
                            <MotionDiv
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`ai-message-frame ${msg.role === 'user' ? 'is-user' : 'is-assistant'}`}
                            >
                                <div className="ai-message-row">
                                    {/* Role Indicator */}
                                    <div className="ai-message-meta">
                                        {msg.role === 'assistant' && (
                                            <div className="ai-message-avatar">
                                                <Bot size={13} />
                                            </div>
                                        )}
                                        <span>
                                            {msg.role === 'user' 
                                                ? (profile?.full_name ? `${profile.full_name} (${profile.id ? profile.id.slice(0, 10) : 'Lead Engineer'})` : 'Justin (Lead Engineer)') 
                                                : 'HOPE Systems'
                                            }
                                        </span>
                                    </div>

                                    {/* Message Bubble */}
                                    <div
                                        className={`ai-message-bubble ${msg.role === 'user' ? 'is-user' : 'is-assistant'} ${msg.streaming ? 'is-streaming' : ''}`}
                                    >
                                        {(() => {
                                             const hasAttachment = msg.content.includes('[[PDF_ATTACHMENT]]');
                                             const rawContent = hasAttachment
                                                 ? msg.content.replace('[[PDF_ATTACHMENT]]', '')
                                                 : msg.content;
                                             const displayContent = typeof rawContent === 'string'
                                                 ? rawContent
                                                     .replace(/\\\[/g, () => '$$')
                                                     .replace(/\\\]/g, () => '$$')
                                                     .replace(/\\\( /g, () => '$')
                                                     .replace(/ \\\)/g, () => '$')
                                                     .replace(/\\\(/g, () => '$')
                                                     .replace(/\\\)/g, () => '$')
                                                 : rawContent;

                                            return (
                                                <div className="message-content">
                                                    {/* User Attachments Rendering */}
                                                    {msg.role === 'user' && msg.filePreview && (
                                                        <MotionDiv
                                                            initial={{ opacity: 0, scale: 0.95 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            whileHover={{ scale: 1.01 }}
                                                            onClick={() => onFileClick && onFileClick({
                                                                fileName: msg.fileName,
                                                                fileType: msg.fileType,
                                                                filePreview: msg.filePreview
                                                            })}
                                                            className="ai-user-image-attachment"
                                                        >
                                                            <img src={msg.filePreview} alt="Attached Context" className="w-100 h-100 object-fit-contain bg-black bg-opacity-10" />
                                                        </MotionDiv>
                                                    )}
                                                    
                                                    {msg.role === 'user' && msg.fileName && !msg.fileType?.startsWith('image/') && (
                                                        <MotionDiv
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            whileHover={{ x: 2 }}
                                                            onClick={() => onFileClick && onFileClick({
                                                                fileName: msg.fileName,
                                                                fileType: msg.fileType,
                                                                filePreview: msg.filePreview
                                                            })}
                                                            className="ai-user-file-attachment"
                                                        >
                                                            <div>
                                                                <FileText size={18} className="text-white" />
                                                            </div>
                                                            <div className="flex-grow-1 overflow-hidden">
                                                                <strong>{msg.fileName}</strong>
                                                                <small>
                                                                    {msg.pdfContextMeta
                                                                        ? `${msg.pdfContextMeta.pageCount || 0} pages extracted${msg.pdfContextMeta.ocrPages ? ` • ${msg.pdfContextMeta.ocrPages} OCR` : ''}`
                                                                        : 'Engineering Context'}
                                                                </small>
                                                            </div>
                                                        </MotionDiv>
                                                    )}
                                                     <ChatMessageContext.Provider value={{
                                                         idx,
                                                         simulationResults,
                                                         simulatingKey,
                                                         onStarterClick,
                                                         streaming: msg.streaming,
                                                         role: msg.role
                                                     }}>
                                                         {msg.streaming && !displayContent.trim() && (
                                                             <div className="ai-live-stream-skeleton" aria-hidden="true">
                                                                 <span />
                                                                 <span />
                                                                 <span />
                                                             </div>
                                                         )}
                                                         <ReactMarkdown
                                                             remarkPlugins={[remarkGfm, remarkMath]}
                                                             rehypePlugins={[rehypeKatex]}
                                                             components={chatMarkdownComponents}
                                                         >
                                                             {displayContent}
                                                         </ReactMarkdown>
                                                     </ChatMessageContext.Provider>

                                                    {msg.streaming && (
                                                        <span className="inline-block align-middle ms-1 bg-primary rounded-sm animate-pulse" style={{ width: 7, height: 16 }} />
                                                    )}

                                                    {hasAttachment && (
                                                        <div className="ai-document-card">
                                                            <div className="d-flex align-items-center gap-3">
                                                                <div className="ai-document-icon">
                                                                    <FileText size={20} />
                                                                </div>
                                                                <div>
                                                                    <strong>HOPE Document</strong>
                                                                    <small>Ready for Engineering Review</small>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => onStarterClick('OPEN_DOC_VIEWER', msg.content)}
                                                                className="ai-document-open"
                                                            >
                                                                Open Studio
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                        {msg.reaction && (
                                            <div className="ai-message-reaction-badge">
                                                {msg.reaction}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions Bar */}
                                    {msg.role === 'assistant' && !msg.streaming && (
                                        <div className="ai-message-actions">
                                            <button
                                                className={`ai-message-action ${copiedId === (msg.id || idx) ? 'is-copied' : ''}`}
                                                onClick={() => handleCopy(msg.id || idx, msg.content)}
                                                title="Copy Content"
                                            >
                                                <Copy size={12} /> <span>{copiedId === (msg.id || idx) ? 'COPIED!' : 'COPY'}</span>
                                            </button>
                                            <button
                                                className="ai-message-action"
                                                onClick={() => onRegenerate(idx)}
                                                title="Regenerate Response"
                                            >
                                                <RefreshCw size={12} /> <span>REGENERATE</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Interactive Suggestion Chips */}
                                    {msg.role === 'assistant' && !msg.streaming && msg.suggestedReplies?.length > 0 && (
                                        <SuggestionChips
                                            suggestions={msg.suggestedReplies}
                                            onSelect={onSuggestedReply}
                                            disabled={loading}
                                        />
                                    )}
                                </div>
                            </MotionDiv>
                        ))
                    )}

                    {/* Premium Loading Indicator */}
                    {loading && !messages.some(msg => msg.streaming) && (
                        <MotionDiv
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="ai-premium-thinking-row"
                        >
                            <PremiumThinkingIndicator />
                        </MotionDiv>
                    )}
                </AnimatePresence>
            </div>

        </div>
    );
};

export default ChatCanvas;
