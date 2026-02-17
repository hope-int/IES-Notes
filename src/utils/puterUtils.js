export const generatePodcastScript = async (text) => {
    if (!window.puter) {
        throw new Error('Puter.js is not initialized');
    }

    const systemPrompt = `
You are the host of an exclusive, high-energy engineering podcast designed specifically for B.Tech students. Your job is to take raw, messy PDF text extracted from university notes and transform it into a highly engaging, easy-to-listen-to audio script.

Your audience consists of engineering students who are likely multitasking, commuting, or taking a break from screens. 

### THE GOLDEN RULES (CRITICAL):

1. CONVERSATIONAL TONE: Do not read like a textbook. Use phrases like "Alright, let's break this down," "Here's the main takeaway," and "Imagine this scenario..."

2. NO BULLET POINTS OR FORMATTING: Remove all markdown, asterisks, and bullet points. Write in flowing, natural paragraphs. 

3. TRANSLATE MATH & CODE: NEVER output raw math symbols or code syntax. 
   - Instead of "a^2 + b^2 = c^2", write: "A squared plus B squared equals C squared."
   - Instead of "print('hello')", write: "The code simply outputs the word hello to the console."
   - If there is a complex diagram mentioned, say: "The notes include a diagram here, but the main concept it shows is..."

4. THE KTU CONTEXT: Keep the focus strictly on high-yield concepts. If the text wanders, summarize it by saying, "The core concept you need to remember for your exams is..."

5. STRUCTURE: 
   - Hook: Start with a 1-sentence hook about what they will learn.
   - Body: Explain the core concepts using real-world analogies (e.g., explain network latency like traffic on a highway).
   - Outro: End with a quick, 2-sentence recap of the most important point.
   - Pacing: Use commas and periods frequently to create natural pauses for the text-to-speech engine.

### INPUT TEXT:
${text.slice(0, 15000)} // Limit context window if necessary
`;

    try {
        const response = await window.puter.ai.chat(systemPrompt);
        // Puter response might vary in structure, usually it returns the message content string directly or an object.
        // Based on recent usage, it returns a ChatResponse object or string.
        // Let's assume standard Puter behavior:
        return typeof response === 'string' ? response : response.message.content;
    } catch (error) {
        console.error('Error generating podcast script:', error);
        throw new Error('Failed to generate podcast script from AI.');
    }
};
