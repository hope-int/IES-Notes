import React from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, Unlock, ChevronRight } from 'lucide-react';

const MobileTimeline = ({ nodes, onSelectNode }) => {
    // Separate main nodes and sub-nodes
    const mainNodes = nodes.filter(n => n.data.nodeType === 'main');
    const subNodes = nodes.filter(n => n.data.nodeType !== 'main');

    const getStatusStyles = (status) => {
        switch (status) {
            case 'completed':
                return {
                    bg: 'bg-emerald-50',
                    border: 'border-emerald-200',
                    bar: 'bg-emerald-500',
                    text: 'text-emerald-700',
                    badge: 'bg-emerald-100 text-emerald-700',
                    icon: <Check className="w-4 h-4 text-emerald-600" />
                };
            case 'active':
                return {
                    bg: 'bg-white',
                    border: 'border-indigo-500 ring-4 ring-indigo-50',
                    bar: 'bg-indigo-500',
                    text: 'text-slate-900',
                    badge: 'bg-indigo-100 text-indigo-700 animate-pulse',
                    icon: <Unlock className="w-4 h-4 text-indigo-600" />
                };
            case 'locked':
            default:
                return {
                    bg: 'bg-slate-50 opacity-75',
                    border: 'border-slate-200',
                    bar: 'bg-slate-300',
                    text: 'text-slate-500',
                    badge: 'bg-slate-200 text-slate-500',
                    icon: <Lock className="w-4 h-4 text-slate-400" />
                };
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6 pt-24 pb-32 bg-slate-50 min-h-screen">
            <h2 className="text-xl font-bold text-slate-800 px-2">Your Path</h2>

            <div className="flex flex-col gap-8 relative">
                {/* Connecting Background Line */}
                <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-slate-200 z-0"></div>

                {mainNodes.map((mainNode, index) => {
                    const styles = getStatusStyles(mainNode.data.status);

                    // Find children (sub-nodes connected to this main node)
                    // Currently, roadmapAI groups logically but we might just show all sub-nodes sequentially 
                    // or try to match them by checking edges. For simplicity in a pure nodes array iteration,
                    // we can look for sub-nodes that fall chronologically between this main node and the next.
                    // A better approach is rendering them sequentially based on their Y coordinate or order in array.
                    // Given roadmapAI returns nodes in order, we can just group them by the main node they follow.

                    // To be safe and precise, let's find the subNodes that "belong" to this period.
                    // In a highly structured array, subnodes usually appear immediately after their main node.
                    const selfIndex = nodes.findIndex(n => n.id === mainNode.id);
                    const nextMainIndex = nodes.findIndex((n, i) => i > selfIndex && n.data.nodeType === 'main');
                    const mySubNodes = nodes.slice(selfIndex + 1, nextMainIndex === -1 ? nodes.length : nextMainIndex);

                    return (
                        <div key={mainNode.id} className="relative z-10 flex flex-col gap-4">

                            {/* Main Phase Card */}
                            <motion.div
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onSelectNode(mainNode)}
                                className={`flex bg-white rounded-2xl shadow-sm border ${styles.border} overflow-hidden cursor-pointer`}
                            >
                                {/* Vertical Status Bar */}
                                <div className={`w-2 flex-shrink-0 ${styles.bar}`} />

                                <div className="p-5 flex-1 flex flex-col gap-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-max ${styles.badge}`}>
                                            {styles.icon}
                                            {mainNode.data.status}
                                        </div>
                                    </div>
                                    <h3 className={`text-lg font-bold leading-tight ${styles.text}`}>
                                        {mainNode.data.label}
                                    </h3>
                                    <div className="mt-2 flex items-center justify-between text-slate-400 text-sm font-medium">
                                        <span>Tap to expand</span>
                                        <ChevronRight className="w-5 h-5" />
                                    </div>
                                </div>
                            </motion.div>

                            {/* Sub Nodes (Children) */}
                            {mySubNodes.length > 0 && (
                                <div className="flex flex-col gap-3 ml-8">
                                    {mySubNodes.map(sub => {
                                        const subStyles = getStatusStyles(sub.data.status);
                                        return (
                                            <motion.div
                                                key={sub.id}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => onSelectNode(sub)}
                                                className={`flex items-center gap-3 p-4 rounded-xl border-l-4 ${subStyles.border} bg-white shadow-sm border border-slate-100 cursor-pointer`}
                                            >
                                                <div className={`p-1.5 rounded-full ${subStyles.bg}`}>
                                                    {subStyles.icon}
                                                </div>
                                                <span className={`font-semibold text-sm flex-1 leading-snug ${subStyles.text}`}>
                                                    {sub.data.label}
                                                </span>
                                                <ChevronRight className="w-4 h-4 text-slate-300" />
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MobileTimeline;
