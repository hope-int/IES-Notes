import { getAICompletion } from './aiService';

/**
 * Generates a comprehensive project roadmap/blueprint.
 */
export const generateProjectBlueprint = async (formData) => {
    const prompt = `
You are an Expert Project Architect. 
Design a detailed execution roadmap for the following project: "${formData.topic}"
OBJECTIVE: "${formData.objective || 'General implementation'}"
COMPLEXITY: ${formData.complexity || 'Intermediate'}

REQUIREMENTS:
1. Divide the project into 4-6 key "Milestones".
2. For each milestone, provide a "title", "description", and 3-5 sub-tasks.
3. Include a "Tech Stack/Resources" list.

OUTPUT FORMAT: Strict JSON only.
{
  "projectTitle": "Official Project Name",
  "milestones": [
    {
      "title": "Milestone Title",
      "description": "Short explanation",
      "tasks": [
         { "id": "t1", "task": "Initial Research", "status": "todo" }
      ]
    }
  ],
  "resources": ["Resource 1", "Resource 2"]
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
        console.error("Project Blueprint Parse Error:", e);
        throw new Error("Failed to architect project.");
    }
};

/**
 * Expands a milestone or specific task into detailed instructions.
 */
export const expandProjectTask = async (projectTitle, milestone, task) => {
    const prompt = `
Provide detailed "Expert Execution Instructions" for a specific task within a project.
PROJECT: "${projectTitle}"
MILESTONE: "${milestone.title}"
TASK: "${task.task}"

REQUIREMENTS:
1. Provide a step-by-step technical guide.
2. Include "Potential Pitfalls" to avoid.
3. Suggest 1 professional tool or website to help.

OUTPUT: Return markdown content only.
`;

    const response = await getAICompletion(
        [{ role: 'user', content: prompt }],
        { model: 'llama-3.3-70b-versatile' }
    );

    return response.trim();
};
