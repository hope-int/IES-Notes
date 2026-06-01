import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Sparkles, MessageSquare, Presentation, FileText, FileSpreadsheet, Code, Terminal, Mic,
    BookOpen, ArrowLeft, Bot, ChevronRight, Settings, GraduationCap, ShieldCheck,
    Gauge, Layers3, Wand2, PenTool, MonitorPlay, Route, Boxes, Radio, KeyRound,
    FilePlus2, Compass, Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import APIKeyVault from '../Settings/APIKeyVault';
import { initVault } from '../../utils/keyVault';

const MotionDiv = motion.div;

const AITutorDashboard = () => {
    const { userProfile: profile } = useAuth();
    const navigate = useNavigate();
    const [vaultOpen, setVaultOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(document.body.classList.contains('dark-mode'));

    // Pre-load vault so aiService has keys ready before first chat
    useEffect(() => { 
        initVault();

        const observer = new MutationObserver(() => {
            setIsDarkMode(document.body.classList.contains('dark-mode'));
        });

        let lastScrollY = window.scrollY;
        let ticking = false;
        window.dispatchEvent(new CustomEvent('hope_hide_bottom_nav', { detail: false }));

        const handleStudioScroll = () => {
            if (ticking) return;
            ticking = true;

            window.requestAnimationFrame(() => {
                const currentScrollY = window.scrollY;
                const isScrollingDown = currentScrollY > lastScrollY + 4;
                const isNearTop = currentScrollY < 80;

                window.dispatchEvent(new CustomEvent('hope_hide_bottom_nav', {
                    detail: !isNearTop && isScrollingDown
                }));

                lastScrollY = currentScrollY;
                ticking = false;
            });
        };

        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        window.addEventListener('scroll', handleStudioScroll, { passive: true });
        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', handleStudioScroll);
            window.dispatchEvent(new CustomEvent('hope_hide_bottom_nav', { detail: false }));
        };
    }, []);

    const studioTools = useMemo(() => ([
        {
            group: 'Learning Engines',
            icon: GraduationCap,
            tools: [
                { id: 'zero-to-hero', icon: GraduationCap, title: 'Zero to Hero', desc: 'Autonomous live class with Socratic guidance.', accent: '#2563eb', badge: 'Live' },
                { id: 'roadmap', icon: Route, title: 'Study Roadmap', desc: 'Adaptive skill tree for long-term mastery.', accent: '#0ea5e9', badge: 'AI' },
                { id: 'podcast-class', icon: Mic, title: 'Podcast Class', desc: 'Convert notes into immersive audio sessions.', accent: '#db2777', badge: 'Beta' },
            ],
        },
        {
            group: 'Creation Suite',
            icon: PenTool,
            tools: [
                { id: 'presentation', icon: Presentation, title: 'AI Presentation', desc: 'Generate polished academic slide decks.', accent: '#3b82f6', badge: 'Beta' },
                { id: 'handbook', icon: BookOpen, title: 'Revision Kit', desc: 'Exam-ready notes, summaries, and recall sheets.', accent: '#059669' },
                { id: 'report', icon: FileText, title: 'Academic Report', desc: 'Draft structured professional reports.', accent: '#0891b2' },
                { id: 'assignment', icon: Wand2, title: 'Assignment Helper', desc: 'Create answers, quizzes, and guided tasks.', accent: '#ea580c' },
            ],
        },
        {
            group: 'Build Workspace',
            icon: Boxes,
            tools: [
                { id: 'j-compiler', icon: Terminal, title: 'J-Compiler', desc: 'Interactive code simulation and debugging.', accent: isDarkMode ? '#60a5fa' : '#1e293b' },
                { id: 'mini-project', icon: Code, title: 'Project Designer', desc: 'Plan prototypes, flows, and implementation logic.', accent: '#7c3aed', badge: 'Beta' },
                { id: 'docs', icon: FileText, title: 'HOPE Docs', desc: 'Focused writing space for academic documents.', accent: '#2563eb', badge: 'New' },
                { id: 'sheets', icon: FileSpreadsheet, title: 'HOPE Sheets', desc: 'Engineering tables, calculations, and trackers.', accent: '#059669', badge: 'New' },
            ],
        },
    ]), [isDarkMode]);

    const allTools = studioTools.flatMap(group => group.tools);
    const firstName = profile?.full_name?.split(' ')[0] || 'Student';

    const openTool = (toolId) => {
        if (toolId === 'j-compiler') navigate('/compiler');
        else if (toolId === 'podcast-class') navigate('/podcast-classes');
        else navigate(`/${toolId}`);
    };

    return (
        <div className="studio-shell">
            <div className="studio-ambient" aria-hidden="true">
                <span className="studio-ambient-grid" />
                <span className="studio-ambient-glare" />
            </div>

            <nav className="studio-nav">
                <div className="studio-nav-brand">
                    <button
                        className="studio-icon-button"
                        onClick={() => navigate('/')}
                        aria-label="Back to home"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="studio-brand-mark">
                        <Sparkles size={19} />
                    </div>
                    <div className="studio-brand-copy">
                        <h1>HOPE Studio</h1>
                        <span>Autonomous academic workspace</span>
                    </div>
                </div>

                <div className="studio-nav-actions">
                    <div className="studio-status-pill">
                        <ShieldCheck size={15} />
                        <span>Engineering Module</span>
                    </div>
                    <button
                        onClick={() => setVaultOpen(true)}
                        className="studio-icon-button"
                        aria-label="AI Provider Settings"
                    >
                        <Settings size={17} />
                    </button>
                    <button
                        onClick={() => navigate('/docs')}
                        className="studio-primary-button"
                    >
                        <FilePlus2 size={17} />
                        <span className="d-none d-sm-inline">New Document</span>
                    </button>
                </div>
            </nav>

            <main className="studio-main">
                <section className="studio-hero">
                    <MotionDiv
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="studio-hero-copy"
                    >
                        <span className="studio-kicker">
                            <Compass size={15} />
                            Command Center
                        </span>
                        <h2>{profile?.full_name ? `Welcome back, ${firstName}` : 'Welcome to HOPE Studio'}</h2>
                        <p>Launch your academic engines, generate documents, build projects, and move directly into AI-guided learning workflows.</p>

                        <div className="studio-hero-actions">
                            <button onClick={() => navigate('/ai-chat')} className="studio-primary-button is-large">
                                <MessageSquare size={18} />
                                Start AI Chat
                            </button>
                            <button onClick={() => setVaultOpen(true)} className="studio-secondary-button">
                                <KeyRound size={17} />
                                Provider Settings
                            </button>
                        </div>

                        <div className="studio-metric-row">
                            <div>
                                <strong>{allTools.length}</strong>
                                <span>Studio tools</span>
                            </div>
                            <div>
                                <strong>3</strong>
                                <span>Work modes</span>
                            </div>
                            <div>
                                <strong>Live</strong>
                                <span>AI routing</span>
                            </div>
                        </div>
                    </MotionDiv>

                    <MotionDiv
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.06 }}
                        className="studio-command-panel"
                    >
                        <div className="studio-command-header">
                            <div>
                                <span>Core Assistant</span>
                                <h3>Engineering AI Assistant</h3>
                            </div>
                            <Bot size={26} />
                        </div>

                        <button onClick={() => navigate('/ai-chat')} className="studio-chat-card">
                            <span>
                                <MessageSquare size={22} />
                            </span>
                            <div>
                                <strong>Ask, solve, debug</strong>
                                <small>Use files, prompts, explanations, and code support in one place.</small>
                            </div>
                            <ChevronRight size={20} />
                        </button>

                        <div className="studio-signal-grid">
                            <div>
                                <Gauge size={18} />
                                <span>Fast launch</span>
                            </div>
                            <div>
                                <Layers3 size={18} />
                                <span>Multi-tool</span>
                            </div>
                            <div>
                                <Radio size={18} />
                                <span>Context ready</span>
                            </div>
                        </div>
                    </MotionDiv>
                </section>

                <section className="studio-layout">
                    <div className="studio-tool-stack">
                        {studioTools.map((group, groupIndex) => {
                            const GroupIcon = group.icon;
                            return (
                                <MotionDiv
                                    key={group.group}
                                    initial={{ opacity: 0, y: 18 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.04 * groupIndex }}
                                    className="studio-tool-section"
                                >
                                    <div className="studio-section-header">
                                        <div>
                                            <GroupIcon size={18} />
                                            <h3>{group.group}</h3>
                                        </div>
                                        <span>{group.tools.length} tools</span>
                                    </div>

                                    <div className="studio-tool-grid">
                                        {group.tools.map((tool) => {
                                            const ToolIcon = tool.icon;
                                            return (
                                                <button
                                                    key={tool.id}
                                                    type="button"
                                                    onClick={() => openTool(tool.id)}
                                                    className="studio-tool-card"
                                                    style={{ '--tool-accent': tool.accent }}
                                                >
                                                    {tool.badge && <span className="studio-tool-badge">{tool.badge}</span>}
                                                    <span className="studio-tool-icon">
                                                        <ToolIcon size={22} />
                                                    </span>
                                                    <strong>{tool.title}</strong>
                                                    <p>{tool.desc}</p>
                                                    <span className="studio-open-link">
                                                        Open <ChevronRight size={15} />
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </MotionDiv>
                            );
                        })}
                    </div>

                    <aside className="studio-side-rail">
                        <div className="studio-rail-card">
                            <div className="studio-rail-title">
                                <Activity size={17} />
                                <span>Workspace Signal</span>
                            </div>
                            <div className="studio-rail-list">
                                <div>
                                    <span>Student</span>
                                    <strong>{profile?.full_name || 'Guest User'}</strong>
                                </div>
                                <div>
                                    <span>Department</span>
                                    <strong>{profile?.department || 'IES Student'}</strong>
                                </div>
                                <div>
                                    <span>Semester</span>
                                    <strong>{profile?.semester || 'N/A'}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="studio-rail-card">
                            <div className="studio-rail-title">
                                <KeyRound size={17} />
                                <span>AI Provider Vault</span>
                            </div>
                            <p className="studio-rail-copy">Manage provider keys before launching generation-heavy tools.</p>
                            <button onClick={() => setVaultOpen(true)} className="studio-secondary-button is-full">
                                <Settings size={16} />
                                Open Vault
                            </button>
                        </div>

                        <div className="studio-rail-card is-compact">
                            <MonitorPlay size={20} />
                            <div>
                                <strong>Studio Ready</strong>
                                <span>Pick a workflow and continue.</span>
                            </div>
                        </div>
                    </aside>
                </section>
            </main>


            {/* AI Key Vault Modal */}
            <APIKeyVault isOpen={vaultOpen} onClose={() => setVaultOpen(false)} />
        </div>
    );
};

export default AITutorDashboard;
