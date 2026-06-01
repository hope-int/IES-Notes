import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Compass, Award, Sparkles } from 'lucide-react';
import SocraticChat from './SocraticChat';
import AutonomousClassroom from './AutonomousClassroom';

const HeroChat = ({ profile, onBack, onResetProfile }) => {
    const [activeTab, setActiveTab] = useState('socratic'); // 'socratic' | 'runtime'

    return (
        <div className="zth-shell d-flex flex-column vh-100">
            <div className="zth-ambient" aria-hidden="true">
                <span className="zth-ambient-grid" />
                <span className="zth-ambient-glare" />
            </div>

            {/* Header */}
            <div className="zth-header">
                <div className="zth-header-inner">
                    <div className="zth-title-group">
                        <button
                            onClick={onBack}
                            className="zth-icon-button"
                            aria-label="Back"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="zth-brand-mark">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <h5>HOPE Autonomous Educational Engine</h5>
                            <small>Zero-to-Hero Personalized Intelligence</small>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="zth-tab-switcher" role="tablist" aria-label="Zero to Hero modes">
                        <button
                            type="button"
                            onClick={() => setActiveTab('socratic')}
                            className={`zth-tab ${activeTab === 'socratic' ? 'is-active' : ''}`}
                        >
                            <Compass size={16} />
                            Socratic Chat
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('runtime')}
                            className={`zth-tab ${activeTab === 'runtime' ? 'is-active' : ''}`}
                        >
                            <Award size={16} />
                            Autonomous Classroom
                        </button>
                    </div>

                    <button
                        onClick={onResetProfile}
                        className="zth-icon-button"
                        aria-label="Reset Zero-to-Hero profile"
                    >
                        <RefreshCw size={18} />
                    </button>
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
