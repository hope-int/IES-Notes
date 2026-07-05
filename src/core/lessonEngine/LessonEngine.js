import { ragEngine } from '../rag/RAGEngine';
import { getAICompletion, FREE_MODEL_ROUTING } from '../../utils/aiService';
import { queueEngine } from '../queue/QueueEngine';
import { useLearningSessionStore } from '../../stores/useLearningSessionStore';
import { parseAIJSON } from '../../utils/jsonUtils';

class LessonEngine {
    async buildSession(topic, profile = {}) {
        useLearningSessionStore.getState().setStatus('loading');
        
        // 1. Retrieve RAG Contexts
        const contextResults = await ragEngine.search(topic, 4);
        const contextText = contextResults.map(r => `Source: ${r.filename}\nContent: ${r.content}`).join('\n\n');
        
        // 2. Build system prompt for JSON-based Lesson Flow Structure
        const systemPrompt = `Role: HOPE Educational Lesson Generator for "${topic}".
Profile: Pacing=${profile.pacing||'normal'}, Depth=${profile.depth||'conceptual'}, Weak=${JSON.stringify(profile.weakConcepts||[])}.
Fragments: ${contextText}.
Output: Raw JSON array of nodes ONLY. No markdown fences. Supported types:
- {"type": "intro", "payload": {"text": "Intro text (50-100 words)"}}
- {"type": "concept_explanation", "payload": {"concept": "Name", "explanation": "Analogy explanation (100-200 words)", "narrationText": "script"}}
- {"type": "equation", "payload": {"latex": "KaTeX", "explanation": "var explanation"}}
- {"type": "diagram", "payload": {"mermaid": "Mermaid", "explanation": "script"}}
- {"type": "quiz", "payload": {"question": "Q", "options": ["A", "B", "C", "D"], "answer": "correct text", "explanation": "remediation explanation"}}
- {"type": "summary", "payload": {"text": "Recap text"}}`;

        try {
            const response = await getAICompletion([
                { role: 'user', content: systemPrompt }
            ], {
                actionType: 'compiler',
                jsonMode: true,
                model: FREE_MODEL_ROUTING.CONTENT_PRIMARY,
                temperature: 0.2
            });

            const lessonNodes = parseAIJSON(response);

            // Convert lesson nodes to queue engine items
            const queueItems = lessonNodes.map((node, index) => {
                let duration = 6000; // default
                if (node.type === 'concept_explanation' || node.type === 'intro' || node.type === 'summary') {
                    const wordCount = (node.payload.text || node.payload.explanation || "").split(/\s+/).length;
                    duration = Math.max(5000, wordCount * 350); // ~170 words per minute pacing
                } else if (node.type === 'equation') {
                    duration = 8000;
                } else if (node.type === 'diagram') {
                    duration = 12000;
                } else if (node.type === 'quiz') {
                    duration = 30000; // interactive, waits for input
                }

                return {
                    id: `node_${index}_${crypto.randomUUID().slice(0,8)}`,
                    type: node.type,
                    status: 'pending',
                    priority: 0,
                    duration,
                    payload: node.payload
                };
            });

            const sessionId = crypto.randomUUID();
            useLearningSessionStore.getState().setSessionId(sessionId);
            useLearningSessionStore.getState().setProfile(profile);
            
            queueEngine.setQueue(queueItems);
            useLearningSessionStore.getState().setStatus('active');
            
            // Auto start queue
            queueEngine.start();

            return sessionId;
        } catch (error) {
            console.error("Failed to build learning session:", error);
            useLearningSessionStore.getState().setStatus('idle');
            throw error;
        }
    }

    // Dynamic adaptation flow (Interruption concept revision)
    async injectAnalogiesOrPrerequisites(concept) {
        // Triggered when student answers a quiz wrong or requests clarification
        console.log(`Adapting learning path for: ${concept}`);
        
        const systemPrompt = `Explain "${concept}" simply (50-80 words) with an analogy. Include a simplified supportive equation or null.
Format: JSON object only: {"analogyText": "string", "latexEquation": "string or null"}`;
        try {
            const response = await getAICompletion([
                { role: 'user', content: systemPrompt }
            ], {
                actionType: 'compiler',
                jsonMode: true,
                model: FREE_MODEL_ROUTING.CONTENT_PRIMARY,
                temperature: 0.7
            });

            const data = parseAIJSON(response);
            
            const explanationItems = [
                {
                    type: 'concept_explanation',
                    payload: {
                        concept: `Clarification: ${concept}`,
                        explanation: data.analogyText,
                        text: data.analogyText
                    },
                    duration: data.analogyText.split(/\s+/).length * 400
                }
            ];

            if (data.latexEquation) {
                explanationItems.push({
                    type: 'equation',
                    payload: {
                        latex: data.latexEquation,
                        explanation: "Supportive equation."
                    },
                    duration: 6000
                });
            }

            // Interrupt queue and inject explanation
            queueEngine.interrupt(explanationItems);
        } catch (err) {
            console.error("Failed to adapt pacing/explanation:", err);
        }
    }
}

export const lessonEngine = new LessonEngine();
