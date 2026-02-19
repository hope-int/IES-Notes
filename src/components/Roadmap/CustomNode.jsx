
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Check, Lock, Unlock } from 'lucide-react';

const CustomNode = ({ data }) => {
    const { status, label } = data;

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
            case 'completed': return <Check className="w-5 h-5 text-green-600" />;
            case 'active': return <Unlock className="w-5 h-5 text-[var(--primary-accent)]" />;
            case 'locked': return <Lock className="w-4 h-4 text-gray-400" />;
            default: return null;
        }
    };

    return (
        <div className={`
      relative min-w-[150px] px-4 py-3 rounded-xl border-2 transition-all duration-300
      flex flex-col items-center justify-center gap-2
      ${getStatusStyles()}
    `}>
            <Handle type="target" position={Position.Top} className="!bg-transparent !border-none" />

            <div className={`p-2 rounded-full ${status === 'locked' ? 'bg-gray-200' : 'bg-white shadow-sm border border-gray-100'}`}>
                {getIcon()}
            </div>

            <span className={`font-semibold text-sm text-center ${status === 'locked' ? 'text-gray-500' : 'text-[var(--text-main)]'}`}>
                {label}
            </span>

            <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-none" />
        </div>
    );
};

export default memo(CustomNode);
