/**
 * JCompiler.jsx — AI-powered virtual compiler for students
 *
 * Core principles:
 * - Single AI call per run (compile + analyze + mermaid in one Puter stream)
 * - Live token streaming — feels like a real compiler in action
 * - Puter default AI (no hardcoded models)
 * - First-time Puter credits disclaimer
 * - 3-tab output: Console | Diagnostics | Flow Diagram
 * - Reverse engineering: output → code
 * - JS runs natively in the browser sandbox
 */

import React, {
    useState, useRef, useEffect, useCallback, useReducer
} from 'react';
import { useNavigate } from 'react-router-dom';
import { streamCompileWithAnalysis, reverseEngineerCode, fixMermaidGraph } from '../utils/aiService';
import { executeJS, isJavaScript } from '../utils/jsExecutor';
import {
    Play, Terminal, RotateCcw, ArrowLeft,
    GitBranch, BookOpen, Copy, Check, X,
    ChevronDown, Maximize2, Minimize2, RefreshCw,
    ArrowRight, AlertTriangle, Zap,
    Cpu, Code2, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import MermaidRenderer from './MermaidRenderer';
import JCompilerChart from './JCompilerChart';

const MotionDiv    = motion.div;
const MotionButton = motion.button;
const MotionSpan   = motion.span;

// ─── constants ───────────────────────────────────────────────────────────────

const DISCLAIMER_KEY = 'jc_puter_disclaimer_v1';

const LANGUAGES = [
    { value: 'auto',        label: '✨ Auto Detect',  ext: 'code' },
    { value: 'javascript',  label: '📜 JavaScript',   ext: 'js'   },
    { value: 'python',      label: '🐍 Python',       ext: 'py'   },
    { value: 'java',        label: '☕ Java',          ext: 'java' },
    { value: 'cpp',         label: '⚙️  C++',          ext: 'cpp'  },
    { value: 'c',           label: '⚙️  C',            ext: 'c'    },
    { value: 'html',        label: '🌐 HTML/CSS',      ext: 'html' },
    { value: 'sql',         label: '🐬 MySQL',         ext: 'sql'  },
    { value: 'assembly',    label: '🔩 Assembly',      ext: 'asm'  },
    { value: 'arduino',     label: '🤖 Arduino',      ext: 'ino'  },
    { value: 'micropython', label: '🐍 MicroPython',  ext: 'py'   },
];

const EXAMPLES = {
    javascript: `// Interactive fibonacci with user input
async function main() {
  const n = await prompt("How many Fibonacci numbers? ");
  const count = parseInt(n) || 10;
  let a = 0, b = 1;
  const series = [a, b];
  for (let i = 2; i < count; i++) {
    [a, b] = [b, a + b];
    series.push(b);
  }
  console.log(\`Fibonacci(\${count}):\`, series.join(' \u2192 '));
  console.table(series.map((v, i) => ({ index: i, value: v })));
}
main();`,

    python: `# Bubble sort visualiser
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
        print(f"Pass {i+1}: {arr}")
    return arr

data = [64, 34, 25, 12, 22, 11, 90]
print(f"Input:  {data}")
sorted_data = bubble_sort(data[:])
print(f"Sorted: {sorted_data}")`,
};

const PLACEHOLDERS = {
    compiler: `// Write code here \u00b7 Ctrl+Enter to run

// JavaScript runs natively in the browser
// Other languages use AI virtual machine

async function main() {
    const name = await prompt("Enter your name: ");
    console.log(\`Hello, \${name}!\`);
}
main();`,

    generator: `Describe the expected output or paste an error log.

Example \u2014 reverse-engineer this output:
  [1, 1, 2, 3, 5, 8, 13, 21, 34, 55]

Or paste a crash trace:
  TypeError: Cannot read property 'length' of undefined
      at main (script.js:4)`,
};

const LINE_STYLES = {
    stdout:     { color: '#55efc4' },
    stderr:     { color: '#ff6b6b' },
    warn:       { color: '#ffd166' },
    info:       { color: '#00d2d3' },
    debug:      { color: '#8395a7' },
    user_input: { color: '#34d399' },
    stream:     { color: '#55efc4' },
    boot:       { color: '#4a5568' },
    divider:    { color: 'transparent' },
    exit_ok:    { color: '#55efc4' },
    exit_err:   { color: '#ff6b6b' },
};

const ERROR_PATTERN = /\b(error|exception|traceback|fatal|segmentation fault|undefined reference|syntaxerror|typeerror|nameerror|referenceerror|compile failed)\b/i;

let _uid = 0;
const uid    = () => `l${++_uid}`;
const fmtDur = ms => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;

const formatCompilerError = (code, language, analysis) => {
    const errorExplanation = analysis?.errorExplanation || analysis?.verdict || "Compilation failed";
    const lineChecks = Array.isArray(analysis?.lineChecks) ? analysis.lineChecks : [];
    const firstErr = lineChecks.find(l => String(l.severity).toLowerCase().includes('error'));
    const lineNum = firstErr ? firstErr.line : 1;
    const lineCode = firstErr ? firstErr.code : (code.split('\n')[lineNum - 1] || '');

    const langLabel = language === 'auto' ? 'script' : language;
    const ext = { javascript: 'js', python: 'py', cpp: 'cpp', java: 'java', c: 'c', html: 'html', css: 'css', sql: 'sql' }[langLabel] || 'txt';

    if (langLabel === 'python' || ext === 'py') {
        return `  File "main.py", line ${lineNum}
    ${lineCode.trim()}
    ${' '.repeat(Math.max(lineCode.trim().length - 1, 0))}^
SyntaxError: ${errorExplanation}`;
    } else if (langLabel === 'cpp' || langLabel === 'c') {
        return `main.${ext}:${lineNum}:5: error: ${errorExplanation}
   ${lineNum} | ${lineCode}
      |     ^`;
    } else if (langLabel === 'java') {
        return `main.java:${lineNum}: error: ${errorExplanation}
        ${lineCode.trim()}
        ^
1 error`;
    } else {
        return `Compilation Error in main.${ext} on line ${lineNum}
----------------------------------------
Error: ${errorExplanation}
Line ${lineNum}: ${lineCode}`;
    }
};

// ─── terminal reducer ─────────────────────────────────────────────────────────

const termReducer = (state, action) => {
    switch (action.type) {
        case 'RESET':
            return { lines: [], stream: '' };
        case 'APPEND':
            return {
                ...state,
                lines: [
                    ...state.lines,
                    ...String(action.text).split('\n').map(text => ({
                        id: uid(), text, type: action.lineType || 'stdout',
                    })),
                ],
            };
        case 'SET_STREAM':
            return { ...state, stream: action.text };
        case 'COMMIT_STREAM': {
            if (!state.stream) return state;
            const newLines = String(state.stream).split('\n').map(text => ({
                id: uid(), text, type: 'stdout',
            }));
            return { lines: [...state.lines, ...newLines], stream: '' };
        }
        default:
            return state;
    }
};

// ─── Puter Disclaimer Modal ───────────────────────────────────────────────────

const PuterDisclaimerModal = ({ onAccept }) => (
    <div style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
    }}>
        <MotionDiv
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            style={{
                background: 'linear-gradient(145deg, #0f1929 0%, #0c1520 100%)',
                border: '1px solid rgba(99,179,237,0.22)',
                borderRadius: 20, padding: '34px 38px', maxWidth: 490, width: '90vw',
                boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(99,179,237,0.08)',
            }}
        >
            <div style={{
                width: 54, height: 54, borderRadius: 15,
                background: 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(139,92,246,0.12))',
                border: '1px solid rgba(99,179,237,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 22,
                boxShadow: '0 4px 20px rgba(59,130,246,0.2)',
            }}>
                <Zap size={25} style={{ color: '#63b3ed' }} />
            </div>

            <h2 style={{
                fontSize: 21, fontWeight: 800, color: '#e2e8f0',
                marginBottom: 12, fontFamily: 'Outfit, sans-serif', letterSpacing: -0.4,
            }}>
                Powered by Puter AI
            </h2>

            <p style={{
                fontSize: 14, color: '#94a3b8', lineHeight: 1.75,
                marginBottom: 20, fontFamily: 'Outfit, sans-serif',
            }}>
                J-Compiler uses <strong style={{ color: '#63b3ed' }}>Puter&apos;s free AI</strong> to
                emulate real compiler output, detect errors, generate fix reports, and visualize
                code flow — all in one stream.
            </p>

            <div style={{
                background: 'rgba(251,191,36,0.07)',
                border: '1px solid rgba(251,191,36,0.22)',
                borderRadius: 11, padding: '13px 15px',
                marginBottom: 26,
            }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <AlertTriangle size={14} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 12.5, color: '#fcd34d', lineHeight: 1.65, fontFamily: 'Outfit, sans-serif' }}>
                        <strong>Credit Notice:</strong> Each compilation uses your Puter AI credits.
                        Puter provides free credits for logged-in users. Heavy usage may require topping up.
                    </div>
                </div>
            </div>

            <MotionButton
                whileTap={{ scale: 0.97 }}
                onClick={onAccept}
                style={{
                    width: '100%', padding: '13px 20px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    border: 'none', borderRadius: 11, color: '#fff',
                    fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'Outfit, sans-serif',
                    boxShadow: '0 4px 24px rgba(37,99,235,0.45)',
                    letterSpacing: -0.2,
                }}
            >
                I Understand \u2014 Start Compiling
            </MotionButton>

            <p style={{
                fontSize: 11, color: '#334155', textAlign: 'center',
                marginTop: 14, fontFamily: 'Outfit, sans-serif',
            }}>
                Shown once. J-Compiler is a student learning tool.
            </p>
        </MotionDiv>
    </div>
);

// ─── Language Dropdown ────────────────────────────────────────────────────────

const LangDropdown = ({ language, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const sel = LANGUAGES.find(l => l.value === language) || LANGUAGES[0];

    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative', zIndex: 50 }}>
            <button
                onClick={() => setOpen(v => !v)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    borderRadius: 7, padding: '4px 10px', fontSize: 12,
                    cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                    transition: 'border-color 0.15s',
                }}
            >
                {sel.label}
                <ChevronDown size={11} style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </button>
            <AnimatePresence>
                {open && (
                    <MotionDiv
                        initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
                        animate={{ opacity: 1, y: 0, scaleY: 1 }}
                        exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
                        transition={{ duration: 0.1 }}
                        style={{
                            position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 10, overflow: 'hidden', minWidth: 176,
                            boxShadow: 'var(--shadow-md)', transformOrigin: 'top right',
                        }}
                    >
                        {LANGUAGES.map(l => {
                            const active = language === l.value;
                            return (
                                <button
                                    key={l.value}
                                    onClick={() => { onChange(l.value); setOpen(false); }}
                                    style={{
                                        display: 'block', width: '100%', textAlign: 'left',
                                        background: active ? 'var(--accent-soft)' : 'transparent',
                                        border: 'none',
                                        borderLeft: `2px solid ${active ? 'var(--primary)' : 'transparent'}`,
                                        color: active ? 'var(--primary)' : 'var(--text-secondary)',
                                        padding: '7px 12px', fontSize: 12, cursor: 'pointer',
                                        fontFamily: 'Outfit, sans-serif', transition: 'background 0.1s',
                                    }}
                                >{l.label}</button>
                            );
                        })}
                    </MotionDiv>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Terminal Line ────────────────────────────────────────────────────────────

const TermLine = ({ line }) => {
    const style = LINE_STYLES[line.type] || LINE_STYLES.stdout;
    if (line.type === 'divider') {
        return <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '6px 0' }} />;
    }
    return (
        <div style={{
            color: style.color,
            fontFamily: "'Fira Code', 'Cascadia Code', monospace",
            fontSize: 13, lineHeight: '1.65',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            opacity: line.type === 'boot' ? 0.4 : 1,
        }}>
            {line.text}
        </div>
    );
};

// ─── Inline Input ─────────────────────────────────────────────────────────────

const InlineInput = ({ promptText, onSubmit }) => {
    const [value, setValue] = useState('');
    const ref = useRef(null);
    useEffect(() => { ref.current?.focus(); }, []);
    return (
        <div style={{
            display: 'flex', alignItems: 'center',
            fontFamily: "'Fira Code', monospace", fontSize: 13, lineHeight: '1.65', marginTop: 2,
        }}>
            {promptText && <span style={{ color: '#94a3b8', marginRight: 8 }}>{promptText}</span>}
            <input
                ref={ref} value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSubmit(value); } }}
                style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: '#34d399', fontFamily: "'Fira Code', monospace",
                    fontSize: 13, flex: 1, minWidth: 0, caretColor: '#34d399',
                }}
                autoComplete="off" spellCheck={false}
            />
            <MotionSpan
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity, ease: 'steps(1)' }}
                style={{ color: '#34d399', fontSize: 14 }}
            >\u2588</MotionSpan>
        </div>
    );
};

// ─── Diagnostics Panel ────────────────────────────────────────────────────────

const DiagnosticsPanel = ({ analysis, onCopyCode, onApplyFix, copyDone }) => {
    if (!analysis) return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.35,
        }}>
            <BookOpen size={36} strokeWidth={1} style={{ color: '#8395a7' }} />
            <div style={{ fontSize: 12, color: '#8395a7', fontFamily: 'Outfit, sans-serif' }}>
                Run code to see diagnostics
            </div>
        </div>
    );

    const lineChecks = Array.isArray(analysis.lineChecks) ? analysis.lineChecks : [];
    const errCount   = lineChecks.filter(l => String(l.severity).toLowerCase().includes('error')).length;
    const warnCount  = lineChecks.filter(l => String(l.severity).toLowerCase().includes('warn')).length;

    return (
        <div style={{
            flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px',
            display: 'flex', flexDirection: 'column', gap: 14,
        }}>
            {/* Verdict */}
            {(analysis.verdict || analysis.detectedLanguage) && (
                <div style={{
                    background: 'rgba(17,24,39,0.8)',
                    border: `1px solid ${analysis.status === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.3)'}`,
                    borderRadius: 10, padding: '12px 14px',
                }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {analysis.detectedLanguage && (
                            <span style={{
                                fontSize: 10, color: '#93c5fd',
                                border: '1px solid rgba(147,197,253,.3)',
                                background: 'rgba(59,130,246,.1)',
                                borderRadius: 999, padding: '2px 8px',
                                fontFamily: 'Fira Code, monospace', flexShrink: 0,
                            }}>{analysis.detectedLanguage}</span>
                        )}
                        {analysis.status && (
                            <span style={{
                                fontSize: 10, fontWeight: 700,
                                color: analysis.status === 'error' ? '#fca5a5' : '#6ee7b7',
                                border: `1px solid ${analysis.status === 'error' ? 'rgba(239,68,68,.3)' : 'rgba(52,211,153,.3)'}`,
                                background: analysis.status === 'error' ? 'rgba(239,68,68,.1)' : 'rgba(52,211,153,.1)',
                                borderRadius: 999, padding: '2px 8px', flexShrink: 0,
                                fontFamily: 'Fira Code, monospace', letterSpacing: 0.5,
                            }}>{analysis.status.toUpperCase()}</span>
                        )}
                        {analysis.verdict && (
                            <span style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, flex: 1 }}>
                                {analysis.verdict}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Summary stats */}
            {lineChecks.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                    {[
                        { label: 'Lines Checked', val: lineChecks.length, color: '#63b3ed' },
                        { label: 'Errors',        val: errCount,          color: '#f87171' },
                        { label: 'Warnings',      val: warnCount,         color: '#fbbf24' },
                    ].map(({ label, val, color }) => (
                        <div key={label} style={{
                            flex: 1, background: 'rgba(17,24,39,0.6)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 8, padding: '8px 10px', textAlign: 'center',
                        }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: 'Fira Code, monospace' }}>{val}</div>
                            <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'Outfit, sans-serif', marginTop: 2 }}>{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Reasoning */}
            {analysis.reasoning && (
                <div style={{
                    background: 'rgba(17,24,39,0.6)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: '12px 14px',
                }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                        Execution Model
                    </div>
                    <div style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.7 }}>
                        {analysis.reasoning}
                    </div>
                </div>
            )}

            {/* Line-by-line checks */}
            {lineChecks.length > 0 && (
                <div style={{
                    background: 'rgba(11,18,32,0.8)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, overflow: 'hidden',
                }}>
                    <div style={{
                        fontSize: 10, fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: 0.8,
                        padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <Code2 size={10} /> Line-by-Line Check
                    </div>
                    {lineChecks.slice(0, 80).map((item, idx) => {
                        const sev   = String(item.severity || 'ok').toLowerCase();
                        const color = sev.includes('error') ? '#f87171'
                            : sev.includes('warn') ? '#fbbf24' : '#34d399';
                        return (
                            <div
                                key={`${item.line}-${idx}`}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '44px minmax(0,1fr)',
                                    gap: 10, padding: '8px 12px',
                                    borderBottom: idx < lineChecks.length - 1
                                        ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                    background: sev.includes('error') ? 'rgba(239,68,68,0.04)' : 'transparent',
                                }}
                            >
                                <span style={{ color, fontSize: 11, fontFamily: 'Fira Code, monospace', fontWeight: 700 }}>
                                    L{item.line}
                                </span>
                                <div>
                                    {item.code && (
                                        <div style={{
                                            color: '#93c5fd', fontSize: 11,
                                            fontFamily: 'Fira Code, monospace',
                                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                            marginBottom: 3,
                                        }}>{item.code}</div>
                                    )}
                                    <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>
                                        {item.finding}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Error explanation */}
            {analysis.errorExplanation && (
                <div style={{
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: 10, padding: '12px 14px',
                }}>
                    <div style={{
                        fontSize: 10, fontWeight: 700, color: '#ff8787',
                        textTransform: 'uppercase', letterSpacing: 0.8,
                        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                        <AlertTriangle size={11} /> Root Cause
                    </div>
                    <div style={{ fontSize: 12.5, color: '#f8fafc', lineHeight: 1.7 }}>
                        <ReactMarkdown>{analysis.errorExplanation}</ReactMarkdown>
                    </div>
                </div>
            )}

            {/* Fix report */}
            {analysis.fixReport && (
                <div style={{
                    background: 'rgba(14,165,233,0.06)',
                    border: '1px solid rgba(14,165,233,0.25)',
                    borderRadius: 10, padding: '12px 14px',
                }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                        Repair Report
                    </div>
                    <div style={{ fontSize: 12.5, color: '#e0f2fe', lineHeight: 1.7 }}>
                        <ReactMarkdown>{analysis.fixReport}</ReactMarkdown>
                    </div>
                </div>
            )}

            {/* Fixed code */}
            {analysis.fixedCode && (
                <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(52,211,153,0.25)' }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px',
                        background: 'rgba(52,211,153,0.08)',
                        borderBottom: '1px solid rgba(52,211,153,0.15)',
                    }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#34d399', letterSpacing: 0.8 }}>
                            \u2713 SUGGESTED FIX
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button
                                onClick={() => onCopyCode(analysis.fixedCode)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#94a3b8', borderRadius: 6, padding: '3px 8px',
                                    fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                                }}
                            >
                                {copyDone ? <Check size={10} /> : <Copy size={10} />} Copy
                            </button>
                            <button
                                onClick={() => onApplyFix(analysis.fixedCode)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    background: 'rgba(37,99,235,0.85)', border: 'none',
                                    color: '#fff', borderRadius: 6, padding: '3px 10px',
                                    fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600,
                                }}
                            >
                                <ArrowRight size={10} /> Apply Fix
                            </button>
                        </div>
                    </div>
                    <pre style={{
                        margin: 0, background: '#060d1a', padding: '12px',
                        color: '#e2e8f0', fontSize: 12, lineHeight: 1.6,
                        fontFamily: 'Fira Code, monospace',
                        whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto',
                    }}>{analysis.fixedCode}</pre>
                </div>
            )}
        </div>
    );
};

// ─── Flow Diagram Panel ───────────────────────────────────────────────────────

const FlowPanel = ({ mermaidGraph, running, onAIRetry, onMermaidFixed }) => {
    if (running) return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.4,
        }}>
            <RefreshCw size={28} strokeWidth={1.5} style={{ color: '#67e8f9', animation: 'jcSpin 1.2s linear infinite' }} />
            <div style={{ fontSize: 12, color: '#67e8f9', fontFamily: 'Outfit, sans-serif' }}>Generating flow diagram\u2026</div>
        </div>
    );
    if (!mermaidGraph) return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.35,
        }}>
            <GitBranch size={36} strokeWidth={1} style={{ color: '#8395a7' }} />
            <div style={{ fontSize: 12, color: '#8395a7', fontFamily: 'Outfit, sans-serif' }}>Run code to see flow diagram</div>
        </div>
    );
    return (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px' }}>
            <div style={{
                fontSize: 12, fontWeight: 700, color: '#67e8f9',
                marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'Outfit, sans-serif',
            }}>
                <GitBranch size={13} /> Visual Execution Flow
            </div>
            <MermaidRenderer
                chart={mermaidGraph}
                darkMode={true}
                onAIRetry={onAIRetry}
                onFixed={onMermaidFixed}
            />
        </div>
    );
};

// ─── Output Tab ───────────────────────────────────────────────────────────────

const OutputPanel = ({ term, running, pendingInput, handleInputSubmit, mode, chartSpec, htmlPlot }) => {
    const endRef = useRef(null);
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [term.lines.length, term.stream, pendingInput]);

    const hasOutput = term.lines.filter(l => l.type !== 'boot' && l.type !== 'divider').length > 0 || term.stream;

    return (
        <div style={{
            flex: 1, overflowY: 'auto', padding: '14px 16px',
            background: '#060c18', display: 'flex', flexDirection: 'column',
        }}>
            <AnimatePresence mode="wait">
                {!running && !hasOutput && term.lines.length === 0 && (
                    <MotionDiv
                        key="empty"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{
                            flex: 1, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            gap: 10, opacity: 0.4, minHeight: 200,
                        }}
                    >
                        <Terminal size={44} strokeWidth={1} style={{ color: '#8395a7' }} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 13, color: '#cbd5e1', fontFamily: 'Outfit, sans-serif' }}>
                                {mode === 'compiler' ? 'Write code and press Run' : 'Describe expected output to decompile'}
                            </div>
                            <div style={{ fontSize: 11, color: '#8395a7', marginTop: 4, fontFamily: 'Outfit, sans-serif' }}>
                                JavaScript runs natively \u00b7 other languages via AI VM
                            </div>
                        </div>
                    </MotionDiv>
                )}

                {(hasOutput || running) && (
                    <MotionDiv
                        key="output"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{ display: 'flex', flexDirection: 'column' }}
                    >
                        {term.lines.map(line => <TermLine key={line.id} line={line} />)}

                        {term.stream && (
                            <div style={{
                                fontFamily: "'Fira Code', monospace",
                                fontSize: 13, lineHeight: '1.65',
                                color: '#55efc4',
                                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                            }}>
                                {term.stream}
                                <MotionSpan
                                    animate={{ opacity: [1, 0, 1] }}
                                    transition={{ duration: 0.7, repeat: Infinity, ease: 'steps(1)' }}
                                    style={{ display: 'inline-block', color: '#3b82f6', fontWeight: 700 }}
                                >\u258b</MotionSpan>
                            </div>
                        )}

                        {running && !term.stream && term.lines.length === 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <MotionSpan
                                    animate={{ opacity: [1, 0, 1] }}
                                    transition={{ duration: 0.7, repeat: Infinity, ease: 'steps(1)' }}
                                    style={{ color: '#3b82f6', fontFamily: 'Fira Code, monospace', fontSize: 13 }}
                                >\u258b</MotionSpan>
                                <span style={{ color: '#334155', fontFamily: 'Fira Code, monospace', fontSize: 11 }}>compiling\u2026</span>
                            </div>
                        )}

                        {pendingInput && (
                            <InlineInput promptText={pendingInput.promptText} onSubmit={handleInputSubmit} />
                        )}
                    </MotionDiv>
                )}
            </AnimatePresence>

            {/* Inline chart — rendered below terminal output like a real Python REPL */}
            {(chartSpec || htmlPlot) && !running && (
                <div style={{ padding: '0 0 14px 0' }}>
                    <div style={{
                        fontSize: 10, fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: 0.8,
                        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5,
                        fontFamily: 'Outfit, sans-serif',
                    }}>
                        <BarChart2 size={10} /> Plot Output
                    </div>
                    {htmlPlot ? (
                        <iframe
                            srcDoc={htmlPlot}
                            title="Plot Output"
                            style={{
                                width: '100%',
                                height: '450px',
                                border: 'none',
                                borderRadius: '8px',
                                background: '#0f1117',
                                overflow: 'hidden'
                            }}
                            sandbox="allow-scripts allow-same-origin"
                            allow="fullscreen"
                        />
                    ) : (
                        <JCompilerChart chartSpec={chartSpec} />
                    )}
                </div>
            )}

            <div ref={endRef} />
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function JCompiler() {
    const navigate = useNavigate();

    const [showDisclaimer, setShowDisclaimer] = useState(
        () => !localStorage.getItem(DISCLAIMER_KEY)
    );

    const [mode, setMode]         = useState('compiler');
    const [input, setInput]       = useState('');
    const [language, setLanguage] = useState('auto');
    const [history, setHistory]   = useState([]);

    const [running, setRunning]           = useState(false);
    const [pendingInput, setPendingInput] = useState(null);
    const [exitInfo, setExitInfo]         = useState(null);
    const [engineState, setEngineState]   = useState('READY');

    const [analysis, setAnalysis]       = useState(null);
    const [analysing, setAnalysing]     = useState(false);
    const [fixedMermaidGraph, setFixedMermaidGraph] = useState(null);

    const [activeTab, setActiveTab] = useState('output');
    const [copyDone, setCopyDone]   = useState(false);
    const [fullscreen, setFullscreen] = useState(false);

    const [term, dispatch] = useReducer(termReducer, { lines: [], stream: '' });

    const gutterRef    = useRef(null);
    const abortCtrlRef = useRef(null);
    const streamBufRef = useRef('');
    const rafRef       = useRef(null);
    const activeRunRef = useRef(0);

    const onEditorScroll = e => {
        if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop;
    };

    const append = useCallback((text, lineType = 'stdout') => {
        dispatch({ type: 'APPEND', text, lineType });
    }, []);

    const resetTerm = useCallback(() => {
        dispatch({ type: 'RESET' });
        setExitInfo(null);
        setAnalysis(null);
        setAnalysing(false);
        setPendingInput(null);
        setFixedMermaidGraph(null);
        streamBufRef.current = '';
    }, []);

    const handleAcceptDisclaimer = useCallback(() => {
        localStorage.setItem(DISCLAIMER_KEY, '1');
        setShowDisclaimer(false);
    }, []);

    // ── AI compile + analyze (single call) ───────────────────────────────────

    const runAI = useCallback(async () => {
        const runId = activeRunRef.current + 1;
        activeRunRef.current = runId;
        resetTerm();
        setRunning(true);
        setEngineState('RUNNING');
        setActiveTab('output');

        const abortCtrl = new AbortController();
        abortCtrlRef.current = abortCtrl;
        streamBufRef.current = '';

        const t0 = Date.now();

        try {
            const { outputText, analysis: rawAnalysis } = await streamCompileWithAnalysis(
                input, language,
                {
                    signal: abortCtrl.signal,
                    onOutputToken: (_token, full) => {
                        if (abortCtrl.signal.aborted || activeRunRef.current !== runId) return;
                        // Direct dispatch — no RAF buffering, tokens appear immediately
                        dispatch({ type: 'SET_STREAM', text: full });
                    },
                }
            );

            if (abortCtrl.signal.aborted || activeRunRef.current !== runId) return;

            const dur      = fmtDur(Date.now() - t0);
            const hasError = rawAnalysis?.status === 'error' || ERROR_PATTERN.test(outputText);

            let finalOutput = outputText;
            if (hasError && (!outputText.trim() || !ERROR_PATTERN.test(outputText))) {
                finalOutput = formatCompilerError(input, language, rawAnalysis);
            }

            // Commit whatever the stream has (covers empty-output case too)
            dispatch({ type: 'SET_STREAM', text: finalOutput });
            dispatch({ type: 'COMMIT_STREAM' });

            if (hasError) {
                append(`\nProcess finished with exit code 1 (completed in ${dur})`, 'exit_err');
            } else {
                append(`\nProcess finished with exit code 0 (completed in ${dur})`, 'exit_ok');
            }

            setExitInfo({ code: hasError ? 1 : 0, dur });
            setEngineState(hasError ? 'ERROR' : 'DONE');
            setAnalysis(rawAnalysis);

            if (hasError && rawAnalysis?.errorExplanation) {
                setTimeout(() => setActiveTab('diagnostics'), 600);
            } else if (rawAnalysis?.chartSpec || rawAnalysis?.htmlPlot) {
                setTimeout(() => setActiveTab('output'), 600);
            } else if (rawAnalysis?.mermaidGraph) {
                setTimeout(() => setActiveTab('flow'), 600);
            }

            setHistory(prev => [...prev.slice(-9), {
                code: input, lang: language,
                result: { output: finalOutput },
                exitCode: hasError ? 1 : 0,
            }]);

        } catch (err) {
            if (abortCtrl.signal.aborted || activeRunRef.current !== runId) return;
            dispatch({ type: 'COMMIT_STREAM' });
            append(err.message || 'Compilation failed', 'stderr');
            setExitInfo({ code: 1, dur: fmtDur(Date.now() - t0) });
            setEngineState('ERROR');
        } finally {
            if (activeRunRef.current === runId) {
                setRunning(false);
                abortCtrlRef.current = null;
            }
        }
    }, [input, language, append, resetTerm]);

    // ── JS native execution ───────────────────────────────────────────────────

    const runJS = useCallback(async () => {
        const runId = activeRunRef.current + 1;
        activeRunRef.current = runId;
        resetTerm();
        setRunning(true);
        setEngineState('RUNNING');
        setActiveTab('output');

        const abortCtrl = new AbortController();
        abortCtrlRef.current = abortCtrl;
        const localLines = [];

        const onOutput = (text, type) => {
            if (activeRunRef.current !== runId || abortCtrl.signal.aborted) return;
            localLines.push(text);
            append(text, type);
        };
        const onInputRequest = (promptText, resolve) => {
            if (activeRunRef.current !== runId) return;
            setPendingInput({ promptText, resolve });
        };

        const { exitCode, duration } = await executeJS(input, onOutput, onInputRequest, abortCtrl.signal);
        if (activeRunRef.current !== runId) return;

        setPendingInput(null);
        abortCtrlRef.current = null;

        const dur = fmtDur(duration);
        if (exitCode === 0) {
            append(`\nProcess finished with exit code 0 (completed in ${dur})`, 'exit_ok');
        } else {
            append(`\nProcess finished with exit code 1 (completed in ${dur})`, 'exit_err');
        }

        setExitInfo({ code: exitCode, dur });
        setEngineState(exitCode === 0 ? 'DONE' : 'ERROR');

        const outputText = localLines.join('\n');
        setHistory(prev => [...prev.slice(-9), {
            code: input, lang: 'javascript',
            result: { output: outputText }, exitCode,
        }]);

        setRunning(false);

        // Background analysis via AI (single call, no output streaming needed)
        setAnalysing(true);
        const analysisRunId = runId;
        try {
            const { analysis: rawAnalysis } = await streamCompileWithAnalysis(input, 'javascript', {});
            if (activeRunRef.current === analysisRunId) {
                setAnalysis(rawAnalysis);
                if (exitCode !== 0 && rawAnalysis?.errorExplanation) {
                    setTimeout(() => setActiveTab('diagnostics'), 400);
                } else if (rawAnalysis?.mermaidGraph) {
                    setTimeout(() => setActiveTab('flow'), 400);
                }
            }
        } catch { /* ignore */ } finally {
            if (activeRunRef.current === analysisRunId) setAnalysing(false);
        }
    }, [input, append, resetTerm]);

    // ── Reverse engineering ───────────────────────────────────────────────────

    const runReverse = useCallback(async () => {
        const runId = activeRunRef.current + 1;
        activeRunRef.current = runId;
        resetTerm();
        setRunning(true);
        setEngineState('RUNNING');
        setActiveTab('output');

        const abortCtrl = new AbortController();
        abortCtrlRef.current = abortCtrl;
        streamBufRef.current = '';

        const t0 = Date.now();

        try {
            const result = await reverseEngineerCode(input, language, {
                // `full` is already explanation-stripped (from aiService)
                // stream each token directly — no RAF buffering
                onToken: (_token, full) => {
                    if (abortCtrl.signal.aborted || activeRunRef.current !== runId) return;
                    dispatch({ type: 'SET_STREAM', text: full });
                },
            });

            if (abortCtrl.signal.aborted || activeRunRef.current !== runId) return;

            // Ensure the final code is in the stream before committing
            const codeToShow = result.code || '';
            if (codeToShow) dispatch({ type: 'SET_STREAM', text: codeToShow });
            dispatch({ type: 'COMMIT_STREAM' });

            setExitInfo({ code: 0, dur: fmtDur(Date.now() - t0) });
            setEngineState('DONE');

            if (result.explanation) {
                setAnalysis({
                    status: 'success', detectedLanguage: language,
                    verdict: 'Code reconstructed from output',
                    reasoning: result.explanation,
                    lineChecks: [], errorExplanation: '',
                    fixedCode: '', fixReport: '', mermaidGraph: '',
                });
                setTimeout(() => setActiveTab('diagnostics'), 600);
            }

            setHistory(prev => [...prev.slice(-9), {
                code: input, lang: language,
                result: { output: result.code }, exitCode: 0,
            }]);
        } catch (err) {
            if (abortCtrl.signal.aborted || activeRunRef.current !== runId) return;
            dispatch({ type: 'COMMIT_STREAM' });
            append(err.message || 'Reconstruction failed', 'stderr');
            setExitInfo({ code: 1, dur: fmtDur(Date.now() - t0) });
            setEngineState('ERROR');
        } finally {
            if (activeRunRef.current === runId) {
                setRunning(false);
                abortCtrlRef.current = null;
            }
        }
    }, [input, language, append, resetTerm]);

    // ── Dispatch ──────────────────────────────────────────────────────────────

    const handleRun = useCallback(async () => {
        if (!input.trim() || running) return;
        if (mode === 'generator') return runReverse();
        return isJavaScript(input, language) ? runJS() : runAI();
    }, [input, running, mode, language, runJS, runAI, runReverse]);

    useEffect(() => {
        const h = e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleRun(); }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [handleRun]);

    const handleInputSubmit = useCallback((value) => {
        if (!pendingInput) return;
        append(value, 'user_input');
        pendingInput.resolve(value);
        setPendingInput(null);
    }, [pendingInput, append]);

    const handleStop = () => {
        activeRunRef.current += 1;
        abortCtrlRef.current?.abort();
        abortCtrlRef.current = null;
        if (pendingInput?.resolve) pendingInput.resolve('');
        dispatch({ type: 'COMMIT_STREAM' });
        append('Execution terminated by user \u00b7 SIGINT', 'exit_err');
        setExitInfo({ code: 130, dur: '\u2014' });
        setEngineState('ERROR');
        setRunning(false);
        setAnalysing(false);
        setPendingInput(null);
    };

    const switchMode = m => {
        activeRunRef.current += 1;
        abortCtrlRef.current?.abort();
        abortCtrlRef.current = null;
        if (pendingInput?.resolve) pendingInput.resolve('');
        setRunning(false);
        setMode(m); setInput('');
        resetTerm(); setAnalysis(null); setEngineState('READY');
    };

    const loadExample = () => {
        const ex = EXAMPLES[language === 'auto' ? 'javascript' : language] || EXAMPLES.javascript;
        setInput(ex);
    };

    const copyOutput = () => {
        const text = [term.lines.map(l => l.text).join('\n'), term.stream].filter(Boolean).join('\n');
        navigator.clipboard.writeText(text);
        setCopyDone(true);
        setTimeout(() => setCopyDone(false), 2000);
    };

    const copyCode = code => {
        navigator.clipboard.writeText(code);
        setCopyDone(true);
        setTimeout(() => setCopyDone(false), 2000);
    };

    const applyFix = fixed => {
        setInput(fixed);
        setAnalysis(null);
        setActiveTab('output');
    };

    // ── Derived ───────────────────────────────────────────────────────────────

    const lineCount  = Math.max(input.split('\n').length, 1);
    const selLang    = LANGUAGES.find(l => l.value === language) || LANGUAGES[0];
    const hasOutput  = term.lines.filter(l => l.type !== 'boot' && l.type !== 'divider').length > 0 || term.stream;
    const lineChecks = Array.isArray(analysis?.lineChecks) ? analysis.lineChecks : [];
    const errCount   = lineChecks.filter(l => String(l.severity).toLowerCase().includes('error')).length;
    const hasFlow    = !!(fixedMermaidGraph || analysis?.mermaidGraph);
    const hasChart   = !!(analysis?.chartSpec || analysis?.htmlPlot);
    const hasDiag    = !!(analysis?.errorExplanation || analysis?.fixedCode || analysis?.reasoning || analysis?.fixReport || lineChecks.length);

    const engineColour = {
        READY:   'var(--primary)',
        RUNNING: '#fbbf24',
        DONE:    '#34d399',
        ERROR:   '#f87171',
    }[engineState] || 'var(--text-muted)';

    const TABS = [
        { id: 'output',      Icon: Terminal,   label: 'Output',      badge: hasChart ? '📊' : null },
        { id: 'diagnostics', Icon: BookOpen,   label: 'Diagnostics', badge: errCount > 0 ? errCount : (hasDiag ? '!' : null) },
        { id: 'flow',        Icon: GitBranch,  label: 'Flow',        badge: hasFlow ? '\u25cf' : null },
    ];

    return (
        <div
            style={{
                height: '100vh', maxHeight: '100vh',
                background: 'var(--bg-page)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                fontFamily: 'Outfit, sans-serif', color: 'var(--text-main)',
            }}
            className={fullscreen ? 'jc-fullscreen' : ''}
        >
            {showDisclaimer && <PuterDisclaimerModal onAccept={handleAcceptDisclaimer} />}

            {/* ── Top Bar ────────────────────────────────────────────── */}
            <div style={{
                background: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-color)',
                padding: '0 14px', height: 52, flexShrink: 0,
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 10,
                boxShadow: 'var(--shadow-sm)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)',
                            borderRadius: 8, width: 32, height: 32,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                        title="Back"
                    ><ArrowLeft size={15} /></button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Cpu size={17} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: -0.3 }}>J-Compiler</span>
                        <span style={{
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))',
                            border: '1px solid rgba(99,179,237,0.35)', color: '#93c5fd',
                            fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 10, letterSpacing: 0.8,
                        }}>v3.0</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MotionDiv
                            animate={engineState === 'RUNNING'
                                ? { scale: [1, 1.4, 1], opacity: [1, 0.4, 1] }
                                : { scale: 1, opacity: 1 }}
                            transition={engineState === 'RUNNING' ? { duration: 0.8, repeat: Infinity } : {}}
                            style={{
                                width: 7, height: 7, borderRadius: '50%',
                                background: engineColour,
                                boxShadow: `0 0 8px ${engineColour}80`,
                            }}
                        />
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Fira Code, monospace' }}>
                            {engineState}
                        </span>
                    </div>
                </div>

                {/* Mode toggle */}
                <div style={{
                    display: 'flex', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 9, padding: 3, gap: 2,
                }}>
                    {[
                        { id: 'compiler',  Icon: Play,      label: 'Compile & Run' },
                        { id: 'generator', Icon: RotateCcw, label: 'Reverse Eng.' },
                    ].map(({ id, Icon, label }) => (
                        <MotionButton
                            key={id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => switchMode(id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '5px 12px', borderRadius: 7, border: 'none',
                                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                fontFamily: 'Outfit, sans-serif', transition: 'all 0.15s',
                                background: mode === id ? 'var(--primary)' : 'transparent',
                                color: mode === id ? '#fff' : 'var(--text-secondary)',
                                boxShadow: mode === id ? '0 2px 8px rgba(37,99,235,.25)' : 'none',
                            }}
                        >
                            <Icon size={12} />{label}
                        </MotionButton>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {analysing && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Fira Code, monospace' }}>
                            <RefreshCw size={10} style={{ animation: 'jcSpin 1s linear infinite' }} />
                            analyzing
                        </div>
                    )}
                    <button
                        onClick={() => setFullscreen(f => !f)}
                        style={{
                            background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
                            color: 'var(--text-muted)', borderRadius: 7, width: 28, height: 28,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}
                        title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                        {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                    </button>
                </div>
            </div>

            {/* ── Main Split ───────────────────────────────────────────── */}
            <div className="jc-split" style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                flex: 1, minHeight: 0, overflow: 'hidden',
            }}>
                {/* ── EDITOR ────────────────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', overflow: 'hidden', minHeight: 0 }}>
                    {/* Toolbar */}
                    <div style={{
                        background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)',
                        padding: '5px 10px', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', gap: 8, flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', gap: 5 }}>
                                {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
                                    <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                                ))}
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'Fira Code, monospace' }}>
                                {mode === 'compiler' ? `main.${selLang.ext}` : 'input.txt'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                                onClick={loadExample}
                                style={{
                                    background: 'transparent', border: '1px solid var(--border-color)',
                                    color: 'var(--text-muted)', borderRadius: 6, padding: '3px 8px',
                                    fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                                }}
                            >Example</button>
                            <LangDropdown language={language} onChange={setLanguage} />
                            {running ? (
                                <MotionButton
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleStop}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 5,
                                        background: 'rgba(220,38,38,0.12)', border: '1px solid #f87171',
                                        color: '#f87171', borderRadius: 7, padding: '5px 12px',
                                        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                                    }}
                                ><X size={12} /> Stop</MotionButton>
                            ) : (
                                <MotionButton
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleRun}
                                    disabled={!input.trim()}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 5,
                                        background: input.trim() ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'var(--bg-elevated)',
                                        border: 'none',
                                        color: input.trim() ? '#fff' : 'var(--text-muted)',
                                        borderRadius: 7, padding: '5px 14px',
                                        fontSize: 12, fontWeight: 700,
                                        cursor: input.trim() ? 'pointer' : 'not-allowed',
                                        opacity: input.trim() ? 1 : 0.45,
                                        fontFamily: 'Outfit, sans-serif',
                                        boxShadow: input.trim() ? '0 2px 12px rgba(37,99,235,.4)' : 'none',
                                        transition: 'all 0.2s',
                                    }}
                                    title="Run (Ctrl+Enter)"
                                >
                                    <Play size={12} />
                                    {mode === 'compiler' ? 'Run' : 'Decompile'}
                                </MotionButton>
                            )}
                        </div>
                    </div>

                    {/* Code */}
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-card)' }}>
                        <div
                            ref={gutterRef}
                            style={{
                                width: 44, flexShrink: 0, background: 'var(--bg-surface)',
                                borderRight: '1px solid var(--border-color)',
                                fontFamily: 'Fira Code, monospace', fontSize: 12, lineHeight: '1.7',
                                color: 'var(--text-muted)', padding: '12px 0',
                                textAlign: 'right', overflowY: 'hidden', userSelect: 'none',
                            }}
                        >
                            {Array.from({ length: lineCount }, (_, i) => (
                                <div key={i} style={{ paddingRight: 10 }}>{i + 1}</div>
                            ))}
                        </div>
                        <textarea
                            onScroll={onEditorScroll}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder={PLACEHOLDERS[mode]}
                            spellCheck={false}
                            style={{
                                flex: 1, resize: 'none', border: 'none', outline: 'none',
                                background: 'var(--bg-card)', color: 'var(--text-main)',
                                fontFamily: 'Fira Code, monospace', fontSize: 13, lineHeight: '1.7',
                                padding: '12px 16px', caretColor: 'var(--primary)', tabSize: 4,
                            }}
                        />
                    </div>

                    {/* Status */}
                    <div style={{
                        background: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)',
                        padding: '2px 12px', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)',
                        flexShrink: 0, fontFamily: 'Fira Code, monospace',
                    }}>
                        <span>Ln {lineCount}  Col {(input.split('\n').pop()?.length ?? 0) + 1}</span>
                        <span>Ctrl+Enter to run</span>
                    </div>
                </div>

                {/* ── OUTPUT PANEL ─────────────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#060c18', minHeight: 0 }}>
                    {/* Tab bar */}
                    <div style={{
                        background: 'rgba(8,12,22,0.98)',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'stretch', flexShrink: 0,
                    }}>
                        {TABS.map(({ id, Icon, label, badge }) => {
                            const active = activeTab === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 5,
                                        padding: '9px 14px', border: 'none',
                                        borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                                        background: 'transparent',
                                        color: active ? '#e2e8f0' : '#475569',
                                        fontSize: 11, fontWeight: 600,
                                        cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                                        transition: 'color 0.15s',
                                    }}
                                >
                                    <Icon size={11} />
                                    {label}
                                    {badge != null && (
                                        <span style={{
                                            background: typeof badge === 'number'
                                                ? 'rgba(239,68,68,0.85)' : 'rgba(52,211,153,0.15)',
                                            color: typeof badge === 'number' ? '#fff' : '#34d399',
                                            border: `1px solid ${typeof badge === 'number' ? 'rgba(239,68,68,0.4)' : 'rgba(52,211,153,0.25)'}`,
                                            fontSize: 9, fontWeight: 800,
                                            borderRadius: 999, padding: '0 5px',
                                            lineHeight: '16px', minWidth: 16, textAlign: 'center',
                                        }}>{badge}</span>
                                    )}
                                </button>
                            );
                        })}

                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, paddingRight: 10 }}>
                            {exitInfo && (
                                <span style={{
                                    fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                                    padding: '2px 8px', borderRadius: 10,
                                    fontFamily: 'Fira Code, monospace',
                                    color: exitInfo.code === 0 ? '#34d399' : '#f87171',
                                    background: exitInfo.code === 0 ? 'rgba(52,211,153,.1)' : 'rgba(239,68,68,.1)',
                                    border: `1px solid ${exitInfo.code === 0 ? 'rgba(52,211,153,.3)' : 'rgba(239,68,68,.3)'}`,
                                }}>
                                    {exitInfo.code === 0 ? '\u2713' : '\u2717'} {exitInfo.dur}
                                </span>
                            )}
                            {hasOutput && (
                                <button
                                    onClick={copyOutput}
                                    style={{
                                        display: 'flex', alignItems: 'center',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        color: copyDone ? '#34d399' : '#64748b',
                                        borderRadius: 6, padding: '3px 7px',
                                        fontSize: 10, cursor: 'pointer',
                                    }}
                                >
                                    {copyDone ? <Check size={10} /> : <Copy size={10} />}
                                </button>
                            )}
                            {(hasOutput || analysis) && (
                                <button
                                    onClick={() => {
                                        activeRunRef.current += 1;
                                        abortCtrlRef.current?.abort();
                                        abortCtrlRef.current = null;
                                        if (pendingInput?.resolve) pendingInput.resolve('');
                                        setRunning(false);
                                        resetTerm(); setAnalysis(null);
                                        setExitInfo(null); setEngineState('READY');
                                    }}
                                    style={{
                                        background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                                        color: '#475569', borderRadius: 6,
                                        width: 24, height: 24,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                    }}
                                    title="Clear"
                                ><X size={10} /></button>
                            )}
                        </div>
                    </div>

                    {/* Tab content */}
                    <AnimatePresence mode="wait">
                        {activeTab === 'output' && (
                            <MotionDiv key="output-tab"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                transition={{ duration: 0.12 }}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
                            >
                                <OutputPanel
                                    term={term} running={running}
                                    pendingInput={pendingInput}
                                    handleInputSubmit={handleInputSubmit}
                                    mode={mode}
                                    chartSpec={analysis?.chartSpec}
                                    htmlPlot={analysis?.htmlPlot}
                                />
                            </MotionDiv>
                        )}
                        {activeTab === 'diagnostics' && (
                            <MotionDiv key="diag-tab"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                transition={{ duration: 0.12 }}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#060c18' }}
                            >
                                <DiagnosticsPanel
                                    analysis={analysis}
                                    onCopyCode={copyCode}
                                    onApplyFix={applyFix}
                                    copyDone={copyDone}
                                />
                            </MotionDiv>
                        )}
                        {activeTab === 'flow' && (
                            <MotionDiv key="flow-tab"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                transition={{ duration: 0.12 }}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#060c18' }}
                            >
                                <FlowPanel
                                    mermaidGraph={fixedMermaidGraph ?? analysis?.mermaidGraph}
                                    running={running && !analysis}
                                    onAIRetry={fixMermaidGraph}
                                    onMermaidFixed={setFixedMermaidGraph}
                                />
                            </MotionDiv>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ── History ──────────────────────────────────────────────── */}
            {history.length > 0 && (
                <div style={{
                    background: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)',
                    padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 8,
                    overflowX: 'auto', flexShrink: 0,
                }}>
                    <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
                        color: 'var(--text-muted)', whiteSpace: 'nowrap', textTransform: 'uppercase',
                    }}>History</span>
                    {history.slice().reverse().map((h, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                activeRunRef.current += 1;
                                abortCtrlRef.current?.abort();
                                abortCtrlRef.current = null;
                                if (pendingInput?.resolve) pendingInput.resolve('');
                                setRunning(false); setInput(h.code);
                                resetTerm(); setEngineState('READY');
                            }}
                            style={{
                                background: 'var(--bg-elevated)',
                                border: `1px solid ${h.exitCode === 0 ? 'var(--border-color)' : 'rgba(239,68,68,.3)'}`,
                                color: 'var(--text-secondary)',
                                borderRadius: 5, padding: '2px 9px', fontSize: 11, cursor: 'pointer',
                                whiteSpace: 'nowrap', overflow: 'hidden',
                                textOverflow: 'ellipsis', maxWidth: 160,
                                fontFamily: 'Fira Code, monospace',
                            }}
                            title={h.code.slice(0, 120)}
                        >
                            {h.exitCode === 0 ? '\u25cf' : '\u25cb'} {h.code.split('\n')[0].slice(0, 28) || '(snippet)'}
                        </button>
                    ))}
                    <button
                        onClick={() => setHistory([])}
                        style={{
                            background: 'transparent', border: 'none',
                            color: 'var(--text-muted)', cursor: 'pointer',
                            fontSize: 10, marginLeft: 'auto', whiteSpace: 'nowrap',
                        }}
                    >Clear</button>
                </div>
            )}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500&family=Outfit:wght@400;600;700;800&display=swap');
                @keyframes jcSpin { to { transform: rotate(360deg); } }
                .jc-split { flex: 1; min-height: 0; }
                .jc-fullscreen { position: fixed !important; inset: 0; z-index: 9999; }
                textarea::placeholder { color: var(--text-muted); opacity: 0.5; }
                * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }
                *::-webkit-scrollbar { width: 5px; height: 5px; }
                *::-webkit-scrollbar-track { background: transparent; }
                *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
                *::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }
                @media (max-width: 768px) {
                    .jc-split { grid-template-columns: 1fr !important; grid-template-rows: 50vh 50vh; height: auto !important; }
                }
            `}</style>
        </div>
    );
}
