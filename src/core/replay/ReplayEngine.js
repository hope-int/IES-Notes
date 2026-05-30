import { getReplayEvents } from '../../utils/indexedDB';
import { useReplayStore } from '../../stores/useReplayStore';
import { eventBus } from '../events/EventBus';

class ReplayEngine {
    constructor() {
        this.events = [];
        this.timeoutIds = [];
        this.startTime = 0;
        this.pauseTime = 0;
    }

    async loadSession(sessionId) {
        const events = await getReplayEvents(sessionId);
        // Sort by timestamp just in case
        events.sort((a, b) => a.timestamp - b.timestamp);
        
        if (events.length > 0) {
            const start = events[0].timestamp;
            const end = events[events.length - 1].timestamp;
            const duration = end - start;
            
            // Normalize timestamps to relative offsets starting at 0
            const normalized = events.map(e => ({
                ...e,
                relativeTime: e.timestamp - start
            }));
            
            useReplayStore.getState().setEvents(normalized);
            useReplayStore.getState().setDuration(duration);
            this.events = normalized;
        }
    }

    play() {
        const { isPlaying, currentTime, playbackRate } = useReplayStore.getState();
        if (isPlaying || this.events.length === 0) return;

        useReplayStore.getState().setPlaying(true);
        this.startTime = Date.now() - (currentTime / playbackRate);
        
        // Schedule all future events based on remaining time
        const futureEvents = this.events.filter(e => e.relativeTime >= currentTime);
        
        futureEvents.forEach(event => {
            const delay = (event.relativeTime - currentTime) / playbackRate;
            const id = setTimeout(() => {
                // Dispatch event to render it live during replay!
                eventBus.dispatch(event);
                useReplayStore.getState().setCurrentTime(event.relativeTime);
                
                // If it's the last event, trigger complete
                if (event.id === this.events[this.events.length - 1].id) {
                    this.stop();
                }
            }, delay);
            this.timeoutIds.push(id);
        });
    }

    pause() {
        const { isPlaying, playbackRate } = useReplayStore.getState();
        if (!isPlaying) return;

        this.clearTimers();
        const elapsed = (Date.now() - this.startTime) * playbackRate;
        useReplayStore.getState().setCurrentTime(elapsed);
        useReplayStore.getState().setPlaying(false);
    }

    seek(timeOffsetMs) {
        this.clearTimers();
        useReplayStore.getState().setCurrentTime(timeOffsetMs);
        
        // Re-dispatch past events up to timeOffsetMs to reconstruct state (delta rendering logic)
        const pastEvents = this.events.filter(e => e.relativeTime <= timeOffsetMs);
        
        // Dispatch a clear event first to reset state, then replay all past strokes
        eventBus.dispatch({ type: 'DRAW_CLEAR' });
        pastEvents.forEach(e => eventBus.dispatch(e));

        const { isPlaying } = useReplayStore.getState();
        if (isPlaying) {
            this.play();
        }
    }

    stop() {
        this.clearTimers();
        useReplayStore.getState().setPlaying(false);
        useReplayStore.getState().setCurrentTime(0);
    }

    clearTimers() {
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
    }
}

export const replayEngine = new ReplayEngine();
