import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Pause, Sidebar, CheckCircle, Loader2, Maximize2, Minimize2, Download, Smartphone, Monitor, AlertCircle, RefreshCw } from 'lucide-react';

const AgenticPPTGenerator = ({ topic, details, onBack }) => {
    const [status, setStatus] = useState('planning'); // planning, generating, completed
    const [slides, setSlides] = useState([]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [logs, setLogs] = useState([]);
    const [isPaused, setIsPaused] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [previewMode, setPreviewMode] = useState('desktop'); // desktop, mobile
    const [showLogs, setShowLogs] = useState(true);

    // Configuration / Defaults for the Mega Prompt
    const config = {
        classificationInfo: "Educational Presentation",
        colorThemeString: "Modern Gradient Blue & Purple",
        bgitem: "Abstract Particles or Geometric Shapes",
        termsdepth: "University Level",
        animationStyle: "Smooth Ease-in-out",
        structure: "Title, Body, Visuals",
        theme: "Glassmorphism",
        descriptionLength: "2-3 concise paragraphs",
        bulletPointsCount: 4,
        fontSize: "Responsive (2rem headings, 1.2rem body)",
        includeImages: "Use Unsplash placeholders or CSS-generated art",
        imageFallback: "CSS Pattern Fallback",
        presentationLanguage: "English",
        presentationStyle: "Minimalist High-Tech",
        advancedAnimations: "CSS Keyframes & Three.js where appropriate",
        interactiveElements: "Hover states on cards",
        dataVisualization: "CSS Charts if applicable",
        multimediaElements: "Embedded SVG Icons"
    };

    const cleanAndParseJSON = (text) => {
        try {
            // Remove markdown code blocks
            let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            // Try to find the JSON object if there's extra text
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            const firstBracket = cleaned.indexOf('[');
            const lastBracket = cleaned.lastIndexOf(']');

            // Determine if we should look for array or object
            // If we have both, prefer the one that starts earlier
            if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
                if (lastBracket !== -1) cleaned = cleaned.substring(firstBracket, lastBracket + 1);
            } else if (firstBrace !== -1 && lastBrace !== -1) {
                cleaned = cleaned.substring(firstBrace, lastBrace + 1);
            }

            return JSON.parse(cleaned);
        } catch (e) {
            console.error("JSON Parse Error:", e, text);
            // Fallback: try to basically extract anything that looks like a title list
            // formatting: ["Title 1", "Title 2"]
            const rudimentaryMatch = text.match(/"([^"]+)"/g);
            if (rudimentaryMatch && rudimentaryMatch.length >= 3) { // Lowered threshold
                // Filter out keys like "role", "content" if they appear accidentally
                return rudimentaryMatch.map(s => s.replace(/"/g, '')).filter(s => s.length > 3 && !['user', 'system', 'assistant'].includes(s));
            }
            throw new Error("Failed to parse AI response. Raw: " + text.substring(0, 50) + "...");
        }
    };

    // Initial Plan Generation
    useEffect(() => {
        const generatePlan = async () => {
            addLog("Analyze topic: " + topic);
            addLog("Creating presentation outline...");

            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": window.location.origin,
                        "X-Title": "IES Notes AI"
                    },
                    body: JSON.stringify({
                        "model": "openrouter/aurora-alpha",
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are an expert presentation designer. Create a 5-slide outline for the given topic. Return ONLY a JSON array of strings, where each string is a slide title. Example: [\"Introduction\", \"History\", ...]"
                            },
                            { "role": "user", "content": `Topic: ${topic}. Details: ${details}` }
                        ],
                        "response_format": { "type": "json_object" }
                    })
                });

                const data = await response.json();
                const outline = cleanAndParseJSON(data.choices[0].message.content);

                // Handle both array or object with key "slides" or similar
                const slideTitles = Array.isArray(outline) ? outline : (outline.slides || outline.titles || []);

                const initialSlides = slideTitles.map(title => ({
                    title,
                    html: null,
                    status: 'pending' // pending, generating, completed, error
                }));

                setSlides(initialSlides);
                setStatus('generating');
                addLog(`Plan created: ${initialSlides.length} slides.`);

            } catch (err) {
                addLog("Error creating plan: " + err.message);
                setStatus('error');
            }
        };

        generatePlan();
    }, [topic]);

    // Slide Generation Loop
    useEffect(() => {
        if (status !== 'generating' || isPaused) return;

        const generateNextSlide = async () => {
            const nextSlideIdx = slides.findIndex(s => s.status === 'pending' || s.status === 'retry');
            if (nextSlideIdx === -1) {
                // If there are errors, stop but don't mark all complete if some failed
                if (slides.some(s => s.status === 'error')) {
                    setIsPaused(true);
                    addLog("Generation paused due to errors. check slides.");
                } else {
                    setStatus('completed');
                    addLog("All slides generated successfully!");
                }
                return;
            }

            setCurrentSlideIndex(nextSlideIdx);

            // Update status to generating
            setSlides(prev => prev.map((s, i) => i === nextSlideIdx ? { ...s, status: 'generating' } : s));

            const slideTitle = slides[nextSlideIdx].title;
            addLog(`Design Slide ${nextSlideIdx + 1}: ${slideTitle}...`);

            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": window.location.origin,
                        "X-Title": "IES Notes AI"
                    },
                    body: JSON.stringify({
                        "model": "openrouter/aurora-alpha",
                        "messages": [
                            {
                                "role": "system",
                                "content": `You are a high-end web developer creating a presentation slide provided in the user prompt.
                               
                                The slide should have the following features:
                                1. Design: Use clean, professional designs with glassmorphism UI elements. The UI should have a glass-like appearance with backdrop blur effects.
                                2. Color scheme: Use colors suitable for the topic "${topic}". Apply the selected color theme: "${config.colorThemeString}".
                                3. 3D theme background: Slide should have a Three.js 3D background as "${config.bgitem}" if appropriate, or a high-quality CSS gradient/animation.
                                4. Content depth: Use "${config.termsdepth}" for the content language style.
                                5. Animations: Use CSS for all animations. The animation style should be "${config.animationStyle}".
                                6. Structure: The slide should follow the "${config.structure}" format.
                                7. Theme: The overall theme should be "${config.theme}".
                                8. Font size: Use ${config.fontSize} font size throughout.
                                9. Images: ${config.includeImages}. For SVG graphics, use inline SVG code.
                                10. Language: ${config.presentationLanguage}.
                                11. Presentation style: "${config.presentationStyle}".
                                12. 3D elements: Include ${config.advancedAnimations}.
                                13. Interactive elements: Implement ${config.interactiveElements}.
                                14. Data visualization: ${config.dataVisualization}.

                                Additional requirements:
                                - Make the content responsive.
                                - Use semantic HTML5 tags.
                                - Add smooth transitions.
                                - Include professional typography (Google Fonts: Inter, Roboto).
                                - IMPORTANT: DO NOT include <html>, <head>, or <body> tags. 
                                - Return ONLY the raw HTML string for the 'div' representing the slide.
                                - The wrapper div should have 'width: 100%; height: 100%; overflow: hidden; position: relative;'.
                                - If using Three.js, include the CDN script tag inside the HTML string: <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script> and ensure the canvas creates a background.
                                `
                            },
                            { "role": "user", "content": `Create a slide for: "${slideTitle}" based on topic "${topic}". Details: ${details}` }
                        ]
                    })
                });

                const data = await response.json();
                let html = data.choices[0].message.content;
                // Clean markdown
                html = html.replace(/```html/g, '').replace(/```/g, '').trim();

                // Content validation
                if (!html || html.length < 50) throw new Error("Generated content too short");

                setSlides(prev => prev.map((s, i) => i === nextSlideIdx ? { ...s, html, status: 'completed' } : s));
                addLog(`Slide ${nextSlideIdx + 1} completed.`);

                // Small delay for effect
                await new Promise(r => setTimeout(r, 2000));

            } catch (err) {
                addLog(`Error generating slide ${nextSlideIdx + 1}: ${err.message}`);
                setSlides(prev => prev.map((s, i) => i === nextSlideIdx ? { ...s, status: 'error' } : s)); // basic error handling
                setIsPaused(true);
            }
        };

        generateNextSlide();
    }, [slides, status, isPaused]);

    const addLog = (msg) => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);
    };

    const togglePause = () => setIsPaused(!isPaused);

    const retrySlide = (index) => {
        setSlides(prev => prev.map((s, i) => i === index ? { ...s, status: 'retry' } : s));
        setIsPaused(false);
        setStatus('generating');
    };

    const downloadHTML = () => {
        const fullContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${topic} Presentation</title>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
                <style>
                    body { margin: 0; padding: 0; background: #000; font-family: sans-serif; overflow: hidden; }
                    .slide-container { width: 100vw; height: 100vh; display: none; position: absolute; top:0; left:0; }
                    .slide-container.active { display: block; animation: fadeIn 0.5s ease; }
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    .controls { position: fixed; bottom: 20px; right: 20px; z-index: 1000; display: flex; gap: 10px; }
                    button { padding: 10px 20px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); border-radius: 30px; cursor: pointer; font-weight: bold; color: white; backdrop-filter: blur(10px); }
                    button:hover { background: rgba(255,255,255,0.4); }
                </style>
            </head>
            <body>
                ${slides.map((s, i) => `<div class="slide-container ${i === 0 ? 'active' : ''}" id="slide-${i}">${s.html}</div>`).join('')}
                
                <div class="controls">
                    <button onclick="prevSlide()">Prev</button>
                    <button onclick="nextSlide()">Next</button>
                    <button onclick="toggleFS()">Fullscreen</button>
                </div>

                <script>
                    let current = 0;
                    const total = ${slides.length};
                    function showSlide(idx) {
                        document.querySelectorAll('.slide-container').forEach(el => el.classList.remove('active'));
                        document.getElementById('slide-' + idx).classList.add('active');
                        // Dispatch event for any slide-specific JS to catch
                        window.dispatchEvent(new CustomEvent('slideChanged', { detail: { index: idx } }));
                    }
                    function nextSlide() {
                        current = (current + 1) % total;
                        showSlide(current);
                    }
                    function prevSlide() {
                        current = (current - 1 + total) % total;
                        showSlide(current);
                    }
                     function toggleFS() {
                        if (!document.fullscreenElement) {
                            document.documentElement.requestFullscreen();
                        } else {
                            if (document.exitFullscreen) {
                                document.exitFullscreen();
                            }
                        }
                    }
                    document.addEventListener('keydown', (e) => {
                        if(e.key === 'ArrowRight') nextSlide();
                        if(e.key === 'ArrowLeft') prevSlide();
                        if(e.key === 'f') toggleFS();
                    });
                </script>
            </body>
            </html>
        `;

        const blob = new Blob([fullContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${topic.replace(/\s+/g, '_')}_Presentation.html`;
        a.click();
    };

    return (
        <div className={`d-flex flex-column bg-white text-dark ${isFullscreen ? 'fixed-top w-100 h-100' : 'h-100 w-100 rounded-4 overflow-hidden'}`} style={{ zIndex: isFullscreen ? 1080 : 'auto', background: 'white' }}>

            {/* Header */}
            <div className="p-2 p-md-3 border-bottom border-secondary border-opacity-20 d-flex flex-wrap justify-content-between align-items-center gap-3" style={{ background: '#f8fafc' }}>
                <div className="d-flex align-items-center gap-3">
                    <button onClick={onBack} className="btn btn-outline-secondary rounded-circle p-2 d-flex align-items-center justify-content-center border-0 bg-light" style={{ width: 40, height: 40 }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div className="d-none d-sm-block">
                        <h5 className="mb-0 fw-bold">{topic}</h5>
                        <small className="text-secondary opacity-75">Agentic Generator • {slides.length} Slides</small>
                    </div>
                </div>
                <div className="d-flex gap-2 align-items-center flex-wrap">
                    <button onClick={() => setShowLogs(!showLogs)} className={`btn btn-sm btn-outline-secondary rounded-pill p-2 ${showLogs ? 'active' : ''}`} title="Toggle Logs">
                        <Sidebar size={16} />
                    </button>
                    <button onClick={togglePause} className="btn btn-sm btn-outline-warning d-flex align-items-center gap-2 rounded-pill px-3">
                        {isPaused ? <Play size={16} /> : <Pause size={16} />}
                        <span className="d-none d-md-inline">{isPaused ? "Resume" : "Pause"}</span>
                    </button>
                    <button onClick={() => setPreviewMode(previewMode === 'desktop' ? 'mobile' : 'desktop')} className="btn btn-sm btn-outline-secondary rounded-pill px-3 d-flex align-items-center gap-2">
                        {previewMode === 'desktop' ? <Smartphone size={16} /> : <Monitor size={16} />}
                        <span className="d-none d-md-inline">{previewMode === 'desktop' ? 'Mobile View' : 'Desktop View'}</span>
                    </button>
                    <button onClick={() => setIsFullscreen(!isFullscreen)} className="btn btn-sm btn-outline-secondary rounded-pill p-2" title="Toggle Fullscreen">
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    {status === 'completed' && (
                        <button onClick={downloadHTML} className="btn btn-sm btn-success d-flex align-items-center gap-2 rounded-pill px-3 fw-bold shadow-lg">
                            <Download size={16} /> <span className="d-none d-md-inline">Download</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-grow-1 d-flex overflow-hidden position-relative">

                {/* Sidebar Logs (Collapsible) */}
                <AnimatePresence initial={false}>
                    {showLogs && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 300, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="border-end border-secondary border-opacity-20 h-100 overflow-hidden d-flex flex-column"
                            style={{ background: '#f1f5f9', minWidth: 0 }}
                        >
                            <div className="p-3 overflow-auto custom-scrollbar flex-grow-1" style={{ fontSize: '0.85rem' }}>
                                <h6 className="fw-bold text-uppercase text-secondary mb-3 small tracking-wider">Agent Logs</h6>
                                <div className="d-flex flex-column gap-2">
                                    {logs.map((log, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="d-flex gap-2 font-monospace border-bottom border-light border-opacity-10 pb-2"
                                        >
                                            <span className="text-secondary flex-shrink-0 opacity-50" style={{ fontSize: '0.7em', marginTop: '3px' }}>{log.time}</span>
                                            <span className={log.msg.includes('Error') ? 'text-danger' : 'text-success'}>
                                                {log.msg}
                                            </span>
                                        </motion.div>
                                    ))}
                                    {status === 'generating' && !isPaused && (
                                        <div className="d-flex gap-2 align-items-center text-info mt-2">
                                            <Loader2 size={14} className="spin" />
                                            <span className="small">Agent is thinking...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Slide Preview Area */}
                <div className="flex-grow-1 p-3 p-md-4 d-flex flex-column align-items-center justify-content-center position-relative overflow-hidden"
                    style={{
                        background: 'radial-gradient(circle at center, #2d3748 0%, #1a202c 100%)',
                        perspective: '1000px'
                    }}>

                    {/* Responsive Container */}
                    <div className="position-relative w-100 h-100 d-flex align-items-center justify-content-center">
                        <motion.div
                            initial={false}
                            animate={{
                                width: previewMode === 'mobile' ? '375px' : '100%',
                                aspectRatio: previewMode === 'desktop' ? '16/9' : '9/16',
                                scale: previewMode === 'mobile' ? 0.9 : 1
                            }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className={`position-relative bg-white shadow-2xl transition-all duration-300 ${previewMode === 'mobile' ? 'rounded-4 border border-8 border-dark' : 'rounded-lg'}`}
                            style={{
                                maxWidth: previewMode === 'desktop' ? '1280px' : '375px',
                                maxHeight: '100%',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                            }}
                        >
                            {/* Loading / Ready State */}
                            {slides[currentSlideIndex]?.html ? (
                                <div className="w-100 h-100 overflow-hidden rounded-inner position-relative">
                                    <iframe
                                        srcDoc={`
                                            <html>
                                            <head>
                                                <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
                                                <style>
                                                    body { margin: 0; overflow: hidden; height: 100vh; width: 100vw; }
                                                    /* Scrollbar hiding */
                                                    ::-webkit-scrollbar { display: none; }
                                                </style>
                                            </head>
                                            <body>${slides[currentSlideIndex].html}</body>
                                            </html>
                                        `}
                                        className="w-100 h-100 border-0 d-block"
                                        title="Slide Preview"
                                        sandbox="allow-scripts allow-same-origin"
                                    />
                                    {/* Glass Overlay for interaction blocking if needed, or leave interactive */}
                                </div>
                            ) : (
                                <div className="w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-dark text-white rounded-inner">
                                    {slides[currentSlideIndex]?.status === 'error' ? (
                                        <div className="text-center p-4">
                                            <AlertCircle size={48} className="text-danger mb-3" />
                                            <h5 className="text-danger">Generation Error</h5>
                                            <p className="text-secondary small mb-3">Failed to generate this slide.</p>
                                            <button onClick={() => retrySlide(currentSlideIndex)} className="btn btn-outline-light btn-sm d-flex align-items-center gap-2 mx-auto">
                                                <RefreshCw size={14} /> Retry Slide
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="position-relative">
                                                <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status"></div>
                                                <div className="spinner-grow text-info position-absolute top-50 start-50 translate-middle" style={{ width: '1.5rem', height: '1.5rem', opacity: 0.5 }} role="status"></div>
                                            </div>
                                            <h5 className="mt-4 fw-light">Generating Slide {currentSlideIndex + 1}...</h5>
                                            <p className="text-secondary small">{slides[currentSlideIndex]?.title || 'Analyzing...'}</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Floating Navigation Controls - Always visible on bottom */}
                    <div className="position-absolute bottom-4 start-50 translate-middle-x d-flex gap-2 p-2 rounded-pill bg-dark bg-opacity-75 backdrop-blur shadow-lg border border-secondary border-opacity-25 z-index-10" style={{ backdropFilter: 'blur(8px)', zIndex: 10 }}>
                        <button
                            disabled={currentSlideIndex === 0}
                            onClick={() => setCurrentSlideIndex(c => c - 1)}
                            className="btn btn-sm text-white rounded-circle hover-bg-white-20"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <span className="text-white small py-1 px-3 d-flex align-items-center font-monospace">
                            {currentSlideIndex + 1} / {slides.length || '-'}
                        </span>
                        <button
                            disabled={currentSlideIndex >= slides.length - 1}
                            onClick={() => setCurrentSlideIndex(c => c + 1)}
                            className="btn btn-sm text-white rounded-circle hover-bg-white-20"
                        >
                            <ArrowLeft size={18} style={{ rotate: '180deg' }} />
                        </button>
                    </div>

                </div>
            </div>
            <style>{`
                .spin { animation: spin 2s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                .hover-bg-white-20:hover { background: rgba(255,255,255,0.2); }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
                .rounded-inner { border-radius: inherit; }
            `}</style>
        </div>
    );
};

export default AgenticPPTGenerator;
