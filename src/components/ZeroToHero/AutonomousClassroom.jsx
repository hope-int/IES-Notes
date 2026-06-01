import React, { useState, useEffect } from 'react';
import { Zap, Play, Pause, UploadCloud, X, Radio, BarChart3, Settings2, Signal, TimerReset } from 'lucide-react';
import Whiteboard from '../../core/whiteboard/Whiteboard';
import InteractionEngine from '../../core/interactions/InteractionEngine';
import CognitiveDashboard from '../../core/analytics/CognitiveDashboard';
import { queueEngine } from '../../core/queue/QueueEngine';
import { audioManager } from '../../core/audio/AudioManager';
import { personalizationEngine } from '../../core/personalization/PersonalizationEngine';
import { useLearningSessionStore } from '../../stores/useLearningSessionStore';
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
        <div className="zth-classroom flex-grow-1 overflow-auto custom-scrollbar theme-page">
            <div className="zth-classroom-inner">

                {/* Control Bar & Document Ingestion */}
                <div className="zth-runtime-control">
                    <div className="zth-runtime-control-grid">
                        <div className="zth-field-group zth-topic-field">
                            <label>Target Concept or Topic</label>
                            <input
                                type="text"
                                value={topicInput}
                                onChange={(e) => setTopicInput(e.target.value)}
                                placeholder={uploadedFileName ? `Learn from ${uploadedFileName}` : 'e.g. Logic Gates, Heap Sort...'}
                                className="theme-input"
                                disabled={isUploading}
                            />
                        </div>

                        <div className="zth-field-group">
                            <label>Document Context</label>
                            <div className="zth-upload-row">
                                <label className="zth-upload-button">
                                    <UploadCloud size={17} />
                                    <span>{isUploading ? 'Ingesting...' : uploadedFileName ? uploadedFileName : 'Upload document'}</span>
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
                                        className="zth-clear-file"
                                        title="Clear document context"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="zth-field-group">
                            <div className="zth-range-label">
                                <label>Class Duration</label>
                                <span><TimerReset size={13} />{classDuration} min</span>
                            </div>
                            <input
                                type="range" min="3" max="30" step="1"
                                value={classDuration}
                                onChange={(e) => setClassDuration(parseInt(e.target.value))}
                                className="form-range zth-range"
                                disabled={isUploading}
                            />
                        </div>

                        <div className="zth-field-action">
                            <button
                                onClick={handleStartRuntimeSession}
                                className="zth-start-live"
                                disabled={isUploading || (!topicInput.trim() && !uploadedFileName)}
                            >
                                <Zap size={16} />
                                <span>Start Live</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub Control Bar: Pacing & Status */}
                <div className="zth-runtime-status">
                    <div className="zth-status-left">
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
                            className="zth-play-button"
                            disabled={sessionStatus === 'idle' || sessionStatus === 'compiling' || sessionStatus === 'failed'}
                        >
                            {sessionStatus === 'running' ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        <span><Radio size={15} />Status: {sessionStatus}</span>
                    </div>
                    <div className="zth-pacing">
                        <span><Signal size={15} />Pacing Rate: {pacingMultiplier}x</span>
                        <input
                            type="range" min="0.5" max="2.0" step="0.1"
                            value={pacingMultiplier}
                            onChange={(e) => handlePacingChange(parseFloat(e.target.value))}
                            className="form-range zth-range"
                            disabled={sessionStatus === 'idle' || sessionStatus === 'compiling' || sessionStatus === 'failed'}
                        />
                    </div>
                </div>

                {/* Core Workspace Grid */}
                <div className="zth-runtime-grid">
                    {/* Left: Whiteboard + Subtitles */}
                    <div className="zth-runtime-left">
                        <div className="zth-whiteboard-shell">
                            <Whiteboard width={700} height={420} />
                        </div>
                        <div className="zth-narrator-card">
                            <div>
                                <Radio size={14} />
                                Narrator Voice
                            </div>
                            <p>{subtitles}</p>
                        </div>
                    </div>

                    {/* Right: Interaction + Analytics */}
                    <div className="zth-runtime-right">
                            {activeInteraction ? (
                                <InteractionEngine />
                            ) : (
                                <div className="zth-probe-card">
                                    <Signal size={34} />
                                    <h6>Waiting for Concept Telemetry Probe</h6>
                                    <p>Quizzes, concept checks, and pacing signals will appear here dynamically as you listen to the session.</p>
                                </div>
                            )}

                            <div className="zth-runtime-tabs">
                                <button
                                    onClick={() => setRightTab('telemetry')}
                                    className={rightTab === 'telemetry' ? 'is-active' : ''}
                                >
                                    <BarChart3 size={15} />
                                    Telemetry
                                </button>
                                <button
                                    onClick={() => setRightTab('diagnostics')}
                                    className={rightTab === 'diagnostics' ? 'is-active' : ''}
                                >
                                    <Settings2 size={15} />
                                    Diagnostics
                                </button>
                            </div>

                            {rightTab === 'telemetry' ? <CognitiveDashboard /> : <RuntimeDebugPanel />}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AutonomousClassroom;
