import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Code, FileText, CheckCircle, Loader2, Download, MessageSquare, Send, Sparkles, Box } from 'lucide-react';
import JSZip from 'jszip';

const ProjectBuilder = ({ type, onBack }) => {
    const [step, setStep] = useState('topic'); // topic -> interview -> generating -> completed
    const [topic, setTopic] = useState('');
    const [interview, setInterview] = useState([]); // { q: string, a: string }
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
    const [isGeneratingProject, setIsGeneratingProject] = useState(false);
    const [projectData, setProjectData] = useState(null); // { abstract, report, code: [] }
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => setLogs(prev => [...prev, { id: Date.now(), msg }]);

    const generateQuestions = async () => {
        if (!topic.trim()) return;
        setIsGeneratingQuestions(true);
        addLog("Analyzing topic scope...");

        try {
            const prompt = `You are a project supervisor. For a ${type === 'mini-project' ? 'Mini Project' : 'Final Year Major Project'} on topic "${topic}", 
            list 5 essential personalized architectural or functional questions to ask the student to define the project scope.
            Return ONLY a JSON array of 5 strings.
            Example: ["What technology stack do you prefer?", "Which specific module will be your main focus?"]`;

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": "openrouter/aurora-alpha",
                    "messages": [{ "role": "user", "content": prompt }],
                    "response_format": { "type": "json_object" }
                })
            });

            const data = await response.json();
            const resText = data.choices[0].message.content;
            const cleaned = resText.replace(/```json/g, '').replace(/```/g, '').trim();
            const questions = JSON.parse(cleaned).questions || JSON.parse(cleaned); // handle different JSON structures

            setInterview(Array.isArray(questions) ? questions.map(q => ({ q, a: '' })) : []);
            setStep('interview');
            addLog("Questions generated. Starting interview.");
        } catch (e) {
            console.error(e);
            addLog("Error generating questions. Retrying...");
        } finally {
            setIsGeneratingQuestions(false);
        }
    };

    const handleAnswer = () => {
        if (!currentAnswer.trim()) return;
        const updated = [...interview];
        updated[currentQuestionIndex].a = currentAnswer;
        setInterview(updated);
        setCurrentAnswer('');

        if (currentQuestionIndex < interview.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            generateFullProject();
        }
    };

    const generateFullProject = async () => {
        setStep('generating');
        setIsGeneratingProject(true);
        addLog("Compiling project intelligence...");

        const interviewSummary = interview.map(i => `Q: ${i.q}\nA: ${i.a}`).join('\n');

        try {
            addLog("Creating technical abstract...");
            const abstractPrompt = `Generate a technical abstract for a ${type} project. Topic: ${topic}. \nContext:\n${interviewSummary}\nReturn as plan text.`;

            addLog("Structuring project report...");
            const reportPrompt = `Generate a structured project report (Chapters 1-5) for: ${topic}. \nContext:\n${interviewSummary}\nReturn in Markdown format.`;

            addLog("Writing source code files...");
            const codePrompt = `Generate the core source code files for this project. Return ONLY a JSON object where keys are filenames and values are the code content. Include a README.md. 
            Topic: ${topic}. \nContext:\n${interviewSummary}`;

            // We do these in parallel or sequence. Sequence is safer for context.
            const [abstractRes, reportRes, codeRes] = await Promise.all([
                fetchAI(abstractPrompt),
                fetchAI(reportPrompt),
                fetchAI(codePrompt, true) // expect JSON
            ]);

            setProjectData({
                abstract: abstractRes,
                report: reportRes,
                code: codeRes
            });

            setStep('completed');
            addLog("Project suite ready for download!");
        } catch (e) {
            console.error(e);
            addLog("Critical failure during generation.");
        } finally {
            setIsGeneratingProject(false);
        }
    };

    const fetchAI = async (prompt, isJson = false) => {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "openrouter/aurora-alpha",
                "messages": [{ "role": "user", "content": prompt }],
                ...(isJson && { "response_format": { "type": "json_object" } })
            })
        });
        const data = await response.json();
        let content = data.choices[0].message.content;
        if (isJson) {
            content = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(content);
        }
        return content;
    };

    const downloadZip = async () => {
        const zip = new JSZip();

        // Add Abstract
        zip.file("Abstract.txt", projectData.abstract);

        // Add Report
        zip.file("Project_Report.md", projectData.report);

        // Add Code folder
        const codeFolder = zip.folder("Source_Code");
        Object.entries(projectData.code).forEach(([filename, content]) => {
            // Handle nested folders if keys contain /
            codeFolder.file(filename, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
        });

        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${topic.replace(/\s+/g, '_')}_Project_Suite.zip`;
        link.click();
    };

    return (
        <div className="clay-card p-4 h-100 overflow-auto custom-scrollbar shadow-lg border-0" style={{ background: 'white' }}>
            <AnimatePresence mode="wait">
                {step === 'topic' && (
                    <motion.div key="topic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-5">
                        <div className="bg-primary bg-opacity-10 p-4 rounded-circle d-inline-block mb-4">
                            <Box size={48} className="text-primary" />
                        </div>
                        <h2 className="fw-bold mb-3">{type === 'mini-project' ? 'Mini Project Builder' : 'Final Year Project Suite'}</h2>
                        <p className="text-muted mb-4 px-md-5">Let's start your project journey. Enter your topic and I'll interview you to define the perfect scope.</p>

                        <div className="max-w-px-600 mx-auto">
                            <input
                                type="text"
                                className="form-control clay-input mb-3 py-3"
                                placeholder="E.g. Smart Attendance System using Face Recognition"
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                            />
                            <button
                                disabled={!topic.trim() || isGeneratingQuestions}
                                onClick={generateQuestions}
                                className="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow-lg d-flex align-items-center justify-content-center gap-2"
                            >
                                {isGeneratingQuestions ? <Loader2 className="spinner-border spinner-border-sm" /> : <Sparkles size={20} />}
                                Start Technical Interview
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 'interview' && (
                    <motion.div key="interview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="h-100 d-flex flex-column">
                        <div className="mb-4">
                            <span className="badge bg-primary rounded-pill mb-2">Interview {currentQuestionIndex + 1}/5</span>
                            <h3 className="fw-bold">{interview[currentQuestionIndex].q}</h3>
                        </div>

                        <div className="flex-grow-1">
                            <textarea
                                className="form-control clay-input h-100 p-4"
                                placeholder="Type your answer here..."
                                value={currentAnswer}
                                onChange={e => setCurrentAnswer(e.target.value)}
                                style={{ minHeight: '200px', resize: 'none' }}
                            />
                        </div>

                        <div className="mt-4 d-flex justify-content-between">
                            <button onClick={onBack} className="btn btn-light rounded-pill px-4">Exit</button>
                            <button
                                disabled={!currentAnswer.trim()}
                                onClick={handleAnswer}
                                className="btn btn-primary rounded-pill px-5 py-3 fw-bold d-flex align-items-center gap-2 shadow"
                            >
                                {currentQuestionIndex === 4 ? 'Finalize & Build Project' : 'Next Question'}
                                <ArrowLeft className="rotate-180" size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 'generating' && (
                    <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-100 d-flex flex-column align-items-center justify-content-center py-5">
                        <div className="position-relative mb-5">
                            <div className="spinner-border text-primary" style={{ width: '80px', height: '80px', borderWidth: '6px' }}></div>
                            <div className="position-absolute top-50 start-50 translate-middle">
                                <Code size={32} className="text-secondary" />
                            </div>
                        </div>
                        <h2 className="fw-bold mb-2">Building Your Project</h2>
                        <p className="text-muted mb-5">This usually takes 10-20 seconds. We are generating code, reports, and abstracts.</p>

                        <div className="w-100 max-w-px-500 bg-light p-3 rounded-4 custom-scrollbar overflow-auto" style={{ maxHeight: '200px' }}>
                            {logs.map(log => (
                                <div key={log.id} className="small text-muted mb-1 d-flex gap-2 align-items-center">
                                    <div className="bg-success rounded-circle" style={{ width: 6, height: 6 }}></div>
                                    {log.msg}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {step === 'completed' && (
                    <motion.div key="completed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
                        <div className="bg-success bg-opacity-10 p-4 rounded-circle d-inline-block mb-4 text-success">
                            <CheckCircle size={64} />
                        </div>
                        <h1 className="fw-bold mb-3">Project Built Successfully!</h1>
                        <p className="text-muted mb-5 px-md-5">Your complete project suite for "{topic}" is ready. This includes the technical abstract, a 5-chapter report, and the full source code structure.</p>

                        <div className="row g-3 max-w-px-600 mx-auto mb-5">
                            <div className="col-6">
                                <div className="p-3 border rounded-4 text-start h-100">
                                    <h6 className="fw-bold mb-1"><Code size={16} className="text-primary me-2" /> Source Code</h6>
                                    <small className="text-muted">{Object.keys(projectData.code).length} Files Included</small>
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="p-3 border rounded-4 text-start h-100">
                                    <h6 className="fw-bold mb-1"><FileText size={16} className="text-success me-2" /> Report</h6>
                                    <small className="text-muted">Full Markdown Suite</small>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={downloadZip}
                            className="btn btn-primary btn-lg rounded-pill px-5 py-3 fw-bold shadow-lg d-flex align-items-center justify-content-center gap-3 mx-auto"
                        >
                            <Download size={24} /> Download Project ZIP
                        </button>

                        <button onClick={onBack} className="btn btn-link mt-4 text-muted">Back to AI Tutor</button>
                    </motion.div>
                )}
            </AnimatePresence>
            <style>{`
                .max-w-px-600 { max-width: 600px; }
                .max-w-px-500 { max-width: 500px; }
                .rotate-180 { transform: rotate(180deg); }
            `}</style>
        </div>
    );
};

export default ProjectBuilder;
