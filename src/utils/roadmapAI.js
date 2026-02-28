import { getAICompletion } from './aiService';

const cleanAndParseJSON = (text) => {
  try {
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const endBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && endBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, endBrace + 1);
    }
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON Parse Error:", e, "\\nOriginal Text:", text);
    throw new Error("Failed to parse AI response.");
  }
};

export const generateRoadmap = async (answers) => {
  const prompt = `
You are an elite Tech Career Coach and Curriculum Architect. 
Generate a HIGHLY DETAILED, strict JSON roadmap based on this student profile:
- Goal: ${answers.q1}
- Current Level: ${answers.q2}
- DSA Comfort: ${answers.q3}
- Learning Style: ${answers.q4}
- Timeline: ${answers.q5}

CRITICAL INSTRUCTIONS:
1. You must break the journey into 4 to 6 "main" phases/milestones.
2. For EVERY main phase, you must generate 2 to 4 "sub" topics that branch off horizontally from the main phase. 
3. You should generate at least 15+ total nodes.
4. If timeline is "Panic Mode", skip fundamentals; focus strictly on high-yield exam/interview topics.
5. Use a strict Grid System for coordinates:
   - Main nodes MUST be positioned at y: 0, y: 250, y: 500, y: 750, etc. (x: 250).
   - Sub-nodes MUST be positioned at the same y-level as their parent but with x offsets of -250 or +250 (e.g., x: 0 or x: 500).
   - Ensure absolutely NO nodes overlap. Include "type": "smoothstep" on all edges.

You MUST output ONLY a valid JSON object with "nodes" and "edges".

**JSON SCHEMA:**
{
  "nodes": [
    {
      "id": "1",
      "data": { 
        "label": "Phase 1: Main Topic", 
        "eli5_analogy": "Think of HTML as a Lego house...", 
        "action_steps": [
          "Step 1: Get the bricks",
          "Step 2: Build the walls"
        ],
        "status": "completed" | "active" | "locked",
        "nodeType": "main" 
      },
      "position": { "x": 250, "y": 0 }
    }
  ],
  "edges": [
    { "id": "e1-1a", "source": "1", "target": "1a", "animated": true }
  ]
}

Always explain the concept using a simple, real-world analogy (like Legos, cooking, or video games). 
Break the learning path into 3 to 5 actionable, bite-sized steps written in extremely simple language.
`;

  const maxRetries = 3;
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const jsonString = await getAICompletion(
        [{ role: 'user', content: prompt }],
        { jsonMode: true, model: 'arcee-ai/trinity-large-preview:free', actionType: 'roadmap' }
      );

      const data = cleanAndParseJSON(jsonString);

      if (!data.nodes || !data.edges) {
        throw new Error("Invalid format: nodes or edges array missing");
      }

      // Add types to nodes for React Flow custom node
      const formattedNodes = data.nodes.map(node => ({
        ...node,
        type: 'custom',
      }));

      return { nodes: formattedNodes, edges: data.edges };
    } catch (error) {
      console.warn(`Roadmap generation attempt ${i + 1} failed:`, error);
      lastError = error;

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  console.error("All roadmap generation attempts failed:", lastError);
  throw new Error(`Failed to generate roadmap after ${maxRetries} attempts.`);
};
