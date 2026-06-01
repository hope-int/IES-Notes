import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Zap, Cpu, BookOpen, History, MessageSquare, Plus, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getAICompletion } from '../../utils/aiService';
import { sanitizeInput, validateUserIntent } from '../../utils/security';
import MermaidRenderer from './MermaidRenderer';

const MotionDiv = motion.div;

const SocraticChat = ({ profile }) => {
    const [sessions, setSessions] = useState(() => {
        const saved = localStorage.getItem('hope_zero_to_hero_sessions');
        return saved ? JSON.parse(saved) : [];
    });
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
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

    // Initialize or Load Session on mount
    useEffect(() => {
        if (!activeSessionId) {
            if (sessions.length > 0) {
                loadSession(sessions[0]);
            } else {
                startNewSession();
            }
        }
    }, []);

    const startNewSession = async () => {
        const newId = crypto.randomUUID();
        const initialMessage = { role: 'assistant', content: '', isLoading: true };
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
        await generatePersonalizedOpener(newId, newSession);
    };

    const generatePersonalizedOpener = async (sessionId) => {
        setIsGeneratingStart(true);
        const systemPrompt = constructSystemPrompt();
        const openerPrompt = [
            { role: 'system', content: systemPrompt },
            { role: 'system', content: "GENERATE OPENING MESSAGE: Based on the user's profile, ask a personalized, engaging question to start the session. Use their name if available, refer to their specific goal (e.g., 'passing exams'), and use their preferred analogy domain (e.g., 'gaming') to set the mood. Keep it under 2 sentences." }
        ];
        try {
            const aiResponse = await getAICompletion(openerPrompt);
            const finalMessage = { role: 'assistant', content: aiResponse };
            setMessages([finalMessage]);
            updateSession(sessionId, [finalMessage]);
        } catch (error) {
            console.error('Failed to generate opener:', error);
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
            : [{ role: 'assistant', content: 'Resume chat...' }];
        setMessages(cleanMessages);
        setShowHistory(false);
    };

    const estimateProficiency = (history) => {
        let score = 0;
        const userMessages = history.filter(m => m.role === 'user');
        if (userMessages.length === 0) return 0.5;
        userMessages.forEach(m => {
            const content = m.content.toLowerCase();
            if (content.includes('```')) score += 2;
            const techTerms = ['recursion', 'algorithm', 'complexity', 'o(n)', 'pointer', 'reference', 'oop', 'class', 'functional', 'closure', 'promise', 'async', 'await', 'api', 'state', 'props', 'context'];
            techTerms.forEach(term => { if (content.includes(term)) score += 0.5; });
            if (content.length > 100) score += 0.5;
        });
        const averageScore = score / userMessages.length;
        return Math.min(Math.max(averageScore / 3, 0.1), 1.0);
    };

    const responseHasMisconceptionAlert = (text) => {
        return /\[Concept Check\]/i.test(text) || /Concept Check/i.test(text);
    };

    const constructSystemPrompt = (proficiency = 0.5) => {
        const studentProfile = profile.student_profile || {};
        let scaffoldingDepth = 'Detailed and step-by-step';
        let misconceptionHaltingStrictness = 'Moderate';
        let challengeLevel = 'Guidance-focused';

        if (proficiency < 0.3) {
            scaffoldingDepth = 'Extremely gentle, highly detailed sub-steps, using simple real-world analogies first.';
            misconceptionHaltingStrictness = 'High — halt immediately at the slightest error to prevent cognitive drift.';
            challengeLevel = 'Supportive scaffolding.';
        } else if (proficiency >= 0.7) {
            scaffoldingDepth = 'High-level guidance, letting the student discover sub-steps independently.';
            misconceptionHaltingStrictness = 'Factual checks only; encourage self-correction via leading questions.';
            challengeLevel = 'Challenging / Strict Code Review.';
        }

        return `
You are the "Zero to Hero" Coding Mentor. You are an elite Developer and a cognitive psychologist. Your goal is NOT to write code, but to **train the user's brain to think like a developer**.

### DYNAMIC PEDAGOGICAL DIFFICULTY CONFIGURATION:
- Estimated Student Proficiency Level: ${proficiency.toFixed(2)} (on a 0.0 - 1.0 scale)
- Scaffolding Depth: ${scaffoldingDepth}
- Misconception Halting Strictness: ${misconceptionHaltingStrictness}
- Challenge Level: ${challengeLevel}

Here is the cognitive profile of the student you are currently mentoring:
<json_profile>
${JSON.stringify(studentProfile, null, 2)}
</json_profile>

### THE "DEVELOPER MINDSET" PROTOCOL (STRICT):
You must guide the student through the **4-Step Engineering Process** for every coding question. Do not skip steps.

#### PHASE 1: DECONSTRUCTION (The "What")
- **Goal**: Ensure the user understands the problem.
- **Your Action**: Ask them to identify the **Inputs** and **Desired Outputs**.

#### PHASE 2: ALGORITHM DESIGN (The "How")
- **Goal**: Plan the logic without syntax distraction.
- **Your Action**: Ask for **Pseudo-code** or a logical step-by-step plan in plain English.

#### PHASE 3: EDGE CASE ANALYSIS (The "What If")
- **Goal**: Build robustness.
- **Your Action**: Ask "What happens if the input is empty/null/negative?"

#### PHASE 4: IMPLEMENTATION (The "Code")
- **Goal**: Syntax and translation.
- **Your Action**: NOW they can write code.

### GOLDEN RULES:
1. **NO SPOON-FEEDING**: Never provide the solution.
2. **SOCRATIC METHOD**: Answer a question with a guiding question.
3. **ANALOGIES**: Use analogies from domain: **${studentProfile.preferred_analogy_domain || 'general'}**.
`;
    };

    const handleSend = async (customPrompt = null) => {
        const userText = customPrompt || input.trim();
        if (!userText) return;

        const sanitizedText = sanitizeInput(userText);
        const securityCheck = validateUserIntent(sanitizedText);
        if (!securityCheck.safe) {
            const warningMsg = `[SECURITY ALERT] Adversarial prompt injection detected: ${securityCheck.reason}. The tutor has reset the context buffer.`;
            const finalMessages = [...messages, { role: 'user', content: userText }, { role: 'assistant', content: warningMsg, isWarning: true }];
            setMessages(finalMessages);
            setInput('');
            updateSession(activeSessionId, finalMessages);
            return;
        }

        const newMessages = [...messages, { role: 'user', content: userText }];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        try {
            const proficiency = estimateProficiency(newMessages);
            const systemPrompt = constructSystemPrompt(proficiency);
            const conversation = newMessages
                .filter(m => !m.isLoading && m.content && String(m.content).trim() !== '')
                .map(m => ({ role: m.role, content: m.content }));

            const lastAssistantMessage = [...conversation].reverse().find(m => m.role === 'assistant');
            const isMisconceptionHalted = lastAssistantMessage ? responseHasMisconceptionAlert(lastAssistantMessage.content) : false;

            const aiResponse = await getAICompletion([
                { role: 'system', content: systemPrompt },
                ...conversation
            ], {
                actionType: 'chat',
                studentProficiency: proficiency,
                misconceptionHalted: isMisconceptionHalted
            });

            const finalMessages = [...newMessages, { role: 'assistant', content: aiResponse }];
            setMessages(finalMessages);
            updateSession(activeSessionId, finalMessages);
        } catch (error) {
            console.error('AI Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to my brain. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    const chips = [
        { label: 'Give me a hint', icon: <Zap size={16} />, action: () => handleSend("I'm stuck. Can you give me a small logical hint?") },
        { label: 'Explain the logic', icon: <BookOpen size={16} />, action: () => handleSend('Can you explain the logic behind this step?') },
        { label: 'Let me try pseudo-code', icon: <Cpu size={16} />, action: () => handleSend("I'll try to write the pseudo-code now.") },
    ];

    return (
        <div className="zth-socratic d-flex flex-column flex-grow-1 overflow-hidden position-relative theme-page">
            <div className="zth-socratic-body d-flex flex-grow-1 overflow-hidden position-relative">
                <AnimatePresence>
                    {showHistory && (
                        <>
                        <MotionDiv
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowHistory(false)}
                            className="zth-history-backdrop"
                        />
                        <MotionDiv
                            initial={{ x: -300, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -300, opacity: 0 }}
                            className="zth-journey-panel"
                        >
                            <div className="zth-journey-header">
                                <div>
                                    <h6>Journeys</h6>
                                    <span>{sessions.length} saved paths</span>
                                </div>
                                <button onClick={() => setShowHistory(false)} className="zth-mini-icon" aria-label="Close journeys">
                                    <X size={15} />
                                </button>
                            </div>
                            <button onClick={() => startNewSession()} className="zth-journey-new">
                                    <Plus size={14} /> New
                            </button>
                            <div className="zth-journey-list custom-scrollbar">
                                {sessions.map(session => (
                                    <button
                                        key={session.id}
                                        onClick={() => loadSession(session)}
                                        className={`zth-journey-item ${activeSessionId === session.id ? 'is-active' : ''}`}
                                    >
                                        <span><MessageSquare size={16} /></span>
                                        <strong>{session.title || 'New Session'}</strong>
                                        <small>{new Date(session.timestamp).toLocaleDateString()}</small>
                                    </button>
                                ))}
                            </div>
                        </MotionDiv>
                        </>
                    )}
                </AnimatePresence>

                <div className="zth-socratic-scroll flex-grow-1 overflow-auto custom-scrollbar" ref={scrollContainerRef}>
                    <div className="zth-socratic-stream">
                        <AnimatePresence>
                            {messages.map((msg, idx) => (
                                <MotionDiv
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={idx}
                                    className={`zth-socratic-message ${msg.role === 'user' ? 'is-user' : 'is-assistant'} ${msg.isWarning ? 'is-warning' : ''}`}
                                >
                                    <div className="zth-socratic-avatar">
                                        {msg.role === 'user' ? <User size={22} /> : <Bot size={26} />}
                                    </div>
                                    <div
                                        className="zth-socratic-card"
                                    >
                                        {msg.isLoading ? (
                                            <div className="zth-socratic-dots" aria-label="Personalizing start">
                                                <span />
                                                <span />
                                                <span />
                                            </div>
                                        ) : (
                                            <ReactMarkdown components={{
                                                code({ inline, className, children, ...props }) {
                                                    const match = /language-(\w+)/.exec(className || '');
                                                    const language = match ? match[1] : '';
                                                    const codeText = String(children).replace(/\n$/, '');
                                                    if (language === 'mermaid' && !inline) {
                                                        const diagramId = `diag-${idx}-${Math.random().toString(36).slice(2, 6)}`;
                                                        const proficiency = estimateProficiency(messages.slice(0, idx + 1));
                                                        return (
                                                            <MermaidRenderer
                                                                code={codeText}
                                                                diagramId={diagramId}
                                                                proficiency={proficiency}
                                                                theme="light"
                                                            />
                                                        );
                                                    }
                                                    return !inline ? (
                                                        <pre className="zth-code-block">
                                                            <code {...props}>{children}</code>
                                                        </pre>
                                                    ) : (
                                                        <code className="zth-inline-code" {...props}>{children}</code>
                                                    );
                                                }
                                            }}>{msg.content}</ReactMarkdown>
                                        )}
                                    </div>
                                </MotionDiv>
                            ))}
                        </AnimatePresence>

                        {(loading || isGeneratingStart) && !messages.some(m => m.isLoading) && (
                            <MotionDiv
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="zth-socratic-message is-assistant"
                            >
                                <div className="zth-socratic-avatar">
                                    <Bot size={26} />
                                </div>
                                <div className="zth-socratic-card is-thinking">
                                    <span />
                                    <span />
                                    <span />
                                </div>
                            </MotionDiv>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            </div>

            {/* Input bar */}
            <div className="zth-socratic-composer">
                <div className="zth-socratic-composer-inner">
                    <div className="zth-socratic-toolbar">
                        <button type="button" onClick={() => setShowHistory(true)} className="zth-chip is-tool">
                            <History size={15} /> Journeys
                        </button>
                        {chips.map((chip, idx) => (
                            <button key={idx} onClick={chip.action} className="zth-chip">
                                {chip.icon}
                                {chip.label}
                            </button>
                        ))}
                    </div>
                    <div className="zth-socratic-input">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask the Socratic Tutor a question..."
                        />
                        <button onClick={() => handleSend()} disabled={!input.trim() || loading || isGeneratingStart} aria-label="Send Socratic message">
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SocraticChat;
