import { create } from 'zustand';

export const useLearningSessionStore = create((set) => ({
    currentSessionId: null,
    sessionStatus: 'idle', // 'idle' | 'loading' | 'active' | 'paused' | 'completed'
    sessionProfile: null,
    activeNodeId: null,
    setSessionId: (id) => set({ currentSessionId: id }),
    setStatus: (status) => set({ sessionStatus: status }),
    setProfile: (profile) => set({ sessionProfile: profile }),
    setActiveNodeId: (id) => set({ activeNodeId: id }),
    resetSession: () => set({ currentSessionId: null, sessionStatus: 'idle', sessionProfile: null, activeNodeId: null }),
}));
