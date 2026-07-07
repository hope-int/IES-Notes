/**
 * puterAccountPool.js — Multi-account Puter token rotation
 *
 * When Puter rate-limits (429) an account, the pool rotates to the next
 * stored auth token, giving each account its own independent quota.
 *
 * Token storage: localStorage key 'hope_puter_token_pool'
 * Format: JSON array of { label: string, token: string, cooldownUntil: number }
 *
 * ⚠️  setAuthToken() causes WebSocket reconnect churn (harmless console noise).
 *     We only call it on an actual 429 rotation, not at startup or every request.
 */

const POOL_KEY = 'hope_puter_token_pool';
const RATE_LIMIT_COOLDOWN_MS = 3 * 60 * 1000; // 3 min per account

// ─── Persistence ──────────────────────────────────────────────────────────────

export const loadPool = () => {
    try {
        const raw = localStorage.getItem(POOL_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const savePool = (pool) => {
    try {
        localStorage.setItem(POOL_KEY, JSON.stringify(pool));
    } catch { /* storage unavailable */ }
};

/**
 * Add or update a token entry. Label is used only for display.
 * @param {string} token  Puter auth token (from puter.com account settings)
 * @param {string} [label]  Human-readable label e.g. "Account 2"
 */
export const addPoolToken = (token, label) => {
    if (!token?.trim()) return;
    const pool = loadPool();
    const existing = pool.findIndex(p => p.token === token.trim());
    if (existing !== -1) {
        pool[existing].label = label || pool[existing].label;
    } else {
        pool.push({
            label: label || `Account ${pool.length + 1}`,
            token: token.trim(),
            cooldownUntil: 0,
        });
    }
    savePool(pool);
};

/**
 * Remove a token from the pool by its token value.
 */
export const removePoolToken = (token) => {
    const pool = loadPool().filter(p => p.token !== token);
    savePool(pool);
};

// ─── Rotation Logic ───────────────────────────────────────────────────────────

/**
 * Track which pool index is active so we don't re-apply the same token.
 * -1 = using the SDK's default/built-in token (no pool active).
 */
let _activeIndex = -1;

/**
 * Returns pool entries that are not currently cooling down.
 */
const getAvailableAccounts = () => {
    const pool = loadPool();
    const now = Date.now();
    return pool
        .map((entry, index) => ({ ...entry, index }))
        .filter(entry => now >= entry.cooldownUntil);
};

/**
 * Called when the current active account gets a 429.
 * Marks it as cooling down and rotates to the next available account.
 *
 * @returns {boolean}  true if rotated to a new account, false if pool exhausted
 */
export const rotateOnRateLimit = () => {
    const pool = loadPool();
    if (pool.length === 0) return false;

    // Cool down the current account
    if (_activeIndex >= 0 && _activeIndex < pool.length) {
        pool[_activeIndex].cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        savePool(pool);
    }

    const available = getAvailableAccounts();
    if (available.length === 0) {
        console.warn('[PuterPool] All accounts are cooling down. No rotation possible.');
        return false;
    }

    // Pick the next account after the current one (round-robin)
    const nextEntry = available.find(e => e.index > _activeIndex) || available[0];
    _activeIndex = nextEntry.index;

    try {
        if (window.puter?.setAuthToken) {
            window.puter.setAuthToken(nextEntry.token);
            console.info(`[PuterPool] Rotated to "${nextEntry.label}" (index ${_activeIndex}).`);
        }
    } catch (e) {
        console.warn('[PuterPool] setAuthToken failed:', e.message);
    }

    return true;
};

/**
 * Activate the pool (apply the first available token) when the app starts.
 * Call this after Puter SDK is ready.
 * No-op by design: applying a token eagerly calls setAuthToken(), which causes
 * the Puter SDK to rebuild its Socket.IO transport and print websocket warnings.
 * The first real token application happens in rotateOnRateLimit().
 */
export const activatePool = () => {
    const available = getAvailableAccounts();
    if (available.length === 0) return;
    console.info(`[PuterPool] ${available.length} account(s) ready for rate-limit rotation.`);
};

/**
 * Returns the current pool for display in settings UI.
 * Tokens are masked for security.
 */
export const getPoolStatus = () => {
    const pool = loadPool();
    const now = Date.now();
    return pool.map((entry, index) => ({
        label: entry.label,
        tokenPreview: entry.token.slice(0, 6) + '••••••' + entry.token.slice(-4),
        token: entry.token, // full token for removal
        isActive: index === _activeIndex,
        isCoolingDown: now < entry.cooldownUntil,
        cooldownSecsLeft: Math.max(0, Math.ceil((entry.cooldownUntil - now) / 1000)),
    }));
};

/**
 * Clears all cooldowns (useful for manual reset after a long wait).
 */
export const resetAllCooldowns = () => {
    const pool = loadPool().map(p => ({ ...p, cooldownUntil: 0 }));
    savePool(pool);
    console.info('[PuterPool] All account cooldowns cleared.');
};
