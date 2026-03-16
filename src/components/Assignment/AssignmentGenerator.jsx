import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import jsPDF from 'jspdf';
import { generateCodeSolution } from '../../utils/assignmentAI';
import MiniGameLoader from '../common/MiniGameLoader';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const AssignmentGenerator = ({ onBack }) => {
    const [formData, setFormData] = useState({
        subject: '',
        audience: 'Undergraduate',
        difficulty: 'Intermediate'
    });
    const [questionsQueue, setQuestionsQueue] = useState([]);
    const [currentInput, setCurrentInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [solvedAssignments, setSolvedAssignments] = useState([]);
    const [processingIndex, setProcessingIndex] = useState(-1);
    const [step, setStep] = useState(1); // 1: Input, 2: Processing, 3: Review
    const [activeReviewIndex, setActiveReviewIndex] = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    const [error, setError] = useState(null);
    const [isMobile, setIsMobile] = useState(false);
    const [copiedStates, setCopiedStates] = useState({});
    
    // Live Simulation States
    const [simulatedAlgorithm, setSimulatedAlgorithm] = useState([]);
    const [simulatedCode, setSimulatedCode] = useState("");
    const [simulatedOutput, setSimulatedOutput] = useState("");
    const [isSimulating, setIsSimulating] = useState(false);
    const [simStage, setSimStage] = useState(''); // 'algorithm', 'code', 'output'

    const scrollRef = useRef(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Auto-scroll for queue processing
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [solvedAssignments, processingIndex]);

    // Scroll Spy for Solution Review (Removed old logic, activeReviewIndex handled by tab clicks)
    useEffect(() => {
        if (step === 3 && solvedAssignments[activeReviewIndex]) {
            // Scroll logic here if needed for sub-sections
        }
    }, [step, activeReviewIndex]);

    const handleCopy = (code, idx) => {
        navigator.clipboard.writeText(code);
        setCopiedStates({ ...copiedStates, [idx]: true });
        setTimeout(() => setCopiedStates(prev => ({ ...prev, [idx]: false })), 2000);
    };

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const [scrambleProgress, setScrambleProgress] = useState(0);

    const typeText = async (text, setter, speed = 30, useMatrix = false) => {
        if (!text) return;
        if (useMatrix) {
            const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789<>[]{}/\\|!@#$%^&*()_+";
            const length = text.length;
            
            for (let i = 0; i <= length; i++) {
                let scrambled = "";
                for (let j = i; j < length; j++) {
                    scrambled += characters.charAt(Math.floor(Math.random() * characters.length));
                }
                const progress = text.slice(0, i) + scrambled.slice(0, Math.min(scrambled.length, 5));
                setter(progress);
                setScrambleProgress(i / length);
                await sleep(10);
            }
            setter(text);
            return;
        }

        let current = "";
        for (let j = 0; j < text.length; j++) {
            current += text[j];
            setter(current);
            await sleep(speed);
        }
    };

    const runSimulation = async (result) => {
        setIsSimulating(true);
        setSimulatedAlgorithm([]);
        setSimulatedCode("");
        setSimulatedOutput("");

        // 1. Algorithm Typing with Margin Delay
        setSimStage('algorithm');
        const algorithmLines = result.algorithm;
        for (let i = 0; i < algorithmLines.length; i++) {
            await sleep(400); // Prep time for current step
            setSimulatedAlgorithm(prev => [...prev, algorithmLines[i]]);
            await sleep(200); // Visual lock
        }

        // 2. Code Block Matrix Reveal
        await sleep(600);
        setSimStage('code');
        await typeText(result.code, setSimulatedCode, 5, true);

        // 3. Output Staggered Reveal
        await sleep(500);
        setSimStage('output');
        await typeText(result.output, setSimulatedOutput, 15);
        
        setIsSimulating(false);
    };

    const processQueue = async () => {
        if (questionsQueue.length === 0) return;

        setLoading(true);
        setError(null);
        setSolvedAssignments([]);
        setStep(2);

        try {
            for (let i = 0; i < questionsQueue.length; i++) {
                setProcessingIndex(i);
                const q = questionsQueue[i];
                
                try {
                    const result = await generateCodeSolution(q.text, formData);
                    const completed = {
                        questionText: q.text,
                        algorithm: result.algorithm || [],
                        code: result.code || '// No code generated',
                        output: result.output || 'No output generated',
                        error: false
                    };
                    
                    // Run the live simulation
                    await runSimulation(completed);
                    
                    setSolvedAssignments(prev => [...prev, completed]);
                } catch (itemErr) {
                    console.error("Queue item failed:", itemErr);
                    const failed = {
                        questionText: q.text,
                        error: true,
                        errorMessage: "Failed to generate solution."
                    };
                    setSolvedAssignments(prev => [...prev, failed]);
                }
            }
            setStep(3);
        } catch (err) {
            console.error(err);
            setError("Queue processing encountered a critical error.");
            setStep(1);
        } finally {
            setLoading(false);
            setProcessingIndex(-1);
            setIsSimulating(false);
        }
    };

    const addQuestion = () => {
        if (currentInput.trim() === '') return;
        setQuestionsQueue([...questionsQueue, { id: Date.now(), text: currentInput.trim() }]);
        setCurrentInput('');
    };

    const downloadPDF = () => {
        if (solvedAssignments.length === 0) return;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 20;

        const addText = (text, size, isBold = false, color = [0, 0, 0], font = "helvetica") => {
            doc.setFontSize(size);
            doc.setFont(font, isBold ? "bold" : "normal");
            doc.setTextColor(color[0], color[1], color[2]);
            const splitText = doc.splitTextToSize(text, pageWidth - 40);

            if (y + (splitText.length * (size / 2)) > 280) {
                doc.addPage();
                y = 20;
            }

            doc.text(splitText, 20, y);
            y += splitText.length * (size / 3) + 7;
        };

        // Header
        addText("MULTI-QUESTION ASSIGNMENT SOLUTION", 22, true, [15, 23, 42]);
        y += 10;

        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`HOPE AI Generated Solutions | ${formData.subject}`, 20, y);
        y += 15;

        solvedAssignments.forEach((assignment, index) => {
            if (index > 0) {
                doc.addPage();
                y = 20;
            }
            
            addText(`Question ${index + 1}: ${assignment.questionText}`, 14, true, [37, 99, 235]); // Blue
            y += 5;

            if (assignment.error) {
                addText(`Error: ${assignment.errorMessage}`, 12, false, [220, 38, 38]);
                return;
            }

            // Algorithm
            addText("Algorithm:", 12, true, [15, 23, 42]);
            if (Array.isArray(assignment.algorithm)) {
                assignment.algorithm.forEach((step, sIdx) => {
                    addText(`${sIdx + 1}. ${step}`, 11, false, [51, 65, 85]);
                });
            } else {
                addText(assignment.algorithm, 11, false, [51, 65, 85]);
            }
            y += 5;

            // Code
            if (assignment.code) {
                doc.setTextColor(15, 23, 42);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(12);
                doc.text("Code Implementation:", 20, y);
                y += 8;

                // Add dark background for code
                const codeLines = doc.splitTextToSize(assignment.code, pageWidth - 40);
                const codeHeight = codeLines.length * 3.3 + 10;
                
                // Only draw rect if it fits on page, else simplified fallback
                if (y + codeHeight > 280) {
                     doc.addPage();
                     y = 20;
                }
                
                doc.setFillColor(30, 30, 30);
                doc.rect(20, y, pageWidth - 40, codeHeight, 'F');

                doc.setFont("courier", "normal");
                doc.setFontSize(10);
                doc.setTextColor(212, 212, 216); // Light gray text for dark bg 
                doc.text(codeLines, 25, y + 6);
                y += codeHeight + 10;
            }

            // Output
            if (assignment.output) {
                doc.setTextColor(15, 23, 42);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(12);
                doc.text("Execution Output:", 20, y);
                y += 8;

                const outputLines = doc.splitTextToSize(`> node solution.js\n${assignment.output}`, pageWidth - 40);
                const outputHeight = outputLines.length * 3.3 + 10;
                
                if (y + outputHeight > 280) {
                     doc.addPage();
                     y = 20;
                }
                
                doc.setFillColor(0, 0, 0); // Black bg for terminal
                doc.rect(20, y, pageWidth - 40, outputHeight, 'F');
                
                doc.setFont("courier", "normal");
                doc.setFontSize(10);
                doc.setTextColor(52, 211, 153); // Emerald 400
                doc.text(outputLines, 25, y + 6);
                y += outputHeight + 10;
            }
        });

        doc.save(`HOPE_Assignment_Solutions.pdf`);
    };

    const containerVariants = {
        hidden: { opacity: 0, scale: 0.98 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
    };

    const editorialEase = [0.16, 1, 0.3, 1];

    return (
        <div className="fixed inset-0 bg-[#f9f9f9] text-[#1a1a1a] font-inter overflow-hidden selection:bg-indigo-100">
            {/* Minimal Background Grid */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

            {/* Global Controls */}
            <div className="fixed top-8 left-8 right-8 flex justify-between items-center z-50">
                <button 
                    onClick={onBack}
                    className="group flex items-center gap-2 px-4 py-2 bg-white border border-black/5 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95 text-xs font-bold"
                >
                    <Icons.ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    THE LIBRARY
                </button>

                {step === 3 && (
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={downloadPDF}
                            className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-full shadow-lg hover:bg-slate-800 transition-all active:scale-95 text-xs font-black uppercase tracking-widest"
                        >
                            <Icons.DownloadCloud size={14} /> DOWNLOAD ARCHIVE
                        </button>
                    </div>
                )}
            </div>

            <AnimatePresence mode="wait">
                {/* 1. THE REGISTRY - INPUT PHASE */}
                {step === 1 && (
                    <motion.div 
                        key="input-phase"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="relative h-full w-full flex items-start justify-center p-6 bg-[#f8f8f8] overflow-y-auto"
                    >
                        <div className={`w-full ${isMobile ? 'h-full flex-col' : 'max-w-[850px] min-h-[900px] my-auto shadow-[0_40px_100px_rgba(0,0,0,0.06)] rounded-sm'} bg-white border border-black/[0.03] p-12 md:p-24 relative flex flex-col transition-all duration-700`}>
                            {/* Watermark / Context */}
                            <div className="flex justify-between items-start mb-20 border-b border-slate-100 pb-8">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black uppercase tracking-tighter text-black leading-none">Registry</h2>
                                    <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-[0.4em]">Architect's Desk | Beta 2.0</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-300">Phase 01</p>
                                    <div className="flex gap-1 justify-end mt-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-black" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-black/10" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-black/10" />
                                    </div>
                                </div>
                            </div>

                            {/* Center Input Area - Fixed height but scrollable internal queue */}
                            <div className="flex-1 flex flex-col items-center justify-center space-y-12 overflow-y-auto no-scrollbar">
                                <div className="w-full max-w-lg space-y-12">
                                    {/* Question Queue - The "Quick Stack" */}
                                    <div className="flex flex-wrap items-center justify-center gap-2 min-h-[60px] max-h-[300px] overflow-y-auto transition-all p-2">
                                        <AnimatePresence>
                                            {questionsQueue.map((q, idx) => (
                                                <motion.div
                                                    key={q.id}
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, x: 20, rotate: 10, filter: 'blur(5px)' }}
                                                    className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-full flex items-center gap-2 group cursor-default"
                                                >
                                                    <span className="text-[10px] font-bold text-black/20">0{idx + 1}</span>
                                                    <span className="text-xs font-semibold text-slate-700">{q.text}</span>
                                                    <button 
                                                        onClick={() => setQuestionsQueue(prev => prev.filter(item => item.id !== q.id))}
                                                        className="text-slate-300 hover:text-rose-500 transition-colors"
                                                    >
                                                        <Icons.X size={14} />
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                        {questionsQueue.length === 0 && (
                                            <p className="text-sm font-medium text-slate-300 italic">Declare a topic...</p>
                                        )}
                                    </div>

                                    {/* Ghost Input */}
                                    <div className="relative group w-full max-w-sm mx-auto">
                                        <input 
                                            type="text"
                                            placeholder="Declare a topic..."
                                            className="w-full bg-transparent py-4 text-center text-lg font-black placeholder:text-slate-200 outline-none transition-all"
                                            value={currentInput}
                                            onChange={(e) => setCurrentInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addQuestion()}
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-100 overflow-hidden">
                                            <motion.div 
                                                className="h-full bg-black"
                                                initial={{ scaleX: 0 }}
                                                animate={{ scaleX: currentInput ? 1 : 0 }}
                                                transition={{ duration: 0.6, ease: editorialEase }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-auto pt-12 space-y-4">
                                    <button 
                                        onClick={() => setShowSettings(!showSettings)}
                                        className="w-full text-[10px] font-bold uppercase text-slate-300 hover:text-black transition-all tracking-[0.4em] flex items-center justify-center gap-2"
                                    >
                                        <Icons.Sliders size={12} /> Parameters
                                    </button>
                                    
                                    <button 
                                        onClick={processQueue}
                                        disabled={questionsQueue.length === 0 || loading}
                                        className={`w-full py-5 rounded-full font-black text-[11px] uppercase tracking-[0.4em] transition-all border-2 ${questionsQueue.length > 0 ? 'border-black text-black hover:bg-black hover:text-white' : 'border-slate-100 text-slate-300 cursor-not-allowed'}`}
                                    >
                                        {loading ? 'Synthesizing...' : 'Begin Archive'}
                                    </button>
                                </div>
                            </div>

                            {/* Settings Drawer (Inner) */}
                            <AnimatePresence>
                                {showSettings && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute inset-x-0 bottom-0 bg-white z-20 p-12 flex flex-col border-t border-slate-100 shadow-[0_-20px_50px_rgba(0,0,0,0.05)]"
                                    >
                                        <div className="flex items-center justify-between mb-8">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Context Controls</h3>
                                            <button onClick={() => setShowSettings(false)} className="hover:rotate-90 transition-transform"><Icons.X size={16} /></button>
                                        </div>
                                        <div className="space-y-8 mb-8">
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black text-slate-400 tracking-[0.3em] uppercase">Domain</label>
                                                <input 
                                                    className="w-full border-b border-black/10 focus:border-black bg-transparent py-2 text-sm font-bold outline-none transition-all placeholder:text-slate-200"
                                                    value={formData.subject}
                                                    onChange={e => setFormData({...formData, subject: e.target.value})}
                                                    placeholder="Mathematics / Engineering..."
                                                />
                                            </div>
                                            <div className="space-y-4">
                                                <label className="text-[9px] font-black text-slate-400 tracking-[0.3em] uppercase">Density</label>
                                                <div className="flex gap-2">
                                                    {['Concise', 'Exhaustive'].map(opt => (
                                                        <button 
                                                            key={opt}
                                                            onClick={() => setFormData({...formData, difficulty: opt})}
                                                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${formData.difficulty === opt ? 'bg-black text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setShowSettings(false)}
                                            className="w-full py-4 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-slate-800 transition-all"
                                        >
                                            Apply
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}

                {/* 2. THE GHOST WRITER - PROCESSING PHASE */}
                {step === 2 && (
                    <motion.div 
                        key="processing-phase"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="relative h-full w-full flex items-start justify-center p-6 bg-[#fcfcfc] overflow-y-auto"
                        style={{ cursor: 'wait' }}
                    >
                        <div className={`w-full ${isMobile ? 'h-full flex-1' : 'max-w-[850px] min-h-[1100px] my-auto shadow-[0_60px_120px_rgba(0,0,0,0.08)]'} bg-white rounded-sm border border-black/[0.02] p-12 md:p-24 relative overflow-hidden transition-all duration-700`}>
                            {/* Scan Line Effect */}
                            <motion.div 
                                className="absolute left-0 right-0 h-[2px] bg-indigo-500/20 z-10 pointer-events-none shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                                animate={{ top: ['0%', '100%'] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            />

                            {/* Watermark / Header */}
                            <div className="flex justify-between items-start mb-20 border-b-2 border-black pb-8 relative z-20">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">
                                        {questionsQueue[processingIndex]?.text || 'SYNTHESIZING...'}
                                    </h2>
                                    <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-[0.4em]">Draft Registry Alpha | 2026</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-300">Phase Status</p>
                                    <p className="text-xs font-black">{simStage.toUpperCase()}</p>
                                </div>
                            </div>

                            <div className="space-y-20 relative z-20">
                                {/* Section 1: Logic Expansion with Margin Notes */}
                                <div className="space-y-10">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-400">01 Logic Manifest</h3>
                                        <div className="h-[1px] flex-1 bg-slate-100" />
                                    </div>
                                    <div className="space-y-6">
                                        {simulatedAlgorithm.map((stepStr, idx) => (
                                            <div key={idx} className="flex gap-10 group">
                                                <div className="w-12 flex flex-col items-center pt-1 border-r border-slate-50">
                                                    <span className="text-[10px] font-black text-slate-300">0{idx+1}</span>
                                                    {idx === simulatedAlgorithm.length - 1 && isSimulating ? (
                                                        <motion.div 
                                                            animate={{ opacity: [0.2, 1, 0.2] }}
                                                            transition={{ duration: 1, repeat: Infinity }}
                                                            className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" 
                                                        />
                                                    ) : (
                                                        <Icons.CheckCircle size={10} className="text-emerald-400 mt-2" />
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium leading-relaxed italic text-slate-800">{stepStr}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Section 2: Implementation (Matrix Scramble) */}
                                {(simulatedCode || simStage === 'code') && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, ease: editorialEase }}
                                        className="space-y-10"
                                    >
                                        <div className="flex items-center gap-4">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-400">02 Source Blueprint</h3>
                                            <div className="h-[1px] flex-1 bg-slate-100" />
                                        </div>
                                        <div className="relative bg-[#fcfcfc] border border-black/5 rounded-sm p-1">
                                            <div className="bg-white p-8 md:p-12 font-mono selection:bg-indigo-50 min-h-[200px] overflow-x-auto no-scrollbar">
                                                <div className="flex items-center gap-1.5 mb-8 opacity-20">
                                                    <div className="w-2 h-2 rounded-full bg-black" />
                                                    <div className="w-2 h-2 rounded-full bg-black/50" />
                                                    <div className="w-2 h-2 rounded-full bg-black/20" />
                                                </div>
                                                <div className="text-[13px] leading-[1.8] whitespace-pre font-mono text-slate-700 break-all">
                                                    {simulatedCode}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Section 3: Output */}
                                {(simulatedOutput || simStage === 'output') && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, ease: editorialEase }}
                                        className="space-y-10"
                                    >
                                        <div className="flex items-center gap-4">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-400">03 Process Archive</h3>
                                            <div className="h-[1px] flex-1 bg-slate-100" />
                                        </div>
                                        <div className="p-10 bg-black text-white font-mono text-xs leading-loose lowercase rounded-sm shadow-2xl">
                                            {simulatedOutput}
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Sticky Progress Indicator */}
                            <div className="mt-20 pt-10 border-t border-slate-100 flex justify-between items-center text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">
                                <span>Architect's Desk AI</span>
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-2 rounded-full ${isSimulating ? 'bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-emerald-500'}`} />
                                    <span>{isSimulating ? 'Synthesis In Progress' : 'Archive Finalized'}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* 3. THE PDF PREVIEW - REVIEW PHASE */}
                {step === 3 && (
                    <motion.div 
                        key="gallery-phase"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`relative h-full w-full flex items-start justify-center p-6 bg-[#f3f3f3] selection:bg-indigo-100 ${isMobile ? 'overflow-y-auto pt-24' : 'overflow-y-auto'}`}
                    >
                        {/* 3D Flip Page Container */}
                        <div className={`relative w-full ${isMobile ? 'min-h-screen' : 'max-w-[850px] aspect-[1/1.4] my-auto perspective-2000'}`}>
                            {/* Navigation Arrows (Desktop) */}
                            {!isMobile && (
                                <>
                                    <div className="fixed inset-y-0 left-0 flex items-center px-12 z-[100]">
                                        <button 
                                            onClick={() => setActiveReviewIndex(prev => Math.max(0, prev - 1))}
                                            className={`p-6 bg-white shadow-xl rounded-full text-black transition-all active:scale-95 ${activeReviewIndex === 0 ? 'opacity-10 cursor-not-allowed' : 'hover:scale-110'}`}
                                        >
                                            <Icons.ChevronLeft size={32} />
                                        </button>
                                    </div>
                                    <div className="fixed inset-y-0 right-0 flex items-center px-12 z-[100]">
                                        <button 
                                            onClick={() => setActiveReviewIndex(prev => Math.min(solvedAssignments.length - 1, prev + 1))}
                                            className={`p-6 bg-white shadow-xl rounded-full text-black transition-all active:scale-95 ${activeReviewIndex === solvedAssignments.length - 1 ? 'opacity-10 cursor-not-allowed' : 'hover:scale-110'}`}
                                        >
                                            <Icons.ChevronRight size={32} />
                                        </button>
                                    </div>
                                </>
                            )}

                            <AnimatePresence mode="wait">
                                <motion.div 
                                    key={activeReviewIndex}
                                    drag={!isMobile ? "x" : false}
                                    dragDirectionLock={true}
                                    dragConstraints={{ left: 0, right: 0 }}
                                    dragElastic={0.2}
                                    onDragEnd={(e, { offset, velocity }) => {
                                        if (offset.x > 100 && activeReviewIndex > 0) setActiveReviewIndex(activeReviewIndex - 1);
                                        else if (offset.x < -100 && activeReviewIndex < solvedAssignments.length - 1) setActiveReviewIndex(activeReviewIndex + 1);
                                    }}
                                    initial={{ rotateY: 90, opacity: 0, scale: 0.95 }}
                                    animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                                    exit={{ rotateY: -90, opacity: 0, scale: 0.95 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 120, mass: 1 }}
                                    className={`w-full ${isMobile ? 'bg-white shadow-none rounded-none' : 'h-full bg-white shadow-[0_30px_70px_rgba(0,0,0,0.1)] rounded-sm border border-black/[0.05]'} p-8 md:p-20 lg:p-24 overflow-y-auto no-scrollbar relative`}
                                >
                                    {/* Corner Curl SVG (Desktop View Only) */}
                                    {!isMobile && (
                                        <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none group-hover:block hidden">
                                            <div className="absolute top-0 right-0 w-0 h-0 border-t-[40px] border-r-[40px] border-t-transparent border-r-slate-50 shadow-[-5px_5px_10px_rgba(0,0,0,0.05)]" />
                                        </div>
                                    )}

                                    {/* Staggered Content Container */}
                                    <motion.div 
                                        initial="hidden"
                                        animate="visible"
                                        variants={{
                                            visible: { transition: { staggerChildren: 0.15 } }
                                        }}
                                        className="space-y-20"
                                    >
                                        {/* Question Header (Sticky on Mobile) */}
                                        <motion.div 
                                            variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
                                            className={`${isMobile ? 'sticky top-0 bg-white/95 backdrop-blur-md z-30 -mx-8 px-8 py-6 border-b border-slate-100 shadow-sm' : 'flex items-center gap-8 mb-20'}`}
                                        >
                                            <div className={`${isMobile ? 'text-4xl' : 'text-8xl'} font-black text-black/5 leading-none select-none`}>
                                                {(activeReviewIndex + 1).toString().padStart(2, '0')}
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <h2 className={`${isMobile ? 'text-xl' : 'text-4xl'} font-black text-black tracking-tight leading-tight`}>
                                                    {solvedAssignments[activeReviewIndex]?.questionText}
                                                </h2>
                                                <div className="text-[9px] font-mono text-indigo-500 uppercase tracking-widest font-black">Verified Architectural Model</div>
                                            </div>
                                        </motion.div>

                                        <div className={`space-y-24 group/content`}>
                                            {/* Section 1: Logic */}
                                            <motion.div 
                                                variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
                                                className="space-y-10 group-hover/content:opacity-40 hover:!opacity-100 transition-opacity duration-500"
                                            >
                                                <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 border-b border-slate-100 pb-4">Sequence Log</h3>
                                                <div className="space-y-10">
                                                    {solvedAssignments[activeReviewIndex]?.algorithm?.map((stepStr, sIdx) => (
                                                        <div key={sIdx} className="flex gap-10 group/step">
                                                            <span className="text-[10px] font-mono font-bold text-slate-200 group-hover/step:text-black transition-colors pt-1">0{sIdx+1}</span>
                                                            <p className="text-base text-slate-700 leading-relaxed font-medium italic">{stepStr}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>

                                            {/* Section 2: Code (The Spotlight Focus) */}
                                            <motion.div 
                                                variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
                                                className="space-y-10 group/code-block relative"
                                            >
                                                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                                    <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">Syntax Core</h3>
                                                    <div className="text-[9px] font-mono text-slate-300 uppercase tracking-widest">Read Only</div>
                                                </div>
                                                <div className="relative group/syntax rounded-sm overflow-hidden border border-black/5 shadow-sm hover:shadow-xl transition-all duration-500">
                                                    {/* Floating Copy Button */}
                                                    <button 
                                                        onClick={() => handleCopy(solvedAssignments[activeReviewIndex]?.code, activeReviewIndex)}
                                                        className="absolute top-6 right-6 z-10 px-4 py-2 bg-black text-white rounded-full text-[9px] font-black uppercase tracking-widest opacity-0 group-hover/syntax:opacity-100 translate-y-2 group-hover/syntax:translate-y-0 transition-all active:scale-95 flex items-center gap-2"
                                                    >
                                                        {copiedStates[activeReviewIndex] ? <><Icons.Check size={12} /> ARCHIVED</> : <><Icons.Copy size={12} /> CLONE CORE</>}
                                                    </button>
                                                    
                                                    <div className="bg-[#fdfdfd] font-mono">
                                                        <SyntaxHighlighter 
                                                            language="javascript" 
                                                            style={vscDarkPlus}
                                                            customStyle={{ 
                                                                margin: 0, 
                                                                padding: isMobile ? '1.5rem' : '3rem', 
                                                                background: 'transparent', 
                                                                fontSize: isMobile ? '11px' : '14px', 
                                                                lineHeight: '1.8',
                                                                color: '#333'
                                                            }}
                                                            showLineNumbers={!isMobile}
                                                            lineNumberStyle={{ opacity: 0.1, minWidth: '3em' }}
                                                        >
                                                            {solvedAssignments[activeReviewIndex]?.code}
                                                        </SyntaxHighlighter>
                                                    </div>
                                                </div>
                                            </motion.div>

                                            {/* Section 3: Output */}
                                            <motion.div 
                                                variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
                                                className="space-y-10 pb-32 group-hover/content:opacity-40 hover:!opacity-100 transition-opacity duration-500"
                                            >
                                                <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 border-b border-slate-100 pb-4">Runtime Output</h3>
                                                <div className="bg-[#050505] text-[#eee] p-10 font-mono text-[11px] leading-relaxed rounded-sm shadow-2xl border border-white/5">
                                                    <div className="flex items-center gap-3 mb-8 text-[8px] uppercase tracking-[0.4em] font-black text-white/20">
                                                        <div className="flex gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500/50" />
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                                                        </div>
                                                        THREAD_ISOLATION_ACTIVE
                                                    </div>
                                                    <div className="whitespace-pre-wrap">{solvedAssignments[activeReviewIndex]?.output}</div>
                                                </div>
                                            </motion.div>
                                        </div>
                                    </motion.div>

                                    {/* Mobile Bottom Navigation Bar */}
                                    {isMobile && (
                                        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 p-4 pb-[env(safe-area-inset-bottom,1rem)] flex items-center justify-between z-[100]">
                                            <button 
                                                onClick={() => setActiveReviewIndex(prev => Math.max(0, prev - 1))}
                                                disabled={activeReviewIndex === 0}
                                                className="p-3 text-slate-400 disabled:opacity-20"
                                            >
                                                <Icons.ArrowLeft size={20} />
                                            </button>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                Page {activeReviewIndex + 1} / {solvedAssignments.length}
                                            </span>
                                            <button 
                                                onClick={() => setActiveReviewIndex(prev => Math.min(solvedAssignments.length - 1, prev + 1))}
                                                disabled={activeReviewIndex === solvedAssignments.length - 1}
                                                className="p-3 text-slate-400 disabled:opacity-20"
                                            >
                                                <Icons.ArrowRight size={20} />
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {/* Page Indicator (Desktop Shadow-dots) */}
                            {!isMobile && (
                                <div className="absolute -bottom-16 left-1/2 -track-x-1/2 flex gap-3">
                                    {solvedAssignments.map((_, idx) => (
                                        <div 
                                            key={idx}
                                            className={`h-1.5 rounded-full transition-all duration-500 ${activeReviewIndex === idx ? 'bg-black w-8' : 'bg-black/10 w-2'}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Global Errors */}
            <AnimatePresence>
                {error && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="fixed bottom-8 right-8 px-6 py-3 bg-rose-600 text-white rounded-sm text-xs font-black uppercase tracking-widest shadow-2xl z-[100] flex items-center gap-3"
                    >
                        <Icons.AlertCircle size={14} />
                        {error}
                        <button onClick={() => setError(null)}><Icons.X size={14} /></button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
export default AssignmentGenerator;
