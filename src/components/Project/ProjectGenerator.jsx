import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import JSZip from 'jszip';
import { generateProjectBlueprint, expandProjectTask } from '../../utils/projectAI';

const ProjectGenerator = ({ onBack, type = 'Major Project' }) => {
    const [step, setStep] = useState(1); // 1: Config, 2: Blueprint/Kanban
    const [formData, setFormData] = useState({
        topic: '',
        objective: '',
        complexity: 'Intermediate',
        type: type
    });
    const [loading, setLoading] = useState(false);
    const [blueprint, setBlueprint] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [taskExpansion, setTaskExpansion] = useState('');
    const [isExpanding, setIsExpanding] = useState(false);
    const [error, setError] = useState(null);

    const handleArchitect = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await generateProjectBlueprint(formData);
            setBlueprint(data);
            setStep(2);
        } catch (err) {
            console.error(err);
            setError("Project architecture failed. Please refine your vision.");
        } finally {
            setLoading(false);
        }
    };

    const handleExpandTask = async (milestone, task) => {
        setSelectedTask(task);
        setIsExpanding(true);
        setTaskExpansion('');
        try {
            const content = await expandProjectTask(blueprint.projectTitle, milestone, task);
            setTaskExpansion(content);
        } catch (err) {
            setTaskExpansion("Failed to expand task details.");
        } finally {
            setIsExpanding(false);
        }
    };

    const downloadProjectPacket = async () => {
        if (!blueprint) return;
        const zip = new JSZip();

        // Project Overview
        let overview = `# ${blueprint.projectTitle}\n\n`;
        overview += `## Objective\n${formData.objective || formData.topic}\n\n`;
        overview += `## Technical Resources\n${blueprint.resources.join(', ')}\n\n`;
        overview += `## Full Roadmap\n`;
        blueprint.milestones.forEach(m => {
            overview += `### ${m.title}\n${m.description}\n`;
            m.tasks.forEach(t => overview += `- [ ] ${t.task}\n`);
            overview += `\n`;
        });

        zip.file("PROJECT_PLAN.md", overview);

        const blob = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `HOPE_Project_${blueprint.projectTitle.replace(/\s+/g, '_')}.zip`;
        link.click();
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
                className="w-full min-h-screen bg-slate-50 flex flex-col font-inter"
            >
                {/* Header */}
                <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                            <Icons.ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                <Icons.Layers className="text-indigo-600" />
                                Project Designer Pro
                            </h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">Strategic Architectural Blueprinting</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <div className="max-w-7xl mx-auto p-6 lg:p-12">
                        {/* STEP 1: CONFIG */}
                        {step === 1 && (
                            <div className="max-w-4xl mx-auto">
                                <motion.div
                                    className="bg-white rounded-[3rem] p-8 md:p-16 shadow-2xl border border-slate-100 relative overflow-hidden"
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                >
                                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50" />

                                    <div className="relative z-10">
                                        <div className="flex items-center gap-6 mb-12">
                                            <div className="p-5 bg-slate-900 rounded-[2rem] text-white shadow-2xl shadow-slate-200">
                                                <Icons.Box size={40} />
                                            </div>
                                            <div>
                                                <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Project Architect</h3>
                                                <p className="text-slate-400 font-medium">Define your vision and let AI engineer the roadmap.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-10">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] ml-2">Project Topic/Name</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] p-6 text-xl font-bold focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                                                    placeholder="e.g. AI-Powered Inventory System"
                                                    value={formData.topic}
                                                    onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Primary Objective (Optional)</label>
                                                <textarea
                                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] p-6 font-bold focus:outline-none focus:border-indigo-500 transition-all min-h-[120px] shadow-inner"
                                                    placeholder="Describe the main goal or specific requirements..."
                                                    value={formData.objective}
                                                    onChange={e => setFormData({ ...formData, objective: e.target.value })}
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Project Type</label>
                                                    <select
                                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.2rem] p-5 font-bold appearance-none outline-none focus:border-indigo-500"
                                                        value={formData.type}
                                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                                    >
                                                        <option>Mini Project</option>
                                                        <option>Major Project</option>
                                                        <option>Research Paper</option>
                                                        <option>Business Plan</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Scope Complexity</label>
                                                    <select
                                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.2rem] p-5 font-bold appearance-none outline-none focus:border-indigo-500"
                                                        value={formData.complexity}
                                                        onChange={e => setFormData({ ...formData, complexity: e.target.value })}
                                                    >
                                                        <option>MVP (Simple)</option>
                                                        <option>Intermediate</option>
                                                        <option>Advanced Enterprise</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <button
                                                className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-6 rounded-pill font-black text-2xl shadow-2xl shadow-slate-200 transition-all flex items-center justify-center gap-4 active:scale-95 group"
                                                onClick={handleArchitect}
                                                disabled={loading || !formData.topic}
                                            >
                                                {loading ? <Icons.Loader2 className="animate-spin" /> : <><Icons.Sparkles className="group-hover:rotate-12 transition-transform" /> Architect Blueprint</>}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}

                        {/* STEP 2: BLUEPRINT / KANBAN */}
                        {step === 2 && blueprint && (
                            <div className="w-full flex-1 flex flex-col">
                                <div className="px-8 mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-3 py-1 bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg ring-1 ring-indigo-200">Architecture Finalized</span>
                                            <span className="text-slate-300 font-mono text-[10px] uppercase tracking-widest">PRJ-{Math.floor(Math.random() * 90000)}</span>
                                        </div>
                                        <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{blueprint.projectTitle}</h2>
                                    </motion.div>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={downloadProjectPacket}
                                            className="bg-white border-2 border-slate-100 hover:border-indigo-400 text-slate-900 px-6 py-4 rounded-2xl font-black flex items-center gap-3 transition-all active:scale-95 shadow-xl shadow-slate-200/50"
                                        >
                                            <Icons.Download size={20} className="text-indigo-600" /> Generate ZIP Suite
                                        </button>
                                        <button
                                            onClick={() => setStep(1)}
                                            className="bg-slate-900 hover:bg-black text-white px-6 py-4 rounded-2xl font-black transition-all active:scale-95 shadow-xl shadow-slate-900/20"
                                        >
                                            New Project
                                        </button>
                                    </div>
                                </div>

                                {/* Kanban Board Lanes */}
                                <div className="w-full overflow-x-auto pb-20 pt-2 px-8 snap-x snap-mandatory hide-scrollbar">
                                    <motion.div
                                        className="flex gap-6 md:gap-8 w-max min-h-[60vh] pb-8"
                                        initial="hidden"
                                        animate="visible"
                                        variants={{
                                            visible: { transition: { staggerChildren: 0.1 } }
                                        }}
                                    >
                                        {blueprint.milestones.map((m, mIdx) => {
                                            const colors = [
                                                'from-blue-500/20', 'from-purple-500/20',
                                                'from-indigo-500/20', 'from-emerald-500/20',
                                                'from-pink-500/20'
                                            ];
                                            const accents = [
                                                'bg-blue-500', 'bg-purple-500',
                                                'bg-indigo-500', 'bg-emerald-500',
                                                'bg-pink-500'
                                            ];
                                            const colorClass = colors[mIdx % colors.length];
                                            const accentClass = accents[mIdx % accents.length];

                                            return (
                                                <motion.div
                                                    key={mIdx}
                                                    variants={{
                                                        hidden: { opacity: 0, y: 20 },
                                                        visible: { opacity: 1, y: 0 }
                                                    }}
                                                    className="w-[340px] md:w-[400px] flex flex-col gap-5 bg-slate-50/80 backdrop-blur-sm border border-slate-100 rounded-[2.5rem] p-5 shrink-0 snap-center shadow-inner"
                                                >
                                                    {/* Phase Header */}
                                                    <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                                                        <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br ${colorClass} to-transparent blur-2xl transition-transform group-hover:scale-125 duration-700`} />
                                                        <div className="relative z-10">
                                                            <div className="flex items-center gap-3 mb-4">
                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Phase {mIdx + 1}</span>
                                                                <div className={`w-12 h-1 ${accentClass} rounded-full opacity-50`} />
                                                            </div>
                                                            <h4 className="text-2xl font-black tracking-tight mb-3 leading-tight">{m.title}</h4>
                                                            <p className="text-slate-400 text-xs font-bold leading-relaxed">{m.description}</p>
                                                        </div>
                                                    </div>

                                                    {/* Tasks List */}
                                                    <div className="flex-1 space-y-4 overflow-y-auto pr-1 custom-scrollbar">
                                                        {m.tasks.map((t, tIdx) => (
                                                            <motion.div
                                                                key={tIdx}
                                                                whileHover={{ y: -4 }}
                                                                className="bg-white p-6 rounded-2xl shadow-sm border border-transparent hover:border-indigo-100 hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer"
                                                                onClick={() => handleExpandTask(m, t)}
                                                            >
                                                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentClass} rounded-l-2xl transition-all group-hover:w-2`} />
                                                                <div className="flex flex-col gap-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className={`text-[10px] font-black ${accentClass.replace('bg-', 'text-')} px-2.5 py-1 bg-slate-50 rounded-full flex items-center justify-center w-fit border border-slate-100`}>
                                                                            STEP {tIdx + 1}
                                                                        </span>
                                                                        <Icons.ChevronRight size={14} className="text-slate-200 group-hover:text-slate-400 transition-colors" />
                                                                    </div>
                                                                    <span className="text-sm font-bold text-slate-700 leading-snug pr-4">{t.task}</span>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </motion.div>
                                </div>

                                {/* Tech Stack Footer */}
                                <motion.div
                                    initial={{ opacity: 0, y: 40 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-10 mb-20 max-w-6xl mx-auto w-full px-8"
                                >
                                    <div className="bg-white/70 backdrop-blur-2xl border border-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] rounded-[3.5rem] p-12 md:p-16 relative overflow-hidden ring-1 ring-slate-200/50">
                                        {/* Minimalist Background Orbs */}
                                        <div className="absolute top-[-20%] right-[-10%] w-[30%] h-[50%] bg-indigo-100/40 rounded-full blur-[80px] pointer-events-none" />
                                        <div className="absolute bottom-[-20%] left-[-10%] w-[30%] h-[50%] bg-blue-100/40 rounded-full blur-[80px] pointer-events-none" />

                                        <div className="relative z-10">
                                            <div className="flex flex-col items-center text-center mb-12">
                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full uppercase tracking-[0.3em] mb-4 ring-1 ring-indigo-100">AI Component Architecture</span>
                                                <h5 className="text-3xl font-black text-slate-900 tracking-tighter">Technology Blueprint</h5>
                                                <p className="text-slate-500 text-sm font-medium mt-2">The engineering stack utilized for this architectural realization.</p>
                                            </div>

                                            <div className="flex flex-wrap justify-center gap-4">
                                                {blueprint.resources.map((r, i) => (
                                                    <motion.div
                                                        key={i}
                                                        whileHover={{ y: -5, borderColor: '#6366f1', backgroundColor: '#f8fafc' }}
                                                        className="bg-white/80 border-2 border-slate-100 text-slate-700 font-bold px-8 py-5 rounded-[1.5rem] shadow-sm hover:shadow-xl hover:text-indigo-600 transition-all flex items-center gap-3 cursor-default group backdrop-blur-sm"
                                                    >
                                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-200 group-hover:bg-indigo-500 group-hover:scale-125 transition-all" />
                                                        <span className="text-base tracking-tight">{r}</span>
                                                    </motion.div>
                                                ))}
                                            </div>

                                            <div className="mt-16 pt-10 border-t border-slate-100 flex flex-col md:flex-row items-center justify-center gap-12 opacity-80">
                                                <div className="flex items-center gap-4 group">
                                                    <div className="p-3 bg-emerald-50 rounded-2xl group-hover:bg-emerald-100 transition-colors shadow-sm"><Icons.ShieldCheck className="text-emerald-500" size={20} /></div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security & Scale</span>
                                                        <span className="text-xs font-bold text-slate-700">Verified Architecture</span>
                                                    </div>
                                                </div>
                                                <div className="h-8 w-px bg-slate-100 hidden md:block" />
                                                <div className="flex items-center gap-4 group">
                                                    <div className="p-3 bg-amber-50 rounded-2xl group-hover:bg-amber-100 transition-colors shadow-sm"><Icons.Zap className="text-amber-500" size={20} /></div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deployment Logic</span>
                                                        <span className="text-xs font-bold text-slate-700">Atomic Specs Ready</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Page Bottom Spacing for Floating Nav */}
                                <div className="h-40 shrink-0" />
                            </div>
                        )}
                    </div>
                </div>

                {/* TASK EXPANSION MODAL */}
                <AnimatePresence>
                    {selectedTask && (
                        <motion.div
                            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedTask(null)}
                        >
                            <motion.div
                                className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="p-10 border-b border-slate-100">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                                            <Icons.Terminal size={24} />
                                        </div>
                                        <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                                            <Icons.X size={24} />
                                        </button>
                                    </div>
                                    <h4 className="text-3xl font-black text-slate-900 leading-tight mb-2">{selectedTask.task}</h4>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Strategic Execution Protocol</p>
                                </div>
                                <div className="flex-1 p-10 overflow-auto custom-scrollbar bg-slate-50/50">
                                    {isExpanding ? (
                                        <div className="flex flex-col items-center justify-center py-20 space-y-6">
                                            <Icons.Loader2 size={48} className="text-indigo-600 animate-spin" />
                                            <span className="font-black text-slate-400 uppercase tracking-widest text-xs">Generating Technical Specs...</span>
                                        </div>
                                    ) : (
                                        <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed" style={{ whiteSpace: 'pre-line' }}>
                                            {taskExpansion}
                                        </div>
                                    )}
                                </div>
                                <div className="p-8 bg-white border-t border-slate-100 text-center">
                                    <button
                                        className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black w-full shadow-lg"
                                        onClick={() => setSelectedTask(null)}
                                    >
                                        Got it, start working
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    );
};

export default ProjectGenerator;
