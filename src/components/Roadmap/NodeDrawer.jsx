
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, ExternalLink, BookOpen } from 'lucide-react';

const NodeDrawer = ({ node, isOpen, onClose, onComplete }) => {
    if (!node) return null;

    const { label, description, resource_hint, status } = node.data;

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
                        className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-[var(--bg-card)] border-l border-gray-200 z-[60] shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-[var(--bg-page)]/50 backdrop-blur-sm">
                            <h2 className="text-xl font-bold text-[var(--text-main)] pr-8">{label}</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-[var(--text-muted)] hover:text-gray-800 absolute right-4 top-4"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {/* Description Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[var(--primary-accent)] font-medium">
                                    <BookOpen className="w-5 h-5" />
                                    <h3>Overview</h3>
                                </div>
                                <p className="text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-page)] p-4 rounded-xl border border-gray-100">
                                    {description}
                                </p>
                            </div>

                            {/* Resources Section */}
                            {resource_hint && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-[var(--secondary-accent)] font-medium">
                                        <ExternalLink className="w-5 h-5" />
                                        <h3>Recommended Learning Path</h3>
                                    </div>
                                    <div className="text-[var(--text-main)] bg-[var(--accent-soft)] p-4 rounded-xl border border-blue-100">
                                        {resource_hint}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer / Action Button */}
                        <div className="p-6 border-t border-gray-100 bg-[var(--bg-page)]/50">
                            {status === 'completed' ? (
                                <button
                                    disabled
                                    className="w-full py-4 bg-green-100 text-green-700 border border-green-200 rounded-xl font-bold flex items-center justify-center gap-2 cursor-default"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    Already Completed
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        onComplete(node.id);
                                        onClose();
                                    }}
                                    className="clay-button w-full py-4 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-5 h-5" />
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
