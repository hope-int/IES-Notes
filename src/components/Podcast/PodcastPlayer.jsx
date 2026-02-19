import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, FastForward, Rewind, Loader2, UploadCloud, Volume2, RefreshCw, Download, Headphones } from 'lucide-react';
import { motion } from 'framer-motion';
import AILoader from '../AILoader';

const PodcastPlayer = ({ currentPodcast, setCurrentPodcast, setHistory, history, isGenerating, loadingStep, onUpload, onRegenerate }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [audioUrl, setAudioUrl] = useState(null);
    const [error, setError] = useState(null);

    const audioRef = useRef(null);
    const isSetup = useRef(false);

    // Helper: Format seconds to mm:ss
    const formatTime = (seconds) => {
        if (!seconds && seconds !== 0) return "--:--";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, []);

    // Handle Podcast Change & Load Audio
    useEffect(() => {
        const loadAudio = async () => {
            if (currentPodcast) {
                // Reset state
                setIsPlaying(false);
                setProgress(0);
                setCurrentTime(0);
                setDuration(0);
                setError(null);
                if (audioUrl) URL.revokeObjectURL(audioUrl);
                setAudioUrl(null);

                if (currentPodcast.audioPath) {
                    try {
                        // Load from Puter FS
                        const blob = await window.puter.fs.read(currentPodcast.audioPath);
                        const url = URL.createObjectURL(blob);
                        setAudioUrl(url);
                    } catch (err) {
                        console.error("Failed to load audio file", err);
                        setError("Could not load audio file. It may have been deleted.");
                    }
                } else if (currentPodcast.script) {
                    setError("This class describes an older format without audio. Please regenerate.");
                }
            }
        };

        loadAudio();
    }, [currentPodcast]);

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const curr = audioRef.current.currentTime;
            const dur = audioRef.current.duration;
            setCurrentTime(curr);
            setDuration(dur);
            if (dur > 0) setProgress((curr / dur) * 100);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setProgress(100);
    };

    const togglePlay = () => {
        if (!audioRef.current || !audioUrl) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const skipForward = () => {
        if (audioRef.current) audioRef.current.currentTime += 15;
    };

    const skipBack = () => {
        if (audioRef.current) audioRef.current.currentTime -= 15;
    };

    const changeSpeed = () => {
        const rates = [1.0, 1.25, 1.5, 2.0];
        const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
        const newRate = rates[nextIdx];
        setPlaybackRate(newRate);
        if (audioRef.current) audioRef.current.playbackRate = newRate;
    };

    // Seek
    const handleSeek = (e) => {
        const newPct = parseFloat(e.target.value);
        if (audioRef.current && duration) {
            const newTime = (newPct / 100) * duration;
            audioRef.current.currentTime = newTime;
            setProgress(newPct);
            setCurrentTime(newTime);
        }
    };

    const handleDownload = () => {
        if (!audioUrl) return;
        const link = document.createElement('a');
        link.href = audioUrl;
        link.download = `${currentPodcast.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Loading State
    if (isGenerating) {
        return (
            <AILoader
                title="Creating Your Class..."
                subtitle={loadingStep === 'extracting' ? 'Reading PDF content...' : 'AI Host is scripting and rehearsing...'}
            />
        );
    }

    // Placeholder for the "No Podcast Selected" state
    if (!currentPodcast) {
        return (
            <div className="bg-white border-0 shadow-xl rounded-3xl mx-auto text-center p-8 max-w-sm">
                <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full mb-6 flex items-center justify-center">
                        <UploadCloud size={40} />
                    </div>

                    <h4 className="fw-bold mb-2 text-dark">No Class Selected</h4>
                    <p className="text-muted mb-4 small px-3">
                        Upload your PDF notes to generate an AI-powered audio class instantly.
                    </p>

                    <label className="bg-blue-600 text-white rounded-full px-6 py-3 font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2 hover:scale-105 cursor-pointer transition-all">
                        <input type="file" className="hidden" accept=".pdf" onChange={onUpload} />
                        <UploadCloud size={18} />
                        <span>Upload PDF Notes</span>
                    </label>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border-0 shadow-2xl rounded-[2.5rem] overflow-hidden mx-auto max-w-md">
            {/* Hidden Audio Element */}
            {audioUrl && (
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleEnded}
                />
            )}

            <div className="p-8 flex flex-col items-center">

                {/* Cover Art */}
                <div
                    className="mb-8 w-full relative aspect-square rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/30 mx-auto"
                    style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }}
                >
                    {/* Background Noise Texture Overlay */}
                    <div className="absolute top-0 start-0 w-full h-full opacity-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

                    <div className="flex flex-col items-center justify-center h-full text-white p-6 relative z-10 text-center">

                        <motion.div
                            animate={{ scale: isPlaying ? 1.1 : 1 }}
                            transition={{ duration: 0.5 }}
                            className="mb-4"
                        >
                            <Headphones size={64} strokeWidth={1.5} />
                        </motion.div>

                        <h2 className="font-bold text-2xl mb-2 tracking-wide font-display">AI NOTES</h2>
                        <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-sm font-medium border border-white/20">
                            AUDIO CLASS
                        </span>
                    </div>
                </div>

                {/* Title & Info */}
                <div className="text-center w-full mb-8 space-y-2">
                    <h2 className="font-bold text-gray-900 text-2xl truncate px-4">{currentPodcast.title}</h2>
                    <p className="text-gray-500 bg-gray-50 px-4 py-1 rounded-full inline-block text-sm font-medium border border-gray-100">
                        {currentPodcast.subtitle || 'AI Generated Class'}
                    </p>
                    {error && <div className="text-red-500 text-sm font-medium mt-2">{error}</div>}
                </div>

                {/* Progress Bar */}
                <div className="w-full mb-8 px-2">
                    <div className="relative h-2 w-full bg-gray-100 rounded-full mb-2 cursor-pointer group">
                        <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                            style={{ width: `${progress}%` }}
                        />
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md border-2 border-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ left: `${progress}%`, marginLeft: '-6px' }}
                        />
                        <input
                            type="range"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            min="0"
                            max="100"
                            value={progress}
                            onChange={handleSeek}
                            disabled={!audioUrl}
                        />
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-gray-400 font-mono tracking-wide">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-8 mb-8">
                    <button
                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                        onClick={skipBack}
                        disabled={!audioUrl}
                    >
                        <Rewind size={28} strokeWidth={2} />
                    </button>

                    <button
                        className="w-20 h-20 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 shadow-xl shadow-indigo-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-white"
                        onClick={togglePlay}
                        disabled={!audioUrl}
                    >
                        {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                    </button>

                    <button
                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                        onClick={skipForward}
                        disabled={!audioUrl}
                    >
                        <FastForward size={28} strokeWidth={2} />
                    </button>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between w-full pt-6 border-t border-gray-100 mt-auto px-2">
                    <button
                        className="px-4 py-2 bg-gray-50 rounded-full text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                        onClick={changeSpeed}
                    >
                        {playbackRate}x Speed
                    </button>

                    <div className="flex gap-4">
                        <button
                            className="p-2 text-gray-400 hover:text-indigo-600 transition-colors rounded-full hover:bg-indigo-50"
                            onClick={handleDownload}
                            title="Download MP3"
                            disabled={!audioUrl}
                        >
                            <Download size={20} />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PodcastPlayer;
