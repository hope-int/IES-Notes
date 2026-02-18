import React, { useState } from 'react';
import jsPDF from 'jspdf';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAICompletion } from '../../utils/aiService';

const AssignmentGenerator = ({ onBack }) => {
    const [step, setStep] = useState(2);
    const [formData, setFormData] = useState({
        topic: '',
        audience: 'University Students', // Used as Level
        customInstructions: ''
    });
    const [loading, setLoading] = useState(false);
    const [generatedContent, setGeneratedContent] = useState(null);
    const [error, setError] = useState(null);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            const prompt = `Generate an assignment on "${formData.topic}". 
 Level: ${formData.audience}.
 Custom Instructions: ${formData.customInstructions}
 OUTPUT FORMAT: JSON ONLY.
 Structure:
 {
   "title": "Assignment Title",
   "questions": [
     { "question": "Question text?", "marks": "5", "answerKey": "Brief answer" }
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

        generatedContent.questions.forEach((q, i) => {
            addText(`Q${i + 1}: ${q.question} (${q.marks} marks)`, 12, true);
            addText(`Answer Key: ${q.answerKey}`, 10, false);
            y += 5;
        });

        doc.save(`${formData.topic.replace(/\s+/g, '_')}_Assignment.pdf`);
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
                            <Icons.CheckSquare size={24} className="text-warning" />
                            Assignment Generator
                        </h2>
                        <p className="text-muted m-0 small">Create quizzes and assignments</p>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-grow-1 overflow-auto px-4 pb-5 custom-scrollbar container" style={{ maxWidth: '800px' }}>
                    {step === 2 && (
                        <div className="clay-card p-4 mb-4 bg-white shadow-sm rounded-4">
                            <h3 className="fw-bold mb-4 text-dark">Customize Assignment</h3>

                            <div className="mb-4">
                                <label className="form-label fw-bold text-muted small text-uppercase">Topic</label>
                                <input
                                    type="text"
                                    className="form-control border-0 bg-light p-3 rounded-3"
                                    placeholder="e.g. Calculus Derivatives"
                                    value={formData.topic}
                                    onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                />
                            </div>

                            <div className="mb-4">
                                <label className="form-label fw-bold text-muted small text-uppercase">Level / Difficulty</label>
                                <select className="form-select border-0 bg-light p-3 rounded-3" value={formData.audience} onChange={e => setFormData({ ...formData, audience: e.target.value })}>
                                    <option>High School</option>
                                    <option>University Students</option>
                                    <option>Graduate Level</option>
                                </select>
                            </div>

                            <div className="mb-4">
                                <label className="form-label fw-bold text-muted small text-uppercase">Custom Instructions</label>
                                <textarea
                                    className="form-control border-0 bg-light p-3 rounded-3"
                                    rows="2"
                                    placeholder="e.g. Include 5 multiple choice questions..."
                                    value={formData.customInstructions}
                                    onChange={e => setFormData({ ...formData, customInstructions: e.target.value })}
                                />
                            </div>

                            <button
                                className="btn btn-warning w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 fs-5 shadow-lg mt-2 rounded-pill text-dark"
                                onClick={handleGenerate}
                                disabled={!formData.topic || loading}
                            >
                                {loading ? <span className="spinner-border spinner-border-sm"></span> : <>Generate Assignment <Icons.Sparkles size={20} /></>}
                            </button>
                        </div>
                    )}

                    {step === 3 && generatedContent && (
                        <div className="container h-100 flex-column d-flex">
                            <div className="text-center mb-4">
                                <h2 className="fw-bold text-dark">{generatedContent.title}</h2>
                            </div>

                            <div className="flex-grow-1 overflow-auto p-5 mb-4 rounded-4 border bg-white custom-scrollbar shadow-sm">
                                {generatedContent.questions.map((q, idx) => (
                                    <div key={idx} className="mb-4 p-3 border rounded-3 bg-light">
                                        <h5 className="fw-bold text-dark d-flex justify-content-between">
                                            <span>Q{idx + 1}: {q.question}</span>
                                            <span className="badge bg-secondary">{q.marks} Marks</span>
                                        </h5>
                                        <div className="mt-2 text-success small fw-bold p-2 bg-success bg-opacity-10 rounded">
                                            Answer Key: {q.answerKey}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="d-flex gap-3 justify-content-center pb-4">
                                <button className="btn btn-secondary rounded-pill px-4" onClick={() => setStep(2)}>Edit</button>
                                <button className="btn btn-warning rounded-pill px-5 fw-bold shadow-lg" onClick={downloadPDF}>
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

export default AssignmentGenerator;
