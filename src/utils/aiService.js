import { supabase } from './../supabaseClient';
import { v4 as uuidv4 } from 'uuid';

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

// --- Secure Rate Limiting System ---
const RATE_LIMITS = {
    chat: { count: 100, windowMs: 10 * 60 * 1000 },
    ppt: { count: 3, windowMs: 60 * 60 * 1000 },
    report: { count: 5, windowMs: 60 * 60 * 1000 },
    project: { count: 5, windowMs: 60 * 60 * 1000 },
    assignment: { count: 10, windowMs: 60 * 60 * 1000 },
    compiler: { count: 50, windowMs: 30 * 60 * 1000 },
    roadmap: { count: 10, windowMs: 60 * 60 * 1000 },
    default: { count: 20, windowMs: 5 * 60 * 1000 }
};

// Get or Create anonymous Session ID
const getSessionId = () => {
    let sid = localStorage.getItem('anon_session_id');
    if (!sid) {
        sid = uuidv4();
        localStorage.setItem('anon_session_id', sid);
    }
    return sid;
};

// Client-Side Fallback Limiter (if DB check fails)
const fallbackLocalRateLimit = (actionType, limits) => {
    const key = `rate_limit_local_${actionType}`;
    const now = Date.now();
    let history = [];
    try {
        const stored = localStorage.getItem(key);
        if (stored) history = JSON.parse(stored);
    } catch (e) { history = []; }

    history = history.filter(t => now - t < limits.windowMs);
    if (history.length >= limits.count) {
        const waitMins = Math.ceil((limits.windowMs - (now - history[0])) / 60000);
        throw new Error(`Rate limit exceeded for ${actionType}. Please wait ${waitMins} minute(s).`);
    }
    history.push(now);
    localStorage.setItem(key, JSON.stringify(history));
    return true;
};

export const checkRateLimit = async (actionType) => {
    const limits = RATE_LIMITS[actionType] || RATE_LIMITS.default;
    const windowMinutes = Math.max(1, Math.round(limits.windowMs / 60000));

    try {
        // Attempt Server-Side RPC
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || null;
        const sessionId = getSessionId();

        const { data: isAllowed, error } = await supabase.rpc('check_rate_limit', {
            p_user_id: userId,
            p_session_id: sessionId,
            p_action_type: actionType,
            p_limit_count: limits.count,
            p_window_minutes: windowMinutes
        });

        if (error) {
            console.warn("RPC Rate Limit failed, falling back to local...", error);
            return fallbackLocalRateLimit(actionType, limits);
        }

        if (!isAllowed) {
            throw new Error(`Rate limit exceeded for ${actionType}. Please wait ${windowMinutes} minute(s).`);
        }

        return true;
    } catch (err) {
        // If it's our own error, throw it
        if (err.message.includes('Rate limit exceeded')) throw err;

        // Network/DB error fallback
        console.warn("DB Rate Limit Check Failed:", err);
        return fallbackLocalRateLimit(actionType, limits);
    }
};
// ----------------------------


// ----------------------------

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
const getProviderModel = (model, provider) => {
    if (provider === 'puter') {
        // Map common aliases to official Puter slugs
        if (model.includes('grok-4.1-non-reasoning')) return "grok-4-1-fast-non-reasoning";
        if (model.includes('grok-4.1')) return "grok-4-1-fast";
        if (model.includes('gpt-5-nano')) return "gpt-5-nano";
        if (model.includes('arcee')) return "arcee-ai/trinity-large-preview:free";
        return model.replace(/\./g, '-'); // Puter prefers hyphens over dots
    }
    if (provider === 'openrouter') {
        if (model.includes('grok-4.1-non-reasoning')) return "x-ai/grok-4.1-fast";
        if (model.includes('grok') && !model.includes('/')) return `x-ai/${model}`;
        if (model.includes('gpt-') && !model.includes('/')) return `openai/${model}`;
        if (model.includes('claude-') && !model.includes('/')) return `anthropic/${model}`;
        return model;
    }
    if (provider === 'groq') {
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
        if (validGroqModels.includes(model)) return model;
        if (model.includes('grok') || model.includes('gpt-4') || model.includes('claude-3-5')) return "llama-3.3-70b-versatile";
        if (model.includes('vision') || model.includes('vl') || model.includes('gpt-4o')) return "llama-3.2-11b-vision-preview";
        return "llama-3.1-8b-instant";
    }
    return model;
};

// 1. Puter.js (Free, Serverless, No Key)
const fetchPuter = async (messages, modelOptions = {}, retries = 2) => {
    const { model = "arcee-ai/trinity-large-preview:free", jsonMode = false, ...params } = modelOptions;
    if (!window.puter) {
        await new Promise(resolve => setTimeout(resolve, 800));
        if (!window.puter) throw new Error("Puter.js not ready.");
    }

    const targetModel = getProviderModel(model, 'puter');
    const puterMessages = [...messages];
    if (jsonMode) {
        puterMessages.push({ role: 'system', content: "\n\nIMPORTANT: Respond in strict JSON format." });
    }

    for (let i = 0; i < retries; i++) {
        try {
            const response = await window.puter.ai.chat(puterMessages, {
                model: targetModel,
                stream: false,
                ...params
            });

            if (response?.message?.content) {
                let content = response.message.content;
                return Array.isArray(content) ? content.map(p => p.text || JSON.stringify(p)).join('') : (typeof content === 'string' ? content : JSON.stringify(content));
            }
            return response?.toString() || "";
        } catch (err) {
            const errorMsg = err?.message || err?.toString() || "";
            // Authentication (401) or Rate Limit (429) errors should trigger a silent fallback
            if (errorMsg.includes('401') || errorMsg.includes('429') || err?.status === 401 || err?.status === 429) {
                throw new Error("Puter Limitation");
            }
            console.warn(`Puter attempt ${i + 1} failed:`, errorMsg);
            if (i === retries - 1) {
                recordPuterFailure();
                throw err;
            }
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }
};

// Client-Side Fallback (Direct to API)
const fetchClientSideFallback = async (messages, modelOptions) => {
    const { model = "grok-4.1-non-reasoning", jsonMode, ...params } = modelOptions;

    // Fallback 1: OpenRouter
    try {
        const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
        if (apiKey) {
            const targetModel = getProviderModel(model, 'openrouter');
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.origin,
                    "X-Title": "HOPE Edu Hub"
                },
                body: JSON.stringify({
                    model: targetModel,
                    messages,
                    response_format: jsonMode ? { type: "json_object" } : undefined,
                    ...params
                })
            });
            if (response.ok) {
                const data = await response.json();
                return { content: data.choices?.[0]?.message?.content || "", provider: "OpenRouter" };
            } else {
                console.warn(`OpenRouter Fail Status: ${response.status}`);
            }
        }
    } catch (e) { console.warn("OpenRouter fallback attempt failed."); }

    // Fallback 2: Groq
    try {
        const groqKey = import.meta.env.VITE_GROQ_API_KEY;
        if (groqKey) {
            const groqModel = getProviderModel(model, 'groq');
            const gResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: groqModel,
                    messages,
                    response_format: jsonMode ? { type: "json_object" } : undefined,
                    ...params
                })
            });
            if (gResponse.ok) {
                const gData = await gResponse.json();
                return { content: gData.choices?.[0]?.message?.content || "", provider: "Groq" };
            }
        }
    } catch (e) {
        console.error("Groq fallback completely failed.");
    }

    throw new Error("All AI Fallbacks Exhausted");
};

const fetchBackendFallback = async (messages, modelOptions) => {
    try {
        const response = await fetch('/api/ai-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(modelOptions)
        });
        if (!response.ok) {
            if (import.meta.env.DEV || response.status === 500) return await fetchClientSideFallback(messages, modelOptions);
            throw new Error(`Backend Error ${response.status}`);
        }
        const data = await response.json();
        return { content: data.content, provider: "Backend API" };
    } catch (error) {
        if (import.meta.env.DEV) return await fetchClientSideFallback(messages, modelOptions);
        throw error;
    }
};

export const getAICompletion = async (messages, options = {}) => {
    const {
        actionType = "chat",
        provider = "auto",
        onFallback = () => { },
        onProgress = () => { }, // New: Support UI progress updates
        model = "grok-4.1-non-reasoning",
        includeMetadata = false,
        ...restOptions
    } = options;

    const startTime = Date.now();
    const modelOptions = { model, ...restOptions };

    onProgress({ step: 'rate-limit', message: 'Checking Rate Limits...' });
    await checkRateLimit(actionType);

    let resultData = null;
    const canUsePuter = isPuterHealthy() && provider !== 'backend' && !messages.some(m => Array.isArray(m.content));

    if (canUsePuter) {
        try {
            onProgress({ step: 'querying', message: 'Querying Puter.js (Primary)...', provider: 'Puter Cloud' });
            const content = await fetchPuter(messages, modelOptions);
            resultData = { content, provider: "Puter Cloud", model: getProviderModel(model, 'puter') };
        } catch (e) {
            console.warn("Puter failed/limited, dropping to secondary fallbacks.");
            onProgress({ step: 'fallback', message: 'Switching to OpenRouter...', provider: 'OpenRouter' });
            if (onFallback) onFallback("Switching to OpenRouter...");
        }
    }

    if (!resultData) {
        try {
            if (provider !== 'client' && !import.meta.env.DEV) {
                onProgress({ step: 'querying', message: 'Querying Backend API...', provider: 'Backend' });
                resultData = await fetchBackendFallback(messages, modelOptions);
            } else {
                onProgress({ step: 'querying', message: 'Querying OpenRouter (Fallback)...', provider: 'OpenRouter' });
                resultData = await fetchClientSideFallback(messages, modelOptions);
            }
        } catch (e) {
            console.error("All providers failed.");
            onProgress({ step: 'error', message: 'All AI Providers Failed' });
            throw e;
        }
    }

    const endTime = Date.now();
    const duration = (endTime - startTime);

    onProgress({ step: 'completed', message: 'Response Received', duration });

    if (includeMetadata) {
        return { ...resultData, time: (duration / 1000).toFixed(2) };
    }
    return resultData.content;
};

export const simulateCodeExecution = async (code, language = "auto", inputs = [], history = []) => {
    const systemPrompt = `<personality>Elite Syntax Auditor & Runtime Simulator.</personality>
    <rules>
    1. SYNTAX AUDIT: Before simulating, perform a BRUTAL syntax check. Look for:
       - PYTHON: Incorrect indentation (THIS IS CRITICAL), missing colons, invalid variable names.
       - C/C++: Missing semicolons, unmatched braces, undefined types.
       - JS: Syntax errors, unclosed strings.
    2. CRASH FIRST: If a syntax error is found, STOP immediately. Set status:"error" and explain exactly which line and why (e.g., "IndentationError: expected an indented block on line 2").
    3. DETAILED LOGIC: If code is valid, provide a step-by-step execution reasoning.
    4. RAW OUTPUT: In "output", generate EXACT terminal text.
       - If Python/JS code is just a class/function with no calls, output should be empty or a subtle message like "# Symbols defined."
       - If there are print statements, show their literal output.
       - EMBEDDED/ARDUINO: If isEmbedded is true, show "Virtual Hardware Logs" in the Serial Monitor even if Serial.print is missing (e.g. "[PIN 13] -> HIGH", "Delay 1000ms"). Show the loop execution for at least 2 cycles.
    5. INTERACTION: Simulate interactive prompts clearly.
    6. MERMAID: If code has loops or if-statements, generate a "mermaidGraph".
       - ALWAYS use square brackets: A["Label Text"] for ALL nodes. NEVER use A(text) or A{text}.
       - STRIP: Remove any colons, backticks, or unquoted parentheses from inside labels.
    </rules>
    <response_format>JSON: { reasoning, language, isEmbedded, output, serialMonitor, status, errorExplanation, fixedCode, mermaidGraph }</response_format>`;

    const contextMessage = history.length > 0 ? history.map((h, i) => `[Mem ${i + 1}] Code:${h.code} Out:${h.result.output || 'ERR'}`).join("\n") : "";

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `History:\n${contextMessage}\nLang: ${language}\nCode:\n${code}` }
    ];

    try {
        const resultWithMeta = await getAICompletion(messages, {
            jsonMode: true,
            model: 'grok-4.1-non-reasoning',
            temperature: 0.1,
            max_tokens: 2048,
            actionType: 'compiler',
            includeMetadata: true
        });
        const parsed = cleanAndParseJSON(resultWithMeta.content);
        return { ...parsed, _metadata: { time: resultWithMeta.time, provider: resultWithMeta.provider, model: resultWithMeta.model } };
    } catch (e) {
        throw new Error("Compiler simulation failed.");
    }
};

// J-Compiler: Reverse Engineering (Output -> Code)
export const reverseEngineerCode = async (expectedOutput, language = "javascript") => {
    const systemPrompt = `<personality>Reverse Engineering Engine.</personality>
    <rules>
    1. INPUT ANALYSIS: Analyze the provided terminal output or error text.
    2. CODE RECOVERY: Generate the most efficient logic/code that produces this exact output.
    3. ERROR DIAGNOSTICS: If the input is an error/crash log, explain the cause of the crash in "explanation" and provide the fix in "code".
    </rules>
    <response_format>JSON: { code, explanation, reasoning }</response_format>`;
    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Lang: ${language}\nOutput:\n${expectedOutput}` }
    ];

    try {
        const resultWithMeta = await getAICompletion(messages, {
            jsonMode: true,
            model: 'grok-4.1-non-reasoning',
            temperature: 0.1,
            max_tokens: 1500,
            actionType: 'compiler',
            includeMetadata: true
        });
        const parsed = cleanAndParseJSON(resultWithMeta.content);
        return { ...parsed, _metadata: { time: resultWithMeta.time, provider: resultWithMeta.provider, model: resultWithMeta.model } };
    } catch (e) {
        throw new Error("Reverse engineering failed.");
    }
};
