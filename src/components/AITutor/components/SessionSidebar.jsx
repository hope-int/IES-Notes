
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Plus, Trash2, FileText, Code, Image as ImageIcon,
    MoreVertical, Edit2, Download, Search, LayoutGrid
} from 'lucide-react';

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
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="position-fixed top-0 start-0 w-100 h-100 bg-black bg-opacity-25"
                        style={{ zIndex: 1060, backdropFilter: 'blur(4px)' }}
                    />
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="position-fixed top-0 start-0 h-100 bg-white shadow-lg d-flex flex-column"
                        style={{ zIndex: 1070, width: '320px' }}
                    >
                        {/* Sidebar Header */}
                        <div className="p-4 border-bottom d-flex justify-content-between align-items-center bg-light bg-opacity-50">
                            <div>
                                <h5 className="fw-bold mb-0 text-dark">Project History</h5>
                                <p className="text-muted x-small mb-0 mt-1 uppercase fw-bold tracking-wider">HOPE AI Workbench</p>
                            </div>
                            <button className="btn btn-sm btn-outline-secondary border-0 rounded-circle" onClick={onClose}><X size={18} /></button>
                        </div>

                        {/* Search & New Chat */}
                        <div className="p-3 border-bottom bg-white">
                            <div className="position-relative mb-3">
                                <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                                <input
                                    type="text"
                                    className="form-control form-control-sm ps-5 bg-light border-0 rounded-pill"
                                    placeholder="Search engineering logs..."
                                    style={{ fontSize: '13px', height: '36px' }}
                                />
                            </div>
                            <button
                                onClick={onNewSession}
                                className="btn btn-primary w-100 py-2 rounded-pill fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                            >
                                <Plus size={18} /> New Workbench
                            </button>
                        </div>

                        {/* Session List */}
                        <div className="flex-grow-1 overflow-auto p-3 custom-scrollbar">
                            <h6 className="text-muted text-uppercase small fw-bold mb-3 ms-1 opacity-50" style={{ fontSize: '10px' }}>Recent Sessions</h6>
                            {sessions.length === 0 && (
                                <div className="text-center py-5 border rounded-4 border-dashed bg-light bg-opacity-25">
                                    <p className="text-muted small mb-0">No active sessions found.</p>
                                </div>
                            )}

                            {sessions.map(s => (
                                <motion.div
                                    key={s.id}
                                    whileHover={{ x: 4 }}
                                    onClick={() => onSelectSession(s.id)}
                                    className={`p-3 rounded-4 cursor-pointer mb-2 d-flex align-items-center gap-3 border transition-all ${activeSessionId === s.id ? 'bg-primary bg-opacity-5 border-primary shadow-sm' : 'bg-white border-light hover-bg-light'}`}
                                >
                                    <div className={`p-2 rounded-3 ${activeSessionId === s.id ? 'bg-primary bg-opacity-10' : 'bg-light'}`}>
                                        {getSessionIcon(s)}
                                    </div>
                                    <div className="flex-grow-1 overflow-hidden">
                                        <div className={`text-truncate small fw-bold ${activeSessionId === s.id ? 'text-primary' : 'text-dark'}`}>
                                            {s.title || 'Untitled Session'}
                                        </div>
                                        <div className="text-muted x-small mt-0.5" style={{ fontSize: '9px' }}>
                                            {new Date(s.timestamp).toLocaleDateString()} • {s.messageCount || 0} messages
                                        </div>
                                    </div>
                                    <div className="dropdown" onClick={(e) => e.stopPropagation()}>
                                        <button className="btn btn-link p-1 text-muted opacity-50 hover-opacity-100" data-bs-toggle="dropdown">
                                            <MoreVertical size={14} />
                                        </button>
                                        <ul className="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-4 p-2" style={{ fontSize: '13px' }}>
                                            <li><button className="dropdown-item rounded-3 d-flex align-items-center gap-2 py-2" onClick={() => onRenameSession(s.id)}><Edit2 size={14} /> Rename</button></li>
                                            <li><button className="dropdown-item rounded-3 d-flex align-items-center gap-2 py-2" onClick={() => onExportSession(s.id)}><Download size={14} /> Export Log</button></li>
                                            <li><hr className="dropdown-divider opacity-50" /></li>
                                            <li><button className="dropdown-item rounded-3 d-flex align-items-center gap-2 py-2 text-danger" onClick={() => onDeleteSession(s.id)}><Trash2 size={14} /> Delete</button></li>
                                        </ul>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Footer Info */}
                        <div className="p-4 bg-light bg-opacity-30 border-top text-center">
                            <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
                                <div className="bg-success rounded-circle" style={{ width: 6, height: 6 }}></div>
                                <span className="x-small fw-bold text-muted uppercase" style={{ fontSize: '9px' }}>Systems Online</span>
                            </div>
                            <p className="text-muted x-small mb-0 opacity-50">HOPE Studio AI Engineering Environment</p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default SessionSidebar;
