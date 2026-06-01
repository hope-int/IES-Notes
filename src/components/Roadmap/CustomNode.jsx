
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Check, Lock, Unlock, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';

const MotionDiv = motion.div;

const CustomNode = ({ data }) => {
    const { status, label, nodeType, detailed_notes } = data;

    const isMain = nodeType === 'main';
    const hasContent = !!detailed_notes;

    const getIcon = () => {
        switch (status) {
            case 'completed': return <Check size={isMain ? 22 : 16} />;
            case 'active': return <Unlock size={isMain ? 22 : 16} />;
            case 'locked': return <Lock size={isMain ? 20 : 14} />;
            default: return null;
        }
    };

    return (
        <MotionDiv
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
                roadmap-node ${isMain ? 'is-main' : 'is-sub'} is-${status}
            `}
        >
            <Handle type="target" position={Position.Top} className="!bg-transparent !border-none opacity-0" />

            {/* Mastery Content Badge */}
            {hasContent && status !== 'locked' && (
                <div className="roadmap-node-content-badge">
                    <BookOpen size={12} strokeWidth={3} />
                </div>
            )}

            <div className="roadmap-node-icon">
                {getIcon()}
            </div>

            <span className="roadmap-node-label">
                {label}
            </span>

            <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-none opacity-0" />
        </MotionDiv>
    );
};

export default memo(CustomNode);
