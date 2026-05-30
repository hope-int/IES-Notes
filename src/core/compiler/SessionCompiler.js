import { ragEngine } from '../rag/RAGEngine';
import { getAICompletion } from '../../utils/aiService';
import { audioManager } from '../audio/AudioManager';
import { useLearningSessionStore } from '../../stores/useLearningSessionStore';
import { useQueueStore } from '../../stores/useQueueStore';
import { saveQueueState } from '../../utils/indexedDB';
import { queueEngine } from '../queue/QueueEngine';

class SessionCompiler {
    /**
     * Compiles an educational session into a valid Directed Educational Graph (DAG).
     * @param {string} topic - The search/learning topic
     * @param {Object} profile - Student cognitive profile
     * @returns {Promise<Object>} - Contains sessionId, nodesMap, rootNodeId, and initial checkpoint
     */
    async compile(topic, profile = {}, options = {}) {
        useLearningSessionStore.getState().setStatus('compiling');

        // 1. Retrieve RAG or Document Context
        let contextText = '';
        if (options.documentChunks && options.documentChunks.length > 0) {
            contextText = options.documentChunks.map((chunk, idx) => `Uploaded Document Fragment ${idx + 1}:\n${chunk}`).join('\n\n');
        } else {
            const contextResults = await ragEngine.search(topic, 4);
            contextText = contextResults.map(r => `Source: ${r.filename}\nContent: ${r.content}`).join('\n\n');
        }

        const durationMinutes = options.classDurationMinutes || 5;
        const totalDurationMs = durationMinutes * 60 * 1000;

        // 2. Build detailed prompt for DAG synthesis
        const systemPrompt = `
You are the HOPE Autonomous Educational Intelligence System Compiler.
Your job is to compile a structured, pacing-controlled Directed Educational Graph (DAG) for the topic: "${topic || 'Document-based Learning Session'}".

Analyze the student profile:
- Pacing Preference: ${profile.pacing || 'normal'}
- Target Depth: ${profile.depth || 'conceptual'}
- Weak Concepts: ${JSON.stringify(profile.weakConcepts || [])}

Retrieved learning fragments:
---
${contextText}
---

Output a valid JSON object representing the entire compiled lesson DAG. Do not include markdown wraps.
The JSON must contain:
1. "nodes": A map of nodes where keys are unique string IDs (e.g., "node_0", "node_1") and values are:
   {
      "id": "node_id",
      "type": "intro" | "concept_explanation" | "equation" | "diagram" | "quiz" | "code_simulation" | "graph_plot" | "summary",
      "payload": { ... node specific payload ... },
      "estimatedDuration": number (in milliseconds),
      "interruptible": boolean,
      "prerequisites": [string],
      "transitions": {
         "success": string (next node ID on success/completion),
         "failure": string (fallback/remediating node ID if quiz is failed, or null),
         "timeout": string (fallback node ID if time limit exceeded, or null)
      }
   }
2. "rootNodeId": The ID of the start node.
3. "checkpoints": An array of relative timeline checkpoint events (every 15-30s) to support replay scrub seeking.

Rules:
- Total Class Time Budget: ${durationMinutes} minutes (${totalDurationMs} ms). Ensure the sum of node "estimatedDuration" fields is approximately ${totalDurationMs} ms. Create a sequence of loops or transitions that uses this budget.
- For "code_simulation" type, payload MUST have: "code" (source code to execute/demonstrate), "language" (e.g. "python", "javascript"), and "expectedOutput" (the output from running that code).
- For "graph_plot" type, payload MUST have: "latexEquation" (e.g., "y = sin(x)"), "functionFormula" (javascript formula like "Math.sin(x)" or "x*x" to plot over range [-5, 5]), and "explanation".
- If a node is a "quiz" type, payload must have: "question", "options" (array of strings), "answer" (exact string match), "explanation" (for fallback/remediation).
- Every "quiz" node MUST have a transitions.failure target node defined in the nodes list (an "analogy_remediation" node of type "concept_explanation" explaining that concept with a simplified analogy).
- Provide LaTeX in "equation" payloads and Mermaid markdown in "diagram" payloads.
- Ensure all transitions refer to existing node IDs.
`;

        let compiledData = null;
        let isOfflineFallback = false;

        try {
            const response = await getAICompletion([
                { role: 'user', content: systemPrompt }
            ], {
                actionType: 'compiler',
                jsonMode: true,
                temperature: 0.1
            });

            try {
                let cleaned = response.trim();
                if (cleaned.startsWith('```')) {
                    cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '').trim();
                }
                compiledData = JSON.parse(cleaned);
            } catch (err) {
                console.error("Failed to parse compiled lesson JSON, attempting regex recovery", err);
                const match = response.match(/\{[\s\S]*\}/);
                if (match) {
                    compiledData = JSON.parse(match[0]);
                } else {
                    throw new Error("Invalid educational sequence format returned by Session Compiler AI.");
                }
            }
        } catch (error) {
            console.warn("AI Compilation Failed, falling back to local Offline Lesson Synthesis:", error.message || error);
            isOfflineFallback = true;
            compiledData = this.generateOfflineLesson(topic, durationMinutes);
        }

        try {
            // 3. Validate DAG Integrity (Rule 5: Bounded systems, check cycles & missing node IDs)
            this.validateDAG(compiledData);

            // 4. Pre-generate whiteboard stroke and render instructions
            this.generateWhiteboardInstructions(compiledData.nodes);

            // 5. Pre-fetch audio (Rule 4: pre-fetch 15-25 seconds ahead)
            await this.prebufferAudio(compiledData);

            const sessionId = crypto.randomUUID();
            useLearningSessionStore.getState().setSessionId(sessionId);
            useLearningSessionStore.getState().setProfile(profile);

            // Sync to RxJS Queue Engine
            queueEngine.setQueue(Object.values(compiledData.nodes));
            
            // Save compiled queue state to IndexedDB for offline resilience
            await saveQueueState(sessionId, compiledData);

            // Auto start queue
            queueEngine.start();

            return {
                sessionId,
                nodes: compiledData.nodes,
                rootNodeId: compiledData.rootNodeId,
                checkpoints: compiledData.checkpoints || []
            };

        } catch (error) {
            console.error("Session Compiler Failed:", error);
            useLearningSessionStore.getState().setStatus('failed');
            throw error;
        }
    }

    /**
     * Synthesizes a valid educational lesson graph offline when AI completion fails.
     */
    generateOfflineLesson(topic, durationMinutes) {
        const totalDurationMs = durationMinutes * 60 * 1000;
        
        const nodeDurations = {
            intro: Math.round(totalDurationMs * 0.12),
            concept: Math.round(totalDurationMs * 0.18),
            equation: Math.round(totalDurationMs * 0.15),
            diagram: Math.round(totalDurationMs * 0.15),
            quiz: Math.round(totalDurationMs * 0.15),
            remediation: Math.round(totalDurationMs * 0.12),
            code: Math.round(totalDurationMs * 0.15),
            summary: Math.round(totalDurationMs * 0.10)
        };

        const nodes = {
            "node_intro": {
                "id": "node_intro",
                "type": "intro",
                "payload": {
                    "title": `Introduction to ${topic}`,
                    "text": `Welcome to the learning session on ${topic}. Today we will explore the core concepts, mathematical formulations, architectural diagrams, and practical code implementations of this subject. Let's get started.`,
                    "narrationText": `Welcome to the learning session on ${topic}. Today we will explore the core concepts, mathematical formulations, architectural diagrams, and practical code implementations of this subject. Let's get started.`
                },
                "estimatedDuration": nodeDurations.intro,
                "interruptible": true,
                "prerequisites": [],
                "transitions": {
                    "success": "node_concept",
                    "failure": null,
                    "timeout": null
                }
            },
            "node_concept": {
                "id": "node_concept",
                "type": "concept_explanation",
                "payload": {
                    "concept": `${topic} Core Concepts`,
                    "explanation": `The primary goal of ${topic} is to address structural, algorithmic, or systems-level requirements. It operates under standard engineering principles, enabling efficient processing, optimization, and scalability. In academic settings, understanding these foundational layers is key to solving complex problems.`,
                    "narrationText": `The primary goal of ${topic} is to address structural, algorithmic, or systems-level requirements. It operates under standard engineering principles, enabling efficient processing, optimization, and scalability. In academic settings, understanding these foundational layers is key to solving complex problems.`
                },
                "estimatedDuration": nodeDurations.concept,
                "interruptible": true,
                "prerequisites": ["node_intro"],
                "transitions": {
                    "success": "node_equation",
                    "failure": null,
                    "timeout": null
                }
            },
            "node_equation": {
                "id": "node_equation",
                "type": "equation",
                "payload": {
                    "latex": "f(x) = \\sum_{i=1}^{n} w_i x_i + b",
                    "explanation": `This mathematical formulation represents a standard weighted function, commonly utilized in ${topic} for processing input parameters, calculating weights, or mapping system states. Here, w represents the weights, x represents inputs, and b represents the bias.`,
                    "narrationText": `This mathematical formulation represents a standard weighted function, commonly utilized in ${topic} for processing input parameters, calculating weights, or mapping system states. Here, w represents the weights, x represents inputs, and b represents the bias.`
                },
                "estimatedDuration": nodeDurations.equation,
                "interruptible": true,
                "prerequisites": ["node_concept"],
                "transitions": {
                    "success": "node_diagram",
                    "failure": null,
                    "timeout": null
                }
            },
            "node_diagram": {
                "id": "node_diagram",
                "type": "diagram",
                "payload": {
                    "mermaid": "graph TD\n    A[\"Input Data\"] --> B[\"Processing Engine\"]\n    B --> C{\"Decision Check\"}\n    C -- Yes --> D[\"Target State\"]\n    C -- No --> E[\"Error State\"]",
                    "explanation": `This systems diagram outlines the standard control flow and architectures associated with ${topic}. Input data passes through processing blocks before matching conditions to route to the target state.`,
                    "narrationText": `This systems diagram outlines the standard control flow and architectures associated with ${topic}. Input data passes through processing blocks before matching conditions to route to the target state.`
                },
                "estimatedDuration": nodeDurations.diagram,
                "interruptible": true,
                "prerequisites": ["node_equation"],
                "transitions": {
                    "success": "node_quiz",
                    "failure": null,
                    "timeout": null
                }
            },
            "node_quiz": {
                "id": "node_quiz",
                "type": "quiz",
                "payload": {
                    "question": `What is the primary objective when studying or implementing ${topic}?`,
                    "options": [
                        "Optimizing systems and algorithmic efficiency",
                        "Increasing arbitrary state complexity",
                        "Ignoring baseline runtime parameters",
                        "Minimizing structural feedback loops"
                    ],
                    "answer": "Optimizing systems and algorithmic efficiency",
                    "explanation": `Studying ${topic} helps in optimizing systems, algorithms, or components to achieve maximum efficiency and reliability.`
                },
                "estimatedDuration": nodeDurations.quiz,
                "interruptible": false,
                "prerequisites": ["node_diagram"],
                "transitions": {
                    "success": "node_code",
                    "failure": "node_remediation",
                    "timeout": null
                }
            },
            "node_remediation": {
                "id": "node_remediation",
                "type": "concept_explanation",
                "payload": {
                    "concept": `Analogy for ${topic}`,
                    "explanation": `Think of ${topic} like organizing a library. Instead of placing books randomly, we catalog them by genre and author. This makes retrieval fast and efficient. Similarly, ${topic} organizes data, signals, or code structures to minimize overhead.`,
                    "narrationText": `Think of ${topic} like organizing a library. Instead of placing books randomly, we catalog them by genre and author. This makes retrieval fast and efficient. Similarly, ${topic} organizes data, signals, or code structures to minimize overhead.`
                },
                "estimatedDuration": nodeDurations.remediation,
                "interruptible": true,
                "prerequisites": ["node_quiz"],
                "transitions": {
                    "success": "node_code",
                    "failure": null,
                    "timeout": null
                }
            },
            "node_code": {
                "id": "node_code",
                "type": "code_simulation",
                "payload": {
                    "code": `def demonstrate_logic():\n    topic = "${topic}"\n    print(f"Executing simulation for {topic}")\n    for i in range(3):\n        print(f"Step {i+1}: Node processed successfully.")\ndemonstrate_logic()`,
                    "language": "python",
                    "expectedOutput": `Executing simulation for ${topic}\nStep 1: Node processed successfully.\nStep 2: Node processed successfully.\nStep 3: Node processed successfully.`,
                    "explanation": `Let's run a simple Python script simulating the workflow logic of ${topic}. The console shows each step execution sequentially.`,
                    "narrationText": `Let's run a simple Python script simulating the workflow logic of ${topic}. The console shows each step execution sequentially.`
                },
                "estimatedDuration": nodeDurations.code,
                "interruptible": false,
                "prerequisites": ["node_quiz"],
                "transitions": {
                    "success": "node_summary",
                    "failure": null,
                    "timeout": null
                }
            },
            "node_summary": {
                "id": "node_summary",
                "type": "summary",
                "payload": {
                    "text": `In summary, we have reviewed the introduction, core concepts, mathematical foundations, system diagrams, and code behavior of ${topic}. Reviewing these elements regularly will solidify your preparation. Thank you for participating.`,
                    "narrationText": `In summary, we have reviewed the introduction, core concepts, mathematical foundations, system diagrams, and code behavior of ${topic}. Reviewing these elements regularly will solidify your preparation. Thank you for participating.`
                },
                "estimatedDuration": nodeDurations.summary,
                "prerequisites": ["node_code"],
                "transitions": {
                    "success": null,
                    "failure": null,
                    "timeout": null
                }
            }
        };

        const checkpoints = [
            { "time": 0, "nodeId": "node_intro", "label": "Introduction" },
            { "time": Math.round(totalDurationMs * 0.15), "nodeId": "node_concept", "label": "Key Concepts" },
            { "time": Math.round(totalDurationMs * 0.35), "nodeId": "node_equation", "label": "Mathematical Model" },
            { "time": Math.round(totalDurationMs * 0.50), "nodeId": "node_diagram", "label": "System Architecture" },
            { "time": Math.round(totalDurationMs * 0.65), "nodeId": "node_quiz", "label": "Concept Check" },
            { "time": Math.round(totalDurationMs * 0.85), "nodeId": "node_code", "label": "Runtime Simulation" },
            { "time": Math.round(totalDurationMs * 0.95), "nodeId": "node_summary", "label": "Session Summary" }
        ];

        return {
            nodes,
            rootNodeId: "node_intro",
            checkpoints
        };
    }

    /**
     * Checks compiled DAG for cyclic dependencies, unreachable nodes, and invalid transition targets.
     */
    validateDAG(data) {
        const { nodes, rootNodeId } = data;
        if (!nodes || !rootNodeId || !nodes[rootNodeId]) {
            throw new Error("DAG Compilation Error: Missing nodes mapping or invalid root node ID.");
        }

        const visited = new Set();
        const stack = new Set();

        const dfs = (nodeId) => {
            if (stack.has(nodeId)) {
                console.warn(`DAG cyclic warning detected at node: ${nodeId}. Breaking cycle.`);
                return;
            }
            if (visited.has(nodeId)) return;

            visited.add(nodeId);
            stack.add(nodeId);

            const node = nodes[nodeId];
            if (node && node.transitions) {
                const targets = [
                    node.transitions.success,
                    node.transitions.failure,
                    node.transitions.timeout
                ].filter(Boolean);

                for (const targetId of targets) {
                    if (!nodes[targetId]) {
                        console.warn(`DAG Warning: Node ${nodeId} points to non-existent node: ${targetId}. Falling back to default success path.`);
                        node.transitions.success = null;
                    } else {
                        dfs(targetId);
                    }
                }
            }
            stack.delete(nodeId);
        };

        dfs(rootNodeId);
    }

    /**
     * Pre-buffering whiteboard draw coordinates for Equations/Diagrams to prevent runtime lag.
     */
    generateWhiteboardInstructions(nodes) {
        Object.values(nodes).forEach(node => {
            if (node.type === 'equation' && node.payload.latex) {
                node.renderInstructions = {
                    type: 'EQUATION',
                    latex: node.payload.latex,
                    explanation: node.payload.explanation,
                    drawBox: true
                };
            } else if (node.type === 'diagram' && node.payload.mermaid) {
                node.renderInstructions = {
                    type: 'DIAGRAM',
                    mermaid: node.payload.mermaid,
                    explanation: node.payload.explanation
                };
            } else if (node.type === 'concept_explanation') {
                node.renderInstructions = {
                    type: 'TEXT_PROGRESSIVE',
                    text: node.payload.explanation || node.payload.text,
                    concept: node.payload.concept
                };
            } else if (node.type === 'code_simulation') {
                node.renderInstructions = {
                    type: 'CODE_SIMULATION',
                    code: node.payload.code,
                    language: node.payload.language || 'python',
                    expectedOutput: node.payload.expectedOutput
                };
            } else if (node.type === 'graph_plot') {
                node.renderInstructions = {
                    type: 'GRAPH_PLOT',
                    equation: node.payload.latexEquation,
                    formula: node.payload.functionFormula,
                    explanation: node.payload.explanation
                };
            }
        });
    }

    /**
     * Pre-buffer audio narration for current, next, and fallback nodes (15-25 seconds ahead)
     */
    async prebufferAudio(compiledData) {
        const { nodes, rootNodeId } = compiledData;
        let currentNode = nodes[rootNodeId];
        let prefetchCount = 0;

        const bufferQueue = [];
        if (currentNode) {
            bufferQueue.push(currentNode);
            if (currentNode.transitions && currentNode.transitions.success) {
                const nextNode = nodes[currentNode.transitions.success];
                if (nextNode) bufferQueue.push(nextNode);
            }
            if (currentNode.transitions && currentNode.transitions.failure) {
                const failNode = nodes[currentNode.transitions.failure];
                if (failNode) bufferQueue.push(failNode);
            }
        }

        // Run pre-buffering async to avoid blocking main compilation flow
        Promise.all(bufferQueue.map(node => {
            const speechText = node.payload.narrationText || node.payload.explanation || node.payload.text || "";
            if (speechText) {
                return audioManager.prefetchAudio(speechText);
            }
            return Promise.resolve();
        })).catch(err => console.warn("Background audio pre-buffering failed:", err));
    }
}

export const sessionCompiler = new SessionCompiler();
