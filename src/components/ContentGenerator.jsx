import React, { useState } from 'react';
import PptxGenJS from 'pptxgenjs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AgenticPPTGenerator from './AgenticPPTGenerator';
import ProjectGenerator from './ProjectGenerator';

const ContentGenerator = ({ onBack, initialType = null }) => {
    const [step, setStep] = useState(initialType ? 2 : 1); // 1: Select Type, 2: Input Details, 3: Generating/Preview
    const [contentType, setContentType] = useState(initialType); // 'presentation', 'report', 'assignment'
    const [generationMode, setGenerationMode] = useState('quick'); // 'quick' | 'agentic'
    const [formData, setFormData] = useState({
        topic: '',
        audience: 'University Students',
        tone: 'Academic',
        slideCount: 5,
        details: ''
    });
    const [loading, setLoading] = useState(false);
    const [generatedContent, setGeneratedContent] = useState(null);
    const [error, setError] = useState(null);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);

        try {
            // PROMPT ENGINEERING FOR AURORA-ALPHA
            let prompt = "";
            if (contentType === 'presentation') {
                prompt = `Generate a high-quality ${formData.slideCount}-slide presentation deck on "${formData.topic}". 
 Audience: ${formData.audience}. Tone: ${formData.tone}.
 OUTPUT FORMAT: JSON ONLY.
 
 Structure:
 {
   "title": "Main Presentation Title",
   "subtitle": "Informative subtitle",
   "theme": "simple" | "corporate" | "academic" | "modern", 
   "slides": [
     { 
       "title": "Slide Title", 
       "layout": "title_content" | "two_column" | "quote",
       "bullets": ["Point 1", "Point 2"], 
       "extraContent": "Additional context or quote",
       "iconHint": "lucide icon name (e.g., Code, Cpu, Book, Zap, Activity, Shield)"
     }
   ]
 }
 
 LAYOUT RULES:
 - "quote": extraContent is the main quote.
 - "two_column": bullets are split evenly.
 - "title_content": standard title and bullet list.
 
 ALWAYS prioritize simplicity, useful content, and maximum readability.`;
            } else if (contentType === 'report') {
                prompt = `Generate a detailed academic report on "${formData.topic}". 
 Audience: ${formData.audience}. Tone: ${formData.tone}.
 OUTPUT FORMAT: JSON ONLY.
 Structure:
 {
   "title": "Report Title",
   "sections": [
     { "heading": "Section Heading", "content": "Paragraph content..." }
   ]
 }`;
            } else if (contentType === 'assignment') {
                prompt = `Generate an assignment on "${formData.topic}". 
 Level: ${formData.audience}.
 OUTPUT FORMAT: JSON ONLY.
 Structure:
 {
   "title": "Assignment Title",
   "questions": [
     { "question": "Question text?", "marks": "5", "answerKey": "Brief answer" }
   ]
 }`;
            }

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.origin,
                    "X-Title": "IES Notes AI"
                },
                body: JSON.stringify({
                    "model": "google/gemini-2.0-flash-001",
                    "messages": [
                        { "role": "system", "content": "You are a helpful academic assistant. You generate structured content in strict JSON format. IMPORTANT: Only return the JSON object, do not include markdown code blocks or any other text." },
                        { "role": "user", "content": prompt }
                    ],
                    "response_format": { "type": "json_object" }
                })
            });

            if (!response.ok) throw new Error("AI Generation Failed");

            const data = await response.json();
            let aiText = data.choices[0].message.content;

            // Clean markdown code blocks if present
            aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsedContent = JSON.parse(aiText);
            setGeneratedContent(parsedContent);
            setStep(3);

        } catch (err) {
            console.error(err);
            setError("Failed to generate content. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const downloadPPT = () => {
        if (!generatedContent) return;
        const pres = new PptxGenJS();

        const themes = {
            simple: { bg: 'FFFFFF', primary: '3182CE', text: '1A202C' },
            corporate: { bg: 'F7FAFC', primary: '2C5282', text: '2D3748' },
            academic: { bg: 'FFFFFF', primary: '4A5568', text: '1A202C' },
            modern: { bg: 'FFFFFF', primary: '805AD5', text: '2D3748' }
        };
        const theme = themes[generatedContent.theme] || themes.simple;

        pres.defineSlideMaster({
            title: 'MASTER_SLIDE',
            background: { color: theme.bg },
            footer: { x: 1, y: 7.2, h: 0.3, text: 'Generated by IES Notes AI', fontSize: 10, color: '718096' },
            margin: [0.5, 0.5, 0.5, 0.5]
        });

        let slide = pres.addSlide({ masterName: 'MASTER_SLIDE' });
        slide.addText(generatedContent.title, {
            x: 0.5, y: 2.5, w: 9.0, fontSize: 44, align: 'center', bold: true, color: theme.primary,
            fontFace: 'Arial'
        });
        if (generatedContent.subtitle) {
            slide.addText(generatedContent.subtitle, {
                x: 0.5, y: 3.5, w: 9.0, fontSize: 24, align: 'center', color: '4A5568',
                italic: true
            });
        }

        generatedContent.slides.forEach(s => {
            slide = pres.addSlide({ masterName: 'MASTER_SLIDE' });
            slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.05, fill: { color: theme.primary } });
            slide.addText(s.title, { x: 0.5, y: 0.5, w: '90%', fontSize: 32, bold: true, color: theme.primary });

            if (s.layout === 'two_column') {
                const mid = Math.ceil(s.bullets.length / 2);
                slide.addText(s.bullets.slice(0, mid).map(b => ({ text: b, options: { bullet: true } })), { x: 0.5, y: 1.5, w: '4.5', h: '5.0', fontSize: 18, color: theme.text });
                slide.addText(s.bullets.slice(mid).map(b => ({ text: b, options: { bullet: true } })), { x: 5.0, y: 1.5, w: '4.5', h: '5.0', fontSize: 18, color: theme.text });
            } else if (s.layout === 'quote') {
                slide.addShape(pres.ShapeType.rect, { x: 1, y: 2, w: 8, h: 3, fill: { color: 'F7FAFC' }, line: { color: theme.primary, width: 2 } });
                slide.addText(s.extraContent || s.bullets[0], {
                    x: 1.5, y: 2.5, w: 7.0, fontSize: 28, align: 'center', color: theme.primary, italic: true
                });
            } else {
                slide.addText(s.bullets.map(b => ({ text: b, options: { bullet: true } })), { x: 0.5, y: 1.5, w: 9.0, h: '5.0', fontSize: 18, color: theme.text });
            }
        });

        pres.writeFile({ fileName: `${formData.topic.replace(/\s+/g, '_')}_Presentation.pptx` });
    };

    const downloadPDF = () => {
        if (!generatedContent) return;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 20;

        const addText = (text, size, isBold = false) => {
            doc.setFontSize(size);
            doc.setFont("helvetica", isBold ? "bold" : "normal");
            const splitText = doc.splitTextToSize(text, pageWidth - 40);
            doc.text(splitText, 20, y);
            y += splitText.length * (size / 2) + 5;
            if (y > 280) { doc.addPage(); y = 20; }
        };

        addText(generatedContent.title, 22, true);
        y += 10;

        if (contentType === 'report') {
            generatedContent.sections.forEach(section => {
                addText(section.heading, 16, true);
                addText(section.content, 12, false);
                y += 5;
            });
        } else if (contentType === 'assignment') {
            generatedContent.questions.forEach((q, i) => {
                addText(`Q${i + 1}: ${q.question} (${q.marks} marks)`, 12, true);
                addText(`Answer Key: ${q.answerKey}`, 10, false);
                y += 5;
            });
        }

        doc.save(`${formData.topic.replace(/\s+/g, '_')}_${contentType}.pdf`);
    };

    const containerVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
    };

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={step}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="d-flex flex-column h-100 w-100"
            >
                {/* Custom handling for Project Apps */}
                {(contentType === 'mini-project' || contentType === 'final-project') ? (
                    <ProjectGenerator type={contentType} onBack={onBack} />
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-4 d-flex align-items-center mb-4">
                            <button
                                onClick={() => step === 2 ? onBack() : setStep(2)}
                                className="btn btn-secondary rounded-circle p-2 shadow-sm d-flex align-items-center justify-content-center me-3"
                                style={{ width: 44, height: 44 }}
                            >
                                <Icons.ArrowLeft size={20} className="text-white" />
                            </button>
                            <div>
                                <h2 className="fw-bold m-0 d-flex align-items-center gap-2 text-dark">
                                    <Icons.Sparkles size={24} className="text-primary" />
                                    AI Content Generator
                                </h2>
                                <p className="text-muted m-0 small">Create study materials instantly</p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-grow-1 overflow-auto px-4 pb-5 custom-scrollbar">
                            {step === 2 && (
                                <div className="container" style={{ maxWidth: '600px' }}>
                                    <h3 className="fw-bold mb-4 text-dark">Customize your {contentType}</h3>
                                    <div className="mb-4">
                                        <label className="form-label fw-bold text-muted small text-uppercase">Topic</label>
                                        <input
                                            type="text"
                                            className="clay-input"
                                            placeholder="e.g. Artificial Intelligence in 2025"
                                            value={formData.topic}
                                            onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                        />
                                    </div>

                                    <div className="row g-4 mb-4">
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold text-muted small text-uppercase">Target Audience</label>
                                            <select className="clay-input form-select" value={formData.audience} onChange={e => setFormData({ ...formData, audience: e.target.value })}>
                                                <option>High School Students</option>
                                                <option>University Students</option>
                                                <option>Professionals</option>
                                                <option>General Public</option>
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold text-muted small text-uppercase">Tone</label>
                                            <select className="clay-input form-select" value={formData.tone} onChange={e => setFormData({ ...formData, tone: e.target.value })}>
                                                <option>Academic</option>
                                                <option>Casual</option>
                                                <option>Professional</option>
                                                <option>Creative</option>
                                            </select>
                                        </div>
                                    </div>

                                    {contentType === 'presentation' && (
                                        <div className="mb-4">
                                            <label className="form-label fw-bold text-muted small text-uppercase">Generation Mode</label>
                                            <div className="d-flex gap-3">
                                                <div
                                                    className={`p-3 rounded border cursor-pointer flex-grow-1 ${generationMode === 'quick' ? 'border-primary bg-primary bg-opacity-10' : 'bg-light'}`}
                                                    onClick={() => setGenerationMode('quick')}
                                                >
                                                    <div className="fw-bold"><Icons.Zap size={16} className="me-1 text-warning" /> Quick PPTX</div>
                                                </div>
                                                <div
                                                    className={`p-3 rounded border cursor-pointer flex-grow-1 ${generationMode === 'agentic' ? 'border-primary bg-primary bg-opacity-10' : 'bg-light'}`}
                                                    onClick={() => setGenerationMode('agentic')}
                                                >
                                                    <div className="fw-bold"><Icons.Bot size={16} className="me-1 text-info" /> Agentic Web Slides</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        className="clay-button w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 fs-5 shadow-lg"
                                        onClick={() => {
                                            if (generationMode === 'agentic' && contentType === 'presentation') setStep(4);
                                            else handleGenerate();
                                        }}
                                        disabled={!formData.topic || loading}
                                    >
                                        {loading ? <span className="spinner-border spinner-border-sm"></span> : <>Start Generation <Icons.Sparkles size={20} /></>}
                                    </button>
                                </div>
                            )}

                            {step === 4 && contentType === 'presentation' && (
                                <AgenticPPTGenerator topic={formData.topic} details={formData.details} onBack={() => setStep(2)} />
                            )}

                            {step === 3 && generatedContent && (
                                <div className="container h-100 flex-column d-flex">
                                    <div className="text-center mb-4">
                                        <h2 className="fw-bold text-dark">{generatedContent.title}</h2>
                                    </div>

                                    <div className="flex-grow-1 overflow-auto p-4 mb-4 rounded-4 border bg-light custom-scrollbar">
                                        {contentType === 'presentation' && (
                                            <div className="d-flex flex-column gap-4 align-items-center">
                                                {generatedContent.slides.map((slide, idx) => (
                                                    <div key={idx} className="bg-white shadow p-5 border rounded-3 w-100" style={{ maxWidth: '800px', aspectRatio: '16/9' }}>
                                                        <h3 className="fw-bold mb-4 text-primary border-bottom pb-2">{slide.title}</h3>
                                                        <ul className="fs-5">
                                                            {slide.bullets.map((b, i) => <li key={i} className="mb-2">{b}</li>)}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {contentType === 'report' && (
                                            <div className="bg-white p-5 shadow rounded-4 border mx-auto" style={{ maxWidth: '800px' }}>
                                                {generatedContent.sections.map((section, idx) => (
                                                    <div key={idx} className="mb-4">
                                                        <h4 className="fw-bold text-primary">{section.heading}</h4>
                                                        <p className="fs-5" style={{ lineHeight: '1.7' }}>{section.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {contentType === 'assignment' && (
                                            <div className="bg-white p-5 shadow rounded-4 border mx-auto" style={{ maxWidth: '800px' }}>
                                                {generatedContent.questions.map((q, idx) => (
                                                    <div key={idx} className="mb-4 p-3 border rounded bg-light">
                                                        <h5 className="fw-bold">Q{idx + 1}: {q.question}</h5>
                                                        <p className="text-success mb-0">Key: {q.answerKey}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="d-flex gap-3 justify-content-center pb-4">
                                        <button className="btn btn-secondary rounded-pill px-4" onClick={() => setStep(2)}>Edit</button>
                                        <button className="btn btn-primary rounded-pill px-5 fw-bold" onClick={contentType === 'presentation' ? downloadPPT : downloadPDF}>
                                            <Icons.Download size={20} className="me-2" /> Download
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default ContentGenerator;
