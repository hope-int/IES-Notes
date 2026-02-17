import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, ArrowLeft, RefreshCw, Zap, Cpu, BookOpen, AlertTriangle, History, MessageSquare, Plus, AlignLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getAICompletion } from '../../utils/aiService';

const HeroChat = ({ profile, onBack, onResetProfile }) => {
    // Session State
    const [sessions, setSessions] = useState(() => {
        const saved = localStorage.getItem('hope_zero_to_hero_sessions');
        return saved ? JSON.parse(saved) : [];
    });
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [showHistory, setShowHistory] = useState(false);

    // Chat State
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isGeneratingStart, setIsGeneratingStart] = useState(false);

    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);

    // Persist Sessions
    useEffect(() => {
        if (sessions.length > 0) {
            localStorage.setItem('hope_zero_to_hero_sessions', JSON.stringify(sessions));
        }
    }, [sessions]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    // Initialize or Load Session
    useEffect(() => {
        if (!activeSessionId) {
            // Check if there's a "current" session (most recent)
            if (sessions.length > 0) {
                // Load the most recent session
                loadSession(sessions[0]);
            } else {
                startNewSession();
            }
        }
    }, []);

    const startNewSession = async () => {
        const newId = crypto.randomUUID();
        const initialMessage = {
            role: 'assistant',
            content: '', // Will be filled by AI
            isLoading: true
        };

        const newSession = {
            id: newId,
            title: 'New Session',
            messages: [initialMessage],
            timestamp: Date.now()
        };

        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newId);
        setMessages([initialMessage]);
        setShowHistory(false);

        // Generate Personalized Opener
        await generatePersonalizedOpener(newId, newSession);
    };

    const generatePersonalizedOpener = async (sessionId, sessionObj) => {
        setIsGeneratingStart(true);
        const systemPrompt = constructSystemPrompt();
        // Add a specific instruction for the opener
        const openerPrompt = [
            { role: "system", content: systemPrompt },
            { role: "system", content: "GENERATE OPENING MESSAGE: Based on the user's profile, ask a personalized, engaging question to start the session. Use their name if available, refer to their specific goal (e.g., 'passing exams'), and use their preferred analogy domain (e.g., 'gaming') to set the mood. Keep it under 2 sentences." }
        ];

        try {
            const response = await getAICompletion(openerPrompt);
            const finalMessage = { role: 'assistant', content: response };

            setMessages([finalMessage]);
            updateSession(sessionId, [finalMessage]);
        } catch (error) {
            console.error("Failed to generate opener:", error);
            const fallback = { role: 'assistant', content: "Hello! I'm ready to help you code. What's on your mind?" };
            setMessages([fallback]);
            updateSession(sessionId, [fallback]);
        } finally {
            setIsGeneratingStart(false);
        }
    };

    const updateSession = (id, newMessages) => {
        setSessions(prev => prev.map(s => {
            if (s.id === id) {
                // Generate title if it's the first user message
                let title = s.title;
                const firstUserMsg = newMessages.find(m => m.role === 'user');
                if (s.title === 'New Session' && firstUserMsg) {
                    title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
                }
                return { ...s, messages: newMessages, title, timestamp: Date.now() };
            }
            return s;
        }));
    };

    const loadSession = (session) => {
        setActiveSessionId(session.id);
        const cleanMessages = session.messages.filter(m => !m.isLoading).length > 0
            ? session.messages.filter(m => !m.isLoading)
            : [{ role: 'assistant', content: "Resume chat..." }];
        setMessages(cleanMessages);
        setShowHistory(false);
    };

    const constructSystemPrompt = () => {
        const studentProfile = profile.student_profile || {};
        return `
You are the "Zero to Hero" Coding Mentor. You are an elite Senior Developer and a cognitive psychologist. Your goal is NOT to write code, but to **train the user's brain to think like a developer**.

Here is the cognitive profile of the student you are currently mentoring:
<json_profile>
${JSON.stringify(studentProfile, null, 2)}
</json_profile>

### THE "DEVELOPER MINDSET" PROTOCOL (STRICT):
You must guide the student through the **4-Step Engineering Process** for every single question. Do not skip steps.

#### PHASE 1: DECONSTRUCTION (The "What")
- **Goal**: Ensure the user understands the problem.
- **Your Action**: Ask them to identify the **Inputs** and **Desired Outputs**.
- **Example**: "Before we code, what exactly goes into this function, and what should come out?"

#### PHASE 2: ALGORITHM DESIGN (The "How")
- **Goal**: Plan the logic without syntax distraction.
- **Your Action**: Ask for **Pseudo-code** or a logical step-by-step plan in plain English.
- **Constraint**: If they try to write code here, STOP THEM. Say "Let's stick to logic first. Code comes later."

#### PHASE 3: EDGE CASE ANALYSIS (The "What If")
- **Goal**: Build robustness.
- **Your Action**: Ask "What happens if the input is empty/null/negative?" or "How does this scale?"
- **Tone**: Challenger. "I see a potential bug with empty lists. Can you spot it?"

#### PHASE 4: IMPLEMENTATION (The "Code")
- **Goal**: Syntax and translation.
- **Your Action**: NOW they can write code.
- **Constraint**: If they error, ask "Read the error message. What is line X telling you?"

### THE GOLDEN RULES:
1. **NO SPOON-FEEDING**: Never provide the solution. If they are stuck, give a *logical hint*, not a *syntactical* one.
2. **SOCRATIC METHOD**: Answer a question with a guiding question.
3. **ADAPTIVE TONE**:
   - if 'debug_style' is "panic" or "guesswork": Be a cheerleader. High encouragement.
   - if 'coding_experience' is "senior" or "planner": Be a strict reviewer. Challenge assumptions.
4. **ANALOGIES**: Use analogies from their domain: **${studentProfile.preferred_analogy_domain || 'general'}**.

### INTERACTION START:
User says: "How do I reverse a string?"
`;
    };

    const handleSend = async (customPrompt = null) => {
        const userText = customPrompt || input.trim();
        if (!userText) return;

        const newMessages = [...messages, { role: 'user', content: userText }];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        try {
            const systemPrompt = constructSystemPrompt();
            const conversation = newMessages.map(m => ({ role: m.role, content: m.content }));

            const response = await getAICompletion([
                { role: 'system', content: systemPrompt },
                ...conversation
            ]);

            const finalMessages = [...newMessages, { role: 'assistant', content: response }];
            setMessages(finalMessages);
            updateSession(activeSessionId, finalMessages);
        } catch (error) {
            console.error("AI Error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to my brain. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    const chips = [
        { label: "Give me a hint", icon: <Zap size={16} />, action: () => handleSend("I'm stuck. Can you give me a small logical hint without showing code?") },
        { label: "Explain the logic", icon: <BookOpen size={16} />, action: () => handleSend("Can you explain the logic behind this step?") },
        { label: "Let me try pseudo-code", icon: <Cpu size={16} />, action: () => handleSend("I'll try to write the pseudo-code now.") },
    ];

    return (
        <div className="d-flex flex-column vh-100" style={{ background: '#f0f4f8' }}>
            {/* Header */}
            <div className="p-3" style={{ zIndex: 10 }}>
                <div className="clay-card d-flex align-items-center justify-content-between p-3 rounded-4 bg-white">
                    <div className="d-flex align-items-center gap-3">
                        <button onClick={onBack} className="btn clay-btn rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }}>
                            <ArrowLeft size={20} className="text-secondary" />
                        </button>
                        <div>
                            <h5 className="mb-0 fw-bold d-flex align-items-center gap-2 text-dark">
                                Zero to Hero <span className="badge bg-primary rounded-pill shadow-sm" style={{ fontSize: '0.6em' }}>BETA</span>
                            </h5>
                            <small className="text-muted fw-medium">Socratic Tutor • {profile.student_profile?.preferred_analogy_domain || 'General'}</small>
                        </div>
                    </div>
                    <div className="d-flex gap-2">
                        <button onClick={() => setShowHistory(!showHistory)} className={`btn clay-btn rounded-circle p-2 d-flex align-items-center justify-content-center hover-rotate ${showHistory ? 'bg-primary text-white' : 'text-muted'}`} title="History" style={{ width: 40, height: 40 }}>
                            <History size={18} />
                        </button>
                        <button onClick={onResetProfile} className="btn clay-btn text-muted rounded-circle p-2 d-flex align-items-center justify-content-center hover-rotate" title="Reset Profile" style={{ width: 40, height: 40 }}>
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="d-flex flex-grow-1 overflow-hidden position-relative">
                {/* History Sidebar (Overlay on Mobile, Side on Desktop) */}
                <AnimatePresence>
                    {showHistory && (
                        <motion.div
                            initial={{ x: -300, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -300, opacity: 0 }}
                            className="position-absolute h-100 bg-white shadow-lg p-3 custom-scrollbar"
                            style={{ width: '280px', zIndex: 20, left: 0, top: 0, borderRight: '1px solid #eee' }}
                        >
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h6 className="fw-bold mb-0">Your Journey</h6>
                                <button onClick={() => startNewSession()} className="btn btn-sm btn-primary rounded-pill d-flex align-items-center gap-2">
                                    <Plus size={14} /> New
                                </button>
                            </div>
                            <div className="d-flex flex-column gap-2">
                                {sessions.map(session => (
                                    <button
                                        key={session.id}
                                        onClick={() => loadSession(session)}
                                        className={`btn text-start p-3 rounded-3 border-0 d-flex align-items-center gap-3 transition-colors ${activeSessionId === session.id ? 'bg-primary text-white shadow-sm' : 'bg-light hover-bg-gray'}`}
                                    >
                                        <MessageSquare size={16} className="flex-shrink-0" />
                                        <div className="text-truncate" style={{ fontSize: '0.9rem' }}>
                                            {session.title || 'New Session'}
                                            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                                {new Date(session.timestamp).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                                {sessions.length === 0 && (
                                    <div className="text-center text-muted mt-5">
                                        <small>No history yet.</small>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Chat Area */}
                <div className="flex-grow-1 overflow-auto px-3 pb-5 custom-scrollbar" ref={scrollContainerRef}>
                    <div className="container" style={{ maxWidth: '800px', paddingTop: '1rem', paddingBottom: '100px' }}>
                        <AnimatePresence>
                            {messages.map((msg, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3 }}
                                    key={idx}
                                    className={`d-flex gap-3 mb-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                                >
                                    <div className={`clay-card rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0 ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white text-primary'}`} style={{ width: 45, height: 45 }}>
                                        {msg.role === 'user' ? <User size={22} /> : <Bot size={26} />}
                                    </div>

                                    <div
                                        className={`p-4 rounded-4 clay-card ${msg.role === 'user'
                                            ? 'bg-primary text-white'
                                            : 'bg-white text-dark'
                                            }`}
                                        style={{
                                            maxWidth: '85%',
                                            borderTopLeftRadius: msg.role === 'assistant' ? 0 : 25,
                                            borderTopRightRadius: msg.role === 'user' ? 0 : 25,
                                        }}
                                    >
                                        {msg.isLoading ? (
                                            <div className="typing-loader"><span></span><span></span><span></span></div>
                                        ) : (
                                            <ReactMarkdown components={{
                                                code({ node, inline, className, children, ...props }) {
                                                    return !inline ? (
                                                        <div className="bg-dark text-white p-3 rounded-3 my-2 shadow-inner overflow-auto border border-secondary border-opacity-25">
                                                            <code {...props}>{children}</code>
                                                        </div>
                                                    ) : (
                                                        <code className="bg-light text-primary px-1 rounded fw-bold border border-primary border-opacity-25" {...props}>
                                                            {children}
                                                        </code>
                                                    )
                                                }
                                            }}>{msg.content}</ReactMarkdown>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {(loading || isGeneratingStart) && !messages.some(m => m.isLoading) && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="d-flex gap-3 text-muted align-items-center ms-2">
                                <div className="clay-card bg-white p-2 rounded-circle d-flex align-items-center justify-content-center" style={{ width: 45, height: 45 }}>
                                    <Bot size={26} className="text-primary" />
                                </div>
                                <div className="clay-card bg-white px-4 py-3 rounded-pill">
                                    <div className="typing-loader">
                                        <span></span><span></span><span></span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            </div>

            {/* Floating Input Area */}
            <div className={`fixed-bottom p-3 ${showHistory ? 'd-none d-md-block' : ''}`} style={{ background: 'linear-gradient(to top, #f0f4f8 85%, transparent 100%)', zIndex: 10 }}>
                <div className="container" style={{ maxWidth: '800px' }}>
                    {/* Action Chips */}
                    <div className="d-flex gap-2 overflow-x-auto pb-3 custom-scrollbar justify-content-center">
                        {chips.map((chip, idx) => (
                            <motion.button
                                whileHover={{ scale: 1.05, translateY: -2 }}
                                whileTap={{ scale: 0.95 }}
                                key={idx}
                                onClick={chip.action}
                                disabled={loading}
                                className="btn clay-btn rounded-pill btn-sm d-flex align-items-center gap-2 text-primary fw-bold px-3 py-2 bg-white"
                            >
                                {chip.icon} {chip.label}
                            </motion.button>
                        ))}
                    </div>

                    <div className="clay-card bg-white rounded-5 p-2 d-flex gap-2 align-items-center">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask me a question..."
                            className="form-control border-0 shadow-none bg-transparent ps-4 fw-medium"
                            style={{ fontSize: '1rem' }}
                            disabled={loading}
                        />
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSend()}
                            disabled={!input.trim() || loading}
                            className={`btn rounded-circle p-0 d-flex align-items-center justify-content-center flex-shrink-0 transition-all ${!input.trim() ? 'bg-secondary bg-opacity-10 text-muted' : 'clay-btn bg-primary text-white'}`}
                            style={{ width: 50, height: 50 }}
                        >
                            <Send size={22} />
                        </motion.button>
                    </div>
                </div>
                <div className="text-center mt-3">
                    <small className="text-muted fw-medium" style={{ fontSize: '0.75em', letterSpacing: '0.5px' }}>AI TUTOR • DESIGNED FOR DEVELOPERS</small>
                </div>
            </div>

            <style>{`
                /* Claymorphism Utilities */
                .clay-card {
                    background: #ffffff;
                    box-shadow: 
                        8px 8px 16px #d1d9e6, 
                        -8px -8px 16px #ffffff;
                    border: 1px solid rgba(255,255,255,0.8);
                }
                .clay-btn {
                    background: #ffffff;
                    box-shadow: 
                        5px 5px 10px #d1d9e6, 
                        -5px -5px 10px #ffffff;
                    border: none;
                    transition: all 0.2s ease;
                }
                .clay-btn:active {
                    box-shadow: inset 5px 5px 10px #d1d9e6, inset -5px -5px 10px #ffffff;
                }
                .clay-btn.bg-primary {
                    background: var(--bs-primary);
                    box-shadow: 
                        5px 5px 10px rgba(var(--bs-primary-rgb), 0.4), 
                        -5px -5px 10px rgba(255,255,255, 0.2);
                    color: white;
                }
                
                .typing-loader span {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    background-color: var(--bs-primary);
                    border-radius: 50%;
                    margin: 0 3px;
                    animation: typing 1.2s infinite ease-in-out both;
                }
                .typing-loader span:nth-child(1) { animation-delay: -0.32s; }
                .typing-loader span:nth-child(2) { animation-delay: -0.16s; }
                @keyframes typing {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .hover-rotate { transition: transform 0.3s; }
                .hover-rotate:hover { transform: rotate(180deg); }
                 .hover-bg-gray:hover { background-color: #e9ecef !important; }
                
                /* Selection Color */
                ::selection {
                    background: rgba(var(--bs-primary-rgb), 0.2);
                    color: var(--bs-primary);
                }
            `}</style>
        </div>
    );
};

export default HeroChat;
