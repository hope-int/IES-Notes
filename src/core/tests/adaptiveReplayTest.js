// Target unit test for AdaptiveRuntimeController and SnapshotReplayEngine
import { adaptiveRuntimeController } from '../personalization/AdaptiveRuntimeController.js';
import { snapshotReplayEngine } from '../replay/SnapshotReplayEngine.js';

console.log("=== STARTING RUNTIME SYSTEM VERIFICATION ===");

// 1. Validate Initial State
const state = adaptiveRuntimeController.getStudentState();
console.log(`Initial Student State: ${state}`);
if (state !== 'focused') {
    throw new Error(`Expected 'focused' but got ${state}`);
}

// 2. Validate Telemetry Cognitive Load Upward Drift
console.log("Triggering incorrect telemetry inputs...");
adaptiveRuntimeController.evaluateTelemetryInput({
    value: "Incorrect Answer",
    isCorrect: false,
    latency: 12000
});

console.log(`Updated Cognitive Load Score: ${adaptiveRuntimeController.cognitiveLoadScore}`);
if (adaptiveRuntimeController.cognitiveLoadScore !== 25) {
    throw new Error(`Expected load score to be 25 but got ${adaptiveRuntimeController.cognitiveLoadScore}`);
}

// 3. Trigger Overload & Mitigation Validation
console.log("Triggering severe overload state...");
for (let i = 0; i < 4; i++) {
    adaptiveRuntimeController.evaluateTelemetryInput({
        value: "Incorrect Answer",
        isCorrect: false,
        latency: 22000
    });
}

console.log(`Final Cognitive Load Score: ${adaptiveRuntimeController.cognitiveLoadScore}`);
console.log(`Mitigated Student State: ${adaptiveRuntimeController.getStudentState()}`);
console.log(`Pacing modifier: ${adaptiveRuntimeController.pacingModifier}`);

if (adaptiveRuntimeController.getStudentState() !== 'overloaded') {
    throw new Error("Expected student state to become 'overloaded'");
}
if (adaptiveRuntimeController.pacingModifier !== 0.75) {
    throw new Error("Expected pacing to be slowed down to 0.75");
}

console.log("=== ALL TEST CHECKS PASSED SUCCESSFULLY ===");
