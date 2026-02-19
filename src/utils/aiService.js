
const cleanAndParseJSON = (text) => {
    try {
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        // Simple heuristic for JSON array or object
        const firstBrace = text.indexOf('{');
        const firstBracket = text.indexOf('[');
        if (firstBrace === -1 && firstBracket === -1) throw e;
        const start = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket) ? firstBrace : firstBracket;
        const end = text.lastIndexOf(start === firstBrace ? '}' : ']');
        return JSON.parse(text.substring(start, end + 1));
    }
};

// Circuit Breaker State
let puterFailures = 0;
let puterDisabledUntil = 0;
const PUTER_FAILURE_THRESHOLD = 5; // Disable after 5 consecutive failures
const PUTER_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown

const isPuterHealthy = () => {
    if (Date.now() < puterDisabledUntil) return false;
    return true;
};

const recordPuterFailure = () => {
    puterFailures++;
    if (puterFailures >= PUTER_FAILURE_THRESHOLD) {
        puterDisabledUntil = Date.now() + PUTER_COOLDOWN_MS;
        console.warn(`Puter.js Circuit Breaker Tripped. Disabled for ${PUTER_COOLDOWN_MS / 1000}s.`);
    }
};

const recordPuterSuccess = () => {
    puterFailures = 0;
    puterDisabledUntil = 0;
};

// Helper: Map abstract/OpenRouter models to valid Groq models
const getGroqModel = (requestedModel) => {
    // If it's already a known Groq model, return it
    const validGroqModels = [
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
        "llama-3.1-8b-instant",
        "llama3-70b-8192",
        "llama3-8b-8192",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
        "llama-3.2-11b-vision-preview",
        "llama-3.2-90b-vision-preview"
    ];
    if (validGroqModels.includes(requestedModel)) return requestedModel;

    // Map Vision models
    if (requestedModel.includes('vision') || requestedModel.includes('vl') || requestedModel.includes('gemini') || requestedModel.includes('gpt-4o')) {
        return "llama-3.2-11b-vision-preview"; // Best fallback for vision on Groq
    }

    // Map High Intelligence / Large models
    if (requestedModel.includes('gpt-4') || requestedModel.includes('claude-3-5') || requestedModel.includes('gpt-oss-20b') || requestedModel.includes('70b')) {
        return "llama-3.3-70b-versatile";
    }

    // Default fast model
    return "llama-3.1-8b-instant";
};

// 1. Puter.js (Free, Serverless, No Key)
const fetchPuter = async (messages, jsonMode = false, model = "arcee-ai/trinity-large-preview:free", retries = 2) => {
    if (!window.puter) {
        // Attempt to wait for it briefly
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!window.puter) throw new Error("Puter.js library not loaded via CDN.");
    }

    // Ensure model is valid for Puter (it doesn't support all OpenRouter models)
    // Puter free tier usually supports specific ones. We'll stick to the requested one if it looks generic,
    // or default to a safe one if it's a specific provider (like Groq/OpenAI specific).
    let targetModel = model;
    if (model.includes('gpt-') || model.includes('claude-') || model.includes('llama-')) {
        // Puter often behaves best with its default or specific free models
        targetModel = "arcee-ai/trinity-large-preview:free";
    }

    // Puter expects standard messages array
    const puterMessages = [...messages];
    if (jsonMode) {
        puterMessages.push({ role: 'system', content: "\n\nIMPORTANT: Respond in strict JSON format. Do not wrap the JSON in markdown code blocks." });
    }

    for (let i = 0; i < retries; i++) {
        try {
            const response = await window.puter.ai.chat(puterMessages, { model: targetModel });

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
            if (i === retries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
};

// Client-Side Fallback (Direct to API)
const fetchClientSideFallback = async (messages, model, jsonMode) => {
    // 1. Try OpenRouter First (Broadest Model Support)
    try {
        const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
        if (apiKey) {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.origin,
                },
                body: JSON.stringify({
                    model: model, // Use requested model for OpenRouter
                    messages,
                    response_format: jsonMode ? { type: "json_object" } : undefined
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices[0].message.content;
            } else {
                console.warn(`OpenRouter Client Error: ${response.status}`);
            }
        } else {
            console.warn("Client-Side OpenRouter Key Missing");
        }
    } catch (orErr) {
        console.warn("Client-Side OpenRouter failed, trying Groq...", orErr);
    }

    // 2. Try Groq (Fast, Reliable Fallback)
    const groqKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqKey) throw new Error("Client-Side Groq Key Missing");

    // Map to a valid Groq model
    const groqModel = getGroqModel(model);

    const gResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: groqModel,
            messages,
            response_format: jsonMode ? { type: "json_object" } : undefined
        })
    });

    if (!gResponse.ok) throw new Error(`Groq Client Error: ${gResponse.status}`);
    const gData = await gResponse.json();
    return gData.choices[0].message.content;
};

// Secure Backend Fallback (with Local Dev Bypass)
const fetchBackendFallback = async (messages, model, jsonMode) => {
    try {
        const response = await fetch('/api/ai-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, model, jsonMode })
        });

        if (!response.ok) {
            // Local Dev or 404 -> Client Side Keys
            if ((response.status === 404 && import.meta.env.DEV) || response.status === 500) {
                console.warn(`Backend API ${response.status}. Falling back to Client-Side Keys.`);
                return await fetchClientSideFallback(messages, model, jsonMode);
            }
            const errorText = await response.text();
            throw new Error(`Backend Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return data.content;
    } catch (error) {
        console.error("Secure Backend Call Failed:", error);
        if (import.meta.env.DEV) {
            return await fetchClientSideFallback(messages, model, jsonMode);
        }
        throw error;
    }
};

// Dedicated Groq Fetch (Direct)
const fetchGroqDirectly = async (messages, jsonMode, model) => {
    const groqKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqKey) throw new Error("Groq API Key Missing");

    // IMPORTANT: Ensure model is valid for Groq
    const validModel = getGroqModel(model);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: validModel,
            messages,
            response_format: jsonMode ? { type: "json_object" } : undefined,
            temperature: 0.1
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        // Try to recover content from validation error if present
        try {
            const errJson = JSON.parse(errText);
            if (errJson.error?.failed_generation) {
                return errJson.error.failed_generation;
            }
        } catch (e) { }
        throw new Error(`Groq Direct Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
};

// Generic AI Completion Strategy
export const getAICompletion = async (messages, options = {}) => {
    const {
        jsonMode = false,
        model = "llama-3.1-8b-instant",
        onFallback = () => { },
        provider = "auto" // 'auto' | 'groq' | 'puter'
    } = options;

    // Strategy 1: Explicit Groq
    if (provider === 'groq') {
        try {
            return await fetchGroqDirectly(messages, jsonMode, model);
        } catch (groqErr) {
            console.warn("Groq Direct failed, falling back to standard pipeline:", groqErr);
        }
    }

    // Strategy 2: Puter
    // Only use Puter if not disabled and no multimodal content (images) which Puter might not handle well via simple API
    // (Assuming Puter is text-focused for the free tier usually)
    let usePuter = isPuterHealthy() && provider !== 'backend';

    // Check for images in messages - Puter API might fail with complex array content
    const hasImages = messages.some(m => Array.isArray(m.content));
    if (hasImages) usePuter = false;

    if (usePuter) {
        try {
            return await fetchPuter(messages, jsonMode, model);
        } catch (puterErr) {
            recordPuterFailure();
            console.warn("Puter.js failed. Switching to Backend/fallback:", puterErr);
            if (onFallback) onFallback(`Puter Error. Switching to Fallback...`);
        }
    }

    // Strategy 3: Backend / Fallback
    try {
        return await fetchBackendFallback(messages, model, jsonMode);
    } catch (backendErr) {
        console.warn("Backend failed. Attempting Client-Side Groq Last Resort.");
        try {
            return await fetchGroqDirectly(messages, jsonMode, model);
        } catch (finalErr) {
            throw new Error(`AI Failure: All providers exhausted.`);
        }
    }
};

// J-Compiler: Simulation & Debugging
export const simulateCodeExecution = async (code, language = "auto", inputs = [], history = []) => {
    const systemPrompt = `You are J-Compiler (Engine: Llama-3.3-70B).
    
    TASK: Execute/Audit code with Zero-Tolerance for errors.

    SYSTEM RULES:
    1.  **AUDIT**: Flag ANY syntax/logic error (typos, loops, variables) as "status": "error".
    2.  **EXECUTE**: If clean, simulate FULL console session (prompts + logic) in "output".
    3.  **REASONING**: provide line-by-line logic trace.
    4.  **REPAIR**: If error, provide optimized "fixedCode" and Markdown "errorExplanation".
    5.  **CONTEXT**: Use the provided 'history' to recall previous definitions/context if relevant, but prioritize the current 'Code'.
    6.  **DBMS SIMULATION**: If the language is SQL, MySQL, or PostgreSQL:
        a) Simulate a persistent database state based on the provided code/history.
        b) If a valid SELECT/SHOW query is executed, return the result in a generic ASCII table format (like MySQL CLI).
        c) If schema modifications (CREATE/ALTER) or data changes (INSERT/UPDATE) occur, acknowledge them with "Query OK, N rows affected" in the output.
        d) Show errors for invalid SQL syntax or missing tables.

    JSON FORMAT:
    {
      "reasoning": "Brief trace",
      "language": "detected",
      "output": "Console stream",
      "status": "success" | "error",
      "errorExplanation": "### Audit Results\n- Bullet points",
      "fixedCode": "Full optimized source"
    }`;

    let contextMessage = "";
    if (history.length > 0) {
        contextMessage = "PREVIOUS CONTEXT (Memory):\n" + history.map((h, i) =>
            `[Interaction ${i + 1}]\nCode:\n${h.code}\nOutput:\n${h.result.output || h.result.errorExplanation}\n---\n`
        ).join("\n");
    }

    const messages = [
        { role: "system", content: systemPrompt },
        {
            role: "user",
            content: `${contextMessage}\nLanguage: ${language}\n\nCode:\n${code}`
        }
    ];

    try {
        // Use Groq directly with a high-intelligence model
        const responseText = await getAICompletion(messages, {
            jsonMode: true,
            provider: 'groq',
            model: 'llama-3.3-70b-versatile' // Explicitly use a supported high-end Groq model
        });
        return cleanAndParseJSON(responseText);
    } catch (e) {
        console.error("J-Compiler Simulation Failed:", e);
        throw new Error("Failed to simulate code execution.");
    }
};

// J-Compiler: Reverse Engineering (Output -> Code)
export const reverseEngineerCode = async (expectedOutput, language = "javascript") => {
    const systemPrompt = `You are J-Compiler Architect.
    
    TASK: Convert output to optimized code.
    1. ANALYZE 'Expected Output'.
    2. WRITE most efficient, error-free code in target 'Language'.
    
    JSON FORMAT:
    {
      "code": "Source",
      "explanation": "Logic"
    }`;

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Target Language: ${language}\n\nExpected Output:\n${expectedOutput}` }
    ];

    try {
        const responseCallback = await getAICompletion(messages, {
            jsonMode: true,
            provider: 'groq',
            model: 'llama-3.3-70b-versatile'
        });
        return cleanAndParseJSON(responseCallback);
    } catch (e) {
        console.error("J-Compiler Reverse Engineering Failed:", e);
        throw new Error("Failed to reverse engineer code.");
    }
};
