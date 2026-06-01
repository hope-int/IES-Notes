import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Compass, Sparkles } from 'lucide-react';
import { generateRoadmap } from '../../utils/roadmapAI';
import MiniGameLoader from '../common/MiniGameLoader';

const MotionDiv = motion.div;

const RoadmapWizard = ({ onRoadmapGenerated }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState({ step: 'init', message: 'Preparing AI Engine...' });
    const [answers, setAnswers] = useState({
        q1: '',
        q2: '',
        q3: '',
        q4: '',
        q5: ''
    });

    const questions = [
        {
            id: 1,
            key: 'q1',
            text: "What is your ultimate engineering goal?",
            options: [
                "Full Stack Web",
                "Data Science & AI",
                "Embedded & IoT",
                "Cybersecurity"
            ]
        },
        {
            id: 2,
            key: 'q2',
            text: "What is your current coding level?",
            options: [
                "Absolute Beginner",
                "I know basic syntax (Loops/Arrays)",
                "I can build small projects",
                "I am prepping for placements"
            ]
        },
        {
            id: 3,
            key: 'q3',
            text: "How comfortable are you with Data Structures & Algorithms?",
            options: [
                "Terrified of them",
                "I know the basics",
                "I can confidently invert a Binary Tree"
            ]
        },
        {
            id: 4,
            key: 'q4',
            text: "How do you actually want to learn?",
            options: [
                "Structured & Exam-focused",
                "Building real-world projects",
                "Polymath (Deconstruct topics across disciplines)"
            ]
        },
        {
            id: 5,
            key: 'q5',
            text: "What is your timeline?",
            options: [
                "Panic Mode (Exam tomorrow)",
                "1 Month (Placement prep)",
                "6 Months (Deep mastery)"
            ]
        }
    ];

    const currentQuestion = questions.find(q => q.id === step);

    const handleOptionSelect = async (answer) => {
        const newAnswers = { ...answers, [currentQuestion.key]: answer };
        setAnswers(newAnswers);

        if (step < 5) {
            setStep(step + 1);
        } else {
            // Final step reached
            setLoading(true);
            try {
                const data = await generateRoadmap(newAnswers, (progress) => {
                    setLoadingStep(progress);
                });
                onRoadmapGenerated(data);
            } catch (error) {
                console.error("Roadmap generation failed:", error);
                alert(`Failed to generate roadmap: ${error.message}`);
                setStep(1); // Reset on failure
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="roadmap-wizard">
            {/* Top Progress Bar */}
            <div className="roadmap-wizard-progress">
                <div
                    className="roadmap-progress-fill"
                    style={{ width: `${(step / 5) * 100}%` }}
                />
            </div>

            <div className="roadmap-ambient" aria-hidden="true">
                <span className="roadmap-ambient-grid" />
                <span className="roadmap-ambient-glare" />
            </div>

            <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="roadmap-wizard-panel"
            >

                <div className="roadmap-wizard-heading">
                    <div className="roadmap-wizard-mark">
                        <Sparkles size={26} />
                    </div>
                    <span>Study Roadmap</span>
                    <h2>Build Your Learning Path</h2>
                </div>

                {loading ? (
                    <div className="roadmap-wizard-loader">
                        <MiniGameLoader
                            loadingText={loadingStep?.message || 'Connecting to Brain...'}
                            subText={`Source: ${loadingStep?.provider || 'Primary Engine'} | Status: ${loadingStep?.step?.toUpperCase() || 'QUERYING'}`}
                        />
                    </div>

                ) : (
                    <div className="roadmap-wizard-content">
                        {/* Step Indicator */}
                        <div className="roadmap-step-row">
                            <span><Compass size={15} /> Step {step} of 5</span>
                            <strong>{Math.round((step / 5) * 100)}%</strong>
                        </div>

                        {/* Interactive Carousel Content */}
                        <div className="roadmap-question-stage">
                            <AnimatePresence mode="wait">
                                <MotionDiv
                                    key={step}
                                    initial={{ x: 50, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: -50, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                    className="roadmap-question-panel"
                                >
                                    <h3>
                                        {currentQuestion.text}
                                    </h3>

                                    <div className="roadmap-option-grid">
                                        {currentQuestion.options.map((option, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleOptionSelect(option)}
                                                className="roadmap-option-button"
                                            >
                                                <CheckCircle2 size={18} />
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </MotionDiv>
                            </AnimatePresence>
                        </div>

                        {step > 1 && (
                            <div className="roadmap-wizard-back">
                                <button
                                    onClick={() => setStep(step - 1)}
                                >
                                    <ArrowLeft size={16} /> Go Back
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </MotionDiv>
        </div>
    );
};

export default RoadmapWizard;
