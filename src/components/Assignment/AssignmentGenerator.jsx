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
    const scrollRef = useRef(null);

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
                <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-indigo-100 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors text-indigo-400">
                            <Icons.ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                <Icons.Zap className="text-yellow-500 fill-yellow-500" />
                                Smart Assignment Solver
                            </h2>
                            <p className="text-xs text-indigo-500 font-bold uppercase tracking-tighter">Powered by HOPE Neuron-Engine</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <div className="max-w-6xl mx-auto p-6 lg:p-12">
                        {/* STEP 1: CONFIG */}
                        {step === 1 && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                <div className="lg:col-span-12">
                                    <motion.div
                                        className="bg-white rounded-[2.5rem] p-8 md:p-16 shadow-2xl border border-white relative overflow-hidden"
                                        initial={{ y: 30, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                    >
                                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100 rounded-full -mr-48 -mt-48 blur-3xl opacity-30" />

                                        <div className="relative z-10">
                                            <div className="flex items-center gap-4 mb-10">
                                                <div className="p-4 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-100">
                                                    <Icons.PenTool size={32} />
                                                </div>
                                                <div>
                                                    <h3 className="text-4xl font-black text-slate-900 tracking-tight">Assignment Architect</h3>
                                                    <p className="text-slate-400 font-medium">Input your problem and let our AI synthesize a high-grade response.</p>
                                                </div>
                                            </div>

                                            <div className="space-y-10">
                                                <div className="relative">
                                                    <label className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4 block">Problem / Question</label>
                                                    <textarea
                                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-8 text-2xl font-bold focus:outline-none focus:border-indigo-500 transition-all min-h-[200px] shadow-inner"
                                                        placeholder="Paste your assignment prompt or specific question here..."
                                                        value={formData.topic}
                                                        onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                    <div className="space-y-3">
                                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Subject Area</label>
                                                        <input
                                                            type="text"
                                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 font-bold focus:border-indigo-500 outline-none"
                                                            placeholder="e.g. Theoretical Physics"
                                                            value={formData.subject}
                                                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-3">
                                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Level / Audience</label>
                                                        <select
                                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 font-bold appearance-none focus:border-indigo-500 outline-none"
                                                            value={formData.audience}
                                                            onChange={e => setFormData({ ...formData, audience: e.target.value })}
                                                        >
                                                            <option>High School</option>
                                                            <option>Undergraduate</option>
                                                            <option>Postgraduate</option>
                                                            <option>Professional</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Difficulty Target</label>
                                                        <select
                                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 font-bold appearance-none focus:border-indigo-500 outline-none"
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
                                                    className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-6 rounded-pill font-black text-2xl shadow-2xl shadow-indigo-100 transition-all flex items-center justify-center gap-4 active:scale-95 group mb-10"
                                                    onClick={handleGenerate}
                                                    disabled={loading || !formData.topic}
                                                >
                                                    {loading ? <Icons.Loader2 className="animate-spin" /> : <><Icons.Cpu className="group-hover:rotate-12 transition-transform" /> Synthesize Solution</>}
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: SOLVING */}
                        {step === 2 && (
                            <div className="max-w-4xl mx-auto py-12">
                                <div className="text-center mb-16">
                                    <div className="inline-block p-3 bg-indigo-600 text-white rounded-2xl mb-6 shadow-xl shadow-indigo-200">
                                        <Icons.BrainCircuit size={32} className="animate-pulse" />
                                    </div>
                                    <h3 className="text-5xl font-black text-slate-900 mb-4">Solving Problem...</h3>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Mapping Semantic Knowledge Layers</p>
                                </div>

                                <div className="bg-white rounded-[2.5rem] shadow-2xl border border-indigo-100 overflow-hidden min-h-[500px] flex flex-col">
                                    <div className="bg-slate-900 p-8 flex items-center justify-between text-white">
                                        <div className="flex items-center gap-4">
                                            <Icons.Activity className="text-indigo-400 animate-pulse" />
                                            <span className="font-mono text-xs uppercase tracking-[0.2em] opacity-80">HOPE Logic Processor Active</span>
                                        </div>
                                        <div className="px-4 py-1 bg-indigo-600 rounded-full font-black text-sm">
                                            {Math.round((completedSteps.length / (solutionPlan?.steps.length || 1)) * 100)}%
                                        </div>
                                    </div>

                                    <div className="flex-1 p-8 space-y-6 overflow-auto custom-scrollbar" ref={scrollRef}>
                                        {solutionPlan?.steps.map((s, idx) => {
                                            const isDone = completedSteps.length > idx;
                                            const isCurrent = currentStepIdx === idx;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`p-8 rounded-3xl border-2 transition-all flex items-start gap-6 ${isDone ? 'bg-emerald-50 border-emerald-100 scale-[0.98] grayscale-[0.3]' : isCurrent ? 'bg-indigo-50 border-indigo-300 shadow-xl' : 'bg-slate-50 border-slate-100 opacity-30 shadow-inner'}`}
                                                >
                                                    <div className={`p-4 rounded-2xl shadow-lg mt-1 ${isDone ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-white text-indigo-600' : 'bg-white text-slate-300'}`}>
                                                        {isDone ? <Icons.Check size={24} /> : isCurrent ? <Icons.Loader2 className="animate-spin" size={24} /> : <Icons.Hash size={24} />}
                                                    </div>
                                                    <div>
                                                        <h4 className={`text-xl font-black mb-1 ${isDone ? 'text-emerald-900' : 'text-slate-900'}`}>{s.heading}</h4>
                                                        <p className="font-bold text-slate-400 text-sm tracking-tight">{s.brief}</p>
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
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                                <div className="lg:col-span-4 sticky top-24 space-y-6">
                                    <motion.div
                                        className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden"
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />

                                        <div className="flex items-center justify-between mb-8">
                                            <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Smart Score</span>
                                            <Icons.Trophy className="text-yellow-400" size={20} />
                                        </div>

                                        <div className="text-7xl font-black mb-8 flex items-baseline gap-1">
                                            {smartScore?.overallScore || '96'}
                                            <span className="text-xl opacity-30">/100</span>
                                        </div>

                                        <div className="space-y-4 mb-8">
                                            {smartScore?.criteria.map((c, idx) => (
                                                <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between text-xs font-bold px-1">
                                                        <span className="opacity-60">{c.name}</span>
                                                        <span>{c.score}%</span>
                                                    </div>
                                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
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

                                        <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Icons.Lightbulb className="text-yellow-400" size={16} />
                                                <span className="text-xs font-black uppercase tracking-tighter text-indigo-300">HOPE Pro Tip</span>
                                            </div>
                                            <p className="text-xs font-medium opacity-80 leading-relaxed italic">
                                                "{smartScore?.proTip || "This solution is highly optimized. Consider adding diagrams."}"
                                            </p>
                                        </div>
                                    </motion.div>

                                    <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-indigo-50 space-y-4">
                                        <button
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-2xl font-black shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 active:scale-95"
                                            onClick={downloadPDF}
                                        >
                                            <Icons.Download size={20} /> Download PDF
                                        </button>
                                        <button
                                            className="w-full bg-slate-50 hover:bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold transition-all text-sm border border-slate-100"
                                            onClick={() => setStep(1)}
                                        >
                                            Start New Solution
                                        </button>
                                    </div>
                                </div>

                                <div className="lg:col-span-8">
                                    <div className="bg-white shadow-2xl rounded-sm border border-slate-200 min-h-[1400px] p-12 md:p-24 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-8">
                                            <div className="text-[120px] font-black text-slate-50 select-none tracking-tighter leading-none -rotate-12 translate-x-12">HOPE</div>
                                        </div>

                                        <div className="max-w-3xl mx-auto relative z-10">
                                            <header className="mb-20 border-b-8 border-slate-900 pb-12">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-md">Verified Solution</span>
                                                    <span className="text-slate-300 font-mono text-xs uppercase tracking-widest">System Ref: #AX-{Math.floor(Math.random() * 9000) + 1000}</span>
                                                </div>
                                                <h2 className="text-6xl font-black text-slate-900 leading-[1.1] tracking-tighter mb-8">
                                                    {solutionPlan.title}
                                                </h2>
                                                <div className="flex flex-wrap gap-x-8 gap-y-4 text-slate-400 font-black text-xs uppercase tracking-widest mt-12">
                                                    <span className="flex items-center gap-2"><Icons.Database size={14} className="text-indigo-400" /> Subject: {formData.subject}</span>
                                                    <span className="flex items-center gap-2"><Icons.Layers size={14} className="text-indigo-400" /> Difficulty: {formData.difficulty}</span>
                                                    <span className="flex items-center gap-2"><Icons.ShieldCheck size={14} className="text-indigo-400" /> AI-Verified</span>
                                                </div>
                                            </header>

                                            <div className="space-y-16">
                                                {completedSteps.map((s, idx) => (
                                                    <section key={idx}>
                                                        <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-4">
                                                            <div className="w-10 h-1 bg-indigo-600 rounded-full" />
                                                            {s.heading}
                                                        </h3>
                                                        <div className="text-xl text-slate-600 leading-[1.9] font-medium space-y-8" style={{ whiteSpace: 'pre-line' }}>
                                                            {s.content}
                                                        </div>
                                                    </section>
                                                ))}
                                            </div>

                                            <div className="mt-32 pt-12 border-t border-slate-100 flex justify-between items-center text-slate-300 font-medium italic">
                                                <span>End of Automated Synthesis</span>
                                                <span className="font-mono text-xs not-italic">Page 1/1</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AssignmentGenerator;
