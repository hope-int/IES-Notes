import { getAICompletion } from './aiService';

/**
 * Analyzes an assignment prompt and generates a structured solution plan.
 */
export const generateAssignmentPlan = async (formData) => {
    const prompt = `
You are an Academic Specialist. Analyze the following assignment request:
TOPIC/QUESTION: "${formData.topic}"
SUBJECT: "${formData.subject || 'General'}"
AUDIENCE: ${formData.audience}

REQUIREMENTS:
1. Break the solution into 3-4 logical steps (e.g., Analysis, Core Arguments, Conclusion).
2. For each step, provide a "heading" and a "brief" of what will be drafted.

OUTPUT FORMAT: Strict JSON only.
{
  "title": "Assignment Synthesis",
  "steps": [
    { "heading": "Step Heading", "brief": "What will be solved here..." }
  ]
}
`;

    const response = await getAICompletion(
        [{ role: 'user', content: prompt }],
        { jsonMode: true, model: 'llama-3.3-70b-versatile' }
    );

    try {
        const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("Assignment Plan Parse Error:", e);
        throw new Error("Failed to analyze assignment.");
    }
};

/**
 * Solves a specific step of the assignment.
 */
export const solveAssignmentStep = async (title, step, formData, previousSteps = []) => {
    const context = previousSteps.length > 0
        ? `Context from previous work: ${previousSteps.map(s => s.heading).join(', ')}`
        : '';

    const prompt = `
You are solving part of an academic assignment titled "${title}".
CURRENT STEP: "${step.heading}"
INSTRUCTION: "${step.brief}"

SUBJECT: ${formData.subject || 'General'}
AUDIENCE: ${formData.audience}
${context}

REQUIREMENTS:
1. Write a high-quality, academically rigorous response for this specific part.
2. Use citations if necessary.
3. If this is a math/code problem, provide clear steps and explanations.

OUTPUT: Return ONLY the raw markdown/text solution for this step.
`;

    const content = await getAICompletion(
        [{ role: 'user', content: prompt }],
        { model: 'llama-3.3-70b-versatile' }
    );

    return content.trim();
};

/**
 * Generates a "Smart Scoring" rubric-based feedback for the completed assignment.
 */
export const generateSmartScore = async (title, fullContent) => {
    const prompt = `
Analyze the following assignment solution and provide a "Smart Score" report.
TITLE: "${title}"
CONTENT:
${fullContent}

REQUIREMENTS:
1. Provide a numerical score out of 100.
2. Evaluate 3 criteria: "Clarity", "Academic Depth", and "Structure".
3. Provide a one-sentence "Pro Tip" for improvement.

OUTPUT FORMAT: Strict JSON only.
{
  "overallScore": 85,
  "criteria": [
    { "name": "Clarity", "score": 90, "feedback": "Excellent flow..." },
    { "name": "Academic Depth", "score": 80, "feedback": "Well researched..." },
    { "name": "Structure", "score": 85, "feedback": "Logical progression..." }
  ],
  "proTip": "Add more primary source citations to strengthen the argument."
}
`;

    const response = await getAICompletion(
        [{ role: 'user', content: prompt }],
        { jsonMode: true, model: 'llama-3.3-70b-versatile' }
    );

    try {
        return JSON.parse(response.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) {
        return null; // Graceful failure for scoring
    }
};
