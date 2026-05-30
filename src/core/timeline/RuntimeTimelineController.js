import { eventBus } from '../events/EventBus';
import { useLearningSessionStore } from '../../stores/useLearningSessionStore';

class RuntimeTimelineController {
    constructor() {
        this.authoritativeClock = 0; // Current authoritative elapsed time in ms
        this.audioElement = null;
        this.clockIntervalId = null;
        this.lastSystemTime = 0;
        this.isRunning = false;
        
        // Listen to audio manager events
        eventBus.subscribe('AUDIO_PLAYBACK_START', (e) => {
            if (e.payload.audioElement) {
                this.audioElement = e.payload.audioElement;
            }
        });
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.authoritativeClock = 0; // Reset timeline clock for a fresh compiled session
        this.lastSystemTime = performance.now();

        this.clockIntervalId = setInterval(() => {
            this.tick();
        }, 16); // ~60fps timeline check
    }

    pause() {
        this.isRunning = false;
        if (this.clockIntervalId) {
            clearInterval(this.clockIntervalId);
            this.clockIntervalId = null;
        }
    }

    seek(timeMs) {
        this.authoritativeClock = timeMs;
        if (this.audioElement) {
            this.audioElement.currentTime = timeMs / 1000;
        }
        eventBus.dispatch({
            type: 'TIMELINE_SEEK',
            payload: { timeMs }
        });
    }

    tick() {
        const now = performance.now();
        const delta = now - this.lastSystemTime;
        this.lastSystemTime = now;

        if (this.audioElement && !this.audioElement.paused) {
            // Rule 3: Audio timeline is authoritative. Everything synchronizes to audio.currentTime
            const audioMs = this.audioElement.currentTime * 1000;
            const drift = Math.abs(audioMs - this.authoritativeClock);
            
            if (drift > 150) { // Limit drift correction to avoid jumpiness
                this.authoritativeClock = audioMs;
            } else {
                // Smoothly interpolate toward audio time
                this.authoritativeClock += (audioMs - this.authoritativeClock) * 0.1;
            }
        } else {
            // Fallback: system high-res clock if audio is stopped or web speech synthesis is speaking
            this.authoritativeClock += delta;
        }

        // Broadcast current authoritative time to all sync layers (Whiteboard, Subtitles, Replay)
        eventBus.dispatch({
            type: 'TIMELINE_TICK',
            payload: { 
                currentTimeMs: this.authoritativeClock,
                playbackRate: this.audioElement ? this.audioElement.playbackRate : 1.0
            }
        });
    }

    getAuthoritativeTime() {
        return this.authoritativeClock;
    }
}

export const runtimeTimelineController = new RuntimeTimelineController();
