import React from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, Unlock, ChevronRight, BookOpen } from 'lucide-react';

const MobileTimeline = ({ nodes, onSelectNode }) => {
    // Separate main nodes and sub-nodes
    const mainNodes = nodes.filter(n => n.data.nodeType === 'main');

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
            <div className="flex items-center justify-between px-2 mb-2">
                <h2 className="text-xl font-black text-slate-900">Curriculum</h2>
                <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                    Adaptive Mode
                </div>
            </div>

            <div className="flex flex-col gap-8 relative">
                {/* Connecting Background Line */}
                <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-slate-200 z-0 opacity-50"></div>

                {mainNodes.map((mainNode, index) => {
                    const styles = getStatusStyles(mainNode.data.status);

                    // Find sub-nodes belonging to this main node
                    const selfIndex = nodes.findIndex(n => n.id === mainNode.id);
                    const nextMainIndex = nodes.findIndex((n, i) => i > selfIndex && n.data.nodeType === 'main');
                    const mySubNodes = nodes.slice(selfIndex + 1, nextMainIndex === -1 ? nodes.length : nextMainIndex);
                    
                    const completedSubs = mySubNodes.filter(s => s.data.status === 'completed').length;
                    const totalSubs = mySubNodes.length;

                    return (
                        <div key={mainNode.id} className="relative z-10 flex flex-col gap-4">

                            {/* Main Phase Card */}
                            <motion.div
                                whileTap={{ scale: 0.97 }}
                                onClick={() => onSelectNode(mainNode)}
                                className={`flex bg-white rounded-2xl shadow-sm border ${styles.border} overflow-hidden cursor-pointer`}
                            >
                                {/* Vertical Status Bar */}
                                <div className={`w-1.5 flex-shrink-0 ${styles.bar}`} />

                                <div className="p-5 flex-1 flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${styles.badge}`}>
                                            {styles.icon}
                                            {mainNode.data.status}
                                        </div>
                                        {totalSubs > 0 && (
                                            <span className="text-[10px] font-black text-slate-400">
                                                {completedSubs}/{totalSubs} MASTERED
                                            </span>
                                        )}
                                    </div>
                                    <h3 className={`text-lg font-black leading-tight pr-4 ${styles.text}`}>
                                        {mainNode.data.label}
                                    </h3>
                                    
                                    <div className="flex items-center justify-between pt-1">
                                        {mainNode.data.detailed_notes && mainNode.data.status !== 'locked' && (
                                            <div className="flex items-center gap-1.5 text-indigo-600">
                                                <BookOpen size={12} />
                                                <span className="text-[11px] font-bold">Study Guide</span>
                                            </div>
                                        )}
                                        <div className="ml-auto text-slate-400">
                                            <ChevronRight className="w-5 h-5" />
                                        </div>
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
                                                whileTap={{ scale: 0.97 }}
                                                onClick={() => onSelectNode(sub)}
                                                className={`flex items-center gap-3 p-4 rounded-xl border ${subStyles.border} bg-white shadow-sm cursor-pointer`}
                                            >
                                                <div className={`p-1.5 rounded-full ${subStyles.bg}`}>
                                                    {subStyles.icon}
                                                </div>
                                                <div className="flex-1 flex flex-col gap-0.5">
                                                    <span className={`font-bold text-sm leading-snug ${subStyles.text}`}>
                                                        {sub.data.label}
                                                    </span>
                                                    {sub.data.detailed_notes && sub.data.status !== 'locked' && (
                                                        <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter flex items-center gap-1">
                                                            <BookOpen size={10} /> Research Material
                                                        </span>
                                                    )}
                                                </div>
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

