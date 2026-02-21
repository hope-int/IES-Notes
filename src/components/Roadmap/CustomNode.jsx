
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Check, Lock, Unlock } from 'lucide-react';

const CustomNode = ({ data }) => {
    const { status, label, nodeType } = data;

    const isMain = nodeType === 'main';

    const getStatusStyles = () => {
        switch (status) {
            case 'completed':
                return 'border-green-500 bg-green-100 shadow-md';
            case 'active':
                return 'border-[var(--primary-accent)] bg-white shadow-lg shadow-blue-500/20 animate-pulse ring-2 ring-blue-500/20';
            case 'locked':
            default:
                return 'border-gray-300 bg-gray-100 opacity-80';
        }
    };

    const getIcon = () => {
        switch (status) {
            case 'completed': return <Check className={`${isMain ? 'w-6 h-6' : 'w-4 h-4'} text-green-600`} />;
            case 'active': return <Unlock className={`${isMain ? 'w-6 h-6' : 'w-4 h-4'} text-[var(--primary-accent)]`} />;
            case 'locked': return <Lock className={`${isMain ? 'w-5 h-5' : 'w-3 h-3'} text-gray-400`} />;
            default: return null;
        }
    };

    return (
        <div className={`
      relative ${isMain ? 'min-w-[220px] px-6 py-4' : 'min-w-[140px] px-3 py-2'} rounded-xl border-2 transition-all duration-300
      flex flex-col items-center justify-center gap-2
      ${getStatusStyles()}
    `}>
            <Handle type="target" position={Position.Top} className="!bg-transparent !border-none" />

            <div className={`p-2 rounded-full flex items-center justify-center ${status === 'locked' ? 'bg-gray-200' : 'bg-white shadow-sm border border-gray-100'}`}>
                {getIcon()}
            </div>

            <span className={`font-bold text-center ${isMain ? 'text-base' : 'text-xs'} ${status === 'locked' ? 'text-gray-500' : 'text-[var(--text-main)]'}`}>
                {label}
            </span>

            <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-none" />
        </div>
    );
};

export default memo(CustomNode);
