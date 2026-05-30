import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { useQueueStore } from '../../stores/useQueueStore';
import { useLearningSessionStore } from '../../stores/useLearningSessionStore';
import { eventBus } from '../events/EventBus';

class QueueEngine {
    constructor() {
        this.queue$ = new BehaviorSubject([]);
        this.status$ = new BehaviorSubject('idle'); // 'idle' | 'running' | 'paused' | 'completed'
        this.activeItem$ = new BehaviorSubject(null);
        
        this.subscription = new Subscription();
        this.pacingRate = 1.0;
        
        // Listen to queue changes and sync to Zustand
        this.subscription.add(
            this.queue$.subscribe(items => {
                useQueueStore.getState().setQueue(items);
            })
        );
        
        this.subscription.add(
            this.status$.subscribe(status => {
                useLearningSessionStore.getState().setStatus(status);
            })
        );
    }
    
    setQueue(items) {
        const normalized = items.map(item => ({
            id: item.id || crypto.randomUUID(),
            type: item.type,
            status: item.status || 'pending',
            priority: item.priority || 0,
            payload: item.payload || {},
            duration: item.duration || 5000 // default duration in ms
        }));
        
        // Sort by priority (higher priority first)
        normalized.sort((a, b) => b.priority - a.priority);
        this.queue$.next(normalized);
    }
    
    addImmediateItem(item) {
        const currentQueue = this.queue$.value;
        const newItem = {
            id: item.id || crypto.randomUUID(),
            type: item.type,
            status: 'pending',
            priority: 10, // high priority to run next
            payload: item.payload || {},
            duration: item.duration || 5000
        };
        
        const updated = [newItem, ...currentQueue].sort((a, b) => b.priority - a.priority);
        this.queue$.next(updated);
        
        // If paused, we can automatically resume or stay paused depending on flow
        if (this.status$.value === 'idle') {
            this.start();
        }
    }
    
    interrupt(explanationItems) {
        // Pauses active execution, prepends explanation items at top priority, and starts them
        const active = this.activeItem$.value;
        const currentQueue = this.queue$.value;
        
        // If there is an active running item, change its status back to pending or save partial progress
        let modifiedQueue = [...currentQueue];
        if (active && active.status === 'running') {
            // Keep active item, but change status to pending so it runs again after interruption
            const activeReset = { ...active, status: 'pending', priority: 1 };
            modifiedQueue = [activeReset, ...modifiedQueue];
        }
        
        const preppedExplanation = explanationItems.map(item => ({
            id: item.id || crypto.randomUUID(),
            type: item.type,
            status: 'pending',
            priority: 5, // higher than activeReset
            payload: item.payload || {},
            duration: item.duration || 5000
        }));
        
        this.activeItem$.next(null);
        this.setQueue([...preppedExplanation, ...modifiedQueue]);
        this.status$.next('running');
        this.executeNext();
    }
    
    start() {
        if (this.status$.value === 'running') return;
        this.status$.next('running');
        this.executeNext();
    }
    
    pause() {
        if (this.status$.value !== 'running') return;
        this.status$.next('paused');
        
        // Broadcast pause event
        eventBus.dispatch({
            type: 'QUEUE_PAUSED',
            payload: { activeItemId: this.activeItem$.value?.id }
        });
    }
    
    resume() {
        if (this.status$.value !== 'paused') return;
        this.status$.next('running');
        
        eventBus.dispatch({
            type: 'QUEUE_RESUMED',
            payload: { activeItemId: this.activeItem$.value?.id }
        });
        
        this.executeNext();
    }
    
    setPacingRate(rate) {
        this.pacingRate = rate;
    }
    
    async executeNext() {
        if (this.status$.value !== 'running') return;
        
        const queue = this.queue$.value;
        const nextIndex = queue.findIndex(item => item.status === 'pending');
        
        if (nextIndex === -1) {
            this.status$.next('completed');
            eventBus.dispatch({ type: 'SESSION_COMPLETED', payload: {} });
            return;
        }
        
        const item = queue[nextIndex];
        
        // Set item to running
        const updatedQueue = [...queue];
        updatedQueue[nextIndex] = { ...item, status: 'running' };
        this.queue$.next(updatedQueue);
        this.activeItem$.next(updatedQueue[nextIndex]);
        useQueueStore.getState().updateQueueItemStatus(item.id, 'running');
        
        // Dispatch run event to Event Bus
        eventBus.dispatch({
            type: `RUN_${item.type.toUpperCase()}`,
            payload: item.payload,
            metadata: { itemId: item.id }
        });
        
        // Wait for completion based on type
        try {
            await this.waitForItemCompletion(item);
            
            // Mark item as completed
            useQueueStore.getState().updateQueueItemStatus(item.id, 'completed');
            
            const postExecutionQueue = this.queue$.value.filter(x => x.id !== item.id);
            this.queue$.next(postExecutionQueue);
            
            this.activeItem$.next(null);
            
            // Proceed to next
            setTimeout(() => this.executeNext(), 300);
        } catch (err) {
            console.error('Queue item failed:', err);
            // On failure, pause queue
            this.status$.next('paused');
        }
    }
    
    waitForItemCompletion(item) {
        return new Promise((resolve, reject) => {
            let timeoutId;
            let unsubscribe;
            
            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (unsubscribe) unsubscribe();
            };
            
            // For standard types, they can declare completion via the Event Bus
            // e.g. drawing done, audio done, MCQ answered.
            unsubscribe = eventBus.subscribe(`COMPLETED_${item.type.toUpperCase()}`, (event) => {
                if (event.metadata?.itemId === item.id || !event.metadata?.itemId) {
                    cleanup();
                    resolve();
                }
            });
            
            // Handle pause during execution
            const pauseSub = this.status$.subscribe(status => {
                if (status === 'paused') {
                    cleanup();
                    // Rejecting stops execution loop; it will resume at 'pending' status when resume() is called
                    reject(new Error('Paused'));
                }
            });
            
            this.subscription.add(pauseSub);
            
            // Safety timeout fallback if event doesn't fire
            const duration = (item.duration || 5000) / this.pacingRate;
            timeoutId = setTimeout(() => {
                cleanup();
                resolve();
            }, duration);
        });
    }
    
    destroy() {
        this.subscription.unsubscribe();
    }
}

export const queueEngine = new QueueEngine();
