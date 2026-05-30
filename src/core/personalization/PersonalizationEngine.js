import { getOfflineProgress, saveOfflineProgress } from '../../utils/indexedDB';
import { queueEngine } from '../queue/QueueEngine';

class PersonalizationEngine {
    constructor() {
        this.profile = {
            id: 'student_profile_vector',
            pacingRating: 1.0, // 0.8x - 1.5x pacing modifier
            preferredStyle: 'conceptual', // 'conceptual' | 'analytical' | 'practical'
            weakConcepts: [],
            analogyPreferences: ['real-world'],
            retentionScore: 0.8
        };
    }

    async loadProfile() {
        try {
            const stored = await getOfflineProgress('student_profile_vector');
            if (stored) {
                this.profile = { ...this.profile, ...stored };
            }
        } catch (e) {
            console.warn("Could not load personalization profile", e);
        }
        return this.profile;
    }

    async saveProfile() {
        try {
            await saveOfflineProgress('student_profile_vector', this.profile);
        } catch (e) {
            console.warn("Could not save personalization profile", e);
        }
    }

    // Dynamic adaptation hook based on quiz result and latency
    async recordTelemetryResult(concept, isCorrect, latencyMs) {
        await this.loadProfile();

        // 1. Update weak concepts
        if (!isCorrect) {
            if (!this.profile.weakConcepts.includes(concept)) {
                this.profile.weakConcepts.push(concept);
            }
            // Slow down pacing
            this.profile.pacingRating = Math.max(0.7, this.profile.pacingRating - 0.1);
        } else {
            this.profile.weakConcepts = this.profile.weakConcepts.filter(c => c !== concept);
            
            // Speed up pacing slightly if latency is very low (< 5s)
            if (latencyMs < 5000) {
                this.profile.pacingRating = Math.min(1.4, this.profile.pacingRating + 0.05);
            }
        }

        // 2. Adjust preferred style
        if (latencyMs > 15000 && !isCorrect) {
            this.profile.preferredStyle = 'conceptual'; // student needs simpler analogies
        } else if (latencyMs < 7000 && isCorrect) {
            this.profile.preferredStyle = 'analytical'; // ready for formulas/math
        }

        // Apply updated pacing directly to active RxJS Queue Engine
        queueEngine.setPacingRate(this.profile.pacingRating);

        await this.saveProfile();
        return this.profile;
    }

    getPersonalizedSystemPrompt() {
        return `
Adjust details according to student profile:
- Pacing Multiplier: ${this.profile.pacingRating}x
- Style: ${this.profile.preferredStyle === 'conceptual' ? 'highly analogical, simple words' : 'analytical with detailed definitions and equations'}
- Focus Areas: ${this.profile.weakConcepts.join(', ') || 'General'}
`;
    }
}

export const personalizationEngine = new PersonalizationEngine();
