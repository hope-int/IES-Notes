/**
 * jsExecutor.js — Browser-sandboxed JavaScript runtime for J-Compiler
 *
 * Supports:
 *  - console.log / .error / .warn / .info / .table / .dir / .assert
 *  - prompt(msg)  / input(msg)  — async user input (pauses execution)
 *  - confirm(msg)               — async y/n input
 *  - alert(msg)                 — inline notification
 *  - print(...args)             — Python-style alias for console.log
 *  - process.stdout/stderr/exit, setTimeout/setInterval (capped at 10 s)
 *  - fetch (simulated stub)
 *  - Top-level await support
 *  - AbortSignal for cancellation
 */

// ─── Sentinels ──────────────────────────────────────────────────────────────

export class ExitSignal {
    constructor(code = 0) { this.code = code; }
}

export class AbortedError extends Error {
    constructor() { super('Execution aborted'); }
}

// ─── Value formatting ────────────────────────────────────────────────────────

const formatVal = (v) => {
    if (v === null)      return 'null';
    if (v === undefined) return 'undefined';
    if (v instanceof Error) return v.toString();
    if (typeof v === 'object') {
        try   { return JSON.stringify(v, null, 2); }
        catch { return Object.prototype.toString.call(v); }
    }
    return String(v);
};

const tableToString = (data) => {
    const entries = Array.isArray(data)
        ? data
        : Object.entries(data || {}).map(([k, v]) => ({ key: k, value: v }));
    if (!entries.length) return '(empty)';
    const keys = [...new Set(entries.flatMap(r =>
        (r && typeof r === 'object') ? Object.keys(r) : ['value']
    ))];
    const widths = keys.map(k =>
        Math.max(k.length, ...entries.map(r => String((r?.[k]) ?? '').length))
    );
    const divider = widths.map(w => '─'.repeat(w + 2)).join('┼');
    const header  = keys.map((k, i) => ` ${k.padEnd(widths[i])} `).join('│');
    const rows    = entries.map(r =>
        keys.map((k, i) => ` ${String(r?.[k] ?? '').padEnd(widths[i])} `).join('│')
    );
    return [
        '┌' + divider.replace(/┼/g, '┬') + '┐',
        '│' + header + '│',
        '├' + divider + '┤',
        ...rows.map(r => '│' + r + '│'),
        '└' + divider.replace(/┼/g, '┴') + '┘',
    ].join('\n');
};

// ─── Main executor ───────────────────────────────────────────────────────────

/**
 * @param {string}   code           — JavaScript source
 * @param {Function} onOutput       — (text: string, type: 'stdout'|'stderr'|'warn'|'info'|'debug'|'clear') => void
 * @param {Function} onInputRequest — (prompt: string, resolve: (val: string) => void) => void
 * @param {AbortSignal} [signal]    — cancellation signal
 * @returns {Promise<{ exitCode: number, duration: number }>}
 */
export const executeJS = async (code, onOutput, onInputRequest, signal) => {
    const t0 = performance.now();

    const emit = (text, type = 'stdout') => {
        if (signal?.aborted) return;
        onOutput(String(text), type);
    };

    const requestInput = (promptText) =>
        new Promise((resolve) => {
            if (signal?.aborted) { resolve(''); return; }
            let settled = false;
            const finish = (val) => {
                if (settled) return;
                settled = true;
                signal?.removeEventListener?.('abort', onAbort);
                resolve(String(val ?? ''));
            };
            const onAbort = () => finish('');
            signal?.addEventListener?.('abort', onAbort, { once: true });
            onInputRequest(String(promptText ?? ''), finish);
        });

    // ── Sandbox globals ──────────────────────────────────────────────────────
    const sandbox = {
        // Console API
        console: {
            log:    (...a) => emit(a.map(formatVal).join(' '), 'stdout'),
            error:  (...a) => emit(a.map(formatVal).join(' '), 'stderr'),
            warn:   (...a) => emit(a.map(formatVal).join(' '), 'warn'),
            info:   (...a) => emit(a.map(formatVal).join(' '), 'info'),
            debug:  (...a) => emit(a.map(formatVal).join(' '), 'debug'),
            table:  (d)   => emit(tableToString(d), 'stdout'),
            dir:    (d)   => emit(JSON.stringify(d, null, 2), 'stdout'),
            assert: (ok, ...a) => { if (!ok) emit('Assertion failed: ' + a.join(' '), 'stderr'); },
            clear:  ()    => emit('\x1bc', 'clear'),
            time:   () => {}, timeEnd: () => {},
            group:  () => {}, groupEnd: () => {}, groupCollapsed: () => {},
            count:  () => {}, countReset: () => {}, trace: () => {},
        },

        // Interactive I/O
        prompt:   (msg = '') => requestInput(msg),
        input:    (msg = '') => requestInput(msg),         // Python-style
        readline: ()         => requestInput(''),
        alert:    (msg = '') => { emit(`[ALERT] ${msg}`, 'info'); },
        confirm:  (msg = '') => requestInput(`${msg} (y/n)`)
            .then(v => ['y', 'yes', '1', 'true'].includes(v.trim().toLowerCase())),

        // Python-style print / write
        print: (...a) => emit(a.map(formatVal).join(' '), 'stdout'),
        write: (t)    => emit(String(t), 'stdout'),

        // Timers (capped)
        setTimeout:  (fn, ms = 0, ...a) =>
            setTimeout(fn, Math.min(Math.max(Number(ms) || 0, 0), 10_000), ...a),
        setInterval: (fn, ms = 0, ...a) =>
            setInterval(fn, Math.min(Math.max(Number(ms) || 100, 100), 10_000), ...a),
        clearTimeout, clearInterval,

        // Safe builtins
        Math, JSON, Date,
        parseInt, parseFloat, isNaN, isFinite,
        Number, String, Boolean, Array, Object, Map, Set,
        WeakMap, WeakSet,
        WeakRef: globalThis.WeakRef,
        Promise, Symbol, BigInt,
        Error, TypeError, RangeError, SyntaxError, ReferenceError, URIError, EvalError,
        decodeURIComponent, encodeURIComponent, decodeURI, encodeURI,
        atob, btoa,
        structuredClone,
        Infinity, NaN, undefined,

        // Node.js process shim
        process: {
            stdout:   { write: (s) => emit(String(s), 'stdout') },
            stderr:   { write: (s) => emit(String(s), 'stderr') },
            exit:     (code = 0) => { throw new ExitSignal(Number(code) || 0); },
            env:      { NODE_ENV: 'production' },
            argv:     ['node', 'script.js'],
            version:  'v20.0.0',
            platform: 'linux',
            arch:     'x64',
            pid:      Math.floor(Math.random() * 9000) + 1000,
            hrtime:   () => [0, Math.floor(performance.now() * 1e6)],
            memoryUsage: () => ({ rss: 0, heapTotal: 0, heapUsed: 0 }),
        },

        // Buffer shim
        Buffer: {
            from:     (d) => ({
                toString: () => typeof d === 'string' ? d : JSON.stringify(d),
                length: typeof d === 'string' ? d.length : 0,
            }),
            alloc:    (n) => ({ toString: () => '\0'.repeat(n), length: n }),
            isBuffer: () => false,
            concat:   (bufs) => ({ toString: () => bufs.map(b => b.toString?.() ?? '').join('') }),
        },

        // fetch stub (educational)
        fetch: async (url, opts = {}) => {
            const method = (opts.method || 'GET').toUpperCase();
            emit(`[NET] ${method} ${url}`, 'info');
            const body = '{"simulated":true,"message":"This is a simulated fetch response."}';
            return {
                ok: true, status: 200, statusText: 'OK',
                headers: { get: () => 'application/json' },
                json: async () => JSON.parse(body),
                text: async () => body,
                arrayBuffer: async () => new ArrayBuffer(0),
            };
        },

        // XMLHttpRequest stub
        XMLHttpRequest: class {
            open() {} setRequestHeader() {} send() {}
            addEventListener(e, cb) { if (e === 'load') setTimeout(cb, 0); }
        },

        // Globalthis shim (empty — prevents breakout)
        globalThis: {},
        global: {},
        window: undefined,
        document: undefined,
        navigator: undefined,
        localStorage: undefined,
        sessionStorage: undefined,

        // eval blocked
        eval: () => { throw new Error('eval() is disabled in the sandbox'); },
        Function: undefined,
    };

    // Top-level await via async IIFE
    const wrapped = `(async function __hopeRuntime__() {\n"use strict";\n${code}\n})()`;

    try {
        const keys = Object.keys(sandbox);
        const fn   = new Function(...keys, `return ${wrapped}`);
        await fn(...Object.values(sandbox));
        return { exitCode: 0, duration: performance.now() - t0 };
    } catch (err) {
        if (err instanceof ExitSignal) {
            return { exitCode: err.code, duration: performance.now() - t0 };
        }
        if (signal?.aborted) {
            return { exitCode: 130, duration: performance.now() - t0 };
        }

        // Format runtime error
        const name = err?.constructor?.name || 'Error';
        const msg  = err?.message || String(err);

        // Approximate line number from stack (subtract wrapper offset)
        const stackLine = err?.stack?.split('\n').find(l => l.includes('__hopeRuntime__'));
        const lineNum = stackLine
            ? (() => { const m = stackLine.match(/:(\d+):/); return m ? parseInt(m[1]) - 4 : null; })()
            : null;

        emit('', 'stderr');
        emit(`${name}: ${msg}`, 'stderr');
        if (lineNum !== null && lineNum > 0) emit(`    at line ${lineNum}`, 'stderr');

        return { exitCode: 1, duration: performance.now() - t0 };
    }
};

// ─── Language detection ──────────────────────────────────────────────────────

/**
 * Returns true if the code should be executed locally as JavaScript.
 */
export const isJavaScript = (code = '', langHint = 'auto') => {
    if (langHint === 'javascript') return true;
    if (langHint !== 'auto')       return false;

    // Patterns that definitively rule out JS
    const notJS = [
        /\bdef\s+\w+\s*[(:]/, /\belif\b/,     /\bTrue\b/,  /\bFalse\b/, /\bNone\b/, // Python
        /\bpublic\s+(class|static|void)\b/,                                            // Java
        /\bSystem\.out\.println\b/,                                                    // Java
        /^\s*#include\s*[<"]/m,                                                        // C/C++
        /\bpackage\s+main\b/, /\bfunc\s+\w+\s*\(/,                                   // Go
        /^\s*(SELECT|INSERT\s+INTO|CREATE\s+TABLE|DROP\s+TABLE)\s/im,                 // SQL
        /^\s*(MOV|PUSH|POP|JMP|CALL|RET)\s/im,                                        // Assembly
        /\b(uint8_t|uint16_t|Serial\.begin)\b/,                                       // Arduino C
        /^\s*import\s+\w+\s*$/m,                                                       // Python import (no from/braces)
    ];
    if (notJS.some(p => p.test(code))) return false;

    // Patterns that strongly indicate JS
    const isJS = [
        /\bconsole\.(log|error|warn|info)\b/,
        /\b(const|let|var)\s+\w+\s*=/,
        /=>\s*[{(]/,
        /\bfunction\s*\w*\s*\(/,
        /\bawait\s+\w/,
        /\bimport\s+.+\s+from\s+['"`]/,
        /\brequire\s*\(\s*['"`]/,
        /\bnew\s+Promise\b/,
        /\bArray\.from\b/,
        /\bObject\.(keys|values|entries)\b/,
        /\bJSON\.(parse|stringify)\b/,
    ];
    return isJS.some(p => p.test(code));
};
