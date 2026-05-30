import { eventBus } from '../events/EventBus';
import { getReplayEvents } from '../../utils/indexedDB';
import { useReplayStore } from '../../stores/useReplayStore';
import { rendererPipeline } from '../whiteboard/RendererPipeline';

class SnapshotReplayEngine {
    constructor() {
        this.snapshots = []; // Array of { timestampMs, canvasImageData, queueState, activeSubtitles, activeOverlays }
        this.events = [];
        this.playbackRate = 1.0;
        this.currentTime = 0;
        
        // Take snapshots periodically every 20 seconds during running timeline
        eventBus.subscribe('TIMELINE_TICK', (e) => {
            const timeMs = e.payload.currentTimeMs;
            this.currentTime = timeMs;
            
            const second = Math.floor(timeMs / 1000);
            if (second > 0 && second % 20 === 0) {
                this.captureSnapshot(timeMs);
            }
        });
    }

    captureSnapshot(timestampMs) {
        // Avoid duplicate snapshots for same second window
        const exists = this.snapshots.some(s => Math.abs(s.timestampMs - timestampMs) < 1000);
        if (exists) return;

        console.log(`Capturing replay snapshot at timeline timestamp: ${timestampMs}ms`);
        const canvas = rendererPipeline.canvas;
        let canvasData = null;
        if (canvas) {
            canvasData = canvas.toDataURL(); // Save image state base64
        }

        const snapshot = {
            timestampMs,
            canvasData,
            queueState: JSON.parse(JSON.stringify(useReplayStore.getState().events.filter(e => e.timestamp <= timestampMs))),
            activeSubtitles: useReplayStore.getState().activeSubtitles || "",
            activeOverlays: [] // save custom equation or diagram state
        };

        this.snapshots.push(snapshot);
    }

    async loadSessionReplay(sessionId) {
        const events = await getReplayEvents(sessionId);
        events.sort((a, b) => a.timestamp - b.timestamp);
        
        this.events = events;
        useReplayStore.getState().setEvents(events);
        this.snapshots = []; // Clear current session snapshots
    }

    seekToTime(timeOffsetMs) {
        // 1. Find nearest snapshot before seek target
        const priorSnapshots = this.snapshots.filter(s => s.timestampMs <= timeOffsetMs);
        let activeSnap = null;
        
        if (priorSnapshots.length > 0) {
            // Sort to get the closest one
            priorSnapshots.sort((a, b) => b.timestampMs - a.timestampMs);
            activeSnap = priorSnapshots[0];
        }

        // 2. Restore state from snapshot
        if (activeSnap) {
            console.log(`Replay Seek: Restoring from snapshot at ${activeSnap.timestampMs}ms`);
            
            // Restore whiteboard canvas image data
            if (activeSnap.canvasData && rendererPipeline.canvas) {
                const img = new Image();
                img.src = activeSnap.canvasData;
                img.onload = () => {
                    rendererPipeline.ctx.clearRect(0, 0, rendererPipeline.width, rendererPipeline.height);
                    rendererPipeline.ctx.drawImage(img, 0, 0);
                };
            }
            
            // Replay delta events from snapshot timestamp up to seek target
            const deltaEvents = this.events.filter(e => e.timestamp > activeSnap.timestampMs && e.timestamp <= timeOffsetMs);
            deltaEvents.forEach(e => eventBus.dispatch(e));
        } else {
            // Fallback: Clear whiteboard and run all past events up to target
            console.log(`Replay Seek: No snapshot found. Playing full delta events up to ${timeOffsetMs}ms`);
            rendererPipeline.clear();
            const pastEvents = this.events.filter(e => e.timestamp <= timeOffsetMs);
            pastEvents.forEach(e => eventBus.dispatch(e));
        }

        useReplayStore.getState().setCurrentTime(timeOffsetMs);
    }
}

export const snapshotReplayEngine = new SnapshotReplayEngine();
