
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { simulateCodeExecution, reverseEngineerCode } from '../utils/aiService';
import { Lightbulb, Play, Code, Terminal, ArrowRight, RotateCcw, Check, Copy, ArrowLeft, Cpu, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function JCompiler() {
    const navigate = useNavigate();
    const [mode, setMode] = useState('compiler'); // 'compiler' | 'generator'
    const [input, setInput] = useState('');
    const [output, setOutput] = useState(null); // { text, status, explanation, fixedCode }
    const [loading, setLoading] = useState(false);
    const [language, setLanguage] = useState('auto');
    const [copySuccess, setCopySuccess] = useState(false);

    const terminalEndRef = useRef(null);

    // Auto-scroll to bottom of terminal
    useEffect(() => {
        if (terminalEndRef.current) {
            terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [output]);

    const handleRun = async () => {
        if (!input.trim() || loading) return;
        setLoading(true);
        setOutput(null);

        await runSimulation();
    };

    const runSimulation = async () => {
        try {
            if (mode === 'compiler') {
                const result = await simulateCodeExecution(input, language);
                setOutput({
                    text: result.output,
                    status: result.status,
                    explanation: result.errorExplanation,
                    fixedCode: result.fixedCode,
                    detectedLanguage: result.language
                });
            } else {
                // Reverse Engineer Mode (Static)
                const result = await reverseEngineerCode(input, language);
                setOutput({
                    text: result.code,
                    status: 'success',
                    explanation: result.explanation
                });
            }
        } catch (error) {
            console.error(error);
            setOutput({
                text: "Error: Failed to process request.\n" + error.message,
                status: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
        <div className="min-vh-100 d-flex flex-column p-3 p-md-4 transition-colors" style={{ background: 'var(--bg-page)', fontFamily: "'Outfit', sans-serif" }}>

            {/* Header Section */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4 gap-3">
                <div className="d-flex align-items-center gap-3 w-100 w-md-auto">
                    <button
                        onClick={() => navigate('/')}
                        className="clay-button p-2 rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: '40px', height: '40px', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                            <Terminal size={28} className="text-primary" />
                            J-Compiler
                        </h2>
                        <small className="text-muted">AI-Powered Code Studio</small>
                    </div>
                </div>

                {/* Mode Toggle */}
                <div className="clay-card p-1 d-flex gap-1 rounded-pill bg-white" style={{ border: '1px solid #e2e8f0' }}>
                    <button
                        className={`btn btn-sm rounded-pill px-3 py-2 d-flex align-items-center gap-2 fw-bold transition-all ${mode === 'compiler' ? 'bg-primary text-white shadow-sm' : 'text-muted hover-bg-light'}`}
                        onClick={() => { setMode('compiler'); setInput(''); setOutput(null); setIsWaitingInput(false); }}
                        style={{ border: 'none' }}
                    >
                        <Play size={16} /> Compiler
                    </button>
                    <button
                        className={`btn btn-sm rounded-pill px-3 py-2 d-flex align-items-center gap-2 fw-bold transition-all ${mode === 'generator' ? 'bg-primary text-white shadow-sm' : 'text-muted hover-bg-light'}`}
                        onClick={() => { setMode('generator'); setInput(''); setOutput(null); setIsWaitingInput(false); }}
                        style={{ border: 'none' }}
                    >
                        <RotateCcw size={16} /> Reverse Engineer
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="row g-4 flex-grow-1">

                {/* Input Panel */}
                <div className="col-lg-6 d-flex flex-column">
                    <div className="clay-card h-100 d-flex flex-column overflow-hidden border-0 shadow-sm" style={{ background: 'var(--bg-card)' }}>

                        {/* Panel Header */}
                        <div className="p-3 border-bottom d-flex justify-content-between align-items-center bg-light bg-opacity-50">
                            <span className="fw-bold text-secondary text-uppercase fs-7 d-flex align-items-center gap-2">
                                <Code size={16} /> {mode === 'compiler' ? 'Input Code' : 'Expected Output'}
                            </span>

                            <div className="d-flex gap-2">
                                <select
                                    className="form-select form-select-sm border-0 bg-white shadow-sm fw-bold text-secondary"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    style={{ width: '130px', cursor: 'pointer' }}
                                >
                                    <option value="auto">✨ Auto Detect</option>
                                    <option value="python">🐍 Python</option>
                                    <option value="javascript">📜 JavaScript</option>
                                    <option value="java">☕ Java</option>
                                    <option value="cpp">⚙️ C++</option>
                                    <option value="html">🌐 HTML/CSS</option>
                                    <option value="c">⚙️ C</option>
                                    <option value="assembly">⚙️ Assembly</option>
                                </select>

                                <button
                                    className="btn btn-primary btn-sm d-flex align-items-center gap-2 shadow-sm rounded-pill px-3 fw-bold"
                                    onClick={handleRun}
                                    disabled={loading}
                                    style={{ background: 'var(--primary-accent)', border: 'none' }}
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                            Running...
                                        </>
                                    ) : (
                                        <>{mode === 'compiler' ? 'Run' : 'Generate'} <ArrowRight size={16} /></>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Editor Area */}
                        <textarea
                            className="form-control border-0 p-3 flex-grow-1"
                            style={{
                                resize: 'none',
                                fontFamily: "'Fira Code', monospace",
                                fontSize: '14px',
                                lineHeight: '1.6',
                                background: mode === 'compiler' ? '#1e1e1e' : '#ffffff',
                                color: mode === 'compiler' ? '#d4d4d4' : 'var(--text-main)',
                                borderRadius: 0
                            }}
                            placeholder={mode === 'compiler' ?
                                "// Write your code here...\n// e.g. Input handling demo\nconst name = prompt('Enter Name:');\nconsole.log('Hello ' + name);" :
                                "Describe the desired output or logic...\nExample: Create a function that calculates the Fibonacci sequence up to N."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            spellCheck="false"
                        />
                    </div>
                </div>

                {/* Output Panel */}
                <div className="col-lg-6 d-flex flex-column">
                    <div className="clay-card h-100 d-flex flex-column overflow-hidden border-0 shadow-sm" style={{ background: '#1e1e1e' }}>

                        {/* Output Header */}
                        <div className="p-3 border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center" style={{ background: '#252526' }}>
                            <span className="fw-bold text-light text-uppercase fs-7 d-flex align-items-center gap-2">
                                <Terminal size={16} /> {mode === 'compiler' ? 'Console Output' : 'Generated Code'}
                            </span>
                            {output && (
                                <button
                                    className="btn btn-sm btn-dark border border-secondary border-opacity-25 d-flex align-items-center gap-2"
                                    onClick={() => copyToClipboard(output.fixedCode || output.text)}
                                >
                                    {copySuccess ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                                    <span style={{ fontSize: '12px' }}>{copySuccess ? 'Copied' : 'Copy'}</span>
                                </button>
                            )}
                        </div>

                        {/* Output Content */}
                        <div className="p-3 flex-grow-1 overflow-auto custom-scrollbar" style={{ fontFamily: "'Fira Code', monospace" }}>
                            <AnimatePresence mode='wait'>
                                {loading && !output ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="d-flex flex-column align-items-center justify-content-center h-100 text-secondary"
                                    >
                                        <div className="spinner-border text-primary mb-3" role="status"></div>
                                        <p className="text-light opacity-75 animate-pulse">AI is compiling & analyzing...</p>
                                    </motion.div>
                                ) : output ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="h-100 d-flex flex-column"
                                    >
                                        {/* Status Badge */}
                                        {mode === 'compiler' && (
                                            <div className={`badge mb-3 px-3 py-2 rounded-pill align-self-start ${output.status === 'error' ? 'bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25' : 'bg-success bg-opacity-25 text-success border border-success border-opacity-25'}`}>
                                                {output.status === 'error' ? 'Compilation Failed' : 'Build Success'}
                                            </div>
                                        )}

                                        {/* Main Terminal Output */}
                                        <div className="flex-grow-1" style={{ whiteSpace: 'pre-wrap', color: output.status === 'error' ? '#ff6b6b' : '#55efc4', minHeight: '100px' }}>
                                            {output.text}
                                            <div ref={terminalEndRef} />
                                        </div>

                                        {/* AI Analysis (Error or Generator) */}
                                        {(output.status === 'error' || mode === 'generator') && (
                                            <div className="p-3 rounded-3 mt-3" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                <h6 className={`d-flex align-items-center gap-2 mb-2 ${output.status === 'error' ? 'text-warning' : 'text-info'}`}>
                                                    {output.status === 'error' ? <Lightbulb size={18} /> : <Sparkles size={18} />}
                                                    {output.status === 'error' ? 'AI Debugger Analysis' : 'Implementation Logic'}
                                                </h6>
                                                <p className="text-light small opacity-75 mb-0" style={{ lineHeight: '1.6' }}>{output.explanation}</p>

                                                {/* Fixed Code Preview */}
                                                {output.fixedCode && (
                                                    <div className="mt-3 pt-3 border-top border-secondary border-opacity-25">
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <span className="text-success small fw-bold">Suggested Fix:</span>
                                                            <button
                                                                className="btn btn-sm btn-dark border border-secondary border-opacity-25 d-flex align-items-center gap-2 py-1 px-2"
                                                                onClick={() => copyToClipboard(output.fixedCode.replace(/\\n/g, '\n'))}
                                                                style={{ fontSize: '11px' }}
                                                            >
                                                                <Copy size={12} /> Copy Fix
                                                            </button>
                                                        </div>
                                                        <div className="position-relative">
                                                            <pre className="p-3 rounded bg-black text-white border border-secondary border-opacity-25 small mb-0 custom-scrollbar" style={{ whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
                                                                {output.fixedCode.replace(/\\n/g, '\n')}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 0.5 }}
                                        className="h-100 d-flex flex-column align-items-center justify-content-center text-muted"
                                    >
                                        <Code size={64} strokeWidth={1} className="mb-3" />
                                        <p>Ready to compile.</p>
                                        <small>Select output language or use Auto-Detect.</small>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                {`
                @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
                `}
            </style>
        </div>
    );
}
