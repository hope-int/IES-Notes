import React, { useState, useEffect } from 'react';
import { useInteractionStore } from '../../stores/useInteractionStore';
import { useAnalyticsStore } from '../../stores/useAnalyticsStore';
import { eventBus } from '../events/EventBus';
import { lessonEngine } from '../lessonEngine/LessonEngine';

const InteractionEngine = () => {
    const { activeInteraction, submitResponse, clearInteraction } = useInteractionStore();
    const { logQuizScore, logLatency } = useAnalyticsStore();
    const [selectedOption, setSelectedOption] = useState(null);
    const [sliderVal, setSliderVal] = useState(3);
    const [startTime, setStartTime] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);

    const [simulating, setSimulating] = useState(false);
    const [simConsoleOutput, setSimConsoleOutput] = useState('');
    const [blankInput, setBlankInput] = useState('');
    const [blankChecked, setBlankChecked] = useState(false);
    const [blankIsCorrect, setBlankIsCorrect] = useState(false);

    useEffect(() => {
        if (activeInteraction) {
            setStartTime(Date.now());
            setSelectedOption(null);
            setShowResult(false);
            setIsCorrect(false);
            setSimulating(false);
            setSimConsoleOutput('');
            setBlankInput('');
            setBlankChecked(false);
            setBlankIsCorrect(false);
        }
    }, [activeInteraction]);

    if (!activeInteraction) return null;

    const handleSubmit = (val) => {
        const latency = Date.now() - startTime;
        logLatency(latency);
        
        let correct = false;
        if (activeInteraction.type === 'quiz') {
            correct = val === activeInteraction.payload.answer;
            setIsCorrect(correct);
            logQuizScore(activeInteraction.id, correct ? 100 : 0);
            setShowResult(true);
        } else {
            submitResponse({ value: val, latency });
            eventBus.dispatch({
                type: 'COMPLETED_INTERACTION',
                payload: { value: val },
                metadata: { itemId: activeInteraction.id }
            });
            clearInteraction();
        }
    };

    const handleQuizNext = () => {
        submitResponse({ value: selectedOption, isCorrect, latency: Date.now() - startTime });
        
        eventBus.dispatch({
            type: 'COMPLETED_INTERACTION',
            payload: { value: selectedOption, isCorrect },
            metadata: { itemId: activeInteraction.id }
        });
        
        if (!isCorrect && activeInteraction.payload) {
            lessonEngine.injectAnalogiesOrPrerequisites(
                activeInteraction.payload.question,
                selectedOption
            );
        }

        clearInteraction();
    };

    const handleStartSimulation = () => {
        setSimulating(true);
        setSimConsoleOutput('');
        
        const output = activeInteraction.payload.expectedOutput || 'Simulation completed with return code 0';
        let currentText = '';
        let i = 0;
        
        const interval = setInterval(() => {
            if (i < output.length) {
                const chunkSize = Math.max(1, Math.ceil(output.length / 15));
                currentText += output.slice(i, i + chunkSize);
                setSimConsoleOutput(currentText);
                i += chunkSize;
            } else {
                setSimConsoleOutput(output);
                setSimulating(false);
                clearInterval(interval);
            }
        }, 80);
    };

    const handleBlankSubmit = () => {
        const isAnswerCorrect = blankInput.trim().toLowerCase() === (activeInteraction.payload.blankAnswer || '').trim().toLowerCase();
        setBlankIsCorrect(isAnswerCorrect);
        setBlankChecked(true);
        logQuizScore(activeInteraction.id, isAnswerCorrect ? 100 : 0);
    };

    const handleBlankNext = () => {
        submitResponse({ value: blankInput, isCorrect: blankIsCorrect, latency: Date.now() - startTime });
        
        eventBus.dispatch({
            type: 'COMPLETED_INTERACTION',
            payload: { value: blankInput, isCorrect: blankIsCorrect },
            metadata: { itemId: activeInteraction.id }
        });
        
        clearInteraction();
    };

    const getInteractionTitle = () => {
        switch (activeInteraction.type) {
            case 'quiz': return '🧠 Concept Check';
            case 'code_simulation': return '💻 Code Simulation';
            case 'fill_in_the_blank': return '✍️ Fill in the Blank';
            case 'attention_check': return '📡 Telemetry Probe';
            default: return '⚡ Telemetry Probe';
        }
    };

    return (
        <div className="card border border-primary border-opacity-25 rounded-4 shadow-lg p-4 bg-white animate-fade-in max-w-md mx-auto my-3 text-dark">
            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-1 text-uppercase tracking-wide font-monospace" style={{ fontSize: '0.75rem' }}>
                    {getInteractionTitle()}
                </span>
                <span className="text-secondary small">Live Engagement</span>
            </div>

            {/* MCQ Quiz rendering */}
            {activeInteraction.type === 'quiz' && (
                <div>
                    <h5 className="fw-bold text-slate-800 mb-4">{activeInteraction.payload.question}</h5>
                    
                    {!showResult ? (
                        <div className="d-grid gap-2">
                            {activeInteraction.payload.options.map((option, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedOption(option)}
                                    className={`btn text-start p-3 rounded-3 border transition-all ${
                                        selectedOption === option 
                                            ? 'btn-primary border-primary text-white' 
                                            : 'btn-outline-secondary border-secondary-subtle bg-slate-50 text-slate-700 hover-bg-light'
                                    }`}
                                >
                                    <span className="fw-semibold me-2">{String.fromCharCode(65 + idx)}.</span>
                                    {option}
                                </button>
                            ))}
                            
                            <button
                                disabled={!selectedOption}
                                onClick={() => handleSubmit(selectedOption)}
                                className="btn btn-primary rounded-pill py-2.5 mt-3 fw-semibold shadow-sm text-white"
                            >
                                Submit Response
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-2 animate-scale-up">
                            <div className="display-4 mb-3">{isCorrect ? '🎉' : '💡'}</div>
                            <h4 className={`fw-bold ${isCorrect ? 'text-success' : 'text-warning'}`}>
                                {isCorrect ? 'Excellent Work!' : 'Not Quite Right'}
                            </h4>
                            <p className="text-muted small mt-2 px-3">
                                {isCorrect 
                                    ? 'You mastered this concept perfectly. Let\'s continue.' 
                                    : activeInteraction.payload.explanation || 'Let\'s review this concept real quick to clear up any confusion.'}
                            </p>
                            <button
                                onClick={handleQuizNext}
                                className="btn btn-primary rounded-pill px-5 py-2 mt-4 text-white"
                            >
                                {isCorrect ? 'Continue Session' : 'Get Quick Review'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Slider / Confidence Probe */}
            {activeInteraction.type === 'slider' && (
                <div className="text-center py-2">
                    <h5 className="fw-bold text-slate-800 mb-4">{activeInteraction.payload.label || 'How clear is this concept?'}</h5>
                    
                    <div className="d-flex justify-content-between text-muted small px-2 mb-2">
                        <span>Very Confused</span>
                        <span>Clear</span>
                        <span>Fully Mastered</span>
                    </div>
                    
                    <input 
                        type="range" 
                        min="1" 
                        max="5" 
                        value={sliderVal}
                        onChange={(e) => setSliderVal(Number(e.target.value))}
                        className="form-range custom-slider mb-4"
                    />

                    <div className="display-3 mb-4">{['🤔', '😐', '🙂', '😊', '🚀'][sliderVal - 1]}</div>

                    <button
                        onClick={() => handleSubmit(sliderVal)}
                        className="btn btn-primary rounded-pill w-100 py-2.5 fw-semibold text-white"
                    >
                        Submit Pacing Signal
                    </button>
                </div>
            )}

            {/* Code Simulation */}
            {activeInteraction.type === 'code_simulation' && (
                <div>
                    <h5 className="fw-bold text-slate-800 mb-2">Code Compilation sandbox</h5>
                    <p className="text-secondary small mb-3">Execute the code below to see compiling output trace in the runtime console.</p>
                    
                    <div className="bg-light border rounded-3 p-3 mb-3 font-monospace position-relative" style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                        <span className="position-absolute top-0 end-0 m-2 badge bg-secondary-subtle text-secondary text-uppercase">{activeInteraction.payload.language || 'python'}</span>
                        <code className="text-dark">{activeInteraction.payload.code}</code>
                    </div>

                    {simConsoleOutput && (
                        <div className="bg-dark text-white rounded-3 p-3 font-monospace mb-3 animate-fade-in" style={{ fontSize: '0.8rem', minHeight: '80px' }}>
                            <div className="d-flex align-items-center gap-2 text-warning mb-1">
                                {simulating && <span className="spinner-border spinner-border-sm" role="status"></span>}
                                <span className={simulating ? 'text-warning' : 'text-success'}>
                                    {simulating ? 'Running sandbox simulation...' : '✓ Execution Succeeded'}
                                </span>
                            </div>
                            <hr className="border-secondary my-1" />
                            <pre className="m-0 text-light" style={{ whiteSpace: 'pre-wrap' }}>{simConsoleOutput}</pre>
                        </div>
                    )}

                    {!simConsoleOutput && !simulating ? (
                        <button
                            onClick={handleStartSimulation}
                            className="btn btn-primary rounded-pill w-100 py-2.5 fw-semibold text-white d-flex align-items-center justify-content-center gap-2"
                        >
                            <span>▶ Run Simulation</span>
                        </button>
                    ) : !simulating ? (
                        <button
                            onClick={() => handleSubmit(true)}
                            className="btn btn-success rounded-pill w-100 py-2.5 fw-semibold text-white"
                        >
                            Continue Session
                        </button>
                    ) : null}
                </div>
            )}

            {/* Fill in the Blank */}
            {activeInteraction.type === 'fill_in_the_blank' && (
                <div>
                    <h5 className="fw-bold text-slate-800 mb-3">{activeInteraction.payload.question}</h5>
                    
                    {!blankChecked ? (
                        <div>
                            <input 
                                type="text"
                                value={blankInput}
                                onChange={(e) => setBlankInput(e.target.value)}
                                placeholder="Type your answer here..."
                                className="form-control mb-3 border-primary border-opacity-30"
                            />
                            <button
                                disabled={!blankInput.trim()}
                                onClick={handleBlankSubmit}
                                className="btn btn-primary rounded-pill w-100 py-2.5 fw-semibold text-white"
                            >
                                Submit Answer
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-2 animate-scale-up">
                            <div className="display-4 mb-3">{blankIsCorrect ? '🎉' : '💡'}</div>
                            <h4 className={`fw-bold ${blankIsCorrect ? 'text-success' : 'text-warning'}`}>
                                {blankIsCorrect ? 'Correct!' : 'Incorrect'}
                            </h4>
                            <p className="text-muted small mt-2">
                                Correct Answer: <strong className="text-dark font-monospace">{activeInteraction.payload.blankAnswer}</strong>
                            </p>
                            <button
                                onClick={handleBlankNext}
                                className="btn btn-primary rounded-pill px-5 py-2 mt-4 text-white"
                            >
                                Continue
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Attention Check / Telemetry Probe */}
            {activeInteraction.type === 'attention_check' && (
                <div className="text-center py-2">
                    <h5 className="fw-bold text-slate-800 mb-3">Attention Telemetry Check</h5>
                    <p className="text-secondary small mb-4">Click the button below to verify you are currently active and listening to the presentation.</p>
                    
                    <button
                        onClick={() => handleSubmit(true)}
                        className="btn btn-primary rounded-pill w-100 py-3 fw-semibold text-white shadow-sm d-flex align-items-center justify-content-center gap-2 animate-pulse"
                    >
                        <span>🛡️ I am Paying Attention</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default InteractionEngine;
