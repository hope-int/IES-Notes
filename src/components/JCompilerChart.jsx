import { useEffect, useRef, useState, useCallback } from 'react';

const CHARTJS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';

let _chartJsLoaded = false;
let _chartJsPromise = null;

function loadChartJs() {
    if (_chartJsLoaded) return Promise.resolve(window.Chart);
    if (_chartJsPromise) return _chartJsPromise;
    _chartJsPromise = new Promise((resolve, reject) => {
        const existing = document.getElementById('chartjs-cdn');
        if (existing) {
            existing.addEventListener('load', () => { _chartJsLoaded = true; resolve(window.Chart); });
            return;
        }
        const script = document.createElement('script');
        script.id = 'chartjs-cdn';
        script.src = CHARTJS_CDN;
        script.onload = () => { _chartJsLoaded = true; resolve(window.Chart); };
        script.onerror = () => reject(new Error('Failed to load Chart.js from CDN'));
        document.head.appendChild(script);
    });
    return _chartJsPromise;
}

function applyDarkTheme(spec) {
    const merged = JSON.parse(JSON.stringify(spec));
    const darkColor = '#94a3b8';
    const gridColor = 'rgba(148,163,184,0.12)';

    merged.options = merged.options || {};
    merged.options.responsive = true;
    merged.options.maintainAspectRatio = false;
    merged.options.animation = { duration: 600, easing: 'easeInOutQuart' };

    merged.options.plugins = merged.options.plugins || {};
    merged.options.plugins.legend = {
        display: true,
        labels: { color: darkColor, font: { family: 'Inter, sans-serif', size: 12 } },
        ...(merged.options.plugins.legend || {}),
    };
    if (merged.options.plugins.title) {
        merged.options.plugins.title.color = '#e2e8f0';
        merged.options.plugins.title.font = { size: 14, weight: 'bold', family: 'Inter, sans-serif' };
    }

    const noPolar = ['pie', 'doughnut', 'polarArea', 'radar'];
    if (!noPolar.includes(merged.type)) {
        merged.options.scales = merged.options.scales || {};
        ['x', 'y'].forEach(axis => {
            merged.options.scales[axis] = {
                ...(merged.options.scales[axis] || {}),
                ticks: { color: darkColor, font: { family: 'Inter, sans-serif' } },
                grid: { color: gridColor },
            };
            if (merged.options.scales[axis]?.title) {
                merged.options.scales[axis].title.color = darkColor;
                merged.options.scales[axis].title.font = { family: 'Inter, sans-serif' };
            }
        });
    }

    const palette = ['#6c63ff','#ff6b6b','#00cec9','#fdcb6e','#e17055','#74b9ff','#a29bfe','#55efc4'];
    if (merged.data?.datasets) {
        merged.data.datasets = merged.data.datasets.map((ds, i) => ({
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            ...ds,
            borderColor: ds.borderColor || palette[i % palette.length],
            backgroundColor: ds.backgroundColor || (
                merged.type === 'line' ? `${palette[i % palette.length]}26`
                : merged.type === 'bar'  ? `${palette[i % palette.length]}cc`
                : palette[i % palette.length]
            ),
        }));
    }
    return merged;
}

export default function JCompilerChart({ chartSpec }) {
    const canvasRef = useRef(null);
    const chartRef  = useRef(null);
    const [status, setStatus] = useState('idle');
    const [errMsg, setErrMsg] = useState('');

    const renderChart = useCallback(async (spec) => {
        setStatus('loading');
        setErrMsg('');
        try {
            const Chart = await loadChartJs();
            if (!canvasRef.current) return;
            if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
            const finalSpec = applyDarkTheme(spec);
            chartRef.current = new Chart(canvasRef.current, {
                type: finalSpec.type,
                data: finalSpec.data,
                options: finalSpec.options,
            });
            setStatus('ready');
        } catch (err) {
            console.error('[JCompilerChart] Error:', err);
            setErrMsg(err.message || 'Unknown error');
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        if (!chartSpec) return;
        renderChart(chartSpec);
        return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
    }, [chartSpec, renderChart]);

    if (!chartSpec) {
        return (
            <div style={styles.empty}>
                <div style={styles.emptyIcon}>📊</div>
                <p style={styles.emptyText}>No chart detected</p>
                <p style={styles.emptyHint}>Run code that uses matplotlib, seaborn, plotly, ggplot, or any plotting library — J-Compiler will render the chart here.</p>
            </div>
        );
    }

    return (
        <div style={styles.wrapper}>
            {status === 'loading' && (
                <div style={styles.overlay}>
                    <div style={styles.spinner} />
                    <span style={styles.loadingText}>Rendering chart…</span>
                </div>
            )}
            {status === 'error' && (
                <div style={styles.errorBox}>
                    <span>⚠️</span>
                    <span>Chart render failed: {errMsg}</span>
                </div>
            )}
            <div style={{ ...styles.canvasWrap, opacity: status === 'loading' ? 0 : 1 }}>
                {chartSpec.title && <h3 style={styles.chartTitle}>{chartSpec.title}</h3>}
                <div style={styles.canvasContainer}>
                    <canvas ref={canvasRef} />
                </div>
                <div style={styles.chartMeta}>
                    <span style={styles.badge}>{(chartSpec.type || 'chart').toUpperCase()}</span>
                    {chartSpec.data?.datasets?.length > 0 && (
                        <span style={styles.datasetCount}>{chartSpec.data.datasets.length} dataset{chartSpec.data.datasets.length !== 1 ? 's' : ''}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

const styles = {
    wrapper: { position: 'relative', width: '100%', height: 300, display: 'flex', flexDirection: 'column', background: '#0f1117', borderRadius: 8, overflow: 'hidden' },
    overlay: { position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f1117', gap: 12 },
    spinner: { width: 36, height: 36, border: '3px solid #1e293b', borderTopColor: '#6c63ff', borderRadius: '50%', animation: 'jc-spin 0.8s linear infinite' },
    loadingText: { color: '#94a3b8', fontSize: 13, fontFamily: 'Inter, sans-serif' },
    errorBox: { margin: 'auto', display: 'flex', alignItems: 'center', gap: 10, color: '#ff6b6b', fontFamily: 'Inter, sans-serif', fontSize: 13, padding: 16 },
    canvasWrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 16px 8px', transition: 'opacity 0.3s' },
    chartTitle: { margin: '0 0 12px', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, textAlign: 'center' },
    canvasContainer: { flex: 1, position: 'relative', minHeight: 0 },
    chartMeta: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 0' },
    badge: { background: '#6c63ff22', color: '#6c63ff', border: '1px solid #6c63ff44', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 },
    datasetCount: { color: '#475569', fontSize: 11, fontFamily: 'Inter, sans-serif' },
    empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, textAlign: 'center' },
    emptyIcon: { fontSize: 36, opacity: 0.4 },
    emptyText: { color: '#475569', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, margin: 0 },
    emptyHint: { color: '#334155', fontFamily: 'Inter, sans-serif', fontSize: 12, margin: 0, maxWidth: 320, lineHeight: 1.6 },
};
