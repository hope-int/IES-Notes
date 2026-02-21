import { getAICompletion } from './aiService';

/**
 * Generates a "Blueprint" (Table of Contents) for the report.
 */
export const generateReportBlueprint = async (formData) => {
    const prompt = `
You are a Senior Research Analyst and Academic Architect.
Generate a comprehensive Table of Contents (Blueprint) for an academic report on: "${formData.topic}".

AUDIENCE: ${formData.audience}
TONE: ${formData.tone}
CUSTOM INSTRUCTIONS: ${formData.customInstructions || 'None'}

REQUIREMENTS:
1. Divide the report into 5-8 logical sections.
2. The first section must be "Executive Summary".
3. The last section must be "Conclusion & References".
4. For each section, provide a "heading" and a briefly described "brief" (what should be covered).

OUTPUT FORMAT: Strict JSON only.
{
  "title": "Full Academic Title",
  "blueprint": [
    { "heading": "Introduction", "brief": "Context, problem statement, and report scope." },
    ...
  ]
}
`;

    const response = await getAICompletion(
        [{ role: 'user', content: prompt }],
        { model: 'llama-3.3-70b-versatile' }
    );

    try {
        const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("Blueprint Parse Error:", e);
        throw new Error("Failed to generate report structure.");
    }
};

/**
 * Generates content for a specific section of the report.
 */
export const generateSectionContent = async (title, section, formData, previousSections = []) => {
    const context = previousSections.length > 0
        ? `Context from previous sections: ${previousSections.map(s => s.heading).join(', ')}`
        : '';

    const prompt = `
You are writing a section for an academic report titled "${title}".
SECTION HEADING: "${section.heading}"
SECTION BRIEF: "${section.brief}"

AUDIENCE: ${formData.audience}
TONE: ${formData.tone}
${context}

INSTRUCTIONS:
1. Write 2-4 authoritative, high-density paragraphs.
2. Use professional, analytical language.
3. If relevant, include data-driven assertions.
4. If this is the "References" section, provides 3-5 plausible academic citations.
5. CRITICAL: Do NOT use any Markdown formatting (no asterisks, no hashes, no bolding). Output pure, plain text only. We are simulating handwriting, and markdown symbols will break the simulation.

OUTPUT: Return ONLY the raw plain text content for this section. No Markdown, no JSON, no titles.
`;

    const content = await getAICompletion(
        [{ role: 'user', content: prompt }],
        { model: 'llama-3.3-70b-versatile' }
    );

    return content.trim();
};

/**
 * Enhances a short topic into a robust academic prompt.
 */
export const enhanceReportTopic = async (topic) => {
    const prompt = `Expand the following short topic into a formal, multi-sentence academic research prompt: "${topic}"`;
    const response = await getAICompletion([{ role: 'user', content: prompt }]);
    return response.trim();
};
