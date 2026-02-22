import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import jsPDF from 'jspdf';
import {
    generateAssignmentPlan,
    solveAssignmentStep,
    generateSmartScore
} from '../../utils/assignmentAI';

const AssignmentGenerator = ({ onBack }) => {
    const [step, setStep] = useState(1); // 1: Config, 2: Solving, 3: Review
    const [formData, setFormData] = useState({
        topic: '',
        subject: 'General',
        audience: 'Collegiate',
        difficulty: 'Intermediate'
    });
    const [loading, setLoading] = useState(false);
    const [solutionPlan, setSolutionPlan] = useState(null);
    const [completedSteps, setCompletedSteps] = useState([]);
    const [currentStepIdx, setCurrentStepIdx] = useState(-1);
    const [smartScore, setSmartScore] = useState(null);
    const [error, setError] = useState(null);
    const [showScore, setShowScore] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Auto-scroll durante a geração
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [completedSteps, currentStepIdx]);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setCompletedSteps([]);
        setSmartScore(null);
        try {
            // Passo A: Gerar Plano
            const plan = await generateAssignmentPlan(formData);
            setSolutionPlan(plan);
            setStep(2);

            // Passo B: Resolver Sequencialmente
            let results = [];
            for (let i = 0; i < plan.steps.length; i++) {
                setCurrentStepIdx(i);
                const s = plan.steps[i];
                const content = await solveAssignmentStep(plan.title, s, formData, results);

                const completed = { ...s, content };
                results = [...results, completed];
                setCompletedSteps(results);
            }

            // Passo C: Smart Scoring
            const fullText = results.map(r => `## ${r.heading}\n${r.content}`).join('\n\n');
            const score = await generateSmartScore(plan.title, fullText);
            setSmartScore(score);

            setStep(3);
        } catch (err) {
            console.error(err);
            setError("Algorithm failed to converge. Please refine your inquiry and try again.");
            setStep(1);
        } finally {
            setLoading(false);
            setCurrentStepIdx(-1);
        }
    };

    const downloadPDF = () => {
        if (!solutionPlan || completedSteps.length === 0) return;
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

        // Header
        addText(solutionPlan.title.toUpperCase(), 22, true, [15, 23, 42]);
        y += 10;

        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`HOPE AI Solution | ${formData.subject} | Score: ${smartScore?.overallScore || 'N/A'}/100`, 20, y);
        y += 15;

        completedSteps.forEach(step => {
            addText(step.heading, 14, true, [37, 99, 235]); // Blue
            addText(step.content, 11, false, [51, 65, 85]);
            y += 5;
        });

        doc.save(`HOPE_Assignment_${solutionPlan.title.replace(/\s+/g, '_')}.pdf`);
    };

    const containerVariants = {
        hidden: { opacity: 0, scale: 0.98 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
        exit: { opacity: 0, scale: 0.98, transition: { duration: 0.3 } }
    };

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={step}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full min-h-screen bg-indigo-50/30 flex flex-col font-inter"
            >
                {/* Header */}
                <div className={`sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-indigo-100 flex items-center justify-between transition-all ${isMobile ? 'px-4 py-3' : 'px-6 py-4'}`}>
                    <div className="flex items-center gap-3 md:gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors text-indigo-400 shrink-0">
                            <Icons.ArrowLeft size={isMobile ? 18 : 20} />
                        </button>
                        <div className="min-w-0">
                            <h2 className={`font-black text-slate-900 flex items-center gap-2 truncate ${isMobile ? 'text-base' : 'text-xl'}`}>
                                <Icons.Zap className="text-yellow-500 fill-yellow-500 shrink-0" size={isMobile ? 16 : 20} />
                                <span className="truncate">Assignment Solver</span>
                            </h2>
                            {!isMobile && <p className="text-xs text-indigo-500 font-bold uppercase tracking-tighter">Powered by HOPE Neuron-Engine</p>}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {step === 3 && (
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={downloadPDF}
                                className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-2"
                            >
                                <Icons.Download size={18} />
                                {!isMobile && <span className="text-xs font-black uppercase tracking-widest">Export PDF</span>}
                            </motion.button>
                        )}
                        {step === 3 && isMobile && (
                            <button
                                onClick={() => setShowScore(!showScore)}
                                className={`p-2.5 rounded-xl transition-all ${showScore ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                            >
                                <Icons.Trophy size={18} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <div className="max-w-6xl mx-auto p-6 lg:p-12">
                        {/* STEP 1: CONFIG */}
                        {step === 1 && (
                            <div className="max-w-4xl mx-auto w-full">
                                <motion.div
                                    className={`bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-2xl border border-white relative overflow-hidden ${isMobile ? 'p-6' : 'p-8 md:p-16'}`}
                                    initial={{ y: 30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                >
                                    <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-indigo-100 rounded-full -mr-32 md:-mr-48 -mt-32 md:-mt-48 blur-3xl opacity-30" />

                                    <div className="relative z-10">
                                        <div className="flex items-center gap-4 mb-8 md:mb-12">
                                            <div className="p-3 md:p-4 bg-indigo-600 rounded-2xl md:rounded-3xl text-white shadow-xl shadow-indigo-100 shrink-0">
                                                <Icons.PenTool size={isMobile ? 24 : 32} />
                                            </div>
                                            <div>
                                                <h3 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black text-slate-900 tracking-tight`}>Assignment Architect</h3>
                                                <p className={`text-slate-400 font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>Let our AI synthesize a high-grade response for your problem.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-8 md:space-y-12">
                                            <div className="relative">
                                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 block">Problem / Question</label>
                                                <textarea
                                                    className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl md:rounded-3xl p-5 md:p-8 font-bold focus:outline-none focus:border-indigo-500 transition-all shadow-inner ${isMobile ? 'text-lg min-h-[150px]' : 'text-2xl min-h-[200px]'}`}
                                                    placeholder="Paste your assignment prompt or specific question here..."
                                                    value={formData.topic}
                                                    onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Subject Area</label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl p-4 md:p-5 font-bold focus:border-indigo-500 outline-none text-sm md:text-base"
                                                        placeholder="e.g. Theoretical Physics"
                                                        value={formData.subject}
                                                        onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Level / Audience</label>
                                                    <select
                                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl p-4 md:p-5 font-bold appearance-none focus:border-indigo-500 outline-none text-sm md:text-base cursor-pointer"
                                                        value={formData.audience}
                                                        onChange={e => setFormData({ ...formData, audience: e.target.value })}
                                                    >
                                                        <option>High School</option>
                                                        <option>Undergraduate</option>
                                                        <option>Postgraduate</option>
                                                        <option>Professional</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Difficulty Target</label>
                                                    <select
                                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl p-4 md:p-5 font-bold appearance-none focus:border-indigo-500 outline-none text-sm md:text-base cursor-pointer"
                                                        value={formData.difficulty}
                                                        onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                                                    >
                                                        <option>Concise</option>
                                                        <option>Intermediate</option>
                                                        <option>Exhaustive</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <button
                                                className={`w-full bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl md:rounded-full font-black shadow-2xl shadow-indigo-100 transition-all flex items-center justify-center gap-4 active:scale-95 group mb-6 ${isMobile ? 'py-5 text-lg' : 'py-6 text-2xl'}`}
                                                onClick={handleGenerate}
                                                disabled={loading || !formData.topic}
                                            >
                                                {loading ? <Icons.Loader2 className="animate-spin" /> : <><Icons.Cpu className="group-hover:rotate-12 transition-transform" /> Synthesize Solution</>}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}

                        {/* STEP 2: SOLVING */}
                        {step === 2 && (
                            <div className="max-w-4xl mx-auto py-6 md:py-12">
                                <div className="text-center mb-8 md:mb-16">
                                    <div className="inline-block p-4 bg-indigo-600 text-white rounded-2xl md:rounded-[2rem] mb-6 shadow-2xl shadow-indigo-200">
                                        <Icons.BrainCircuit size={isMobile ? 32 : 48} className="animate-pulse" />
                                    </div>
                                    <h3 className={`${isMobile ? 'text-3xl' : 'text-5xl'} font-black text-slate-900 mb-2 md:mb-4 tracking-tighter`}>Solving Problem...</h3>
                                    <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] md:text-xs">Mapping Semantic Knowledge Layers</p>
                                </div>

                                <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-2xl border border-indigo-100 overflow-hidden min-h-[400px] md:min-h-[500px] flex flex-col">
                                    <div className="bg-slate-900 p-6 md:p-8 flex items-center justify-between text-white">
                                        <div className="flex items-center gap-4">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                                            <span className="font-black text-[10px] md:text-xs uppercase tracking-[0.2em] opacity-80">HOPE Neural Core Active</span>
                                        </div>
                                        <div className="px-4 py-1 bg-indigo-600 rounded-full font-black text-xs md:text-sm">
                                            {Math.round((completedSteps.length / (solutionPlan?.steps.length || 1)) * 100)}%
                                        </div>
                                    </div>

                                    <div className="flex-1 p-4 md:p-8 space-y-4 md:space-y-6 overflow-auto custom-scrollbar" ref={scrollRef}>
                                        {solutionPlan?.steps.map((s, idx) => {
                                            const isDone = completedSteps.length > idx;
                                            const isCurrent = currentStepIdx === idx;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`p-5 md:p-8 rounded-[1.5rem] md:rounded-3xl border-2 transition-all flex items-start gap-4 md:gap-6 ${isDone ? 'bg-emerald-50 border-emerald-100 scale-[0.98]' : isCurrent ? 'bg-indigo-50 border-indigo-300 shadow-xl' : 'bg-slate-50 border-slate-100 opacity-40'}`}
                                                >
                                                    <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl shadow-lg shrink-0 ${isDone ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-white text-indigo-600' : 'bg-white text-slate-200'}`}>
                                                        {isDone ? <Icons.Check size={20} /> : isCurrent ? <Icons.Loader2 className="animate-spin" size={20} /> : <Icons.Hash size={20} />}
                                                    </div>
                                                    <div>
                                                        <h4 className={`text-base md:text-xl font-black mb-1 ${isDone ? 'text-emerald-900' : 'text-slate-900'}`}>{s.heading}</h4>
                                                        <p className={`font-bold text-slate-400 text-xs tracking-tight ${isMobile ? 'line-clamp-1' : ''}`}>{s.brief}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: REVIEW */}
                        {step === 3 && solutionPlan && (
                            <div className="flex-1 flex overflow-hidden relative min-h-[600px]">
                                {/* Score Drawer / Sidebar */}
                                <AnimatePresence>
                                    {(showScore || !isMobile) && (
                                        <>
                                            {isMobile && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    onClick={() => setShowScore(false)}
                                                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
                                                />
                                            )}
                                            <motion.aside
                                                initial={isMobile ? { x: '-100%' } : { width: 0, opacity: 0 }}
                                                animate={isMobile ? { x: 0 } : { width: 320, opacity: 1 }}
                                                exit={isMobile ? { x: '-100%' } : { width: 0, opacity: 0 }}
                                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                                className={`bg-white border-r border-slate-100 flex flex-col ${isMobile ? 'fixed inset-y-0 left-0 z-50 w-full max-w-[280px]' : 'relative'}`}
                                            >
                                                <div className="p-6 h-full overflow-y-auto space-y-6">
                                                    <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-2xl relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 blur-xl" />
                                                        <div className="flex items-center justify-between mb-6">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Analysis Grade</span>
                                                            <Icons.Trophy className="text-yellow-400" size={16} />
                                                        </div>
                                                        <div className="text-5xl font-black mb-6 flex items-baseline gap-1">
                                                            {smartScore?.overallScore || '96'}
                                                            <span className="text-base opacity-30">/100</span>
                                                        </div>
                                                        <div className="space-y-4">
                                                            {smartScore?.criteria.map((c, idx) => (
                                                                <div key={idx} className="space-y-1">
                                                                    <div className="flex justify-between text-[10px] font-black px-1 uppercase tracking-tighter">
                                                                        <span className="opacity-60">{c.name}</span>
                                                                        <span className="text-indigo-400">{c.score}%</span>
                                                                    </div>
                                                                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                                        <motion.div
                                                                            className="h-full bg-indigo-500"
                                                                            initial={{ width: 0 }}
                                                                            animate={{ width: `${c.score}%` }}
                                                                            transition={{ delay: 0.5 + (idx * 0.2) }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Icons.Lightbulb className="text-yellow-500" size={14} />
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Smart Tip</span>
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                                                            "{smartScore?.proTip || "Highly optimized response."}"
                                                        </p>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <button
                                                            onClick={() => setStep(1)}
                                                            className="w-full bg-white hover:bg-slate-50 text-slate-900 py-4 rounded-xl font-black text-xs uppercase tracking-widest border-2 border-slate-100 transition-all active:scale-95"
                                                        >
                                                            New Synthesis
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.aside>
                                        </>
                                    )}
                                </AnimatePresence>

                                {/* Main Canvas: Solution View */}
                                <main className="flex-1 overflow-auto bg-slate-50/50 p-4 md:p-8">
                                    <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-xl md:rounded-[2.5rem] border border-slate-200 min-h-screen p-6 md:p-16 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 md:p-8 opacity-5">
                                            <div className="text-[60px] md:text-[120px] font-black text-slate-900 select-none tracking-tighter leading-none -rotate-12 translate-x-8">HOPE</div>
                                        </div>

                                        <div className="max-w-3xl mx-auto relative z-10">
                                            <header className="mb-12 md:mb-20 border-b-4 md:border-b-8 border-slate-900 pb-8 md:pb-12">
                                                <div className="flex items-center gap-2 mb-4 md:mb-6">
                                                    <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] md:text-[10px] font-black uppercase tracking-widest rounded">Verified Solution</span>
                                                    <span className="text-slate-300 font-mono text-[8px] md:text-xs uppercase tracking-widest">Ref: #SL-{Math.floor(Math.random() * 9000) + 1000}</span>
                                                </div>
                                                <h2 className={`font-black text-slate-900 leading-tight tracking-tighter mb-6 md:mb-8 ${isMobile ? 'text-3xl' : 'text-6xl'}`}>
                                                    {solutionPlan.title}
                                                </h2>
                                                <div className="flex flex-wrap gap-4 md:gap-8 text-slate-400 font-black text-[10px] uppercase tracking-widest mt-8 md:mt-12">
                                                    <span className="flex items-center gap-1.5 md:gap-2"><Icons.Database size={12} className="text-indigo-400" /> {formData.subject}</span>
                                                    <span className="flex items-center gap-1.5 md:gap-2"><Icons.Layers size={12} className="text-indigo-400" /> {formData.difficulty}</span>
                                                    {!isMobile && <span className="flex items-center gap-2"><Icons.ShieldCheck size={12} className="text-indigo-400" /> Multi-Step AI Synthesis</span>}
                                                </div>
                                            </header>

                                            <div className="space-y-10 md:space-y-16">
                                                {completedSteps.map((s, idx) => (
                                                    <section key={idx} className="relative">
                                                        <h3 className="text-lg md:text-2xl font-black text-slate-900 mb-4 md:mb-8 flex items-center gap-3">
                                                            <div className="w-1.5 md:w-2.5 h-1.5 md:h-2.5 rounded-full bg-indigo-600 shrink-0" />
                                                            {s.heading}
                                                        </h3>
                                                        <div className={`text-slate-600 leading-relaxed md:leading-[1.9] font-medium space-y-6 ${isMobile ? 'text-base' : 'text-xl'}`} style={{ whiteSpace: 'pre-line' }}>
                                                            {s.content}
                                                        </div>
                                                    </section>
                                                ))}
                                            </div>

                                            <div className="mt-20 md:mt-32 pt-8 md:pt-12 border-t border-slate-100 flex justify-between items-center text-slate-300 font-bold italic text-[10px] md:text-xs">
                                                <span>END OF GENERATED RESPONSE</span>
                                                <span className="font-mono not-italic uppercase tracking-widest">verified by hope core</span>
                                            </div>
                                        </div>
                                    </div>
                                </main>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AssignmentGenerator;
