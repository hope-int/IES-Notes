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
The user wants a presentation about: "${topic}".
Target Audience: "${audience}"
Tone: "${tone}"

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

Your task is to generate the content for ONLY ONE specific slide.

CURRENT SLIDE TARGET:
- Title: "${currentSlideTarget.title}"
- Required Layout: "${currentSlideTarget.layout}"

CRITICAL RULES:
1. MAX 3 bullet points per slide (so 3 on left / 3 on right if TWO_COLUMN).
2. MAX 12 words per bullet point. If you write more, the presentation will crash.
3. Every slide title MUST be a bold 'Assertion' (e.g., 'RFG Increases Efficiency by 50%').
4. The bullets MUST provide the 'Evidence' (data, metrics, technical steps).
5. Be punchy and highly ${tone.toLowerCase()} in tone.
6. Output ONLY valid JSON matching the required layout structure. Do not use markdown wrappers.

JSON SCHEMA EXAMPLES (Return ONLY the keys required for your layout):
- If TITLE_SLIDE: { "slide_number": ${currentSlideTarget.slide_number}, "layout": "TITLE_SLIDE", "title": "Main Title" }
- If TWO_COLUMN: { "slide_number": ${currentSlideTarget.slide_number}, "layout": "TWO_COLUMN", "title": "...", "bullets_left": ["..."], "bullets_right": ["..."] }
- If BIG_STAT: { "slide_number": ${currentSlideTarget.slide_number}, "layout": "BIG_STAT", "title": "...", "stat": "45%", "bullets": ["..."] }
- If STANDARD_BULLETS: { "slide_number": ${currentSlideTarget.slide_number}, "layout": "STANDARD_BULLETS", "title": "...", "bullets": ["..."] }
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
            The slide is currently using layout: ${slideToFix.layout}. 
            Keep the exact same layout type, but write a better Assetion (Title) and stronger Evidence (Bullets).
            
            Return ONLY a JSON object representing this single slide.
            
            SCHEMA EXAMPLE:
            {
              "slide_number": ${slideToFix.slide_number},
              "layout": "${slideToFix.layout}",
              "title": "New Strong Assertion Title",
              "bullets": ["New evidence 1", "New evidence 2"]
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
2. Maintain the layout type: "${currentSlide.layout}".
3. Keep assertions strong and evidence punchy.
4. Output valid JSON, no markdown.`;

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
        <div className="min-vh-100 w-full flex flex-col text-slate-900 relative overflow-hidden bg-slate-50" style={{ fontFamily: 'Inter, sans-serif' }}>

            {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={500} />}

            {/* Background Glows */}
            <div className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none" style={{ zIndex: 0 }}>
                <div className="position-absolute rounded-circle" style={{ width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(248,250,252,0) 70%)', top: '-10%', left: '-10%' }} />
                <div className="position-absolute rounded-circle" style={{ width: '30vw', height: '30vw', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(248,250,252,0) 70%)', bottom: '-5%', right: '-5%' }} />
            </div>

            {/* Header */}
            <header className="p-4 d-flex align-items-center justify-content-between position-relative z-1 border-bottom border-dark border-opacity-10 shadow-sm" style={{ background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)' }}>
                <div className="d-flex align-items-center gap-3">
                    <button onClick={onBack} className="btn btn-outline-dark rounded-circle p-2 border-opacity-25" style={{ width: 44, height: 44 }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h4 className="fw-bold m-0 d-flex align-items-center gap-2 text-dark">
                            <MonitorPlay className="text-primary" /> HOPE Studio
                        </h4>
                        <span className="small text-secondary fw-medium">Agentic Slide Architect</span>
                    </div>
                </div>

                {/* Stepper Wizard Indicator */}
                <div className="d-none d-md-flex align-items-center gap-2 bg-light px-3 py-2 rounded-pill border border-dark border-opacity-10">
                    <span className={`badge rounded-pill px-3 py-2 ${currentStep >= 1 ? 'bg-primary' : 'bg-transparent text-secondary border border-secondary'}`}>1. Idea</span>
                    <div style={{ width: 30, height: 2, background: currentStep >= 2 ? '#3B82F6' : '#CBD5E1' }} />
                    <span className={`badge rounded-pill px-3 py-2 ${currentStep >= 2 ? 'bg-primary' : 'bg-transparent text-secondary border border-secondary'}`}>2. Blueprint</span>
                    <div style={{ width: 30, height: 2, background: currentStep >= 3 ? '#3B82F6' : '#CBD5E1' }} />
                    <span className={`badge rounded-pill px-3 py-2 ${currentStep === 3 ? 'bg-primary' : 'bg-transparent text-secondary border border-secondary'}`}>3. Final Studio</span>
                </div >
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
                            className="container d-flex flex-column justify-content-center align-items-center h-100 flex-grow-1 py-5 px-4"
                        >
                            <div className="max-w-3xl mx-auto bg-white/80 backdrop-blur-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] p-8 md:p-12 w-100">
                                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight text-center mb-3">What are we presenting today?</h1>
                                <p className="text-lg text-slate-500 text-center mb-10">Provide a topic. Our Agentic Director will architect the perfect slide sequence.</p>

                                {/* Prompt Input with Embedded Action */}
                                <div className="relative mb-8">
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 rounded-2xl p-6 pb-12 text-lg text-slate-800 placeholder-slate-400 transition-all resize-none min-h-[140px] shadow-inner"
                                        placeholder="e.g., The Future of Quantum Architecture"
                                        value={topic}
                                        onChange={e => setTopic(e.target.value)}
                                        style={{ outline: 'none' }}
                                        autoFocus
                                    />
                                    <button
                                        className="absolute bottom-4 right-4 text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all shadow-sm disabled:opacity-50"
                                        title="Let the AI expand your idea into a detailed prompt"
                                        onClick={handleEnhancePrompt}
                                        disabled={isEnhancing || !topic.trim()}
                                    >
                                        {isEnhancing ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                                        {isEnhancing ? 'Enhancing...' : 'Enhance Prompt'}
                                    </button>
                                </div>

                                {/* Primary Configurations */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Narrative Tone</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Academic', 'Pitch', 'Casual'].map(t => (
                                                <div
                                                    key={t}
                                                    onClick={() => setTone(t)}
                                                    className={`px-4 py-2 text-sm font-medium transition-all cursor-pointer ${tone === t ? 'bg-slate-900 text-white shadow-md border-slate-900 rounded-lg scale-[1.02]' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg'}`}
                                                >
                                                    {t}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Presentation Length</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[{ label: 'Short (5)', value: 5 }, { label: 'Standard (8)', value: 8 }, { label: 'In-Depth (12+)', value: 12 }].map(c => (
                                                <div
                                                    key={c.value}
                                                    onClick={() => setSlideCount(c.value)}
                                                    className={`px-4 py-2 text-sm font-medium transition-all cursor-pointer ${slideCount === c.value ? 'bg-slate-900 text-white shadow-md border-slate-900 rounded-lg scale-[1.02]' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg'}`}
                                                >
                                                    {c.label}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Advanced Settings Accordion */}
                                <div className="mt-8 border-t border-slate-100 pt-6">
                                    <div
                                        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 cursor-pointer transition-colors w-max"
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
                                                className="overflow-hidden"
                                            >
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Target Audience</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {['Beginner', 'General', 'Expert/Professor'].map(a => (
                                                                <div
                                                                    key={a}
                                                                    onClick={() => setAudience(a)}
                                                                    className={`px-4 py-2 text-sm font-medium transition-all cursor-pointer ${audience === a ? 'bg-slate-900 text-white shadow-md border-slate-900 rounded-lg scale-[1.02]' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg'}`}
                                                                >
                                                                    {a}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Theme Preset</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {[
                                                                { id: 'dark', name: 'Phantom Dark', bg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', text: 'white' },
                                                                { id: 'corporate', name: 'Cloud Light', bg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', text: '#0f172a' }
                                                            ].map(t => (
                                                                <div
                                                                    key={t.id}
                                                                    onClick={() => {
                                                                        setThemePreset(t.id);
                                                                        setTheme(t.id);
                                                                    }}
                                                                    className={`px-4 py-2 text-sm font-medium transition-all cursor-pointer d-flex align-items-center gap-2 ${themePreset === t.id ? 'bg-slate-900 text-white shadow-md border-slate-900 rounded-lg scale-[1.02]' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg'}`}
                                                                >
                                                                    <div className="rounded-circle shadow-sm" style={{ width: '12px', height: '12px', background: t.bg }} />
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
                                <div className="mt-10 mx-auto w-full md:w-2/3 flex justify-center">
                                    <button
                                        className={`w-full flex items-center justify-center gap-3 text-lg font-semibold py-4 px-8 rounded-pill transition-all duration-300 ${isLoading ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-900 hover:bg-black text-white shadow-xl hover:shadow-2xl hover:-translate-y-1'}`}
                                        onClick={engineerBlueprint}
                                        disabled={isLoading || !topic.trim()}
                                        style={{ border: 'none' }}
                                    >
                                        {isLoading ? (
                                            <><Loader2 className="animate-spin" size={22} /> Synthesizing research...</>
                                        ) : (
                                            <><Sparkles className="w-5 h-5 text-purple-400" /> Architect Blueprint</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: THE BLUEPRINT */}
                    {
                        currentStep === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ duration: 0.4 }}
                                className="container py-5"
                                style={{ maxWidth: 800 }}
                            >
                                <div className="d-flex justify-content-between align-items-center mb-5">
                                    <div>
                                        <h2 className="fw-bold m-0 text-dark"><LayoutDashboard className="me-2 text-primary d-inline" /> Review Slide Deck Outline</h2>
                                        <p className="text-secondary mt-1">Refine the architecture before we write the final content.</p>
                                    </div>
                                    <button className="btn btn-outline-secondary rounded-pill" onClick={() => setCurrentStep(1)}>Go Back</button>
                                </div>

                                <div className="d-flex flex-column gap-3 mb-5">
                                    {blueprint.map((slide, index) => (
                                        <motion.div
                                            key={slide.slide_number}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="p-3 rounded-4 d-flex align-items-center gap-4 bg-white shadow-sm border border-dark border-opacity-10 hover-bg-light transition-all"
                                        >
                                            <div className="text-secondary fw-bold fs-4 ms-2" style={{ width: '40px' }}>{slide.slide_number}</div>
                                            <div className="flex-grow-1">
                                                <div className="d-flex align-items-center justify-content-between mb-2">
                                                    <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-3 py-1 fw-bold" style={{ fontSize: '0.7em' }}>
                                                        {slide.layout}
                                                    </span>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={slide.title}
                                                    onChange={(e) => handleUpdateBlueprintTitle(index, e.target.value)}
                                                    className="form-control bg-transparent border-0 text-dark fs-5 fw-medium p-0 shadow-none hide-focus"
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleDeleteBlueprint(index)}
                                                className="btn btn-link text-secondary hover-text-danger p-2 rounded-circle"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>

                                <button
                                    className="btn btn-primary w-100 btn-lg rounded-pill py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-lg text-white"
                                    onClick={generateStudioContent}
                                    disabled={isLoading}
                                    style={{ background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)', border: 'none' }}
                                >
                                    {isLoading ? (
                                        <><Loader2 className="spin" size={22} /> {loadingText}</>
                                    ) : (
                                        <>Looks Perfect <ArrowRight size={20} /> Generate Content</>
                                    )}
                                </button>
                            </motion.div>
                        )
                    }

                    {/* STEP 3: THE STUDIO */}
                    {
                        currentStep === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5 }}
                                className="d-flex flex-column flex-grow-1 overflow-hidden"
                            >
                                {/* Split Screen Layout */}
                                <div className="row g-0 flex-grow-1 bg-white" style={{ height: '0px' }}>
                                    {/* Left Panel: The Visualizer */}
                                    <div className="col-lg-8 h-100 d-flex flex-column p-4 border-end border-dark border-opacity-10 bg-slate-100">
                                        <div className="d-flex align-items-center justify-content-between mb-3 w-100 px-lg-5">
                                            <h5 className="fw-bold m-0 text-dark">Live Canvas Preview</h5>
                                            <div className="d-flex align-items-center gap-3">
                                                <button
                                                    onClick={toggleFullscreen}
                                                    className="btn btn-sm btn-dark rounded-pill px-3 py-1.5 flex items-center gap-2 shadow-lg"
                                                >
                                                    <Play size={14} fill="currentColor" /> Present Mode
                                                </button>
                                                <div className="badge bg-white text-dark fw-bold border border-dark border-opacity-10 py-2 px-3 rounded-pill shadow-sm">
                                                    Slide {activeSlideIndex + 1} of {finalSlides.length}
                                                </div>
                                            </div>
                                        </div>

                                        {/* The 16:9 Slides Canvas Container (Phase 7 & 8 Upgrade) */}
                                        <div className="flex-grow-1 d-flex align-items-center justify-content-center w-100 relative pt-4">
                                            <div
                                                id="presentation-canvas"
                                                className={`w-full aspect-video bg-white shadow-2xl rounded-xl overflow-hidden relative transition-all duration-300 ${isFullscreen ? 'rounded-none' : ''}`}
                                                style={{
                                                    maxWidth: isFullscreen ? 'none' : '850px',
                                                }}
                                            >
                                                {/* Presentation Mode Controls (Visible only in Fullscreen) */}
                                                {isFullscreen && (
                                                    <div className="absolute top-6 right-8 z-[100] flex gap-4 opacity-0 hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={toggleFullscreen}
                                                            className="bg-black/50 backdrop-blur-md text-white p-3 rounded-full hover:bg-black/70 transition-all border border-white/20"
                                                        >
                                                            <Minimize2 size={24} />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Header Accent Bar (Mimics native PPT layout) */}
                                                {!isFullscreen && (
                                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '1.5%', background: vStyles.accent, zIndex: 10 }} />
                                                )}

                                                {/* Play Button Overlay */}
                                                {!isFullscreen && !generatingIndex && (
                                                    <button
                                                        onClick={toggleFullscreen}
                                                        className="absolute top-4 right-4 z-20 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-2 rounded-lg border border-white/20 transition-all shadow-sm group"
                                                        title="Present (F)"
                                                    >
                                                        <Play size={18} fill="currentColor" />
                                                    </button>
                                                )}

                                                {/* If this specific slide is currently being generated */}
                                                {generatingIndex === activeSlideIndex ? (
                                                    <div className="absolute inset-0 bg-slate-950 flex flex-col p-8 z-10 font-mono">
                                                        {/* Matrix UI remains as-is for premium feedback */}
                                                        <div className="flex items-center gap-2 mb-4 border-bottom border-emerald-500/30 pb-2">
                                                            <div className="w-3 h-3 rounded-full bg-red-500/50" />
                                                            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                                                            <div className="w-3 h-3 rounded-full bg-green-500/50" />
                                                            <span className="text-emerald-500/50 text-xs ml-2">HOPE_STUDIO_OS v4.2.0</span>
                                                        </div>
                                                        <div className="flex-1 overflow-hidden">
                                                            <p className="text-emerald-500 mb-2">
                                                                <span className="opacity-50">$</span> tail -f /dev/ai_brain/output
                                                            </p>
                                                            <motion.div
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                className="text-emerald-400/80 leading-relaxed text-sm"
                                                            >
                                                                {`{
  "status": "processing",
  "slide_idx": ${generatingIndex},
  "tokens": 4096,
  "logic": "assertion_evidence_loop",
  "writing_assertion": "${blueprint[generatingIndex]?.title || '... '}",
  "fetching_evidence": [ 
    "verifying_sources",
    "checking_slide_constraints",
    "rendering_html" 
  ]
}`}
                                                                <motion.span
                                                                    animate={{ opacity: [0, 1, 0] }}
                                                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                                                    className="inline-block w-2 h-4 bg-emerald-400 ml-1 align-middle"
                                                                />
                                                            </motion.div>
                                                        </div>
                                                        <div className="mt-4 flex items-center gap-4 text-emerald-500/40 text-xs">
                                                            <span className="animate-pulse">● SYNTHESIZING DATA...</span>
                                                            <span className="ml-auto">LATENCY: 42ms</span>
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
                                                            className="w-full h-full flex flex-col relative"
                                                        >
                                                            <SlideRenderer slideData={finalSlides[activeSlideIndex]} />
                                                        </motion.div>
                                                    </AnimatePresence>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bottom Ribbon (Regenerate added Phase 3) */}
                                        <div className="d-flex flex-column mt-3">
                                            {/* Regenerate Button Overlay */}
                                            <div className="d-flex justify-content-end mb-2 pe-4">
                                                <button
                                                    onClick={() => handleRegenerateSlide(activeSlideIndex)}
                                                    disabled={isLoading}
                                                    className="btn btn-sm btn-outline-secondary rounded-pill d-flex align-items-center gap-1 hover-bg-light fw-medium bg-white shadow-sm"
                                                >
                                                    {isLoading ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
                                                    Regenerate Slide {activeSlideIndex + 1}
                                                </button>
                                            </div>

                                            <div className="d-flex overflow-auto pb-2 gap-3 custom-scrollbar hide-scrollbar" style={{ height: '90px', flexShrink: 0 }}>
                                                {blueprint.map((slide, i) => {
                                                    const isGenerated = finalSlides.length > i;
                                                    const isGeneratingNow = generatingIndex === i;

                                                    return (
                                                        <div
                                                            key={i}
                                                            onClick={() => setActiveSlideIndex(i)}
                                                            className={`rounded-3 cursor-pointer overflow-hidden border transition-all flex-shrink-0 
                                                                ${isGenerated ? 'bg-white border-slate-300' : 'bg-slate-50 border-dashed border-slate-200'}
                                                                ${activeSlideIndex === i ? 'ring-2 ring-primary shadow-sm scale-105 border-primary' : 'opacity-75 hover-opacity-100'}
                                                                ${isGeneratingNow ? 'border-purple-500 ring-2 ring-purple-500/20' : ''}
                                                            `}
                                                            style={{ width: '130px', height: '100%', background: isGenerated ? vStyles.bg : '#f8fafc', color: isGenerated ? vStyles.text : '#94a3b8' }}
                                                        >
                                                            <div className="w-100 h-100 d-flex flex-column p-2 relative">
                                                                <div className="small fw-bold text-truncate" style={{ fontSize: '0.65rem', color: isGenerated ? vStyles.accent : '#94a3b8' }}>{slide.layout}</div>
                                                                <div className="fw-medium text-truncate mt-1" style={{ fontSize: '0.75rem' }}>{isGenerated ? finalSlides[i]?.title : slide.title}</div>
                                                                {/* Mini Accent Bar Indicator */}
                                                                {isGenerated && <div className="position-absolute bottom-0 start-0 w-100" style={{ height: '2px', background: vStyles.accent }} />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Panel: Advanced Control Deck (Phase 7 Overhaul) */}
                                    <div className="col-lg-4 h-100 bg-white d-flex flex-column border-start border-slate-100">
                                        {/* Tab Headers */}
                                        <div className="d-flex border-bottom border-slate-100 p-2">
                                            <button
                                                onClick={() => setActiveTab('copilot')}
                                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-bold text-sm ${activeTab === 'copilot' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                <MessageSquare size={16} /> AI Co-Pilot
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('export')}
                                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-bold text-sm ${activeTab === 'export' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                <Paintbrush size={16} /> Style & Export
                                            </button>
                                        </div>

                                        <div className="flex-1 flex flex-col overflow-hidden p-6">
                                            <AnimatePresence mode="wait">
                                                {activeTab === 'copilot' ? (
                                                    <motion.div
                                                        key="copilot"
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -20 }}
                                                        className="flex-1 flex flex-col h-100"
                                                    >
                                                        <div className="mb-4">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <h5 className="font-bold text-slate-900">Editing Slide {activeSlideIndex + 1}</h5>
                                                                <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">Active Context</span>
                                                            </div>
                                                            <p className="text-xs text-slate-500">Ask the co-pilot to rewrite, simplify, or improve this specific slide.</p>
                                                        </div>

                                                        {/* Chat History */}
                                                        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                                                            {coPilotHistory.length === 0 && (
                                                                <div className="h-100 flex flex-col items-center justify-center text-center p-6 opacity-30">
                                                                    <Sparkles size={48} className="mb-4 text-slate-300" />
                                                                    <p className="text-sm font-medium">No edits requested yet.<br />Try: "Make the bullets shorter"</p>
                                                                </div>
                                                            )}
                                                            {coPilotHistory.map((chat, idx) => (
                                                                <div key={idx} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${chat.role === 'user' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-100 text-slate-800'} shadow-sm`}>
                                                                        {chat.content}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {isCoPilotLoading && (
                                                                <div className="flex justify-start">
                                                                    <div className="bg-slate-100 p-3 rounded-2xl flex gap-2">
                                                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                                                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-.3s]" />
                                                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-.5s]" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Input Area */}
                                                        <div className="relative mt-auto">
                                                            <input
                                                                type="text"
                                                                value={coPilotMessage}
                                                                onChange={e => setCoPilotMessage(e.target.value)}
                                                                onKeyDown={e => e.key === 'Enter' && editSlideWithAI()}
                                                                placeholder="Type instructions..."
                                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-5 pr-14 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                                                            />
                                                            <button
                                                                onClick={editSlideWithAI}
                                                                disabled={!coPilotMessage.trim() || isCoPilotLoading}
                                                                className="absolute right-2 top-2 bottom-2 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                            >
                                                                <Send size={18} />
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                ) : (
                                                    <motion.div
                                                        key="export"
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -20 }}
                                                        className="flex-1 flex flex-col h-100"
                                                    >
                                                        <h5 className="font-bold text-slate-900 mb-6 border-bottom border-slate-100 pb-3">Final Style & Compilation</h5>

                                                        <div className="mb-8">
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 d-block">Presentation Theme</label>
                                                            <div className="space-y-3">
                                                                {[
                                                                    { id: 'dark', name: 'Phantom Dark', bg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', text: 'white' },
                                                                    { id: 'corporate', name: 'Cloud Light', bg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', text: '#0f172a' },
                                                                ].map(t => (
                                                                    <div
                                                                        key={t.id}
                                                                        onClick={() => setTheme(t.id)}
                                                                        className={`p-4 rounded-xl cursor-pointer border transition-all d-flex align-items-center justify-content-between ${theme === t.id ? 'border-slate-900 bg-slate-50 shadow-md ring-4 ring-slate-900/5' : 'border-slate-100 opacity-75 hover:opacity-100 bg-white hover:bg-slate-50'}`}
                                                                    >
                                                                        <div className="d-flex align-items-center gap-3">
                                                                            <div className="rounded-circle shadow-sm" style={{ width: '20px', height: '20px', background: t.bg }} />
                                                                            <div className="font-bold text-slate-800">{t.name}</div>
                                                                        </div>
                                                                        {theme === t.id && <CheckCircle size={18} className="text-slate-900" />}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="mt-auto pt-6 border-top border-slate-100">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auto-Save Status</span>
                                                                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                                                        <CheckCircle size={10} /> Saved to drafts {lastSaved && `@ ${lastSaved}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={handleDownload}
                                                                disabled={isDownloading || !isGenerationComplete}
                                                                className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-xl ${isDownloading || !isGenerationComplete ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 hover:bg-black text-white hover:-translate-y-1'}`}
                                                            >
                                                                {isDownloading ? (
                                                                    <><Loader2 className="animate-spin" size={22} /> Compiling Deck...</>
                                                                ) : (
                                                                    <><Download size={22} /> DOWNLOAD .PPTX</>
                                                                )}
                                                            </button>
                                                            <p className="text-[10px] text-center text-slate-400 mt-4 px-4">Coordinates are fixed to 16:9 viewport to ensure pixel-perfect export.</p>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div >
                            </motion.div >
                        )
                    }

                </AnimatePresence >
            </main >
        </div >
    );
};

export default PresentationGenerator;
