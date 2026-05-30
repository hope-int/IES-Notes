import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, History, Compass, Award } from 'lucide-react';
import SocraticChat from './SocraticChat';
import AutonomousClassroom from './AutonomousClassroom';

const HeroChat = ({ profile, onBack, onResetProfile }) => {
    const [activeTab, setActiveTab] = useState('socratic'); // 'socratic' | 'runtime'

    return (
        <div className="d-flex flex-column vh-100" style={{ background: '#f8fafc' }}>
            {/* Header */}
            <div className="p-3 bg-white border-bottom shadow-sm">
                <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-3">
                        <button
                            onClick={onBack}
                            className="btn btn-outline-secondary rounded-circle p-2 d-flex align-items-center justify-content-center"
                            style={{ width: 40, height: 40 }}
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h5 className="mb-0 fw-bold text-dark">HOPE Autonomous Educational Engine</h5>
                            <small className="text-muted fw-medium">Zero-to-Hero Personalized Intelligence</small>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="nav nav-pills bg-light p-1 rounded-pill">
                        <button
                            onClick={() => setActiveTab('socratic')}
                            className={`nav-link rounded-pill px-4 py-1 fw-semibold d-flex align-items-center gap-2 ${activeTab === 'socratic' ? 'active bg-primary text-white' : 'text-secondary bg-transparent border-0'}`}
                        >
                            <Compass size={16} />
                            Socratic Chat
                        </button>
                        <button
                            onClick={() => setActiveTab('runtime')}
                            className={`nav-link rounded-pill px-4 py-1 fw-semibold d-flex align-items-center gap-2 ${activeTab === 'runtime' ? 'active bg-primary text-white' : 'text-secondary bg-transparent border-0'}`}
                        >
                            <Award size={16} />
                            Autonomous Classroom
                        </button>
                    </div>

                    <div className="d-flex gap-2">
                        <button
                            onClick={onResetProfile}
                            className="btn btn-outline-secondary rounded-circle p-2"
                            style={{ width: 40, height: 40 }}
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'socratic' ? (
                <SocraticChat profile={profile} onResetProfile={onResetProfile} />
            ) : (
                <AutonomousClassroom profile={profile} />
            )}
        </div>
    );
};

export default HeroChat;
