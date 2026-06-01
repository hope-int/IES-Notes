
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Lightbulb, Search, Copy, Check, BookOpen, Sparkles } from 'lucide-react';

const MotionDiv = motion.div;

const NodeDrawer = ({ node, isOpen, onClose, onComplete, isMobile }) => {
    const [scrollState, setScrollState] = useState({ nodeId: null, progress: 0 });
    const [copied, setCopied] = useState(false);
    const contentRef = useRef(null);
    const scrollProgress = scrollState.nodeId === node?.id ? scrollState.progress : 0;

    // Handle scroll progress
    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const maxScroll = scrollHeight - clientHeight;
        const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
        setScrollState({ nodeId: node?.id, progress });
    };

    if (!node) return null;

    const { label, eli5_analogy, action_steps, status, detailed_notes, search_keywords } = node.data;

    const copyKeywords = () => {
        if (!search_keywords) return;
        const text = search_keywords.join(', ');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                    <MotionDiv
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="roadmap-drawer-backdrop"
                    />

                    {/* Drawer */}
                    <MotionDiv
                        variants={drawerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className={`
                            roadmap-drawer
                            ${isMobile ? 'is-mobile' : ''}
                        `}
                    >
                        {/* Reading Progress Bar */}
                        <div className="roadmap-drawer-progress">
                            <MotionDiv 
                                className="roadmap-progress-fill"
                                style={{ width: `${scrollProgress}%` }}
                            />
                        </div>

                        {/* Mobile Drag Handle */}
                        {isMobile && (
                            <div className="roadmap-drawer-grip-wrap">
                                <div className="roadmap-drawer-grip" />
                            </div>
                        )}
                        
                        {/* Header */}
                        <div className="roadmap-drawer-header">
                            <div>
                                <span className="roadmap-drawer-eyebrow"><Sparkles size={14} /> Mastery Node</span>
                                <h2>{label}</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="roadmap-icon-button"
                                aria-label="Close roadmap node"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div 
                            ref={contentRef}
                            onScroll={handleScroll}
                            className="roadmap-drawer-content custom-scrollbar"
                        >
                            {/* ELI5 Analogy Section */}
                            {eli5_analogy && (
                                <div className="roadmap-insight-box">
                                    <h3>
                                        <Lightbulb size={16} /> The Analogy
                                    </h3>
                                    <p>
                                        "{eli5_analogy}"
                                    </p>
                                </div>
                            )}

                            {/* Detailed Study Notes (Mastery) */}
                            {detailed_notes && (
                                <div className="roadmap-notes-section">
                                    <h3>
                                        <BookOpen size={18} />
                                        Curriculum Deep-Dive
                                    </h3>
                                    <div className="roadmap-notes-copy">
                                        {detailed_notes.split('\n').map((para, i) => 
                                            para.trim() ? (
                                                <p key={i}>
                                                    {para}
                                                </p>
                                            ) : null
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Study References / Keywords */}
                            {search_keywords && search_keywords.length > 0 && (
                                <div className="roadmap-keyword-box">
                                    <div className="roadmap-keyword-header">
                                        <h3>
                                            <Search size={15} />
                                            Expert Keywords
                                        </h3>
                                        <button 
                                            onClick={copyKeywords}
                                            className={`roadmap-copy-button ${copied ? 'is-copied' : ''}`}
                                        >
                                            {copied ? <Check size={12} /> : <Copy size={12} />}
                                            {copied ? 'Copied' : 'Copy All'}
                                        </button>
                                    </div>
                                    <div className="roadmap-keyword-list">
                                        {search_keywords.map((kw, i) => (
                                            <div key={i}>
                                                <span>{kw}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Steps Section */}
                            <div className="roadmap-task-section">
                                <h3>
                                    <CheckCircle size={18} />
                                    Phase Mastery Tasks
                                </h3>
                                <div className="roadmap-task-list">
                                    {(action_steps || []).map((step, idx) => (
                                        <div
                                            key={idx}
                                            className="roadmap-task-item"
                                        >
                                            <div>
                                                <CheckCircle size={18} />
                                            </div>
                                            <span>
                                                {step}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer / Action Button */}
                        <div className="roadmap-drawer-footer">
                            {status === 'completed' ? (
                                <div className="roadmap-complete-banner">
                                    <CheckCircle size={18} />
                                    Goal Validated
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        onComplete(node.id);
                                        onClose();
                                    }}
                                    className="roadmap-primary-action is-full"
                                >
                                    <CheckCircle size={18} />
                                    Certify Completion
                                </button>
                            )}
                        </div>
                    </MotionDiv>
                </>
            )}
        </AnimatePresence>
    );
};

export default NodeDrawer;
