import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, History, ArrowLeft, Upload, FileText, Play, Clock, Loader2 } from 'lucide-react';
import PodcastPlayer from './PodcastPlayer';
import PodcastHistory from './PodcastHistory';
import { useNavigate } from 'react-router-dom';
import { extractTextFromPDF } from '../../utils/pdfUtils';
import { generatePodcastScript } from '../../utils/puterUtils';

const PodcastClasses = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('player'); // 'player' or 'history'
    const [currentPodcast, setCurrentPodcast] = useState(null);
    const [history, setHistory] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingStep, setLoadingStep] = useState(''); // 'extracting', 'scripting', 'ready'

    // Load history from localStorage on mount
    useEffect(() => {
        const savedHistory = localStorage.getItem('podcast_history');
        if (savedHistory) {
            setHistory(JSON.parse(savedHistory));
        }
    }, []);

    // Save history whenever it changes
    useEffect(() => {
        localStorage.setItem('podcast_history', JSON.stringify(history));
    }, [history]);

    const handlePodcastSelect = (podcast) => {
        setCurrentPodcast(podcast);
        setActiveTab('player');
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            setIsGenerating(true);

            // 1. Extract Text
            setLoadingStep('extracting');
            const text = await extractTextFromPDF(file);
            console.log("Extracted text length:", text.length);

            // 2. Generate Script
            setLoadingStep('scripting');
            const script = await generatePodcastScript(text);
            console.log("Generated script length:", script.length);

            // 3. Create Podcast Object
            const newPodcast = {
                id: Date.now(),
                title: file.name.replace('.pdf', ''),
                subtitle: 'AI Generated Class',
                date: new Date().toISOString(),
                script: script,
                duration: null, // Will be set after synthesis estimation or playback
            };

            // 4. Update State & History
            setCurrentPodcast(newPodcast);
            setHistory(prev => [newPodcast, ...prev]);
            setActiveTab('player');

        } catch (error) {
            console.error("Failed to process podcast:", error);
            alert("Failed to generate podcast. Please try again.");
        } finally {
            setIsGenerating(false);
            setLoadingStep('');
        }
    };

    return (
        <div className="min-vh-100 pb-5" style={{ backgroundColor: '#f8fafc' }}>
            {/* Header */}
            <div className="bg-white sticky-top z-3 border-bottom border-light" style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(255,255,255,0.8)' }}>
                <div className="container py-3 d-flex align-items-center justify-content-between">
                    <button
                        onClick={() => navigate('/')}
                        className="btn btn-link p-0 text-secondary"
                    >
                        <ArrowLeft size={24} />
                    </button>

                    <h1 className="h5 mb-0 fw-bold d-flex align-items-center gap-2">
                        <Mic className="text-primary" size={20} />
                        Podcast Classes
                    </h1>

                    <div style={{ width: 24 }}></div> {/* Spacer for centering */}
                </div>

                {/* Tabs */}
                <div className="container d-flex gap-4">
                    <button
                        onClick={() => setActiveTab('player')}
                        className={`btn btn-link text-decoration-none py-2 px-1 border-bottom-2 ${activeTab === 'player' ? 'border-primary text-primary fw-bold' : 'border-transparent text-secondary'}`}
                        style={{ borderBottom: activeTab === 'player' ? '3px solid var(--primary-accent)' : '3px solid transparent', borderRadius: 0 }}
                    >
                        Now Playing
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`btn btn-link text-decoration-none py-2 px-1 border-bottom-2 ${activeTab === 'history' ? 'border-primary text-primary fw-bold' : 'border-transparent text-secondary'}`}
                        style={{ borderBottom: activeTab === 'history' ? '3px solid var(--primary-accent)' : '3px solid transparent', borderRadius: 0 }}
                    >
                        History
                    </button>
                </div>
            </div>

            <div className="container py-4">
                <AnimatePresence mode="wait">
                    {activeTab === 'player' ? (
                        <motion.div
                            key="player"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <PodcastPlayer
                                currentPodcast={currentPodcast}
                                setCurrentPodcast={setCurrentPodcast}
                                setHistory={setHistory}
                                history={history}
                                isGenerating={isGenerating}
                                loadingStep={loadingStep}
                                onUpload={handleFileUpload}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="history"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <PodcastHistory
                                history={history}
                                onSelect={handlePodcastSelect}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default PodcastClasses;
