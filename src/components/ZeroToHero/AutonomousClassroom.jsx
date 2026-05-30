import React, { useState, useEffect } from 'react';
import { Zap, Play, Pause } from 'lucide-react';
import Whiteboard from '../../core/whiteboard/Whiteboard';
import InteractionEngine from '../../core/interactions/InteractionEngine';
import CognitiveDashboard from '../../core/analytics/CognitiveDashboard';
import { queueEngine } from '../../core/queue/QueueEngine';
import { audioManager } from '../../core/audio/AudioManager';
import { personalizationEngine } from '../../core/personalization/PersonalizationEngine';
import { useLearningSessionStore } from '../../stores/useLearningSessionStore';
import { useQueueStore } from '../../stores/useQueueStore';
import { useInteractionStore } from '../../stores/useInteractionStore';
import { useWhiteboardStore } from '../../stores/useWhiteboardStore';
import { eventBus } from '../../core/events/EventBus';
import { sessionCompiler } from '../../core/compiler/SessionCompiler';
import { runtimeTimelineController } from '../../core/timeline/RuntimeTimelineController';
import { extractTextFromFile, chunkText } from '../../utils/DocumentChunker';
import RuntimeDebugPanel from './RuntimeDebugPanel';

const AutonomousClassroom = ({ profile }) => {
    const [topicInput, setTopicInput] = useState('');
    const [subtitles, setSubtitles] = useState('Initiate a topic to start the autonomous learning session...');
    const [pacingMultiplier, setPacingMultiplier] = useState(1.0);
    const [rightTab, setRightTab] = useState('telemetry'); // 'telemetry' | 'diagnostics'

    const [uploadedChunks, setUploadedChunks] = useState([]);
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [classDuration, setClassDuration] = useState(5);
    const [isUploading, setIsUploading] = useState(false);

    const { sessionStatus } = useLearningSessionStore();
    const { activeInteraction } = useInteractionStore();

    // Event stream subscriptions
    useEffect(() => {
        useWhiteboardStore.getState().clearWhiteboard();

        const subIntro = eventBus.subscribe('RUN_INTRO', (e) => {
            setSubtitles(e.payload.text);
            audioManager.playNarration(e.payload.text);
        });

        const subConcept = eventBus.subscribe('RUN_CONCEPT_EXPLANATION', (e) => {
            setSubtitles(e.payload.explanation);
            audioManager.playNarration(e.payload.explanation);
            eventBus.dispatch({
                type: 'DRAW_TEXT',
                payload: {
                    id: e.metadata.itemId,
                    text: `Key Concept:\n${e.payload.concept}`,
                    x: 60, y: 80,
                    fontSize: 22,
                    color: '#1e3a8a',
                    duration: 2000
                }
            });
        });

        const subEquation = eventBus.subscribe('RUN_EQUATION', (e) => {
            setSubtitles(e.payload.explanation);
            audioManager.playNarration(e.payload.explanation);
            useWhiteboardStore.getState().setEquation(e.payload.latex);
        });

        const subDiagram = eventBus.subscribe('RUN_DIAGRAM', (e) => {
            setSubtitles(e.payload.explanation);
            audioManager.playNarration(e.payload.explanation);
            useWhiteboardStore.getState().setDiagram(e.payload.mermaid);
        });

        const subQuiz = eventBus.subscribe('RUN_QUIZ', (e) => {
            setSubtitles(e.payload.question);
            audioManager.playNarration(e.payload.question);
            useInteractionStore.getState().showInteraction({
                id: e.metadata.itemId,
                type: 'quiz',
                payload: e.payload
            });
        });

        const subSummary = eventBus.subscribe('RUN_SUMMARY', (e) => {
            setSubtitles(e.payload.text);
            audioManager.playNarration(e.payload.text);
        });

        const subAudioDone = eventBus.subscribe('AUDIO_PLAYBACK_COMPLETE', () => {
            const activeItem = queueEngine.activeItem$.value;
            if (activeItem && activeItem.type !== 'quiz' && activeItem.type !== 'code_simulation') {
                eventBus.dispatch({
                    type: `COMPLETED_${activeItem.type.toUpperCase()}`,
                    metadata: { itemId: activeItem.id }
                });
            }
        });

        const subQuizDone = eventBus.subscribe('COMPLETED_INTERACTION', (e) => {
            const activeItem = queueEngine.activeItem$.value;
            if (activeItem && (activeItem.type === 'quiz' || activeItem.type === 'code_simulation')) {
                eventBus.dispatch({
                    type: `COMPLETED_${activeItem.type.toUpperCase()}`,
                    metadata: { itemId: activeItem.id }
                });
                if (activeItem.type === 'quiz') {
                    personalizationEngine.recordTelemetryResult(
                        activeItem.payload.question,
                        e.payload.isCorrect,
                        e.payload.latency
                    );
                }
            }
        });

        const subCodeSim = eventBus.subscribe('RUN_CODE_SIMULATION', (e) => {
            setSubtitles('Executing code simulation: ' + (e.payload.explanation || ''));
            audioManager.playNarration(e.payload.explanation || "Let's run a code simulation to demonstrate this concept.");
            useInteractionStore.getState().showInteraction({
                id: e.metadata.itemId,
                type: 'code_simulation',
                payload: e.payload
            });
        });

        const subGraphPlot = eventBus.subscribe('RUN_GRAPH_PLOT', (e) => {
            setSubtitles('Plotting mathematical graph: ' + (e.payload.explanation || ''));
            audioManager.playNarration(e.payload.explanation || "Let's plot the graph to visualize the mathematical function.");
            eventBus.dispatch({
                type: 'RUN_GRAPH_RENDER',
                payload: {
                    equation: e.payload.latexEquation,
                    formula: e.payload.functionFormula,
                    explanation: e.payload.explanation
                }
            });
        });

        return () => {
            subIntro();
            subConcept();
            subEquation();
            subDiagram();
            subQuiz();
            subSummary();
            subAudioDone();
            subQuizDone();
            subCodeSim();
            subGraphPlot();
            audioManager.stop();
            queueEngine.pause();
        };
    }, []);

    const handleDocumentUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        setSubtitles(`Ingesting document: ${file.name}...`);
        try {
            const rawText = await extractTextFromFile(file);
            const chunks = chunkText(rawText);
            setUploadedChunks(chunks);
            setUploadedFileName(file.name);
            setSubtitles(`Ingested and split ${file.name} into ${chunks.length} AI-readable chunks.`);
        } catch (err) {
            console.error('Failed to ingest document:', err);
            setSubtitles(`Ingestion failed: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleStartRuntimeSession = async () => {
        const queryTopic = topicInput.trim() || (uploadedFileName ? `Document: ${uploadedFileName}` : '');
        if (!queryTopic) {
            setSubtitles('Please enter a syllabus topic or upload a document to begin.');
            return;
        }
        setSubtitles('Synthesizing and compiling custom adaptive educational DAG graph...');
        try {
            await sessionCompiler.compile(queryTopic, profile.student_profile, {
                documentChunks: uploadedChunks,
                classDurationMinutes: classDuration
            });
            setSubtitles('Session Compiled successfully! Activating authoritative clock timeline.');
            runtimeTimelineController.start();
            setTopicInput('');
        } catch (err) {
            setSubtitles('Failed to compile learning session: ' + err.message);
        }
    };

    const handlePacingChange = (newVal) => {
        setPacingMultiplier(newVal);
        queueEngine.setPacingRate(newVal);
    };

    return (
        <div className="flex-grow-1 overflow-auto p-4 custom-scrollbar" style={{ height: 'calc(100vh - 80px)' }}>
            <div className="container-fluid max-w-7xl">

                {/* Control Bar & Document Ingestion */}
                <div className="bg-white border rounded-4 p-4 shadow-sm mb-4">
                    <div className="row g-3 align-items-center">
                        <div className="col-lg-4">
                            <label className="form-label small fw-bold text-secondary text-uppercase mb-1">Target Concept or Topic</label>
                            <input
                                type="text"
                                value={topicInput}
                                onChange={(e) => setTopicInput(e.target.value)}
                                placeholder={uploadedFileName ? `Learn from ${uploadedFileName}` : 'e.g. Logic Gates, Heap Sort...'}
                                className="form-control border-1 rounded-3 px-3 py-2 bg-light text-dark font-medium"
                                disabled={isUploading}
                            />
                        </div>

                        <div className="col-lg-3">
                            <label className="form-label small fw-bold text-secondary text-uppercase mb-1">Document Context</label>
                            <div className="d-flex align-items-center gap-2">
                                <label className="btn btn-outline-secondary rounded-3 px-3 py-2 w-100 text-truncate d-flex align-items-center justify-content-center gap-2 cursor-pointer mb-0 font-medium" style={{ fontSize: '0.9rem' }}>
                                    <span>{isUploading ? 'Ingesting...' : uploadedFileName ? `📄 ${uploadedFileName.slice(0, 12)}...` : '📤 Upload Doc'}</span>
                                    <input
                                        type="file"
                                        accept=".pdf,.txt,.md,.csv"
                                        onChange={handleDocumentUpload}
                                        className="d-none"
                                        disabled={isUploading}
                                    />
                                </label>
                                {uploadedFileName && (
                                    <button
                                        onClick={() => { setUploadedChunks([]); setUploadedFileName(''); }}
                                        className="btn btn-outline-danger px-2 py-2 rounded-3 d-flex align-items-center justify-content-center"
                                        title="Clear document context"
                                    >✕</button>
                                )}
                            </div>
                        </div>

                        <div className="col-lg-3">
                            <div className="px-2">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <label className="form-label small fw-bold text-secondary text-uppercase mb-0">Class Duration</label>
                                    <span className="badge bg-primary rounded-pill font-mono">{classDuration} min</span>
                                </div>
                                <input
                                    type="range" min="3" max="30" step="1"
                                    value={classDuration}
                                    onChange={(e) => setClassDuration(parseInt(e.target.value))}
                                    className="form-range w-100"
                                    disabled={isUploading}
                                />
                            </div>
                        </div>

                        <div className="col-lg-2">
                            <label className="form-label d-none d-lg-block mb-1">&nbsp;</label>
                            <button
                                onClick={handleStartRuntimeSession}
                                className="btn btn-primary rounded-3 w-100 py-2 fw-bold text-white shadow-sm d-flex align-items-center justify-content-center gap-2"
                                disabled={isUploading || (!topicInput.trim() && !uploadedFileName)}
                            >
                                <Zap size={16} />
                                <span>Start Live</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub Control Bar: Pacing & Status */}
                <div className="bg-white border rounded-4 p-3 shadow-sm mb-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div className="d-flex align-items-center gap-2">
                        <button
                            onClick={() => {
                                if (queueEngine.status$.value === 'running') {
                                    queueEngine.pause();
                                    runtimeTimelineController.pause();
                                } else {
                                    queueEngine.resume();
                                    runtimeTimelineController.start();
                                }
                            }}
                            className="btn btn-outline-primary rounded-circle p-2 d-flex align-items-center justify-content-center"
                            style={{ width: 40, height: 40 }}
                            disabled={sessionStatus === 'idle' || sessionStatus === 'compiling' || sessionStatus === 'failed'}
                        >
                            {sessionStatus === 'running' ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        <span className="fw-semibold text-slate-700 capitalize">Status: {sessionStatus}</span>
                    </div>
                    <div className="d-flex align-items-center gap-3">
                        <span className="text-slate-600 small text-semibold text-nowrap">Pacing Rate: {pacingMultiplier}x</span>
                        <input
                            type="range" min="0.5" max="2.0" step="0.1"
                            value={pacingMultiplier}
                            onChange={(e) => handlePacingChange(parseFloat(e.target.value))}
                            className="form-range"
                            style={{ width: 100 }}
                            disabled={sessionStatus === 'idle' || sessionStatus === 'compiling' || sessionStatus === 'failed'}
                        />
                    </div>
                </div>

                {/* Core Workspace Grid */}
                <div className="row g-4">
                    {/* Left: Whiteboard + Subtitles */}
                    <div className="col-lg-7">
                        <div className="d-flex flex-column gap-3">
                            <Whiteboard width={700} height={420} />
                            <div className="bg-white border rounded-4 p-4 shadow-sm relative min-h-[100px] border-primary border-opacity-10">
                                <div className="absolute top-0 left-0 mt-[-10px] ml-4 bg-primary text-white text-xs px-2 py-1 rounded-full font-mono fw-bold">
                                    NARRATOR VOICE
                                </div>
                                <p className="lead fw-semibold text-slate-800 m-0">{subtitles}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Interaction + Analytics */}
                    <div className="col-lg-5">
                        <div className="d-flex flex-column gap-4">
                            {activeInteraction ? (
                                <InteractionEngine />
                            ) : (
                                <div className="bg-white border rounded-4 p-5 text-center shadow-sm text-muted">
                                    <div className="display-6 mb-3">📡</div>
                                    <h6 className="fw-bold text-slate-700">Waiting for Concept Telemetry Probe</h6>
                                    <p className="small mb-0">Quizzes, concept checks, and pacing signals will appear here dynamically as you listen to the session.</p>
                                </div>
                            )}

                            <div className="d-flex justify-content-center bg-light p-1 rounded-3 border border-light-subtle">
                                <button
                                    onClick={() => setRightTab('telemetry')}
                                    className={`btn btn-sm flex-grow-1 rounded-3 py-1 fw-bold transition-all border-0 ${rightTab === 'telemetry' ? 'bg-white text-primary shadow-sm' : 'text-secondary bg-transparent'}`}
                                >
                                    📊 Telemetry
                                </button>
                                <button
                                    onClick={() => setRightTab('diagnostics')}
                                    className={`btn btn-sm flex-grow-1 rounded-3 py-1 fw-bold transition-all border-0 ${rightTab === 'diagnostics' ? 'bg-white text-primary shadow-sm' : 'text-secondary bg-transparent'}`}
                                >
                                    ⚙️ Diagnostics
                                </button>
                            </div>

                            {rightTab === 'telemetry' ? <CognitiveDashboard /> : <RuntimeDebugPanel />}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AutonomousClassroom;
