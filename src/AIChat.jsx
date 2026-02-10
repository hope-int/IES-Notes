import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, RefreshCw, ChevronDown, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import ReactMarkdown from 'react-markdown';

export default function AIChat({ profile }) {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `Hello ${profile?.full_name?.split(' ')[0] || 'Student'}! I am Sokratis, your AI Tutor. I know your entire syllabus for ${profile?.department || 'Engineering'} (Sem ${profile?.semester || '?'}). Ask me anything!`
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [syllabusText, setSyllabusText] = useState('');
    const messagesEndRef = useRef(null);

    // Load Syllabus Data
    useEffect(() => {
        fetch('/dataset.txt') // Moved to public folder
            .then(res => res.text())
            .then(text => setSyllabusText(text))
            .catch(err => console.error("Failed to load syllabus:", err));
    }, []);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // Construct System Prompt
            const systemPrompt = `
You are Sokratis, an expert engineering tutor at IES College of Engineering.
User Details: ${profile?.full_name}, ${profile?.department}, ${profile?.semester}, Year ${profile?.year}.
Context: The user is asking questions related to their engineering curriculum.

Below is the official Syllabus/Curriculum Data for verify facts:
---
${syllabusText.substring(0, 20000)} ... (truncated for token limit if needed)
---

INSTRUCTIONS:
1. Answer strictly based on the provided syllabus where applicable.
2. If the user asks about a specific subject in their semester (${profile?.semester}), provide detailed, academic answers.
3. Be encouraging, concise, and use markdown for formatting (bullet points, bold text).
4. If the question is outside academic scope, politely steer back to engineering topics.
5. Use emojis to be friendly but professional.
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
                    "model": "google/gemini-2.0-flash-lite-preview-02-05:free",
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

            setMessages(prev => [...prev, { role: 'assistant', content: aiContent }]);

        } catch (error) {
            console.error("AI Error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Connection error. Please check your API Key or internet." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container py-4 pb-5 mb-5" style={{ maxWidth: '800px' }}>
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div className="d-flex align-items-center gap-3">
                    <div className="bg-primary text-white rounded-circle p-2 d-flex align-items-center justify-content-center shadow-lg" style={{ width: 48, height: 48 }}>
                        <Bot size={28} />
                    </div>
                    <div>
                        <h4 className="fw-bold mb-0">AI Tutor <span className="badge bg-light text-primary border ms-2" style={{ fontSize: '0.7rem' }}>BETA</span></h4>
                        <small className="text-muted">Powered by Gemini 2.0 Flash</small>
                    </div>
                </div>
                <button
                    onClick={() => setMessages([{ role: 'assistant', content: "Hello! How can I help you with your studies today?" }])}
                    className="btn btn-light btn-sm rounded-pill text-muted"
                    title="Clear Chat"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {/* Chat Area */}
            <div className="bg-white rounded-4 shadow-sm border overflow-hidden d-flex flex-column" style={{ height: '70vh' }}>
                <div className="flex-grow-1 overflow-auto p-4 custom-scrollbar" style={{ background: '#f8f9fa' }}>
                    <div className="d-flex flex-column gap-3">
                        {messages.map((msg, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`d-flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                            >
                                <div className={`flex-shrink-0 rounded-circle d-flex align-items-center justify-content-center shadow-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white text-primary border'}`} style={{ width: 36, height: 36 }}>
                                    {msg.role === 'user' ? <User size={18} /> : <Sparkles size={18} />}
                                </div>
                                <div className={`p-3 rounded-4 shadow-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-0' : 'bg-white text-dark border rounded-tl-0'}`} style={{ maxWidth: '80%' }}>
                                    <ReactMarkdown
                                        components={{
                                            p: ({ node, ...props }) => <p className="mb-1" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="ps-3 mb-1" {...props} />,
                                            ol: ({ node, ...props }) => <ol className="ps-3 mb-1" {...props} />,
                                            li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                            code: ({ node, inline, className, children, ...props }) => {
                                                return inline ?
                                                    <code className="bg-light px-1 rounded text-danger" {...props}>{children}</code> :
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
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="d-flex gap-3">
                                <div className="bg-white text-primary border rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: 36, height: 36 }}>
                                    <Sparkles size={18} className="spin-anim" />
                                </div>
                                <div className="bg-white border text-muted p-3 rounded-4 rounded-tl-0 shadow-sm">
                                    <span className="typing-dots">Thinking</span>
                                </div>
                            </motion.div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-3 bg-white border-top">
                    {syllabusText.length < 100 && (
                        <div className="alert alert-warning py-1 small mb-2">
                            ⚠️ Syllabus data not loaded. AI may hallunicate.
                        </div>
                    )}
                    <div className="d-flex gap-2">
                        <input
                            type="text"
                            className="form-control border-0 bg-light shadow-inner py-3 px-4 rounded-pill"
                            placeholder="Ask about your syllabus, notes, or logic..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            disabled={loading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className="btn btn-primary rounded-circle shadow-sm d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ width: 54, height: 54 }}
                        >
                            <Send size={24} />
                        </button>
                    </div>
                    <div className="text-center mt-2">
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>AI can make mistakes. Verify important info.</small>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #dee2e6; border-radius: 10px; }
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
