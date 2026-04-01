
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Check, Lock, Unlock, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';

const CustomNode = ({ data }) => {
    const { status, label, nodeType, detailed_notes } = data;

    const isMain = nodeType === 'main';
    const hasContent = !!detailed_notes;

    const getStatusStyles = () => {
        switch (status) {
            case 'completed':
                return 'border-emerald-200 bg-emerald-50 shadow-sm';
            case 'active':
                return 'border-indigo-500 bg-white shadow-xl z-20';
            case 'locked':
            default:
                return 'border-slate-200 bg-slate-50 text-slate-400 opacity-75';
        }
    };

    const getIcon = () => {
        switch (status) {
            case 'completed': return <Check className={`${isMain ? 'w-6 h-6' : 'w-4 h-4'} text-green-600`} />;
            case 'active': return <Unlock className={`${isMain ? 'w-6 h-6' : 'w-4 h-4'} text-indigo-600`} />;
            case 'locked': return <Lock className={`${isMain ? 'w-5 h-5' : 'w-3 h-3'} text-gray-400`} />;
            default: return null;
        }
    };

    return (
        <motion.div
            initial={status === 'active' ? { scale: 1 } : false}
            animate={status === 'active' ? { 
                scale: [1, 1.05, 1],
                boxShadow: [
                    '0 0 0px rgba(79, 70, 229, 0)',
                    '0 0 20px rgba(79, 70, 229, 0.2)',
                    '0 0 0px rgba(79, 70, 229, 0)'
                ]
            } : {}}
            transition={status === 'active' ? { 
                duration: 3, 
                repeat: Infinity,
                ease: "easeInOut"
            } : {}}
            className={`
                relative ${isMain ? 'min-w-[220px] px-6 py-5' : 'min-w-[140px] px-3 py-2.5'} rounded-2xl border-2 transition-all duration-300
                flex flex-col items-center justify-center gap-2
                ${getStatusStyles()}
            `}
        >
            <Handle type="target" position={Position.Top} className="!bg-transparent !border-none opacity-0" />

            {/* Mastery Content Badge */}
            {hasContent && status !== 'locked' && (
                <div className="absolute -top-3 -right-3 bg-indigo-600 text-white p-1.5 rounded-lg shadow-lg z-30">
                    <BookOpen size={12} strokeWidth={3} />
                </div>
            )}

            <div className={`p-2 rounded-full flex items-center justify-center ${status === 'locked' ? 'bg-slate-200' : 'bg-white shadow-sm border border-slate-100'}`}>
                {getIcon()}
            </div>

            <span className={`font-bold text-center ${isMain ? 'text-base' : 'text-xs'} ${status === 'locked' ? 'text-slate-400' : 'text-slate-800'}`}>
                {label}
            </span>

            <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-none opacity-0" />
        </motion.div>
    );
};

export default memo(CustomNode);

