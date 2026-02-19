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

CRITICAL INSTRUCTION: Return ONLY the raw script text. Do not include "Here is your script", intros, outros, or markdown formatting like \`\`\`. Start directly with the Hook.

### INPUT TEXT:
${text.slice(0, 15000)} // Limit context window if necessary
`;

    try {
        const response = await window.puter.ai.chat(systemPrompt);
        let content = typeof response === 'string' ? response : response.message.content;

        // Cleanup AI artifacts
        content = content.replace(/```[\s\S]*?```/g, (match) => {
            // If it's a code block, try to extract the content inside if it looks like text, 
            // otherwise remove it. But usually the whole script is inside ```text ... ```
            return match.replace(/```[a-z]*\n?|```/g, "");
        });

        // Remove common prefixes
        content = content.replace(/^Here is the.*?script.*?:/i, "").trim();
        content = content.replace(/^Sure.*?script.*?:/i, "").trim();

        return content;
    } catch (error) {
        console.error('Error generating podcast script:', error);
        throw new Error('Failed to generate podcast script from AI.');
    }
};

export const checkPodcastRateLimit = async () => {
    if (!window.puter) return true; // Fallback for dev

    try {
        const key = 'podcast_usage_v1';
        const limit = 13;
        const windowMs = 12 * 60 * 60 * 1000; // 12 hours

        let usage = await window.puter.kv.get(key) || [];
        if (!Array.isArray(usage)) usage = [];

        const now = Date.now();
        usage = usage.filter(ts => now - ts < windowMs);

        return usage.length < limit;
    } catch (err) {
        console.error("Rate limit check failed", err);
        return true;
    }
};

export const recordPodcastUsage = async () => {
    if (!window.puter) return;

    try {
        const key = 'podcast_usage_v1';
        const windowMs = 12 * 60 * 60 * 1000;

        let usage = await window.puter.kv.get(key) || [];
        if (!Array.isArray(usage)) usage = [];

        const now = Date.now();
        usage = usage.filter(ts => now - ts < windowMs);
        usage.push(now);

        await window.puter.kv.set(key, usage);
    } catch (err) {
        console.error("Failed to record usage", err);
    }
};

// Helper to split text for TTS limits
const splitTextForTTS = (text, limit = 2500) => {
    if (text.length <= limit) return [text];

    const chunks = [];
    let currentChunk = "";

    // Split by sentence roughly to preserve flow
    const sentences = text.match(/[^.!?]+[.!?]+[\])'"]*|[^.!?]+$/g) || [text];

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > limit) {
            if (currentChunk.trim()) chunks.push(currentChunk);
            currentChunk = sentence;
        } else {
            currentChunk += sentence;
        }
    }
    if (currentChunk.trim()) chunks.push(currentChunk);

    return chunks;
};

export const generateAndSavePodcastAudio = async (text, podcastId) => {
    if (!window.puter) throw new Error("Puter.js not initialized");

    try {
        const textChunks = splitTextForTTS(text);
        const audioBlobs = [];

        console.log(`Generating audio in ${textChunks.length} chunks...`);

        for (const chunk of textChunks) {
            // Generate audio for chunk
            const audioObj = await window.puter.ai.txt2speech(chunk);
            const src = audioObj.src || audioObj; // Handle object or string URL

            if (!src) throw new Error("No audio source returned for chunk");

            // Fetch and store blob
            const response = await fetch(src);
            const blob = await response.blob();
            audioBlobs.push(blob);
        }

        // Combine all blobs into one MP3
        // MP3s can typically be concatenated simply by appending the streams
        const combinedBlob = new Blob(audioBlobs, { type: 'audio/mp3' });

        // Save to Puter FileSystem
        const fileName = `podcast_${podcastId}.mp3`;
        await window.puter.fs.write(fileName, combinedBlob);

        return fileName;
    } catch (err) {
        console.error("Audio generation failed:", err);
        throw new Error("Failed to generate audio file.");
    }
};
