
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Lightbulb } from 'lucide-react';

const NodeDrawer = ({ node, isOpen, onClose, onComplete }) => {
    if (!node) return null;

    const { label, eli5_analogy, action_steps, status } = node.data;

    // Animation variants for the drawer slide-in
    const drawerVariants = {
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
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[50]"
                    />

                    {/* Drawer */}
                    <motion.div
                        variants={drawerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white border-l border-gray-200 z-[60] shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-8 pb-4 flex items-start justify-between">
                            <h2 className="text-2xl font-extrabold text-slate-900 leading-tight pr-8">{label}</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-800"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-8">

                            {/* ELI5 Analogy Section */}
                            {eli5_analogy && (
                                <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-purple-700 font-bold flex items-center gap-2 text-sm uppercase tracking-widest mb-3">
                                        <Lightbulb className="w-4 h-4" /> The Analogy
                                    </h3>
                                    <p className="text-slate-700 leading-relaxed font-medium">
                                        {eli5_analogy}
                                    </p>
                                </div>
                            )}

                            {/* Action Steps Section */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-slate-800">Your Baby Steps</h3>
                                <div className="space-y-2">
                                    {(action_steps || []).map((step, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-start gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100 group"
                                        >
                                            <div className="mt-1 bg-emerald-50 text-emerald-500 rounded-full p-0.5 group-hover:scale-110 transition-transform">
                                                <CheckCircle className="w-5 h-5 fill-current bg-white rounded-full" />
                                            </div>
                                            <span className="text-slate-600 font-semibold leading-snug">
                                                {step}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer / Action Button */}
                        <div className="p-8 border-t border-slate-100 bg-slate-50/30">
                            {status === 'completed' ? (
                                <div className="w-full py-4 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl font-bold flex items-center justify-center gap-2">
                                    <CheckCircle className="w-5 h-5" />
                                    Phase Mastered
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        onComplete(node.id);
                                        onClose();
                                    }}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-6 h-6" />
                                    Mark as Completed
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
