import { getAICompletion, FREE_MODEL_ROUTING } from './aiService';

// Obfuscated key to prevent easy tampering
const STORAGE_KEY_OBF = '_sys_sess_alloc_id';
const LIMIT = 5;
const WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

// Simple obfuscation helpers
const encode = (data) => {
    try {
        return btoa(JSON.stringify(data));
    } catch { return ''; }
};

const decode = (str) => {
    try {
        return JSON.parse(atob(str));
    } catch { return null; }
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

        const systemPrompt = `Role: Exam Survival Kit Synth. Convert notes to print-optimized ELI5 study handbook.
Rules: Begin directly with Main Title (H1). No conversational intro/outro. Focus on concise bullet points, bold key terms.
ELI5 Style: Use simple terms and a "Real World Analogy" for major concepts.
Format:
- H1 for Title (once)
- H2 for major Modules (supports 4-up printing layout)
- H3 for topics
- Small comparison tables (e.g. TCP vs UDP)
Structure:
# [Subject] Exam Survival Kit
## Module 1: The Core Basics
**Concept A:** ELI5 definition.
* *Analogy:* think of...
* *Key Point:* **remember this.**`;

        const content = await getAICompletion(
            [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: `Here is the raw text from a student's notes/textbook:
            
            ${text.slice(0, 50000)} 
            
            (Note: Text truncated to first 50k chars if too long to fit context window).
            
            Generate the handbook now following the strict structure.`
                }
            ],
            {
                actionType: 'handbook',
                model: FREE_MODEL_ROUTING.HANDBOOK_PRIMARY,
                max_tokens: 32000,
                temperature: 0.4
            }
        );

        // 2. Record success
        recordGeneration();

        return content;

    } catch (error) {
        console.error("AI Handbook Generation Failed:", error);
        throw error;
    }
};
