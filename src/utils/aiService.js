
const cleanAndParseJSON = (text) => {
    try {
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        // Simple heuristic for JSON array or object
        const firstBrace = cleaned.indexOf('{');
        const firstBracket = cleaned.indexOf('[');
        if (firstBrace === -1 && firstBracket === -1) throw e;
        const start = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket) ? firstBrace : firstBracket;
        const end = cleaned.lastIndexOf(start === firstBrace ? '}' : ']');
        return JSON.parse(cleaned.substring(start, end + 1));
    }
};

// Circuit Breaker State
let puterFailures = 0;
let puterDisabledUntil = 0;
const PUTER_FAILURE_THRESHOLD = 5; // Disable after 5 consecutive failures (More resilient)
const PUTER_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown (Try again sooner)

const isPuterHealthy = () => {
    if (Date.now() < puterDisabledUntil) return false;
    return true;
};

const recordPuterFailure = () => {
    puterFailures++;
    if (puterFailures >= PUTER_FAILURE_THRESHOLD) {
        puterDisabledUntil = Date.now() + PUTER_COOLDOWN_MS;
        console.warn(`Puter.js Circuit Breaker Tripped. Customized disabled for ${PUTER_COOLDOWN_MS / 1000}s.`);
    }
};

const recordPuterSuccess = () => {
    puterFailures = 0;
    puterDisabledUntil = 0;
};

// 1. Puter.js (Free, Serverless, No Key)
const fetchPuter = async (messages, jsonMode = false, retries = 3) => {
    if (!window.puter) {
        // Attempt to wait for it briefly (race condition fix)
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!window.puter) throw new Error("Puter.js library not loaded via CDN.");
    }

    const puterMessages = [...messages];
    if (jsonMode) {
        puterMessages.push({ role: 'system', content: "\n\nIMPORTANT: Respond in strict JSON format. Do not encompass the JSON in markdown code blocks." });
    }

    for (let i = 0; i < retries; i++) {
        try {
            // Call Puter.js
            const response = await window.puter.ai.chat(puterMessages);

            // If we got here, it worked
            recordPuterSuccess();

            if (response?.message?.content) {
                let content = response.message.content;
                if (Array.isArray(content)) {
                    return content.map(p => p.text || JSON.stringify(p)).join('');
                }
                return typeof content === 'string' ? content : JSON.stringify(content);
            }
            return response?.toString() || "";

        } catch (err) {
            console.warn(`Puter attempt ${i + 1} failed:`, err);
            // If it's the last retry, throw the error to be caught by the fallback
            if (i === retries - 1) throw err;
            // Wait before retrying (exponential backoff: 500ms, 1000ms, 2000ms)
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i)));
        }
    }
};

// Secure Backend Fallback (Vercel Serverless Function)
// Client-Side Fallback (FOR LOCAL DEV ONLY)
const fetchClientSideFallback = async (messages, model, jsonMode) => {
    // Try OpenRouter Client-Side
    try {
        const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
        if (!apiKey) throw new Error("Client-Side OpenRouter Key Missing");

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.origin,
            },
            body: JSON.stringify({
                model,
                messages,
                response_format: jsonMode ? { type: "json_object" } : undefined
            })
        });

        if (!response.ok) throw new Error(`OpenRouter Client Error: ${response.status}`);
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (orErr) {
        console.warn("Client-Side OpenRouter failed, trying Groq...", orErr);

        // Try Groq Client-Side
        const groqKey = import.meta.env.VITE_GROQ_API_KEY;
        if (!groqKey) throw new Error("Client-Side Groq Key Missing");

        const gResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-70b-8192",
                messages,
                response_format: jsonMode ? { type: "json_object" } : undefined
            })
        });

        if (!gResponse.ok) throw new Error(`Groq Client Error: ${gResponse.status}`);
        const gData = await gResponse.json();
        return gData.choices[0].message.content;
    }
};

// Secure Backend Fallback (Vercel Serverless Function) WITH Local Dev Support
const fetchBackendFallback = async (messages, model, jsonMode) => {
    try {
        const response = await fetch('/api/ai-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, model, jsonMode })
        });

        if (!response.ok) {
            // Local Dev Fallback (Vite)
            // If API returns 404 (Not Found) AND we are in Dev mode, use client-side keys
            if (response.status === 404 && import.meta.env.DEV) {
                console.warn("Backend API not found (Local Dev detection). Falling back to Client-Side Keys.");
                return await fetchClientSideFallback(messages, model, jsonMode);
            }

            const errorText = await response.text();
            throw new Error(`Backend Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return data.content;
    } catch (error) {
        console.error("Secure Backend Call Failed:", error);
        // If fetch failed completely (network error) and we are local, try client fallback
        if (import.meta.env.DEV) {
            console.warn("Backend fetch failed locally (Network Error). Trying client-side fallback...");
            return await fetchClientSideFallback(messages, model, jsonMode);
        }
        throw error;
    }
};

export const getAICompletion = async (messages, options = {}) => {
    const {
        jsonMode = false,
        model = "liquid/lfm-2.5-1.2b-instruct:free",
        onFallback = () => { }
    } = options;

    // 1. Primary: Puter.js
    // Check Circuit Breaker
    let usePuter = isPuterHealthy();

    if (usePuter) {
        try {
            return await fetchPuter(messages, jsonMode);
        } catch (puterErr) {
            recordPuterFailure();
            console.warn("Puter.js failed (Circuit Breaker Failure Recorded), switching to OpenRouter:", puterErr);
            if (onFallback) onFallback(`Puter Error: ${puterErr.message}. Switching to OpenRouter...`);
            // Proceed to fallbacks...
        }
    } else {
        console.warn("Puter.js is temporarily disabled due to recurring errors. Using OpenRouter.");
    }

    // 2. Backup: Secure Backend (OpenRouter -> Groq)
    try {
        return await fetchBackendFallback(messages, model, jsonMode);
    } catch (backendErr) {
        console.error("All AI Services Failed (Puter & Backend):", backendErr);
        throw new Error(`AI Failure: Puter (${usePuter ? 'Failed' : 'Circuit Breaker'}) & Backend (${backendErr.message})`);
    }
};
