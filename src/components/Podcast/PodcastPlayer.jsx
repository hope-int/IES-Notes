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
            <div className="card border-0 shadow-lg rounded-5 mx-auto text-center p-5" style={{ maxWidth: '400px', background: '#fff' }}>
                <div className="d-flex flex-column align-items-center justify-content-center h-100">
                    <div className="bg-primary bg-opacity-10 p-4 rounded-circle mb-4 d-inline-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
                        <UploadCloud size={40} className="text-primary" />
                    </div>

                    <h4 className="fw-bold mb-2 text-dark">No Class Selected</h4>
                    <p className="text-muted mb-4 small px-3">
                        Upload your PDF notes to generate an AI-powered audio class instantly.
                    </p>

                    <label className="btn btn-primary rounded-pill px-4 py-2 fw-bold shadow-sm d-inline-flex align-items-center gap-2 hover-scale cursor-pointer transition-all">
                        <input type="file" className="d-none" accept=".pdf" onChange={onUpload} />
                        <UploadCloud size={18} />
                        <span>Upload PDF Notes</span>
                    </label>
                </div>
            </div>
        );
    }

    return (
        <div className="card border-0 shadow-lg rounded-5 overflow-hidden mx-auto" style={{ maxWidth: '400px', background: '#fff' }}>
            {/* Hidden Audio Element */}
            {audioUrl && (
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleEnded}
                />
            )}

            <div className="card-body p-4 d-flex flex-column align-items-center">

                {/* Cover Art */}
                {/* Cover Art */}
                <div
                    className="mb-4 position-relative w-100 rounded-3 overflow-hidden shadow-sm shadow-indigo-500/20 mx-auto"
                    style={{
                        aspectRatio: '1/1',
                        maxWidth: '300px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }}
                >
                    {/* Background Noise Texture Overlay */}
                    <div className="position-absolute top-0 start-0 w-100 h-100" style={{ opacity: 0.1, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

                    <div className="d-flex flex-column align-items-center justify-content-center h-100 text-white p-3 position-relative z-1">

                        {/* Animated Visualizer */}
                        <div className="d-flex align-items-center justify-content-center gap-1 mb-4" style={{ height: '60px' }}>
                            {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((scale, i) => (
                                <motion.div
                                    key={i}
                                    className="bg-white rounded-pill"
                                    style={{ width: '6px', originY: 1 }}
                                    animate={{
                                        height: isPlaying ? [15 * scale * 0.3, 40 * scale * 0.3, 15 * scale * 0.3] : 10,
                                        opacity: isPlaying ? [0.6, 1, 0.6] : 0.4
                                    }}
                                    transition={{
                                        duration: 0.8,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                        delay: i * 0.05
                                    }}
                                />
                            ))}
                        </div>

                        <motion.div
                            animate={{ scale: isPlaying ? 1.05 : 1 }}
                            transition={{ duration: 0.5 }}
                            className="mb-3"
                        >
                            <Headphones size={56} strokeWidth={1.5} />
                        </motion.div>

                        <h2 className="fw-bold h3 mb-1 tracking-wider">AI NOTES</h2>
                        <span className="badge bg-white bg-opacity-20 rounded-pill fw-normal px-3 backdrop-blur-md border border-white border-opacity-25">
                            AUDIO CLASS
                        </span>
                    </div>
                </div>

                {/* Title & Info */}
                <div className="text-center w-100 mb-4">
                    <h5 className="fw-bold text-dark mb-1 text-truncate px-2">{currentPodcast.title}</h5>
                    <span className="badge bg-light text-secondary border rounded-pill fw-normal px-3 py-2">
                        {currentPodcast.subtitle || 'AI Generated Class'}
                    </span>
                    {error && <div className="mt-2 text-danger small">{error}</div>}
                </div>

                {/* Custom Cool Progress Bar */}
                <div className="w-100 mb-4 px-2">
                    <div className="position-relative d-flex align-items-center" style={{ height: '24px' }}>
                        {/* Background Track */}
                        <div className="w-100 bg-light rounded-pill overflow-hidden" style={{ height: '6px' }}>
                            <div
                                className="h-100"
                                style={{
                                    width: `${progress}%`,
                                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                                    transition: 'width 0.1s linear' // smoother update
                                }}
                            />
                        </div>

                        {/* Visual Thumb */}
                        <div
                            className="position-absolute bg-white rounded-circle shadow border border-2"
                            style={{
                                width: '16px',
                                height: '16px',
                                left: `calc(${progress}% - 8px)`,
                                borderColor: '#764ba2',
                                pointerEvents: 'none',
                                transition: 'left 0.1s linear'
                            }}
                        />

                        {/* Interactive Invisible Input */}
                        <input
                            type="range"
                            className="position-absolute w-100 h-100 opacity-0 cursor-pointer"
                            style={{ top: 0, left: 0, zIndex: 10, margin: 0 }}
                            min="0"
                            max="100"
                            value={progress}
                            onChange={handleSeek}
                            disabled={!audioUrl}
                        />
                    </div>

                    <div className="d-flex justify-content-between text-muted small mt-1 fw-bold font-monospace">
                        <span style={{ fontSize: '0.75rem' }}>{formatTime(currentTime)}</span>
                        <span style={{ fontSize: '0.75rem' }}>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="d-flex align-items-center justify-content-center gap-4 mb-4 text-secondary">
                    <button
                        className="btn btn-link link-secondary p-0 text-decoration-none hover-scale"
                        onClick={skipBack}
                        disabled={!audioUrl}
                        title="-15s"
                    >
                        <div className="d-flex flex-column align-items-center small">
                            <Rewind size={24} strokeWidth={1.5} />
                            <span style={{ fontSize: '0.7rem' }}>-15s</span>
                        </div>
                    </button>

                    <button
                        className="btn btn-primary btn-lg rounded-circle shadow-lg hover-scale d-flex align-items-center justify-content-center"
                        style={{ width: '70px', height: '70px' }}
                        onClick={togglePlay}
                        disabled={!audioUrl}
                    >
                        {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" className="ms-1" />}
                    </button>

                    <button
                        className="btn btn-link link-secondary p-0 text-decoration-none hover-scale"
                        onClick={skipForward}
                        disabled={!audioUrl}
                        title="+15s"
                    >
                        <div className="d-flex flex-column align-items-center small">
                            <FastForward size={24} strokeWidth={1.5} />
                            <span style={{ fontSize: '0.7rem' }}>+15s</span>
                        </div>
                    </button>
                </div>

                {/* Footer Actions */}
                <div className="d-flex justify-content-between w-100 border-top pt-3 mt-auto">
                    <button
                        className="btn btn-sm btn-light rounded-pill border px-3 text-secondary fw-bold"
                        onClick={changeSpeed}
                    >
                        {playbackRate}x Speed
                    </button>

                    <div className="d-flex gap-2">
                        <button
                            className="btn btn-sm btn-outline-secondary rounded-pill px-3 d-flex align-items-center gap-1"
                            onClick={handleDownload}
                            title="Download MP3"
                            disabled={!audioUrl}
                        >
                            <Download size={14} /> <span className="small fw-bold">Save</span>
                        </button>

                        <button
                            className="btn btn-sm btn-link text-secondary text-decoration-none d-flex align-items-center gap-1"
                            onClick={() => onRegenerate(currentPodcast)}
                            title="Regenerate Audio will consume 1 credit"
                        >
                            <RefreshCw size={14} /> <span className="small fw-bold">Regenerate</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PodcastPlayer;
