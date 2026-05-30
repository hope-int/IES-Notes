import { create } from 'zustand';

export const useQueueStore = create((set) => ({
    queue: [],
    history: [],
    setQueue: (items) => set({ queue: items }),
    addQueueItem: (item) => set((state) => ({ queue: [...state.queue, item] })),
    removeQueueItem: (id) => set((state) => ({ queue: state.queue.filter((x) => x.id !== id) })),
    updateQueueItemStatus: (id, status, payload = {}) => set((state) => {
        const itemIndex = state.queue.findIndex((x) => x.id === id);
        if (itemIndex === -1) return {};
        const updated = [...state.queue];
        updated[itemIndex] = {
            ...updated[itemIndex],
            status,
            payload: { ...updated[itemIndex].payload, ...payload }
        };
        
        let newHistory = state.history;
        let newQueue = updated;
        
        if (status === 'completed') {
            const completedItem = updated[itemIndex];
            newQueue = updated.filter((x) => x.id !== id);
            newHistory = [...state.history, completedItem];
        }
        
        return { queue: newQueue, history: newHistory };
    }),
    clearQueue: () => set({ queue: [], history: [] }),
}));
