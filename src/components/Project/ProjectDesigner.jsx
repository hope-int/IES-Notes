import React, { useState, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAICompletion } from '../../utils/aiService';

const ProjectDesigner = ({ onBack }) => {
    // REQUIRED STATE
    const [step, setStep] = useState(1); // 1: Config, 2: IDE
    const [isOrchestrating, setIsOrchestrating] = useState(false);
    const [activeFileId, setActiveFileId] = useState('doc_1');

    const [formData, setFormData] = useState({
        topic: 'AI-Powered Inventory System',
        objective: '',
        type: 'Major Project',
        complexity: 'Intermediate'
    });

    const [files, setFiles] = useState([
        { id: 'doc_1', name: 'Synopsis.md', type: 'markdown', status: 'idle', content: '# Project Synopsis\nWaiting for generation...' },
        { id: 'diagram_1', name: 'Architecture.mmd', type: 'mermaid', status: 'idle', content: 'graph TD;\n  A-->B;' },
        { id: 'code_1', name: 'main.py', type: 'code', status: 'idle', content: '# Boilerplate code will appear here' },
        { id: 'ppt_1', name: 'PitchDeck.pptx', type: 'slide', status: 'idle', content: [] }
    ]);

    const activeFile = files.find(f => f.id === activeFileId) || files[0];

    const getIcon = (type) => {
        switch (type) {
            case 'markdown': return <Icons.FileText size={18} />;
            case 'code': return <Icons.Code size={18} />;
            case 'mermaid': return <Icons.Network size={18} />;
            case 'slide': return <Icons.LayoutTemplate size={18} />;
            default: return <Icons.File size={18} />;
        }
    };

    const handleAiCall = async (prompt, type) => {
        try {
            const response = await getAICompletion([
                { role: 'user', content: prompt }
            ], {
                jsonMode: type === 'slide',
                model: 'llama-3.3-70b-versatile'
            });

            if (type === 'slide') {
                try {
                    const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
                    return JSON.parse(cleaned);
                } catch (e) {
                    console.error("Slide JSON Parse Error:", e);
                    return [];
                }
            }
            return response.trim();
        } catch (err) {
            console.error(`AI call failed for ${type}:`, err);
            throw err;
        }
    };

    const startProjectGeneration = async () => {
        setStep(2);
        setIsOrchestrating(true);

        // Reset all statuses
        setFiles(prev => prev.map(f => ({ ...f, status: 'pending', content: f.type === 'slide' ? [] : 'Generating...' })));

        for (const file of files) {
            // Focus on current generating file
            setActiveFileId(file.id);

            // Determine prompt based on file type
            let prompt = "";
            switch (file.type) {
                case 'markdown':
                    prompt = `You are a Senior Technical Writer. Write a 3-section academic synopsis for the project: '${formData.topic}'. Include: Introduction, Objectives, and Methodology. Output strictly in Markdown format without markdown code block wrappers. Context: ${formData.objective}`;
                    break;
                case 'mermaid':
                    prompt = `You are a Cloud Architect. Create a system architecture diagram for '${formData.topic}' using strict Mermaid.js syntax. Use graph TD. Do not use parentheses () inside node labels. Output ONLY the raw Mermaid code, no explanations. Complexity: ${formData.complexity}`;
                    break;
                case 'code':
                    prompt = `You are a Senior Staff Engineer. Write the foundational boilerplate code for '${formData.topic}'. Include rich comments explaining the structure. Output ONLY valid code. Project Type: ${formData.type}`;
                    break;
                case 'slide':
                    prompt = `You are a Startup Founder. Create a 6-slide presentation for '${formData.topic}'. Output ONLY a valid JSON array of objects with keys: title, layout, and bullets. Max 3 bullets per slide. No markdown wrappers.`;
                    break;
            }

            try {
                const response = await handleAiCall(prompt, file.type);

                // Update specific file
                setFiles(prev => prev.map(f =>
                    f.id === file.id
                        ? { ...f, content: response, status: 'complete' }
                        : f
                ));
            } catch (err) {
                console.error(`Error generating ${file.name}:`, err);
                setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'error' } : f));
            }

            // Small delay between transitions for visual smoothness
            await new Promise(r => setTimeout(r, 500));
        }

        setIsOrchestrating(false);
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
    };

    return (
        <div className="w-full min-h-screen bg-slate-50 font-inter overflow-x-hidden relative">
            {/* Background Orbs for Glassmorphism */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/40 rounded-full blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/40 rounded-full blur-[120px] pointer-events-none" />

            <AnimatePresence mode="wait">
                {step === 1 ? (
                    <motion.div
                        key="config"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="max-w-4xl mx-auto pt-20 pb-40 px-6 relative z-10"
                    >
                        <div className="bg-white/70 backdrop-blur-2xl border border-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] rounded-[2.5rem] p-10 md:p-14 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl" />

                            <div className="flex items-center gap-6 mb-12">
                                <div className="p-5 bg-slate-900 rounded-[1.5rem] text-white shadow-2xl shadow-indigo-200">
                                    <Icons.Box size={32} />
                                </div>
                                <div>
                                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Project Architect</h3>
                                    <p className="text-lg text-slate-500 font-medium">Engineer your vision with agentic precision.</p>
                                </div>
                            </div>

                            <div className="space-y-10">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Project Topic</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-100/50 border-2 border-transparent focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl p-6 text-xl font-bold text-slate-800 placeholder-slate-400 transition-all shadow-inner"
                                        placeholder="e.g. AI-Powered Inventory System"
                                        value={formData.topic}
                                        onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Primary Objective</label>
                                    <textarea
                                        className="w-full bg-slate-100/50 border-2 border-transparent focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl p-6 font-bold text-slate-800 placeholder-slate-400 transition-all min-h-[120px] shadow-inner"
                                        placeholder="Describe the main goal or specific requirements..."
                                        value={formData.objective}
                                        onChange={e => setFormData({ ...formData, objective: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Project Type</label>
                                        <div className="grid grid-cols-1 gap-4">
                                            {[
                                                { id: 'Mini Project', icon: <Icons.Zap size={20} />, desc: "Fast generation. 3-section report, basic architecture." },
                                                { id: 'Major Project', icon: <Icons.Globe size={20} />, desc: "Deep generation. Full thesis, complex diagrams, pitch deck." }
                                            ].map(opt => (
                                                <div
                                                    key={opt.id}
                                                    onClick={() => setFormData({ ...formData, type: opt.id })}
                                                    className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex flex-col gap-2 ${formData.type === opt.id ? 'bg-indigo-50/50 border-indigo-600 shadow-lg shadow-indigo-600/10 ring-1 ring-indigo-600' : 'bg-white/50 border-slate-100 hover:border-indigo-300 hover:shadow-md'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`${formData.type === opt.id ? 'text-indigo-600' : 'text-slate-400'}`}>{opt.icon}</div>
                                                        <span className="font-black text-slate-900">{opt.id}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{opt.desc}</p>
                                                    {formData.type === opt.id && <div className="absolute top-4 right-4 text-indigo-600"><Icons.CheckCircle size={16} /></div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Scope Complexity</label>
                                        <div className="grid grid-cols-1 gap-4">
                                            {[
                                                { id: 'Intermediate', icon: <Icons.Cpu size={20} />, desc: "Standard academic depth with robust documentation." },
                                                { id: 'Advanced Enterprise', icon: <Icons.ShieldCheck size={20} />, desc: "Professional grade specs with security-first architecture." }
                                            ].map(opt => (
                                                <div
                                                    key={opt.id}
                                                    onClick={() => setFormData({ ...formData, complexity: opt.id })}
                                                    className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex flex-col gap-2 ${formData.complexity === opt.id ? 'bg-indigo-50/50 border-indigo-600 shadow-lg shadow-indigo-600/10 ring-1 ring-indigo-600' : 'bg-white/50 border-slate-100 hover:border-indigo-300 hover:shadow-md'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`${formData.complexity === opt.id ? 'text-indigo-600' : 'text-slate-400'}`}>{opt.icon}</div>
                                                        <span className="font-black text-slate-900">{opt.id}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{opt.desc}</p>
                                                    {formData.complexity === opt.id && <div className="absolute top-4 right-4 text-indigo-600"><Icons.CheckCircle size={16} /></div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className="bg-slate-900 hover:bg-black text-white text-xl font-black py-6 px-10 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-4 w-full mt-12 group"
                                    onClick={startProjectGeneration}
                                    disabled={!formData.topic}
                                >
                                    <Icons.Sparkles className="group-hover:rotate-12 transition-transform" />
                                    Architect Blueprint
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="ide"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col h-screen bg-white"
                    >
                        {/* IDE Header */}
                        <header className="h-[60px] border-b border-slate-200 px-6 flex items-center justify-between bg-white z-10">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setStep(1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
                                    <Icons.ArrowLeft size={20} />
                                </button>
                                <div>
                                    <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                        <Icons.Box className="text-indigo-600" size={20} />
                                        Designer Pro Studio
                                    </h1>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest shrink-0">
                                    {formData.type}
                                </div>
                                <div className="h-6 w-px bg-slate-200 mx-2" />
                                <div className="flex items-center gap-2">
                                    {isOrchestrating && <Icons.Loader2 className="animate-spin text-indigo-600" size={18} />}
                                    <span className="text-xs font-bold text-slate-500 truncate max-w-[200px]">{formData.topic}</span>
                                </div>
                            </div>
                        </header>

                        {/* IDE Panels */}
                        <div className="flex-1 overflow-hidden">
                            <PanelGroup direction="horizontal">
                                <Panel defaultSize={20} minSize={15} className="bg-slate-900 flex flex-col">
                                    <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Explorer</span>
                                        <Icons.FolderTree size={14} className="text-slate-500" />
                                    </div>
                                    <div className="flex-1 overflow-y-auto py-2">
                                        {files.map(file => (
                                            <button
                                                key={file.id}
                                                onClick={() => setActiveFileId(file.id)}
                                                className={`w-full flex items-center justify-between px-4 py-3 transition-all ${activeFileId === file.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {getIcon(file.type)}
                                                    <span className="text-sm font-bold">{file.name}</span>
                                                </div>
                                                <div className="flex items-center">
                                                    {file.status === 'pending' && <Icons.Loader2 className="animate-spin text-indigo-200" size={14} />}
                                                    {file.status === 'complete' && <Icons.CheckCircle className="text-emerald-400" size={14} />}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </Panel>

                                <PanelResizeHandle className="w-1 bg-slate-200 hover:bg-indigo-400 transition-colors cursor-col-resize" />

                                <Panel defaultSize={55} minSize={30} className="bg-white flex flex-col overflow-hidden">
                                    <header className="h-10 border-b border-slate-100 px-4 flex items-center bg-slate-50/50">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{activeFile.name}</span>
                                    </header>
                                    <div className="flex-1 overflow-auto relative bg-white">
                                        {activeFile.type === 'markdown' && (
                                            <div className="prose prose-slate max-w-none p-10 font-inter antialiased">
                                                <ReactMarkdown>{activeFile.content}</ReactMarkdown>
                                            </div>
                                        )}
                                        {activeFile.type === 'code' && (
                                            <Editor
                                                height="100%"
                                                defaultLanguage="python"
                                                theme="vs-light"
                                                value={activeFile.content}
                                                options={{
                                                    readOnly: isOrchestrating,
                                                    minimap: { enabled: false },
                                                    fontSize: 14,
                                                    fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                                                    scrollBeyondLastLine: false,
                                                    renderLineHighlight: 'all',
                                                    scrollbar: { vertical: 'hidden', horizontal: 'hidden' }
                                                }}
                                            />
                                        )}
                                        {activeFile.type === 'mermaid' && (
                                            <div className="p-8 h-full flex flex-col bg-slate-50">
                                                <div className="mb-4 flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-100 px-2 py-1 rounded uppercase tracking-widest">Mermaid Architecture</span>
                                                </div>
                                                <pre className="flex-1 p-8 bg-slate-900 text-emerald-400 rounded-3xl overflow-auto font-mono text-sm leading-relaxed border border-slate-800 shadow-2xl selection:bg-indigo-500/30">
                                                    {activeFile.content}
                                                </pre>
                                            </div>
                                        )}
                                        {activeFile.type === 'slide' && (
                                            <div className="p-12 h-full flex flex-col items-center justify-center bg-slate-50">
                                                <div className="aspect-video w-full max-w-4xl bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
                                                    <div className="bg-slate-900 px-8 py-4 flex items-center justify-between">
                                                        <Icons.Presentation size={20} className="text-white" />
                                                        <div className="flex gap-1">
                                                            <div className="w-2 h-2 rounded-full bg-red-400" />
                                                            <div className="w-2 h-2 rounded-full bg-yellow-400" />
                                                            <div className="w-2 h-2 rounded-full bg-green-400" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                                        {activeFile.content.length > 0 ? (
                                                            <div className="w-full">
                                                                <h2 className="text-4xl font-black text-slate-900 mb-6">{activeFile.content[0].title}</h2>
                                                                <ul className="space-y-4 text-left max-w-xl mx-auto">
                                                                    {activeFile.content[0].bullets?.map((b, i) => (
                                                                        <li key={i} className="flex items-start gap-4 text-xl font-medium text-slate-600">
                                                                            <Icons.ArrowRight className="mt-1 text-indigo-600 shrink-0" size={24} />
                                                                            {b}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-4 text-slate-300">
                                                                <Icons.LayoutTemplate size={64} className="opacity-20" />
                                                                <p className="font-bold text-xl uppercase tracking-tighter">Deck Visualizing...</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="mt-8 flex gap-3 overflow-x-auto pb-4 max-w-full">
                                                    {Array.isArray(activeFile.content) && activeFile.content.map((_, i) => (
                                                        <div key={i} className={`w-24 h-14 rounded-xl border-2 transition-all ${i === 0 ? 'border-indigo-600 bg-white ring-4 ring-indigo-50' : 'border-slate-200 bg-slate-100 opacity-50'}`}></div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Panel>

                                <PanelResizeHandle className="w-1 bg-slate-200 hover:bg-indigo-400 transition-colors cursor-col-resize" />

                                <Panel defaultSize={25} minSize={20} className="bg-white flex flex-col border-l border-slate-100 shadow-2xl overflow-hidden">
                                    <header className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                                                <Icons.Bot size={16} />
                                            </div>
                                            <span className="font-black text-slate-900 text-sm">Co-Pilot Core</span>
                                        </div>
                                        <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest ring-1 ring-indigo-200/50">Active</span>
                                    </header>

                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                                        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm leading-relaxed text-sm font-medium text-slate-600">
                                            Ready to assist. I'm monitoring the **{activeFile.name}** generation. Ask me to refine logic or explain the architecture.
                                        </div>
                                    </div>

                                    <div className="p-4 bg-white border-t border-slate-100">
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                placeholder={`Refine ${activeFile.name}...`}
                                                className="w-full bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-400 rounded-[1.2rem] py-4 pl-5 pr-12 text-sm focus:outline-none transition-all shadow-inner"
                                            />
                                            <button className="absolute right-2 top-2 p-2 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-lg active:scale-95 group-hover:bg-indigo-600">
                                                <Icons.Send size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </Panel>
                            </PanelGroup>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProjectDesigner;
