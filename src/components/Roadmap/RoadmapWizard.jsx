
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, BookOpen, Clock, Target } from 'lucide-react';
import { generateRoadmap } from '../../utils/roadmapAI';

const RoadmapWizard = ({ onRoadmapGenerated }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        goal: '',
        currentLevel: '',
        timeframe: '3 months'
    });

    const handleNext = () => setStep(prev => prev + 1);
    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const data = await generateRoadmap(formData);
            onRoadmapGenerated(data);
        } catch (error) {
            alert("Failed to generate roadmap. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const variants = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-2xl bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden"
            >
                {/* Decorative Background Elements */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -z-10" />
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -z-10" />

                <div className="mb-10 text-center">
                    <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-blue-50 text-blue-600">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">
                        AI Roadmap Generator
                    </h2>
                    <p className="text-gray-500 text-lg">Chart your path to mastery in seconds.</p>
                </div>

                {/* Step Indicator */}
                <div className="flex gap-3 mb-12 px-8">
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-100'
                                }`}
                        />
                    ))}
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 border-4 border-[var(--primary-accent)] border-t-transparent rounded-full animate-spin mb-4" />
                        <h3 className="text-lg font-medium text-[var(--text-main)]">Crafting your destiny...</h3>
                        <p className="text-[var(--text-muted)] text-sm mt-2">Our AI is analyzing thousands of career paths for you.</p>
                    </div>
                ) : (
                    <motion.div
                        key={step}
                        variants={variants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                    >
                        {step === 1 && (
                            <div className="space-y-6">
                                <div className="text-center mb-8">
                                    <label className="text-2xl font-bold text-gray-900">What is your ultimate goal?</label>
                                </div>
                                <input
                                    type="text"
                                    name="goal"
                                    value={formData.goal}
                                    onChange={handleChange}
                                    placeholder="e.g. Full Stack Developer, Data Scientist..."
                                    className="w-full bg-gray-50 border-0 rounded-2xl px-6 py-5 text-xl focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-gray-400 font-medium text-center shadow-inner"
                                    autoFocus
                                />
                                <button
                                    onClick={handleNext}
                                    disabled={!formData.goal}
                                    className="w-full mt-6 bg-gradient-to-r from-blue-600 to-violet-600 hover:shadow-xl hover:shadow-blue-500/20 hover:scale-[1.02] transition-all text-white font-bold rounded-2xl py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                                >
                                    Next Step <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6">
                                <div className="text-center mb-8">
                                    <label className="text-2xl font-bold text-gray-900">What do you already know?</label>
                                </div>
                                <textarea
                                    name="currentLevel"
                                    rows="4"
                                    value={formData.currentLevel}
                                    onChange={handleChange}
                                    placeholder="I know Python loops but struggle with classes. I've used React a little bit..."
                                    className="w-full bg-gray-50 border-0 rounded-2xl px-6 py-5 text-lg focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-gray-400 font-medium shadow-inner resize-none"
                                    autoFocus
                                />
                                <div className="flex gap-4 mt-6">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="px-8 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleNext}
                                        disabled={!formData.currentLevel}
                                        className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:shadow-xl hover:shadow-blue-500/20 hover:scale-[1.02] transition-all text-white font-bold rounded-2xl py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                                    >
                                        Next Step <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6">
                                <div className="text-center mb-8">
                                    <label className="text-2xl font-bold text-gray-900">Time Commitment?</label>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    {['1 month', '3 months', '6 months', '1 year'].map((time) => (
                                        <button
                                            key={time}
                                            onClick={() => setFormData({ ...formData, timeframe: time })}
                                            className={`w-full p-5 rounded-2xl border-2 transition-all flex items-center justify-between group ${formData.timeframe === time
                                                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                                                : 'bg-white border-gray-100 hover:border-blue-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            <span className="font-bold text-lg">{time}</span>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${formData.timeframe === time ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                                                }`}>
                                                {formData.timeframe === time && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="flex gap-4 mt-8">
                                    <button
                                        onClick={() => setStep(2)}
                                        className="px-8 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:shadow-xl hover:shadow-blue-500/20 hover:scale-[1.02] transition-all text-white font-bold rounded-2xl py-4 text-lg flex items-center justify-center gap-2"
                                    >
                                        Generate Roadmap <Sparkles className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </motion.div>
        </div >
    );
};

export default RoadmapWizard;
