import React, { useState } from 'react';
import jsPDF from 'jspdf';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAICompletion } from '../../utils/aiService';

const ReportGenerator = ({ onBack }) => {
    const [step, setStep] = useState(2); // Input
    const [formData, setFormData] = useState({
        topic: '',
        audience: 'University Students',
        tone: 'Academic',
        customInstructions: ''
    });
    const [loading, setLoading] = useState(false);
    const [generatedContent, setGeneratedContent] = useState(null);
    const [error, setError] = useState(null);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            const prompt = `Generate a detailed academic report on "${formData.topic}". 
 Audience: ${formData.audience}. Tone: ${formData.tone}.
 Custom Instructions: ${formData.customInstructions}
 OUTPUT FORMAT: JSON ONLY.
 Structure:
 {
   "title": "Report Title",
   "sections": [
     { "heading": "Section Heading", "content": "Paragraph content..." }
   ]
 }`;

            let aiText = await getAICompletion(
                [
                    { "role": "system", "content": "You are a helpful academic assistant. You generate structured content in strict JSON format. IMPORTANT: Only return the JSON object, do not include markdown code blocks or any other text." },
                    { "role": "user", "content": prompt }
                ],
                { jsonMode: true }
            );

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

        generatedContent.sections.forEach(section => {
            addText(section.heading, 16, true);
            addText(section.content, 12, false);
            y += 5;
        });

        doc.save(`${formData.topic.replace(/\s+/g, '_')}_Report.pdf`);
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
                className="d-flex flex-column h-100 w-100 min-vh-100 bg-light"
            >
                {/* Header */}
                <div className="p-4 d-flex align-items-center mb-4 bg-white shadow-sm sticky-top" style={{ zIndex: 100 }}>
                    <button
                        onClick={onBack}
                        className="btn btn-light rounded-circle p-2 shadow-sm d-flex align-items-center justify-content-center me-3 border"
                        style={{ width: 44, height: 44 }}
                    >
                        <Icons.ArrowLeft size={20} className="text-muted" />
                    </button>
                    <div>
                        <h2 className="fw-bold m-0 d-flex align-items-center gap-2 text-dark">
                            <Icons.FileText size={24} className="text-success" />
                            Report Generator
                        </h2>
                        <p className="text-muted m-0 small">Create detailed reports</p>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-grow-1 overflow-auto px-4 pb-5 custom-scrollbar container" style={{ maxWidth: '800px' }}>
                    {step === 2 && (
                        <div className="clay-card p-4 mb-4 bg-white shadow-sm rounded-4">
                            <h3 className="fw-bold mb-4 text-dark">Customize your Report</h3>

                            <div className="mb-4">
                                <label className="form-label fw-bold text-muted small text-uppercase">Topic</label>
                                <input
                                    type="text"
                                    className="form-control border-0 bg-light p-3 rounded-3"
                                    placeholder="e.g. Climate Change Impact"
                                    value={formData.topic}
                                    onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                />
                            </div>

                            <div className="mb-4">
                                <label className="form-label fw-bold text-muted small text-uppercase">Custom Instructions (Optional)</label>
                                <textarea
                                    className="form-control border-0 bg-light p-3 rounded-3"
                                    rows="2"
                                    placeholder="e.g. Include section on mitigation strategies..."
                                    value={formData.customInstructions}
                                    onChange={e => setFormData({ ...formData, customInstructions: e.target.value })}
                                />
                            </div>

                            <div className="row g-4 mb-4">
                                <div className="col-md-6">
                                    <label className="form-label fw-bold text-muted small text-uppercase">Target Audience</label>
                                    <select className="form-select border-0 bg-light p-3 rounded-3" value={formData.audience} onChange={e => setFormData({ ...formData, audience: e.target.value })}>
                                        <option>University Students</option>
                                        <option>Professionals</option>
                                        <option>General Public</option>
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-bold text-muted small text-uppercase">Tone</label>
                                    <select className="form-select border-0 bg-light p-3 rounded-3" value={formData.tone} onChange={e => setFormData({ ...formData, tone: e.target.value })}>
                                        <option>Academic</option>
                                        <option>Professional</option>
                                        <option>Analytical</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                className="btn btn-success w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 fs-5 shadow-lg mt-2 rounded-pill"
                                onClick={handleGenerate}
                                disabled={!formData.topic || loading}
                            >
                                {loading ? <span className="spinner-border spinner-border-sm"></span> : <>Generate Report <Icons.Sparkles size={20} /></>}
                            </button>
                        </div>
                    )}

                    {step === 3 && generatedContent && (
                        <div className="container h-100 flex-column d-flex">
                            <div className="text-center mb-4">
                                <h2 className="fw-bold text-dark">{generatedContent.title}</h2>
                            </div>

                            <div className="flex-grow-1 overflow-auto p-5 mb-4 rounded-4 border bg-white custom-scrollbar shadow-sm">
                                {generatedContent.sections.map((section, idx) => (
                                    <div key={idx} className="mb-4">
                                        <h4 className="fw-bold text-success">{section.heading}</h4>
                                        <p className="fs-5 text-secondary" style={{ lineHeight: '1.8', whiteSpace: 'pre-line' }}>{section.content}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="d-flex gap-3 justify-content-center pb-4">
                                <button className="btn btn-secondary rounded-pill px-4" onClick={() => setStep(2)}>Edit</button>
                                <button className="btn btn-success rounded-pill px-5 fw-bold shadow-lg" onClick={downloadPDF}>
                                    <Icons.Download size={20} className="me-2" /> Download PDF
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ReportGenerator;
