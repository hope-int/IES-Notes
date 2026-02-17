import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, FastForward, Rewind, SkipForward, SkipBack, Loader2, UploadCloud } from 'lucide-react';
import { motion } from 'framer-motion';

const PodcastPlayer = ({ currentPodcast, setCurrentPodcast, setHistory, history, isGenerating, loadingStep, onUpload }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [progress, setProgress] = useState(0);
    const [activeUtterance, setActiveUtterance] = useState(null);
    const synth = window.speechSynthesis;

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            synth.cancel();
        };
    }, []);

    // Handle Podcast Change
    useEffect(() => {
        if (currentPodcast?.script) {
            synth.cancel();
            setIsPlaying(false);
            setProgress(0);
            setupSpeech(currentPodcast.script);
        }
    }, [currentPodcast]);

    const setupSpeech = (text) => {
        const utterance = new SpeechSynthesisUtterance(text);

        // Voice Selection
        const voices = synth.getVoices();
        const preferredVoice = voices.find(voice =>
            voice.name.includes('Google UK English Female') ||
            voice.name.includes('Samantha') ||
            voice.name.includes('Premium')
        );
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.rate = playbackRate;

        // Events
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => {
            setIsPlaying(false);
            setProgress(100);
        };
        utterance.onboundary = (event) => {
            // Crude progress estimation based on char index
            const len = text.length;
            const percent = (event.charIndex / len) * 100;
            setProgress(percent);
        };

        setActiveUtterance(utterance);
    };

    const togglePlay = () => {
        if (isGenerating) return;

        if (isPlaying) {
            synth.pause();
            setIsPlaying(false);
        } else {
            if (synth.paused) {
                synth.resume();
                setIsPlaying(true);
            } else {
                if (activeUtterance) {
                    activeUtterance.rate = playbackRate; // Update rate just in case
                    synth.speak(activeUtterance);
                    setIsPlaying(true);
                }
            }
        }
    };

    // Speed Logic
    useEffect(() => {
        if (synth.speaking && !synth.paused) {
            // Web Speech API makes changing rate mid-speech hard without restart.
        }
    }, [playbackRate]);

    // Loading State
    if (isGenerating) {
        return (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-center min-vh-50" style={{ minHeight: '400px' }}>
                <div className="position-relative mb-4">
                    <div className="spinner-border text-primary" style={{ width: '4rem', height: '4rem' }} role="status"></div>
                    <Loader2 className="position-absolute top-50 start-50 translate-middle text-primary" size={24} />
                </div>
                <h3 className="fw-bold mb-2">Creating Your Class...</h3>
                <p className="text-muted">
                    {loadingStep === 'extracting' ? 'Reading PDF...' : 'AI Host is writing the script...'}
                </p>
            </div>
        );
    }

    // Placeholder for the "No Podcast Selected" state
    if (!currentPodcast) {
        return (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-center">
                <div className="bg-primary bg-opacity-10 p-4 rounded-circle mb-4">
                    <UploadCloud size={48} className="text-primary" />
                </div>
                <h3 className="fw-bold mb-2">No Class Selected</h3>
                <p className="text-muted mb-4" style={{ maxWidth: '300px' }}>
                    Upload your PDF notes to generate an AI-powered audio class instantly.
                </p>

                <label className="btn btn-primary rounded-pill px-4 py-3 fw-bold d-flex align-items-center gap-2 shadow-sm hover-scale cursor-pointer">
                    <input type="file" className="d-none" accept=".pdf" onChange={onUpload} />
                    <UploadCloud size={20} />
                    Upload PDF Notes
                </label>
            </div>
        );
    }

    return (
        <div className="d-flex flex-column gap-4 mx-auto" style={{ maxWidth: '28rem' }}>
            {/* Cover Art Area */}
            <div className="text-center">
                <div className="d-inline-block rounded-4 shadow-xl position-relative overflow-hidden"
                    style={{
                        width: '100%',
                        aspectRatio: '1/1',
                        maxWidth: '300px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                    }}>
                    <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: 'rgba(0,0,0,0.1)' }}></div>
                    <div className="d-flex flex-column align-items-center justify-content-center h-100 text-white p-4 position-relative z-1">
                        <h2 className="fw-bold display-4 mb-1">NOTES</h2>
                        <p className="opacity-75 font-monospace letter-spacing-2">AUDIO CLASS</p>
                    </div>
                </div>
            </div>

            {/* Title Info */}
            <div className="text-center mt-3">
                <h2 className="h4 fw-bold mb-1">{currentPodcast.title}</h2>
                <p className="text-muted mb-0">{currentPodcast.subtitle || 'Generated AI Class'}</p>
            </div>

            {/* Progress Scrubber */}
            <div className="w-100 px-3">
                <input
                    type="range"
                    className="form-range"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={(e) => { }} // Seeking not implemented for Web Speech MVP
                    style={{ height: '4px' }}
                    disabled
                />
                <div className="d-flex justify-content-between text-muted small mt-1">
                    <span>{Math.round(progress)}%</span>
                    <span>End</span>
                </div>
            </div>

            {/* Controls */}
            <div className="d-flex align-items-center justify-content-center gap-4 mt-2">
                <button
                    className="btn btn-link text-secondary p-0 hover-scale opacity-50"
                    onClick={() => { }} // Skip Back 15s disabled
                    disabled
                >
                    <div className="d-flex flex-column align-items-center" style={{ fontSize: '10px' }}>
                        <Rewind size={24} />
                        <span className="fw-bold">-15s</span>
                    </div>
                </button>

                <button
                    className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center shadow-lg hover-scale"
                    style={{ width: '64px', height: '64px' }}
                    onClick={togglePlay}
                >
                    {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ms-1" />}
                </button>

                <button
                    className="btn btn-link text-secondary p-0 hover-scale opacity-50"
                    onClick={() => { }} // Skip Forward 15s disabled
                    disabled
                >
                    <div className="d-flex flex-column align-items-center" style={{ fontSize: '10px' }}>
                        <FastForward size={24} />
                        <span className="fw-bold">+15s</span>
                    </div>
                </button>
            </div>

            {/* Speed Toggle */}
            <div className="text-center mt-2">
                <button
                    className="btn btn-sm btn-light rounded-pill px-3 py-1 text-muted fw-bold border"
                    onClick={() => {
                        const rates = [1.0, 1.25, 1.5, 2.0];
                        const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
                        setPlaybackRate(rates[nextIdx]);
                        // Hint user
                        if (synth.speaking) alert("Speed change will apply to next playback segment or restart.");
                    }}
                >
                    {playbackRate}x Speed
                </button>
            </div>
        </div>
    );
};

export default PodcastPlayer;
