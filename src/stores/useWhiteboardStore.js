import { create } from 'zustand';

export const useWhiteboardStore = create((set) => ({
    drawEvents: [],
    currentEquation: null,
    activeDiagram: null,
    pacingDelay: 10,
    isDrawing: false,
    addDrawEvent: (event) => set((state) => ({ drawEvents: [...state.drawEvents, event] })),
    setDrawEvents: (events) => set({ drawEvents: events }),
    setEquation: (eq) => set({ currentEquation: eq }),
    setDiagram: (diag) => set({ activeDiagram: diag }),
    setPacingDelay: (delay) => set({ pacingDelay: delay }),
    setIsDrawing: (isDrawing) => set({ isDrawing }),
    clearWhiteboard: () => set({ drawEvents: [], currentEquation: null, activeDiagram: null, isDrawing: false }),
}));
