/**
 * puterInit.js — Centralized, idempotent Puter.js readiness guard
 *
 * ─── CRITICAL DESIGN NOTE ────────────────────────────────────────────────────
 * `window.puter.setAPIOrigin()` internally calls `updateSubmodules()`, which
 * re-initializes every SDK sub-module including the Socket.IO transport. That
 * causes the "WebSocket closed before the connection is established" burst in
 * the console. Even calling it ONCE at startup is unnecessary churn because the
 * Puter CDN SDK already defaults to https://api.puter.com — we never need to
 * override it. DO NOT call setAPIOrigin() anywhere in this codebase.
 *
 * Same applies to `setAuthToken()` — calling it from app code re-triggers
 * updateSubmodules(). Let the SDK manage its own auth token lifecycle.
 * The ONLY exception is the multi-account pool (puterAccountPool.js) which
 * calls setAuthToken() intentionally on 429 rotation.
 *
 * This module's ONLY job:
 *   - Wait for window.puter (CDN async load) before callers try to use it
 *   - Expose a shared, idempotent readiness promise (one poll loop, not N)
 *   - Provide an authoritative auth state reader
 *   - Activate the account pool once SDK is ready
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { activatePool } from './puterAccountPool';

const PUTER_POLL_INTERVAL_MS = 200;
const PUTER_READY_TIMEOUT_MS = 10_000;

/** @type {Promise<void> | null} Shared in-flight readiness promise. */
let _readyPromise = null;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Polls for `window.puter` to appear (CDN script async load).
 * Resolves as soon as the global is present, rejects after timeout.
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
const waitForPuterGlobal = (timeoutMs = PUTER_READY_TIMEOUT_MS) =>
    new Promise((resolve, reject) => {
        if (window.puter) {
            window.puter.quiet = true;
            activatePool();
            resolve();
            return;
        }
        const deadline = Date.now() + timeoutMs;
        const id = setInterval(() => {
            if (window.puter) {
                clearInterval(id);
                window.puter.quiet = true;
                activatePool();
                resolve();
            }
            else if (Date.now() > deadline) {
                clearInterval(id);
                reject(new Error('Puter.js CDN did not load within timeout'));
            }
        }, PUTER_POLL_INTERVAL_MS);
    });

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Waits for the Puter SDK global to be available. Returns a shared promise —
 * multiple concurrent callers all await the same resolution, poll loop runs
 * exactly once.
 *
 * ⚠️  Does NOT mutate the SDK (no setAPIOrigin, no setAuthToken).
 *     The SDK's defaults are correct. Mutations cause WebSocket churn.
 *
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<void>}
 */
export const ensurePuterReady = (opts = {}) => {
    if (window.puter) {
        window.puter.quiet = true;
        return Promise.resolve();
    }
    if (_readyPromise) return _readyPromise;
    _readyPromise = waitForPuterGlobal(opts.timeoutMs ?? PUTER_READY_TIMEOUT_MS)
        .catch((error) => {
            _readyPromise = null;
            throw error;
        });
    return _readyPromise;
};

/**
 * No-op kept for call-site compatibility.
 * Previously called setAPIOrigin() which caused WebSocket churn — removed.
 * @deprecated Use ensurePuterReady() instead.
 */
export const initializePuterOnce = () => {
    // Intentional no-op. See module header for why setAPIOrigin was removed.
};

/**
 * Returns the authoritative Puter auth state based on the SDK.
 * Uses localStorage guest flag ONLY as an optimistic hint while SDK loads.
 *
 * @returns {{ isSignedIn: boolean, isGuest: boolean }}
 */
export const getPuterAuthState = () => {
    const isGuestConfirmed = localStorage.getItem('hope_puter_guest_confirmed') === 'true';

    if (!window.puter?.auth) {
        // SDK not yet loaded — trust guest flag to avoid UI flicker
        return { isSignedIn: !isGuestConfirmed, isGuest: isGuestConfirmed };
    }

    // SDK present: SDK is the truth source
    const sdkSignedIn = Boolean(window.puter.auth.isSignedIn());
    if (sdkSignedIn) {
        if (isGuestConfirmed) {
            localStorage.setItem('hope_puter_guest_confirmed', 'false');
        }
        return { isSignedIn: true, isGuest: false };
    } else {
        return { isSignedIn: false, isGuest: isGuestConfirmed };
    }
};

/**
 * Wraps any Puter SDK call with a safe fallback.
 * WebSocket/network errors are silenced; other errors are forwarded.
 *
 * @template T
 * @param {() => Promise<T>} fn       Async function performing the SDK call
 * @param {T}               fallback  Value to return on any error
 * @returns {Promise<T>}
 */
export const safePuterCall = async (fn, fallback = null) => {
    try {
        return await fn();
    } catch (err) {
        const msg = err?.message?.toLowerCase() ?? '';
        const isTransport =
            msg.includes('websocket') ||
            msg.includes('socket') ||
            msg.includes('failed to fetch') ||
            msg.includes('networkerror') ||
            msg.includes('closed before') ||
            msg.includes('unknown url');
        if (!isTransport) console.warn('[Puter] SDK call failed:', err?.message);
        return fallback;
    }
};
