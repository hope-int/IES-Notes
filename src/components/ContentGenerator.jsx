import React, { useState } from 'react';
import PptxGenJS from 'pptxgenjs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ContentGenerator = ({ onBack, initialType = null }) => {
    const [step, setStep] = useState(initialType ? 2 : 1); // 1: Select Type, 2: Input Details, 3: Generating/Preview
    const [contentType, setContentType] = useState(initialType); // 'presentation', 'report', 'assignment'
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

    const handleTypeSelect = (type) => {
        setContentType(type);
        setStep(2);
    };

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

        // Define Master Slides
        pres.defineSlideMaster({
            title: 'MASTER_SLIDE',
            background: { color: theme.bg },
            footer: { x: 1, y: 7.2, h: 0.3, text: 'Generated by IES Notes AI', fontSize: 10, color: '718096' },
            margin: [0.5, 0.5, 0.5, 0.5]
        });

        // Title Slide
        let slide = pres.addSlide({ masterName: 'MASTER_SLIDE' });

        // Large Center Title
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

        // Content Slides
        generatedContent.slides.forEach(s => {
            slide = pres.addSlide({ masterName: 'MASTER_SLIDE' });

            // Subtle Top Border Accent
            slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.05, fill: { color: theme.primary } });

            // Title
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

        // Helper for text wrapping
        const addText = (text, size, isBold = false) => {
            doc.setFontSize(size);
            doc.setFont("helvetica", isBold ? "bold" : "normal");
            const splitText = doc.splitTextToSize(text, pageWidth - 40);
            doc.text(splitText, 20, y);
            y += splitText.length * (size / 2) + 5; // simplified line height
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
                {/* Header */}
                <div className="p-4 d-flex align-items-center mb-4">
                    <button
                        onClick={() => step === 2 ? onBack() : setStep(2)}
                        className="btn btn-light rounded-circle p-2 shadow-sm d-flex align-items-center justify-content-center me-3"
                        style={{ width: 44, height: 44 }}
                    >
                        <Icons.ArrowLeft size={20} className="text-muted" />
                    </button>
                    <div>
                        <h2 className="fw-bold m-0 d-flex align-items-center gap-2">
                            <Icons.Sparkles size={24} className="text-primary" />
                            AI Content Generator
                        </h2>
                        <p className="text-muted m-0 small">Create study materials instantly</p>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-grow-1 overflow-auto px-4 pb-5 custom-scrollbar">

                    {/* Step 2: Input Form */}
                    {step === 2 && (
                        <div className="container" style={{ maxWidth: '600px' }}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="clay-card p-5 border-0"
                            >
                                <h3 className="fw-bold mb-4">Customize your {contentType}</h3>
                                <div className="mb-4">
                                    <label className="form-label fw-bold text-muted small text-uppercase">Topic</label>
                                    <input
                                        type="text"
                                        className="clay-input"
                                        placeholder="e.g. Artificial Intelligence in 2025"
                                        value={formData.topic}
                                        onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                        autoFocus
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
                                        <label className="form-label fw-bold text-muted small text-uppercase">Number of Slides</label>
                                        <input
                                            type="number"
                                            className="clay-input"
                                            min="3" max="15"
                                            value={formData.slideCount}
                                            onChange={e => setFormData({ ...formData, slideCount: e.target.value })}
                                        />
                                    </div>
                                )}

                                <div className="mb-5">
                                    <label className="form-label fw-bold text-muted small text-uppercase">Additional Details</label>
                                    <textarea
                                        className="clay-input"
                                        rows="3"
                                        placeholder="Any specific points to include?"
                                        value={formData.details}
                                        onChange={e => setFormData({ ...formData, details: e.target.value })}
                                    ></textarea>
                                </div>

                                <button
                                    className="clay-button w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 fs-5 shadow-lg"
                                    onClick={handleGenerate}
                                    disabled={!formData.topic || loading}
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            Generate Content <Icons.Sparkles size={20} />
                                        </>
                                    )}
                                </button>
                                {error && <div className="alert alert-danger mt-3 rounded-4">{error}</div>}
                            </motion.div>
                        </div>
                    )}

                    {/* Step 3: Preview & Download */}
                    {step === 3 && generatedContent && (
                        <div className="container h-100 d-flex flex-column" style={{ maxWidth: '1000px' }}>
                            <div className="text-center mb-4">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="d-inline-flex align-items-center gap-2 bg-success bg-opacity-10 text-success px-4 py-2 rounded-pill mb-3 fw-bold"
                                >
                                    <Icons.CheckCircle size={20} /> Generated Successfully
                                </motion.div>
                                <h2 className="fw-bold">{generatedContent.title}</h2>
                            </div>

                            <div className="flex-grow-1 overflow-auto p-4 mb-4 rounded-4 border bg-light shadow-inner">
                                {/* Preview Logic */}
                                {contentType === 'presentation' && (
                                    <div className="d-flex flex-column gap-5 align-items-center">
                                        {/* Virtual Title Slide */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-white shadow-lg overflow-hidden flex-shrink-0 border rounded-3"
                                            style={{
                                                width: '100%',
                                                maxWidth: '800px',
                                                aspectRatio: '16/9',
                                                position: 'relative',
                                                background: generatedContent.theme === 'corporate' ? '#f7fafc' : '#ffffff'
                                            }}
                                        >
                                            <div
                                                className="position-absolute top-0 start-0 w-100"
                                                style={{ height: '6px', background: generatedContent.theme === 'corporate' ? '#2c5282' : '#3182ce' }}
                                            ></div>
                                            <div className="h-100 w-100 d-flex flex-column align-items-center justify-content-center p-5 text-center">
                                                <h1 className="fw-bold display-4 text-dark mb-3" style={{ color: generatedContent.theme === 'corporate' ? '#2c5282' : '#1a202c' }}>
                                                    {generatedContent.title}
                                                </h1>
                                                <h4 className="text-muted fst-italic">{generatedContent.subtitle}</h4>
                                                <div className="position-absolute bottom-0 w-100 p-3 border-top small text-muted">Generated by IES Notes AI</div>
                                            </div>
                                        </motion.div>

                                        {/* Content Slides */}
                                        {generatedContent.slides.map((slide, idx) => {
                                            const IconComp = slide.iconHint ? Icons[slide.iconHint] || Icons.Sparkles : Icons.Sparkles;
                                            const themeColor = generatedContent.theme === 'corporate' ? '#2c5282' : '#3182ce';

                                            return (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    whileInView={{ opacity: 1, y: 0 }}
                                                    viewport={{ once: true }}
                                                    key={idx}
                                                    className="bg-white shadow-lg overflow-hidden flex-shrink-0 border rounded-3"
                                                    style={{
                                                        width: '100%',
                                                        maxWidth: '800px',
                                                        aspectRatio: '16/9',
                                                        position: 'relative',
                                                        background: generatedContent.theme === 'corporate' ? '#f7fafc' : '#ffffff'
                                                    }}
                                                >
                                                    <div className="position-absolute top-0 start-0 w-100" style={{ height: '6px', background: themeColor }}></div>
                                                    <div className="h-100 w-100 p-5 position-relative">
                                                        <div className="d-flex align-items-center justify-content-between mb-4 pb-2 border-bottom">
                                                            <h2 className="fw-bold m-0" style={{ color: themeColor }}>{slide.title}</h2>
                                                            <div style={{ color: themeColor, opacity: 0.3 }}>
                                                                <IconComp size={32} />
                                                            </div>
                                                        </div>

                                                        {slide.layout === 'two_column' ? (
                                                            <div className="row g-5 mt-2">
                                                                <div className="col-6">
                                                                    <ul className="fs-5 text-dark" style={{ lineHeight: '1.6' }}>
                                                                        {slide.bullets.slice(0, Math.ceil(slide.bullets.length / 2)).map((b, i) => <li key={i} className="mb-2">{b}</li>)}
                                                                    </ul>
                                                                </div>
                                                                <div className="col-6">
                                                                    <ul className="fs-5 text-dark" style={{ lineHeight: '1.6' }}>
                                                                        {slide.bullets.slice(Math.ceil(slide.bullets.length / 2)).map((b, i) => <li key={i} className="mb-2">{b}</li>)}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        ) : slide.layout === 'quote' ? (
                                                            <div className="h-75 d-flex align-items-center justify-content-center p-4">
                                                                <div className="p-5 border-start border-4 rounded bg-light w-100" style={{ borderColor: themeColor + ' !important' }}>
                                                                    <p className="display-6 fst-italic mb-0" style={{ color: themeColor }}>
                                                                        "{slide.extraContent || slide.bullets[0]}"
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <ul className="fs-4 text-dark mt-3" style={{ lineHeight: '1.8' }}>
                                                                {slide.bullets.map((b, i) => <li key={i} className="mb-3">{b}</li>)}
                                                            </ul>
                                                        )}

                                                        <div className="position-absolute bottom-0 end-0 p-3 small text-muted">Slide {idx + 2}</div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}

                                {contentType === 'report' && (
                                    <div className="bg-white p-5 shadow-sm rounded-4 border mx-auto" style={{ maxWidth: '800px', minHeight: '1000px' }}>
                                        <h2 className="text-center fw-bold mb-5 display-5">{generatedContent.title}</h2>
                                        {generatedContent.sections.map((section, idx) => (
                                            <div key={idx} className="mb-5">
                                                <h4 className="fw-bold border-bottom pb-2 mb-3 text-primary">{section.heading}</h4>
                                                <p className="text-justify fs-5" style={{ lineHeight: '1.8' }}>{section.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {contentType === 'assignment' && (
                                    <div className="bg-white p-5 shadow-sm rounded-4 border mx-auto" style={{ maxWidth: '800px', minHeight: '800px' }}>
                                        <h2 className="text-center fw-bold mb-5 display-5">{generatedContent.title}</h2>
                                        {generatedContent.questions.map((q, idx) => (
                                            <div key={idx} className="mb-4 p-4 border rounded-3 bg-light">
                                                <div className="d-flex justify-content-between mb-3">
                                                    <span className="fw-bold fs-5">Q{idx + 1}: {q.question}</span>
                                                    <span className="badge bg-secondary align-self-start">{q.marks} Marks</span>
                                                </div>
                                                <div className="p-3 bg-white rounded border border-dashed">
                                                    <p className="text-muted small mb-0 fw-bold text-uppercase">Answer Key</p>
                                                    <p className="mb-0 text-success">{q.answerKey}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="d-flex gap-3 justify-content-center pb-4">
                                <button className="btn btn-light rounded-pill px-4 py-2 border shadow-sm fw-bold" onClick={() => setStep(2)}>
                                    Back to Edit
                                </button>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="clay-button px-5 py-3 fw-bold d-flex align-items-center gap-2 shadow-lg"
                                    onClick={contentType === 'presentation' ? downloadPPT : downloadPDF}
                                >
                                    <Icons.Download size={20} />
                                    Download {contentType === 'presentation' ? 'PPTX' : 'PDF'}
                                </motion.button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ContentGenerator;

