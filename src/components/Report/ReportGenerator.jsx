import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAICompletion } from '../../utils/aiService';
import { generateReportBlueprint, generateSectionContent, enhanceReportTopic } from '../../utils/reportAI';

const ReportGenerator = ({ onBack }) => {
    const [step, setStep] = useState(1); // 1: Config, 2: Blueprint, 3: Studio
    const [formData, setFormData] = useState({
        topic: '',
        audience: 'University Students',
        tone: 'Academic',
        length: 'Standard',
        customInstructions: '',
        documentFont: 'academic_serif',
        documentSize: 'base'
    });

    const [showAdvanced, setShowAdvanced] = useState(false);

    // UI Constants for Typography
    const fonts = {
        academic_serif: { name: 'Academic Serif', class: 'font-merriweather', family: "'Merriweather', serif" },
        modern_sans: { name: 'Modern Sans', class: 'font-inter', family: "'Inter', sans-serif" },
        handwritten: { name: 'Handwritten', class: 'font-kalam text-blue-800', family: "'Kalam', cursive" }
    };

    const [loading, setLoading] = useState(false);
    const [blueprint, setBlueprint] = useState(null);
    const [outline, setOutline] = useState([]); // Array of { id, heading, intent }
    const [generatedParagraphs, setGeneratedParagraphs] = useState([]);
    const [currentGeneratingIdx, setCurrentGeneratingIdx] = useState(-1);
    const [error, setError] = useState(null);
    const [selectedParaIdx, setSelectedParaIdx] = useState(null);
    const [coPilotInput, setCoPilotInput] = useState('');
    const [isCoPilotLoading, setIsCoPilotLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [showConfigDock, setShowConfigDock] = useState(true);
    const [showOutlineSidebar, setShowOutlineSidebar] = useState(true);
    const [activeDockTab, setActiveDockTab] = useState('config'); // 'config' | 'copilot'
    const [isMobile, setIsMobile] = useState(false);

    // Track screen size
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // On mobile, default sidebars to closed
    useEffect(() => {
        if (isMobile) {
            setShowConfigDock(false);
            setShowOutlineSidebar(false);
        } else {
            setShowConfigDock(true);
            setShowOutlineSidebar(true);
        }
    }, [isMobile]);

    const scrollRef = useRef(null);
    const logContainerRef = useRef(null);

    // Auto-scroll during generation or blueprint adjustment
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [generatedParagraphs, currentGeneratingIdx, outline, step]);

    // Auto-scroll logs
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    const handleEnhanceTopic = async () => {
        if (!formData.topic) return;
        setLoading(true);
        try {
            const enhanced = await enhanceReportTopic(formData.topic);
            setFormData(prev => ({ ...prev, topic: enhanced }));
        } catch (err) {
            console.error("Enhance error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateBlueprint = async () => {
        if (!formData.topic) return;
        setLoading(true);
        setError(null);
        try {
            const bp = await generateReportBlueprint(formData);
            setBlueprint(bp);
            // Ensure each item has a unique ID for React keys and dragging later
            setOutline(bp.blueprint.map((s, idx) => ({ ...s, id: `sec-${idx}` })));
            setStep(2);
            // Automatically open outline sidebar for verification on mobile
            if (isMobile) {
                setShowOutlineSidebar(true);
                setShowConfigDock(false);
            }
        } catch (err) {
            console.error("Blueprint Error:", err);
            setError("Failed to architect the document structure. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateOutlineHeading = (id, newHeading) => {
        setOutline(prev => prev.map(item => item.id === id ? { ...item, heading: newHeading } : item));
    };

    const handleDeleteOutlineItem = (id) => {
        if (outline.length <= 3) return; // Keep minimum sections
        setOutline(prev => prev.filter(item => item.id !== id));
    };

    const handleAddOutlineItem = () => {
        const newId = `sec-${Date.now()}`;
        setOutline(prev => [...prev, { id: newId, heading: "New Section", brief: "Describe the intent for this section..." }]);
    };

    const handleStartWriting = () => {
        setStep(3);
        setActiveDockTab('copilot');
        // Close outline sidebar on mobile to show the canvas
        if (isMobile) {
            setShowOutlineSidebar(false);
        }
        startAgenticWriting();
    };

    const startAgenticWriting = async () => {
        setGeneratedParagraphs([]);
        setLogs([]);
        addLog("Initializing Agentic Orchestrator...", "info");
        setCurrentGeneratingIdx(0);

        let currentParas = [];
        for (let i = 0; i < outline.length; i++) {
            setCurrentGeneratingIdx(i);
            const section = outline[i];
            addLog(`Crafting Section ${i + 1}: ${section.heading}...`, "ai");

            try {
                const content = await generateSectionContent(blueprint.title, section, formData, currentParas);
                const newPara = { ...section, content };
                currentParas = [...currentParas, newPara];
                setGeneratedParagraphs([...currentParas]);
                addLog(`Section ${i + 1} finalized.`, "success");
            } catch (err) {
                console.error(`Error writing section ${i}:`, err);
                addLog(`Critical failure in Section ${i + 1}. Skipping...`, "error");
            }
        }
        setCurrentGeneratingIdx(-1);
        addLog("Research synthesis complete. Document ready for review.", "success");
    };

    const addLog = (message, type = "info") => {
        setLogs(prev => [...prev.slice(-19), { id: Date.now() + Math.random(), message, type, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    };

    const handleRegenerateSection = async (index) => {
        setIsCoPilotLoading(true);
        const section = generatedParagraphs[index];
        addLog(`Regenerating Section: ${section.heading}...`, "ai");
        try {
            const content = await generateSectionContent(blueprint.title, section, formData, generatedParagraphs.slice(0, index));
            const updatedParas = [...generatedParagraphs];
            updatedParas[index] = { ...section, content };
            setGeneratedParagraphs(updatedParas);
            addLog(`Section ${index + 1} successfully regenerated.`, "success");
        } catch (err) {
            console.error("Regeneration error:", err);
            addLog(`Failed to regenerate section ${index + 1}.`, "error");
        } finally {
            setIsCoPilotLoading(false);
        }
    };

    const handleRewriteParagraph = async (index, instruction) => {
        setIsCoPilotLoading(true);
        try {
            const para = generatedParagraphs[index];
            const prompt = `Rewrite this paragraph based on this specific instruction: "${instruction}". 
            Original Topic: "${blueprint.title}"
            Section: "${para.heading}"
            Current Text: "${para.content}"
            
            Return ONLY the new paragraph text. No markdown, no conversational filler.`;

            const response = await getAICompletion([{ role: 'user', content: prompt }]);
            const updatedParas = [...generatedParagraphs];
            updatedParas[index] = { ...para, content: response.trim() };
            setGeneratedParagraphs(updatedParas);
        } catch (err) {
            console.error("Rewrite error:", err);
        } finally {
            setIsCoPilotLoading(false);
        }
    };

    const downloadPDF = () => {
        if (!blueprint || generatedParagraphs.length === 0) return;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 20;

        const addText = (text, size, isBold = false, color = [0, 0, 0]) => {
            doc.setFontSize(size);
            doc.setFont("helvetica", isBold ? "bold" : "normal");
            doc.setTextColor(color[0], color[1], color[2]);
            const splitText = doc.splitTextToSize(text, pageWidth - 40);

            if (y + (splitText.length * (size / 2)) > 280) {
                doc.addPage();
                y = 20;
            }

            doc.text(splitText, 20, y);
            y += splitText.length * (size / 3) + 7;
        };

        // Title
        addText(blueprint.title.toUpperCase(), 24, true, [30, 41, 59]); // Dark slate
        y += 10;

        // Metadata
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generated by HOPE Studio Pro | Date: ${new Date().toLocaleDateString()}`, 20, y);
        y += 15;

        generatedParagraphs.forEach(section => {
            addText(section.heading, 16, true, [79, 70, 229]); // Indigo 600
            addText(section.content, 11, false, [50, 50, 50]);
            y += 5;
        });

        // Page Numbers
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text(`Page ${i} of ${pageCount}`, pageWidth - 40, 285);
        }

        doc.save(`${blueprint.title.replace(/\s+/g, '_')}_Report.pdf`);
    };

    const containerVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
    };

    return (
        <div className="w-full h-screen bg-slate-100 flex flex-col font-inter overflow-hidden">
            {/* Studio Header */}
            <header className="min-h-[72px] md:min-h-[88px] py-3 md:py-4 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between z-[60] shrink-0">
                <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                    <motion.button
                        whileHover={{ scale: 1.1, backgroundColor: '#f1f5f9' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={onBack}
                        className="p-2 rounded-xl transition-colors text-slate-500 hover:text-slate-900 shrink-0"
                    >
                        <Icons.ArrowLeft size={20} />
                    </motion.button>
                    <div className="h-8 w-px bg-slate-200 mx-1 shrink-0" />
                    <div className="min-w-0 flex-shrink">
                        <h2 className="text-xs md:text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-tighter truncate">
                            <Icons.FileText size={16} className="text-indigo-600 shrink-0" />
                            {blueprint?.title || "Untitled Research"}
                        </h2>
                        <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${currentGeneratingIdx !== -1 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'} shrink-0`} />
                            <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">
                                {currentGeneratingIdx !== -1 ? "AI Agent Writing..." : "Studio Ready"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 md:gap-3">
                    <button
                        onClick={() => setShowOutlineSidebar(!showOutlineSidebar)}
                        className={`rounded-xl transition-all ${showOutlineSidebar ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'} ${isMobile ? 'p-2' : 'p-2.5'} min-h-[44px] min-w-[44px] flex items-center justify-center`}
                        title="Toggle Outline"
                    >
                        <Icons.Columns size={18} />
                    </button>
                    <button
                        onClick={() => setShowConfigDock(!showConfigDock)}
                        className={`rounded-xl transition-all ${showConfigDock ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'} ${isMobile ? 'p-2' : 'p-2.5'} min-h-[44px] min-w-[44px] flex items-center justify-center`}
                        title="Toggle Config"
                    >
                        <Icons.Layout size={18} />
                    </button>
                    <div className="h-6 w-px bg-slate-200 mx-1" />
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={downloadPDF}
                        className="flex items-center gap-2 bg-slate-900 text-white px-3 md:px-4 py-2 text-[10px] md:text-xs font-black shadow-lg disabled:opacity-50 shrink-0 whitespace-nowrap"
                        style={{ borderRadius: '12px' }}
                    >
                        <Icons.Download size={14} />
                        <span className="hidden xs:inline">Export</span>
                    </motion.button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: Document Map (Blueprint) */}
                <AnimatePresence>
                    {showOutlineSidebar && (
                        <>
                            {isMobile && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowOutlineSidebar(false)}
                                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
                                />
                            )}
                            <motion.aside
                                initial={isMobile ? { x: '-100%' } : { width: 0, opacity: 0 }}
                                animate={isMobile ? { x: 0 } : { width: 320, opacity: 1 }}
                                exit={isMobile ? { x: '-100%' } : { width: 0, opacity: 0 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className={`bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden ${isMobile ? 'fixed inset-y-0 left-0 z-[110] w-full max-w-xs' : 'relative'}`}
                            >
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Document Outline</h3>
                                    <div className="flex items-center gap-2">
                                        <button onClick={handleAddOutlineItem} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors min-h-[44px] flex items-center">
                                            <Icons.Plus size={16} />
                                        </button>
                                        {isMobile && (
                                            <button onClick={() => setShowOutlineSidebar(false)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors min-h-[44px] flex items-center">
                                                <Icons.X size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                    {outline.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                                            <Icons.LayoutList size={40} className="mb-4" />
                                            <p className="text-xs font-bold uppercase tracking-tight">Outline will appear after configuration</p>
                                        </div>
                                    ) : (
                                        outline.map((section, idx) => (
                                            <motion.div
                                                key={section.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className={`p-4 rounded-2xl border-2 transition-all group ${currentGeneratingIdx === idx ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-100 hover:border-indigo-200'}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span className="text-[10px] font-black text-slate-400 mt-1">{String(idx + 1).padStart(2, '0')}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <input
                                                            className="w-full bg-transparent font-bold text-slate-800 text-sm focus:outline-none"
                                                            value={section.heading}
                                                            onChange={(e) => handleUpdateOutlineHeading(section.id, e.target.value)}
                                                        />
                                                        <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{section.brief}</p>
                                                    </div>
                                                    <button onClick={() => handleDeleteOutlineItem(section.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all">
                                                        <Icons.X size={14} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                                {currentGeneratingIdx === -1 && outline.length > 0 && generatedParagraphs.length === 0 && (
                                    <div className="p-6 border-t border-slate-100">
                                        <button
                                            onClick={handleStartWriting}
                                            className="w-full bg-indigo-600 text-white py-3 text-xs font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 min-h-[44px]"
                                            style={{ borderRadius: '16px' }}
                                        >
                                            <Icons.Zap size={14} />
                                            Finalize & Compile
                                        </button>
                                    </div>
                                )}
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                {/* Center: The A4 Canvas */}
                <main className="flex-1 overflow-y-auto bg-slate-100/80 custom-scrollbar relative pb-24 md:pb-0" ref={scrollRef}>
                    {/* Welcome / Initial Config State */}
                    {!blueprint && (
                        <div className={`flex items-center justify-center p-4 md:p-8 ${isMobile ? 'fixed inset-0 z-[100] bg-slate-50 overflow-y-auto' : 'absolute inset-0 z-10'}`}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`bg-white md:bg-white/70 md:backdrop-blur-2xl border-0 md:border md:border-white shadow-2xl rounded-none md:rounded-[3rem] p-8 md:p-12 pb-safe max-w-2xl w-full text-center ${isMobile ? 'min-h-screen flex flex-col justify-center z-[20] pt-20 md:pt-0' : ''}`}
                            >
                                {isMobile && (
                                    <button
                                        onClick={onBack}
                                        className="absolute top-6 left-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <Icons.ArrowLeft size={24} />
                                    </button>
                                )}
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] text-white flex items-center justify-center mx-auto mb-6 md:mb-8 shadow-2xl shadow-indigo-200">
                                    <Icons.PenTool size={isMobile ? 30 : 40} />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter mb-4">Start Your Research</h2>
                                <p className="text-slate-500 font-medium mb-8 md:mb-10 text-sm md:text-base">Configure your research parameters to generate a high-fidelity document blueprint.</p>
                                <div className="h-px bg-slate-100 w-full mb-8 md:mb-10" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-8 md:mb-10">
                                    <div className="p-4 md:p-6 bg-indigo-50/50 rounded-2xl md:rounded-3xl border border-indigo-100 flex items-center md:block gap-4 md:gap-0">
                                        <div className="p-2 bg-indigo-600 text-white rounded-lg w-fit md:mb-4 shrink-0">
                                            <Icons.Sparkles size={16} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-sm">Agentic Engine</h4>
                                            <p className="text-[10px] text-slate-500 mt-1 font-medium italic">High Intelligence Model</p>
                                        </div>
                                    </div>
                                    <div className="p-4 md:p-6 bg-slate-50/80 rounded-2xl md:rounded-3xl border border-slate-100 flex items-center md:block gap-4 md:gap-0">
                                        <div className="p-2 bg-slate-900 text-white rounded-lg w-fit md:mb-4 shrink-0">
                                            <Icons.Layout size={16} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-sm">Adaptive Layout</h4>
                                            <p className="text-[10px] text-slate-500 mt-1 font-medium italic">Mobile-First Design</p>
                                        </div>
                                    </div>
                                </div>

                                {isMobile && (
                                    <button
                                        onClick={() => {
                                            setShowConfigDock(true);
                                            setActiveDockTab('config');
                                        }}
                                        className="w-full bg-slate-900 text-white py-5 font-black text-lg shadow-xl mt-4 min-h-[50px] mb-8"
                                        style={{ borderRadius: '16px' }}
                                    >
                                        Continue to Config
                                    </button>
                                )}
                            </motion.div>
                        </div>
                    )}

                    <div className="py-10 md:py-20 flex justify-center min-h-full px-0 md:px-4">
                        <motion.div
                            className={`bg-white shadow-[0_0_80px_rgba(0,0,0,0.08)] ring-1 ring-slate-200 w-full max-w-[816px] min-h-screen md:min-h-[1154px] p-6 md:p-24 relative overflow-x-hidden overflow-y-visible transition-all duration-500 rounded-none md:rounded-sm mb-20 md:mb-40`}
                            style={{
                                fontFamily: fonts[formData.documentFont].family,
                                fontSize: formData.documentSize === 'sm' ? '0.875rem' : formData.documentSize === 'base' ? '1rem' : '1.25rem'
                            }}
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {/* Paper Texture Overlay */}
                            <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]"></div>

                            {/* Typography Content */}
                            <div className={`${formData.documentFont === 'handwritten'
                                ? 'font-["Kalam",_cursive] text-blue-900/90 leading-[2.5] tracking-wide'
                                : formData.documentFont === 'academic_serif'
                                    ? 'font-serif text-slate-900 leading-relaxed'
                                    : 'font-sans text-slate-800 leading-relaxed'
                                }`}>
                                <header className={`mb-16 relative ${formData.documentFont === 'academic_serif' ? 'border-b-2 border-slate-900 pb-8' : 'border-b border-slate-100 pb-10'}`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="space-y-2">
                                            <p className={`text-[10px] font-black tracking-[0.4em] uppercase opacity-40 ${formData.documentFont === 'handwritten' ? 'font-sans' : ''}`}>Academic Research Document</p>
                                            <h1 className={`font-black tracking-tighter leading-tight ${formData.documentFont === 'handwritten'
                                                ? 'text-4xl md:text-5xl mb-10 text-blue-900'
                                                : 'text-5xl mb-6 text-slate-900'
                                                }`}>
                                                {blueprint?.title || "Draft Research Synthesis"}
                                            </h1>
                                        </div>
                                        <div className={`text-right ${formData.documentFont === 'handwritten' ? 'font-sans' : ''}`}>
                                            <p className="text-[10px] font-bold opacity-30 uppercase">STUDIO PRO v2.0</p>
                                            <p className="text-xs opacity-40">{new Date().toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </header>

                                <div className="space-y-12 relative min-h-[400px]">
                                    {generatedParagraphs.length === 0 && currentGeneratingIdx === -1 && (
                                        <div className="h-64 flex flex-col items-center justify-center opacity-10">
                                            <Icons.TextCursorInput size={60} />
                                            <p className="font-bold uppercase tracking-widest mt-4">Canvas Empty</p>
                                        </div>
                                    )}

                                    {generatedParagraphs.map((para, idx) => (
                                        <motion.section
                                            key={idx}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className={`relative group cursor-pointer p-6 -m-4 transition-all duration-300 rounded-[2rem] border-2 ${selectedParaIdx === idx ? 'bg-indigo-50/30 border-indigo-100 shadow-[0_0_30px_rgba(99,102,241,0.06)]' : 'hover:bg-slate-50/40 border-transparent'}`}
                                            onClick={() => {
                                                setSelectedParaIdx(idx);
                                                setActiveDockTab('copilot');
                                            }}
                                        >
                                            <h3 className={`font-bold mb-4 flex items-center gap-4 ${formData.documentFont === 'handwritten'
                                                ? 'text-2xl md:text-3xl text-blue-800'
                                                : 'text-2xl text-slate-900'
                                                }`}>
                                                <span className={`w-8 h-[2px] transition-all ${selectedParaIdx === idx ? (formData.documentFont === 'handwritten' ? 'bg-blue-600' : 'bg-indigo-600') : 'bg-slate-200'}`}></span>
                                                {para.heading}
                                            </h3>
                                            <div className={`whitespace-pre-line ${formData.documentFont === 'handwritten'
                                                ? 'text-lg md:text-xl text-blue-900/90'
                                                : 'text-slate-700'
                                                }`}>
                                                {formData.documentFont === 'handwritten'
                                                    ? para.content.replace(/\*\*/g, '').replace(/### /g, '').replace(/## /g, '')
                                                    : para.content
                                                }
                                            </div>
                                            <div className={`absolute -left-6 top-0 h-full w-1.5 transition-all rounded-full ${selectedParaIdx === idx ? (formData.documentFont === 'handwritten' ? 'bg-blue-600' : 'bg-indigo-600') : 'bg-slate-100 opacity-0 group-hover:opacity-100'}`}></div>
                                        </motion.section>
                                    ))}

                                    {currentGeneratingIdx !== -1 && (
                                        <div className="space-y-8 animate-pulse mt-12 pb-20">
                                            <div className="h-8 w-1/3 bg-slate-100 rounded-xl"></div>
                                            <div className="space-y-4">
                                                <div className="h-5 w-full bg-slate-50 rounded-md"></div>
                                                <div className="h-5 w-11/12 bg-slate-50 rounded-md"></div>
                                                <div className="h-5 w-4/5 bg-slate-50 rounded-md"></div>
                                            </div>
                                            <div className="flex items-center gap-3 text-indigo-500 font-bold text-xs uppercase tracking-[0.2em] mt-8 bg-indigo-50/50 w-max px-4 py-2 rounded-full ring-1 ring-indigo-100">
                                                <Icons.Loader2 className="animate-spin" size={14} />
                                                Agent typing...
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className={`mt-32 pt-12 border-t border-slate-100 text-[10px] text-slate-300 font-black tracking-[0.3em] uppercase flex justify-between items-center ${formData.documentFont === 'handwritten' ? 'font-sans' : ''}`}>
                                    <span>CONFIDENTIALLY GENERATED BY HOPE AI</span>
                                    <div className="h-px bg-slate-100 flex-1 mx-8 opacity-50" />
                                    <span>PAGE 01</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </main>

                {/* Right Sidebar: The Dock */}
                <AnimatePresence>
                    {showConfigDock && (
                        <>
                            {isMobile && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowConfigDock(false)}
                                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
                                />
                            )}
                            <motion.aside
                                initial={isMobile ? { x: '100%' } : { width: 0, opacity: 0 }}
                                animate={isMobile ? { x: 0 } : { width: 380, opacity: 1 }}
                                exit={isMobile ? { x: '100%' } : { width: 0, opacity: 0 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className={`bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden ${isMobile ? 'fixed inset-y-0 right-0 z-[110] w-[85vw] max-w-sm' : 'relative'}`}
                            >
                                {/* Tab Switcher */}
                                <div className="p-4 bg-slate-50 flex gap-2 shrink-0">
                                    <button
                                        onClick={() => setActiveDockTab('config')}
                                        className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 min-h-[44px] ${activeDockTab === 'config' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <Icons.Settings size={14} />
                                        Configure
                                    </button>
                                    <button
                                        onClick={() => setActiveDockTab('copilot')}
                                        className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 min-h-[44px] ${activeDockTab === 'copilot' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <Icons.ShieldCheck size={14} />
                                        Co-Pilot
                                    </button>
                                    {isMobile && (
                                        <button onClick={() => setShowConfigDock(false)} className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-xl transition-all min-h-[44px] flex items-center">
                                            <Icons.X size={18} />
                                        </button>
                                    )}
                                </div>

                                <div className="flex-1 flex flex-col overflow-hidden">
                                    {activeDockTab === 'config' ? (
                                        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 md:space-y-10 custom-scrollbar">
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Research Goal</label>
                                                <div className="relative group">
                                                    <textarea
                                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-5 text-sm font-medium focus:bg-white focus:border-indigo-400 transition-all min-h-[140px] resize-none"
                                                        value={formData.topic}
                                                        onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                                        placeholder="Enter your topic..."
                                                    />
                                                    <button
                                                        onClick={handleEnhanceTopic}
                                                        disabled={loading || !formData.topic}
                                                        className="absolute bottom-4 right-4 p-2 bg-white border border-slate-200 rounded-full text-indigo-600 shadow-sm hover:scale-110 transition-transform min-h-[44px] min-w-[44px] flex items-center justify-center"
                                                    >
                                                        {loading ? <Icons.Loader2 className="animate-spin" size={16} /> : <Icons.Sparkles size={16} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Typography</label>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {Object.entries(fonts).map(([key, font]) => (
                                                            <button
                                                                key={key}
                                                                onClick={() => setFormData({ ...formData, documentFont: key })}
                                                                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between group ${formData.documentFont === key ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-50 hover:border-slate-200'}`}
                                                            >
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-slate-900">{font.name}</span>
                                                                    <span className="text-[10px] text-slate-500 font-medium">Professional Standard</span>
                                                                </div>
                                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${formData.documentFont === key ? 'border-indigo-600 bg-indigo-600' : 'border-slate-200'}`}>
                                                                    {formData.documentFont === key && <Icons.Check size={12} className="text-white" />}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-6">
                                                    {[
                                                        { label: 'Audience', key: 'audience', options: ['University Students', 'Professionals', 'General'] },
                                                        { label: 'Tone', key: 'tone', options: ['Academic', 'Analytical', 'Persuasive'] }
                                                    ].map(field => (
                                                        <div key={field.key} className="space-y-3">
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{field.label}</label>
                                                            <select
                                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold appearance-none outline-none focus:border-indigo-400 transition-all cursor-pointer"
                                                                value={formData[field.key]}
                                                                onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                                            >
                                                                {field.options.map(o => <option key={o}>{o}</option>)}
                                                            </select>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleGenerateBlueprint}
                                                disabled={loading || !formData.topic}
                                                className="w-full bg-slate-900 text-white py-5 font-black text-lg shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 mb-6 md:mb-0 min-h-[44px]"
                                                style={{ borderRadius: '16px' }}
                                            >
                                                {loading ? <Icons.Loader2 className="animate-spin" /> : <Icons.Cpu size={20} className="text-indigo-400" />}
                                                {blueprint ? "Update Blueprint" : "Architect Blueprint"}
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 md:space-y-10 custom-scrollbar">
                                                {/* Status Card */}
                                                <div className="bg-indigo-600 rounded-[2.5rem] p-4 md:p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-100 shrink-0">
                                                    <Icons.Cpu className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12" />
                                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-2">System Status</p>
                                                    <h4 className="text-xl md:text-2xl font-black tracking-tight mb-4">Orchestrator Online</h4>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1">
                                                            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    className="h-full bg-emerald-400"
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${(generatedParagraphs.length / (outline.length || 1)) * 100}%` }}
                                                                />
                                                            </div>
                                                            <p className="text-[10px] font-bold mt-2 opacity-80 uppercase tracking-widest">{generatedParagraphs.length} / {outline.length} Sections</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Terminal */}
                                                <div className="space-y-3 shrink-0">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Live Log Stream</p>
                                                    <div ref={logContainerRef} className="bg-slate-900 rounded-[2rem] p-6 h-32 md:h-64 overflow-y-auto font-mono text-[10px] space-y-3 shadow-inner border border-slate-800 custom-scrollbar flex-shrink-0">
                                                        {logs.length === 0 ? <p className="text-slate-600">Idle...</p> : logs.map(l => (
                                                            <div key={l.id} className="flex gap-3 leading-relaxed border-l border-white/5 pl-3">
                                                                <span className="text-slate-500">{l.time}</span>
                                                                <span className={l.type === 'success' ? 'text-emerald-400' : l.type === 'error' ? 'text-rose-400' : l.type === 'ai' ? 'text-indigo-300' : 'text-slate-400'}>{l.message}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Contextual Actions */}
                                                <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 shrink-0">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Contextual Controls</p>
                                                    {selectedParaIdx !== null ? (
                                                        <div className="space-y-4">
                                                            <div className="p-4 bg-white rounded-2xl border border-indigo-100">
                                                                <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">Editing Section</p>
                                                                <p className="text-xs font-bold text-slate-900 truncate">{generatedParagraphs[selectedParaIdx].heading}</p>
                                                            </div>
                                                            <button onClick={() => handleRegenerateSection(selectedParaIdx)} disabled={isCoPilotLoading} className="w-full py-4 bg-white border-2 border-slate-100 text-[10px] font-black text-slate-700 hover:border-indigo-400 flex items-center justify-center gap-2 transition-all min-h-[44px]" style={{ borderRadius: '12px' }}>
                                                                {isCoPilotLoading ? <Icons.Loader2 className="animate-spin" /> : <Icons.RefreshCw size={14} />}
                                                                Regenerate Block
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="h-24 flex flex-col items-center justify-center text-center opacity-30">
                                                            <Icons.MousePointer2 size={24} className="mb-2" />
                                                            <p className="text-[9px] font-bold uppercase">Select block to edit</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Fixed Footer Chat Form */}
                                            <form
                                                className="shrink-0 p-4 pb-10 md:pb-6 border-t border-slate-100 bg-white"
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    if (coPilotInput && selectedParaIdx !== null) {
                                                        handleRewriteParagraph(selectedParaIdx, coPilotInput);
                                                        setCoPilotInput('');
                                                    }
                                                }}
                                            >
                                                <div className="relative">
                                                    <input
                                                        className="w-full bg-slate-100 border-2 border-transparent focus:bg-white focus:border-indigo-400 rounded-2xl py-4 pl-5 pr-14 text-sm font-medium transition-all shadow-inner disabled:opacity-50"
                                                        placeholder={selectedParaIdx !== null ? "Refine this block..." : "Select block first..."}
                                                        value={coPilotInput}
                                                        onChange={e => setCoPilotInput(e.target.value)}
                                                        disabled={selectedParaIdx === null || isCoPilotLoading}
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={!coPilotInput || selectedParaIdx === null || isCoPilotLoading}
                                                        className="absolute right-2 top-2 p-2.5 bg-slate-900 text-white hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                                        style={{ borderRadius: '12px' }}
                                                    >
                                                        {isCoPilotLoading ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.Send size={18} />}
                                                    </button>
                                                </div>
                                            </form>
                                        </>
                                    )}
                                </div>
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                {/* Mobile Bottom Navigation Bar */}
                {isMobile && (
                    <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 h-20 pb-safe z-[60] px-6 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.05)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                        {outline.length > 0 && (
                            <button
                                onClick={() => {
                                    setShowOutlineSidebar(true);
                                    setShowConfigDock(false);
                                }}
                                className={`flex flex-col items-center gap-1.5 transition-all ${showOutlineSidebar ? 'text-indigo-600' : 'text-slate-400'}`}
                            >
                                <Icons.Columns size={20} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Outline</span>
                            </button>
                        )}
                        {outline.length > 0 && <div className="h-10 w-px bg-slate-100 mx-2" />}

                        <button
                            onClick={() => {
                                setShowOutlineSidebar(false);
                                setShowConfigDock(false);
                            }}
                            className={`flex flex-col items-center gap-1.5 transition-all ${!showOutlineSidebar && !showConfigDock ? 'text-indigo-600' : 'text-slate-400'}`}
                        >
                            <Icons.FileText size={20} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Canvas</span>
                        </button>

                        <div className="h-10 w-px bg-slate-100 mx-2" />

                        <button
                            onClick={() => {
                                setShowConfigDock(true);
                                setShowOutlineSidebar(false);
                                setActiveDockTab('copilot');
                            }}
                            className={`flex flex-col items-center gap-1.5 transition-all ${showConfigDock && activeDockTab === 'copilot' ? 'text-indigo-600' : 'text-slate-400'}`}
                        >
                            <div className="relative">
                                <Icons.Zap size={20} />
                                {currentGeneratingIdx !== -1 && (
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse border-2 border-white" />
                                )}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest">Co-Pilot</span>
                        </button>

                        <div className="h-10 w-px bg-slate-100 mx-2" />

                        <button
                            onClick={() => {
                                setShowConfigDock(true);
                                setShowOutlineSidebar(false);
                                setActiveDockTab('config');
                            }}
                            className={`flex flex-col items-center gap-1.5 transition-all ${showConfigDock && activeDockTab === 'config' ? 'text-indigo-600' : 'text-slate-400'}`}
                        >
                            <Icons.Settings size={20} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Config</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportGenerator;
