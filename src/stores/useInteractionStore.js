import { create } from 'zustand';

export const useInteractionStore = create((set) => ({
    activeInteraction: null, // MCQ, Poll, Slider, Quick Check
    interactionResult: null,
    showInteraction: (interaction) => set({ activeInteraction: interaction, interactionResult: null }),
    submitResponse: (response) => set({ interactionResult: response }),
    clearInteraction: () => set({ activeInteraction: null, interactionResult: null }),
}));
