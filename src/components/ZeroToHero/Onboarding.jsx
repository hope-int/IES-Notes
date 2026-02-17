import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ArrowRight, Brain, Zap, Target, Book, Layout, Sparkles } from 'lucide-react';

const questions = [
    {
        id: 'coding_experience',
        question: "How confident are you with code?",
        icon: <Target size={32} className="text-primary" />,
        options: [
            { label: "I've never written a line of code.", value: "beginner" },
            { label: "I copy-paste from tutorials mostly.", value: "copypaster" },
            { label: "I can write basic programs, but get stuck.", value: "junior" },
            { label: "I'm comfortable building small apps.", value: "senior" }
        ]
    },
    {
        id: 'problem_solving_approach',
        question: "You have a new assignment. What do you do first?",
        icon: <Brain size={32} className="text-success" />,
        options: [
            { label: "Dive in and start typing code immediately.", value: "impulsive" },
            { label: "Look for a similar example online.", value: "pragmatic" },
            { label: "Read the requirements and sketch a plan.", value: "planner" }
        ]
    },
    {
        id: 'debug_style',
        question: "Your code isn't working and shows an error. You...",
        icon: <Zap size={32} className="text-danger" />,
        options: [
            { label: "Feel totally lost and maybe give up.", value: "panic" },
            { label: "Change random things hoping it fixes it.", value: "guesswork" },
            { label: "Try to read what the error says.", value: "detective" }
        ]
    },
    {
        id: 'preferred_analogy_domain',
        question: "Learning is easier when explained with...",
        icon: <Sparkles size={32} className="text-warning" />,
        options: [
            { label: "Video Game examples (Levels, Player Stats)", value: "gaming" },
            { label: "Cooking/Food metaphors (Recipes, Ingredients)", value: "cooking" },
            { label: "Sports analogies (Team roles, Rules)", value: "sports" },
            { label: "Music concepts (Rhythm, Notes)", value: "music" },
            { label: "Just plain English examples", value: "general" }
        ]
    },
    {
        id: 'current_goal',
        question: "What's your main goal right now?",
        icon: <Target size={32} className="text-info" />,
        options: [
            { label: "Passing my upcoming exams", value: "interview" },
            { label: "Building a personal project", value: "project" },
            { label: "Understanding the basics deeply", value: "basics" },
            { label: "Solving a specific homework problem", value: "debugging" }
        ]
    }
];

const Onboarding = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState({});

    const handleSelect = (value) => {
        const currentQ = questions[currentStep];
        const newAnswers = { ...answers, [currentQ.id]: value };
        setAnswers(newAnswers);

        if (currentStep < questions.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // Finished
            const profile = {
                student_profile: newAnswers
            };
            localStorage.setItem('hope_zero_to_hero_profile', JSON.stringify(profile));
            if (onComplete) onComplete(profile);
        }
    };

    const progress = ((currentStep + 1) / questions.length) * 100;
    const currentQ = questions[currentStep];

    return (
        <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 p-4 relative overflow-hidden" style={{ background: 'var(--bg-color)' }}>

            {/* Background blobs similar to AIChat if needed, but keeping it clean for focus */}

            <div className="w-100" style={{ maxWidth: '500px' }}>
                <div className="mb-5 text-center">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="d-inline-block p-4 rounded-circle bg-white shadow-sm mb-3"
                    >
                        {currentQ.icon}
                    </motion.div>
                    <h2 className="fw-bold mb-2">Let's get to know you.</h2>
                    <p className="text-muted">Building your cognitive profile...</p>

                    {/* Progress Bar */}
                    <div className="progress mt-4" style={{ height: '6px', borderRadius: '10px', backgroundColor: '#e2e8f0' }}>
                        <motion.div
                            className="progress-bar bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                            style={{ borderRadius: '10px' }}
                        />
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ x: 50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -50, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <h3 className="fw-bold mb-4 text-center">{currentQ.question}</h3>

                        <div className="d-flex flex-column gap-3">
                            {currentQ.options.map((option, idx) => (
                                <motion.button
                                    key={idx}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleSelect(option.value)}
                                    className="clay-card btn text-start p-4 d-flex align-items-center justify-content-between border-0 shadow-sm"
                                    style={{ background: '#fff' }}
                                >
                                    <span className="fw-bold fs-5 text-dark">{option.label}</span>
                                    <ChevronRight className="text-muted" />
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Onboarding;
