import { create } from 'zustand';

export const useAnalyticsStore = create((set) => ({
    attentionScore: 100,
    conceptMastery: {},
    weakConcepts: [],
    interactionLatency: [],
    quizPerformance: [],
    focusHistory: [],
    
    updateAttention: (score) => set((state) => ({
        attentionScore: score,
        focusHistory: [...state.focusHistory, { timestamp: Date.now(), score }].slice(-50) // keep last 50 points
    })),
    
    updateConceptMastery: (concept, score) => set((state) => ({
        conceptMastery: {
            ...state.conceptMastery,
            [concept]: score
        }
    })),
    
    addWeakConcept: (concept) => set((state) => ({
        weakConcepts: state.weakConcepts.includes(concept)
            ? state.weakConcepts
            : [...state.weakConcepts, concept]
    })),
    
    removeWeakConcept: (concept) => set((state) => ({
        weakConcepts: state.weakConcepts.filter((c) => c !== concept)
    })),
    
    logQuizScore: (quizId, score) => set((state) => ({
        quizPerformance: [...state.quizPerformance, { quizId, score, timestamp: Date.now() }]
    })),
    
    logLatency: (ms) => set((state) => ({
        interactionLatency: [...state.interactionLatency, ms].slice(-20)
    })),
    
    resetAnalytics: () => set({
        attentionScore: 100,
        conceptMastery: {},
        weakConcepts: [],
        interactionLatency: [],
        quizPerformance: [],
        focusHistory: []
    })
}));
