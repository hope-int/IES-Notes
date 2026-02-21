import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Sparkles, MessageSquare, Presentation, FileText, FileSpreadsheet, Code, Cpu, Terminal, Mic, BookOpen, ArrowLeft, Menu, Bot, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const AITutorDashboard = () => {
    const { userProfile: profile } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="min-vh-100 bg-white">
            {/* Simple Clean Header */}
            <nav className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom sticky-top bg-white">
                <div className="d-flex align-items-center gap-3">
                    <button
                        className="btn btn-outline-secondary rounded-circle p-0 d-flex align-items-center justify-content-center"
                        onClick={() => navigate('/')}
                        style={{ width: 36, height: 36 }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="d-flex align-items-center gap-2">
                        <Sparkles size={20} className="text-primary" />
                        <span className="fw-bold text-dark fs-5">HOPE Studio</span>
                    </div>
                </div>
                <div className="d-flex align-items-center gap-3">
                    <button
                        onClick={() => navigate('/docs')}
                        className="btn btn-primary rounded-pill px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm"
                    >
                        <FileText size={18} />
                        <span className="d-none d-sm-inline">New Document</span>
                    </button>
                    <div className="d-none d-md-block">
                        <span className="badge bg-light text-primary border border-primary border-opacity-25 px-3 py-2 rounded-pill">
                            Engineering Module
                        </span>
                    </div>
                </div>
            </nav>

            <div className="container py-5">
                {/* Simplified Welcome Section */}
                <div className="mb-5">
                    <h1 className="fw-bold text-dark mb-2">
                        {profile?.full_name ? `Welcome back, ${profile.full_name.split(' ')[0]}` : "Welcome to HOPE Studio"}
                    </h1>
                    <p className="text-muted fs-5">Select a tool to start your engineering research.</p>
                </div>

                {/* Simplified AI Chat Hero Card */}
                <div
                    className="card border-0 shadow-sm mb-5 overflow-hidden transition-all hover-shadow-glow cursor-pointer"
                    onClick={() => navigate('/ai-chat')}
                    style={{ borderRadius: '20px', border: '1px solid #eef2ff' }}
                >
                    <div className="card-body p-4 p-md-5 d-flex flex-column flex-md-row align-items-center gap-4">
                        <div className="bg-primary bg-opacity-10 p-4 rounded-4 text-primary">
                            <MessageSquare size={40} strokeWidth={2} />
                        </div>
                        <div className="flex-grow-1 text-center text-md-start">
                            <h3 className="fw-bold text-dark mb-2">Engineering AI Assistant</h3>
                            <p className="text-muted mb-0">Ask questions, solve equations, and debug your code with real-time AI guidance.</p>
                        </div>
                        <div className="btn btn-primary px-4 py-2 rounded-pill fw-bold d-flex align-items-center gap-2">
                            Start Chatting <ChevronRight size={18} />
                        </div>
                    </div>
                </div>

                {/* Academic Tools Grid */}
                <div className="mb-4">
                    <h5 className="fw-bold text-dark mb-4 d-flex align-items-center gap-2">
                        <div className="bg-primary rounded-circle" style={{ width: 8, height: 8 }}></div>
                        Academic Master Tools
                    </h5>

                    <div className="row g-3">
                        {[
                            { id: 'roadmap', icon: Sparkles, title: "Study Roadmap", desc: "AI-powered career paths.", color: '#f59e0b', beta: true },
                            { id: 'presentation', icon: Presentation, title: "AI Presentation", desc: "Instant slide generation.", color: '#3b82f6', beta: true },
                            { id: 'handbook', icon: BookOpen, title: "Revision Kit", desc: "Concise exam-ready notes.", color: '#2563eb' },
                            { id: 'j-compiler', icon: Terminal, title: "J-Compiler", desc: "Interactive AI Code Sim.", color: '#1e293b' },
                            { id: 'report', icon: FileText, title: "Academic Report", desc: "Draft professional reports.", color: '#059669', beta: true },
                            { id: 'mini-project', icon: Code, title: "Project Designer", desc: "Prototypes & logic flows.", color: '#0891b2', beta: true },
                            { id: 'assignment', icon: Sparkles, title: "Assignment Helper", desc: "Smart quiz & task gen.", color: '#ea580c', beta: true },
                            { id: 'podcast-class', icon: Mic, title: "Podcast Class", desc: "Notes to immersive audio.", color: '#db2777', beta: true },
                            { id: 'docs', icon: FileText, title: "HOPE Docs", desc: "Premium writing suite.", color: '#7c3aed', beta: true },
                            { id: 'sheets', icon: FileSpreadsheet, title: "HOPE Sheets", desc: "Engineering spreadsheets.", color: '#059669', beta: true }
                        ].map((tool) => (
                            <div key={tool.id} className="col-lg-3 col-md-4 col-sm-6">
                                <div
                                    className="card h-100 border border-light shadow-sm transition-all hover-scale cursor-pointer position-relative"
                                    onClick={() => {
                                        if (tool.id === 'j-compiler') navigate('/compiler');
                                        else if (tool.id === 'podcast-class') navigate('/podcast-classes');
                                        else navigate(`/${tool.id}`);
                                    }}
                                    style={{ borderRadius: '16px' }}
                                >
                                    {tool.beta && (
                                        <div
                                            className="position-absolute top-0 end-0 m-2 px-2 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-wider bg-primary bg-opacity-10 text-primary border border-primary border-opacity-20"
                                            style={{ fontSize: '10px' }}
                                        >
                                            Beta
                                        </div>
                                    )}
                                    <div className="card-body p-4 text-center">
                                        <div
                                            className="d-inline-flex align-items-center justify-content-center mb-3 rounded-circle shadow-sm"
                                            style={{
                                                width: '50px',
                                                height: '50px',
                                                backgroundColor: tool.color + '10', // 10% opacity
                                                color: tool.color
                                            }}
                                        >
                                            <tool.icon size={22} />
                                        </div>
                                        <h6 className="fw-bold text-dark mb-1">{tool.title}</h6>
                                        <p className="text-muted small mb-0">{tool.desc}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                .hover-shadow-glow:hover {
                    box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.15) !important;
                    background-color: #f8faff;
                }
                .hover-scale {
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .hover-scale:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 8px 20px -6px rgba(0,0,0,0.1) !important;
                    border-color: #3b82f6 !important;
                }
            `}</style>
        </div>
    );
};

export default AITutorDashboard;
