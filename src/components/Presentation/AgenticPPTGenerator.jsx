import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Pause, Sidebar, CheckCircle, Loader2, Maximize2, Minimize2, Download, Smartphone, Monitor, AlertCircle, RefreshCw, Sparkles, Layout, History, Clock, Menu, X, ChevronUp, ChevronDown, MessageSquare, Search } from 'lucide-react';
import { savePPT, getAllPPTs, deletePPT } from '../../utils/pptDB';
import { getAICompletion } from '../../utils/aiService';
import AILoader from '../AILoader';

const AgenticPPTGenerator = ({ topic, details, slideCount = 5, onBack, customInstructions = '', theme = 'modern', descriptionLength = 'short', includeDiagrams = true }) => {
    const [status, setStatus] = useState('planning'); // planning, generating, completed, error
    const [plan, setPlan] = useState([]);
    const [slides, setSlides] = useState([]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);
    const [showLogs, setShowLogs] = useState(true); // Default to showing on desktop
    const [executionTime, setExecutionTime] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(false); // Toggle between code/preview? No, simplified.
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [previewMode, setPreviewMode] = useState('desktop'); // desktop, mobile
    const [chatInput, setChatInput] = useState('');
    const [isRefining, setIsRefining] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth < 768);
    const [isTabletScreen, setIsTabletScreen] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);
    const [isLogsExpanded, setIsLogsExpanded] = useState(false);

    // Co-Pilot & History Search State
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
    const [historySearchTerm, setHistorySearchTerm] = useState('');

    // Fullscreen Controls State
    const [isControlsVisible, setIsControlsVisible] = useState(true);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const controlsTimeoutRef = useRef(null);

    const logsEndRef = useRef(null);
    const isPausedRef = useRef(false); // Ref for immediate access in async loops
    const abortControllerRef = useRef(null);
    const iframeRef = useRef(null);

    // Effect to update iframe content when slide changes
    useEffect(() => {
        if (iframeRef.current && slides[currentSlideIndex]?.html) {
            // Ensure iframe content window is available
            if (iframeRef.current.contentWindow) {
                // Post message to iframe to update content without reload
                iframeRef.current.contentWindow.postMessage({
                    html: slides[currentSlideIndex].html
                }, '*');
            }
        }
    }, [currentSlideIndex, slides]);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs, showLogs]);

    // Mobile Check
    useEffect(() => {
        const checkMobile = () => {
            const width = window.innerWidth;
            setIsMobileScreen(width < 768);
            setIsTabletScreen(width >= 768 && width < 1024);
            if (width < 768) {
                setShowLogs(false);
                setPreviewMode('mobile');
            } else if (width >= 768 && width < 1024) {
                setPreviewMode('tablet');
            }
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Auto-hide controls in fullscreen
    const resetControlsTimeout = () => {
        setIsControlsVisible(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        if (isFullscreen) {
            controlsTimeoutRef.current = setTimeout(() => {
                setIsControlsVisible(false);
            }, 3000);
        }
    };

    useEffect(() => {
        resetControlsTimeout();
        return () => clearTimeout(controlsTimeoutRef.current);
    }, [isFullscreen]);

    // Swipe handlers
    const minSwipeDistance = 50;
    const onTouchStartHandler = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
        resetControlsTimeout();
    };
    const onTouchMoveHandler = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
        resetControlsTimeout();
    };
    const onTouchEndHandler = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe && currentSlideIndex < slides.length - 1) {
            setCurrentSlideIndex(prev => prev + 1);
        }
        if (isRightSwipe && currentSlideIndex > 0) {
            setCurrentSlideIndex(prev => prev - 1);
        }
        resetControlsTimeout();
    };

    // Status Indicator Component
    const StatusBadge = () => {
        const statusConfig = {
            completed: { dot: 'bg-emerald-500', text: 'Complete', pulse: false },
            error: { dot: 'bg-red-500', text: 'Error', pulse: true },
            generating: { dot: 'bg-blue-500', text: 'Working', pulse: true }
        };
        const config = statusConfig[status] || statusConfig.generating;

        return (
            <div className="flex items-center gap-1.5" aria-label={`Status: ${config.text}`}>
                <div className={`w-2 h-2 rounded-full ${config.dot} ${config.pulse ? 'animate-pulse' : ''}`} />
                <span className="hidden md:inline text-xs font-medium !text-slate-500 tracking-wide">
                    {config.text}
                </span>
            </div>
        );
    };

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
            console.error("JSON Parse Error:", e, "\\nOriginal Text:", text);
            throw new Error("Failed to parse AI response.");
        }
    };

    const fetchWithRetry = async (url, options, retries = 5, backoff = 2000) => {
        try {
            const response = await fetch(url, options);
            if (!response.ok && (response.status === 429 || response.status >= 500)) {
                throw new Error(`Server status: ${response.status}`);
            }
            return response;
        } catch (err) {
            if (retries > 0) {
                const waitTime = backoff + Math.random() * 500; // Add jitter
                addLog(`⚠️ Network hiccup. Retrying in ${(waitTime / 1000).toFixed(1)}s...`);
                await new Promise(r => setTimeout(r, waitTime));
                return fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            throw err;
        }
    };


    const generatePlan = async () => {
        addLog(`🎨 Creative Brief: Designing a premium ${slideCount}-slide experience for "${topic}"`);
        setStatus('planning');

        try {
            const systemPrompt = `You are a world-class presentation director and visual storyteller. 
                Create a detailed visual and content plan for a ${slideCount}-slide presentation on "${topic}".
                
                CONTEXT: ${customInstructions ? `User Instructions: "${customInstructions}"` : 'No specific user instructions.'}
                LENGTH: ${descriptionLength === 'short' ? 'Keep content concise and punchy.' : 'Provide detailed, comprehensive content.'}
                DIAGRAMS: ${includeDiagrams ? 'Aggressively suggest diagrams/visuals for complex concepts.' : 'Do NOT suggest complex diagrams, focus on text/images.'}

                Your goal is to make a "Wow" presentation that is readable, aesthetic, and professionally structured.
                For each slide, define:
                1. 'title': Engaging and bold.
                2. 'type': 'hero' | 'grid' | 'split' | 'quote' | 'data' | 'conclusion'.
                3. 'briefIdea': A single sentence concise concept description.

                RETURN A JSON OBJECT (not an array) with a "slides" key containing the array:
                {
                  "slides": [
                    { "title": "...", "type": "...", "briefIdea": "..." },
                    ...
                  ]
                }`;

            const userPrompt = `Topic: ${topic}. Context: ${details}`;

            const planContent = await getAICompletion(
                [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                {
                    jsonMode: true,
                    onFallback: (err) => addLog(`⚠️ Primary AI busy (${err}). Switching to Llama-3 Backup...`)
                }
            );

            let planLines = planContent;
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
                prompt: item.briefIdea || item.detailedPrompt || item.prompt || `Slide about ${item.title}`,
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

        // CRITICAL: Enforce sequential generation. 
        // If ANY slide is currently generating, do not start another one.
        if (slides.some(s => s.status === 'generating')) return;

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
                // Save to History
                savePPT({
                    topic,
                    slides,
                    theme,
                    timestamp: new Date().toISOString()
                }).then(() => addLog("💾 Presentation saved to history."));
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
1. **Mermaid Diagrams**: ${includeDiagrams ? 'If a process/workflow is needed, use a Mermaid.js diagram. Embed inside: <div class="mermaid"> ...graph definition... </div>. \\n   - PREFERRED TYPES: graph TD, sequenceDiagram, mindmap.\\n   - CRITICAL: Use alphanumeric Node IDs (e.g. A[Label], Node1). Avoid special chars in IDs. Escape labels with quotes.' : 'DO NOT use Mermaid diagrams. Use CSS shapes, icons, or text layouts instead.'}
2. **Vector Graphics**: Use ONLY simple inline SVGs. Ensure all <path> d attributes are complete and valid. Avoid overly complex paths.
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
Context: ${details || 'No specific context provided.'}
Constraint: ${descriptionLength === 'short' ? 'Keep text concise (bullet points, short sentences).' : 'Explain in detail with fuller sentences.'}
IMPORTANT: Content MUST be perfectly contained within the 16:9 frame. Use 'vh' units for all font-sizes and spacing.`;

        if (userInstruction && currentHTML) {
            systemPrompt += `\\n\\nTASK: The user wants to Modify the existing slide. Retain the core structure but apply the change.`;
            userPrompt += `\n\nCURRENT HTML: ${currentHTML}\n\nUSER MODIFICATION REQUEST: ${userInstruction}`;
        }

        const htmlContent = await getAICompletion(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            {
                jsonMode: false,
                onFallback: (err) => addLog(`⚠️ Primary AI busy (${err}). Switching to Llama-3 Backup...`)
            }
        );

        let html = htmlContent;
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

    const loadHistory = async () => {
        try {
            const list = await getAllPPTs();
            setHistoryList(list);
            setShowHistory(true);
        } catch (err) {
            console.error("Failed to load history", err);
        }
    };

    const restorePPT = (ppt) => {
        setSlides(ppt.slides);
        setStatus('completed');
        setCurrentSlideIndex(0);
        setShowHistory(false);
        addLog(`📂 Loaded presentation: "${ppt.topic}"`);
    };

    const handleDeletePPT = async (id, e) => {
        e.stopPropagation();
        try {
            await deletePPT(id);
            setHistoryList(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            console.error("Failed to delete", err);
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
        a.download = `${topic.replace(/\\s+/g, '_')}_Presentation.html`;
        a.click();
    };

    return (
        <div
            className={`!flex !flex-col !w-full !h-screen !bg-slate-50 !text-slate-900 !overflow-hidden relative !font-sans AgenticPPTGenerator ${isFullscreen ? '!fixed !inset-0 !z-[1080]' : '!shadow-xl !border !border-slate-200'}`}
            style={{
                zIndex: isFullscreen ? 1080 : 'auto',
                '--bg-primary': '#f8fafc',
                '--bg-secondary': '#ffffff',
                '--bg-dark': '#0f172a',
                '--text-primary': '#1e293b',
                '--text-secondary': '#64748b',
                '--text-light': '#f8fafc',
                '--accent-blue': '#3b82f6',
                '--accent-emerald': '#10b981',
                '--border-color': '#e2e8f0',
                '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                '--radius-sm': '0.375rem',
                '--radius-md': '0.5rem',
                '--radius-lg': '0.75rem',
                '--radius-xl': '1rem',
                '--radius-2xl': '1.5rem'
            }}
            onMouseMove={resetControlsTimeout}
            onTouchStart={onTouchStartHandler}
            onTouchMove={onTouchMoveHandler}
            onTouchEnd={onTouchEndHandler}
        >
            <style>{`
                .AgenticPPTGenerator .hide-scrollbar {
                  -ms-overflow-style: none;
                  scrollbar-width: none;
                }
                .AgenticPPTGenerator .hide-scrollbar::-webkit-scrollbar {
                  display: none;
                }
                .AgenticPPTGenerator .custom-scrollbar {
                  scrollbar-width: thin;
                  scrollbar-color: #475569 #1e293b;
                }
                .AgenticPPTGenerator .custom-scrollbar::-webkit-scrollbar {
                  width: 6px;
                  height: 6px;
                }
                .AgenticPPTGenerator .custom-scrollbar::-webkit-scrollbar-track {
                  background: #1e293b;
                  border-radius: 3px;
                }
                .AgenticPPTGenerator .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: #475569;
                  border-radius: 3px;
                }
                .AgenticPPTGenerator .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background: #64748b;
                }
            `}</style>

            {/* Header */}
            {!isFullscreen && (
                <header className="!sticky !top-0 !z-40 !h-16 !bg-white/80 !backdrop-blur-lg !border-b !border-slate-200 !px-4 md:!px-6 !flex !items-center !justify-between !gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} aria-label="Go Back" className="!w-10 !h-10 !flex !items-center !justify-center !rounded-full !bg-slate-100 hover:!bg-slate-200 !transition-colors !text-slate-600 focus:!outline-none focus:!ring-2 focus:!ring-slate-400">
                            <ArrowLeft size={18} aria-hidden="true" />
                        </button>
                        <div>
                            <h6 className="mb-0 font-bold !text-slate-900 truncate max-w-[150px] md:max-w-xs">{topic}</h6>
                            <StatusBadge />
                        </div>
                    </div>

                    {/* Desktop Actions */}
                    <div className="hidden md:flex gap-2 items-center">
                        <button onClick={loadHistory} className="!bg-slate-100 hover:!bg-slate-200 !text-slate-700 !px-3 !py-1.5 !rounded-lg !text-sm !font-semibold !flex !items-center !transition-colors focus:!outline-none">
                            <History size={16} className="mr-2" aria-hidden="true" /> History
                        </button>
                        <button onClick={() => setShowLogs(!showLogs)} className={`${showLogs ? '!bg-blue-600 hover:!bg-blue-700 !text-white' : '!bg-slate-100 !text-slate-700 hover:!bg-slate-200'} !px-3 !py-1.5 !rounded-lg !text-sm !font-semibold !flex !items-center !transition-colors focus:!outline-none`}>
                            <Sidebar size={16} className="mr-2" aria-hidden="true" /> Logs
                        </button>
                        <button onClick={() => setPreviewMode(previewMode === 'desktop' ? 'mobile' : 'desktop')} aria-label={previewMode === 'desktop' ? "Switch to Mobile Preview" : "Switch to Desktop Preview"} className="!bg-slate-100 hover:!bg-slate-200 !text-slate-700 !px-3 !py-1.5 !rounded-lg !transition-colors focus:!outline-none">
                            {previewMode === 'desktop' ? <Smartphone size={18} aria-hidden="true" /> : <Monitor size={18} aria-hidden="true" />}
                        </button>
                        <button onClick={togglePause} className="!bg-slate-800 hover:!bg-slate-900 !text-white !px-3 !py-1.5 !rounded-lg !text-sm !font-semibold !flex !items-center !transition-colors focus:!outline-none">
                            {isPaused ? <Play size={16} className="mr-2" aria-hidden="true" /> : <Pause size={16} className="mr-2" aria-hidden="true" />}
                            {isPaused ? "Resume" : "Pause"}
                        </button>
                        {status === 'completed' && (
                            <button onClick={downloadHTML} className="!bg-emerald-600 hover:!bg-emerald-700 !text-white !px-4 !py-2 !rounded-xl !text-sm !font-bold !flex !items-center !gap-2 !shadow-sm transition-colors focus:outline-none">
                                <Download size={16} aria-hidden="true" /> Download
                            </button>
                        )}
                        {status === 'error' && (
                            <button onClick={handleRetry} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-50">
                                <RefreshCw size={16} className="mr-2" aria-hidden="true" /> Retry
                            </button>
                        )}
                    </div>

                    {/* Mobile Hamburger */}
                    <div className="md:hidden">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Open Actions Menu" className="!p-2 !text-slate-600 !rounded-xl !bg-slate-100 hover:!bg-slate-200 !transition-colors focus:!outline-none">
                            <Menu size={20} aria-hidden="true" />
                        </button>
                    </div>
                </header>
            )}

            {/* Mobile Actions Drawer */}
            <AnimatePresence>
                {!isFullscreen && isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="!fixed !inset-0 !bg-black/50 !z-[60]"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="!fixed !top-0 !right-0 !h-full !w-72 !bg-white !z-[70] !shadow-2xl !flex !flex-col !p-6"
                            style={{ maxWidth: '80vw' }}
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="!font-bold !text-xl !text-slate-900">Actions</h3>
                                <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Close Actions Menu" className="!p-2 !text-slate-500 hover:!bg-slate-100 !rounded-full !transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex flex-col gap-6 overflow-y-auto">
                                <div className="flex flex-col gap-3">
                                    <p className="!text-xs !text-slate-500 !uppercase !font-bold !tracking-wider">Presentation</p>
                                    <button onClick={() => { loadHistory(); setIsMobileMenuOpen(false); }} className="!flex !items-center !gap-3 !p-3 !rounded-xl !bg-slate-100 hover:!bg-slate-200 !text-slate-700 !font-semibold !transition-all">
                                        <History size={18} /> History
                                    </button>
                                    <button onClick={() => { setShowLogs(true); setIsMobileMenuOpen(false); }} className="!flex !items-center !gap-3 !p-3 !rounded-xl !bg-slate-100 hover:!bg-slate-200 !text-slate-700 !font-semibold !transition-all">
                                        <Sidebar size={18} /> Logs
                                    </button>
                                    {status === 'completed' && (
                                        <button onClick={() => { downloadHTML(); setIsMobileMenuOpen(false); }} className="!flex !items-center !gap-3 !p-3 !rounded-xl !bg-emerald-600 hover:!bg-emerald-700 !text-white !font-bold !transition-all !shadow-sm">
                                            <Download size={18} /> Download
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-col gap-3 border-t !border-slate-100 !pt-6">
                                    <p className="!text-xs !text-slate-500 !uppercase !font-bold !tracking-wider">Controls</p>
                                    <button onClick={() => { togglePause(); setIsMobileMenuOpen(false); }} className="!flex !items-center !gap-3 !p-3 !rounded-xl !bg-slate-900 hover:!bg-slate-800 !text-white !font-semibold !transition-all">
                                        {isPaused ? <Play size={18} /> : <Pause size={18} />}
                                        {isPaused ? "Resume Engine" : "Pause Engine"}
                                    </button>
                                    {status === 'error' && (
                                        <button onClick={() => { handleRetry(); setIsMobileMenuOpen(false); }} className="!flex !items-center !gap-3 !p-3 !rounded-xl !bg-red-600 hover:!bg-red-700 !text-white !font-bold !transition-all">
                                            <RefreshCw size={18} /> Retry
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div className={`flex flex-1 overflow-hidden relative ${isFullscreen ? '' : 'h-[75vh] min-h-[500px] md:h-auto'}`}>
                {/* Desktop Logs Sidebar */}
                <AnimatePresence>
                    {showLogs && !isFullscreen && !isMobileScreen && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 320, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="!h-full !w-80 !bg-slate-900 !text-white !p-4 !overflow-y-auto !border-r !border-slate-800 !flex !flex-col !shrink-0 custom-scrollbar"
                        >
                            <div className="flex items-center justify-between mb-4 text-blue-400 opacity-90 border-b border-slate-800 pb-3 shrink-0">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={16} /> <span className="uppercase tracking-widest font-bold text-xs">Synthesis Engine v2.0</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
                                {logs.map((log, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors border-l-2 border-transparent hover:border-blue-500/30"
                                    >
                                        <span className="text-[10px] text-slate-500 font-mono shrink-0 uppercase tracking-wider pt-1">{log.time}</span>
                                        <div className="flex-1 flex flex-col items-start overflow-hidden">
                                            {log.msg.includes('Error') && <span className="bg-red-500/20 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded mb-1 tracking-widest">ERROR</span>}
                                            {(log.msg.includes('✅') || log.msg.includes('✨')) && <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded mb-1 tracking-widest">DONE</span>}
                                            {!(log.msg.includes('Error') || log.msg.includes('✅') || log.msg.includes('✨')) && <span className="bg-blue-500/20 text-blue-400 text-[9px] font-bold px-1.5 py-0.5 rounded mb-1 tracking-widest">INFO</span>}
                                            <div className="w-full overflow-x-auto custom-scrollbar pb-1">
                                                <span className={`text-sm whitespace-nowrap ${log.msg.includes('Error') ? 'text-red-400' : log.msg.includes('✅') || log.msg.includes('✨') ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                    {log.msg}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                            {status === 'generating' && !isPaused && (
                                <div className="text-blue-400 mt-4 flex items-center gap-3 pl-3 shrink-0">
                                    <Loader2 size={16} className="animate-spin" /> <span className="font-bold tracking-tight text-sm">Synthesizing...</span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mobile Logs Bottom Sheet */}
                <AnimatePresence>
                    {showLogs && !isFullscreen && isMobileScreen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-slate-900/40 z-40"
                                onClick={() => setShowLogs(false)}
                            />
                            <motion.div
                                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                drag="y"
                                dragConstraints={{ top: 0, bottom: 0 }}
                                onDragEnd={(e, info) => {
                                    if (info.offset.y > 50) {
                                        if (isLogsExpanded) setIsLogsExpanded(false);
                                        else setShowLogs(false);
                                    } else if (info.offset.y < -50) {
                                        setIsLogsExpanded(true);
                                    }
                                }}
                                className={`!fixed !bottom-0 !left-0 !right-0 !h-[50vh] !bg-slate-900 !text-white !rounded-t-3xl !z-50 !flex !flex-col !shadow-2xl transition-all duration-300 ${isLogsExpanded ? '!h-[80vh]' : ''}`}
                                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                            >
                                <div className="!w-12 !h-1.5 !bg-slate-500 !rounded-full !mx-auto !mb-4 !shrink-0 cursor-pointer hover:!bg-slate-400 !transition-colors" onClick={() => setIsLogsExpanded(!isLogsExpanded)} aria-label="Toggle Expand Logs" />
                                <div className="flex items-center justify-between mb-4 text-blue-400 opacity-90 border-b border-slate-800 pb-3 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={16} /> <span className="uppercase tracking-widest font-bold text-xs">Engine Logs</span>
                                    </div>
                                    <button onClick={() => setShowLogs(false)} aria-label="Close Logs" className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center">
                                        <X size={16} aria-hidden="true" />
                                    </button>
                                </div>
                                <div className="flex flex-col gap-2 flex-1 overflow-y-auto custom-scrollbar">
                                    {(isLogsExpanded ? logs : logs.slice(0, 10)).map((log, i) => (
                                        <motion.div key={i} className="flex gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                                            <span className="text-[10px] text-slate-500 font-mono shrink-0 uppercase tracking-wider pt-0.5">{log.time}</span>
                                            <div className="flex-1 flex flex-col items-start overflow-hidden">
                                                {log.msg.includes('Error') && <span className="bg-red-500/20 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded mb-1 tracking-widest">ERROR</span>}
                                                {(log.msg.includes('✅') || log.msg.includes('✨')) && <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded mb-1 tracking-widest">DONE</span>}
                                                {!(log.msg.includes('Error') || log.msg.includes('✅') || log.msg.includes('✨')) && <span className="bg-blue-500/20 text-blue-400 text-[9px] font-bold px-1.5 py-0.5 rounded mb-1 tracking-widest">INFO</span>}
                                                <div className="w-full overflow-x-auto custom-scrollbar pb-1">
                                                    <span className={`text-sm whitespace-nowrap ${log.msg.includes('Error') ? 'text-red-400' : log.msg.includes('✅') || log.msg.includes('✨') ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                        {log.msg}
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                                {status === 'generating' && !isPaused && (
                                    <div className="text-blue-400 mt-3 flex items-center gap-3 pl-3 shrink-0">
                                        <Loader2 size={14} className="animate-spin" /> <span className="font-bold text-xs">Synthesizing...</span>
                                    </div>
                                )}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* Preview Window */}
                <div className={`flex-1 ${isFullscreen ? 'p-0' : 'p-0 md:p-6'} bg-slate-900 flex flex-col items-center justify-center overflow-hidden relative`}>

                    {/* Fullscreen Toggle (Floating) */}
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                        className={`absolute top-4 right-4 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full p-2.5 z-10 backdrop-blur-sm transition-all duration-500 active:scale-95 border border-white/10 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${(!isControlsVisible && isFullscreen) ? 'opacity-0 pointer-events-none translate-y-[-10px]' : 'opacity-100'}`}
                        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                        {isFullscreen ? <Minimize2 size={20} aria-hidden="true" /> : <Maximize2 size={20} aria-hidden="true" />}
                    </button>

                    <div className={`w-full h-full flex items-center justify-center ${isFullscreen ? '' : isMobileScreen ? 'pb-20' : 'pb-24'}`} style={{ perspective: '2000px' }}>
                        <motion.div
                            className={`!relative !overflow-hidden !bg-slate-900 !shadow-2xl ${isFullscreen ? '!rounded-none' : '!rounded-xl md:!rounded-2xl !border !border-white/10'}`}
                            layout
                            animate={{ opacity: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 25 }}
                            style={{
                                width: isFullscreen ? '100vw' : (isMobileScreen ? '100%' : (previewMode === 'mobile' ? '375px' : 'calc(100vh * 16 / 9)')),
                                height: isFullscreen ? '100vh' : (isMobileScreen ? '100%' : (previewMode === 'mobile' ? '812px' : 'calc(100vh - 240px)')),
                                maxWidth: '100%',
                                aspectRatio: isFullscreen ? 'auto' : '16/9', // Force aspect ratio
                                background: '#020617',
                            }}
                        >
                            {slides[currentSlideIndex]?.html ? (
                                <iframe
                                    ref={iframeRef}
                                    srcDoc={`
                                <!DOCTYPE html>
                                <html>
                                    <head>
                                        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
                                        <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
                                        <script>mermaid.initialize({startOnLoad:false, theme: 'dark'});</script>
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
                                                transition: opacity 0.3s ease;
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                            }
                                            ::-webkit-scrollbar { display: none; }
                                            #app { width: 100%; height: 100%; opacity: 0; transition: opacity 0.4s ease-out; }
                                            .slide-content { width: 100%; height: 100%; animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
                                            @keyframes slideIn { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
                                        </style>
                                    </head>
                                    <body>
                                        <div id="app"></div>
                                        <script>
                                            window.addEventListener('message', (event) => {
                                                const { html } = event.data;
                                                const app = document.getElementById('app');
                                                
                                                // Fade out slightly
                                                app.style.opacity = '0';
                                                
                                                setTimeout(() => {
                                                    app.innerHTML = '<div class="slide-content">' + html + '</div>';
                                                    
                                                    // Re-init mermaid
                                                    try {
                                                        mermaid.run({ 
                                                            nodes: document.querySelectorAll('.mermaid'),
                                                            suppressErrors: true 
                                                        });
                                                    } catch(e) { console.error('Mermaid Error:', e); }
                                                    
                                                    // Fade in
                                                    // Use requestAnimationFrame to ensure DOM update is registered before opacity transition
                                                    requestAnimationFrame(() => {
                                                        app.style.opacity = '1';
                                                    });
                                                }, 250); // Small delay to allow fade out
                                            });
                                        </script>
                                    </body>
                                </html>
                            `}
                                    className="w-100 h-100 border-0"
                                    title="Synthesis Preview"
                                    sandbox="allow-scripts"
                                />
                            ) : (
                                <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                    <AILoader
                                        title={`Synthesizing Slide ${currentSlideIndex + 1}`}
                                        subtitle={slides[currentSlideIndex]?.title || 'Awaiting Plan...'}
                                    />
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Navigation Controls & Chat Bar */}
                    <div
                        className={`!fixed !bottom-4 !left-0 !right-0 !z-30 !flex !flex-col !items-center !gap-4 !px-4 !pb-safe pointer-events-none transition-all duration-500 ${(!isControlsVisible && isFullscreen) ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
                        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                    >
                        {/* Chat Bar for Editing (Desktop/Tablet) */}
                        {!isFullscreen && !isMobileScreen && (
                            <div className="w-full pointer-events-auto max-w-lg transition-all duration-300">
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2 justify-center pb-1">
                                        {['Make it more professional', 'Add a diagram', 'Shorter text'].map((suggestion, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setChatInput(suggestion)}
                                                className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-800/80 backdrop-blur-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 flex items-center shadow-2xl focus-within:ring-2 focus-within:ring-blue-500/50">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleRefineSlide()}
                                            placeholder={isRefining ? "AI is updating slide..." : "Ask AI to change this slide..."}
                                            disabled={isRefining || !slides[currentSlideIndex]?.html}
                                            aria-label="Refine slide with AI"
                                            className="flex-1 !bg-transparent !border-0 !text-white placeholder:!text-slate-400 focus:!ring-0 !px-3 !py-1.5 !text-sm focus:!outline-none !w-full !appearance-none"
                                        />
                                        <button
                                            onClick={handleRefineSlide}
                                            disabled={!chatInput.trim() || isRefining}
                                            aria-label="Send refinement request"
                                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-xl w-9 h-9 flex items-center justify-center shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-sm"
                                        >
                                            {isRefining ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <MessageSquare size={16} aria-hidden="true" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Slide Thumbnails Strip (Desktop/Tablet) */}
                        {slides.length > 1 && !isMobileScreen && (
                            <div className="flex items-center justify-center gap-2 mb-2 pointer-events-auto bg-slate-900/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
                                {slides.map((s, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentSlideIndex(idx)}
                                        aria-label={`Go to slide ${idx + 1}`}
                                        className={`h-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${currentSlideIndex === idx ? 'w-6 bg-blue-500' : 'w-2 bg-slate-500 hover:bg-slate-400'}`}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Slide Nav (Floating Pill) */}
                        <div className="!flex !items-center !gap-2 !bg-slate-900/80 !backdrop-blur-xl !rounded-full !p-1.5 !border !border-white/10 !shadow-2xl pointer-events-auto">
                            <button
                                disabled={currentSlideIndex === 0}
                                onClick={() => setCurrentSlideIndex(currentSlideIndex - 1)}
                                className="w-11 h-11 flex items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-white rounded-full transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                                aria-label="Previous Slide"
                            >
                                <ArrowLeft size={18} aria-hidden="true" />
                            </button>
                            <div className="px-5 font-bold text-white text-sm tracking-wider" aria-live="polite">
                                {slides.length > 0 ? `${currentSlideIndex + 1} / ${slides.length}` : '0 / 0'}
                            </div>
                            <button
                                disabled={currentSlideIndex >= slides.length - 1}
                                onClick={() => setCurrentSlideIndex(currentSlideIndex + 1)}
                                className="w-11 h-11 flex items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-white rounded-full transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                                aria-label="Next Slide"
                            >
                                <ArrowLeft size={18} className="rotate-180" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Co-Pilot FAB */}
            {!isFullscreen && isMobileScreen && (
                <motion.div
                    className="fixed right-4 z-40"
                    style={{
                        bottom: 'calc(90px + env(safe-area-inset-bottom))',
                        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    <button
                        onClick={() => setIsMobileChatOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-2xl shadow-[0_8px_30px_rgba(37,99,235,0.4)] flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        aria-label="Open Co-Pilot Chat"
                    >
                        <MessageSquare size={24} aria-hidden="true" className="group-hover:scale-110 transition-transform" />
                        {isRefining && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>}
                    </button>
                </motion.div>
            )}

            {/* Mobile Co-Pilot Bottom Sheet */}
            <AnimatePresence>
                {isMobileChatOpen && isMobileScreen && !isFullscreen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/60 z-[1050] backdrop-blur-sm"
                            onClick={() => setIsMobileChatOpen(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl shadow-2xl z-[1060] flex flex-col overflow-hidden border-t border-white/10 pb-10 safe-pb"
                        >
                            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 backdrop-blur-md">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <Sparkles size={18} className="text-blue-400" /> AI Co-Pilot
                                </h3>
                                <button onClick={() => setIsMobileChatOpen(false)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-slate-800 text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 touch-manipulation">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-4 flex flex-col gap-4 bg-slate-900">
                                <p className="text-sm text-slate-400">Ask the AI to refine this slide (Slide {currentSlideIndex + 1}):</p>

                                <div className="flex flex-wrap gap-2 mb-2">
                                    {['Summarize text', 'Make it beautiful', 'Add formal tone'].map((suggestion, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setChatInput(suggestion)}
                                            className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-700 active:text-white transition-colors"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>

                                <div className="p-1.5 rounded-2xl flex items-center gap-2 border border-slate-700 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 bg-slate-800 shadow-inner">
                                    <input
                                        type="text"
                                        inputMode="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && chatInput.trim() && !isRefining) {
                                                handleRefineSlide();
                                                setIsMobileChatOpen(false);
                                            }
                                        }}
                                        placeholder="E.g. 'Make it professional'"
                                        disabled={isRefining || !slides[currentSlideIndex]?.html}
                                        className="flex-1 !bg-transparent !border-0 !text-white placeholder:!text-slate-500 focus:!ring-0 !px-3 !py-2 !text-base focus:!outline-none !w-full !appearance-none"
                                    />
                                    <button
                                        onClick={() => {
                                            handleRefineSlide();
                                            setIsMobileChatOpen(false);
                                        }}
                                        disabled={!chatInput.trim() || isRefining}
                                        className="bg-blue-600 disabled:bg-slate-700 text-white rounded-xl p-3 flex shrink-0 items-center justify-center transition-colors shadow-sm focus:outline-none"
                                    >
                                        {isRefining ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* History Modal */}
            <AnimatePresence>
                {showHistory && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="!fixed !inset-0 !z-[1100] !flex !items-center !justify-center !p-4 !bg-black/60 !backdrop-blur-sm"
                        onClick={() => setShowHistory(false)}
                    >
                        <motion.div
                            initial={isMobileScreen ? { y: '100%' } : { scale: 0.95, y: 20, opacity: 0 }}
                            animate={isMobileScreen ? { y: 0 } : { scale: 1, y: 0, opacity: 1 }}
                            exit={isMobileScreen ? { y: '100%' } : { scale: 0.95, y: 20, opacity: 0 }}
                            transition={isMobileScreen ? { type: "spring", stiffness: 300, damping: 25 } : {}}
                            className="!bg-white !w-full !max-w-lg !max-h-[85vh] !rounded-2xl !shadow-2xl !flex !flex-col !overflow-hidden md:!h-auto !h-full relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                                <h3 className="!font-bold !text-slate-900 flex items-center gap-2">
                                    <History size={20} className="text-blue-600" /> Presentation History
                                </h3>
                                <button onClick={() => setShowHistory(false)} aria-label="Close History" className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 touch-manipulation">
                                    <X size={20} aria-hidden="true" />
                                </button>
                            </div>

                            <div className="p-4 pt-0 md:px-6 md:pb-4 md:pt-2 bg-slate-50 border-b border-slate-100 shrink-0">
                                <div className="relative flex items-center">
                                    <Search className="absolute left-3 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search history..."
                                        value={historySearchTerm}
                                        onChange={(e) => setHistorySearchTerm(e.target.value)}
                                        className="w-full !bg-white !border !border-slate-200 !text-slate-900 !text-sm !rounded-xl focus:!border-blue-500 block pl-10 p-3 outline-none focus:!ring-2 focus:!ring-blue-500/20 transition-all shadow-sm"
                                    />
                                    {historySearchTerm && (
                                        <button onClick={() => setHistorySearchTerm('')} className="absolute right-3 text-slate-400 hover:text-slate-600">
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-50/50 pb-8 safe-pb md:pb-6">
                                {historyList.filter(ppt => ppt.topic.toLowerCase().includes(historySearchTerm.toLowerCase())).length === 0 ? (
                                    <div className="text-center text-slate-400 py-12 flex flex-col items-center" aria-live="polite">
                                        {historyList.length === 0 ? (
                                            <>
                                                <History size={48} className="mb-4 opacity-20" aria-hidden="true" />
                                                <p className="font-medium">No saved presentations yet.</p>
                                            </>
                                        ) : (
                                            <>
                                                <Search size={48} className="mb-4 opacity-20" aria-hidden="true" />
                                                <p className="font-medium">No matches found for "{historySearchTerm}"</p>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3" role="list">
                                        {historyList.filter(ppt => ppt.topic.toLowerCase().includes(historySearchTerm.toLowerCase())).map(ppt => (
                                            <div
                                                key={ppt.id}
                                                role="listitem"
                                                className="group bg-white p-4 border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all flex justify-between items-center focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
                                            >
                                                <button
                                                    className="flex-1 min-w-0 pr-4 text-left focus:outline-none"
                                                    onClick={() => restorePPT(ppt)}
                                                    aria-label={`Restore presentation: ${ppt.topic}`}
                                                >
                                                    <div className="!font-bold !text-slate-900 truncate">{ppt.topic}</div>
                                                    <div className="!text-sm !text-slate-500 mt-1 flex items-center gap-2">
                                                        <Clock size={12} aria-hidden="true" /> {new Date(ppt.timestamp).toLocaleDateString()}
                                                        <span className="w-1 h-1 rounded-full bg-slate-300" aria-hidden="true"></span>
                                                        {ppt.slideCount || slides.length} Slides
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeletePPT(ppt.id, e)}
                                                    aria-label={`Delete presentation ${ppt.topic}`}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                                                    title="Delete"
                                                >
                                                    <X size={18} aria-hidden="true" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


        </div>
    );
};

export default React.memo(AgenticPPTGenerator);
