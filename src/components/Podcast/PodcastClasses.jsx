import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, History, ArrowLeft, Upload, FileText, Play, Clock, Loader2 } from 'lucide-react';
import PodcastPlayer from './PodcastPlayer';
import PodcastHistory from './PodcastHistory';
import { useNavigate } from 'react-router-dom';
import { extractTextFromPDF } from '../../utils/pdfUtils';
import { generatePodcastScript, checkPodcastRateLimit, recordPodcastUsage, generateAndSavePodcastAudio } from '../../utils/puterUtils';

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

            // 0. Check Rate Limit
            const isAllowed = await checkPodcastRateLimit();
            if (!isAllowed) {
                alert("Rate Limit Exceeded\n\nYou can only generate 13 podcasts every 12 hours. Please try again later.");
                setIsGenerating(false);
                return;
            }

            // 1. Extract Text
            setLoadingStep('extracting');
            const text = await extractTextFromPDF(file);
            console.log("Extracted text length:", text.length);

            // 2. Generate Script
            setLoadingStep('scripting');
            const script = await generatePodcastScript(text);
            console.log("Generated script length:", script.length);

            // 3. Generate Audio
            const podcastId = Date.now();
            let audioPath = null;
            try {
                audioPath = await generateAndSavePodcastAudio(script, podcastId);
            } catch (audioErr) {
                console.warn("Audio generation failed, falling back to script only", audioErr);
            }

            // 4. Record Usage
            if (audioPath) await recordPodcastUsage();

            // 5. Create Podcast Object
            const newPodcast = {
                id: podcastId,
                title: file.name.replace('.pdf', ''),
                subtitle: 'AI Generated Class',
                date: new Date().toISOString(),
                script: script,
                audioPath: audioPath,
                duration: null,
            };

            // 6. Update State & History
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

    const handleRegenerate = async (podcast) => {
        if (!podcast || !podcast.script) return;

        try {
            setIsGenerating(true);
            setLoadingStep('ready'); // Use ready or scripting to show loader

            // Check Rate Limit
            const isAllowed = await checkPodcastRateLimit();
            if (!isAllowed) {
                alert("Rate Limit Exceeded\n\nYou can only generate 13 podcasts every 12 hours. Please try again later.");
                setIsGenerating(false);
                return;
            }

            // Generate Audio
            try {
                const audioPath = await generateAndSavePodcastAudio(podcast.script, podcast.id);
                if (audioPath) {
                    await recordPodcastUsage();

                    // Update Podcast object
                    const updatedPodcast = { ...podcast, audioPath };
                    setCurrentPodcast(updatedPodcast);
                    setHistory(prev => prev.map(p => p.id === podcast.id ? updatedPodcast : p));
                }
            } catch (err) {
                console.error("Regeneration failed", err);
                alert("Failed to regenerate audio.");
            }
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
                {/* Tabs */}
                <div className="d-flex justify-content-center pt-2 pb-4">
                    <div className="d-inline-flex bg-light rounded-pill p-1 shadow-sm border">
                        <button
                            onClick={() => setActiveTab('player')}
                            className={`btn btn-sm rounded-pill px-4 transition-all ${activeTab === 'player'
                                    ? 'bg-white text-dark shadow-sm fw-bold'
                                    : 'text-muted'
                                }`}
                            style={{ minWidth: '120px' }}
                        >
                            Now Playing
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`btn btn-sm rounded-pill px-4 transition-all ${activeTab === 'history'
                                    ? 'bg-white text-dark shadow-sm fw-bold'
                                    : 'text-muted'
                                }`}
                            style={{ minWidth: '120px' }}
                        >
                            History
                        </button>
                    </div>
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
                                onRegenerate={handleRegenerate}
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
