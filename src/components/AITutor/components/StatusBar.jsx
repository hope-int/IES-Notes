
import React from 'react';
import { ArrowLeft, Menu, Plus, Activity, Gauge } from 'lucide-react';
import { motion } from 'framer-motion';

const MotionDiv = motion.div;

const StatusBar = ({
    activeModel,
    providerStatus,
    latency,
    rateLimit,
    onBack,
    onToggleSidebar,
    onNewSession
}) => {
    const getStatusColor = () => {
        if (providerStatus === 'Puter Cloud' || providerStatus === 'Instant') return '#10b981'; // Green
        if (providerStatus === 'OpenRouter' || providerStatus === 'Groq') return '#FF6600'; // Safety Orange (Fallback)
        if (providerStatus === 'error') return '#ef4444'; // Red
        return '#94a3b8'; // Gray
    };

    return (
        <nav className="ai-status-bar flex items-center justify-between sticky top-0 z-[1040]">
            {/* Left: Project Controls */}
            <div className="ai-status-cluster flex-1">
                <button
                    className="ai-nav-icon"
                    onClick={onBack}
                    title="Back to Dashboard"
                >
                    <ArrowLeft size={20} />
                </button>
                <button
                    className="ai-nav-icon"
                    onClick={onToggleSidebar}
                    title="Project History"
                >
                    <Menu size={20} />
                </button>
            </div>

            {/* Center: Branding */}
            <div className="hidden md:flex items-center justify-center flex-1">
                <div className="ai-status-brand">
                    <span className="ai-status-brand-dot" />
                    <span>HOPE AI WORKBENCH</span>
                </div>
            </div>

            {/* Mobile Branding - Dot Indicator if workbench is hidden */}
            <div className="flex md:hidden items-center justify-center flex-1">
                <span className="ai-status-mobile-title">HOPE AI</span>
            </div>

            {/* Right: Engine Status & Action */}
            <div className="ai-status-cluster ai-status-right flex-1">
                <div className="ai-engine-chip">
                    <MotionDiv
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="ai-engine-dot"
                        style={{ backgroundColor: getStatusColor() }}
                    />
                    <span>{activeModel || 'System Ready'}</span>
                </div>
                <div className="ai-status-metrics">
                    <span><Activity size={13} />{latency ? `${Math.round(latency)}ms` : providerStatus}</span>
                    <span><Gauge size={13} />{rateLimit || 'Ready'}</span>
                </div>

                <button
                    className="ai-new-chat-button"
                    onClick={onNewSession}
                >
                    <Plus size={16} /> <span className="hidden sm:inline">New Chat</span>
                </button>
            </div>
        </nav>
    );
};

export default StatusBar;
