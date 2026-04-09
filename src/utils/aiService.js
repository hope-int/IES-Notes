import { supabase } from './../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { getOrderedProviders, getUserKey, getUserModel, getVaultSettings, initVault, sanitizeKey, isProviderEnabled } from './keyVault';
// ensurePuterReady: waits for window.puter CDN global — no SDK mutations.
// Only called inside fetchPuter (lazy — on actual AI requests, not module load).
import { ensurePuterReady } from './puterInit';

// Initialize vault once (lazy, non-blocking)
let _vaultReady = false;
const ensureVault = () => {
    if (_vaultReady) return Promise.resolve();
    return initVault().then(() => { _vaultReady = true; }).catch(() => {});
};
// Kick off immediately on module load (best-effort)
ensureVault();

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

// Circuit Breaker State (Persistent)
let puterFailures = Number(localStorage.getItem('puter_failures')) || 0;
let puterDisabledUntil = Number(localStorage.getItem('puter_disabled_until')) || 0;
const PUTER_FAILURE_THRESHOLD = 3; // Lower threshold (faster skip)
const PUTER_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown if persistent failure

const isPuterHealthy = () => {
    if (Date.now() < puterDisabledUntil) return false;
    return true;
};

const recordPuterFailure = (isConnectionError = false) => {
    puterFailures++;
    localStorage.setItem('puter_failures', puterFailures);
    
    // If it's a confirmed socket/connection error, disable for longer immediately
    if (isConnectionError || puterFailures >= PUTER_FAILURE_THRESHOLD) {
        puterDisabledUntil = Date.now() + PUTER_COOLDOWN_MS;
        localStorage.setItem('puter_disabled_until', puterDisabledUntil);
        console.warn(`Puter.js Circuit Breaker Tripped. Disabled for ${PUTER_COOLDOWN_MS / 60000}m.`);
    }
};

const recordPuterSuccess = () => {
    puterFailures = 0;
    puterDisabledUntil = 0;
    localStorage.removeItem('puter_failures');
    localStorage.removeItem('puter_disabled_until');
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
        // Default to a free model — users with BYOK should not get 402 surprises.
        // They can override via the vault model selector if they want paid models.
        if (model.includes('grok-4.1-non-reasoning')) return "meta-llama/llama-3.3-70b-instruct:free";
        if (model.includes('grok') && !model.includes('/')) return "meta-llama/llama-3.1-70b-instruct:free";
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
    if (provider === 'gemini') {
        // Default to Gemini 2.0 Flash — fastest, generous free quota
        if (model.includes('gemini')) return model; // pass through if already a gemini model
        return 'gemini-2.0-flash';
    }
    return model;
};

// 1. Puter.js (Free, Serverless, No Key)
const fetchPuter = async (messages, modelOptions = {}, retries = 2) => {
    const { model = "arcee-ai/trinity-large-preview:free", jsonMode = false, ...params } = modelOptions;

    // Wait for Puter CDN global to be ready. ensurePuterReady() is a shared,
    // idempotent promise — concurrent calls reuse the same poll loop.
    // No SDK mutations occur here or in puterInit. See puterInit.js header.
    try {
        await ensurePuterReady({ timeoutMs: 5000 });
    } catch {
        throw new Error("Puter.js not ready.");
    }
    if (!window.puter) throw new Error("Puter.js not ready.");


    const targetModel = getUserModel('puter') || getProviderModel(model, 'puter');

    const puterMessages = [...messages];
    if (jsonMode) {
        puterMessages.push({ role: 'system', content: "\n\nIMPORTANT: Respond in strict JSON format." });
    }

    for (let i = 0; i < retries; i++) {
        try {
            // Enhanced: Add timeout to prevent forever-hangs on bad WebSocket connections
            const puterPromise = window.puter.ai.chat(puterMessages, {
                model: targetModel,
                stream: false,
                ...params
            });

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Puter Timeout")), 45000) // 45s — enough for long AI responses
            );


            const response = await Promise.race([puterPromise, timeoutPromise]);

            if (response?.message?.content) {
                let content = response.message.content;
                recordPuterSuccess(); // Ensure healthy status is recorded
                return Array.isArray(content) ? content.map(p => p.text || JSON.stringify(p)).join('') : (typeof content === 'string' ? content : JSON.stringify(content));
            }
            return response?.toString() || "";
        } catch (err) {
            const errorMsg = err?.message || err?.toString() || "";
            const isConnectionError = errorMsg.toLowerCase().includes('websocket') || 
                                    errorMsg.toLowerCase().includes('failed to fetch') ||
                                    errorMsg.toLowerCase().includes('networkerror') ||
                                    errorMsg.toLowerCase().includes('socket') ||
                                    errorMsg.toLowerCase().includes('connection established') ||
                                    errorMsg.toLowerCase().includes('unknown_url_scheme') ||
                                    errorMsg.toLowerCase().includes('unknown url') ||
                                    errorMsg.toLowerCase().includes('closed before the connection');

            // Authentication (401), Rate Limit (429), Timeout or Socket/Scheme Error should trigger a silent fallback
            if (errorMsg.includes('401') || errorMsg.includes('429') || errorMsg.includes('Timeout') || isConnectionError || err?.status === 401 || err?.status === 429) {
                recordPuterFailure(isConnectionError);
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
    let rateLimited = false; // track if 429 was the failure reason

    // ── Fallback 1: OpenRouter — with free-model rotation on 429 ─────────────
    // Each free model has its own rate-limit pool. On 429, we rotate through
    // all of them before giving up. New API key does NOT reset the 429 —
    // OpenRouter rate-limits by IP on free tier, not by key.
    try {
        const apiKey = sanitizeKey(getUserKey('openrouter'));
        if (apiKey && isProviderEnabled('openrouter')) {
            const preferredModel = getUserModel('openrouter') || getProviderModel(model, 'openrouter');

            const FREE_MODEL_ROTATION = [
                'meta-llama/llama-3.3-70b-instruct:free',
                'meta-llama/llama-3.1-8b-instruct:free',
                'google/gemma-3-12b-it:free',
                'mistralai/mistral-7b-instruct:free',
                'qwen/qwen3-8b:free',
            ];

            const orPost = (useModel) => fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.origin,
                    "X-Title": "HOPE Studio"
                },
                body: JSON.stringify({
                    model: useModel,
                    messages,
                    max_tokens: params.max_tokens || 8192,
                    response_format: jsonMode ? { type: "json_object" } : undefined,
                    ...params
                })
            });

            const first = await orPost(preferredModel);

            if (first.ok) {
                const data = await first.json();
                return { content: data.choices?.[0]?.message?.content || "", provider: "OpenRouter" };
            }

            // 402 = paid model needs credits, 429 = rate limited → both trigger model rotation
            if (first.status === 402 || first.status === 429) {
                console.info(`[OpenRouter] ${first.status} on "${preferredModel}" — rotating free models.`);
                for (const freeModel of FREE_MODEL_ROTATION) {
                    if (freeModel === preferredModel) continue;
                    try {
                        const retry = await orPost(freeModel);
                        if (retry.ok) {
                            const rData = await retry.json();
                            console.info(`[OpenRouter] Served by: ${freeModel}`);
                            return { content: rData.choices?.[0]?.message?.content || "", provider: "OpenRouter" };
                        }
                        if (retry.status !== 429 && retry.status !== 402) break; // hard error, stop
                        console.info(`[OpenRouter] ${freeModel} also limited (${retry.status}), trying next.`);
                    } catch { /* network error on this model, try next */ }
                }
                rateLimited = true;
                console.info("[OpenRouter] All free models exhausted — falling through to Groq.");
            } else {
                console.info(`[OpenRouter] HTTP ${first.status} — falling through.`);
            }
        }
    } catch (e) { console.info("[OpenRouter] Skipped:", e.message); }


    // ── Fallback 2: Groq (user's key only, if enabled) ────────────────────────
    try {
        const groqKey = sanitizeKey(getUserKey('groq'));
        if (groqKey && isProviderEnabled('groq')) {
            const groqModel = getUserModel('groq') || getProviderModel(model, 'groq');
            const groqMaxTokens = Math.min(params.max_tokens || 8192, 8192);
            const gResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: groqModel,
                    messages,
                    response_format: jsonMode ? { type: "json_object" } : undefined,
                    ...params,
                    max_tokens: groqMaxTokens
                })
            });
            if (gResponse.ok) {
                const gData = await gResponse.json();
                const gChoice = gData.choices?.[0];
                if (gChoice?.finish_reason === 'length') {
                    console.warn(`[Groq] Truncated. Model: ${groqModel}, max_tokens: ${groqMaxTokens}`);
                }
                return { content: gChoice?.message?.content || '', provider: 'Groq' };
            }
            if (gResponse.status === 429) rateLimited = true;
        }
    } catch (e) { console.warn("[Groq] Request failed:", e.message); }

    // ── Fallback 3: Google Gemini (user's key only, if enabled) ────────────────
    // Uses Google's OpenAI-compatible endpoint — same request format as OpenRouter.
    try {
        const geminiKey = sanitizeKey(getUserKey('gemini'));
        if (geminiKey && isProviderEnabled('gemini')) {
            const geminiModel = getUserModel('gemini') || getProviderModel(model, 'gemini');
            const gResp = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${geminiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: geminiModel,
                    messages,
                    max_tokens: Math.min(params.max_tokens || 8192, 8192),
                })
            });
            if (gResp.ok) {
                const gData = await gResp.json();
                const gChoice = gData.choices?.[0];
                console.info(`[Gemini] Served by: ${geminiModel}`);
                return { content: gChoice?.message?.content || '', provider: 'Gemini' };
            }
            if (gResp.status === 429) rateLimited = true;
            else console.info(`[Gemini] HTTP ${gResp.status} — falling through.`);
        }
    } catch (e) { console.warn('[Gemini] Request failed:', e.message); }

    // All providers exhausted
    if (rateLimited) {
        throw new Error("RATE_LIMITED: Free-tier limit reached. Wait ~30s then retry, or enable a backup provider in AI Settings.");
    }
    throw new Error("No working API key found. Please add your keys in AI Settings → ⚙️");
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

// Per-action token budget — ensures responses are NEVER cut off mid-sentence
const ACTION_TOKEN_BUDGETS = {
    chat:       16000,  // Long explanations, code blocks, doc generation
    compiler:    4096,  // Structured JSON output, keep tight
    roadmap:     8192,  // JSON with nodes/edges, moderate size
    report:     12000,  // Report sections can be lengthy
    ppt:         8192,  // Presentation slides
    project:     8192,  // Project briefs
    assignment: 10000,  // Full assignment write-ups
    default:     8192   // Catch-all
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

    // Apply token budget: caller-supplied max_tokens always wins; otherwise use per-action default
    const defaultTokens = ACTION_TOKEN_BUDGETS[actionType] ?? ACTION_TOKEN_BUDGETS.default;
    const modelOptions = {
        model,
        max_tokens: defaultTokens,  // Global default — overridden if caller explicitly sets it
        ...restOptions              // Caller's options (including max_tokens) take precedence
    };

    onProgress({ step: 'rate-limit', message: 'Checking Rate Limits...' });
    await checkRateLimit(actionType);

    // ── Vault-aware provider chain ─────────────────────────────────────────
    // Build ordered list from vault; fall back to hardcoded order if vault not
    // ready yet (first-load race condition).
    await ensureVault();
    const orderedProviders = getOrderedProviders(); // sorted, filtered by enabled
    const puterEntry   = orderedProviders.find(p => p.id === 'puter');
    const clientEntry  = orderedProviders.find(p => p.id === 'openrouter' || p.id === 'groq');

    let resultData = null;

    // 1. Puter (if enabled in vault AND healthy AND no image content)
    const canUsePuter = puterEntry && isPuterHealthy()
        && provider !== 'backend'
        && !messages.some(m => Array.isArray(m.content));

    if (canUsePuter) {
        try {
            onProgress({ step: 'querying', message: 'Querying Puter.js (Primary)...', provider: 'Puter Cloud' });
            const content = await fetchPuter(messages, modelOptions);
            resultData = { content, provider: "Puter Cloud", model: getProviderModel(model, 'puter') };
        } catch (e) {
            console.warn("Puter failed/limited, dropping to client-side fallbacks.");
            onProgress({ step: 'fallback', message: 'Switching to next provider...', provider: 'OpenRouter' });
            if (onFallback) onFallback("Switching to next provider...");
        }
    }

    // 2. Client-side providers (OpenRouter → Groq, with vault key injection)
    //    Always attempted when Puter fails — NOT gated on vault being ready.
    //    fetchClientSideFallback handles missing keys gracefully via env fallback.
    if (!resultData) {
        try {
            if (provider !== 'client' && !import.meta.env.DEV) {
                onProgress({ step: 'querying', message: 'Querying Backend API...', provider: 'Backend' });
                resultData = await fetchBackendFallback(messages, modelOptions);
            } else {
                const nextName = clientEntry?.name || 'OpenRouter';
                onProgress({ step: 'querying', message: `Querying ${nextName}...`, provider: nextName });
                resultData = await fetchClientSideFallback(messages, modelOptions);
            }
        } catch (e) {
            console.error("All client-side providers failed:", e.message);
            onProgress({ step: 'error', message: 'All AI Providers Failed' });
            throw new Error("All AI providers are disabled or failed. Please check your AI Settings.");
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
    3. DETAILED LOGIC: If code is valid, provide a step-by-step execution reasoning. If input is static data (JSON/Object), explain its structure and potential usage.
    4. RAW OUTPUT: In "output", generate EXACT terminal text.
       - If Python/JS code is just a class/function with no calls, show "Status: Symbols Registered / Schema Parsed." or similar.
       - If the input is PURE DATA (JSON/YAML/Arrays), provide a "Data Hub Map" or "Internal Schema Map" summary in the output.
       - If there are print statements, show their literal output.
       - EMBEDDED/ARDUINO: If isEmbedded is true, show "Virtual Hardware Logs" in the Serial Monitor even if Serial.print is missing (e.g. "[PIN 13] -> HIGH", "Delay 1000ms"). Show the loop execution for at least 2 cycles.
    5. INTERACTION: Simulate interactive prompts clearly.
    6. MERMAID: Generate a "mermaidGraph" if the input has logic (loops/ifs) OR if it has structural data (Nested Objects/JSON/Arrays).
       - FORMAT: Use "graph TD" and ensure each statement is on a NEW LINE or separated by a semicolon (;).
       - FOR JSON/DATA: Create a tree structure where Root is the object name, and keys are child nodes.
       - QUOTED LABELS: ALWAYS use the syntax ID["Label Text"] or ID["Label<br/>Line2"] for ALL nodes. The quotes are MANDATORY.
       - STRIP: Remove any colons (:), backticks, or unquoted parentheses from inside labels to prevent syntax crashes.
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
