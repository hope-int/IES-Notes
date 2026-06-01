
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Plus, Trash2, FileText, Code, Image as ImageIcon,
    MoreVertical, Edit2, Download, Search, LayoutGrid
} from 'lucide-react';

const MotionDiv = motion.div;

const SessionSidebar = ({
    isOpen,
    onClose,
    sessions,
    activeSessionId,
    onSelectSession,
    onNewSession,
    onDeleteSession,
    onRenameSession,
    onExportSession
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const getSessionIcon = (session) => {
        if (session.hasCode) return <Code size={16} className="text-primary" />;
        if (session.hasPDF) return <FileText size={16} className="text-success" />;
        if (session.hasImage) return <ImageIcon size={16} className="text-warning" />;
        return <LayoutGrid size={16} className="text-muted opacity-50" />;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <MotionDiv
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="ai-session-backdrop position-fixed top-0 start-0 w-100 h-100"
                        style={{ zIndex: 1060 }}
                    />
                    <MotionDiv
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="ai-session-panel fixed top-0 left-0 h-full flex flex-col z-[1070]"
                    >
                        {/* Sidebar Header */}
                        <div className="ai-session-header">
                            <div>
                                <h5>Project History</h5>
                                <p>HOPE AI Workbench</p>
                            </div>
                            <button className="ai-session-close" onClick={onClose} aria-label="Close session history"><X size={18} /></button>
                        </div>

                        {/* Search & New Chat */}
                        <div className="ai-session-controls">
                            <div className="ai-session-search">
                                <Search size={14} />
                                <input
                                    type="text"
                                    className="theme-input"
                                    placeholder="Search engineering logs..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={onNewSession}
                                className="ai-session-new"
                            >
                                <Plus size={18} /> New Workbench
                            </button>
                        </div>

                        {/* Session List */}
                        <div className="ai-session-list flex-grow-1 overflow-auto custom-scrollbar">
                            <h6>Recent Sessions</h6>
                            {sessions.length === 0 && (
                                <div className="ai-session-empty">
                                    <p>No active sessions found.</p>
                                </div>
                             )}

                            {sessions
                                .filter(s => (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
                                .map(s => (
                                    <MotionDiv
                                        key={s.id}
                                        whileHover={{ x: 4 }}
                                        onClick={() => onSelectSession(s.id)}
                                        className={`ai-session-item ${activeSessionId === s.id ? 'is-active' : ''}`}
                                    >
                                        <div className="ai-session-icon">
                                            {React.cloneElement(getSessionIcon(s), { 
                                                className: activeSessionId === s.id ? 'text-white' : getSessionIcon(s).props.className 
                                            })}
                                        </div>
                                        <div className="flex-grow-1 overflow-hidden">
                                            <div className="ai-session-title">
                                                {s.title || 'Untitled Session'}
                                            </div>
                                            <div className="ai-session-meta">
                                                {new Date(s.timestamp).toLocaleDateString()} • {s.messageCount || 0} messages
                                             </div>
                                        </div>
                                        <div className="dropdown" onClick={(e) => e.stopPropagation()}>
                                            <button className="ai-session-menu" data-bs-toggle="dropdown" aria-label="Session options">
                                                <MoreVertical size={14} />
                                            </button>
                                            <ul className="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-4 p-2" style={{ fontSize: '13px' }}>
                                                <li><button className="dropdown-item rounded-3 d-flex align-items-center gap-2 py-2" onClick={() => onRenameSession(s.id)}><Edit2 size={14} /> Rename</button></li>
                                                <li><button className="dropdown-item rounded-3 d-flex align-items-center gap-2 py-2" onClick={() => onExportSession(s.id)}><Download size={14} /> Export Log</button></li>
                                                <li><hr className="dropdown-divider opacity-50" /></li>
                                                <li><button className="dropdown-item rounded-3 d-flex align-items-center gap-2 py-2 text-danger" onClick={() => onDeleteSession(s.id)}><Trash2 size={14} /> Delete</button></li>
                                            </ul>
                                        </div>
                                    </MotionDiv>
                                ))}
                        </div>

                        {/* Footer Info */}
                        <div className="ai-session-footer">
                            <div>
                                <span />
                                <strong>Systems Online</strong>
                            </div>
                            <p>
                                Developed by Harinandan K<br />
                                IES College of Engineering | KTU
                            </p>
                        </div>
                    </MotionDiv>
                </>
            )}
        </AnimatePresence>
    );
};

export default SessionSidebar;
