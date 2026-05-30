import { supabase } from './../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { getOrderedProviders, getUserKey, getUserModel, initVault, sanitizeKey, isProviderEnabled } from './keyVault';
// ensurePuterReady: waits for window.puter CDN global — no SDK mutations.
// Only called inside fetchPuter (lazy — on actual AI requests, not module load).
import { ensurePuterReady } from './puterInit';
import { logAIChatTelemetry } from './telemetry';

const PRIMARY_REASONING_MODEL = 'z-ai/glm-4.7-flash';
const PUTER_CHAT_TUTOR_MODEL = 'z-ai/glm-4.7-flash';
const PUTER_JCOMPILER_MODEL = 'z-ai/glm-4.7-flash';
const PUTER_MODEL_LABELS = {
    'z-ai/glm-4.7-flash': 'GLM-4.7 Flash',
    'poolside/laguna-m.1:free': 'Laguna M.1',
    'poolside/laguna-xs.2:free': 'Laguna XS.2',
    'z-ai/glm-4.6v-flash': 'GLM-4.6V Flash',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free': 'Nemotron 3 Omni'
};
const PUTER_MODEL_OUTPUT_LIMITS = {
    'z-ai/glm-4.7-flash': 8192,
    'poolside/laguna-m.1:free': 8192,
    'poolside/laguna-xs.2:free': 8192,
    'z-ai/glm-4.6v-flash': 8192,
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free': 8192
};

const getStreamText = (chunk) => {
    if (!chunk) return '';
    if (typeof chunk === 'string') return chunk;
    if (typeof chunk.text === 'string') return chunk.text;
    if (typeof chunk.content === 'string') return chunk.content;
    if (typeof chunk.message?.content === 'string') return chunk.message.content;
    if (typeof chunk.delta?.content === 'string') return chunk.delta.content;
    if (typeof chunk.choices?.[0]?.delta?.content === 'string') return chunk.choices[0].delta.content;
    if (typeof chunk.choices?.[0]?.message?.content === 'string') return chunk.choices[0].message.content;
    return '';
};

const readOpenAIStream = async (response, onToken) => {
    const reader = response.body?.getReader();
    if (!reader) return { content: '', finishReason: null };

    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let finishReason = null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
            const dataLines = event
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.startsWith('data:'))
                .map(line => line.slice(5).trim());

            for (const dataLine of dataLines) {
                if (!dataLine || dataLine === '[DONE]') continue;
                try {
                    const payload = JSON.parse(dataLine);
                    const choice = payload.choices?.[0];
                    const token = getStreamText(choice || payload);
                    if (token) {
                        content += token;
                        onToken?.(token, content);
                    }
                    if (choice?.finish_reason) finishReason = choice.finish_reason;
                } catch {
                    // Ignore malformed keep-alive chunks.
                }
            }
        }
    }

    return { content, finishReason };
};

const readCompletionResponse = async (response, onToken) => {
    if (onToken) return readOpenAIStream(response, onToken);
    const data = await response.json();
    const choice = data.choices?.[0];
    return {
        content: choice?.message?.content || '',
        finishReason: choice?.finish_reason || null
    };
};

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
    } catch { history = []; }

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

// ─── Enhanced Health Record & Circuit Breaker ──────────────────────────────
export const PUTER_FIRST_ROSTER = [
    { id: "z-ai/glm-4.7-flash", priority: 0, caps: ["reasoning", "code", "fast-chat"] },
    { id: "poolside/laguna-m.1:free", priority: 1, caps: ["code", "compiler"] },
    { id: "poolside/laguna-xs.2:free", priority: 2, caps: ["json", "code"] },
    { id: "z-ai/glm-4.6v-flash", priority: 3, caps: ["vision", "reasoning", "code"] },
    { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", priority: 4, caps: ["reasoning", "code", "fallback"] },
    { id: "default", priority: 5, caps: ["fast-chat", "code", "json", "fallback"] }
];

class EnhancedHealthRecord {
    constructor(modelId, capabilities = []) {
        this.modelId = modelId;
        this.capabilities = capabilities;
        this.rollingSuccesses = 0;
        this.rollingFailures = 0;
        this.latencies = []; // Last 20 request durations
        this.cooldownUntil = 0;
    }
}

let _healthRegistry = {};

const loadHealthRegistry = () => {
    try {
        const stored = JSON.parse(localStorage.getItem('hope_ai_health_records') || '{}');
        const registry = {};
        PUTER_FIRST_ROSTER.forEach(m => {
            const record = new EnhancedHealthRecord(m.id, m.caps);
            if (stored[m.id]) {
                record.rollingSuccesses = stored[m.id].rollingSuccesses || 0;
                record.rollingFailures = stored[m.id].rollingFailures || 0;
                record.latencies = stored[m.id].latencies || [];
                record.cooldownUntil = stored[m.id].cooldownUntil || 0;
            }
            registry[m.id] = record;
        });
        _healthRegistry = registry;
    } catch (e) {
        PUTER_FIRST_ROSTER.forEach(m => {
            _healthRegistry[m.id] = new EnhancedHealthRecord(m.id, m.caps);
        });
    }
};

const saveHealthRegistry = () => {
    try {
        localStorage.setItem('hope_ai_health_records', JSON.stringify(_healthRegistry));
    } catch {}
};

loadHealthRegistry();

const getP95Latency = (record) => {
    if (!record.latencies || record.latencies.length === 0) return 0;
    const sorted = [...record.latencies].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index];
};

const getSuccessRate = (record) => {
    const total = record.rollingSuccesses + record.rollingFailures;
    return total === 0 ? 1.0 : record.rollingSuccesses / total;
};

const isPuterModelHealthy = (model) => {
    const record = _healthRegistry[model];
    return !record || Date.now() >= record.cooldownUntil;
};

const isPuterHealthy = () =>
    PUTER_FIRST_ROSTER.some(m => isPuterModelHealthy(m.id));

const isPuterModelId = (model = '') =>
    typeof model === 'string' && (model === 'default' || PUTER_FIRST_ROSTER.some(m => m.id === model));

const recordPuterFailure = (model, reason = 'transient') => {
    const record = _healthRegistry[model];
    if (record) {
        record.rollingFailures++;
        let duration = 2 * 60 * 1000; // default 2 mins
        if (reason === 'auth') duration = 60 * 60 * 1000;
        else if (reason === 'rate-limit') {
            duration = 15 * 60 * 1000;
            // Cooldown other non-default models since Puter rate limits IP-wide
            PUTER_FIRST_ROSTER.forEach(m => {
                if (m.id !== 'default' && m.id !== model) {
                    const otherRecord = _healthRegistry[m.id];
                    if (otherRecord && otherRecord.cooldownUntil < Date.now() + 5 * 60 * 1000) {
                        otherRecord.cooldownUntil = Date.now() + 5 * 60 * 1000; // 5-minute pre-emptive cooldown
                    }
                }
            });
        }
        record.cooldownUntil = Date.now() + duration;
        saveHealthRegistry();
        console.warn(`[Puter Breaker] ${model} cooling down for ${Math.ceil(duration / 1000)}s after ${reason}.`);
    }
};

const recordPuterUsageLog = (model, latency) => {
    try {
        const logStr = localStorage.getItem('hope_puter_usage_history') || '[]';
        let logs = JSON.parse(logStr);
        if (!Array.isArray(logs)) logs = [];
        logs.push({
            timestamp: Date.now(),
            model,
            latency
        });
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        logs = logs.filter(log => log.timestamp >= thirtyDaysAgo);
        localStorage.setItem('hope_puter_usage_history', JSON.stringify(logs));
        window.dispatchEvent(new CustomEvent('hope_puter_usage_updated'));
    } catch (e) {
        console.error("Failed to log Puter usage:", e);
    }
};

const recordPuterSuccess = (model, latency = 0) => {
    const record = _healthRegistry[model];
    if (record) {
        record.rollingSuccesses++;
        if (latency > 0) {
            record.latencies.push(latency);
            if (record.latencies.length > 20) record.latencies.shift();
        }
        saveHealthRegistry();
    }
    recordPuterUsageLog(model, latency);
};

const selectModelChain = (caps = []) => {
    const healthy = PUTER_FIRST_ROSTER.filter(m => isPuterModelHealthy(m.id));
    const matches = healthy.filter(m => caps.every(c => m.caps.includes(c)));
    const sorted = (matches.length > 0 ? matches : healthy).sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const rateA = getSuccessRate(_healthRegistry[a.id]);
        const rateB = getSuccessRate(_healthRegistry[b.id]);
        if (rateA !== rateB) return rateB - rateA;
        return getP95Latency(_healthRegistry[a.id]) - getP95Latency(_healthRegistry[b.id]);
    });
    return sorted.map(m => m.id);
};

const classifyPuterError = (err) => {
    const message = (err?.message || err?.toString() || '').toLowerCase();
    const status = err?.status || err?.code;

    if (status === 401 || message.includes('401') || message.includes('unauthorized')) return 'auth';
    if (status === 429 || message.includes('429') || message.includes('rate limit') || message.includes('quota')) return 'rate-limit';
    if (message.includes('timeout')) return 'timeout';
    if (
        message.includes('websocket') ||
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('socket') ||
        message.includes('connection established') ||
        message.includes('unknown_url_scheme') ||
        message.includes('unknown url') ||
        message.includes('closed before the connection')
    ) return 'transport';
    if (
        status === 404 ||
        message.includes('not found') ||
        message.includes('unavailable') ||
        message.includes('overloaded') ||
        message.includes('model')
    ) return 'model';

    return 'unknown';
};

// Helper: Map abstract/OpenRouter models to valid Groq models
const getProviderModel = (model, provider) => {
    const modelId = model || PRIMARY_REASONING_MODEL;
    if (provider === 'puter') {
        if (modelId.includes('poolside/laguna-xs.2')) return PUTER_JCOMPILER_MODEL;
        return PUTER_CHAT_TUTOR_MODEL;
    }
    if (provider === 'openrouter') {
        // Default to a free model — users with BYOK should not get 402 surprises.
        // They can override via the vault model selector if they want paid models.
        if (modelId.includes('inclusionai/') || modelId.includes('poolside/')) return PRIMARY_REASONING_MODEL;
        if (modelId.includes('grok') && !modelId.includes('/')) return "meta-llama/llama-3.1-70b-instruct:free";
        if (modelId.includes('gpt-') && !modelId.includes('/')) return `openai/${modelId}`;
        if (modelId.includes('claude-') && !modelId.includes('/')) return `anthropic/${modelId}`;
        return modelId;
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
        if (validGroqModels.includes(modelId)) return modelId;
        if (modelId.includes('grok') || modelId.includes('gpt-4') || modelId.includes('claude-3-5')) return "llama-3.3-70b-versatile";
        if (modelId.includes('vision') || modelId.includes('vl') || modelId.includes('gpt-4o')) return "llama-3.2-11b-vision-preview";
        return "llama-3.1-8b-instant";
    }
    if (provider === 'gemini') {
        // Default to Gemini 2.0 Flash — fastest, generous free quota
        if (modelId.includes('gemini')) return modelId; // pass through if already a gemini model
        return 'gemini-2.0-flash';
    }
    return modelId;
};

// --- Puter Request Queue System ---
class PuterRequestQueue {
    constructor(maxConcurrency = 1, delayBetweenRequestsMs = 1000) {
        this.maxConcurrency = maxConcurrency;
        this.delayBetweenRequestsMs = delayBetweenRequestsMs;
        this.queue = [];
        this.running = 0;
        this.lastFinishedTime = 0;
    }

    async enqueue(fn) {
        console.info(`[Puter Queue] Enqueuing request (Pending queue length: ${this.queue.length})`);
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.processNext();
        });
    }

    async processNext() {
        if (this.running >= this.maxConcurrency || this.queue.length === 0) {
            return;
        }

        const now = Date.now();
        const timeSinceLastFinish = now - this.lastFinishedTime;
        const delayNeeded = Math.max(0, this.delayBetweenRequestsMs - timeSinceLastFinish);

        if (delayNeeded > 0) {
            setTimeout(() => this.processNext(), delayNeeded);
            return;
        }

        const item = this.queue.shift();
        if (!item) return;

        const { fn, resolve, reject } = item;
        this.running++;

        try {
            console.info(`[Puter Queue] Processing request (Active: ${this.running})`);
            const result = await fn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.running--;
            this.lastFinishedTime = Date.now();
            console.info(`[Puter Queue] Request finished (Active: ${this.running}, Delaying next by ${this.delayBetweenRequestsMs}ms)`);
            this.processNext();
        }
    }
}

const puterQueue = new PuterRequestQueue(1, 1000);

// 1. Puter.js (Free, Serverless, No Key)
const fetchPuter = async (messages, modelOptions = {}, retries = 2) => {
    return puterQueue.enqueue(() => fetchPuterInternal(messages, modelOptions, retries));
};

const fetchPuterInternal = async (messages, modelOptions = {}, retries = 2) => {
    const { model = PUTER_CHAT_TUTOR_MODEL, jsonMode = false, actionType = 'chat', onToken, ...params } = modelOptions;

    try {
        await ensurePuterReady({ timeoutMs: 5000 });
    } catch {
        throw new Error("Puter.js not ready.");
    }
    if (!window.puter) throw new Error("Puter.js not ready.");

    const caps = actionType === 'compiler' ? ['json', 'code'] : ['reasoning', 'code'];
    const userConfiguredModel = getUserModel('puter');
    let modelChain = selectModelChain(caps);

    if (model && model !== PUTER_CHAT_TUTOR_MODEL && isPuterModelId(model)) {
        modelChain = [model, ...modelChain.filter(m => m !== model)];
    }

    if (userConfiguredModel) {
        modelChain = [userConfiguredModel, ...modelChain.filter(m => m !== userConfiguredModel)];
    }

    if (!modelChain.includes('default')) {
        modelChain.push('default');
    }

    // Extract system messages to merge them into the first user message,
    // as free models on Puter may leak or fail to isolate the 'system' role.
    const systemMessages = messages.filter(m => m.role === 'system');
    const systemContent = systemMessages.map(m => {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.content)) {
            return m.content
                .map(part => {
                    if (typeof part === 'string') return part;
                    if (part && typeof part === 'object' && part.type === 'text') return part.text || '';
                    return '';
                })
                .filter(Boolean)
                .join('\n');
        }
        return String(m.content || '');
    }).filter(Boolean).join('\n\n');

    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const puterMessages = nonSystemMessages.map(m => {
        let contentStr = '';
        if (typeof m.content === 'string') {
            contentStr = m.content;
        } else if (Array.isArray(m.content)) {
            contentStr = m.content
                .map(part => {
                    if (typeof part === 'string') return part;
                    if (part && typeof part === 'object') {
                        if (part.type === 'text') return part.text || '';
                        if (part.type === 'image_url') return '[Attached Image]';
                    }
                    return '';
                })
                .filter(Boolean)
                .join('\n');
        } else if (m.content) {
            contentStr = String(m.content);
        }

        return {
            role: m.role || 'user',
            content: contentStr.trim() === "" ? " " : contentStr
        };
    });

    if (systemContent.trim()) {
        const firstUserMsg = puterMessages.find(m => m.role === 'user');
        if (firstUserMsg) {
            firstUserMsg.content = `[System Instructions]\n${systemContent}\n\n[End of System Instructions]\n\n${firstUserMsg.content}`;
        } else {
            puterMessages.unshift({
                role: 'user',
                content: `[System Instructions]\n${systemContent}\n\n[End of System Instructions]\n\nPlease acknowledge and wait for instructions.`
            });
        }
    }

    if (jsonMode) {
        const lastUserMsg = [...puterMessages].reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
            lastUserMsg.content += "\n\nIMPORTANT: Respond in strict JSON format.";
        }
    }

    let lastError = null;

    for (const candidateModel of modelChain) {
        const modelMaxTokens = PUTER_MODEL_OUTPUT_LIMITS[candidateModel] || 8192;
        const requestedMaxTokens = Number(params.max_tokens) || modelMaxTokens;
        const safeParams = {
            ...params,
            max_tokens: Math.min(requestedMaxTokens, modelMaxTokens)
        };

        for (let i = 0; i < retries; i++) {
            const startTime = Date.now();
            try {
                const displayName = candidateModel === 'default' ? 'Puter Default Model' : (PUTER_MODEL_LABELS[candidateModel] || candidateModel);
                console.info(`[Puter] Trying ${displayName} (${i + 1}/${retries}).`);

                const chatOptions = {
                    stream: Boolean(onToken),
                    ...safeParams
                };
                if (candidateModel !== 'default') {
                    chatOptions.model = candidateModel;
                }

                const puterPromise = window.puter.ai.chat(puterMessages, chatOptions);

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Puter Timeout")), onToken ? 120000 : 90000)
                );

                const response = await Promise.race([puterPromise, timeoutPromise]);
                const durationMs = Date.now() - startTime;

                if (onToken && response?.[Symbol.asyncIterator]) {
                    let streamedContent = '';
                    for await (const chunk of response) {
                        const token = getStreamText(chunk);
                        if (!token) continue;
                        streamedContent += token;
                        onToken(token, streamedContent);
                    }
                    recordPuterSuccess(candidateModel, durationMs);
                    return { content: streamedContent, model: candidateModel };
                }

                if (response?.message?.content) {
                    const content = response.message.content;
                    recordPuterSuccess(candidateModel, durationMs);
                    return {
                        content: Array.isArray(content)
                            ? content.map(p => p.text || JSON.stringify(p)).join('')
                            : (typeof content === 'string' ? content : JSON.stringify(content)),
                        model: candidateModel
                    };
                }

                recordPuterSuccess(candidateModel, durationMs);
                return { content: response?.toString() || '', model: candidateModel };
            } catch (err) {
                lastError = err;
                const reason = classifyPuterError(err);
                const errorMsg = err?.message || err?.toString() || "";
                recordPuterFailure(candidateModel, reason);
                console.warn(`[Puter] ${PUTER_MODEL_LABELS[candidateModel] || candidateModel} attempt ${i + 1} failed (${reason}):`, errorMsg);

                const canRetrySameModel = reason === 'transport' || reason === 'timeout' || reason === 'unknown';
                if (!canRetrySameModel || i === retries - 1) break;
                await new Promise(resolve => setTimeout(resolve, 600 * (i + 1)));
            }
        }
    }

    throw new Error(`Puter Limitation: ${lastError?.message || 'all Puter models failed'}`);
};

// Client-Side Fallback (Direct to API)
const fetchClientSideFallback = async (messages, modelOptions) => {
    const { model = PRIMARY_REASONING_MODEL, jsonMode, onToken, actionType: _actionType, ...params } = modelOptions;
    let rateLimited = false; // track if 429 was the failure reason

    const readWithContinuation = async (post, provider, servedModel) => {
        let fullContent = '';
        const emit = onToken
            ? (token) => {
                fullContent += token;
                onToken(token, fullContent);
            }
            : null;

        const consume = async (useMessages) => {
            const response = await post(useMessages);
            if (!response.ok) return { response };
            const result = await readCompletionResponse(response, emit);
            if (!onToken) fullContent += result.content;
            return { response, result };
        };

        let { response, result } = await consume(messages);
        if (!response.ok) return { ok: false, response };

        let continuationCount = 0;
        while (!jsonMode && result?.finishReason === 'length' && continuationCount < 2) {
            continuationCount += 1;
            console.info(`[${provider}] Response hit token limit on "${servedModel}" — continuing (${continuationCount}/2).`);
            const continuationMessages = [
                ...messages,
                { role: 'assistant', content: fullContent },
                { role: 'user', content: 'Continue exactly where you stopped. Do not restart, summarize, or repeat earlier text.' }
            ];
            ({ response, result } = await consume(continuationMessages));
            if (!response.ok) break;
        }

        return { ok: true, content: fullContent, provider, model: servedModel };
    };

    // ── Fallback 1: OpenRouter — with free-model rotation on 429 ─────────────
    // Each free model has its own rate-limit pool. On 429, we rotate through
    // all of them before giving up. New API key does NOT reset the 429 —
    // OpenRouter rate-limits by IP on free tier, not by key.
    try {
        const apiKey = sanitizeKey(getUserKey('openrouter'));
        if (apiKey && isProviderEnabled('openrouter')) {
            const preferredModel = getUserModel('openrouter') || getProviderModel(model, 'openrouter');

            const FREE_MODEL_ROTATION = [
                PRIMARY_REASONING_MODEL,
                'meta-llama/llama-3.3-70b-instruct:free',
                'meta-llama/llama-3.1-8b-instruct:free',
                'google/gemma-3-12b-it:free',
                'mistralai/mistral-7b-instruct:free',
                'qwen/qwen3-8b:free',
            ];

            const orPost = (useModel, useMessages = messages) => fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.origin,
                    "X-Title": "HOPE Studio"
                },
                body: JSON.stringify({
                    model: useModel,
                    messages: useMessages,
                    max_tokens: params.max_tokens || 8192,
                    stream: Boolean(onToken),
                    response_format: jsonMode ? { type: "json_object" } : undefined,
                    ...params
                })
            });

            const first = await readWithContinuation((useMessages) => orPost(preferredModel, useMessages), 'OpenRouter', preferredModel);

            if (first.ok) {
                return first;
            }

            // 402 = paid model needs credits, 429 = rate limited → both trigger model rotation
            if (first.response.status === 402 || first.response.status === 429) {
                console.info(`[OpenRouter] ${first.response.status} on "${preferredModel}" — rotating free models.`);
                for (const freeModel of FREE_MODEL_ROTATION) {
                    if (freeModel === preferredModel) continue;
                    try {
                        const retry = await readWithContinuation((useMessages) => orPost(freeModel, useMessages), 'OpenRouter', freeModel);
                        if (retry.ok) {
                            console.info(`[OpenRouter] Served by: ${freeModel}`);
                            return retry;
                        }
                        if (retry.response.status !== 429 && retry.response.status !== 402) break; // hard error, stop
                        console.info(`[OpenRouter] ${freeModel} also limited (${retry.response.status}), trying next.`);
                    } catch { /* network error on this model, try next */ }
                }
                rateLimited = true;
                console.info("[OpenRouter] All free models exhausted — falling through to Groq.");
            } else {
                console.info(`[OpenRouter] HTTP ${first.response.status} — falling through.`);
            }
        }
    } catch (e) { console.info("[OpenRouter] Skipped:", e.message); }


    // ── Fallback 2: Groq (user's key only, if enabled) ────────────────────────
    try {
            const groqKey = sanitizeKey(getUserKey('groq'));
            if (groqKey && isProviderEnabled('groq')) {
                const groqModel = getUserModel('groq') || getProviderModel(model, 'groq');
                const groqMaxTokens = Math.min(params.max_tokens || 8192, 8192);
                const groqPost = (useMessages = messages) => fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: groqModel,
                        messages: useMessages,
                        response_format: jsonMode ? { type: "json_object" } : undefined,
                        stream: Boolean(onToken),
                        ...params,
                        max_tokens: groqMaxTokens
                    })
                });
                const gResult = await readWithContinuation(groqPost, 'Groq', groqModel);
                if (gResult.ok) {
                    return gResult;
                }
                if (gResult.response.status === 429) rateLimited = true;
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
                    stream: Boolean(onToken),
                })
            });
            if (gResp.ok) {
                const result = await readCompletionResponse(gResp, onToken);
                console.info(`[Gemini] Served by: ${geminiModel}`);
                return { content: result.content || '', provider: 'Gemini', model: geminiModel };
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
        if (modelOptions.onToken) return await fetchClientSideFallback(messages, modelOptions);
        const response = await fetch('/api/ai-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, ...modelOptions })
        });
        if (!response.ok) {
            if (import.meta.env.DEV || response.status >= 500) return await fetchClientSideFallback(messages, modelOptions);
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
    chat:       32000,  // Long explanations, code blocks, doc generation
    compiler:    8192,  // Structured JSON output, keep tight
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
        model = PRIMARY_REASONING_MODEL,
        includeMetadata = false,
        ...restOptions
    } = options;

    const startTime = Date.now();

    // Apply token budget: caller-supplied max_tokens always wins; otherwise use per-action default
    const defaultTokens = ACTION_TOKEN_BUDGETS[actionType] ?? ACTION_TOKEN_BUDGETS.default;
    const modelOptions = {
        model,
        actionType,
        max_tokens: defaultTokens,  // Global default — overridden if caller explicitly sets it
        ...restOptions              // Caller's options (including max_tokens) take precedence
    };

    onProgress({ step: 'rate-limit', message: 'Checking Rate Limits...' });
    await checkRateLimit(actionType);

    // ── Vault-aware provider chain ─────────────────────────────────────────
    // Build ordered list from vault; fall back to hardcoded order if vault not
    // ready yet (first-load race condition).
    await ensureVault();

    // Sanitize messages to avoid empty content which rejects under strict OpenAI/Puter APIs
    const sanitizedMessages = messages.map(m => {
        if (m.content === undefined || m.content === null) {
            return { ...m, content: " " };
        }
        if (typeof m.content === 'string') {
            return { ...m, content: m.content.trim() === "" ? " " : m.content };
        }
        if (Array.isArray(m.content)) {
            const hasText = m.content.some(part => part && (typeof part === 'string' || part.text));
            if (!hasText) {
                return {
                    ...m,
                    content: [
                        { type: 'text', text: ' ' },
                        ...m.content.filter(part => part && part.type !== 'text')
                    ]
                };
            }
            return m;
        }
        return { ...m, content: String(m.content).trim() === "" ? " " : String(m.content) };
    });

    const orderedProviders = getOrderedProviders(); // sorted, filtered by enabled
    const puterEntry   = orderedProviders.find(p => p.id === 'puter');
    const clientEntry  = orderedProviders.find(p => p.id === 'openrouter' || p.id === 'groq');

    let resultData = null;

    // 1. Puter only for Puter-native model ids. The default reasoning model is
    // served by OpenRouter and must not be silently translated back to Puter.
    const canUsePuter = puterEntry
        && isPuterModelId(modelOptions.model)
        && provider !== 'backend'
        && !sanitizedMessages.some(m => Array.isArray(m.content));

    if (canUsePuter) {
        try {
            const puterMode = isPuterHealthy() ? 'Primary' : 'Recovery Probe';
            onProgress({ step: 'querying', message: `Querying Puter.js (${puterMode})...`, provider: 'Puter Cloud' });
            const puterResult = await fetchPuter(sanitizedMessages, modelOptions);
            resultData = { content: puterResult.content, provider: "Puter Cloud", model: puterResult.model };
        } catch (e) {
            console.warn("Puter failed/limited, dropping to client-side fallbacks.", e?.message || e);
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
                resultData = await fetchBackendFallback(sanitizedMessages, modelOptions);
            } else {
                const nextName = clientEntry?.name || 'OpenRouter';
                onProgress({ step: 'querying', message: `Querying ${nextName}...`, provider: nextName });
                resultData = await fetchClientSideFallback(sanitizedMessages, modelOptions);
            }
        } catch (e) {
            console.error("All client-side providers failed:", e.message);
            const canUsePuterFallback = puterEntry
                && provider === 'auto'
                && !sanitizedMessages.some(m => Array.isArray(m.content));

            if (canUsePuterFallback) {
                try {
                    onProgress({ step: 'fallback', message: 'OpenRouter unavailable. Trying Puter Laguna...', provider: 'Puter Cloud' });
                    const puterResult = await fetchPuter(sanitizedMessages, { ...modelOptions, model: PUTER_CHAT_TUTOR_MODEL });
                    resultData = { content: puterResult.content, provider: "Puter Cloud", model: puterResult.model };
                } catch (puterError) {
                    console.warn("Puter fallback also failed.", puterError?.message || puterError);
                }
            }

            if (!resultData) onProgress({ step: 'error', message: 'All AI Providers Failed' });
            if (!resultData) {
                throw new Error("All AI providers are disabled or failed. Please check your AI Settings.");
            }
        }
    }

    const endTime = Date.now();
    const duration = (endTime - startTime);

    onProgress({ step: 'completed', message: 'Response Received', duration });

    if (resultData) {
        logAIChatTelemetry({
            model: resultData.model || modelOptions.model,
            provider: resultData.provider || provider,
            durationMs: duration,
            success: true,
            fallbackTriggered: resultData.provider !== (provider === 'auto' ? 'Puter Cloud' : provider),
            misconceptionHalted: Boolean(options.misconceptionHalted),
            studentProficiency: options.studentProficiency || null,
            ruralIndicator: options.ruralIndicator || false
        }).catch(err => console.error("Telemetry upload failed:", err));
    } else {
        logAIChatTelemetry({
            model: modelOptions.model,
            provider,
            durationMs: duration,
            success: false,
            fallbackTriggered: true,
            misconceptionHalted: Boolean(options.misconceptionHalted),
            studentProficiency: options.studentProficiency || null,
            ruralIndicator: options.ruralIndicator || false
        }).catch(err => console.error("Telemetry upload failed:", err));
    }

    if (includeMetadata) {
        return { ...resultData, time: (duration / 1000).toFixed(2) };
    }
    return resultData.content;
};


export const simulateCodeExecution = async (code, language = "auto", inputs = [], history = [], options = {}) => {
    void inputs;
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
            model: PUTER_JCOMPILER_MODEL,
            temperature: 0.1,
            max_tokens: 8192,
            actionType: 'compiler',
            includeMetadata: true,
            onToken: options.onToken
        });
        
        let parsed;
        try {
            parsed = cleanAndParseJSON(resultWithMeta.content);
        } catch (jsonErr) {
            console.warn("Compiler JSON parsing failed, using fallback parser:", jsonErr);
            parsed = {
                reasoning: "Failed to parse structured JSON from model. Displaying raw output.",
                language: language,
                isEmbedded: false,
                output: resultWithMeta.content,
                serialMonitor: "",
                status: "success",
                errorExplanation: "",
                fixedCode: code,
                mermaidGraph: ""
            };
        }
        return { ...parsed, _metadata: { time: resultWithMeta.time, provider: resultWithMeta.provider, model: resultWithMeta.model } };
    } catch (err) {
        console.error("Compiler simulation critical error:", err);
        throw new Error("Compiler simulation failed: " + (err.message || err));
    }
};

// J-Compiler: Reverse Engineering (Output -> Code)
export const reverseEngineerCode = async (expectedOutput, language = "javascript", options = {}) => {
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
            model: PUTER_JCOMPILER_MODEL,
            temperature: 0.1,
            max_tokens: 4096,
            actionType: 'compiler',
            includeMetadata: true,
            onToken: options.onToken
        });
        
        let parsed;
        try {
            parsed = cleanAndParseJSON(resultWithMeta.content);
        } catch (jsonErr) {
            console.warn("Reverse engineering JSON parsing failed, using fallback parser:", jsonErr);
            parsed = {
                code: resultWithMeta.content,
                explanation: "Could not parse structured JSON from response.",
                reasoning: "Displaying raw response content."
            };
        }
        return { ...parsed, _metadata: { time: resultWithMeta.time, provider: resultWithMeta.provider, model: resultWithMeta.model } };
    } catch (err) {
        console.error("Reverse engineering critical error:", err);
        throw new Error("Reverse engineering failed: " + (err.message || err));
    }
};
