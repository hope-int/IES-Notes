
import React from 'react';
import { ArrowLeft, Menu, Plus } from 'lucide-react';
import { motion } from 'framer-motion';


const StatusBar = ({
    activeModel,
    providerStatus,
    latency,
    rateLimit,
    onBack,
    onToggleSidebar,
    onNewSession,
    isNavActive = true
}) => {
    const getStatusColor = () => {
        if (providerStatus === 'Puter Cloud') return '#10b981'; // Green
        if (providerStatus === 'OpenRouter' || providerStatus === 'Groq') return '#FF6600'; // Safety Orange (Fallback)
        if (providerStatus === 'error') return '#ef4444'; // Red
        return '#94a3b8'; // Gray
    };

    return (
        <nav className="d-flex align-items-center justify-content-between px-4 py-3 sticky-top bg-white border-bottom shadow-sm" style={{ zIndex: 1040, height: '64px' }}>
            {/* Left: Project Controls */}
            <div className="d-flex align-items-center gap-2" style={{ flex: 1 }}>
                <button
                    className="btn btn-link text-dark p-2 hover-bg-light rounded-circle transition-all"
                    onClick={onBack}
                    title="Back to Dashboard"
                >
                    <ArrowLeft size={20} />
                </button>
                <button
                    className="btn btn-link text-dark p-2 hover-bg-light rounded-circle transition-all"
                    onClick={onToggleSidebar}
                    title="Project History"
                >
                    <Menu size={20} />
                </button>
            </div>

            {/* Center: Branding */}
            <div className="d-flex align-items-center justify-content-center" style={{ flex: 1 }}>
                <div className="d-flex align-items-center px-3 py-1-5 rounded-pill border bg-light bg-opacity-50">
                    <span className="fw-bold small tracking-tighter text-dark" style={{ fontSize: '11px', letterSpacing: '1px' }}>HOPE AI <span className="d-none d-md-inline">WORKBENCH</span></span>
                </div>
            </div>

            {/* Right: Engine Status & Action */}
            <div className="d-flex align-items-center justify-content-end gap-2 gap-md-3" style={{ flex: 1 }}>
                <div className="d-none d-lg-flex align-items-center gap-2 border-end pe-3 border-opacity-10">
                    <motion.div
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: getStatusColor() }}
                    />
                    <span className="fw-bold text-muted font-monospace" style={{ fontSize: '11px' }}>{activeModel || 'System Ready'}</span>
                </div>

                <button
                    className="btn btn-primary rounded-pill px-4 py-1-5 small fw-bold shadow-sm d-flex align-items-center gap-2"
                    style={{ fontSize: '13px', backgroundColor: '#003366', borderColor: '#003366' }}
                    onClick={onNewSession}
                >
                    <Plus size={16} /> <span className="d-none d-sm-inline">New Chat</span>
                </button>
            </div>
        </nav>
    );
};

export default StatusBar;
