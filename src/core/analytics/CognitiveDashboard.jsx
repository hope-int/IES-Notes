import React from 'react';
import { useAnalyticsStore } from '../../stores/useAnalyticsStore';

const CognitiveDashboard = () => {
    const { 
        attentionScore, 
        conceptMastery, 
        weakConcepts, 
        interactionLatency, 
        quizPerformance 
    } = useAnalyticsStore();

    // Stats calculations
    const quizCount = quizPerformance.length;
    const avgScore = quizCount > 0 
        ? Math.round(quizPerformance.reduce((acc, curr) => acc + curr.score, 0) / quizCount) 
        : 0;

    const avgLatency = interactionLatency.length > 0
        ? Math.round(interactionLatency.reduce((acc, curr) => acc + curr, 0) / interactionLatency.length / 1000 * 10) / 10
        : 0;

    return (
        <div className="bg-white text-slate-800 rounded-4 p-3 shadow-sm border border-slate-100 position-relative w-100">
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom border-slate-100 pb-2">
                <div>
                    <h6 className="fw-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 m-0" style={{ fontSize: '0.9rem' }}>
                        Cognitive Telemetry
                    </h6>
                    <p className="text-slate-500 m-0" style={{ fontSize: '0.7rem' }}>Real-time focus and concept mastery tracking</p>
                </div>
                <span className="badge bg-blue-50 text-blue-600 border border-blue-200 rounded-pill font-monospace animate-pulse" style={{ fontSize: '0.65rem' }}>
                    LIVE FEED
                </span>
            </div>

            {/* Quick Stats Grid */}
            <div className="row g-2 mb-3">
                {/* 1. Attention Focus */}
                <div className="col-4">
                    <div className="bg-slate-50 border border-slate-100 rounded-3 p-2 text-center h-100 d-flex flex-column justify-content-center align-items-center">
                        <span className="text-slate-500 font-monospace text-uppercase tracking-wider mb-1" style={{ fontSize: '0.6rem', fontWeight: '700' }}>Attention</span>
                        <div className="d-flex align-items-center gap-1">
                            <svg width="24" height="24" viewBox="0 0 36 36" className="flex-shrink-0">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                                <circle cx="18" cy="18" r="16" fill="none" stroke="#3b82f6" strokeWidth="3.5" 
                                    strokeDasharray="100.53" 
                                    strokeDashoffset={100.53 - (100.53 * attentionScore) / 100}
                                    strokeLinecap="round"
                                    transform="rotate(-90 18 18)"
                                />
                            </svg>
                            <span className="fw-extrabold text-slate-800" style={{ fontSize: '0.95rem' }}>{attentionScore}%</span>
                        </div>
                    </div>
                </div>

                {/* 2. Concept Check */}
                <div className="col-4">
                    <div className="bg-slate-50 border border-slate-100 rounded-3 p-2 text-center h-100 d-flex flex-column justify-content-center">
                        <span className="text-slate-500 font-monospace text-uppercase tracking-wider mb-1" style={{ fontSize: '0.6rem', fontWeight: '700' }}>Concept Check</span>
                        <div>
                            <span className="fw-extrabold text-emerald-600" style={{ fontSize: '0.95rem' }}>{avgScore}%</span>
                            <span className="text-slate-400 text-xs ms-0.5">Avg</span>
                        </div>
                    </div>
                </div>

                {/* 3. Telemetry Latency */}
                <div className="col-4">
                    <div className="bg-slate-50 border border-slate-100 rounded-3 p-2 text-center h-100 d-flex flex-column justify-content-center">
                        <span className="text-slate-500 font-monospace text-uppercase tracking-wider mb-1" style={{ fontSize: '0.6rem', fontWeight: '700' }}>Latency</span>
                        <div>
                            <span className="fw-extrabold text-indigo-600" style={{ fontSize: '0.95rem' }}>{avgLatency}s</span>
                            <span className="text-slate-400 text-xs ms-0.5">Resp</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hierarchies & Weak Areas */}
            <div className="row g-2">
                {/* Concept Mastery List */}
                <div className="col-sm-6">
                    <div className="bg-slate-50 border border-slate-100 rounded-3 p-2 h-100">
                        <div className="fw-bold text-slate-600 mb-2 font-monospace text-uppercase tracking-wider" style={{ fontSize: '0.65rem' }}>Concept Mastery</div>
                        {Object.keys(conceptMastery).length === 0 ? (
                            <div className="text-center py-2 text-slate-400 font-medium" style={{ fontSize: '0.7rem' }}>
                                No concepts evaluated.
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-2" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                {Object.entries(conceptMastery).map(([concept, mastery]) => (
                                    <div key={concept}>
                                        <div className="d-flex justify-content-between mb-0.5" style={{ fontSize: '0.65rem', fontWeight: '600' }}>
                                            <span className="text-slate-700 text-truncate max-w-[70%]">{concept}</span>
                                            <span className="text-blue-600">{Math.round(mastery)}%</span>
                                        </div>
                                        <div className="progress bg-slate-200" style={{ height: '4px' }}>
                                            <div 
                                                className="progress-bar bg-gradient-to-r from-blue-600 to-indigo-600" 
                                                role="progressbar" 
                                                style={{ width: `${mastery}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Focus Areas */}
                <div className="col-sm-6">
                    <div className="bg-slate-50 border border-slate-100 rounded-3 p-2 h-100">
                        <div className="fw-bold text-slate-600 mb-2 font-monospace text-uppercase tracking-wider" style={{ fontSize: '0.65rem' }}>Focus Areas</div>
                        {weakConcepts.length === 0 ? (
                            <div className="text-center py-2 text-slate-400 font-medium" style={{ fontSize: '0.7rem' }}>
                                ✨ No weak spots detected.
                            </div>
                        ) : (
                            <div className="d-flex flex-wrap gap-1" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                {weakConcepts.map((concept, idx) => (
                                    <span 
                                        key={idx}
                                        className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-20 rounded-pill px-2 py-1 font-semibold"
                                        style={{ fontSize: '0.65rem' }}
                                    >
                                        ⚠️ {concept}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CognitiveDashboard;
