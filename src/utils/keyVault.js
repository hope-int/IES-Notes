/**
 * HOPE Studio — AI Key Vault
 * AES-256-GCM encryption for user API keys.
 * Keys are encrypted client-side before leaving the browser.
 * Storage: localStorage (instant) + Supabase (cross-device sync).
 */

import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const TABLE = 'user_ai_settings';
const LOCAL_CACHE_KEY = 'hope_vault_cache';
const LOCAL_OWNER_KEY = 'hope_vault_owner_id';

// ─── AES-256-GCM Encryption ──────────────────────────────────────────────────

const deriveKey = async (secret, salt) => {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(secret), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

const encryptData = async (data, secret, salt) => {
    const key = await deriveKey(secret, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(JSON.stringify(data))
    );
    return {
        encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        iv: btoa(String.fromCharCode(...iv))
    };
};

const decryptData = async (encryptedB64, ivB64, secret, salt) => {
    try {
        const key = await deriveKey(secret, salt);
        const encrypted = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
        const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
        return JSON.parse(new TextDecoder().decode(dec));
    } catch {
        return null; // wrong key / corrupted
    }
};

// ─── Identity ─────────────────────────────────────────────────────────────────

export const getOwnerId = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) return { ownerId: user.id, isAuth: true };
    } catch { /* not logged in */ }

    let sessionId = localStorage.getItem('anon_session_id');
    if (!sessionId) {
        sessionId = uuidv4();
        localStorage.setItem('anon_session_id', sessionId);
    }
    return { ownerId: sessionId, isAuth: false };
};

const getSecret = (ownerId, useLegacy = false) => {
    const pepper = useLegacy
        ? (import.meta.env.VITE_LEGACY_ENC_PEPPER || 'hope-studio-default-pepper-v1')
        : (import.meta.env.VITE_ENC_PEPPER || 'hope-studio-default-pepper-v1');
    return `${pepper}::${ownerId}`;
};

// ─── Model Catalogs (per provider) ───────────────────────────────────────────

export const PROVIDER_MODELS = {
    puter: [
        { value: null,                                                 label: 'App Default',           badge: 'default' },
        { value: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', label: 'Nemotron 3 Omni',       badge: 'free' },
        { value: 'liquid-ai/lfm2.5-1.2b-thinking:free',                label: 'LFM 2.5 Thinking',      badge: 'free' },
        { value: 'cohere/north-mini-code:free',                        label: 'North Mini Code',       badge: 'free' },
        { value: 'baidu/qianfan-cobuddy:free',                         label: 'Qianfan CoBuddy',       badge: 'free' },
        { value: 'z-ai/glm-4.6v-flash:free',                           label: 'GLM 4.6V Flash',        badge: 'free' },
        { value: 'z-ai/glm-4.5-flash:free',                            label: 'GLM 4.5 Flash',         badge: 'free' },
        { value: 'google/gemma-3n-2b:free',                            label: 'Gemma 3n 2B',           badge: 'free' },
    ],
    openrouter: [
        { value: null,                                                 label: 'App Default',           badge: 'default' },
        { value: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', label: 'Nemotron 3 Omni',       badge: 'free' },
        { value: 'liquid-ai/lfm2.5-1.2b-thinking:free',                label: 'LFM 2.5 Thinking',      badge: 'free' },
        { value: 'cohere/north-mini-code:free',                        label: 'North Mini Code',       badge: 'free' },
        { value: 'baidu/qianfan-cobuddy:free',                         label: 'Qianfan CoBuddy',       badge: 'free' },
        { value: 'z-ai/glm-4.6v-flash:free',                           label: 'GLM 4.6V Flash',        badge: 'free' },
        { value: 'z-ai/glm-4.5-flash:free',                            label: 'GLM 4.5 Flash',         badge: 'free' },
        { value: 'google/gemma-3n-2b:free',                            label: 'Gemma 3n 2B',           badge: 'free' },
        { value: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free', label: 'Dolphin Mistral', badge: 'free' },
        { value: 'openai/gpt-4o',                             label: 'GPT-4o',                  badge: 'paid' },
        { value: 'openai/gpt-4o-mini',                        label: 'GPT-4o Mini',             badge: 'paid' },
        { value: 'anthropic/claude-3-5-sonnet',               label: 'Claude 3.5 Sonnet',       badge: 'paid' },
        { value: 'anthropic/claude-3-haiku',                  label: 'Claude 3 Haiku',          badge: 'paid' },
        { value: 'google/gemini-pro-1.5',                     label: 'Gemini Pro 1.5',          badge: 'paid' },
        { value: 'x-ai/grok-4',                               label: 'Grok 4',                  badge: 'paid' },
        { value: 'mistralai/mistral-large',                   label: 'Mistral Large',           badge: 'paid' },
    ],
    groq: [
        { value: null,                           label: 'App Default',            badge: 'default' },
        { value: 'llama-3.3-70b-versatile',      label: 'Llama 3.3 70B',         badge: 'free' },
        { value: 'llama-3.1-70b-versatile',      label: 'Llama 3.1 70B',         badge: 'free' },
        { value: 'llama-3.1-8b-instant',         label: 'Llama 3.1 8B (Fast)',   badge: 'free' },
        { value: 'llama3-70b-8192',              label: 'Llama 3 70B',           badge: 'free' },
        { value: 'mixtral-8x7b-32768',           label: 'Mixtral 8x7B',          badge: 'free' },
        { value: 'gemma2-9b-it',                 label: 'Gemma 2 9B',            badge: 'free' },
        { value: 'llama-3.2-90b-vision-preview', label: 'Llama 3.2 90B Vision',  badge: 'free' },
    ],
    gemini: [
        { value: null,                           label: 'App Default',            badge: 'default' },
        { value: 'gemini-2.0-flash',             label: 'Gemini 2.0 Flash',      badge: 'free' },
        { value: 'gemini-1.5-flash',             label: 'Gemini 1.5 Flash',      badge: 'free' },
        { value: 'gemini-1.5-flash-8b',          label: 'Gemini 1.5 Flash 8B',   badge: 'free' },
        { value: 'gemini-1.5-pro',               label: 'Gemini 1.5 Pro',        badge: 'paid' },
        { value: 'gemini-2.5-pro-preview-03-25', label: 'Gemini 2.5 Pro',        badge: 'paid' },
    ]
};

// ─── Default Provider Chain ───────────────────────────────────────────────────

export const DEFAULT_SETTINGS = {
    providers: [
        {
            id: 'puter', name: 'Puter Cloud', icon: '☁️', color: '#6366f1',
            enabled: true, order: 0, key: null, selectedModel: null,
            keyRequired: false, description: 'Free AI — no key needed',
            helpUrl: 'https://puter.com'
        },
        {
            id: 'openrouter', name: 'OpenRouter', icon: '🔀', color: '#f59e0b',
            enabled: true, order: 1, key: null, selectedModel: null,
            keyRequired: true, description: 'Access 100+ AI models with one key',
            helpUrl: 'https://openrouter.ai/keys'
        },
        {
            id: 'groq', name: 'Groq', icon: '⚡', color: '#10b981',
            enabled: true, order: 2, key: null, selectedModel: null,
            keyRequired: true, description: 'Ultra-fast inference — generous free tier',
            helpUrl: 'https://console.groq.com/keys'
        },
        {
            id: 'gemini', name: 'Google Gemini', icon: '✨', color: '#4285f4',
            enabled: false, order: 3, key: null, selectedModel: null,
            keyRequired: true, description: 'Gemini 2.0 Flash — free from Google AI Studio',
            helpUrl: 'https://aistudio.google.com/app/apikey'
        }
    ],
};


// ─── Merge Helpers ────────────────────────────────────────────────────────────

const mergeWithDefaults = (saved) => {
    const merged = DEFAULT_SETTINGS.providers.map(def => {
        const saved_p = (saved.providers || []).find(p => p.id === def.id);
        return saved_p ? { ...def, ...saved_p } : { ...def };
    });
    return {
        ...DEFAULT_SETTINGS,
        ...saved,
        providers: merged.sort((a, b) => a.order - b.order)
    };
};

// ─── Save ─────────────────────────────────────────────────────────────────────

export const saveVaultSettings = async (settings) => {
    const { ownerId, isAuth } = await getOwnerId();
    const secret = getSecret(ownerId);

    const { encrypted, iv } = await encryptData(settings, secret, ownerId);

    // Supabase sync
    try {
        await supabase.from(TABLE).upsert(
            {
                owner_id: ownerId,
                is_authenticated: isAuth,
                encrypted_blob: encrypted,
                iv,
                updated_at: new Date().toISOString()
            },
            { onConflict: 'owner_id' }
        );
    } catch (e) {
        console.warn('[KeyVault] Supabase sync failed, localStorage-only:', e.message);
    }

    // Always write localStorage cache
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ encrypted, iv, ownerId }));
    localStorage.setItem(LOCAL_OWNER_KEY, ownerId);

    // Update in-memory cache
    _cachedSettings = mergeWithDefaults(settings);
    return _cachedSettings;
};

// ─── Load ─────────────────────────────────────────────────────────────────────

export const loadVaultSettings = async () => {
    const { ownerId } = await getOwnerId();
    const secret = getSecret(ownerId, false);
    const legacySecret = getSecret(ownerId, true);

    // 1. localStorage (instant, no network)
    try {
        const raw = localStorage.getItem(LOCAL_CACHE_KEY);
        if (raw) {
            const { encrypted, iv, ownerId: cachedOwner } = JSON.parse(raw);
            if (cachedOwner === ownerId) {
                let data = await decryptData(encrypted, iv, secret, ownerId);
                if (!data && secret !== legacySecret) {
                    data = await decryptData(encrypted, iv, legacySecret, ownerId);
                    if (data) {
                        // Re-encrypt with new pepper asynchronously
                        saveVaultSettings(data).catch(err => console.error("Pepper rotation sync failed:", err));
                    }
                }
                if (data) return mergeWithDefaults(data);
            }
        }
    } catch { /* corrupted cache */ }

    // 2. Supabase fallback (cross-device / post-clear)
    try {
        const { data } = await supabase
            .from(TABLE)
            .select('encrypted_blob, iv')
            .eq('owner_id', ownerId)
            .maybeSingle();

        if (data?.encrypted_blob) {
            let settings = await decryptData(data.encrypted_blob, data.iv, secret, ownerId);
            if (!settings && secret !== legacySecret) {
                settings = await decryptData(data.encrypted_blob, data.iv, legacySecret, ownerId);
                if (settings) {
                    // Re-encrypt with new pepper and update cache
                    saveVaultSettings(settings).catch(err => console.error("Pepper rotation sync failed:", err));
                }
            }
            if (settings) {
                // Re-hydrate localStorage
                localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({
                    encrypted: data.encrypted_blob, iv: data.iv, ownerId
                }));
                return mergeWithDefaults(settings);
            }
        }
    } catch { /* network/DB error */ }

    // 3. Defaults (first time user)
    return { ...DEFAULT_SETTINGS };
};

// ─── In-Memory Cache (used by aiService) ─────────────────────────────────────

let _cachedSettings = null;
let _initPromise = null;

export const initVault = async () => {
    if (_initPromise) return _initPromise;
    _initPromise = loadVaultSettings().then(s => {
        _cachedSettings = s;
        return s;
    });
    return _initPromise;
};

export const getVaultSettings = () => _cachedSettings ?? { ...DEFAULT_SETTINGS };

export const refreshVault = async () => {
    _initPromise = null;
    return initVault();
};

// ─── Get active user keys for injection into API calls ───────────────────────

export const getUserKey = (providerId) => {
    const settings = getVaultSettings();
    const provider = settings.providers.find(p => p.id === providerId);
    return provider?.key && provider.key.trim() ? provider.key.trim() : null;
};

// Returns user's chosen model for a provider, or null (= use app default)
export const getUserModel = (providerId) => {
    const settings = getVaultSettings();
    const provider = settings.providers.find(p => p.id === providerId);
    return provider?.selectedModel || null;
};

export const isProviderEnabled = (providerId) => {
    const settings = getVaultSettings();
    const provider = settings.providers.find(p => p.id === providerId);
    return provider?.enabled !== false;
};

export const getOrderedProviders = () => {
    const settings = getVaultSettings();
    return [...settings.providers]
        .filter(p => p.enabled)
        .sort((a, b) => a.order - b.order);
};

// ─── Key Sanitizer ──────────────────────────────────────────────────────────
// HTTP headers only allow ISO-8859-1 characters. Strip any BOM / zero-width
// spaces / emoji that could sneak in from copy-paste or AES decryption.
export const sanitizeKey = (key) =>
    (key || '').replace(/[^\x20-\x7E]/g, '').trim();

// ─── Key Tester ───────────────────────────────────────────────────────────────
// Uses dedicated auth/info endpoints — no model calls, no cost, no 402/404.

export const testApiKey = async (provider, rawKey) => {
    const key = sanitizeKey(rawKey);
    if (!key) return false;
    try {
        if (provider === 'openrouter') {
            // OpenRouter's dedicated key-info endpoint.
            // Returns 200 + key metadata when valid, 401 when invalid/revoked.
            // No model calls → no 402 Payment Required, no 404 model-not-found.
            const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${key}` }
            });
            return res.ok; // 200 = valid key
        }
        if (provider === 'groq') {
            const res = await fetch('https://api.groq.com/openai/v1/models', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${key}` }
            });
            return res.ok;
        }
        if (provider === 'gemini') {
            // Google's OpenAI-compatible models list — lightweight, no tokens consumed.
            // Returns 200 + model list for valid keys, 400/401 for invalid.
            const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/models', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${key}` }
            });
            return res.ok;
        }
    } catch { return false; }
    return false;
};
