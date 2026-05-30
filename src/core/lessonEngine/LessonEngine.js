import { ragEngine } from '../rag/RAGEngine';
import { getAICompletion } from '../../utils/aiService';
import { queueEngine } from '../queue/QueueEngine';
import { useLearningSessionStore } from '../../stores/useLearningSessionStore';

class LessonEngine {
    async buildSession(topic, profile = {}) {
        useLearningSessionStore.getState().setStatus('loading');
        
        // 1. Retrieve RAG Contexts
        const contextResults = await ragEngine.search(topic, 4);
        const contextText = contextResults.map(r => `Source: ${r.filename}\nContent: ${r.content}`).join('\n\n');
        
        // 2. Build system prompt for JSON-based Lesson Flow Structure
        const systemPrompt = `
You are the HOPE Autonomous Educational Intelligence System.
Your job is to generate a structured, pacing-controlled, adaptive educational lesson flow on the topic: "${topic}".

Analyze the student profile:
- Pacing Preference: ${profile.pacing || 'normal'}
- Target Depth: ${profile.depth || 'conceptual'}
- Weak Concepts identified: ${JSON.stringify(profile.weakConcepts || [])}

Here are the retrieved relevant document fragments to base your teaching on:
---
${contextText}
---

Generate a JSON array of lesson flow nodes. Each node represents a discrete educational event in the runtime queue.
Supported node types:
1. {"type": "intro", "payload": {"text": "A conversational verbal introduction (50-100 words) summarizing the goal. No formulas."}}
2. {"type": "concept_explanation", "payload": {"concept": "Concept Name", "explanation": "Detailed explanation using an analogy suitable for the student profile (100-200 words).", "narrationText": "Voiceover narration script."}}
3. {"type": "equation", "payload": {"latex": "KaTeX formatting of the key equation (e.g. 'f(x) = \\int_{-\\infty}^{\\infty} g(t) dt')", "explanation": "Verbal explanation of variables."}}
4. {"type": "diagram", "payload": {"mermaid": "Valid Mermaid diagram representing the flow or structure.", "explanation": "Narration text describing the flow."}}
5. {"type": "quiz", "payload": {"question": "Interactive multiple choice question to assess understanding.", "options": ["Option A", "Option B", "Option C", "Option D"], "answer": "Correct option text", "explanation": "Detailed logic if they fail."}}
6. {"type": "summary", "payload": {"text": "A wrap-up narration recapping the main takeaways."}}

Return ONLY the raw JSON array. Start with [ and end with ]. Do not include markdown code block formatting like \`\`\`json.
`;

        try {
            const response = await getAICompletion([
                { role: 'user', content: systemPrompt }
            ], {
                actionType: 'compiler',
                jsonMode: true,
                temperature: 0.2
            });

            // Parse response JSON safely
            let lessonNodes = [];
            try {
                let cleaned = response.trim();
                if (cleaned.startsWith('```')) {
                    cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '').trim();
                }
                lessonNodes = JSON.parse(cleaned);
            } catch (err) {
                console.error("Failed to parse JSON response, attempting regex recovery", err);
                const match = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
                if (match) {
                    lessonNodes = JSON.parse(match[0]);
                } else {
                    throw new Error("Invalid educational sequence format returned by AI.");
                }
            }

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
    async injectAnalogiesOrPrerequisites(concept, query) {
        // Triggered when student answers a quiz wrong or requests clarification
        console.log(`Adapting learning path for: ${concept}`);
        
        const systemPrompt = `
Generate a quick, supportive, highly intuitive analogy or simplified explanation (50-80 words) to clear up confusion on the concept: "${concept}".
Also include a quick slide update or simple equation.

Respond in strict JSON object format:
{
  "analogyText": "Your intuitive real-world analogy explanation.",
  "latexEquation": "A simplified supportive equation or null."
}
`;
        try {
            const response = await getAICompletion([
                { role: 'user', content: systemPrompt }
            ], {
                actionType: 'compiler',
                jsonMode: true,
                temperature: 0.7
            });

            const data = JSON.parse(response.trim().replace(/^```json\s*/, '').replace(/```$/, ''));
            
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
