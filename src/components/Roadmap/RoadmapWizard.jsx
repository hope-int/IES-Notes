import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2 } from 'lucide-react';
import { generateRoadmap } from '../../utils/roadmapAI';
import MiniGameLoader from '../common/MiniGameLoader';

const RoadmapWizard = ({ onRoadmapGenerated }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
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
                const data = await generateRoadmap(newAnswers);
                onRoadmapGenerated(data);
            } catch (error) {
                console.error("Roadmap generation failed:", error);
                alert("Failed to generate roadmap. Please try again.");
                setStep(1); // Reset on failure
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white overflow-hidden">
            {/* Top Progress Bar */}
            <div className="fixed top-0 left-0 right-0 h-1 bg-slate-100 z-50">
                <div
                    className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                    style={{ width: `${(step / 5) * 100}%` }}
                />
            </div>

            {/* Global Background (Liquid Aura style) */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-indigo-50/50 blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-50/50 blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-3xl h-full flex flex-col justify-center px-6 py-12 relative z-10"
            >

                <div className="mb-8 text-center relative z-10">
                    <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-50 text-purple-600 shadow-inner">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">
                        AI Roadmap Engine
                    </h2>
                    <p className="text-gray-500 font-medium">Diagnostic Setup</p>
                </div>

                {loading ? (
                    <MiniGameLoader
                        loadingText="Generating your personalized skill tree..."
                        subText={`Analyzing ${answers.q1} pathways based on your ${answers.q5} timeline...`}
                    />
                ) : (
                    <div className="relative z-10">
                        {/* Step Indicator */}
                        <div className="text-center mb-10">
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Step {step} of 5</span>
                        </div>

                        {/* Interactive Carousel Content */}
                        <div className="min-h-[250px] relative">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={step}
                                    initial={{ x: 50, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: -50, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                    className="w-full"
                                >
                                    <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center leading-tight">
                                        {currentQuestion.text}
                                    </h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {currentQuestion.options.map((option, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleOptionSelect(option)}
                                                className="bg-white border-2 border-slate-100 hover:border-indigo-400 hover:bg-slate-50 hover:shadow-lg focus:border-indigo-500 focus:bg-indigo-50 hover:-translate-y-1 rounded-2xl py-6 px-4 cursor-pointer transition-all text-center font-bold text-slate-700 active:scale-95 active:border-indigo-600 active:bg-indigo-50 flex flex-col items-center justify-center min-h-[100px]"
                                                style={{ boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {step > 1 && (
                            <div className="mt-8 text-center">
                                <button
                                    onClick={() => setStep(step - 1)}
                                    className="text-gray-400 hover:text-gray-700 font-medium transition-colors text-sm"
                                >
                                    ← Go Back
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default RoadmapWizard;
