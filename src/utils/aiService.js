import { supabase } from './../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { getOrderedProviders, getUserKey, getUserModel, initVault, sanitizeKey, isProviderEnabled } from './keyVault';
// ensurePuterReady: waits for window.puter CDN global — no SDK mutations.
// Only called inside fetchPuter (lazy — on actual AI requests, not module load).
import { ensurePuterReady } from './puterInit';
import { logAIChatTelemetry } from './telemetry';
import { parseAIJSON } from './jsonUtils';
import { rotateOnRateLimit, activatePool } from './puterAccountPool';

// ─── 100% Free AI Routing Matrix ────────────────────────────────────────────
export const FREE_MODEL_ROUTING = {
    // 1. Socratic Tutoring (Requires Chain-of-Thought reasoning)
    TUTOR_PRIMARY: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    TUTOR_FALLBACK: 'liquid-ai/lfm2.5-1.2b-thinking:free',

    // 2. Code Compilation (Requires specialized coding weights)
    COMPILER_PRIMARY: 'cohere/north-mini-code:free',
    COMPILER_FALLBACK: 'baidu/qianfan-cobuddy:free',

    // 3. Handbooks/PDFs (Requires Vision/Multimodal capabilities)
    HANDBOOK_PRIMARY: 'z-ai/glm-4.5-flash:free',
    HANDBOOK_FALLBACK: 'z-ai/glm-4.5-flash:free', // Fallback to text-only if image fails

    // 4. Roadmaps/JSON (Requires flawless structured output)
    ROADMAP_PRIMARY: 'z-ai/glm-4.5-flash:free',
    ROADMAP_FALLBACK: 'google/gemma-3n-2b:free',

    // 5. Moderation (Requires specialized safety guardrails)
    MODERATION_PRIMARY: 'nvidia/nemotron-3.5-content-safety:free',
    MODERATION_FALLBACK: 'nvidia/nemotron-nano-9b-v2:free',

    // 6. Inline Docs/Sheets (Requires ultra-low latency)
    INLINE_PRIMARY: 'liquid-ai/lfm2.5-1.2b-instruct:free',
    INLINE_FALLBACK: 'z-ai/glm-4.5-flash:free',

    // 7. Content Generation (Reports, PPTs)
    CONTENT_PRIMARY: 'z-ai/glm-4.5-flash:free',
    CONTENT_FALLBACK: 'google/gemma-3n-2b:free',

    // 8. General Chat / Fallback
    CHAT_PRIMARY: 'z-ai/glm-4.5-flash:free',
    CHAT_FALLBACK: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free' // Uncensored fallback
};

const PRIMARY_REASONING_MODEL = FREE_MODEL_ROUTING.CHAT_PRIMARY;
const PUTER_CHAT_TUTOR_MODEL = FREE_MODEL_ROUTING.TUTOR_PRIMARY;
const PUTER_JCOMPILER_MODEL = FREE_MODEL_ROUTING.COMPILER_PRIMARY;

const PUTER_MODEL_LABELS = {
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free': 'Nemotron 3 Omni (Tutor)',
    'liquid-ai/lfm2.5-1.2b-thinking:free': 'LFM2.5 Thinking',
    'cohere/north-mini-code:free': 'North Mini Code',
    'baidu/qianfan-cobuddy:free': 'Qianfan CoBuddy',
    'z-ai/glm-4.5-flash:free': 'GLM-4.5 Flash',
    'google/gemma-3n-2b:free': 'Gemma 3n 2B',
    'nvidia/nemotron-3.5-content-safety:free': 'Nemotron Content Safety',
    'nvidia/nemotron-nano-9b-v2:free': 'Nemotron Nano 9B',
    'liquid-ai/lfm2.5-1.2b-instruct:free': 'LFM2.5 Instruct',
    'cognitivecomputations/dolphin-mistral-24b-venice-edition:free': 'Dolphin Mistral',
    'z-ai/glm-4.5': 'GLM-4.5',
    'default': 'Puter Default',
};

const PUTER_MODEL_OUTPUT_LIMITS = {
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free': 8192,
    'liquid-ai/lfm2.5-1.2b-thinking:free': 4096,
    'cohere/north-mini-code:free': 8192,
    'baidu/qianfan-cobuddy:free': 4096,
    'z-ai/glm-4.5-flash:free': 8192,
    'google/gemma-3n-2b:free': 4096,
    'nvidia/nemotron-3.5-content-safety:free': 4096,
    'nvidia/nemotron-nano-9b-v2:free': 4096,
    'liquid-ai/lfm2.5-1.2b-instruct:free': 4096,
    'cognitivecomputations/dolphin-mistral-24b-venice-edition:free': 4096,
    'z-ai/glm-4.5': 8192,
    'default': 8192,
};

const getPuterModelCaps = (modelId) =>
    PUTER_FIRST_ROSTER.find(model => model.id === modelId)?.caps || [];

const puterModelSupports = (modelId, cap) =>
    modelId === 'default' || getPuterModelCaps(modelId).includes(cap);

const contentPartHasImage = (part) => {
    if (!part || typeof part !== 'object') return false;
    return part.type === 'image_url' || part.type === 'input_image' || Boolean(part.image_url || part.image);
};

const messageHasImageContent = (message) =>
    Array.isArray(message?.content) && message.content.some(contentPartHasImage);

const messagesHaveStructuredContent = (messages = []) =>
    messages.some(message => Array.isArray(message?.content));

const messagesHaveImageContent = (messages = []) =>
    messages.some(messageHasImageContent);

const normalizePuterContentPart = (part) => {
    if (typeof part === 'string') {
        return { type: 'text', text: part };
    }

    if (!part || typeof part !== 'object') {
        return null;
    }

    if (part.type === 'text') {
        return { type: 'text', text: part.text || '' };
    }

    if (part.type === 'image_url' || part.image_url) {
        const imageUrl = typeof part.image_url === 'string'
            ? part.image_url
            : part.image_url?.url;
        return imageUrl
            ? { type: 'image_url', image_url: { url: imageUrl } }
            : null;
    }

    if (part.type === 'input_image' || part.image) {
        const imageUrl = typeof part.image === 'string'
            ? part.image
            : part.image?.url;
        return imageUrl
            ? { type: 'image_url', image_url: { url: imageUrl } }
            : null;
    }

    return null;
};

const appendTextToPuterMessage = (message, text, prepend = false) => {
    if (!text.trim()) return message;

    if (Array.isArray(message.content)) {
        const textPart = { type: 'text', text };
        return {
            ...message,
            content: prepend
                ? [textPart, ...message.content]
                : [...message.content, textPart]
        };
    }

    return {
        ...message,
        content: prepend
            ? `${text}\n\n${message.content || ''}`.trim()
            : `${message.content || ''}\n\n${text}`.trim()
    };
};

const getPuterContentText = (content) => {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return String(content || '');
    return content
        .map(part => {
            if (typeof part === 'string') return part;
            if (part?.type === 'text') return part.text || '';
            return '';
        })
        .filter(Boolean)
        .join('\n');
};

const getPuterContentMedia = (content) => {
    if (!Array.isArray(content)) return [];
    return content
        .map(part => {
            if (!part || typeof part !== 'object') return null;
            if (part.type === 'image_url' || part.image_url) {
                return typeof part.image_url === 'string'
                    ? part.image_url
                    : part.image_url?.url;
            }
            if (part.type === 'input_image' || part.image) {
                return typeof part.image === 'string'
                    ? part.image
                    : part.image?.url;
            }
            return null;
        })
        .filter(Boolean);
};

const buildPuterVisionRequest = (puterMessages) => {
    const media = [];
    const prompt = puterMessages
        .map(message => {
            media.push(...getPuterContentMedia(message.content));
            const text = getPuterContentText(message.content).trim();
            if (!text) return '';
            return `[${String(message.role || 'user').toUpperCase()}]\n${text}`;
        })
        .filter(Boolean)
        .join('\n\n');

    return {
        prompt: prompt || 'Analyze the attached image.',
        media: media.length === 1 ? media[0] : media
    };
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

    const processEvent = (event) => {
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
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
            processEvent(event);
        }
    }
    if (buffer.trim()) processEvent(buffer);

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
    return initVault().then(() => { _vaultReady = true; }).catch(() => { });
};
// Kick off immediately on module load (best-effort)
ensureVault();

const cleanAndParseJSON = (text) => {
    try {
        return parseAIJSON(text);
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
    // Tutor / Socratic — chain-of-thought reasoning
    { id: FREE_MODEL_ROUTING.TUTOR_PRIMARY, priority: 0, caps: ["reasoning", "tutor", "fallback"] },
    { id: FREE_MODEL_ROUTING.TUTOR_FALLBACK, priority: 1, caps: ["reasoning", "tutor"] },
    // Code Compiler / J-Compiler
    { id: FREE_MODEL_ROUTING.COMPILER_PRIMARY, priority: 0, caps: ["code", "compiler", "json"] },
    { id: FREE_MODEL_ROUTING.COMPILER_FALLBACK, priority: 1, caps: ["code", "compiler"] },
    // Vision / Handbook / PDF
    { id: FREE_MODEL_ROUTING.HANDBOOK_PRIMARY, priority: 0, caps: ["vision", "handbook"] },
    { id: FREE_MODEL_ROUTING.HANDBOOK_FALLBACK, priority: 1, caps: ["handbook", "fallback"] },
    // Roadmap / JSON structured output
    { id: FREE_MODEL_ROUTING.ROADMAP_PRIMARY, priority: 0, caps: ["json", "roadmap", "fast-chat"] },
    { id: FREE_MODEL_ROUTING.ROADMAP_FALLBACK, priority: 1, caps: ["json", "roadmap"] },
    // Moderation / Safety / Quiz
    { id: FREE_MODEL_ROUTING.MODERATION_PRIMARY, priority: 0, caps: ["moderation", "quiz", "safety"] },
    { id: FREE_MODEL_ROUTING.MODERATION_FALLBACK, priority: 1, caps: ["moderation", "quiz"] },
    // Inline docs / Sheets — ultra-low latency
    { id: FREE_MODEL_ROUTING.INLINE_PRIMARY, priority: 0, caps: ["inline", "fast-chat"] },
    { id: FREE_MODEL_ROUTING.INLINE_FALLBACK, priority: 1, caps: ["inline", "json", "fast-chat"] },
    // Content generation — reports, PPTs
    { id: FREE_MODEL_ROUTING.CONTENT_PRIMARY, priority: 0, caps: ["content", "report", "ppt"] },
    { id: FREE_MODEL_ROUTING.CONTENT_FALLBACK, priority: 1, caps: ["content", "report"] },
    // General chat fallback
    { id: FREE_MODEL_ROUTING.CHAT_PRIMARY, priority: 0, caps: ["reasoning", "code", "json", "fast-chat", "fallback"] },
    { id: FREE_MODEL_ROUTING.CHAT_FALLBACK, priority: 2, caps: ["fallback", "fast-chat"] }
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
    } catch {
        PUTER_FIRST_ROSTER.forEach(m => {
            _healthRegistry[m.id] = new EnhancedHealthRecord(m.id, m.caps);
        });
    }
};

const saveHealthRegistry = () => {
    try {
        localStorage.setItem('hope_ai_health_records', JSON.stringify(_healthRegistry));
    } catch {
        // localStorage can be unavailable in private or restricted browser contexts.
    }
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
    let poolOk = true;
    if (record) {
        record.rollingFailures++;
        if (reason === 'rate-limit') {
            // Rotate to next Puter account if pool is configured
            const rotated = rotateOnRateLimit();
            if (!rotated) {
                poolOk = false;
            }
            record.cooldownUntil = 0;
        } else if (reason === 'model') {
            // Put model on permanent cooldown (100 years)
            record.cooldownUntil = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;
        } else {
            record.cooldownUntil = 0;
        }
        saveHealthRegistry();
        if (reason === 'model') {
            console.warn(`[Puter Breaker] Model not found failure recorded for ${model}. Model is put on permanent cooldown.`);
        } else {
            console.warn(`[Puter Breaker] Transient failure recorded for ${model} (${reason}). No cooldown applied.`);
        }
    }
    return poolOk;
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
    
    const primaryMatches = matches.filter(m => m.priority === 0);
    const primaryIds = new Set(primaryMatches.map(p => p.id));
    
    const fallbackPool = healthy.filter(h => !primaryIds.has(h.id));
    const shuffledFallbacks = [...fallbackPool].sort(() => Math.random() - 0.5);

    return [...primaryMatches.map(p => p.id), ...shuffledFallbacks.map(f => f.id)];
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
        if (modelId === 'default') return PRIMARY_REASONING_MODEL;
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

const puterQueue = new PuterRequestQueue(1, 150);

// 1. Puter.js (Free, Serverless, No Key)
const fetchPuter = async (messages, modelOptions = {}, retries = 2) => {
    return puterQueue.enqueue(() => fetchPuterInternal(messages, modelOptions, retries));
};

const fetchPuterInternal = async (messages, modelOptions = {}, retries = 2) => {
    const { model = PUTER_CHAT_TUTOR_MODEL, jsonMode = false, actionType = 'chat', onToken, ...params } = modelOptions;
    const isVisionRequest = messagesHaveImageContent(messages);

    try {
        await ensurePuterReady({ timeoutMs: onToken ? 2500 : 5000 });
    } catch {
        throw new Error("Puter.js not ready.");
    }
    if (!window.puter) throw new Error("Puter.js not ready.");

    // Map actionType → capability tags that drive model selection from PUTER_FIRST_ROSTER
    const ACTION_CAPS = {
        compiler: ['code', 'compiler'],
        roadmap: ['json', 'roadmap'],
        handbook: ['handbook'],
        report: ['content', 'report'],
        ppt: ['content', 'ppt'],
        assignment: ['content', 'report'],
        project: ['content', 'report'],
        moderation: ['moderation', 'safety'],
        quiz: ['moderation', 'quiz'],
        inline: ['inline', 'fast-chat'],
        tutor: ['reasoning', 'tutor'],
        chat: ['reasoning', 'fast-chat'],
    };
    const caps = isVisionRequest
        ? ['vision']
        : (ACTION_CAPS[actionType] ?? ['reasoning', 'fast-chat']);
    const userConfiguredModel = getUserModel('puter');
    let modelChain = selectModelChain(caps);

    const hasExplicitPuterModel = model && model !== 'default' && isPuterModelId(model);
    if (hasExplicitPuterModel) {
        modelChain = [model, ...modelChain.filter(m => m !== model)];
    }

    if (!hasExplicitPuterModel && userConfiguredModel && (!isVisionRequest || puterModelSupports(userConfiguredModel, 'vision'))) {
        modelChain = [userConfiguredModel, ...modelChain.filter(m => m !== userConfiguredModel)];
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
        let content;
        if (typeof m.content === 'string') {
            content = m.content;
        } else if (Array.isArray(m.content)) {
            const parts = m.content
                .map(normalizePuterContentPart)
                .filter(Boolean)
                .filter(part => part.type !== 'text' || part.text.trim() !== '');
            content = parts.length > 0 ? parts : ' ';
        } else if (m.content) {
            content = String(m.content);
        } else {
            content = ' ';
        }

        return {
            role: m.role || 'user',
            content: typeof content === 'string' && content.trim() === "" ? " " : content
        };
    });

    if (systemContent.trim()) {
        const firstUserIndex = puterMessages.findIndex(m => m.role === 'user');
        if (firstUserIndex !== -1) {
            puterMessages[firstUserIndex] = appendTextToPuterMessage(
                puterMessages[firstUserIndex],
                `[System Instructions]\n${systemContent}\n\n[End of System Instructions]`,
                true
            );
        } else {
            puterMessages.unshift({
                role: 'user',
                content: `[System Instructions]\n${systemContent}\n\n[End of System Instructions]\n\nPlease acknowledge and wait for instructions.`
            });
        }
    }

    if (jsonMode) {
        const lastUserIndex = puterMessages.findLastIndex?.(m => m.role === 'user')
            ?? (() => {
                for (let index = puterMessages.length - 1; index >= 0; index -= 1) {
                    if (puterMessages[index].role === 'user') return index;
                }
                return -1;
            })();
        if (lastUserIndex !== -1) {
            puterMessages[lastUserIndex] = appendTextToPuterMessage(
                puterMessages[lastUserIndex],
                "IMPORTANT: Respond in strict JSON format."
            );
        }
    }

    let lastError = null;
    let poolExhausted = false;

    for (const candidateModel of modelChain) {
        if (poolExhausted) break;
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
                    if (candidateModel.includes('cohere/north-mini-code') || candidateModel.includes('nvidia')) {
                        chatOptions.model = candidateModel.endsWith(':free') ? candidateModel : `${candidateModel}:free`;
                    } else {
                        chatOptions.model = candidateModel.replace(/:free$/, '');
                    }
                }

                const puterPromise = isVisionRequest
                    ? (() => {
                        const visionRequest = buildPuterVisionRequest(puterMessages);
                        return window.puter.ai.chat(visionRequest.prompt, visionRequest.media, chatOptions);
                    })()
                    : window.puter.ai.chat(puterMessages, chatOptions);

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Puter Timeout")), onToken ? 45000 : 30000)
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
                const poolOk = recordPuterFailure(candidateModel, reason);
                console.warn(`[Puter] ${PUTER_MODEL_LABELS[candidateModel] || candidateModel} attempt ${i + 1} failed (${reason}):`, errorMsg);

                if (!poolOk) {
                    poolExhausted = true;
                    break;
                }

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
    chat: 32000,  // Long explanations, code blocks, doc generation
    compiler: 8192,  // Structured JSON output, keep tight
    roadmap: 8192,  // JSON with nodes/edges, moderate size
    report: 12000,  // Report sections can be lengthy
    ppt: 8192,  // Presentation slides
    project: 8192,  // Project briefs
    assignment: 10000,  // Full assignment write-ups
    default: 8192   // Catch-all
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

    // Map legacy / hardcoded model strings to their current active equivalents in FREE_MODEL_ROUTING
    let finalModel = model;
    if (typeof model === 'string') {
        const clean = model.trim().toLowerCase();
        if (clean.includes('nemotron-3-nano-omni-30b-a3b-reasoning') || clean.includes('lfm2.5-1.2b-thinking')) {
            finalModel = FREE_MODEL_ROUTING.TUTOR_PRIMARY;
        } else if (clean.includes('north-mini-code') || clean.includes('qianfan-cobuddy')) {
            finalModel = FREE_MODEL_ROUTING.COMPILER_PRIMARY;
        } else if (clean.includes('glm-4.6v-flash') || clean.includes('glm-4.5-flash')) {
            finalModel = FREE_MODEL_ROUTING.HANDBOOK_PRIMARY;
        } else if (clean.includes('glm-4.7-flash')) {
            finalModel = FREE_MODEL_ROUTING.ROADMAP_PRIMARY;
        } else if (clean.includes('glm-4.5') || clean.includes('glm-4.5-flash')) {
            finalModel = FREE_MODEL_ROUTING.CONTENT_PRIMARY;
        } else if (clean.includes('nemotron-3.5-content-safety') || clean.includes('nemotron-nano-9b-v2')) {
            finalModel = FREE_MODEL_ROUTING.MODERATION_PRIMARY;
        } else if (clean.includes('lfm2.5-1.2b-instruct')) {
            finalModel = FREE_MODEL_ROUTING.INLINE_PRIMARY;
        }
    }

    // Apply token budget: caller-supplied max_tokens always wins; otherwise use per-action default
    const defaultTokens = ACTION_TOKEN_BUDGETS[actionType] ?? ACTION_TOKEN_BUDGETS.default;
    const modelOptions = {
        model: finalModel,
        actionType,
        max_tokens: defaultTokens,  // Global default — overridden if caller explicitly sets it
        ...restOptions              // Caller's options (including max_tokens) take precedence
    };

    onProgress({ step: 'preflight', message: 'Opening live stream...' });
    await Promise.all([
        checkRateLimit(actionType),
        ensureVault()
    ]);

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
    const puterEntry = orderedProviders.find(p => p.id === 'puter');
    const clientEntry = orderedProviders.find(p => p.id === 'openrouter' || p.id === 'groq' || p.id === 'gemini');
    const hasStructuredContent = messagesHaveStructuredContent(sanitizedMessages);
    const hasImageContent = messagesHaveImageContent(sanitizedMessages);

    let resultData = null;

    // 1. Puter only for Puter-native model ids. The default reasoning model is
    // served by OpenRouter and must not be silently translated back to Puter.
    const canUsePuter = puterEntry
        && isPuterModelId(modelOptions.model)
        && provider !== 'backend'
        && (!hasStructuredContent || hasImageContent);

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
                && (!hasStructuredContent || hasImageContent);

            if (canUsePuterFallback) {
                try {
                    const fallbackModel = hasImageContent ? FREE_MODEL_ROUTING.HANDBOOK_PRIMARY : PUTER_CHAT_TUTOR_MODEL;
                    onProgress({
                        step: 'fallback',
                        message: hasImageContent
                            ? 'Trying Puter vision model...'
                            : 'OpenRouter unavailable. Trying Puter Laguna...',
                        provider: 'Puter Cloud'
                    });
                    const puterResult = await fetchPuter(sanitizedMessages, { ...modelOptions, model: fallbackModel });
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
    // onStream: called with (rawChunk, totalBytesReceived) during streaming — for progress UI only.
    // onToken: NOT used here to avoid showing partial JSON. UI shows thinking animation until parse.
    const { onStream, onProgress } = options;

    // Use the modular profile-based prompt for the legacy path too
    const profile = detectLanguageProfile(code, language);
    const systemPromptBase = buildSystemPrompt(profile);
    // Legacy path needs pure-JSON response — append that constraint
    const systemPrompt = `${systemPromptBase}

LEGACY MODE: Respond ONLY with a single valid JSON object matching this schema:
{ "reasoning", "language", "isEmbedded", "output", "serialMonitor", "status", "errorExplanation", "fixedCode", "mermaidGraph", "htmlPlot" }
No markdown fences, no prose outside the JSON.`;

    const contextMessage = history.length > 0 ? history.map((h, i) => `[Mem ${i + 1}] Code:${h.code} Out:${h.result.output || 'ERR'}`).join("\n") : "";

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `History:\n${contextMessage}\nLang: ${language}\nCode:\n${code}` }
    ];

    // Internal raw-stream callback — accumulates bytes for progress display
    let streamedBytes = 0;
    const rawStreamCallback = onStream
        ? (token) => {
            streamedBytes += token.length;
            onStream(token, streamedBytes);
        }
        : undefined;

    try {
        const resultWithMeta = await getAICompletion(messages, {
            jsonMode: true,
            model: PUTER_JCOMPILER_MODEL,
            temperature: 0.1,
            max_tokens: 8192,
            actionType: 'compiler',
            includeMetadata: true,
            onToken: rawStreamCallback,   // stream raw chunks to progress display only
            onProgress,
        });

        let parsed;
        try {
            parsed = cleanAndParseJSON(resultWithMeta.content);
        } catch (jsonErr) {
            console.warn("Compiler JSON parsing failed, using fallback parser:", jsonErr);
            // Try to recover key fields by regex if JSON is malformed
            const tryExtract = (key) => {
                const m = resultWithMeta.content.match(new RegExp(`"${key}"\\s*:\s*"([^"]*)"`));
                return m ? m[1] : '';
            };
            parsed = {
                reasoning: tryExtract('reasoning') || "Failed to parse structured JSON. Displaying raw output.",
                language:  tryExtract('language')  || language,
                isEmbedded: false,
                output:    tryExtract('output')    || resultWithMeta.content,
                serialMonitor: '',
                status:    tryExtract('status')    || 'success',
                errorExplanation: tryExtract('errorExplanation') || '',
                fixedCode: tryExtract('fixedCode') || code,
                mermaidGraph: tryExtract('mermaidGraph') || '',
            };
        }
        return { ...parsed, _metadata: { time: resultWithMeta.time, provider: resultWithMeta.provider, model: resultWithMeta.model } };
    } catch (err) {
        console.error("Compiler simulation critical error:", err);
        throw new Error("Compiler simulation failed: " + (err.message || err));
    }
};

// ─── Keyword-Based Language Profile Detector ──────────────────────────────────
/**
 * Analyses code and language hint to produce a structured profile.
 * Returns { domain, flags } where domain drives prompt module selection
 * and flags are additional feature tags used to augment the prompt.
 */
const detectLanguageProfile = (code, language) => {
    const c = code;
    const lang = (language || 'auto').toLowerCase();
    const flags = new Set();

    // ── Feature flags (cross-domain) ──
    if (/\bclass\s+\w+/i.test(c))                             flags.add('oop');
    if (/\basync\b|\bawait\b|\bpromise\b/i.test(c))          flags.add('async');
    if (/\bsocket\b|\bhttp\b|\bfetch\b|\bxhr\b|\bcurl\b/i.test(c)) flags.add('networking');
    if (/\bregex\b|new\s+RegExp|\/.+\/[gimsuy]*/i.test(c))   flags.add('regex');
    if (/\bthread\b|\bmutex\b|\bsemaphore\b|\block\b/i.test(c)) flags.add('concurrency');
    if (/\binput\s*\(|readline\b|scanf\b|cin\b|gets\b|prompt\s*\(/i.test(c)) flags.add('interactive');
    if (/\btry\s*{|\bcatch\s*\(|\bexcept\b|\brescue\b/i.test(c)) flags.add('exception_handling');

    // ── Domain detection — ORDER MATTERS (most specific first) ──

    // 3-D Plotting
    if (/plot_surface\b|plot_wireframe\b|scatter3[Dd]\b|Axes3D\b|projection\s*=\s*['"]3d['"]/i.test(c) ||
        /plotly.*surface|go\.Surface\b|scatter3d|mesh3d/i.test(c) ||
        /three\.js|WebGL|gl\.createBuffer/i.test(c))
        return { domain: 'plot3d', flags };

    // 2-D Plotting / Data Visualisation
    if (/import\s+matplotlib|from\s+matplotlib|pyplot\b|plt\.\w+|seaborn\b|sns\.\w+|bokeh\b|altair\b/i.test(c) ||
        /ggplot\b|ggplot2\b|geom_\w+|aes\s*\(/i.test(c) ||
        /Plots\.jl|using\s+Plots\b|plot\s*\(\w/i.test(c) ||
        /imshow\s*\(|plt\.show\s*\(\)|\.savefig\s*\(/i.test(c))
        return { domain: 'plot2d', flags };

    // MATLAB / GNU Octave
    if (lang === 'matlab' || lang === 'octave' ||
        /\bfigure\s*\(|\bsubplot\s*\(|\bxlabel\s*\(|\bylabel\s*\(/i.test(c) ||
        /\blinspace\s*\(|\blogspace\s*\(|\bmeshgrid\s*\(|\bsurf\s*\(|\bplot3\s*\(/i.test(c) ||
        /\bfft\s*\(|\bifft\s*\(|\beig\s*\(|\bsvd\s*\(|\binv\s*\(/i.test(c) ||
        /^%\s/m.test(c) || /end\s*$/m.test(c))
        return { domain: 'matlab', flags };

    // R language
    if (lang === 'r' ||
        /library\s*\(|require\s*\(|ggplot2|dplyr|tidyr|readr|stringr\b/i.test(c) ||
        /<-\s/.test(c) || /\bdata\.frame\s*\(|\bvector\s*\(|\bnumeric\s*\(|\bfactor\s*\(/i.test(c) ||
        /\bsapply\b|\blapply\b|\bvapply\b|\btapply\b|\brapply\b/i.test(c))
        return { domain: 'r_lang', flags };

    // Julia
    if (lang === 'julia' ||
        /\busing\s+\w+|\bimport\s+\w+::\w+/i.test(c) ||
        /println\s*\(|@time\b|@benchmark\b|::Vector|::Matrix|::Int64|::Float64/i.test(c) ||
        /Pkg\.add\b|Plots\.jl|DataFrames\.jl/i.test(c))
        return { domain: 'julia', flags };

    // MicroPython (RP2040, ESP8266, ESP32)
    if (lang === 'micropython' ||
        /from\s+machine\s+import|import\s+machine\b/i.test(c) ||
        /\bPin\s*\(|\bADC\s*\(|\bI2C\s*\(|\bSPI\s*\(|\bUART\s*\(|\bPWM\s*\(|\bTimer\s*\(/i.test(c) ||
        /utime\.|time\.sleep_ms\b|uos\.|network\.WLAN\b|MicroPython/i.test(c) ||
        /from\s+rp2\s+import|@rp2\.asm_pio/i.test(c))
        return { domain: 'micropython', flags };

    // Arduino / AVR C++
    if (lang === 'arduino' || lang === 'ino' ||
        /\bvoid\s+setup\s*\(\s*\)|\bvoid\s+loop\s*\(\s*\)/i.test(c) ||
        /\bSerial\.begin\b|\bSerial\.print\b|\bdigitalWrite\b|\bdigitalRead\b|\banalogRead\b|\banalogWrite\b/i.test(c) ||
        /\bpinMode\s*\(|\bdelay\s*\(|\bdelayMicroseconds\s*\(/i.test(c) ||
        /\bWire\.begin\b|\bSPI\.begin\b|\bSDcard\b|\bEthernet\b/i.test(c))
        return { domain: 'arduino', flags };

    // Embedded C — STM32 / AVR / PIC (not Arduino abstraction)
    if (/\bHAL_\w+\s*\(|\bGPIO_\w+\s*\(|\bTIM\d+\b|\bUSART\d+\b/i.test(c) ||
        /DDRD|PORTB|PIND|OCR1A|TCCR\d+[A-Z]|EICRA|SREG/i.test(c) ||
        /\b__attribute__\s*\(\s*\(interrupt\b|\bISR\s*\(|\bPRAGMA\s+interrupt/i.test(c) ||
        /#include\s+<avr\/io\.h>|#include\s+<stm32/i.test(c))
        return { domain: 'embedded_c', flags };

    // Verilog / SystemVerilog
    if (lang === 'verilog' || lang === 'systemverilog' || lang === 'sv' ||
        /\bmodule\s+\w+|\bendmodule\b|\balways\s*@|\binitial\s*begin\b|\bwire\s+\w|\breg\s+\w/i.test(c) ||
        /\bposedge\b|\bnegedge\b|\bbegin\b.*\bend\b/i.test(c) ||
        /#\d+\s+\w|\$display\b|\$monitor\b|\$finish\b/i.test(c))
        return { domain: 'verilog', flags };

    // VHDL
    if (lang === 'vhdl' ||
        /\bentity\s+\w+\s+is\b|\barchitecture\s+\w+\s+of\b|\bprocess\s*\(/i.test(c) ||
        /\bport\s+map\b|\bsignal\s+\w|\bstd_logic\b|\bstd_logic_vector\b/i.test(c))
        return { domain: 'vhdl', flags };

    // ARM Assembly
    if (/\.global\s+_start|\.text\s*$|\.syntax\s+unified|\.thumb\b|\.arm\b/im.test(c) ||
        (/\bldr\b|\bstr\b|\bmov\b|\badd\b|\bsub\b|\bbne\b|\bbeq\b|\bbl\b|\bpush\b\s*{/i.test(c) &&
        /r0|r1|r2|r3|r4|r5|r6|r7|sp|lr|pc/i.test(c)))
        return { domain: 'assembly_arm', flags };

    // RISC-V Assembly
    if ((/\baddi\b|\badd\b.*\bx\d+|\blw\b|\bsw\b|\bjalr\b/i.test(c) ||
        /a0|a1|a2|a3|a4|a5|s0|s1|t0|t1|t2|ra\b|gp\b|tp\b/i.test(c)) &&
        /\b(addi|add|sub|lw|sw|beq|bne|jal|jalr|lui|auipc|ecall)\b/i.test(c))
        return { domain: 'assembly_riscv', flags };

    // x86 / x86-64 Assembly
    if (lang === 'assembly' || lang === 'asm' || lang === 'nasm' || lang === 'masm' ||
        /global\s+_start|section\s+\.text|section\s+\.data|section\s+\.bss/i.test(c) ||
        /\bint\s+0x80\b|\bsyscall\b|\binvoke\b|\bproc\b|\bendp\b/i.test(c) ||
        /\brax\b|\brbx\b|\brcx\b|\brdx\b|\brsp\b|\brbp\b|\brsi\b|\brdi\b/i.test(c) ||
        /\beax\b|\bebx\b|\becx\b|\bedx\b|\besp\b|\bebp\b/i.test(c))
        return { domain: 'assembly_x86', flags };

    // SQL
    if (lang === 'sql' ||
        /\bselect\s+\w|\binsert\s+into\b|\bupdate\s+\w|\bdelete\s+from\b/i.test(c) ||
        /\bcreate\s+table\b|\bcreate\s+view\b|\bcreate\s+index\b|\bdrop\s+table\b/i.test(c) ||
        /\bjoin\b|\binner\s+join\b|\bleft\s+join\b|\bgroup\s+by\b|\border\s+by\b/i.test(c))
        return { domain: 'sql', flags };

    // Rust
    if (lang === 'rust' || lang === 'rs' ||
        /\bfn\s+main\s*\(\s*\)|\blet\s+mut\b|\blet\s+\w+\s*=|\bimpl\s+\w+\b/i.test(c) ||
        /\buse\s+std::|\buse\s+\w+::\w+|\bmod\s+\w+\b/i.test(c) ||
        /\bprintln!\s*\(|\beprintln!\s*\(|\bformat!\s*\(|\bvec!\s*\[/i.test(c) ||
        /::<\w+>|\bBox::<|\bRc::<|\bArc::<|\bOption<|\bResult<|\bVec<|\bHashMap</i.test(c))
        return { domain: 'rust', flags };

    // Go
    if (lang === 'go' ||
        /^package\s+\w+/m.test(c) ||
        /\bfunc\s+\w+\s*\(|\bgo\s+func\s*\(|\bgoroutine\b/i.test(c) ||
        /\bchan\s+\w+|\b<-*\w+|\bselect\s*{|\bdefer\s+\w+/i.test(c) ||
        /\bfmt\.Print|\bfmt\.Scan|\bfmt\.Errorf\b/i.test(c))
        return { domain: 'go', flags };

    // Kotlin
    if (lang === 'kotlin' || lang === 'kt' ||
        /\bfun\s+main\s*\(|\bval\s+\w+\s*=|\bvar\s+\w+\s*=|\bdata\s+class\b/i.test(c) ||
        /\bprintln\s*\(|\bcoroutineScope\b|\blaunch\b|\basync\b.*\bawait\(\)/i.test(c) ||
        /\?\.\w+|\?\?|\bwhen\s*\(|\bwhen\s*{/i.test(c))
        return { domain: 'kotlin', flags };

    // Swift
    if (lang === 'swift' ||
        /\bvar\s+\w+\s*:\s*\w+\s*=|\blet\s+\w+\s*:\s*\w+\s*=|\bfunc\s+\w+\s*\(/i.test(c) ||
        /\bprint\s*\(|\bguard\s+let\b|\bif\s+let\b|\boptional\b|\bunwrap\b/i.test(c) ||
        /\bprotocol\s+\w+\b|\bextension\s+\w+\b|\benum\s+\w+:\s*\w+/i.test(c))
        return { domain: 'swift', flags };

    // C# / .NET
    if (lang === 'csharp' || lang === 'c#' || lang === 'cs' ||
        /\busing\s+System\b|\busing\s+System\.\w+\b/i.test(c) ||
        /\bConsole\.Write|\bConsole\.Read|\bConsole\.Error\b/i.test(c) ||
        /\bnamespace\s+\w+|\bclass\s+\w+\s*:\s*\w+|\bpublic\s+static\s+void\s+Main/i.test(c) ||
        /\bLinq\b|\bIEnumerable<|\bList<\w+>|\bDictionary<\w+,\s*\w+>/i.test(c))
        return { domain: 'csharp', flags };

    // Java
    if (lang === 'java' ||
        /public\s+class\s+\w+|public\s+static\s+void\s+main\s*\(\s*String/i.test(c) ||
        /System\.out\.print|System\.err\.print|System\.in\b/i.test(c) ||
        /import\s+java\.\w+\.\w+;/i.test(c))
        return { domain: 'java', flags };

    // Fortran
    if (lang === 'fortran' || lang === 'f90' || lang === 'f77' ||
        /\bprogram\s+\w+|\bend\s+program\b|\bsubroutine\s+\w+|\bend\s+subroutine\b/i.test(c) ||
        /\binteger\s*::|real\s*::|double\s+precision|character\s*::|logical\s*::/i.test(c) ||
        /\bprint\s*\*\s*,|\bwrite\s*\(\s*\*\s*,|\bread\s*\(\s*\*\s*,|\bdo\s+\w+\s*=/i.test(c))
        return { domain: 'fortran', flags };

    // Bash / Shell
    if (lang === 'bash' || lang === 'sh' || lang === 'shell' || lang === 'zsh' ||
        /^#!\s*\/bin\/(bash|sh|zsh|dash)/m.test(c) ||
        /\becho\s+|\bexport\s+\w+=|\bsource\s+\w|\b\$\{[A-Z_]+\}|\bif\s+\[/i.test(c) ||
        /\bgrep\b|\bsed\b|\bawk\b|\bpipe\b|\bcat\s+\w|\bmkdir\b|\brm\s+-r/i.test(c) ||
        /\bssh\b|\bscp\b|\bchmod\b|\bchown\b|\bsudo\b/i.test(c))
        return { domain: 'bash', flags };

    // C++ (before C to avoid false match)
    if (lang === 'cpp' || lang === 'c++' ||
        /#include\s*<iostream>|#include\s*<vector>|#include\s*<string>|#include\s*<map>/i.test(c) ||
        /\bstd::\w+|\bcout\b|\bcin\b|\bcerr\b|\bendl\b/i.test(c) ||
        /\btemplate\s*<|\bnamespace\s+\w+|\bclass\s+\w+\s*{/i.test(c))
        return { domain: 'cpp', flags };

    // C
    if (lang === 'c' ||
        /#include\s*<stdio\.h>|#include\s*<stdlib\.h>|#include\s*<string\.h>/i.test(c) ||
        /\bprintf\s*\(|\bscanf\s*\(|\bfgets\s*\(|\bmalloc\s*\(|\bfree\s*\(/i.test(c) ||
        /int\s+main\s*\(\s*(void|int\s+argc)/i.test(c))
        return { domain: 'c', flags };

    // Python (fallback — broad match)
    if (lang === 'python' || lang === 'py' ||
        /\bdef\s+\w+\s*\(|\bclass\s+\w+\s*[:(]|\bimport\s+\w+|\bfrom\s+\w+\s+import\b/i.test(c) ||
        /\bprint\s*\(|\binput\s*\(|\brange\s*\(|\blen\s*\(|\btype\s*\(/i.test(c))
        return { domain: 'python', flags };

    // JavaScript / TypeScript
    if (lang === 'javascript' || lang === 'js' || lang === 'typescript' || lang === 'ts' ||
        /\bconsole\.log\b|\bconsole\.error\b|\bconst\s+\w+\s*=|\blet\s+\w+\s*=|\bvar\s+\w+\s*=/i.test(c) ||
        /\b=>\s*{|\bfunction\s+\w+\s*\(|\bmodule\.exports\b|\brequire\s*\(|\bimport\s+{/i.test(c))
        return { domain: 'javascript', flags };

    return { domain: 'general', flags };
};

// ─── Per-Domain Deep Prompt Modules ──────────────────────────────────────────
const PROMPT_MODULES = {

    plot3d: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: 3D INTERACTIVE GRAPH VISUALIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The code generates a 3D surface, wireframe, scatter3D, or parametric plot.
MANDATORY: Populate "htmlPlot" with a complete self-contained HTML page that:
1. Imports Plotly.js CDN: <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
2. Generates ALL coordinate data inside JavaScript using nested loops — NEVER use hardcoded static arrays.
   Example for z = sin(sqrt(x²+y²)) on [-5,5] with N=60 steps:
   const N=60, step=10/N, xArr=[], yArr=[], Z=[];
   for(let i=0;i<N;i++){xArr.push(-5+i*step); yArr.push(-5+i*step); Z.push([]);}
   for(let i=0;i<N;i++) for(let j=0;j<N;j++) Z[i].push(Math.sin(Math.sqrt(xArr[i]**2+yArr[j]**2)));
3. DOWNSAMPLING / DENSITY CAP:
   If N is very large (e.g. N > 5,000 for scatter plots, meshes, or point clouds), DO NOT fail or write error messages. Proceed with a successful compile and run, but downsample N to a visualization limit of 3,000 to 5,000 points inside the JavaScript code so rendering is fast and doesn't freeze the browser.
   To generate randn (normal distribution) scatter points in JavaScript, use Box-Muller transform helper:
   const randn = () => Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
   const x=[], y=[], z=[], c=[];
   for(let i=0; i<3000; i++) {
       const xv = randn(), yv = randn(), zv = randn();
       x.push(xv); y.push(yv); z.push(zv);
       c.push(Math.sqrt(xv*xv + yv*yv + zv*zv)); // color mapping
   }
4. Render with Plotly.newPlot('pd',[{type:'scatter3d',mode:'markers',x:x,y:y,z:z,marker:{size:2,color:c,colorscale:'Turbo'}}], ...);
5. Match colorscale name from code (e.g. 'turbo', 'viridis') or use a beautiful default.
6. Full page CSS: html,body{margin:0;padding:0;background:#0f1117;width:100%;height:100%;}
   #pd{width:100%;height:100vh;}
7. Match the EXACT mathematical function/formula from the student's code.
8. Terminal output (Section 1): print only "Process finished with exit code 0".
`,

    plot2d: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: 2D INTERACTIVE GRAPH VISUALIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The code generates a 2D plot (line, bar, scatter, histogram, pie, heatmap, etc.).
MANDATORY: Populate "htmlPlot" with a complete self-contained HTML page:
1. For standard charts: import Chart.js: <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
2. For heatmaps, contour, or complex layouts: use Plotly: <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
3. DOWNSAMPLING / DENSITY CAP:
   If N is very large (e.g. N > 5,000), downsample the dataset inside the JavaScript code to a maximum of 3,000 points to keep the rendering smooth and prevent browser crashes, while maintaining the overall mathematical shape/distribution.
4. Compute ALL data points with JavaScript loops matching the student's formula exactly.
   Example sin curve: const x=[],y=[]; for(let i=0;i<=100;i++){const v=-5+i*0.1; x.push(v.toFixed(2)); y.push(Math.sin(v));}
5. For Chart.js line/bar/scatter: use canvas element, apply dark theme:
   backgroundColor:'rgba(108,99,255,0.15)', borderColor:'#6c63ff', borderWidth:2,
   grid:{color:'rgba(255,255,255,0.07)'}, ticks:{color:'#94a3b8'}, plugins.legend.labels:{color:'#94a3b8'}
6. For Plotly 2D: paper_bgcolor:'#0f1117', plot_bgcolor:'#0f1117', font:{color:'#94a3b8'}, margin:{l:50,r:20,t:40,b:50}
7. Page CSS: html,body{margin:0;padding:4px;background:#0f1117;width:100%;height:100%;box-sizing:border-box;}
   canvas{width:100%!important;height:calc(100vh - 8px)!important;}
   #pd{width:100%;height:100vh;}
8. For seaborn/ggplot2 equivalents: map to Plotly histogram, violin, boxplot, or heatmap.
9. Terminal output (Section 1): print ONLY "Process finished with exit code 0" — plt.show() has no stdout.
`,

    matlab: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: MATLAB / GNU OCTAVE SIMULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Runtime rules:
- Emulate MATLAB R2024a / Octave 9.x semantics.
- Indexing is 1-based. Semicolons suppress output; no semicolon echoes result with variable name.
- Matrix operations: validate conformable dimensions. Report "error: operator *: nonconformant arguments" on mismatch.
- fprintf/disp/display: print exactly as MATLAB would.
- Colon operator: 1:5 → 1 2 3 4 5. 1:0.5:3 → 1.0000 1.5000 2.0000 2.5000 3.0000
- Built-ins: zeros, ones, eye, rand, linspace, logspace, size, length, numel, reshape, sum, max, min, mean, std, sort, find, mod, floor, ceil, round, abs, sqrt, exp, log, log2, log10, sin, cos, tan, fft, ifft, inv, det, eig, svd, lu, qr, pinv.
- struct: field access via dot notation. cell arrays: braces {}.
- If code calls plot/figure/surf/mesh/contour/histogram:
  → Populate "htmlPlot" with a self-contained Plotly HTML page replicating the figure.
  → Terminal output: "Figure 1" then blank line.
- Error format: "error: <message>" on its own line followed by blank line.
`,

    r_lang: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: R LANGUAGE SIMULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Runtime rules:
- Emulate R 4.4.x with tidyverse loaded by default.
- Output: print() and cat() format as R console. Vectors prefix with index [1], [11], etc.
- Assignment: <- and = are both valid. NA, NaN, Inf, TRUE, FALSE are literals.
- Built-ins: c(), seq(), rep(), length(), nrow(), ncol(), dim(), head(), tail(), summary(), str(), class(), typeof(), which(), match(), table(), sort(), order(), rev(), apply(), lapply(), sapply(), Map(), Reduce(), do.call().
- dplyr/tidyr: simulate pipe operator |> and %>%. filter(), mutate(), select(), arrange(), group_by(), summarise(), pivot_longer(), pivot_wider(), left_join(), inner_join().
- ggplot2: if ggplot() call found, produce Plotly HTML equivalent in "htmlPlot". Terminal: "Plot window opened".
- base plot()/hist()/boxplot()/barplot(): produce Chart.js or Plotly HTML in "htmlPlot". Terminal: "null device\n          1".
- Error format: "Error in <call> : <message>"
- Warning format: "Warning message:\nIn <call> : <message>"
`,

    julia: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: JULIA SIMULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Runtime rules:
- Emulate Julia 1.10.x.
- @time: output format "  0.001234 seconds (128 allocations: 6.250 KiB)".
- println uses string interpolation: "$varname" or "$(expr)".
- Type system: Int64, Float64, String, Bool, Vector{T}, Matrix{T}, Dict{K,V}.
- Broadcasting: .+ .* ./ .^ — element-wise. Simulate correctly.
- Comprehensions: [f(x) for x in 1:10 if condition] → simulate as array.
- Plots.jl / PyPlot.jl / Makie: if plot() called → produce Plotly HTML in "htmlPlot". Terminal: blank.
- Error format: "ERROR: <ExceptionType>: <message>\nStacktrace:\n [1] <function>(::Type) at <file>:<line>"
`,

    micropython: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: MICROPYTHON VIRTUAL HARDWARE (RP2040 / ESP32 / ESP8266)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hardware simulation rules:
- Detect target from imports: rp2/machine → RP2040; network.WLAN or esp → ESP32/ESP8266.
- BOOT sequence output (always):
  MicroPython v1.23.0 on 2024-06-02; Raspberry Pi Pico with RP2040
  Type "help()" for more information.
  >>>
- Pin simulation:
  Pin(N, Pin.OUT) → [GPIO N] Configured as OUTPUT
  pin.value(1)    → [GPIO N] → HIGH (3.3V)
  pin.value(0)    → [GPIO N] → LOW  (0V)
  pin.toggle()    → [GPIO N] toggled to HIGH/LOW
- ADC simulation: adc.read_u16() → [ADC CHN] raw=32768 voltage=1.65V
- PWM simulation: pwm.duty_u16(32768) → [PWM GPIO N] duty=50.0% freq=<freq>Hz
- I2C simulation: i2c.scan() → [I2C] Scanning bus... found devices: [0x3C, 0x68]
  i2c.writeto/readfrom → [I2C] TX: 0xNN → ACK / RX: [0xNN, 0xNN]
- SPI: spi.write(b'\x01\x02') → [SPI] MOSI: 0x01 0x02
- UART: uart.write('cmd') → [UART0] TX: cmd
- network.WLAN: [WiFi] Connecting to SSID... Connected. IP: 192.168.1.42
- time.sleep(n): show [SLEEP] <n>s. Infinite loops: show first 3 iterations then "... [loop continues]"
- MicroPython errors: full traceback in MicroPython format.
`,

    arduino: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: ARDUINO VIRTUAL HARDWARE SIMULATOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hardware simulation rules:
- Target: Arduino Uno (ATmega328P, 16MHz) unless board-specific code detected.
- BOOT header:
  [BOOT] Arduino Uno — ATmega328P @ 16MHz
  [BOOT] Sketch size: ~<estimated>B / 32256B (Flash)
  [BOOT] SRAM: ~<estimated>B / 2048B
- setup() runs once; loop() runs continuously.
- For loop() with delay: simulate first 3 iterations with timestamps then "... [loop repeating every <N>ms]".
- Pin functions:
  pinMode(N, OUTPUT/INPUT/INPUT_PULLUP) → [PIN N] Mode: OUTPUT/INPUT/PULLUP
  digitalWrite(N, HIGH/LOW)            → [PIN N] → HIGH / LOW
  digitalRead(N)                       → [PIN N] READ → HIGH
  analogWrite(N, val)                  → [PIN N] PWM → <val>/255 (<pct>%)
  analogRead(A0..A5)                   → [ADC A<N>] → 512 (2.50V, 10-bit)
- Serial output: exactly as written. Serial.begin(baud) → [Serial] <baud> baud ready.
- Wire (I2C): Wire.begin() → [I2C] Bus initialized.
- Compilation errors: GCC/avr-g++ error format: <filename>.ino:<line>:<col>: error: <message>
`,

    embedded_c: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: EMBEDDED C — STM32 / AVR / PIC REGISTER-LEVEL SIMULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Simulation rules:
- Detect MCU from includes: stm32f*→ ARM Cortex-M, avr/io.h → AVR ATmega, xc.h → PIC.
- STM32 HAL:
  [HAL] System Core Clock: 84 MHz (STM32F4) / 72 MHz (STM32F1)
  HAL_GPIO_WritePin(GPIOx, GPIO_PIN_N, GPIO_PIN_SET)   → [GPIO Px.N] → HIGH
  HAL_GPIO_WritePin(GPIOx, GPIO_PIN_N, GPIO_PIN_RESET) → [GPIO Px.N] → LOW
  HAL_UART_Transmit(&hN, data, len, timeout) → [UART<N> TX] <data as ASCII>
  HAL_Delay(ms) → [DELAY] <ms>ms
- AVR register operations — show register state after each write:
  DDRB |= (1<<PB5)  → [DDRB] = 0b00100000 — PB5 set as OUTPUT
  PORTB |= (1<<PB5) → [PORTB]= 0b00100000 — PB5 HIGH
  ISR(TIMER1_COMPA_vect) → [ISR] TIMER1_COMPA triggered
- Infinite loops: show 3 iterations then "... [ISR-driven loop continues]".
`,

    verilog: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: VERILOG / SYSTEMVERILOG RTL SIMULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Simulation rules (iverilog/ModelSim semantics):
- Parse module/endmodule hierarchy. Show port list at top.
- Initial block: execute statements in time order. $display → stdout. $monitor → register-change log.
- Always @(posedge clk): simulate clock edges. Format: [T=<N>ns] clk↑  <signal>=<value>
- Non-blocking (<=): schedule to end of time step. Blocking (=): immediate.
- $finish / $stop: terminate simulation.
- Header: VVP (Icarus Verilog) simulation starting... / Module: <top_module_name>
- Syntax errors: "<file>:<line>: syntax error, unexpected <token>"
`,

    vhdl: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: VHDL SIMULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Simulation rules (GHDL 4.x semantics):
- Show entity/architecture name at start.
- Process with sensitivity list: re-evaluate when listed signals change.
- Signal assignment (<=): scheduled update after delta cycle.
- report statement: "[<time>] NOTE/WARNING/ERROR: <message>".
- Format: [<sim_time>] <entity_name>/<arch_name>: <output>
- Header: GHDL simulation starting — entity: <name>
`,

    assembly_x86: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: x86 / x86-64 ASSEMBLY SIMULATION (NASM / GAS / MASM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Execution rules:
- Detect mode: 64-bit if rax/rbx/rdi/rsi used; 32-bit if eax/ebx/int 0x80 used.
- Simulate GPRs: rax/eax/ax/al, rbx/ebx, rcx/ecx, rdx/edx, rsi/esi, rdi/edi, rsp/esp, rbp/ebp, r8–r15.
- Show register state at key instructions.
  Format: [0x<addr>] <instruction>   ; <reg>=0x<hex> (<decimal>)
- Linux x86-64 syscalls (rax=num): sys_write(1)→stdout, sys_read(0)→inject input, sys_exit(60)→terminate.
- Linux x86 32-bit (int 0x80, eax=num): sys_write(4)→stdout, sys_exit(1)→terminate.
- Stack: show [RSP]=0x<addr> after push/pop.
- Flags: update ZF/SF/CF/OF after arithmetic. Show on conditional jumps.
- Segfault: "[SIGSEGV] Segmentation fault (core dumped)"
- Assemble errors: "nasm: <file>:<line>: error: <message>"
`,

    assembly_arm: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: ARM / AArch64 ASSEMBLY SIMULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Execution rules:
- Detect: AArch64 if x0–x30/w0–w30 used; ARMv7 if r0–r15.
- ARMv7 registers: r0–r12, r13=SP, r14=LR, r15=PC, CPSR.
- AArch64 registers: x0–x30, SP, PC, NZCV.
- Format: [PC=0x<addr>] <mnemonic> <operands>   ; <reg>=0x<hex>
- Calling convention: ARMv7 EABI args→r0-r3, return→r0. AArch64 AAPCS64 args→x0-x7, return→x0.
- Linux ARM syscalls: svc #0. AArch64: x8=num. ARMv7: r7=num. write→stdout. exit→terminate.
- MMIO: address 0x40000000+ write → "[MMIO 0x<addr>] ← 0x<val>"
- Assemble errors: "arm-none-eabi-as: <file>:<line>: Error: <message>"
`,

    assembly_riscv: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: RISC-V ASSEMBLY SIMULATION (RV32I / RV64I)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Execution rules:
- Detect RV64I if ld/sd instructions; otherwise RV32I.
- ABI registers: x0(zero), x1(ra), x2(sp), x10-17(a0-7), x5-7(t0-2), x18-27(s2-11).
- x0 always 0 (hardwired). Writes to x0 are no-ops.
- Format: [PC=0x<addr>] <mnemonic> <operands>   ; <ABI_name>=0x<hex>
- ecall: a7=syscall. write(a7=64)→stdout. exit(a7=93,a0=code).
- JAL/JALR: show "CALL → <target>" and "RETURN → <PC+4>".
- Pseudo-instructions: li, mv, j, call, ret → expand and simulate both.
- Assemble errors: "riscv64-unknown-elf-as: <file>:<line>: Error: <message>"
`,

    sql: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: SQL / RELATIONAL DATABASE ENGINE SIMULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Emulate SQLite 3.45 / PostgreSQL 16 (infer from syntax):
- CREATE TABLE: "CREATE TABLE <name> (OK)"
- INSERT: "INSERT 0 1" (PG) or "Query OK, 1 row affected (0.00 sec)" (MySQL-style).
- SELECT: render as beautiful ASCII box table. Compute ALL values (aggregations, joins, window funcs).
  Format:
  +--------+----------+-------+
  | col1   | col2     | col3  |
  +--------+----------+-------+
  | Alice  | Engineer | 95000 |
  | Bob    | Manager  | 87000 |
  +--------+----------+-------+
  (2 rows)
- JOINs: correctly merge rows. INNER JOIN = intersection. LEFT JOIN = all left + matched.
- GROUP BY + aggregates: SUM, COUNT, AVG, MAX, MIN — compute from created/inserted data.
- Window functions (ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD, PARTITION BY): simulate correctly.
- CTEs (WITH ... AS): evaluate recursively if RECURSIVE keyword present.
- EXPLAIN: output realistic query plan with Seq Scan, Index Scan, Hash Join nodes and cost estimates.
- Errors: "ERROR: <message>" (PG) or "ERROR 1064 (42000): <message>" (MySQL).
- Transactions: BEGIN/COMMIT/ROLLBACK — track state and apply/revert accordingly.
`,

    rust: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: RUST SIMULATION (rustc 1.79 stable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Compilation + execution rules:
- Ownership & borrow checking: detect moves, double-frees, dangling refs, multiple mutable borrows.
  Borrow error format:
  error[E0505]: cannot move out of \`x\` because it is borrowed
   --> src/main.rs:<line>:<col>
- Compilation header on success: "   Compiling <crate> v0.1.0\n    Finished dev [unoptimized + debuginfo] target(s) in 0.42s\n     Running \`target/debug/<binary>\`"
- println!/eprintln!: {:?} for Debug, {:#?} pretty Debug, {} Display. Vectors: [1, 2, 3]. Options: Some(42)/None.
- Panics: "thread 'main' panicked at 'assertion failed: <expr>', src/main.rs:<line>:<col>"
- Integer overflow (debug): "thread 'main' panicked at 'attempt to add with overflow'".
`,

    go: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: GO SIMULATION (Go 1.22)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Compilation + execution rules:
- fmt.Print/Println/Printf: %v=default, %+v=struct fields, %#v=Go syntax, %T=type.
- goroutines: interleaved output — mark "[goroutine <N>] <output>".
- Channels: simulate send/receive. Deadlock: "fatal error: all goroutines are asleep - deadlock!"
- defer: LIFO order at function return.
- panic: "goroutine 1 [running]:\nmain.main()\n\t<file>:<line> +0x<addr>\nexit status 2"
- recover(): caught panics → "Recovered: <panic_value>".
`,

    kotlin: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: KOTLIN SIMULATION (Kotlin 2.0 JVM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rules:
- null safety: ?. → return null (no NPE). !! → throw NullPointerException if null.
- data class: auto-generates toString(), equals(), hashCode(), copy().
- when expression: match first branch, return value.
- Coroutines: launch{} → [coroutine] prefix. runBlocking{}: blocks thread.
- Compilation error: "<file>.kt:<line>:<col>: error: <message>"
`,

    swift: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: SWIFT SIMULATION (Swift 5.10)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rules:
- Optionals: forced unwrap (x!) on nil → "Fatal error: Unexpectedly found nil while unwrapping an Optional value"
- guard let / if let: optional binding.
- print() with separator/terminator. String interpolation: "\\(expr)".
- struct = value type (copied). class = reference type.
- enum with associated values: exhaustive pattern matching.
- async/await: Task { } runs async.
- do { try ... } catch { print(error) }
- Compilation error: "<file>.swift:<line>:<col>: error: <message>"
`,

    csharp: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: C# / .NET SIMULATION (.NET 8 / C# 12)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rules:
- Console.WriteLine/Write/Error.WriteLine: simulate exactly with string formatting.
- LINQ: Select, Where, OrderBy, GroupBy, Join, Aggregate, First, FirstOrDefault, Single, Any, All, Count, Sum, Max, Min, Average, Distinct, Take, Skip, ToList, ToArray, ToDictionary.
- async/await: Task-based. Show output in correct continuation order.
- Records: record Person(string Name, int Age) → "Person { Name = Alice, Age = 30 }"
- Exception format: "Unhandled exception. System.<ExceptionType>: <message>\n   at <Method> in <file>:line <N>"
- Compilation error: "<file>.cs(<line>,<col>): error CS<NNNN>: <message>"
`,

    java: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: JAVA SIMULATION (OpenJDK 21 LTS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rules:
- System.out.println/print/err.println: simulate exactly.
- Exception stack trace:
  Exception in thread "main" java.lang.<ExceptionType>: <message>
    at ClassName.methodName(FileName.java:<line>)
- Checked exceptions not caught/declared → compile error "unreported exception X; must be caught or declared to be thrown".
- Streams API: stream().filter().map().collect() — evaluate lazily, return correct result.
- Records (Java 16+): "Person[name=Alice, age=30]"
- Compilation error: "<file>.java:<line>: error: <message>\n    <source_line>\n    ^"
`,

    fortran: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: FORTRAN SIMULATION (gfortran 13, Fortran 2018)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rules:
- Case insensitive. Fixed-form if column 1-6 = label.
- PRINT *, / WRITE(*,*): reals in scientific notation if |val|>1e5 or <1e-3, else fixed.
- FORMAT descriptors: I, F, E, G, A, X, /, T — interpret correctly.
- DO loop: DO i=1,10,2 → i takes 1,3,5,7,9.
- Arrays: 1-indexed. Element-wise operations.
- Intrinsics: ABS, SQRT, EXP, LOG, SIN, COS, TAN, MOD, MAX, MIN, MATMUL, DOT_PRODUCT, TRANSPOSE, SUM, PRODUCT.
- SUBROUTINE: pass by reference. FUNCTION: returns value.
- Compilation error: "<file>.f90:<line>.<col>-<col>: Error: <message>"
`,

    bash: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: GNU BASH / POSIX SH SIMULATION (bash 5.2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Simulation rules:
- Shell prompt: simulate as running on Debian Linux as user@host in /home/user.
- Variable expansion: \$VAR, \${VAR}, \${VAR:-default}, \${#VAR}, \${VAR#prefix}, \${VAR%suffix}.
- Command substitution: \$(cmd) — execute and insert stdout.
- Arithmetic: \$((2+3)) → 5.
- Pipelines: cmd1 | cmd2 — full data flow.
- Common utilities: echo, printf, cat, ls, pwd, mkdir, rm, cp, mv, touch, find, grep, sed, awk, cut, sort, uniq, wc, head, tail, tr, xargs, date, whoami, hostname, env, export, source, read.
- Conditionals: if [ \$x -eq 5 ]; then ... fi. [[ ]] extended tests. -eq, -ne, -lt, -gt, -z, -n, -f, -d, -e.
- Loops: for, while, until.
- Exit codes: \$? reflects last command. 0=success, 127=command not found.
- Errors: "bash: <command>: command not found"
`,

    cpp: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: C++ SIMULATION (g++ 13, C++23)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rules:
- std::cout/cerr/clog: simulate with correct formatting. std::endl flushes + newline; '\n' only newline.
- STL containers: vector, list, deque, map, set, unordered_map, unordered_set, array, string, pair, tuple.
- Smart pointers: unique_ptr (no copy), shared_ptr (ref count), weak_ptr (no ownership).
- Lambdas: [capture](params) → expr. [=] by value, [&] by reference.
- Undefined behaviour: detect signed overflow, null deref, out-of-bounds — note in lineChecks.
- Compilation error: "<file>.cpp:<line>:<col>: error: <message>"
`,

    c: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: C SIMULATION (gcc 13, C17)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rules:
- printf format: %d %i %u %ld %lld %f %lf %e %g %s %c %p %x %o — simulate exactly.
- scanf: inject deterministic classroom-safe values. Echo input if program would.
- Pointer arithmetic: ptr + n increments by sizeof(*ptr) bytes.
- malloc/calloc/realloc/free: simulate heap. Double-free/null-deref → lineChecks error.
- Buffer overflow: note in lineChecks as warning.
- string.h: strlen, strcpy, strncpy, strcat, strcmp, strchr, strstr, memset, memcpy.
- math.h: sqrt, pow, abs, fabs, floor, ceil, round, sin, cos, log, log10, exp.
- Compilation error: "<file>.c:<line>:<col>: error: <message>"
`,

    python: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: PYTHON SIMULATION (CPython 3.12)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rules:
- Indentation: 4-space standard. Mixed tabs/spaces → "TabError".
- print(): end='\n' default. sep=' ' between args.
- input(): prompt to stdout. Inject deterministic classroom-safe value and echo it.
- Exception traceback:
  Traceback (most recent call last):
    File "main.py", line <N>, in <module>
      <source_line>
  <ExceptionClass>: <message>
- F-strings: {expr!r}, {expr!s}, {expr:.2f} — evaluate correctly.
- Comprehensions: [x**2 for x in range(5) if x%2==0] → [0, 4, 16].
- Walrus operator :=: assign and test.
- match/case: find first matching arm (PEP 634).
- dataclasses: @dataclass auto-generates __init__, __repr__, __eq__.
- Performance: Even if code uses massive numbers of iterations (e.g. N = 10,000,000) or high memory arrays, do not simulate crashes, warnings, or memory errors. Assume compilation and execution succeed normally. The visual plotting runtime will handle any required downsampling.
`,

    javascript: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: JAVASCRIPT / TYPESCRIPT SIMULATION (Node.js 22 / V8)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rules:
- console.log/warn/error/info/table/dir/time/timeEnd: simulate exactly. console.table → ASCII table.
- Async/await + Promises: microtask queue order. await suspends; .then() enqueued after current task.
- Event loop: setTimeout(fn, 0) runs AFTER all microtasks. setInterval: first 3 iterations then "... [interval repeating]".
- Closures: capture by reference (var) or by binding (let/const per-iteration).
- Destructuring: {a, b} = obj, [x, y] = arr.
- TypeScript type annotations: strip at runtime. Type errors in lineChecks.
- Node.js built-ins: process.argv, process.env, fs, path, crypto — simulate plausible output.
- Error: "<ExceptionType>: <message>\n    at <function> (<file>:<line>:<col>)"
`,

    general: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED RUNTIME: UNIVERSAL LANGUAGE EMULATION MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Auto-detect the language and apply the most appropriate runtime semantics.
Simulate output as precisely as possible. Note the detected language in lineChecks.
`,
};

// ─── Feature-Flag Augmentation Prompts ────────────────────────────────────────
const FLAG_AUGMENTS = {
    interactive: `\nINTERACTIVE MODE: Inject deterministic, classroom-safe inputs (e.g. name="Alice", age=25, number=42). Echo each input as the terminal would.`,
    networking: `\nNETWORKING: Simulate HTTP responses with realistic status codes (200 OK) and plausible JSON bodies.`,
    concurrency: `\nCONCURRENCY: Show thread/goroutine/coroutine output interleaved in a plausible non-deterministic order. Label each concurrent output line.`,
    oop: `\nOOP: Trace constructor calls, method dispatch, and inheritance chains where relevant.`,
};

// ─── Build the Full System Prompt from Profile ────────────────────────────────
const buildSystemPrompt = (profile) => {
    const domainModule = PROMPT_MODULES[profile.domain] || PROMPT_MODULES.general;
    const flagAugments = [...profile.flags]
        .map(f => FLAG_AUGMENTS[f] || '')
        .filter(Boolean)
        .join('');

    return `You are J-Compiler — the world's most accurate virtual compiler and runtime emulator. A student has submitted code to run. You must mentally execute it and produce a PERFECTLY REALISTIC simulation.

SPECIALIZED RUNTIME INSTRUCTIONS FOR THIS MODULE:
${domainModule}${flagAugments}

CRITICAL OUTPUT FORMAT — follow this EXACTLY:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1: TERMINAL OUTPUT (raw stdout/stderr only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Print EXACTLY what appears in a real terminal. No JSON, no markdown, no commentary.
FOR COMPILE/RUNTIME ERRORS: print native traceback/error text, then stop.
FOR NO OUTPUT + CLEAN EXIT: print a single blank line.
FOR HUGE OUTPUT: first 20 lines, then "... [N more lines] ...", then last 5 lines.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEPARATOR LINE (REQUIRED — always on its own line):
<<<JANALYSIS>>>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2: JSON ANALYSIS OBJECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Output a single valid JSON object (no markdown fences, no prose):
{
  "status": "success" | "error",
  "detectedLanguage": "<language/runtime detected>",
  "verdict": "<one sentence: what happened>",
  "reasoning": "<step-by-step trace of key operations>",
  "lineChecks": [
    { "line": <number>, "code": "<exact source line>", "severity": "ok" | "warning" | "error", "finding": "<what this line does or its issue>" }
  ],
  "errorExplanation": "<student-friendly root cause, empty if success>",
  "fixedCode": "<complete corrected program if error, empty if success>",
  "mermaidGraph": "<valid Mermaid graph TD — quote ALL node labels in double quotes, no colons or parens in node IDs>",
  "chartSpec": null,
  "htmlPlot": null | "<string: complete self-contained HTML that renders the plot — see domain section above for exact template>"
}
Rules:
- mermaidGraph: always include, even on errors — show intended control flow.
- htmlPlot: set to null unless the code explicitly generates a plot/figure/graph.
- All string values must be properly JSON-escaped (escape \\, ", \\n, \\t).
- lineChecks: cover every important line — declarations, branches, loops, I/O, errors.`;
};

// ─── Single-call JCompiler: compile + analyze in ONE Puter stream ─────────────
export const streamCompileWithAnalysis = async (code, language, options = {}) => {
    const { onOutputToken, signal } = options;
    const langLabel = language === 'auto' ? 'auto-detect' : language;

    try {
        await ensurePuterReady({ timeoutMs: 8000 });
    } catch {
        throw new Error('Puter.js is not available. Please check your connection.');
    }
    if (!window.puter?.ai?.chat) throw new Error('Puter AI unavailable.');

    // ── Detect language profile and build modular system prompt ──────────────
    const profile = detectLanguageProfile(code, language);
    console.log('[JCompiler AI] Detected language profile:', profile.domain, [...profile.flags]);
    const systemPrompt = buildSystemPrompt(profile);

    const userMsg = `Language: ${langLabel}
\`\`\`${language !== 'auto' ? language : ''}
${code}
\`\`\``;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMsg },
    ];

    console.log('[JCompiler AI] streamCompileWithAnalysis — domain:', profile.domain, '| code length:', code.length);

    // Call Puter default AI — no model = gpt-5-nano free default
    const response = await window.puter.ai.chat(messages, { stream: true });
    console.log('[JCompiler AI] Puter chat response object:', response);

    let accumOutput = '';
    let accumJSON   = '';
    let separatorFound = false;

    // Strip AI-echoed section header lines from terminal output
    const stripSectionHeaders = (text) => text
        .split('\n')
        .filter(line => {
            const t = line.trim();
            if (!t) return true;
            if (/^━+$/.test(t)) return false;
            if (/^SECTION\s+1\s*:/i.test(t)) return false;
            if (/^\(raw\s+stdout/i.test(t)) return false;
            if (/^SPECIALIZED\s+RUNTIME:/i.test(t)) return false;
            return true;
        })
        .join('\n')
        .replace(/^\n+/, '');

    if (response?.[Symbol.asyncIterator]) {
        for await (const chunk of response) {
            if (signal?.aborted) break;
            const token = chunk?.text ?? '';
            if (!token) continue;

            if (!separatorFound) {
                const combined = accumOutput + token;
                const match = combined.match(/<<<[ \t]*JANALYSIS[ \t]*>>>/i);

                if (!match) {
                    accumOutput = combined;
                    const visibleSoFar = stripSectionHeaders(accumOutput);
                    onOutputToken?.(token, visibleSoFar);
                } else {
                    separatorFound = true;
                    const sepIdx = match.index;
                    const sepLen = match[0].length;
                    const rawOutput  = combined.slice(0, sepIdx);
                    const afterSep   = combined.slice(sepIdx + sepLen);
                    const cleaned    = stripSectionHeaders(rawOutput);
                    const lastFragment = cleaned.slice(stripSectionHeaders(accumOutput).length);
                    if (lastFragment) onOutputToken?.(lastFragment, cleaned);
                    accumOutput = cleaned.trimEnd();
                    accumJSON   = afterSep;
                    console.log('[JCompiler AI] Separator found. Output finalized:', accumOutput.slice(0, 200));
                }
            } else {
                accumJSON += token;
            }
        }
    } else if (response?.message) {
        const msg = response.message;
        const full = typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
                ? msg.content.map(p => p.text ?? '').join('')
                : '';
        const match = full.match(/<<<[ \t]*JANALYSIS[ \t]*>>>/i);
        if (!match) {
            accumOutput = full;
            onOutputToken?.(full, full);
        } else {
            const sepIdx = match.index;
            const sepLen = match[0].length;
            accumOutput = full.slice(0, sepIdx).trimEnd();
            accumJSON   = full.slice(sepIdx + sepLen);
            onOutputToken?.(accumOutput, accumOutput);
        }
    }

    // Final cleanup — strip any residual header lines
    accumOutput = stripSectionHeaders(accumOutput).trimEnd();
    console.log('[JCompiler AI] Streaming complete. Output length:', accumOutput.length, '| JSON length:', accumJSON.length);

    // Parse analysis JSON — strip accidental markdown fences
    let analysis = {
        status: 'unknown', detectedLanguage: langLabel, verdict: '',
        reasoning: '', lineChecks: [], errorExplanation: '',
        fixedCode: '', fixReport: '', mermaidGraph: '',
        chartSpec: null, htmlPlot: null,
    };
    try {
        const cleaned = accumJSON.trim()
            .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        if (cleaned) {
            const parsed = JSON.parse(cleaned);
            analysis = { ...analysis, ...parsed };
        }
    } catch {
        try {
            analysis = { ...analysis, ...parseAIJSON(accumJSON) };
        } catch { /* keep defaults */ }
    }

    return { outputText: accumOutput, analysis };
};

// J-Compiler: AI Mermaid Fix — repairs broken mermaid syntax via Puter default model
export const fixMermaidGraph = async (brokenMermaid, errorMsg = '') => {
    try {
        await ensurePuterReady({ timeoutMs: 8000 });
    } catch {
        throw new Error('Puter.js is not available.');
    }
    if (!window.puter?.ai?.chat) throw new Error('Puter AI unavailable.');

    const systemPrompt =
`You are a Mermaid diagram syntax expert. You will be given a broken Mermaid diagram that fails to render, along with the error message. Fix it and return ONLY the corrected Mermaid diagram source — no prose, no markdown fences, no explanation.

STRICT MERMAID RULES:
- Always start with: graph TD
- Node IDs must be alphanumeric only — NO spaces, colons, quotes, parentheses, slashes, or special chars. Use camelCase: initProgram, readInput, computeSum
- Node labels must be in double quotes if they contain special characters: A["Label with spaces"]
- NEVER use reserved words as node IDs: Start, End, start, end, stop, Stop → use startNode, endNode, stopNode instead
- Arrow syntax: A --> B (space before and after -->)
- Conditional branches: A -->|"Yes"| B  and A -->|"No"| C  (label in double quotes)
- No trailing semicolons inside labels
- No colons inside unquoted labels
- No parentheses in node IDs
- The diagram must be valid Mermaid v10+ syntax

Return ONLY the fixed diagram. Start with "graph TD" on the first line.`;

    const userMsg = `Broken Mermaid diagram:\n\`\`\`\n${brokenMermaid}\n\`\`\`\n\nError: ${errorMsg}\n\nFix the diagram and return only the corrected Mermaid source.`;

    const response = await window.puter.ai.chat(
        [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userMsg },
        ],
        { stream: false }
    );

    let fixed = '';
    if (typeof response === 'string') {
        fixed = response;
    } else if (response?.message?.content) {
        const c = response.message.content;
        fixed = typeof c === 'string' ? c : Array.isArray(c) ? c.map(p => p.text ?? '').join('') : '';
    } else if (response?.text) {
        fixed = response.text;
    }

    // Strip any markdown fences the model added
    fixed = fixed.trim().replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```$/, '').trim();
    console.log('[JCompiler] fixMermaidGraph result:', fixed);
    return fixed;
};

// J-Compiler: Reverse Engineering (Output -> Code)
// Calls Puter default AI directly — no hardcoded model
export const reverseEngineerCode = async (expectedOutput, language = 'javascript', options = {}) => {
    const { onToken, signal } = options;
    const SEPARATOR = '<<<EXPLANATION>>>';

    try {
        await ensurePuterReady({ timeoutMs: 8000 });
    } catch {
        throw new Error('Puter.js is not available.');
    }
    if (!window.puter?.ai?.chat) throw new Error('Puter AI unavailable.');

    const systemPrompt =
`You are a reverse engineering engine for ${language}.
Given the expected output or crash log below, reconstruct the simplest complete, correct ${language} source code that produces it.
Output the raw source code ONLY — no markdown fences, no JSON, no preamble.
After the last line of code, on a new line write exactly: <<<EXPLANATION>>>
Then write two short sentences explaining how the output is produced.
If the input is an error/crash log, write corrected code that fixes the root cause and explain the repair after the separator.`;

    const messages = [{
        role: 'system',
        content: systemPrompt
    }, {
        role: 'user',
        content: `Language: ${language}\nExpected output or error log:\n${expectedOutput}`,
    }];


    console.log("[JCompiler AI] reverseEngineerCode starting. Language:", language, "Expected output length:", expectedOutput.length);
    console.log("[JCompiler AI] Messages being sent to Puter default model for reverse engineering:", messages);

    const response = await window.puter.ai.chat(messages, { stream: true });
    console.log("[JCompiler AI] Puter response metadata/object (reverse engineer):", response);

    let accumulated = '';

    if (response?.[Symbol.asyncIterator]) {
        for await (const chunk of response) {
            if (signal?.aborted) break;
            // Per Puter docs: chunk.text is the token
            const token = chunk?.text ?? '';
            if (!token) continue;
            accumulated += token;
            const displayText = accumulated.replace(/<<<EXPLANATION>>>[\s\S]*$/, '');
            onToken?.(token, displayText);
        }
    } else if (response?.message) {
        const msg = response.message;
        accumulated = typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
                ? msg.content.map(p => p.text ?? '').join('')
                : '';
        const displayText = accumulated.replace(/<<<EXPLANATION>>>[\s\S]*$/, '');
        onToken?.(displayText, displayText);
    }

    const sepIdx = accumulated.indexOf(SEPARATOR);
    const rawCode = (sepIdx >= 0 ? accumulated.slice(0, sepIdx) : accumulated).trim()
        .replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '');
    const explanation = (sepIdx >= 0 ? accumulated.slice(sepIdx + SEPARATOR.length) : '').trim();

    console.log("[JCompiler AI] Reverse engineering finished. Reconstructed code length:", rawCode.length, "Explanation length:", explanation.length);
    return { code: rawCode, explanation, reasoning: explanation };
};

// ─── Two-phase JCompiler pipeline (legacy exports kept for compatibility) ──────

/**
 * Phase 1 — Stream plain-text terminal output live (NO JSON wrapping).
 * Tokens are delivered one-by-one to options.onToken so the UI can render them
 * as they arrive without garbled partial-JSON artifacts.
 */
export const streamCodeOutput = async (code, language, history = [], options = {}) => {
    const { onToken, onProgress } = options;
    const langLabel = language === 'auto' ? 'the appropriate language' : language;

    const historyCtx = history.length > 0
        ? '\nContext from previous runs:\n' +
          history.slice(-3).map((h, i) =>
              `[Run ${i + 1}] Output: ${String(h.result?.output || '').slice(0, 80)}`
          ).join('\n')
        : '';

    const systemPrompt =
`You are J-Compiler's virtual ${langLabel} runtime.
Your job is to emulate the real compiler/interpreter output so precisely that a student cannot distinguish it from a normal online compiler.

Internal process:
1. Detect the real language and runtime style from the source.
2. Compile/syntax-check line by line before execution.
3. If compilation fails, stop at the first real blocking error and print a compiler-like diagnostic with line/column when the language normally does so.
4. If compilation succeeds, execute the program mentally and preserve exact stdout/stderr order, spacing, casing, tables, prompts, and newlines.

Output contract:
- Return terminal text only. No JSON, no markdown fences, no headings, no explanation.
- Do not add commentary such as "The output is" or "No output" unless the program itself prints it.
- If the program produces no output and exits successfully, return an empty string.
- For runtime exceptions, print the language-appropriate traceback/error text.
- For stdin/input()/scanf/readline, choose deterministic classroom-safe placeholder values and echo input only when that runtime/program would echo it.
- For SQL, render result sets as compact ASCII tables and errors as database-style diagnostics.
- For Arduino/embedded code, render serial and hardware effects as deterministic virtual logs such as [PIN 13] -> HIGH and Serial: value.
- For huge output, print the first 20 lines and last 5 lines with one exact omission marker: ... [N lines omitted] ...${historyCtx}`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Language: ${langLabel}\n\`\`\`${language !== 'auto' ? language : ''}\n${code}\n\`\`\`` },
    ];

    return getAICompletion(messages, {
        model:          PUTER_JCOMPILER_MODEL,
        temperature:    0,
        max_tokens:     2048,
        actionType:     'compiler',
        includeMetadata: true,
        onToken,
        onProgress,
    });
};

/**
 * Phase 2 — Lightweight JSON analysis from code + its captured output.
 * Called AFTER streaming completes; not streamed.
 * Returns { status, errorExplanation, fixedCode, mermaidGraph, reasoning }
 */
export const analyzeCodeResult = async (code, language, capturedOutput, options = {}) => {
    const { onProgress } = options;
    const systemPrompt =
`Role: J-Compiler Static Analyzer.
Analyse the source and terminal output for a student after execution has completed.
Respond with ONE valid JSON object only. No markdown fences, no prose outside JSON.

Schema:
{
  "status":           "success" | "error",
  "detectedLanguage": "<detected language/runtime>",
  "verdict":          "<one short sentence on compile/run result>",
  "reasoning":        "<concise explanation of how the output is produced>",
  "lineChecks": [
    { "line": 1, "code": "<source line>", "severity": "ok" | "warning" | "error", "finding": "<line-level behavior or issue>" }
  ],
  "errorExplanation": "<root cause if status is error, else empty string>",
  "fixedCode":        "<complete corrected source code if there is an error, else empty string>",
  "fixReport":        "<what changed and why if fixedCode is present, else empty string>",
  "mermaidGraph":     "<valid Mermaid graph TD diagram>"
}

Rules:
- Include meaningful lineChecks for every important line; for long files, cover declarations, branches, loops, I/O, and failing lines.
- If there is an error, fixedCode must be a complete runnable corrected program, not a patch fragment.
- fixReport must explain why the error occurred and how the fix resolves it.
- mermaidGraph must show control/data flow for the code, even when execution failed. Use graph TD. Quote every label: A["label"]. Node IDs must be simple alphanumeric IDs with no colons, spaces, parentheses, or punctuation.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content:
`Language: ${language}
Code:
\`\`\`
${code}
\`\`\`
Terminal Output:
${capturedOutput || '(empty — no output produced)'}` },
    ];

    try {
        const resultWithMeta = await getAICompletion(messages, {
            jsonMode:        true,
            model:           PUTER_JCOMPILER_MODEL,
            temperature:     0.1,
            max_tokens:      4096,
            actionType:      'compiler',
            includeMetadata: true,
            onProgress,
        });
        const parsed = cleanAndParseJSON(resultWithMeta.content);
        return { ...parsed, _meta: { provider: resultWithMeta.provider, model: resultWithMeta.model } };
    } catch (err) {
        console.warn('[analyzeCodeResult] Failed:', err?.message);
        return { status: 'unknown', errorExplanation: '', fixedCode: '', mermaidGraph: '', reasoning: '' };
    }
};
