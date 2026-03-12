
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
            <div className="flex flex-col md:flex-row md:items-center justify-between p-2 md:p-4 border-b bg-gray-50 bg-opacity-25 gap-2">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-2 rounded-lg text-white" style={{ backgroundColor: '#003366' }}>
                        <Code size={18} />
                    </div>
                    <div>
                        <h6 className="font-bold mb-0 text-gray-900 text-sm md:text-base">J-Compiler Simulation</h6>
                        <span className="text-[9px] font-bold uppercase text-[#FF6600]">{language || 'Auto-Detect'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                    <button
                        onClick={handleCopy}
                        className="btn btn-sm bg-white border border-gray-200 rounded-xl px-2 md:px-3 py-1.5 flex items-center gap-1 md:gap-2"
                    >
                        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        <span className="hidden md:inline text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                        onClick={onSimulate}
                        disabled={isSimulating}
                        className="btn btn-sm rounded-xl px-2 md:px-3 py-1.5 flex items-center gap-1 md:gap-2 shadow-sm border-0 relative"
                        style={{ backgroundColor: '#FF6600', color: 'white', opacity: isSimulating ? 0.7 : 1 }}
                    >
                        {isSimulating ? (
                            <div className="spinner-border spinner-border-sm" style={{ width: '12px', height: '12px' }} />
                        ) : (
                            <Play size={14} />
                        )}
                        <span className="hidden md:inline text-[11px] font-bold">{isSimulating ? 'Simulating...' : 'Simulate'}</span>
                    </button>
                </div>
            </div>

            {/* View Tabs */}
            <div className="flex border-b bg-white overflow-x-auto scrollbar-hide">
                {[
                    { id: 'code', label: 'Source Code', icon: Code },
                    { id: 'terminal', label: 'Virtual Terminal', icon: Terminal },
                    { id: 'flow', label: 'Logic Flow', icon: Activity }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="btn border-0 rounded-0 px-3 md:px-4 py-3 flex items-center justify-center gap-1 md:gap-2 transition-all relative flex-1 md:flex-none whitespace-nowrap"
                        style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: activeTab === tab.id ? '#003366' : '#64748b',
                            backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
                            borderBottom: activeTab === tab.id ? '2px solid #003366' : 'none'
                        }}
                    >
                        <tab.icon size={14} />
                        <span className="hidden sm:inline">{tab.label}</span>
                        {!tab.label.includes('Virtual') && <span className="sm:hidden">{tab.label.split(' ')[0]}</span>}
                        {tab.label.includes('Virtual') && <span className="sm:hidden">Run</span>}
                        {activeTab === tab.id && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 w-full" style={{ height: '2px', backgroundColor: '#003366' }} />}
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
                            className="p-4 flex justify-center items-center bg-white overflow-auto w-full h-full min-h-[300px]"
                        >
                            {!simulationResult?.mermaidGraph ? (
                                <div className="text-muted flex flex-col items-center justify-center h-full py-5">
                                    <Activity size={32} strokeWidth={1} className="mb-3 opacity-25" />
                                    <p className="text-[10px] font-bold uppercase opacity-50">Waiting for Logic Trace...</p>
                                </div>
                            ) : (
                                <div className="w-full h-full">
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
