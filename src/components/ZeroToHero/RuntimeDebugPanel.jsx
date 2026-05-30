import React, { useState, useEffect } from 'react';
import { useQueueStore } from '../../stores/useQueueStore';
import { runtimeTimelineController } from '../../core/timeline/RuntimeTimelineController';
import { adaptiveRuntimeController } from '../../core/personalization/AdaptiveRuntimeController';
import { eventBus } from '../../core/events/EventBus';

const RuntimeDebugPanel = () => {
    const { queue } = useQueueStore();
    const [currentTime, setCurrentTime] = useState(0);
    const [activeNode, setActiveNode] = useState(null);
    const [fps, setFps] = useState(60);
    const [drift, setDrift] = useState(0);
    const [workerStatus, setWorkerStatus] = useState('healthy');

    useEffect(() => {
        let frameCount = 0;
        let lastTime = performance.now();
        let animId;

        const updateStats = () => {
            const now = performance.now();
            frameCount++;
            if (now > lastTime + 1000) {
                setFps(Math.round((frameCount * 1000) / (now - lastTime)));
                frameCount = 0;
                lastTime = now;
            }
            animId = requestAnimationFrame(updateStats);
        };
        animId = requestAnimationFrame(updateStats);

        const subTimeline = eventBus.subscribe('TIMELINE_TICK', (e) => {
            setCurrentTime(e.payload.currentTimeMs);
            if (runtimeTimelineController.audioElement) {
                const audioMs = runtimeTimelineController.audioElement.currentTime * 1000;
                setDrift(Math.round(Math.abs(audioMs - e.payload.currentTimeMs)));
            }
        });

        return () => {
            cancelAnimationFrame(animId);
            subTimeline();
        };
    }, []);

    // Find active node in the queue store
    const activeItem = queue.find(x => x.status === 'running') || null;

    return (
        <div className="card bg-white text-dark border border-light-subtle rounded-4 shadow-sm p-3 font-monospace" style={{ fontSize: '0.8rem' }}>
            <div className="d-flex align-items-center justify-content-between border-bottom border-light-subtle pb-2 mb-3">
                <div className="d-flex align-items-center gap-2">
                    <span className="spinner-grow spinner-grow-sm text-primary" role="status"></span>
                    <span className="fw-bold tracking-wider text-uppercase text-primary">Runtime Debug Console</span>
                </div>
                <div className="badge bg-primary-subtle text-primary">v1.1.0</div>
            </div>

            <div className="row g-3">
                {/* Auth Clock */}
                <div className="col-6">
                    <div className="bg-light p-2 rounded border border-light-subtle">
                        <div className="text-secondary small">Timeline Clock</div>
                        <div className="fs-5 fw-bold text-primary">{(currentTime / 1000).toFixed(2)}s</div>
                    </div>
                </div>

                {/* Clock Drift */}
                <div className="col-6">
                    <div className="bg-light p-2 rounded border border-light-subtle">
                        <div className="text-secondary small">Clock Drift</div>
                        <div className="fs-5 fw-bold text-warning">{drift}ms</div>
                    </div>
                </div>

                {/* Performance HUD */}
                <div className="col-12">
                    <div className="d-flex justify-content-between text-secondary border-bottom border-light-subtle pb-1 mb-2">
                        <span>FPS: <strong className="text-success">{fps}</strong></span>
                        <span>Worker Thread: <strong className="text-success">{workerStatus}</strong></span>
                        <span>Load State: <strong className="text-info">{adaptiveRuntimeController.cognitiveLoadScore}%</strong></span>
                    </div>
                </div>

                {/* DAG Engine Queue Flow */}
                <div className="col-12">
                    <div className="text-secondary fw-semibold mb-1">Queue DAG Flow Structure:</div>
                    <div className="d-flex flex-column gap-1 overflow-auto bg-light p-2 rounded border border-light-subtle" style={{ maxHeight: '150px' }}>
                        {queue.length === 0 ? (
                            <span className="text-muted">Queue is empty.</span>
                        ) : (
                            queue.map((node, index) => (
                                <div key={node.id} className="d-flex align-items-center justify-content-between text-dark">
                                    <span className={node.status === 'running' ? 'text-primary fw-bold' : node.status === 'completed' ? 'text-muted text-decoration-line-through' : 'text-dark'}>
                                        {index}. [{node.type.toUpperCase()}] ({node.id.slice(0, 8)})
                                    </span>
                                    <span className={`badge ${node.status === 'running' ? 'bg-primary text-white' : node.status === 'completed' ? 'bg-secondary text-white' : 'bg-light text-dark border'}`}>
                                        {node.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RuntimeDebugPanel;
