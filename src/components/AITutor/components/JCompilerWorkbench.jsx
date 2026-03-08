
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Terminal, Play, ChevronDown, ChevronUp, Check,
    Copy, Zap, Activity, Code, Share2, Info
} from 'lucide-react';
import MermaidRenderer from "../../MermaidRenderer";

const JCompilerWorkbench = ({ code, language, onSimulate, simulationResult, isSimulating }) => {
    const [activeTab, setActiveTab] = useState('code'); // 'code', 'terminal', 'flow'
    const [copied, setCopied] = useState(false);

    // Auto-switch to terminal on result
    React.useEffect(() => {
        if (simulationResult) {
            setActiveTab('terminal');
        }
    }, [simulationResult]);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden my-4 bg-white border border-light">
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom bg-light bg-opacity-25">
                <div className="d-flex align-items-center gap-3">
                    <div className="p-2 rounded-3 text-white" style={{ backgroundColor: '#003366' }}>
                        <Code size={18} />
                    </div>
                    <div>
                        <h6 className="fw-bold mb-0 text-dark">J-Compiler Simulation</h6>
                        <span className="x-small fw-bold uppercase" style={{ fontSize: '9px', color: '#FF6600' }}>{language || 'Auto-Detect'}</span>
                    </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <button
                        onClick={handleCopy}
                        className="btn btn-sm btn-light border-0 rounded-pill px-3 py-1-5 d-flex align-items-center gap-2"
                    >
                        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        <span className="d-none d-md-inline" style={{ fontSize: '11px' }}>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                        onClick={onSimulate}
                        disabled={isSimulating}
                        className="btn btn-sm rounded-pill px-3 py-1-5 d-flex align-items-center gap-2 shadow-sm border-0 position-relative"
                        style={{ backgroundColor: '#FF6600', color: 'white', opacity: isSimulating ? 0.7 : 1 }}
                    >
                        {isSimulating ? (
                            <div className="spinner-border spinner-border-sm" style={{ width: '12px', height: '12px' }} />
                        ) : (
                            <Play size={14} />
                        )}
                        <span className="d-none d-md-inline" style={{ fontSize: '11px', fontWeight: 'bold' }}>{isSimulating ? 'Simulating...' : 'Simulate'}</span>
                    </button>
                </div>
            </div>

            {/* View Tabs */}
            <div className="d-flex border-bottom bg-white">
                {[
                    { id: 'code', label: 'Source Code', icon: Code },
                    { id: 'terminal', label: 'Virtual Terminal', icon: Terminal },
                    { id: 'flow', label: 'Logic Flow', icon: Activity }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="btn border-0 rounded-0 px-3 px-md-4 py-3 d-flex align-items-center gap-2 transition-all position-relative flex-grow-1 flex-md-grow-0 justify-content-center"
                        style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: activeTab === tab.id ? '#003366' : '#94a3b8',
                            backgroundColor: activeTab === tab.id ? '#f0f5fa' : 'transparent'
                        }}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                        {activeTab === tab.id && <motion.div layoutId="tab-underline" className="position-absolute bottom-0 start-0 w-100" style={{ height: '2px', backgroundColor: '#003366' }} />}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="p-0 position-relative" style={{ minHeight: '300px', backgroundColor: '#fdfdfe' }}>
                <AnimatePresence mode="wait">
                    {activeTab === 'code' && (
                        <motion.div
                            key="code"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-4"
                        >
                            <pre className="m-0" style={{ fontFamily: "'Fira Code', monospace", fontSize: '13px', lineHeight: '1.6' }}>
                                <code className={`language-${language}`}>
                                    {code}
                                </code>
                            </pre>
                        </motion.div>
                    )}

                    {activeTab === 'terminal' && (
                        <motion.div
                            key="terminal"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="bg-dark p-4 h-100"
                            style={{ minHeight: '300px' }}
                        >
                            {!simulationResult ? (
                                <div className="text-muted d-flex flex-column align-items-center justify-content-center h-100 py-5">
                                    <Terminal size={32} strokeWidth={1} className="mb-3 opacity-25" />
                                    <p className="small fw-bold uppercase opacity-50" style={{ fontSize: '10px' }}>No execution data... Click Simulate.</p>
                                </div>
                            ) : (
                                <div className="text-success" style={{ fontFamily: "'Space Mono', monospace", fontSize: '13px' }}>
                                    <div className="text-muted mb-2 border-bottom border-secondary border-opacity-25 pb-1">[SYSTEM] Execution in context of HOPE Core...</div>
                                    <pre className="m-0 text-wrap">{simulationResult.output || '# Symbols defined.'}</pre>
                                    {simulationResult.errorExplanation && (
                                        <div className="text-danger mt-3 bg-danger bg-opacity-10 p-3 rounded-3 border border-danger border-opacity-20">
                                            <div className="fw-bold mb-1">RUNTIME ERROR:</div>
                                            <div>{simulationResult.errorExplanation}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'flow' && (
                        <motion.div
                            key="flow"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-4 d-flex justify-content-center bg-white"
                            style={{ minHeight: '300px' }}
                        >
                            {!simulationResult?.mermaidGraph ? (
                                <div className="text-muted d-flex flex-column align-items-center justify-content-center h-100 py-5">
                                    <Activity size={32} strokeWidth={1} className="mb-3 opacity-25" />
                                    <p className="small fw-bold uppercase opacity-50" style={{ fontSize: '10px' }}>Waiting for Logic Trace...</p>
                                </div>
                            ) : (
                                <div className="w-100">
                                    <MermaidRenderer chart={simulationResult.mermaidGraph} />
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer / Reasoning */}
            {simulationResult?.reasoning && (
                <div className="px-4 py-3 bg-light bg-opacity-50 border-top">
                    <div className="d-flex align-items-center gap-2 mb-2 text-primary opacity-75">
                        <Zap size={12} />
                        <span className="fw-bold uppercase" style={{ fontSize: '9px' }}>Execution Reasoning</span>
                    </div>
                    <p className="text-muted small mb-0">{simulationResult.reasoning}</p>
                </div>
            )}
        </div>
    );
};

export default JCompilerWorkbench;
