
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Lightbulb, Search, Copy, Check } from 'lucide-react';

const NodeDrawer = ({ node, isOpen, onClose, onComplete, isMobile }) => {
    const [scrollProgress, setScrollProgress] = useState(0);
    const [copied, setCopied] = useState(false);
    const contentRef = useRef(null);

    if (!node) return null;

    const { label, eli5_analogy, action_steps, status, detailed_notes, search_keywords } = node.data;

    // Handle scroll progress
    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
        setScrollProgress(progress);
    };

    const copyKeywords = () => {
        if (!search_keywords) return;
        const text = search_keywords.join(', ');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Reset progress when node changes
    useEffect(() => {
        setScrollProgress(0);
    }, [node.id]);

    // Animation variants for the drawer slide-in
    const drawerVariants = isMobile ? {
        hidden: { y: '100%', opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 200 } },
        exit: { y: '100%', opacity: 0 }
    } : {
        hidden: { x: '100%', opacity: 0 },
        visible: { x: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 200 } },
        exit: { x: '100%', opacity: 0 }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] z-[50]"
                    />

                    {/* Drawer */}
                    <motion.div
                        variants={drawerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className={`
                            fixed bg-white z-[60] shadow-2xl flex flex-col
                            ${isMobile
                                ? 'bottom-0 left-0 right-0 h-[85vh] rounded-t-3xl border-t border-slate-200'
                                : 'inset-y-0 right-0 w-[500px] border-l border-slate-200'}
                        `}
                    >
                        {/* Reading Progress Bar */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 z-[70]">
                            <motion.div 
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                                style={{ width: `${scrollProgress}%` }}
                            />
                        </div>

                        {/* Mobile Drag Handle */}
                        {isMobile && (
                            <div className="w-full flex justify-center pt-3 pb-1">
                                <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
                            </div>
                        )}
                        
                        {/* Header */}
                        <div className="p-8 pb-4 flex items-start justify-between">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Mastery Node</span>
                                <h2 className="text-2xl font-black text-slate-900 leading-tight pr-8">{label}</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-800"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div 
                            ref={contentRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto p-8 pt-4 space-y-8 pb-12"
                        >
                            {/* ELI5 Analogy Section */}
                            {eli5_analogy && (
                                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-purple-700 font-bold flex items-center gap-2 text-xs uppercase tracking-widest mb-3">
                                        <Lightbulb className="w-4 h-4" /> The Analogy
                                    </h3>
                                    <p className="text-slate-800 leading-relaxed font-semibold italic">
                                        "{eli5_analogy}"
                                    </p>
                                </div>
                            )}

                            {/* Detailed Study Notes (Mastery) */}
                            {detailed_notes && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                                        Curriculum Deep-Dive
                                    </h3>
                                    <div className="text-slate-600 leading-relaxed space-y-6 text-[15px] font-medium selection:bg-indigo-100 selection:text-indigo-900">
                                        {detailed_notes.split('\n').map((para, i) => 
                                            para.trim() ? (
                                                <p key={i} className="first-letter:text-2xl first-letter:font-bold first-letter:text-indigo-600 first-letter:mr-1">
                                                    {para}
                                                </p>
                                            ) : null
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Study References / Keywords */}
                            {search_keywords && search_keywords.length > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative group">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-slate-700 font-bold flex items-center gap-2 text-xs uppercase tracking-widest">
                                            <div className="p-1 bg-slate-200 rounded-lg"><Search className="w-3.5 h-3.5" /></div>
                                            Expert Keywords
                                        </h3>
                                        <button 
                                            onClick={copyKeywords}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                                copied ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                            }`}
                                        >
                                            {copied ? <Check size={12} /> : <Copy size={12} />}
                                            {copied ? 'Copied' : 'Copy All'}
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {search_keywords.map((kw, i) => (
                                            <div key={i} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 hover:border-indigo-200 hover:bg-indigo-50 transition-all cursor-default">
                                                <span>{kw}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Steps Section */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                                    Phase Mastery Tasks
                                </h3>
                                <div className="space-y-3">
                                    {(action_steps || []).map((step, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-start gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-emerald-100 hover:bg-emerald-50/30 transition-all group"
                                        >
                                            <div className="mt-1 bg-emerald-50 text-emerald-500 rounded-full p-0.5 group-hover:scale-110 transition-transform">
                                                <CheckCircle className="w-5 h-5 fill-current bg-white rounded-full" />
                                            </div>
                                            <span className="text-slate-700 font-bold leading-snug">
                                                {step}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer / Action Button */}
                        <div className="p-8 border-t border-slate-100 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.03)]">
                            {status === 'completed' ? (
                                <div className="w-full py-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl font-bold flex items-center justify-center gap-2">
                                    <CheckCircle className="w-5 h-5" />
                                    Goal Validated
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        onComplete(node.id);
                                        onClose();
                                    }}
                                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl font-bold text-base shadow-xl shadow-slate-100 transition-all duration-300 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                    Certify Completion
                                </button>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default NodeDrawer;

