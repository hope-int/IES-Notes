import React, { useState, useEffect, useRef, useCallback } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, RotateCcw, RefreshCw, Sparkles } from 'lucide-react';

// ─── Sanitize common AI-generated Mermaid mistakes ────────────────────────────
const sanitizeMermaid = (raw = '') => {
    let chart = raw.trim();

    // Strip markdown fences if AI wrapped it
    chart = chart.replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```$/, '').trim();

    // Ensure proper graph declaration
    if (!chart.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|gantt|pie|erDiagram|journey|gitGraph)/i)) {
        chart = 'graph TD\n' + chart;
    }

    const lines = chart.split('\n').map(line => {
        // Skip declaration and comment lines
        if (line.trim().startsWith('%%') || line.match(/^(graph|flowchart|sequenceDiagram|subgraph)/i) || line.trim() === 'end') {
            return line;
        }

        // Fix reserved word node IDs: Start[... → startNode[...
        line = line.replace(/\b(Start|End|Stop|Default)\b(?=\s*[\[({>|])/g, (m) => m + 'Node');

        // Fix unquoted node labels containing colons, parens, slashes
        line = line.replace(/(\w+)\[([^\]"]*[:/()][^\]"]*)\]/g, (_, id, label) => `${id}["${label}"]`);

        // Remove semicolons inside quoted labels
        line = line.replace(/\["([^"]*);"([^"]*)"\]/g, (_, a, b) => `["${a} ${b}"]`);
        line = line.replace(/\["([^"]*);"\]/g, (_, a) => `["${a}"]`);

        // Fix arrow labels using quotes instead of pipes: --> "label" X → -->|"label"| X
        line = line.replace(/-->\s+"([^"]+)"\s+(\w)/g, '-->|"$1"| $2');
        line = line.replace(/-->\s+'([^']+)'\s+(\w)/g, '-->|"$1"| $2');

        return line;
    });

    return lines.join('\n');
};

let _mermaidCounter = 0;
const nextMermaidId = () => `jc-mermaid-${Date.now()}-${_mermaidCounter++}`;

const MermaidRenderer = ({ chart: initialChart, darkMode: propDarkMode, onAIRetry, onFixed }) => {
    const [chart, setChart]         = useState(initialChart || '');
    const [svgContent, setSvgContent] = useState('');
    const [isError, setIsError]     = useState(false);
    const [errorMsg, setErrorMsg]   = useState('');
    const [zoom, setZoom]           = useState(1);
    const [aiFixing, setAiFixing]   = useState(false);
    const [aiFailed, setAiFailed]   = useState(false);
    const containerRef              = useRef(null);

    const isDark = propDarkMode ?? document.body.classList.contains('dark-mode');

    // Sync chart when parent passes a new initial value
    useEffect(() => {
        setChart(initialChart || '');
        setIsError(false);
        setErrorMsg('');
        setSvgContent('');
        setAiFailed(false);
        setZoom(1);
    }, [initialChart]);

    const renderChart = useCallback(async (src) => {
        if (!src) return;
        setSvgContent('');
        setIsError(false);
        setErrorMsg('');

        const id = nextMermaidId();
        const sanitized = sanitizeMermaid(src);

        try {
            mermaid.initialize({
                startOnLoad: false,
                theme: isDark ? 'dark' : 'default',
                securityLevel: 'loose',
                fontFamily: 'Outfit, Inter, sans-serif',
                fontSize: 14,
                suppressErrorRendering: true,
                themeVariables: isDark ? {
                    primaryColor: '#1e3a5f', primaryTextColor: '#e2e8f0',
                    primaryBorderColor: '#3b4c66', lineColor: '#60a5fa',
                    secondaryColor: '#162033', tertiaryColor: '#111827',
                    background: '#0b1220', nodeBorder: '#3b4c66',
                    clusterBkg: '#162033', titleColor: '#60a5fa',
                    edgeLabelBackground: '#162033', fontFamily: 'Outfit, sans-serif',
                } : {
                    primaryColor: '#dbeafe', primaryTextColor: '#0f172a',
                    primaryBorderColor: '#93c5fd', lineColor: '#2563eb',
                    secondaryColor: '#f0f9ff', tertiaryColor: '#f8fafc',
                    nodeBorder: '#93c5fd', clusterBkg: '#f0f9ff',
                    titleColor: '#1d4ed8', fontFamily: 'Outfit, sans-serif',
                },
            });
            const { svg } = await mermaid.render(id, sanitized);
            setSvgContent(svg);
        } catch (err) {
            console.warn('[MermaidRenderer] Render failed:', err?.message || err);
            setIsError(true);
            setErrorMsg(err?.message || String(err));
        }
    }, [isDark]);

    useEffect(() => { renderChart(chart); }, [chart, renderChart]);

    const handleZoomIn  = () => setZoom(z => Math.min(z + 0.2, 3));
    const handleZoomOut = () => setZoom(z => Math.max(z - 0.2, 0.3));
    const handleReset   = () => setZoom(1);

    const handleAIRetry = useCallback(async () => {
        if (!onAIRetry || aiFixing) return;
        setAiFixing(true);
        setAiFailed(false);
        try {
            const fixed = await onAIRetry(chart, errorMsg);
            if (fixed && fixed.trim()) {
                setChart(fixed);
                onFixed?.(fixed);  // lift to parent so tab-switch doesn't revert
            } else {
                setAiFailed(true);
            }
        } catch (err) {
            console.error('[MermaidRenderer] AI retry failed:', err);
            setAiFailed(true);
        } finally {
            setAiFixing(false);
        }
    }, [onAIRetry, chart, errorMsg, aiFixing, onFixed]);

    const surfaceBg = isDark ? 'rgba(22,32,51,0.9)'  : 'rgba(248,250,252,0.95)';
    const borderCol = isDark ? 'var(--border-color)' : '#e2e8f0';
    const textMuted = isDark ? '#64748b' : '#94a3b8';

    if (isError) {
        return (
            <div style={{
                background: isDark ? 'rgba(127,29,29,0.15)' : '#fef2f2',
                border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : '#fca5a5'}`,
                borderRadius: 10, padding: '12px 14px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#f87171', fontSize: 12, fontWeight: 700 }}>⚠ Diagram Syntax Error</span>
                    <button
                        onClick={handleAIRetry}
                        disabled={aiFixing || !onAIRetry}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            background: aiFixing ? 'rgba(108,99,255,0.15)' : 'rgba(108,99,255,0.12)',
                            border: `1px solid ${aiFixing ? 'rgba(108,99,255,0.5)' : 'rgba(108,99,255,0.35)'}`,
                            color: '#a78bfa', borderRadius: 6,
                            padding: '4px 10px', fontSize: 11, cursor: aiFixing ? 'wait' : 'pointer',
                            fontFamily: 'Outfit, sans-serif', fontWeight: 600,
                        }}
                    >
                        {aiFixing
                            ? <><RefreshCw size={10} style={{ animation: 'jcSpin 0.8s linear infinite' }} /> AI Fixing…</>
                            : <><Sparkles size={10} /> AI Retry</>
                        }
                    </button>
                </div>
                {aiFailed && (
                    <div style={{ color: '#fbbf24', fontSize: 11, marginBottom: 6, fontFamily: 'Outfit, sans-serif' }}>
                        AI fix failed — try running the code again.
                    </div>
                )}
                {errorMsg && (
                    <div style={{ color: textMuted, fontSize: 11, fontFamily: 'Fira Code, monospace', marginBottom: 8 }}>
                        {errorMsg.slice(0, 200)}
                    </div>
                )}
                <details style={{ fontSize: 11, color: textMuted }}>
                    <summary style={{ cursor: 'pointer' }}>Raw diagram source</summary>
                    <pre style={{
                        background: isDark ? '#0b1220' : '#f8fafc', borderRadius: 6,
                        padding: '8px 10px', fontSize: 11, fontFamily: 'Fira Code, monospace',
                        maxHeight: 180, overflow: 'auto', marginTop: 6,
                        color: isDark ? '#94a3b8' : '#475569', whiteSpace: 'pre-wrap',
                    }}>{chart}</pre>
                </details>
            </div>
        );
    }

    if (!svgContent) {
        return (
            <div style={{
                background: surfaceBg, border: `1px solid ${borderCol}`,
                borderRadius: 10, padding: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                color: textMuted, fontSize: 12,
            }}>
                <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid var(--primary)', borderTopColor: 'transparent',
                    animation: 'spin 0.8s linear infinite',
                }} />
                Rendering diagram…
            </div>
        );
    }

    return (
        <div style={{ background: surfaceBg, border: `1px solid ${borderCol}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 12px',
                background: isDark ? 'rgba(11,18,32,0.6)' : 'rgba(241,245,249,0.8)',
                borderBottom: `1px solid ${borderCol}`,
            }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: textMuted, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    Logic Flow Diagram
                </span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[
                        { Icon: ZoomOut,   action: handleZoomOut, title: 'Zoom out' },
                        { Icon: RotateCcw, action: handleReset,   title: 'Reset zoom' },
                        { Icon: ZoomIn,    action: handleZoomIn,  title: 'Zoom in' },
                    ].map(({ Icon, action, title }) => (
                        <button key={title} onClick={action} title={title} style={{
                            background: 'transparent', border: `1px solid ${borderCol}`,
                            color: textMuted, borderRadius: 5, width: 24, height: 24,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                        }}>
                            <Icon size={11} />
                        </button>
                    ))}
                    <span style={{ fontSize: 10, color: textMuted, padding: '0 4px', lineHeight: '24px' }}>
                        {Math.round(zoom * 100)}%
                    </span>
                </div>
            </div>
            <div ref={containerRef} style={{ overflow: 'auto', padding: 16, minHeight: 120, maxHeight: 400 }}>
                <div
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease', display: 'flex', justifyContent: 'center' }}
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                />
            </div>
        </div>
    );
};

export default MermaidRenderer;
