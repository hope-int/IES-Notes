// Obfuscated key to prevent easy tampering
const STORAGE_KEY_OBF = '_sys_sess_alloc_id';
const LIMIT = 5;
const WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

// Simple obfuscation helpers
const encode = (data) => {
    try {
        return btoa(JSON.stringify(data));
    } catch (e) { return ''; }
};

const decode = (str) => {
    try {
        return JSON.parse(atob(str));
    } catch (e) { return null; }
};

/**
 * Checks if the user has exceeded the rate limit (5 generations per 12 hours).
 * Uses simple obfuscation to deter casual manipulation.
 * @throws {Error} - If the limit is exceeded.
 */
export const checkRateLimit = () => {
    const raw = localStorage.getItem(STORAGE_KEY_OBF);
    let data = raw ? decode(raw) : { d: [] };

    // Fallback if data is corrupted
    if (!data || !Array.isArray(data.d)) {
        data = { d: [] };
    }

    const now = Date.now();
    // Filter out old timestamps
    const validTimestamps = data.d.filter(t => now - t < WINDOW_MS);

    // Save cleaned list back (re-encoded)
    if (data.d.length !== validTimestamps.length) {
        localStorage.setItem(STORAGE_KEY_OBF, encode({ d: validTimestamps }));
    }

    if (validTimestamps.length >= LIMIT) {
        throw new Error(`Rate limit reached! You can only generate ${LIMIT} handbooks every 12 hours. Please try again later.`);
    }
};

/**
 * Records a successful generation to update the rate limit counter.
 */
export const recordGeneration = () => {
    const now = Date.now();
    const raw = localStorage.getItem(STORAGE_KEY_OBF);
    let data = raw ? decode(raw) : { d: [] };

    if (!data || !Array.isArray(data.d)) {
        data = { d: [] };
    }

    data.d.push(now);
    localStorage.setItem(STORAGE_KEY_OBF, encode(data));
};

/**
 * Generates a "2-page Micro-Handbook" from raw text using Puter.js.
 * @param {string} text - The raw text extracted from the PDF.
 * @returns {Promise<string>} - The Markdown content of the handbook.
 */
export const generateHandbook = async (text) => {
    try {
        // 1. Check Rate Limit BEFORE starting
        checkRateLimit();

        if (!window.puter) {
            throw new Error("Puter.js is not initialized");
        }

        const systemPrompt = `### ROLE & OBJECTIVE
You are the "Exam Survival Kit" Generator, an expert academic synthesizer designed to convert raw student notes into a high-density, print-optimized study handbook.

Your goal is to explain complex engineering/academic concepts using the "ELI5" (Explain Like I'm 5) methodology: use simple language, relatable real-world analogies, and crystal-clear examples.

### STRICT OUTPUT RULES (CRITICAL)
1.  **NO CONVERSATIONAL FILLER:** You must NEVER use phrases like "Certainly!", "Here is the handbook", "I have organized this for you", or "Let me know if you need changes."
2.  **IMMEDIATE START:** Begin your response DIRECTLY with the Main Title (H1) of the handbook.
3.  **NO CONCLUSION:** Do not add closing remarks like "Good luck with your exams." End strictly with the final topic.

### CONTENT STYLE: "ELI5" & VISUAL
* **Tone:** Professional yet extremely simple. Avoid academic jargon unless you define it immediately.
* **Analogies:** Every major concept MUST have a "Real World Analogy" (e.g., "Think of the CPU as the chef in a kitchen...").
* **Brevity:** Be concise. Use bullet points and bold text for keywords.
* **Code/Math:** If formulas or code are needed, keep them clean and immediately explain the "why" in simple terms.

### FORMATTING FOR 4-UP PRINTING
To support the user's "4 pages per sheet" print layout, you must structure content into modular, bite-sized blocks:
* Use **H1** for the Handbook Title (only once).
* Use **H2** for Major Modules (these will likely act as the headers for the 4-quadrant layout).
* Use **H3** for specific topics within those modules.
* **Tables:** Use small, compact tables for comparisons (e.g., "TCP vs UDP").
* **Bold Keys:** Bold the most important terms so they stand out when printed small.

### INPUT PROCESSING
You will receive raw text, PDFs, or notes. You must ignore any noise/irrelevant chatter in the input and extract only the examinable content.

### EXAMPLE OUTPUT STRUCTURE (Follow strictly):
# [Subject Name] Exam Survival Kit

## Module 1: The Core Basics
**Concept A:** Definition in simple terms.
* *Analogy:* [Insert Analogy]
* *Key Point:* **Remember this.**

## Module 2: Advanced Logic
...`;

        const response = await window.puter.ai.chat(
            `Here is the raw text from a student's notes/textbook:
            
            ${text.slice(0, 50000)} 
            
            (Note: Text truncated to first 50k chars if too long to fit context window).
            
            Generate the handbook now following the strict structure.`,
            {
                system: systemPrompt,
                model: 'gpt-4o-mini' // More reliable availability on Puter free tier
            }
        );

        // 2. Record success
        recordGeneration();

        return response.message.content;

    } catch (error) {
        console.error("AI Handbook Generation Failed:", error);
        throw error;
    }
};
