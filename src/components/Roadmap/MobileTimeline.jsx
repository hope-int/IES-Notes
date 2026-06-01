import React from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, Unlock, ChevronRight, BookOpen } from 'lucide-react';

const MotionDiv = motion.div;

const MobileTimeline = ({ nodes, onSelectNode }) => {
    // Separate main nodes and sub-nodes
    const mainNodes = nodes.filter(n => n.data.nodeType === 'main');

    const getStatusStyles = (status) => {
        switch (status) {
            case 'completed':
                return {
                    className: 'is-completed',
                    icon: <Check size={16} />
                };
            case 'active':
                return {
                    className: 'is-active',
                    icon: <Unlock size={16} />
                };
            case 'locked':
            default:
                return {
                    className: 'is-locked',
                    icon: <Lock size={16} />
                };
        }
    };

    return (
        <div className="roadmap-mobile-timeline">
            <div className="roadmap-mobile-heading">
                <h2>Curriculum</h2>
                <div>
                    Adaptive Mode
                </div>
            </div>

            <div className="roadmap-mobile-list">
                {/* Connecting Background Line */}
                <div className="roadmap-mobile-line"></div>

                {mainNodes.map((mainNode) => {
                    const styles = getStatusStyles(mainNode.data.status);

                    // Find sub-nodes belonging to this main node
                    const selfIndex = nodes.findIndex(n => n.id === mainNode.id);
                    const nextMainIndex = nodes.findIndex((n, i) => i > selfIndex && n.data.nodeType === 'main');
                    const mySubNodes = nodes.slice(selfIndex + 1, nextMainIndex === -1 ? nodes.length : nextMainIndex);
                    
                    const completedSubs = mySubNodes.filter(s => s.data.status === 'completed').length;
                    const totalSubs = mySubNodes.length;

                    return (
                        <div key={mainNode.id} className="roadmap-mobile-phase">

                            {/* Main Phase Card */}
                            <MotionDiv
                                whileTap={{ scale: 0.97 }}
                                onClick={() => onSelectNode(mainNode)}
                                className={`roadmap-mobile-card is-main ${styles.className}`}
                            >
                                {/* Vertical Status Bar */}
                                <div className="roadmap-mobile-status-bar" />

                                <div className="roadmap-mobile-card-body">
                                    <div className="roadmap-mobile-card-top">
                                        <div className="roadmap-mobile-badge">
                                            {styles.icon}
                                            {mainNode.data.status}
                                        </div>
                                        {totalSubs > 0 && (
                                            <span>
                                                {completedSubs}/{totalSubs} MASTERED
                                            </span>
                                        )}
                                    </div>
                                    <h3>
                                        {mainNode.data.label}
                                    </h3>
                                    
                                    <div className="roadmap-mobile-card-foot">
                                        {mainNode.data.detailed_notes && mainNode.data.status !== 'locked' && (
                                            <div>
                                                <BookOpen size={12} />
                                                <span>Study Guide</span>
                                            </div>
                                        )}
                                        <ChevronRight size={20} />
                                    </div>
                                </div>
                            </MotionDiv>

                            {/* Sub Nodes (Children) */}
                            {mySubNodes.length > 0 && (
                                <div className="roadmap-mobile-sub-list">
                                    {mySubNodes.map(sub => {
                                        const subStyles = getStatusStyles(sub.data.status);
                                        return (
                                            <MotionDiv
                                                key={sub.id}
                                                whileTap={{ scale: 0.97 }}
                                                onClick={() => onSelectNode(sub)}
                                                className={`roadmap-mobile-card is-sub ${subStyles.className}`}
                                            >
                                                <div className="roadmap-mobile-sub-icon">
                                                    {subStyles.icon}
                                                </div>
                                                <div className="roadmap-mobile-sub-copy">
                                                    <span>
                                                        {sub.data.label}
                                                    </span>
                                                    {sub.data.detailed_notes && sub.data.status !== 'locked' && (
                                                        <small>
                                                            <BookOpen size={10} /> Research Material
                                                        </small>
                                                    )}
                                                </div>
                                                <ChevronRight size={16} />
                                            </MotionDiv>
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
