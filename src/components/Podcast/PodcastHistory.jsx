import React from 'react';
import { Play, Clock, Calendar, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

const PodcastHistory = ({ history, onSelect }) => {
    if (!history || history.length === 0) {
        return (
            <div className="text-center py-5 text-muted">
                <Clock size={48} className="mb-3 opacity-25" />
                <p>No listening history yet.</p>
            </div>
        );
    }

    return (
        <div className="d-flex flex-column gap-3">
            {history.map((item, index) => (
                <motion.div
                    key={item.id || index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="clay-card p-3 rounded-4 d-flex align-items-center gap-3 cursor-pointer hover-scale bg-white"
                    onClick={() => onSelect(item)}
                >
                    {/* Thumbnail */}
                    <div
                        className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                        style={{
                            width: '60px',
                            height: '60px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)'
                        }}
                    >
                        <Play size={24} fill="currentColor" />
                    </div>

                    {/* Info */}
                    <div className="flex-grow-1 overflow-hidden" style={{ minWidth: 0 }}>
                        <h6 className="fw-bold mb-1 text-truncate">{item.title}</h6>
                        <div className="d-flex align-items-center gap-3 text-muted small">
                            <span className="d-flex align-items-center gap-1">
                                <Calendar size={12} />
                                {new Date(item.date).toLocaleDateString()}
                            </span>
                            <span className="d-flex align-items-center gap-1">
                                <Clock size={12} />
                                {item.duration || '5m'}
                            </span>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

export default PodcastHistory;
