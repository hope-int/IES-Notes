
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


// Dedicated Groq Fetch for J-Compiler (Faster & More Reliable for Code)
const fetchGroqDirectly = async (messages, jsonMode) => {
    const groqKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqKey) throw new Error("Groq API Key Missing");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.1-8b-instant", // Use latest supported model
            messages,
            response_format: jsonMode ? { type: "json_object" } : undefined,
            temperature: 0.2 // Lower temperature for more deterministic code output
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq Direct Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
};

// Generic AI Completion Strategy
export const getAICompletion = async (messages, options = {}) => {
    const {
        jsonMode = false,
        model = "liquid/lfm-2.5-1.2b-instruct:free",
        onFallback = () => { },
        provider = "auto" // 'auto' | 'groq' | 'puter'
    } = options;

    // Strategy 1: Explicit Provider Request (e.g., J-Compiler requests Groq)
    if (provider === 'groq') {
        try {
            return await fetchGroqDirectly(messages, jsonMode);
        } catch (groqErr) {
            console.warn("Groq Direct failed, falling back to standard pipeline:", groqErr);
            // Fall through to standard pipeline
        }
    }

    // Strategy 2: Standard Pipeline (Puter -> Backend/OpenRouter)
    // 1. Primary: Puter.js
    let usePuter = isPuterHealthy();

    if (usePuter) {
        try {
            return await fetchPuter(messages, jsonMode);
        } catch (puterErr) {
            recordPuterFailure();
            console.warn("Puter.js failed. Switching to Backend/OpenRouter:", puterErr);
            if (onFallback) onFallback(`Puter Error: ${puterErr.message}. Switching to Fallback...`);
        }
    }

    // 2. Backup: Secure Backend (OpenRouter -> Groq Fallback)
    try {
        return await fetchBackendFallback(messages, model, jsonMode);
    } catch (backendErr) {
        // 3. Final Resort: Client-Side Groq (if backend fails)
        console.warn("Backend failed. Attempting Client-Side Groq Last Resort.");
        try {
            return await fetchGroqDirectly(messages, jsonMode);
        } catch (finalErr) {
            console.error("All AI Services Failed:", finalErr);
            throw new Error(`AI Failure: All providers exhausted.`);
        }
    }
};

// J-Compiler: Simulation & Debugging
export const simulateCodeExecution = async (code, language = "auto", inputs = []) => {
    const systemPrompt = `You are J-Compiler, an advanced AI Code Execution Engine acting as an INTERACTIVE TERMINAL.

    TASK:
    1. ANALYZE the provided code.
    2. DETECT the language (if 'auto').
    3. SIMULATE the execution step-by-step.
    4. HANDLE INPUTS:
       - Use the provided 'Inputs History' for any input/scan functions (scanf, input, cin, etc.) in order.
       - If the code encounters a read operation and there is NO corresponding input in history:
         -> STOP execution immediately.
         -> PREDICT the output up to that point.
         -> SET status to "input_required".
         -> SET inputPrompt to the text just before the cursor (e.g. "Enter number: ").
    
    5. PREDICT the precise console output.
    6. DETECT any Traceback/Compilation Errors.

    RESPONSE FORMAT (Strict JSON):
    {
      "language": "detected_language",
      "output": "The predicted console output so far...",
      "status": "success" | "error" | "input_required",
      "inputPrompt": "Prompt text for the user (only if input_required)",
      "errorExplanation": "Clear explanation of the bug (if error)",
      "fixedCode": "The corrected version of the code (if error)"
    }
    
    IMPORTANT: 
    - Be extremely accurate with output simulation.
    - "output" should include EVERYTHING printed to stdout.
    - IMPORTANT: Simulate a real terminal session. This means validation/echo of the 'Inputs History' should be reflected in the "output" string (e.g., if program asks "Name:" and history has "John", output should be "Name: John\n...").
    - If "input_required", the "output" must end exactly where the terminal waits.`;

    const messages = [
        { role: "system", content: systemPrompt },
        {
            role: "user",
            content: `Language: ${language}\n\nCode:\n${code}\n\nInputs History: ${JSON.stringify(inputs)}`
        }
    ];

    try {
        // Enforce Groq for J-Compiler
        const responseCallback = await getAICompletion(messages, { jsonMode: true, provider: 'groq' });

        let cleanResponse = responseCallback;
        if (responseCallback.includes('```json')) {
            cleanResponse = responseCallback.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        return JSON.parse(cleanResponse);
    } catch (e) {
        console.error("J-Compiler Simulation Failed:", e);
        throw new Error("Failed to simulate code execution.");
    }
};

// J-Compiler: Reverse Engineering (Output -> Code)
export const reverseEngineerCode = async (expectedOutput, language = "javascript") => {
    const systemPrompt = `You are J-Compiler, an Expert Reverse-Engineering AI.
    
    TASK:
    1. ANALYZE the 'Expected Output'.
    2. GENERATE the most efficient and clean code in the target 'Language' that produces EXACTLY this output.
    3. EXPLAIN your implementation logic briefly.
    
    RESPONSE FORMAT (Strict JSON):
    {
      "code": "The generated source code...",
      "explanation": "Brief explanation of how it works"
    }`;

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Target Language: ${language}\n\nExpected Output:\n${expectedOutput}` }
    ];

    try {
        // Enforce Groq for Reverse Engineering
        const responseCallback = await getAICompletion(messages, { jsonMode: true, provider: 'groq' });
        return JSON.parse(responseCallback);
    } catch (e) {
        console.error("J-Compiler Reverse Engineering Failed:", e);
        throw new Error("Failed to reverse engineer code.");
    }
};
