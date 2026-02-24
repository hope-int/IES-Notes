
import { createClient } from '@supabase/supabase-js';

// These environment variables will need to be set in a .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Mutex to avoid overwhelming Puter's WASM memory with concurrent proxy requests
let isProxying = false;
const proxyQueue = [];

const processQueue = async () => {
    if (isProxying || proxyQueue.length === 0) return;
    isProxying = true;
    const { task, resolve, reject } = proxyQueue.shift();
    try {
        // Give Puter a tiny moment to stabilize between calls
        await new Promise(r => setTimeout(r, 150));
        const res = await task();
        resolve(res);
    } catch (err) {
        reject(err);
    } finally {
        isProxying = false;
        setTimeout(processQueue, 250); // Increased gap to 250ms to prevent WASM/WebSocket congestion
    }
};

const resilientFetch = async (url, options) => {
    const fetchWithTimeout = (targetFetch, timeoutMs) => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
            targetFetch(url, options).then(
                res => { clearTimeout(timer); resolve(res); },
                err => { clearTimeout(timer); reject(err); }
            );
        });
    };

    try {
        // Step 1: Try standard fetch for 3s
        return await fetchWithTimeout(fetch, 3000);
    } catch (err) {
        // Step 2: Fallback to Puter.js Proxy (Queued to avoid WASM crashes)
        if (window.puter?.net?.fetch) {
            return new Promise((resolve, reject) => {
                proxyQueue.push({
                    task: async () => {
                        try {
                            console.warn(`[Proxy] Routing: ${url.split('/').pop().split('?')[0]}`);
                            const proxyStart = Date.now();
                            const res = await window.puter.net.fetch(url, options);

                            if (!res) throw new Error("Proxy returned empty response");

                            console.log(`[Proxy] Success: ${Date.now() - proxyStart}ms`);
                            return res;
                        } catch (puterErr) {
                            console.error("[Proxy] Critical Failure:", puterErr);
                            // If proxy fails, try one last direct fetch without short timeout
                            return fetch(url, options);
                        }
                    },
                    resolve,
                    reject
                });
                processQueue();
            });
        }
        throw err;
    }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'hope-edu-auth',
    },
    global: {
        fetch: resilientFetch
    }
});
