import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Pause, Sidebar, CheckCircle, Loader2, Maximize2, Minimize2, Download, Smartphone, Monitor, AlertCircle, RefreshCw, Sparkles, Layout } from 'lucide-react';

const AgenticPPTGenerator = ({ topic, details, slideCount = 5, onBack, customInstructions = '', theme = 'modern', descriptionLength = 'short', includeDiagrams = true }) => {
    const [status, setStatus] = useState('planning'); // planning, generating, completed, error
    const [slides, setSlides] = useState([]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [logs, setLogs] = useState([]);
    const [isPaused, setIsPaused] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [previewMode, setPreviewMode] = useState('desktop'); // desktop, mobile
    const [showLogs, setShowLogs] = useState(true);
    const [chatInput, setChatInput] = useState('');
    const [isRefining, setIsRefining] = useState(false);

    const logsEndRef = useRef(null);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs, showLogs]);

    // Mobile Check
    useEffect(() => {
        const checkMobile = () => {
            if (window.innerWidth < 768) {
                setShowLogs(false);
                setPreviewMode('mobile');
            }
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // ... (rest of the component)

    const addLog = (msg) => {
        setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg }, ...prev]);
    };

    const cleanAndParseJSON = (text) => {
        try {
            // Remove markdown formatters
            let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

            // Try direct parse first
            try {
                return JSON.parse(cleaned);
            } catch (e) {
                // Determine if we are looking for an Object {} or Array []
                const firstBrace = cleaned.indexOf('{');
                const firstBracket = cleaned.indexOf('[');

                let startIdx = -1;
                let endIdx = -1;

                // Find the first occurrence of { or [
                if (firstBrace !== -1 && firstBracket !== -1) {
                    startIdx = Math.min(firstBrace, firstBracket);
                } else if (firstBrace !== -1) {
                    startIdx = firstBrace;
                } else if (firstBracket !== -1) {
                    startIdx = firstBracket;
                }

                if (startIdx === -1) throw new Error("No JSON structure found");

                // Determine likely end character based on start character
                const isObject = cleaned[startIdx] === '{';
                endIdx = isObject ? cleaned.lastIndexOf('}') : cleaned.lastIndexOf(']');

                if (endIdx === -1 || endIdx <= startIdx) throw new Error("Incomplete JSON structure");

                return JSON.parse(cleaned.substring(startIdx, endIdx + 1));
            }
        } catch (e) {
            console.error("JSON Parse Error:", e, "\nOriginal Text:", text);
            throw new Error("Failed to parse AI response.");
        }
    };

    const generatePlan = async () => {
        addLog(`🎨 Creative Brief: Designing a premium ${slideCount}-slide experience for "${topic}"`);
        setStatus('planning');

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
                            "content": `You are a world-class presentation director and visual storyteller. 
                            Create a detailed visual and content plan for a ${slideCount}-slide presentation on "${topic}".
                            
                            CONTEXT: ${customInstructions ? `User Instructions: "${customInstructions}"` : 'No specific user instructions.'}
                            LENGTH: ${descriptionLength === 'short' ? 'Keep content concise and punchy.' : 'Provide detailed, comprehensive content.'}
                            DIAGRAMS: ${includeDiagrams ? 'Aggressively suggest diagrams/visuals for complex concepts.' : 'Do NOT suggest complex diagrams, focus on text/images.'}

                            Your goal is to make a "Wow" presentation that is readable, aesthetic, and professionally structured.
                            For each slide, define:
                            1. 'title': Engaging and bold.
                            2. 'type': 'hero' | 'grid' | 'split' | 'quote' | 'data' | 'conclusion'.
                            3. 'detailedPrompt': Visual instructions for a developer. Describe the layout, icons, and specific points.
                            
                            RETURN ONLY A JSON ARRAY OF OBJECTS (Do not wrap in an object):
                            [
                              { "title": "...", "type": "...", "detailedPrompt": "..." },
                              ...
                            ]`
                        },
                        { "role": "user", "content": `Topic: ${topic}. Context: ${details}` }
                    ],
                    "response_format": { "type": "json_object" }
                })
            });

            const data = await response.json();

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                console.error("Invalid AI Response:", data);
                throw new Error("Invalid response from AI provider");
            }

            let planLines = data.choices[0].message.content;
            let plan = cleanAndParseJSON(planLines);

            // Robust handling for AI returning an object instead of array
            if (!Array.isArray(plan)) {
                // Try common keys
                if (plan.slides && Array.isArray(plan.slides)) plan = plan.slides;
                else if (plan.items && Array.isArray(plan.items)) plan = plan.items;
                else if (plan.plan && Array.isArray(plan.plan)) plan = plan.plan;
                else {
                    // Try to find ANY array property
                    const potentialArray = Object.values(plan).find(val => Array.isArray(val));
                    if (potentialArray) {
                        plan = potentialArray;
                    } else {
                        console.error("Plan Validation Action:", plan);
                        throw new Error("AI did not return a valid list of slides.");
                    }
                }
            }

            const initialSlides = plan.map(item => ({
                title: item.title,
                type: item.type,
                prompt: item.detailedPrompt,
                html: null,
                status: 'pending'
            }));

            setSlides(initialSlides);
            setStatus('generating');
            addLog(`✨ Concept Approved: Visual storyboard ready for synthesis.`);

        } catch (err) {
            console.error("Planning Error:", err);
            addLog("❌ Planning Error: " + err.message);
            setStatus('error');
        }
    };

    // Phase 1: Planning (Generate prompts for all slides)
    useEffect(() => {
        if (slides.length === 0 && status === 'planning') {
            generatePlan();
        }
    }, [topic, slideCount]);

    // Phase 2: Iterative Slide Generation
    useEffect(() => {
        if (status !== 'generating' || isPaused || isRefining) return;

        const generateNextSlide = async () => {
            const nextSlideIdx = slides.findIndex(s => s.status === 'pending');
            if (nextSlideIdx === -1) {
                // Check if any error slides exist
                if (slides.some(s => s.status === 'error')) {
                    setStatus('error');
                    return;
                }
                setStatus('completed');
                addLog("🏆 Presentation synthesized successfully. Ready for preview.");
                return;
            }

            setCurrentSlideIndex(nextSlideIdx);
            setSlides(prev => prev.map((s, i) => i === nextSlideIdx ? { ...s, status: 'generating' } : s));

            const slide = slides[nextSlideIdx];
            addLog(`🏗️ Building Slide ${nextSlideIdx + 1}: ${slide.title}...`);

            try {
                const html = await generateSlideHTML(slide.title, slide.type, slide.prompt, topic);
                setSlides(prev => prev.map((s, i) => i === nextSlideIdx ? { ...s, html, status: 'completed' } : s));
                addLog(`✅ Slide ${nextSlideIdx + 1} refined and rendered.`);

            } catch (err) {
                addLog(`⚠️ Synthesis Interrupted (Slide ${nextSlideIdx + 1}): ${err.message}`);
                setSlides(prev => prev.map((s, i) => i === nextSlideIdx ? { ...s, status: 'error' } : s));
                setIsPaused(true);
            }
        };

        generateNextSlide();
    }, [slides, status, isPaused, isRefining]);

    const generateSlideHTML = async (title, type, prompt, topic, currentHTML = null, userInstruction = null) => {

        // Dynamic Theme Generator
        const getThemeRules = (t) => {
            if (t === 'minimal') return `Theme: Minimalist Light. Background: #f8fafc. Text: #0f172a (Primary), #475569 (Secondary). Accents: #3b82f6 (Blue). Card Background: rgba(255,255,255,0.8) with border #e2e8f0.`;
            if (t === 'nature') return `Theme: Nature/Earth. Background: linear-gradient(135deg, #064e3b 0%, #14532d 100%). Text: #ecfdf5. Accents: #34d399. Cards: Glassmorphism heavy blur.`;
            if (t === 'corporate') return `Theme: Corporate Professional. Background: #eff6ff. Text: #1e3a8a. Accents: #2563eb. Cards: White shadow cards.`;
            return `Theme: Royal Dark Mode (Background: radial-gradient(circle at 0% 0%, #1e1b4b 0%, #020617 100%)). Text: White/Silver. Cards: Glassmorphism.`; // Modern/Default
        };

        const themeRules = getThemeRules(theme);

        let systemPrompt = `You are a senior Web UI Designer creating ultra-premium presentation slides.
        Create a stunning, high-contrast, and extremely readable HTML slide for: "${title}".
        
        DESIGN SYSTEM:
        - ${themeRules}
        - Typography: Use 'Outfit' or 'Inter'. Title: 5vh bold (max 8vh). Body: 2.5vh-3vh light/regular.
        - Visuals: Use flexbox/grid. Enforce 'flex-shrink: 1' on all internal elements.
        - Spacing: Use 'vh' for margins and gaps (e.g., gap: 2vh).
        - Motion: Add entrance animations (@keyframes fadeInDown { from { opacity: 0; transform: translateY(-2vh); } to { opacity: 1; transform: translateY(0); } }).
        
        VISUAL CONTENT RULES (CRITICAL):
        1. **Mermaid Diagrams**: ${includeDiagrams ? 'For ANY data, process, workflow, or structure, YOU MUST use a Mermaid.js diagram. Embed inside: <div class="mermaid"> ...graph definition... </div>' : 'DO NOT use Mermaid diagrams. Use CSS shapes, icons, or text layouts instead.'}
        2. **Vector Graphics**: Use ONLY inline SVGs for icons and illustrations.
           - DO NOT use <img> tags with external URLs.
        
        LAYOUT RULES for Slide Type "${type}":
        - hero: Massive centered title (7vh), subtext, 1 focal icon or Visual.
        - grid: 3-4 cards.
        - split: 45% Visual + 55% Content.
        - quote: 4vh italicized text with horizontal accent lines.
        
        TECHNICAL:
        - NO <html>, <head>, or <body> tags.
        - Return ONLY the containing <div>.
        - Wrapper style: width: 100%; height: 100%; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4vh; box-sizing: border-box;
        - VERTICAL SPACE: This slide is 16:9. You MUST NOT overflow the bottom. If there is a lot of text, truncate it or use smaller fonts.`;

        let userPrompt = `Synthesis Directive: ${prompt}. Topic: ${topic}. 
        Constraint: ${descriptionLength === 'short' ? 'Keep text concise (bullet points, short sentences).' : 'Explain in detail with fuller sentences.'}
        IMPORTANT: Content MUST be perfectly contained within the 16:9 frame. Use 'vh' units for all font-sizes and spacing.`;

        if (userInstruction && currentHTML) {
            systemPrompt += `\n\nTASK: The user wants to Modify the existing slide. Retain the core structure but apply the change.`;
            userPrompt += `\n\nCURRENT HTML: ${currentHTML}\n\nUSER MODIFICATION REQUEST: ${userInstruction}`;
        }

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
                    { "role": "system", "content": systemPrompt },
                    { "role": "user", "content": userPrompt }
                ]
            })
        });

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error("Slide Synthesis Error:", data);
            throw new Error("Invalid response from AI provider");
        }

        let html = data.choices[0].message.content;
        html = html.replace(/```html/g, '').replace(/```/g, '').trim();

        if (!html.includes('<div')) throw new Error("Synthesis failed to produce valid markup.");
        return html;
    };


    const togglePause = () => setIsPaused(!isPaused);

    const handleRetry = () => {
        if (status === 'error' && slides.length === 0) {
            // Planning failed
            generatePlan();
        } else {
            // Reset error slides to pending
            setSlides(prev => prev.map(s => s.status === 'error' ? { ...s, status: 'pending' } : s));
            setStatus('generating');
            setIsPaused(false);
        }
    };

    const handleRefineSlide = async () => {
        if (!chatInput.trim() || isRefining) return;

        const currentSlide = slides[currentSlideIndex];
        if (!currentSlide || !currentSlide.html) return;

        setIsRefining(true);
        const originalInput = chatInput;
        setChatInput('');
        addLog(`🛠️ Refining Slide ${currentSlideIndex + 1}: "${originalInput}"...`);

        try {
            const newHtml = await generateSlideHTML(
                currentSlide.title,
                currentSlide.type,
                currentSlide.prompt,
                topic,
                currentSlide.html,
                originalInput
            );

            setSlides(prev => prev.map((s, i) => i === currentSlideIndex ? { ...s, html: newHtml } : s));
            addLog(`✅ Slide ${currentSlideIndex + 1} updated.`);
        } catch (err) {
            addLog(`❌ Refinement Failed: ${err.message}`);
        } finally {
            setIsRefining(false);
        }
    };

    const downloadHTML = () => {
        const fullContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${topic} - IES AI Presentation</title>
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
                <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
                <script>mermaid.initialize({startOnLoad:true, theme: 'dark'});</script>
                <style>
                    * { box-sizing: border-box; }
                    body { 
                        margin: 0; 
                        padding: 0; 
                        background: #020617; 
                        font-family: 'Outfit', sans-serif; 
                        overflow: hidden; 
                        color: #f8fafc;
                        width: 100vw;
                        height: 100vh;
                    }
                    .presentation { width: 100%; height: 100%; position: relative; }
                    .slide-container { width: 100%; height: 100%; display: none; position: absolute; top:0; left:0; transition: opacity 0.8s ease-in-out; }
                    .slide-container.active { display: block; }
                    .controls { 
                        position: fixed; 
                        bottom: 40px; 
                        left: 50%; 
                        transform: translateX(-50%); 
                        z-index: 1000; 
                        display: flex; 
                        gap: 15px; 
                        background: rgba(15, 23, 42, 0.7); 
                        padding: 12px 24px; 
                        border-radius: 50px; 
                        backdrop-filter: blur(20px); 
                        border: 1px solid rgba(255,255,255,0.1); 
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    }
                    button { 
                        padding: 10px 22px; 
                        background: transparent; 
                        border: none; 
                        border-radius: 25px; 
                        cursor: pointer; 
                        font-weight: 600; 
                        color: white; 
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                        font-size: 14px; 
                        border: 1px solid rgba(255,255,255,0.05);
                    }
                    button:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }
                    button:disabled { opacity: 0.3; cursor: not-allowed; }
                    .progress { position: fixed; top: 0; left: 0; height: 5px; background: linear-gradient(90deg, #3b82f6, #a855f7); transition: width 0.4s; z-index: 1001; }
                    .slide-num { display:flex; align-items:center; opacity: 0.5; font-size: 13px; font-weight: 500; letter-spacing: 0.05em; margin: 0 10px; }
                </style>
            </head>
            <body>
                <div class="progress" id="progressBar" style="width: 0%"></div>
                <div class="presentation">
                    ${slides.map((s, i) => `<div class="slide-container ${i === 0 ? 'active' : ''}" id="slide-${i}">${s.html}</div>`).join('')}
                </div>
                
                <div class="controls">
                    <button id="prevBtn" onclick="prevSlide()">Pre</button>
                    <span id="slideCounter" class="slide-num">1 / ${slides.length}</span>
                    <button id="nextBtn" onclick="nextSlide()">Next</button>
                    <button id="fsBtn" onclick="toggleFS()">⛶</button>
                </div>

                <script>
                    let current = 0;
                    const total = ${slides.length};
                    function updateUI() {
                        document.querySelectorAll('.slide-container').forEach(el => el.classList.remove('active'));
                        document.getElementById('slide-' + current).classList.add('active');
                        document.getElementById('slideCounter').innerText = (current + 1) + ' / ' + total;
                        document.getElementById('progressBar').style.width = ((current + 1) / total * 100) + '%';
                        document.getElementById('prevBtn').disabled = current === 0;
                        document.getElementById('nextBtn').disabled = current === total -1;
                    }
                    function nextSlide() { if(current < total - 1) { current++; updateUI(); } }
                    function prevSlide() { if(current > 0) { current--; updateUI(); } }
                    function toggleFS() {
                        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
                        else if (document.exitFullscreen) document.exitFullscreen();
                    }
                    document.addEventListener('keydown', (e) => {
                        if(e.key === 'ArrowRight' || e.key === ' ') nextSlide();
                        if(e.key === 'ArrowLeft') prevSlide();
                    });
                    updateUI();
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
        <div className={`d-flex flex-column bg-white text-dark ${isFullscreen ? 'fixed-top w-100 h-100' : 'h-100 w-100 rounded-4 overflow-hidden'}`} style={{ zIndex: isFullscreen ? 1080 : 'auto' }}>
            {/* Header */}
            {!isFullscreen && (
                <div className="p-3 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-3" style={{ background: '#f8fafc' }}>
                    <div className="d-flex align-items-center gap-3">
                        <button onClick={onBack} className="btn btn-secondary rounded-circle p-2 d-flex align-items-center justify-content-center shadow-sm border-0" style={{ width: 40, height: 40, background: '#e2e8f0', color: '#475569' }}>
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h6 className="mb-0 fw-bold text-dark text-truncate" style={{ maxWidth: '200px' }}>{topic}</h6>
                            <small className={`text-secondary opacity-75 ${status === 'error' ? 'text-danger fw-bold' : ''}`}>
                                {status === 'completed' ? 'Synthesis Complete' : status === 'error' ? 'Generation Stopped' : 'AI Engine is Crafting...'}
                            </small>
                        </div>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                        {status === 'error' && (
                            <button onClick={handleRetry} className="btn btn-sm btn-danger rounded-pill px-3 fw-bold animate-pulse">
                                <RefreshCw size={14} className="me-1" /> Retry
                            </button>
                        )}
                        <button onClick={() => setShowLogs(!showLogs)} className={`btn btn-sm ${showLogs ? 'btn-primary' : 'btn-outline-primary'} rounded-pill px-3 fw-bold d-none d-md-flex align-items-center`}>
                            <Sidebar size={14} className="me-1" /> {showLogs ? 'Hide Logs' : 'Logs'}
                        </button>
                        <button onClick={() => setPreviewMode(previewMode === 'desktop' ? 'mobile' : 'desktop')} className="btn btn-sm btn-outline-secondary rounded-pill px-2 d-none d-md-block">
                            {previewMode === 'desktop' ? <Smartphone size={16} /> : <Monitor size={16} />}
                        </button>
                        <button onClick={togglePause} className="btn btn-sm btn-outline-dark rounded-pill px-3 d-flex align-items-center">
                            {isPaused ? <Play size={14} className="me-1" /> : <Pause size={14} className="me-1" />}
                            {isPaused ? "Resume" : "Pause"}
                        </button>
                        {status === 'completed' && (
                            <button onClick={downloadHTML} className="btn btn-sm btn-success rounded-pill px-3 fw-bold shadow-lg d-flex align-items-center">
                                <Download size={14} className="me-1" /> Download
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="d-flex overflow-hidden position-relative" style={{ height: isFullscreen ? '100%' : '75vh', minHeight: '500px' }}>
                {/* Logs Sidebar */}
                <AnimatePresence>
                    {showLogs && !isFullscreen && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: window.innerWidth < 768 ? '100%' : 340, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className={`bg-dark text-white font-monospace p-4 overflow-auto custom-scrollbar small border-end border-primary border-opacity-10 ${window.innerWidth < 768 ? 'position-absolute top-0 start-0 h-100 z-3' : 'h-100'}`}
                            style={{ background: '#020617' }}
                        >
                            <div className="d-flex align-items-center justify-content-between mb-4 text-primary opacity-90 border-bottom border-primary border-opacity-10 pb-3">
                                <div className="d-flex align-items-center gap-2">
                                    <Sparkles size={16} /> <span className="text-uppercase tracking-widest fw-bold">Synthesis Engine v2.0</span>
                                </div>
                                {window.innerWidth < 768 && (
                                    <button onClick={() => setShowLogs(false)} className="btn btn-link text-white p-0"><Minimize2 size={16} /></button>
                                )}
                            </div>
                            <div className="d-flex flex-column gap-3">
                                {logs.map((log, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="border-start border-primary border-opacity-30 ps-3 py-1"
                                    >
                                        <div className="text-secondary mb-1" style={{ fontSize: '0.75em', opacity: 0.6 }}>{log.time}</div>
                                        <div className={log.msg.includes('Error') ? 'text-danger' : log.msg.includes('✅') || log.msg.includes('✨') ? 'text-success' : 'text-light opacity-90'}>
                                            {log.msg}
                                        </div>
                                    </motion.div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                            {status === 'generating' && !isPaused && (
                                <div className="text-primary mt-4 d-flex align-items-center gap-3 ps-3">
                                    <Loader2 size={16} className="spin" /> <span className="fw-bold tracking-tight">Synthesizing...</span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Preview Window */}
                <div className={`flex-grow-1 ${isFullscreen ? 'p-0' : 'p-2 p-md-5'} bg-dark d-flex flex-column align-items-center justify-content-center overflow-hidden position-relative`} style={{ background: '#0f172a' }}>

                    {/* Fullscreen Toggle (Floating) */}
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="position-absolute top-0 end-0 m-3 btn btn-dark bg-black bg-opacity-50 text-white rounded-circle p-2 z-3 hover-scale border border-white border-opacity-10"
                        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                        {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                    </button>

                    <div className={`transition-all duration-500 d-flex align-items-center justify-content-center ${isFullscreen ? 'w-100 h-100' : ''}`} style={{ perspective: '2000px', width: '100%', height: '100%' }}>
                        <motion.div
                            className="shadow-2xl overflow-hidden rounded-3 border border-white border-opacity-5 position-relative"
                            layout
                            animate={{
                                width: isFullscreen ? '100%' : (previewMode === 'mobile' ? '375px' : 'calc((100vh - 280px) * 16 / 9)'),
                                aspectRatio: isFullscreen ? 'auto' : (previewMode === 'desktop' ? '16/9' : '9/16'),
                                height: isFullscreen ? '100%' : 'auto',
                                scale: (previewMode === 'mobile' && !isFullscreen) ? 0.8 : 1
                            }}
                            transition={{ type: "spring", stiffness: 200, damping: 25 }}
                            style={{
                                maxWidth: '100%',
                                maxHeight: isFullscreen ? '100%' : 'calc(100vh - 280px)',
                                background: '#020617',
                                boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.7)',
                                borderRadius: isFullscreen ? '0' : '0.5rem'
                            }}
                        >
                            {slides[currentSlideIndex]?.html ? (
                                <iframe
                                    srcDoc={`
                                        <!DOCTYPE html>
                                        <html>
                                            <head>
                                                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
                                                <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
                                                <script>mermaid.initialize({startOnLoad:true, theme: 'dark'});</script>
                                                <style>
                                                    * { box-sizing: border-box; }
                                                    body { 
                                                        margin: 0; 
                                                        padding: 0; 
                                                        width: 100vw; 
                                                        height: 100vh; 
                                                        overflow: hidden; 
                                                        font-family: 'Outfit', sans-serif; 
                                                        background: #020617;
                                                        color: #f8fafc;
                                                    }
                                                    ::-webkit-scrollbar { display: none; }
                                                </style>
                                            </head>
                                            <body>${slides[currentSlideIndex].html}</body>
                                        </html>
                                    `}
                                    className="w-100 h-100 border-0"
                                    title="Synthesis Preview"
                                    sandbox="allow-scripts allow-same-origin"
                                />
                            ) : (
                                <div className="h-100 w-100 d-flex flex-column align-items-center justify-content-center text-white p-5 bg-gradient-to-br from-slate-900 to-black">
                                    <Loader2 size={48} className="spin text-primary mb-4" style={{ opacity: 0.8 }} />
                                    <h5 className="fw-bold tracking-tight mb-2">Synthesizing Slide {currentSlideIndex + 1}</h5>
                                    <p className="text-secondary small opacity-75">{slides[currentSlideIndex]?.title || 'Awaiting Plan...'}</p>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Navigation Controls & Chat Bar */}
                    <div className="position-absolute bottom-0 w-100 d-flex flex-column align-items-center justify-content-end p-3 p-md-4 gap-3 pointer-events-none" style={{ background: 'linear-gradient(to top, #0f172a 0%, transparent 100%)' }}>

                        {/* Chat Bar for Editing - Hidden in Fullscreen */}
                        {!isFullscreen && (
                            <div className="w-100 pointer-events-auto" style={{ maxWidth: '600px' }}>
                                <div className="glass-panel p-1 rounded-pill d-flex align-items-center gap-2 border border-white border-opacity-10 shadow-lg" style={{ background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)' }}>
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleRefineSlide()}
                                        placeholder={isRefining ? "AI is updating slide..." : "Ask AI to change this slide (e.g. 'Make it blue')..."}
                                        disabled={isRefining || !slides[currentSlideIndex]?.html}
                                        className="form-control bg-transparent border-0 text-white shadow-none px-3 py-2 small"
                                        style={{ outline: 'none' }}
                                    />
                                    <button
                                        onClick={handleRefineSlide}
                                        disabled={!chatInput.trim() || isRefining}
                                        className="btn btn-primary rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0"
                                        style={{ width: 36, height: 36 }}
                                    >
                                        {isRefining ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Slide Nav */}
                        <div className="d-flex justify-content-center gap-3 pointer-events-auto">
                            <button
                                disabled={currentSlideIndex === 0}
                                onClick={() => setCurrentSlideIndex(currentSlideIndex - 1)}
                                className="btn btn-outline-light rounded-pill px-4 btn-sm border-opacity-25 bg-black bg-opacity-20 backdrop-blur"
                            >Prev</button>
                            <div className="px-4 py-2 bg-white bg-opacity-5 rounded-pill text-black small border border-white border-opacity-10 d-flex align-items-center fw-bold backdrop-blur">
                                {currentSlideIndex + 1} / {slides.length}
                            </div>
                            <button
                                disabled={currentSlideIndex >= slides.length - 1}
                                onClick={() => setCurrentSlideIndex(currentSlideIndex + 1)}
                                className="btn btn-outline-light rounded-pill px-4 btn-sm border-opacity-25 bg-black bg-opacity-20 backdrop-blur"
                            >Next</button>
                        </div>
                    </div>
                </div>
            </div>


        </div>
    );
};

export default AgenticPPTGenerator;
