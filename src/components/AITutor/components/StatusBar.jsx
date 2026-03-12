
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
        <nav className="flex items-center justify-between px-2 md:px-4 h-14 md:h-16 sticky top-0 bg-white border-b shadow-sm z-[1040]">
            {/* Left: Project Controls */}
            <div className="flex items-center gap-1 md:gap-2 flex-1">
                <button
                    className="p-2 rounded-full hover:bg-gray-100 transition-all text-gray-600 flex items-center justify-center"
                    onClick={onBack}
                    title="Back to Dashboard"
                >
                    <ArrowLeft size={20} />
                </button>
                <button
                    className="p-2 rounded-full hover:bg-gray-100 transition-all text-gray-600 flex items-center justify-center"
                    onClick={onToggleSidebar}
                    title="Project History"
                >
                    <Menu size={20} />
                </button>
            </div>

            {/* Center: Branding */}
            <div className="hidden md:flex items-center justify-center flex-1">
                <div className="flex items-center px-3 py-1.5 rounded-full border bg-gray-50 bg-opacity-50">
                    <span className="font-bold text-[11px] tracking-widest text-gray-800">HOPE AI WORKBENCH</span>
                </div>
            </div>

            {/* Mobile Branding - Dot Indicator if workbench is hidden */}
            <div className="flex md:hidden items-center justify-center flex-1">
                <span className="font-bold text-[11px] tracking-widest text-gray-800">HOPE AI</span>
            </div>

            {/* Right: Engine Status & Action */}
            <div className="flex items-center justify-end gap-1 md:gap-3 flex-1">
                <div className="flex items-center gap-2 md:border-r md:pr-3 border-gray-200">
                    <motion.div
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getStatusColor() }}
                    />
                    <span className="hidden lg:flex font-bold text-gray-500 font-mono text-[11px]">{activeModel || 'System Ready'}</span>
                </div>

                <button
                    className="bg-[#003366] hover:bg-[#004080] text-white rounded-xl px-2 md:px-4 py-1.5 text-[13px] font-bold shadow-sm transition-all flex items-center justify-center gap-1 md:gap-2 active:scale-95"
                    onClick={onNewSession}
                >
                    <Plus size={16} /> <span className="hidden sm:inline">New Chat</span>
                </button>
            </div>
        </nav>
    );
};

export default StatusBar;
