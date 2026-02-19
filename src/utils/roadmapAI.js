
// Puter.js is loaded via CDN in index.html to avoid "already defined" custom element errors
const puter = window.puter;

export const generateRoadmap = async ({ goal, currentLevel, timeframe }) => {
  const prompt = `
You are an elite Tech Career Coach. Your job is to generate a step-by-step learning roadmap based on the user's goal and current skill level. 

You MUST output ONLY a valid JSON object with two arrays: "nodes" and "edges".

**User Details:**
- Goal: ${goal}
- Current Level: ${currentLevel}
- Timeframe: ${timeframe}

**Rules for Nodes:**
- Break the journey into 5 to 8 major milestones.
- Node \`id\` must be a simple string (e.g., "1", "2").
- \`status\` must be "completed" (if they already know it based on their prompt), "active" (the immediate next step), or "locked" (future steps).
- Ensure the first node is "completed" or "active" based on the user's level.
- Ensure only ONE node is "active" at a time (the first uncompleted step).

**JSON SCHEMA:**
{
  "nodes": [
    {
      "id": "1",
      "data": { 
        "label": "Python Basics", 
        "description": "Variables, Loops, Functions", 
        "status": "completed",
        "resource_hint": "Focus on memory management"
      },
      "position": { "x": 250, "y": 0 }
    },
    {
      "id": "2",
      "data": { 
        "label": "Object Oriented Python", 
        "description": "Classes, Inheritance, Dunder methods", 
        "status": "active",
        "resource_hint": "Build a simple banking system"
      },
      "position": { "x": 250, "y": 150 }
    }
  ],
  "edges": [
    { "id": "e1-2", "source": "1", "target": "2", "animated": true }
  ]
}
`;

  const maxRetries = 3;
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await puter.ai.chat(prompt, { model: 'arcee-ai/trinity-large-preview:free' });

      // Attempt to parse JSON from the response. 
      // Sometimes models wrap JSON in markdown blocks, so we clean it.
      let jsonString = response.message.content;
      jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();

      const data = JSON.parse(jsonString);

      // Add types to nodes for React Flow custom node
      const formattedNodes = data.nodes.map(node => ({
        ...node,
        type: 'custom',
      }));

      return { nodes: formattedNodes, edges: data.edges };
    } catch (error) {
      console.warn(`Roadmap generation attempt ${i + 1} failed:`, error);
      lastError = error;

      // If it's a network error or similar, wait and retry.
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // 1s, 2s wait
      }
    }
  }

  console.error("All roadmap generation attempts failed:", lastError);
  if (lastError.response) console.error("Error Response:", lastError.response);
  if (lastError.message) console.error("Error Message:", lastError.message);

  throw new Error(`Failed to generate roadmap after ${maxRetries} attempts. Please check your internet connection and try again.`);
};
