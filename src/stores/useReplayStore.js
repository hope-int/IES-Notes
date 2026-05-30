import { create } from 'zustand';

export const useReplayStore = create((set) => ({
    events: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    setEvents: (events) => set({ events }),
    addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
    setPlaying: (isPlaying) => set({ isPlaying }),
    setCurrentTime: (currentTime) => set({ currentTime }),
    setDuration: (duration) => set({ duration }),
    setPlaybackRate: (playbackRate) => set({ playbackRate }),
    clearReplay: () => set({ events: [], isPlaying: false, currentTime: 0, duration: 0, playbackRate: 1 }),
}));
