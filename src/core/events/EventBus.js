import { useReplayStore } from '../../stores/useReplayStore';
import { saveReplayEvents } from '../..//utils/indexedDB';
import { useLearningSessionStore } from '../../stores/useLearningSessionStore';

class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    subscribe(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType).add(callback);

        // Return unsubscribe function
        return () => {
            const set = this.listeners.get(eventType);
            if (set) {
                set.delete(callback);
                if (set.size === 0) {
                    this.listeners.delete(eventType);
                }
            }
        };
    }

    dispatch(event) {
        const timestamp = Date.now();
        const traceId = event.traceId || crypto.randomUUID();
        const fullEvent = {
            traceId,
            timestamp,
            type: event.type,
            payload: event.payload || {},
            metadata: event.metadata || {}
        };

        // Log to replay store if a learning session is active
        const sessionId = useLearningSessionStore.getState().currentSessionId;
        if (sessionId) {
            useReplayStore.getState().addEvent(fullEvent);
            // Throttle or save to IndexedDB asynchronously
            const events = useReplayStore.getState().events;
            saveReplayEvents(sessionId, events).catch(err => console.error("Replay write error:", err));
        }

        // Trigger listeners for specific event type
        if (this.listeners.has(event.type)) {
            this.listeners.get(event.type).forEach(callback => {
                try {
                    callback(fullEvent);
                } catch (e) {
                    console.error(`Error in event listener for ${event.type}:`, e);
                }
            });
        }

        // Trigger wildcard/global listeners
        if (this.listeners.has('*')) {
            this.listeners.get('*').forEach(callback => {
                try {
                    callback(fullEvent);
                } catch (e) {
                    console.error(`Error in global event listener:`, e);
                }
            });
        }
    }
}

export const eventBus = new EventBus();
