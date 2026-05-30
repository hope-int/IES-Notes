import { personalizationEngine } from './PersonalizationEngine';
import { queueEngine } from '../queue/QueueEngine';
import { lessonEngine } from '../lessonEngine/LessonEngine';
import { useAnalyticsStore } from '../../stores/useAnalyticsStore';
import { eventBus } from '../events/EventBus';

class AdaptiveRuntimeController {
    constructor() {
        this.studentState = 'focused'; // 'focused' | 'confused' | 'overloaded' | 'passive' | 'mastery_flow' | 'fatigued'
        this.cognitiveLoadScore = 0; // 0 (low) to 100 (high)
        this.pacingModifier = 1.0;
        
        // Listen to quiz scores, slider confidence levels, and active interactions
        eventBus.subscribe('COMPLETED_INTERACTION', (e) => {
            this.evaluateTelemetryInput(e.payload);
        });

        eventBus.subscribe('TIMELINE_TICK', (e) => {
            this.monitorCognitiveLoad(e.payload.currentTimeMs);
        });
    }

    getStudentState() {
        return this.studentState;
    }

    setStudentState(state) {
        this.studentState = state;
        useAnalyticsStore.getState().setStudentState?.(state);
    }

    evaluateTelemetryInput(payload) {
        const { value, isCorrect, latency } = payload;
        
        // 1. Calculate new Cognitive Load score based on latency and correctness
        if (isCorrect === false) {
            this.cognitiveLoadScore = Math.min(100, this.cognitiveLoadScore + 25);
        } else if (isCorrect === true) {
            this.cognitiveLoadScore = Math.max(0, this.cognitiveLoadScore - 15);
        }

        // Adjust for extreme latency
        if (latency > 20000) { // Student took > 20s
            this.cognitiveLoadScore = Math.min(100, this.cognitiveLoadScore + 10);
        }

        // 2. Classify state (Rule 12: Adaptive Student States)
        if (this.cognitiveLoadScore > 80) {
            this.setStudentState('overloaded');
            this.mitigateOverload();
        } else if (this.cognitiveLoadScore > 50) {
            this.setStudentState('confused');
        } else if (isCorrect === true && latency < 5000) {
            this.setStudentState('mastery_flow');
        } else if (this.cognitiveLoadScore < 20) {
            this.setStudentState('focused');
        }

        // Update telemetry tracking
        personalizationEngine.recordTelemetryResult('active_concept', isCorrect ?? true, latency || 5000);
    }

    monitorCognitiveLoad(timeMs) {
        // Automatically check if student is in passive state (no seeking or interaction response over long duration)
        const lastInteractionTime = useAnalyticsStore.getState().lastInteractionTime || 0;
        const idleDuration = timeMs - lastInteractionTime;

        if (idleDuration > 120000) { // 2 minutes idle
            this.setStudentState('passive');
        } else if (idleDuration > 300000) { // 5 minutes idle
            this.setStudentState('fatigued');
        }
    }

    async mitigateOverload() {
        // Triggered when student state becomes 'overloaded'
        console.warn("Mitigating student cognitive overload: slowing pacing and injecting recap nodes.");
        
        // 1. Slow down execution speed
        this.pacingModifier = 0.75;
        queueEngine.setPacingRate(this.pacingModifier);

        // 2. Dynamically build a simplified recap node
        const explanationItems = [
            {
                type: 'concept_explanation',
                payload: {
                    concept: 'Cognitive Break & Quick Summary',
                    explanation: 'Let\'s pause and summarize the core takeaway: we are breaking down complex concepts step-by-step. Let\'s review the formula details slowly.',
                    narrationText: 'Taking a quick pause here. Let\'s review what we have covered, step-by-step, to solidify the foundation.'
                },
                duration: 9000
            }
        ];

        // 3. Interrupt active lesson progression to run recap
        queueEngine.interrupt(explanationItems);
    }
}

export const adaptiveRuntimeController = new AdaptiveRuntimeController();
