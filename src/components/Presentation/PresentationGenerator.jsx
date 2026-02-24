import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAICompletion } from '../../utils/aiService';
import { generateNativePPT } from '../../utils/pptExport';
import { ArrowLeft, Sparkles, Trash2, Download, Edit3, Loader2, LayoutDashboard, MonitorPlay, CheckCircle, ArrowRight, Settings2, Play, Maximize, MessageSquare, Send, Paintbrush, X as XIcon, Minimize2 } from 'lucide-react';
import Confetti from 'react-confetti';
import SlideRenderer from './SlideRenderer';

const PresentationGenerator = ({ onBack }) => {
    // 1 = Idea, 2 = Blueprint, 3 = Studio
    const [currentStep, setCurrentStep] = useState(1);

    // Step 1 State
    const [topic, setTopic] = useState('');
    const [tone, setTone] = useState('Academic');
    const [slideCount, setSlideCount] = useState(5);
    const [audience, setAudience] = useState('General');
    const [themePreset, setThemePreset] = useState('corporate');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [vibe, setVibe] = useState('Modern');
    const [complexity, setComplexity] = useState('Balanced');
    const [layoutPreference, setLayoutPreference] = useState('Canvas');

    // Step 2 State
    const [blueprint, setBlueprint] = useState([]);

    // Step 3 State
    const [finalSlides, setFinalSlides] = useState([]);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [theme, setTheme] = useState('dark');
    const [generatingIndex, setGeneratingIndex] = useState(null);
    const [isGenerationComplete, setIsGenerationComplete] = useState(false);

    // Download UX State
    const [isDownloading, setIsDownloading] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    // Advanced Phase 7 State
    const [activeTab, setActiveTab] = useState('copilot'); // 'copilot' | 'export'
    const [coPilotMessage, setCoPilotMessage] = useState('');
    const [coPilotHistory, setCoPilotHistory] = useState([]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [isCoPilotLoading, setIsCoPilotLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Resizable Panel State
    const [panelSize, setPanelSize] = useState(340);
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef(null);

    const startResizing = (e) => {
        setIsResizing(true);
        // Prevent scroll on touch devices while resizing
        if (e.cancelable) e.preventDefault();
    };

    const stopResizing = () => {
        setIsResizing(false);
    };

    useEffect(() => {
        const resize = (e) => {
            if (!isResizing) return;

            const isMobile = window.innerWidth < 768;
            if (isMobile) {
                const clientY = e.clientY || e.touches?.[0].clientY;
                if (clientY === undefined) return;
                const newHeight = window.innerHeight - clientY;
                if (newHeight > 150 && newHeight < window.innerHeight * 0.8) {
                    setPanelSize(newHeight);
                }
            } else {
                const clientX = e.clientX || e.touches?.[0].clientX;
                if (clientX === undefined) return;
                const newWidth = window.innerWidth - clientX;
                if (newWidth > 200 && newWidth < 800) {
                    setPanelSize(newWidth);
                }
            }
        };

        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            window.addEventListener('mouseleave', stopResizing);
            window.addEventListener('touchmove', resize, { passive: false });
            window.addEventListener('touchend', stopResizing);
        }

        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            window.removeEventListener('mouseleave', stopResizing);
            window.removeEventListener('touchmove', resize);
            window.removeEventListener('touchend', stopResizing);
        };
    }, [isResizing]);

    const canvasRef = useRef(null);

    const cleanAndParseJSON = (text) => {
        try {
            let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const firstBrace = cleaned.indexOf('{');
            const endBrace = cleaned.lastIndexOf('}');
            if (firstBrace !== -1 && endBrace !== -1) {
                cleaned = cleaned.substring(firstBrace, endBrace + 1);
            }
            return JSON.parse(cleaned);
        } catch (e) {
            console.error("JSON Parse Error:", e, "\nOriginal Text:", text);
            throw new Error("Failed to parse AI response.");
        }
    };

    const handleEnhancePrompt = async () => {
        if (!topic.trim()) return;
        setIsEnhancing(true);
        try {
            const systemPrompt = `You are an expert Presentation Architect. 
The user has provided a short, basic idea for a presentation: "${topic}"

Your job is to expand this into a highly detailed, professional, 3-sentence prompt. 
Do not write the presentation itself. Just write a better, more explicit prompt that describes what the presentation SHOULD cover.
DO NOT use markdown, quotes, or conversational filler. Just return the raw expanded prompt text.`;

            const aiText = await getAICompletion([
                { role: "system", content: systemPrompt },
                { role: "user", content: "Expand this prompt now." }
            ]);

            if (aiText) {
                setTopic(aiText.trim());
            }
        } catch (err) {
            console.error("Failed to enhance prompt:", err);
        } finally {
            setIsEnhancing(false);
        }
    };

    // --- API Call 1: The Director ---
    const engineerBlueprint = async () => {
        if (!topic.trim()) return;
        setIsLoading(true);
        setLoadingText('DeepSeek is analyzing millions of academic papers...');

        try {
            const systemPrompt = `You are an expert Presentation Architect. 
Overall Presentation Topic: "${topic}".
Target Audience: "${audience}"
Tone: "${tone}"
Visual Vibe: "${vibe}"
Layout Preference: "${layoutPreference}"

Generate a strictly formatted JSON outline for ${slideCount} slides.

CRITICAL RULES:
1. You MUST choose a layout from this exact list ONLY: "TITLE_SLIDE", "TWO_COLUMN", "BIG_STAT", "STANDARD_BULLETS".
2. Slide 1 MUST be "TITLE_SLIDE".
3. If the Audience is "Beginner", ensure early slides focus on definitions. If "Expert/Professor", skip basics and focus on deep analysis.
4. Output ONLY valid JSON, do not include markdown blocks or any other text.

SCHEMA:
{
  "outline": [
    {
      "slide_number": 1,
      "title": "Introduction to Data Science",
      "layout": "TITLE_SLIDE"
    },
    {
      "slide_number": 2,
      "title": "The 3 Pillars of AI",
      "layout": "TWO_COLUMN"
    }
  ]
}`;
            const aiText = await getAICompletion([
                { role: "system", content: systemPrompt },
                { role: "user", content: "Generate the JSON outline now." }
            ]);

            const parsed = cleanAndParseJSON(aiText);
            if (parsed && parsed.outline) {
                setBlueprint(parsed.outline);
                setCurrentStep(2);
            } else {
                throw new Error("Invalid schema returned.");
            }
        } catch (err) {
            console.error(err);
            alert("Failed to generate blueprint. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- API Call 2: The Progressive Writer ---
    const generateStudioContent = async () => {
        // 1. Move UI to final Studio view immediately
        setCurrentStep(3);
        setFinalSlides([]);
        setIsGenerationComplete(false);

        // 2. The Sequential Generator Loop
        for (let i = 0; i < blueprint.length; i++) {
            const currentSlideTarget = blueprint[i];

            // Tell the UI which slide is currently baking
            setGeneratingIndex(i);
            setActiveSlideIndex(i); // Auto-focus the active one

            try {
                // 3. Call AI Service for just ONE slide
                const systemPrompt = `You are an expert Presentation Copywriter. 
Overall Presentation Topic: "${topic}"
Target Audience: "${audience}"
Visual Vibe: "${vibe}"
Layout Preference: "${layoutPreference}"

Your task is to generate the content and a CONTEXTUAL DESIGN for ONLY ONE specific slide.

CURRENT SLIDE TARGET:
- Title: "${currentSlideTarget.title}"
- Blueprint Layout: "${currentSlideTarget.layout}"

CRITICAL RULES:
1. MAX 3 bullet points per slide.
2. MAX 12 words per bullet point.
3. Every slide title MUST be a bold 'Assertion'.
4. Be punchy and highly ${tone.toLowerCase()} in tone.
5. You MUST provide a "design" object that describes how this slide should look based on its context.

JSON SCHEMA:
{
  "slide_number": ${currentSlideTarget.slide_number},
  "title": "...",
  "bullets": ["..."],
  "design": {
    "bgType": "gradient | solid | mesh | glass",
    "colors": { "primary": "hex", "secondary": "hex", "accent": "hex" },
    "layoutHints": "center-card | split-vertical | hero-stat | grid-3x1",
    "decorations": ["floating-orbs", "grid-pattern", "border-glow", "abstract-shapes"],
    "icon": "lucide icon name relating to context"
  }
}
`;

                const aiText = await getAICompletion([
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Write bullet points and stats for this specific slide following the schema exactly." }
                ]);

                const parsed = cleanAndParseJSON(aiText);

                // 4. Update state progressively.
                setFinalSlides(prevSlides => {
                    const merged = { ...currentSlideTarget, ...parsed };
                    return [...prevSlides, merged];
                });

            } catch (err) {
                console.error(`Failed to generate slide ${i + 1}`, err);
                // Push a fallback slide
                setFinalSlides(prevSlides => [
                    ...prevSlides,
                    { ...currentSlideTarget, title: `${currentSlideTarget.title} (Failed Generation)`, bullets: ["Error generating slide content", "Please click 'Regenerate'"] }
                ]);
            }
        }

        // 5. Loop finished!
        setGeneratingIndex(null);
        setIsGenerationComplete(true);
    };

    const handleUpdateBlueprintTitle = (index, newTitle) => {
        const updated = [...blueprint];
        updated[index].title = newTitle;
        setBlueprint(updated);
    };

    const handleDeleteBlueprint = (index) => {
        if (blueprint.length <= 1) return;
        const updated = blueprint.filter((_, i) => i !== index);
        updated.forEach((slide, i) => slide.slide_number = i + 1);
        setBlueprint(updated);
        setSlideCount(updated.length);
    };

    // --- Single Slide Regeneration (Phase 3 Requirement) ---
    const handleRegenerateSlide = async (index) => {
        setIsLoading(true);
        setLoadingText('Rewriting specific slide evidence...');

        try {
            const slideToFix = finalSlides[index];
            const systemPrompt = `You are fixing ONE specific slide in a presentation.
            The user did not like this slide's content. Rewrite it using the ASSERTION-EVIDENCE style.
            Overall Topic: "${topic}"
            Visual Vibe: "${vibe}"
            
            Keep the content punchy but YOU MUST also provide an updated "design" object for this slide based on its content context.
            
            Return ONLY a JSON object.
            
            SCHEMA:
            {
              "slide_number": ${slideToFix.slide_number},
              "title": "...",
              "bullets": ["..."],
              "design": {
                "bgType": "gradient | solid | mesh | glass",
                "colors": { "primary": "hex", "secondary": "hex", "accent": "hex" },
                "layoutHints": "center-card | split-vertical | hero-stat | grid-3x1",
                "decorations": ["floating-orbs", "grid-pattern", "border-glow", "abstract-shapes"],
                "icon": "lucide icon name"
              }
            }`;

            const aiText = await getAICompletion([
                { role: "system", content: systemPrompt },
                { role: "user", content: "Rewrite this slide now." }
            ]);

            const fixedSlide = cleanAndParseJSON(aiText);
            const updatedSlides = [...finalSlides];
            // Merge new keys (bullets, stat, title) safely
            updatedSlides[index] = { ...updatedSlides[index], ...fixedSlide };
            setFinalSlides(updatedSlides);

        } catch (err) {
            console.error("Slide regeneration failed:", err);
            alert("Failed to regenerate slide. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async () => {
        setIsDownloading(true);

        // Brief simulated delay to allow React state to render the spinner
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            generateNativePPT(theme, finalSlides, topic);

            // Trigger magic Confetti
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000); // Hide after 5 seconds
        } catch (err) {
            console.error("PPTX Download Failed:", err);
            alert("Failed to compile PowerPoint file.");
        } finally {
            setIsDownloading(false);
        }
    };

    // Live Visualizer Styles based on Corporate Theme Colors
    const getVisualizerStyles = () => {
        if (theme === 'dark') return { bg: '#1E293B', text: '#F1F5F9', accent: '#8B5CF6', sidebar: '#0F172A' };
        if (theme === 'corporate') return { bg: '#F8FAFC', text: '#0F172A', accent: '#2563EB', sidebar: '#334155' };
        return { bg: '#FFFFFF', text: '#111827', accent: '#8B5CF6', sidebar: '#F1F5F9' };
    };

    const vStyles = getVisualizerStyles();

    // --- Phase 7 Functions ---

    // Feature 2: Fullscreen
    const toggleFullscreen = () => {
        const canvas = document.getElementById('presentation-canvas');
        if (!canvas) return;

        if (!document.fullscreenElement) {
            canvas.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isGenerationComplete) return;

            if (e.key === 'ArrowRight' || e.key === ' ') {
                setActiveSlideIndex(prev => Math.min(prev + 1, finalSlides.length - 1));
            } else if (e.key === 'ArrowLeft') {
                setActiveSlideIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'f' || e.key === 'F') {
                if (currentStep === 3) toggleFullscreen();
            }
        };

        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('fullscreenchange', handleFsChange);
        };
    }, [isGenerationComplete, finalSlides.length, currentStep]);

    // Feature 4: Auto-Save
    useEffect(() => {
        if (finalSlides.length > 0) {
            const deckData = {
                topic,
                tone,
                audience,
                slides: finalSlides,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem(`hope_saved_deck_${topic.replace(/\s+/g, '_')}`, JSON.stringify(deckData));
            setLastSaved(new Date().toLocaleTimeString());
        }
    }, [finalSlides, topic, tone, audience]);

    // Feature 1: AI Co-Pilot
    const editSlideWithAI = async () => {
        if (!coPilotMessage.trim() || isCoPilotLoading) return;

        setIsCoPilotLoading(true);
        const userPrompt = coPilotMessage;
        setCoPilotMessage('');

        // Add to history
        setCoPilotHistory(prev => [...prev, { role: 'user', content: userPrompt }]);

        try {
            const currentSlide = finalSlides[activeSlideIndex];
            const systemPrompt = `You are an expert Presentation Co-Pilot. 
The user is currently viewing Slide ${activeSlideIndex + 1} of a presentation about "${topic}".
Current Slide Content (JSON): ${JSON.stringify(currentSlide)}

The user wants to edit THIS SPECIFIC SLIDE. Their request: "${userPrompt}"

CRITICAL RULES:
1. Return ONLY the updated JSON for THIS SLIDE.
2. Maintain the ASSERTION-EVIDENCE style.
3. You MUST provide an updated "design" object if the user request implies a visual change or if the content significantly changes its context.
4. Output valid JSON, no markdown.

SCHEMA:
{
  "title": "...",
  "bullets": ["..."],
  "design": {
    "bgType": "...", 
    "colors": { "primary": "...", "secondary": "...", "accent": "..." },
    "layoutHints": "...",
    "decorations": [...],
    "icon": "..."
  }
}
`;

            const aiText = await getAICompletion([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);

            const updatedSlide = cleanAndParseJSON(aiText);
            const updatedSlides = [...finalSlides];
            updatedSlides[activeSlideIndex] = { ...updatedSlides[activeSlideIndex], ...updatedSlide };

            setFinalSlides(updatedSlides);
            setCoPilotHistory(prev => [...prev, { role: 'assistant', content: `Done! I've updated Slide ${activeSlideIndex + 1} for you.` }]);
        } catch (err) {
            console.error("Co-pilot edit failed:", err);
            setCoPilotHistory(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't process that edit request. Please try again." }]);
        } finally {
            setIsCoPilotLoading(false);
        }
    };

    return (
        <div className="!flex !flex-col !w-full !h-screen !bg-slate-50 !text-slate-900 !overflow-hidden relative !font-sans">
            <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>

            {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={500} />}

            {/* Background Glows */}
            <div className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none" style={{ zIndex: 0 }}>
                <div className="position-absolute rounded-circle" style={{ width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(248,250,252,0) 70%)', top: '-10%', left: '-10%' }} />
                <div className="position-absolute rounded-circle" style={{ width: '30vw', height: '30vw', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(248,250,252,0) 70%)', bottom: '-5%', right: '-5%' }} />
            </div>

            {/* Header */}
            <header className="!sticky !top-0 !z-40 !h-16 !bg-white/80 !backdrop-blur-lg !border-b !border-slate-200 !px-4 md:!px-6 !flex !items-center !justify-between !gap-4">
                <div className="!flex !items-center !gap-3">
                    <button onClick={onBack} className="!w-10 !h-10 !flex !items-center !justify-center !rounded-full !bg-slate-100 hover:!bg-slate-200 !transition-colors !text-slate-600 focus:!outline-none">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="hidden sm:block">
                        <h4 className="!font-bold !m-0 !flex !items-center !gap-2 !text-slate-900 !text-lg">
                            <MonitorPlay className="!text-blue-600" /> HOPE Studio
                        </h4>
                        <span className="!text-xs !text-slate-500 !font-medium">Agentic Slide Architect</span>
                    </div>
                </div>

                {/* Stepper Wizard Indicator */}
                <div className="!hidden md:!flex !items-center !gap-2 !bg-slate-100 !px-3 !py-1.5 !rounded-full !border !border-slate-200">
                    <span className={`!text-[10px] !font-bold !uppercase !tracking-wider !px-2.5 !py-1 !rounded-full ${currentStep >= 1 ? '!bg-blue-600 !text-white' : '!bg-slate-200 !text-slate-500'}`}>Idea</span>
                    <div className={`!w-6 !h-0.5 ${currentStep >= 2 ? '!bg-blue-600' : '!bg-slate-300'}`} />
                    <span className={`!text-[10px] !font-bold !uppercase !tracking-wider !px-2.5 !py-1 !rounded-full ${currentStep >= 2 ? '!bg-blue-600 !text-white' : '!bg-slate-200 !text-slate-500'}`}>Blueprint</span>
                    <div className={`!w-6 !h-0.5 ${currentStep >= 3 ? '!bg-blue-600' : '!bg-slate-300'}`} />
                    <span className={`!text-[10px] !font-bold !uppercase !tracking-wider !px-2.5 !py-1 !rounded-full ${currentStep === 3 ? '!bg-blue-600 !text-white' : '!bg-slate-200 !text-slate-500'}`}>Studio</span>
                </div>

                <div className="!flex !items-center !gap-3">
                    {currentStep === 3 && (
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="!bg-emerald-600 hover:!bg-emerald-700 !text-white !px-4 !py-2 !rounded-xl !text-sm !font-bold !flex !items-center !gap-2 !shadow-sm !transition-all"
                        >
                            {isDownloading ? <Loader2 className="!animate-spin" size={16} /> : <Download size={16} />}
                            <span className="hidden sm:inline">Export PPTX</span>
                        </button>
                    )}
                </div>
            </header >

            <main className="flex-grow-1 position-relative z-1 d-flex flex-column" style={{ overflowY: 'auto' }}>
                <AnimatePresence mode="wait">

                    {/* STEP 1: THE IDEA */}
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, y: 40, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="!container !flex !flex-col !justify-center !items-center !h-full !flex-grow !py-5 !px-4"
                        >
                            <div className="!max-w-3xl !mx-auto !bg-white/80 !backdrop-blur-2xl !border !border-slate-200 !shadow-xl !rounded-[2rem] !p-8 md:!p-12 !w-full">
                                <h1 className="!text-3xl md:!text-4xl !font-extrabold !text-slate-900 !tracking-tight !text-center !mb-3">What are we presenting today?</h1>
                                <p className="!text-base md:!text-lg !text-slate-500 !text-center !mb-10">Provide a topic. Our Agentic Director will architect the perfect slide sequence.</p>

                                {/* Prompt Input with Embedded Action */}
                                <div className="!relative !mb-8">
                                    <textarea
                                        className="!w-full !bg-slate-50 !border !border-slate-200 focus:!bg-white focus:!border-blue-500 focus:!ring-4 focus:!ring-blue-500/10 !rounded-2xl !p-6 !pb-12 !text-lg !text-slate-800 placeholder:!text-slate-400 !transition-all !resize-none !min-h-[140px] !shadow-inner !outline-none !appearance-none"
                                        placeholder="e.g., The Future of Quantum Architecture"
                                        value={topic}
                                        onChange={e => setTopic(e.target.value)}
                                        autoFocus
                                    />
                                    <button
                                        className="!absolute !bottom-4 !right-4 !text-xs !font-bold !bg-blue-50 !text-blue-700 hover:!bg-blue-100 !px-3 !py-1.5 !rounded-lg !flex !items-center !gap-1 !transition-all !shadow-sm disabled:!opacity-50"
                                        title="Let the AI expand your idea into a detailed prompt"
                                        onClick={handleEnhancePrompt}
                                        disabled={isEnhancing || !topic.trim()}
                                    >
                                        {isEnhancing ? <Loader2 className="!animate-spin" size={12} /> : <Sparkles size={12} />}
                                        {isEnhancing ? 'Enhancing...' : 'Enhance Prompt'}
                                    </button>
                                </div>

                                {/* Primary Configurations */}
                                <div className="!grid !grid-cols-1 md:!grid-cols-2 !gap-8 !mt-8">
                                    <div className="!w-full">
                                        <label className="!text-[10px] !font-bold !text-slate-400 !uppercase !tracking-widest !mb-3 !block">Narrative Tone</label>
                                        <div className="!flex !flex-wrap !gap-2">
                                            {['Academic', 'Pitch', 'Casual'].map(t => (
                                                <div
                                                    key={t}
                                                    onClick={() => setTone(t)}
                                                    className={`!px-4 !py-2 !text-sm !font-semibold !transition-all !cursor-pointer !rounded-xl !border ${tone === t ? '!bg-slate-900 !text-white !border-slate-900 !shadow-lg !scale-[1.02]' : '!bg-white !border-slate-200 !text-slate-600 hover:!bg-slate-50'}`}
                                                >
                                                    {t}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="!w-full">
                                        <label className="!text-[10px] !font-bold !text-slate-400 !uppercase !tracking-widest !mb-3 !block">Presentation Length</label>
                                        <div className="!flex !flex-wrap !gap-2">
                                            {[{ label: 'Short (5)', value: 5 }, { label: 'Standard (8)', value: 8 }, { label: 'In-Depth (12+)', value: 12 }].map(c => (
                                                <div
                                                    key={c.value}
                                                    onClick={() => setSlideCount(c.value)}
                                                    className={`!px-4 !py-2 !text-sm !font-semibold !transition-all !cursor-pointer !rounded-xl !border ${slideCount === c.value ? '!bg-slate-900 !text-white !border-slate-900 !shadow-lg !scale-[1.02]' : '!bg-white !border-slate-200 !text-slate-600 hover:!bg-slate-50'}`}
                                                >
                                                    {c.label}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Depth Customization: Vibe & Layout */}
                                <div className="!grid !grid-cols-1 md:!grid-cols-2 !gap-8 !mt-8">
                                    <div className="!w-full">
                                        <label className="!text-[10px] !font-bold !text-slate-400 !uppercase !tracking-widest !mb-3 !block">Visual Vibe</label>
                                        <div className="!flex !flex-wrap !gap-2">
                                            {['Modern', 'Neon', 'Organic', 'Monochrome'].map(v => (
                                                <div
                                                    key={v}
                                                    onClick={() => setVibe(v)}
                                                    className={`!px-4 !py-2 !text-sm !font-semibold !transition-all !cursor-pointer !rounded-xl !border ${vibe === v ? '!bg-blue-600 !text-white !border-blue-600 !shadow-lg !scale-[1.02]' : '!bg-white !border-slate-200 !text-slate-600 hover:!bg-slate-50'}`}
                                                >
                                                    {v}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="!w-full">
                                        <label className="!text-[10px] !font-bold !text-slate-400 !uppercase !tracking-widest !mb-3 !block">Layout Preference</label>
                                        <div className="!flex !flex-wrap !gap-2">
                                            {['Canvas', 'Grid', 'Editorial'].map(l => (
                                                <div
                                                    key={l}
                                                    onClick={() => setLayoutPreference(l)}
                                                    className={`!px-4 !py-2 !text-sm !font-semibold !transition-all !cursor-pointer !rounded-xl !border ${layoutPreference === l ? '!bg-blue-600 !text-white !border-blue-600 !shadow-lg !scale-[1.02]' : '!bg-white !border-slate-200 !text-slate-600 hover:!bg-slate-50'}`}
                                                >
                                                    {l}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Advanced Settings Accordion */}
                                <div className="!mt-8 !border-t !border-slate-100 !pt-6">
                                    <div
                                        className="!flex !items-center !gap-2 !text-sm !font-bold !text-slate-500 hover:!text-slate-900 !cursor-pointer !transition-colors !w-max"
                                        onClick={() => setShowAdvanced(!showAdvanced)}
                                    >
                                        <Settings2 size={16} /> Advanced Customization
                                    </div>

                                    <AnimatePresence>
                                        {showAdvanced && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                                animate={{ height: 'auto', opacity: 1, marginTop: '1.5rem' }}
                                                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                                className="!overflow-hidden"
                                            >
                                                <div className="!grid !grid-cols-1 md:!grid-cols-2 !gap-8">
                                                    <div>
                                                        <label className="!text-[10px] !font-bold !text-slate-400 !uppercase !tracking-widest !mb-3 !block">Target Audience</label>
                                                        <div className="!flex !flex-wrap !gap-2">
                                                            {['Beginner', 'General', 'Expert/Professor'].map(a => (
                                                                <div
                                                                    key={a}
                                                                    onClick={() => setAudience(a)}
                                                                    className={`!px-4 !py-2 !text-sm !font-semibold !transition-all !cursor-pointer !rounded-xl !border ${audience === a ? '!bg-slate-900 !text-white !border-slate-900 !shadow-lg !scale-[1.02]' : '!bg-white !border-slate-200 !text-slate-600 hover:!bg-slate-50'}`}
                                                                >
                                                                    {a}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="!text-[10px] !font-bold !text-slate-400 !uppercase !tracking-widest !mb-3 !block">Theme Preset</label>
                                                        <div className="!flex !flex-wrap !gap-2">
                                                            {[
                                                                { id: 'dark', name: 'Phantom Dark', bg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
                                                                { id: 'corporate', name: 'Cloud Light', bg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }
                                                            ].map(t => (
                                                                <div
                                                                    key={t.id}
                                                                    onClick={() => {
                                                                        setThemePreset(t.id);
                                                                        setTheme(t.id);
                                                                    }}
                                                                    className={`!px-4 !py-2 !text-sm !font-semibold !transition-all !cursor-pointer !rounded-xl !border !flex !items-center !gap-2 ${themePreset === t.id ? '!bg-slate-900 !text-white !border-slate-900 !shadow-lg !scale-[1.02]' : '!bg-white !border-slate-200 !text-slate-600 hover:!bg-slate-50'}`}
                                                                >
                                                                    <div className="!rounded-full !shadow-sm" style={{ width: '12px', height: '12px', background: t.bg }} />
                                                                    {t.name}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Action Button */}
                                <div className="!mt-10 !mx-auto !w-full md:!w-2/3 !flex !justify-center">
                                    <button
                                        className={`!w-full !flex !items-center !justify-center !gap-3 !text-lg !font-bold !py-4 !px-8 !rounded-full !transition-all !duration-300 ${isLoading ? '!bg-slate-100 !text-slate-400 !cursor-not-allowed' : '!bg-blue-600 hover:!bg-blue-700 !text-white !shadow-xl hover:!shadow-2xl hover:!-translate-y-1'}`}
                                        onClick={engineerBlueprint}
                                        disabled={isLoading || !topic.trim()}
                                    >
                                        {isLoading ? (
                                            <><Loader2 className="!animate-spin" size={22} /> Synthesizing research...</>
                                        ) : (
                                            <><Sparkles className="!w-5 !h-5 !text-white" /> Architect Blueprint</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: THE BLUEPRINT */}
                    {currentStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.4 }}
                            className="!container !py-5 !max-w-[800px] !mx-auto !flex !flex-col !gap-6"
                        >
                            <div className="!flex !justify-between !items-center !mb-2">
                                <div>
                                    <h2 className="!font-bold !m-0 !text-slate-900 !flex !items-center !gap-2 !text-2xl">
                                        <LayoutDashboard className="!text-blue-600" /> Review Slide Deck Outline
                                    </h2>
                                    <p className="!text-slate-500 !mt-1 !text-sm">Refine the architecture before we write the final content.</p>
                                </div>
                                <button className="!px-4 !py-2 !rounded-full !border !border-slate-200 !text-slate-600 hover:!bg-slate-50 !text-sm !font-semibold !transition-colors" onClick={() => setCurrentStep(1)}>Go Back</button>
                            </div>

                            <div className="!flex !flex-col !gap-3 !mb-5">
                                {blueprint.map((slide, index) => (
                                    <motion.div
                                        key={slide.slide_number}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="!p-4 !rounded-2xl !flex !items-center !gap-4 !bg-white !shadow-sm !border !border-slate-100 hover:!border-blue-200 hover:!shadow-md hover:!bg-slate-50/50 !transition-all !group"
                                    >
                                        <div className="!text-slate-400 !font-black !text-2xl !w-10 !text-center">{slide.slide_number}</div>
                                        <div className="!flex-grow">
                                            <div className="!flex !items-center !justify-between !mb-2">
                                                <span className="!text-[10px] !font-black !uppercase !tracking-widest !bg-blue-50 !text-blue-600 !px-2 !py-0.5 !rounded !border !border-blue-100">
                                                    {slide.layout}
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                value={slide.title}
                                                onChange={(e) => handleUpdateBlueprintTitle(index, e.target.value)}
                                                className="!w-full !bg-transparent !border-0 !text-slate-900 !text-lg !font-bold !p-0 !outline-none focus:!ring-0 !appearance-none"
                                            />
                                        </div>
                                        <button
                                            onClick={() => handleDeleteBlueprint(index)}
                                            className="!p-2 !rounded-full !text-slate-300 hover:!text-red-500 hover:!bg-red-50 !transition-all"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>

                            <button
                                className="!w-full !flex !items-center !justify-center !gap-3 !text-lg !font-bold !py-4 !rounded-full !transition-all !duration-300 !bg-blue-600 !text-white !shadow-xl hover:!bg-blue-700 hover:!-translate-y-1"
                                onClick={generateStudioContent}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <><Loader2 className="!animate-spin" size={22} /> {loadingText}</>
                                ) : (
                                    <>Looks Perfect <ArrowRight size={20} /> Generate Content</>
                                )}
                            </button>
                        </motion.div>
                    )}

                    {/* STEP 3: THE STUDIO */}
                    {currentStep === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.5 }}
                            className="!flex !flex-col !flex-grow !overflow-hidden"
                        >
                            {/* Split Screen Layout */}
                            <div className="!flex !flex-col md:!flex-row !flex-grow !overflow-hidden">
                                {/* Left Panel: The Visualizer */}
                                <div className="!flex-1 !flex !flex-col !p-4 !bg-slate-100 !border-r !border-slate-200 !justify-between">
                                    <div className="!flex-1 !flex !flex-col !min-h-0">
                                        <div className="!flex !items-center !justify-between !mb-4 !px-2">
                                            <h5 className="!font-bold !m-0 !text-slate-900 !text-lg">Live Canvas Preview</h5>
                                            <div className="!flex !items-center !gap-3">
                                                <button
                                                    onClick={toggleFullscreen}
                                                    className="!bg-slate-900 hover:!bg-black !text-white !px-4 !py-1.5 !rounded-full !text-sm !font-bold !flex !items-center !gap-2 !shadow-lg !transition-all"
                                                >
                                                    <Play size={14} fill="currentColor" /> Present Mode
                                                </button>
                                                <div className="!bg-white !text-slate-900 !font-bold !text-xs !border !border-slate-200 !py-1.5 !px-3 !rounded-full !shadow-sm">
                                                    Slide {activeSlideIndex + 1} of {finalSlides.length}
                                                </div>
                                            </div>
                                        </div>

                                        {/* The 16:9 Slides Canvas Container */}
                                        <div className="!flex-grow !flex !items-center !justify-center !relative !p-4">
                                            <motion.div
                                                id="presentation-canvas"
                                                className={`!relative !overflow-hidden !bg-white !shadow-2xl ${isFullscreen ? '!rounded-none' : '!rounded-xl !border !border-slate-200'}`}
                                                animate={{ opacity: 1 }}
                                                transition={{ duration: 0.4 }}
                                                style={{
                                                    width: isFullscreen ? '100vw' : '100%',
                                                    height: isFullscreen ? '100vh' : 'auto',
                                                    maxWidth: isFullscreen ? 'none' : '960px',
                                                    aspectRatio: isFullscreen ? 'auto' : '16/9',
                                                }}
                                            >
                                                {/* Fullscreen Controls */}
                                                {isFullscreen && (
                                                    <div className="!absolute !top-6 !right-8 !z-[100] !flex !gap-4 !opacity-0 hover:!opacity-100 !transition-opacity">
                                                        <button
                                                            onClick={toggleFullscreen}
                                                            className="!bg-black/50 !backdrop-blur-md !text-white !p-3 !rounded-full hover:!bg-black/70 !transition-all !border !border-white/20"
                                                        >
                                                            <Minimize2 size={24} />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Accent Bar */}
                                                {!isFullscreen && (
                                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '1.5%', background: vStyles.accent, zIndex: 10 }} />
                                                )}

                                                {/* Slide Content */}
                                                {generatingIndex === activeSlideIndex ? (
                                                    <div className="!absolute !inset-0 !bg-slate-950 !flex !flex-col !p-8 !z-10 !font-mono">
                                                        <div className="!flex !items-center !gap-2 !mb-4 !border-b !border-emerald-500/30 !pb-2">
                                                            <div className="!w-3 !h-3 !rounded-full !bg-red-500/50" />
                                                            <div className="!w-3 !h-3 !rounded-full !bg-yellow-500/50" />
                                                            <div className="!w-3 !h-3 !rounded-full !bg-green-500/50" />
                                                            <span className="!text-emerald-500/50 !text-xs !ml-2">HOPE_STUDIO_OS v4.2.0</span>
                                                        </div>
                                                        <div className="!flex-1 !overflow-hidden">
                                                            <p className="!text-emerald-500 !mb-2"><span className="!opacity-50">$</span> tail -f /dev/ai_brain/output</p>
                                                            <div className="!text-emerald-400/80 !leading-relaxed !text-sm">
                                                                {`{ "status": "processing", "slide_idx": ${generatingIndex}, "logic": "assertion_evidence_loop" }`}
                                                                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="!inline-block !w-2 !h-4 !bg-emerald-400 !ml-1 !align-middle" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <AnimatePresence mode="wait">
                                                        <motion.div
                                                            key={activeSlideIndex}
                                                            initial={{ opacity: 0, x: 50 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: -50 }}
                                                            transition={{ duration: 0.4, ease: "easeOut" }}
                                                            className="!w-full !h-full !flex !flex-col !p-4 !box-border"
                                                        >
                                                            <SlideRenderer slideData={finalSlides[activeSlideIndex]} />
                                                        </motion.div>
                                                    </AnimatePresence>
                                                )}
                                            </motion.div>
                                        </div>
                                    </div>

                                    {/* Bottom Ribbon */}
                                    <div className="!shrink-0">
                                        <div className="!flex !flex-col !mt-3">
                                            <div className="!flex !justify-end !mb-2 !pe-4">
                                                <button
                                                    onClick={() => handleRegenerateSlide(activeSlideIndex)}
                                                    disabled={isLoading}
                                                    className="!bg-white hover:!bg-slate-50 !text-slate-700 !px-4 !py-1.5 !rounded-full !text-xs !font-bold !flex !items-center !gap-2 !shadow-sm !border !border-slate-200 !transition-all"
                                                >
                                                    {isLoading ? <Loader2 className="!animate-spin" size={14} /> : <Sparkles size={14} />}
                                                    Regenerate Slide {activeSlideIndex + 1}
                                                </button>
                                            </div>

                                            <div className="!flex !overflow-x-auto !pb-2 !gap-3 !scrollbar-hide" style={{ height: '90px', flexShrink: 0, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                                {blueprint.map((slide, i) => {
                                                    const isGenerated = finalSlides.length > i;
                                                    const isGeneratingNow = generatingIndex === i;
                                                    return (
                                                        <div
                                                            key={i}
                                                            onClick={() => setActiveSlideIndex(i)}
                                                            className={`!rounded-3 !cursor-pointer !overflow-hidden !border !transition-all !flex-shrink-0 
                                                                ${isGenerated ? '!bg-white !border-slate-300' : '!bg-slate-50 !border-dashed !border-slate-200'}
                                                                ${activeSlideIndex === i ? '!ring-2 !ring-blue-600 !shadow-sm !scale-105 !border-blue-600' : '!opacity-75 hover:!opacity-100'}
                                                                ${isGeneratingNow ? '!border-blue-500 !ring-2 !ring-blue-500/20' : ''}
                                                            `}
                                                            style={{ width: '130px', height: '100%', background: isGenerated ? vStyles.bg : '#f8fafc', color: isGenerated ? vStyles.text : '#94a3b8' }}
                                                        >
                                                            <div className="!w-full !h-full !flex !flex-col !p-2 !relative">
                                                                <div className="!font-bold !text-truncate" style={{ fontSize: '0.65rem', color: isGenerated ? vStyles.accent : '#94a3b8' }}>{slide.layout}</div>
                                                                <div className="!font-medium !text-truncate !mt-1" style={{ fontSize: '0.75rem' }}>{isGenerated ? finalSlides[i]?.title : slide.title}</div>
                                                                {isGenerated && <div className="!absolute !bottom-0 !left-0 !w-full" style={{ height: '2px', background: vStyles.accent }} />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Panel: Sidekick / Export */}
                                <div
                                    ref={panelRef}
                                    className="!bg-white !border-l !border-slate-200 !flex !flex-col !overflow-hidden !relative"
                                    style={{
                                        width: !isMobile ? `${panelSize}px` : '100%',
                                        height: isMobile ? `${panelSize}px` : 'auto',
                                        transition: isResizing ? 'none' : 'all 0.3s ease'
                                    }}
                                >
                                    {/* Resize Handle */}
                                    <div
                                        onMouseDown={startResizing}
                                        onTouchStart={startResizing}
                                        className={`!absolute !z-50 !bg-slate-300 hover:!bg-blue-500 !transition-colors !cursor-move md:!cursor-col-resize
                                            ${isMobile
                                                ? '!top-0 !left-0 !right-0 !h-1'
                                                : '!left-0 !top-0 !bottom-0 !w-1'}`}
                                    />
                                    <div className="!flex !border-b !border-slate-100">
                                        <button
                                            onClick={() => setActiveTab('copilot')}
                                            className={`!flex-1 !py-3 !text-xs !font-black !uppercase !tracking-widest !transition-all ${activeTab === 'copilot' ? '!text-blue-600 !border-b-2 !border-blue-600 !bg-blue-50/50' : '!text-slate-400 hover:!text-slate-600 hover:!bg-slate-50'}`}
                                        >
                                            AI Co-pilot
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('export')}
                                            className={`!flex-1 !py-3 !text-xs !font-black !uppercase !tracking-widest !transition-all ${activeTab === 'export' ? '!text-blue-600 !border-b-2 !border-blue-600 !bg-blue-50/50' : '!text-slate-400 hover:!text-slate-600 hover:!bg-slate-50'}`}
                                        >
                                            Export
                                        </button>
                                    </div>

                                    <div className="!flex-1 !overflow-hidden !p-4 !flex !flex-col">
                                        {activeTab === 'copilot' ? (
                                            <div className="!flex !flex-col !h-full !gap-4">
                                                <div className="!flex-1 !overflow-y-auto !space-y-4 !pr-1 !scrollbar-hide">
                                                    {coPilotHistory.length === 0 ? (
                                                        <div className="!text-center !py-8">
                                                            <Sparkles className="!mx-auto !mb-3 !text-blue-400 !bg-blue-50 !p-3 !rounded-2xl !w-12 !h-12" />
                                                            <p className="!text-sm !text-slate-500 !font-semibold">Your AI Creative Assistant is ready.</p>
                                                            <p className="!text-xs !text-slate-400 !mt-1">Try: "Make the tone more professional"</p>
                                                        </div>
                                                    ) : (
                                                        coPilotHistory.map((chat, i) => (
                                                            <div key={i} className={`!flex ${chat.role === 'user' ? '!justify-end' : '!justify-start'}`}>
                                                                <div className={`!max-w-[85%] !p-3 !rounded-2xl !text-xs !font-medium ${chat.role === 'user' ? '!bg-blue-600 !text-white' : '!bg-slate-100 !text-slate-800'}`}>
                                                                    {chat.content}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                <div className="!shrink-0 !bg-slate-50 !px-3 !py-1.5 !rounded-full !border !border-slate-200 !flex !items-center !gap-2 !mb-1">
                                                    <textarea
                                                        value={coPilotMessage}
                                                        onChange={(e) => setCoPilotMessage(e.target.value)}
                                                        placeholder="Message AI..."
                                                        className="!flex-1 !bg-transparent !border-0 !text-sm !text-slate-800 placeholder:!text-slate-400 !p-1 !resize-none !outline-none focus:!ring-0 !appearance-none !h-7 !min-h-0 !leading-snug !overflow-hidden"
                                                        rows={1}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                editSlideWithAI();
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        onClick={editSlideWithAI}
                                                        disabled={isCoPilotLoading || !coPilotMessage.trim()}
                                                        className="!bg-blue-600 hover:!bg-blue-700 !text-white !p-1.5 !rounded-full !transition-all disabled:!opacity-50 !shrink-0"
                                                    >
                                                        {isCoPilotLoading ? <Loader2 size={12} className="!animate-spin" /> : <Send size={12} />}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="!space-y-6">
                                                <div className="!p-4 !bg-emerald-50 !border !border-emerald-100 !rounded-2xl">
                                                    <h6 className="!text-emerald-900 !font-black !text-[10px] !uppercase !tracking-widest !mb-2">Native PowerPoint</h6>
                                                    <p className="!text-xs !text-emerald-700 !mb-4">Export to editable .pptx format with your selected corporate theme.</p>
                                                    <button
                                                        onClick={handleDownload}
                                                        disabled={isDownloading}
                                                        className="!w-full !bg-emerald-600 hover:!bg-emerald-700 !text-white !py-3 !rounded-full !text-sm !font-bold !flex !items-center !justify-center !gap-2 !transition-all"
                                                    >
                                                        {isDownloading ? <Loader2 size={16} className="!animate-spin" /> : <Download size={16} />}
                                                        {isDownloading ? "Compiling..." : "Download PPTX"}
                                                    </button>
                                                </div>
                                                {lastSaved && (
                                                    <div className="!text-center">
                                                        <p className="!text-[10px] !text-slate-400 !font-bold !flex !items-center !justify-center !gap-1">
                                                            <CheckCircle size={10} /> Auto-saved at {lastSaved}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default PresentationGenerator;
