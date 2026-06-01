import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Activity, Cpu, RefreshCw, AlertCircle, 
    Coins, Clock, Sparkles, ChevronRight, HelpCircle
} from 'lucide-react';
import { getPuterAuthState } from '../../utils/puterInit';

const Motion = motion;

export default function PuterUsageWidget() {
    const [usageData, setUsageData] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hoveredCell, setHoveredCell] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const authState = getPuterAuthState();

    const fetchBalanceAndUsage = async () => {
        setIsRefreshing(true);
        try {
            if (window.puter && window.puter.auth && !authState.isGuest) {
                try {
                    const usage = await window.puter.auth.getMonthlyUsage();
                    if (usage && usage.allowanceInfo) {
                        setUsageData({
                            allowance: usage.allowanceInfo.monthUsageAllowance || 0,
                            remaining: usage.allowanceInfo.remaining || 0,
                            used: (usage.allowanceInfo.monthUsageAllowance || 0) - (usage.allowanceInfo.remaining || 0)
                        });
                        setError(null);
                    } else {
                        throw new Error("No allowanceInfo in Puter usage data");
                    }
                } catch (err) {
                    console.warn("Puter balance API failed, using mock profile data:", err);
                    loadMockData();
                }
            } else {
                loadMockData();
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const loadMockData = () => {
        // Mock data when in guest mode or API fails
        setUsageData({
            allowance: 100000000, // $1.0000 (100,000,000 microcents)
            remaining: 85200000,  // $0.8520
            used: 14800000        // $0.1480
        });
        setError(null);
    };

    const loadLocalLogs = () => {
        try {
            const logsStr = localStorage.getItem('hope_puter_usage_history') || '[]';
            let logs = JSON.parse(logsStr);
            if (!Array.isArray(logs)) logs = [];
            setHistory(logs);
        } catch (e) {
            console.error("Failed to load Puter usage history:", e);
        }
    };

    useEffect(() => {
        fetchBalanceAndUsage();
        loadLocalLogs();

        // Listen for new usage events to sync immediately
        const handleUsageUpdated = () => {
            loadLocalLogs();
            fetchBalanceAndUsage();
        };

        window.addEventListener('hope_puter_usage_updated', handleUsageUpdated);
        return () => {
            window.removeEventListener('hope_puter_usage_updated', handleUsageUpdated);
        };
    }, []);

    // Get stats from last 30 days history
    const totalCalls = history.length;
    const avgLatency = totalCalls > 0 
        ? Math.round(history.reduce((sum, h) => sum + (h.latency || 0), 0) / totalCalls)
        : 0;

    // Heatmap Calculation (Last 28 Days)
    const getHeatmapGrid = () => {
        const grid = [];
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        // Map logs into an object keyed by "YYYY-MM-DD"
        const countMap = {};
        history.forEach(log => {
            const dateStr = new Date(log.timestamp).toISOString().split('T')[0];
            countMap[dateStr] = (countMap[dateStr] || 0) + 1;
        });

        // Generate 28 cells (4 columns of 7 days, ending today)
        // Let's create an array of 28 days
        for (let i = 27; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const count = countMap[dateStr] || 0;
            grid.push({
                date: date,
                dateStr: dateStr,
                count: count
            });
        }
        return grid;
    };

    const heatmapCells = getHeatmapGrid();

    // Group heatmap into columns of 7 days (weeks) for rendering
    const heatmapWeeks = [];
    for (let i = 0; i < heatmapCells.length; i += 7) {
        heatmapWeeks.push(heatmapCells.slice(i, i + 7));
    }

    // Helper to get color density class
    const getDensityColor = (count) => {
        if (count === 0) return 'var(--cell-bg-empty, rgba(226, 232, 240, 0.3))';
        if (count <= 2) return 'rgba(37, 99, 235, 0.2)';   // Soft blue accent
        if (count <= 5) return 'rgba(37, 99, 235, 0.4)';   // Medium blue
        if (count <= 9) return 'rgba(37, 99, 235, 0.7)';   // Deep blue
        return 'rgba(37, 99, 235, 1.0)';                    // Neon blue intensity
    };

    // Format microcents to readable USD
    const formatUSD = (microcents) => {
        return `$${(microcents / 100000000).toFixed(4)}`;
    };

    const percentageUsed = usageData && usageData.allowance > 0 
        ? Math.min(100, Math.round((usageData.used / usageData.allowance) * 100))
        : 0;

    return (
        <div className="clay-card no-hover p-4 overflow-hidden position-relative h-100 d-flex flex-column" style={{ minHeight: '420px' }}>
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div className="d-flex align-items-center gap-2">
                    <div className="p-2 rounded-circle bg-primary bg-opacity-10 text-primary">
                        <Activity size={18} />
                    </div>
                    <div>
                        <h5 className="fw-bold mb-0 text-dark">Puter API Insights</h5>
                        <p className="small text-muted mb-0">Resource allocation & analytics</p>
                    </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                    {authState.isGuest && (
                        <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-20 rounded-pill px-2 py-1" style={{ fontSize: '0.75rem' }}>
                            Guest Mock Mode
                        </span>
                    )}
                    <button 
                        onClick={fetchBalanceAndUsage} 
                        disabled={isRefreshing}
                        className="btn btn-link text-muted p-1 hover-scale d-flex align-items-center"
                        title="Refresh metrics"
                    >
                        <RefreshCw size={16} className={`${isRefreshing ? 'spin-anim' : ''}`} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center py-5">
                    <RefreshCw size={32} className="text-primary spin-anim mb-2" />
                    <span className="text-muted small">Loading usage data...</span>
                </div>
            ) : error ? (
                <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-center py-5">
                    <AlertCircle size={32} className="text-danger mb-2" />
                    <span className="text-dark fw-bold">Failed to load statistics</span>
                    <span className="text-muted small mt-1">{error}</span>
                </div>
            ) : (
                <div className="d-flex flex-column flex-grow-1 justify-content-between">
                    
                    {/* Upper Section: Progress & Balance details */}
                    <div className="row g-3 align-items-center mb-4">
                        <div className="col-12 col-sm-5 d-flex justify-content-center justify-content-sm-start">
                            {/* Circular visual progress meter */}
                            <div className="position-relative d-flex align-items-center justify-content-center" style={{ width: 110, height: 110 }}>
                                <svg width="110" height="110" className="transform -rotate-90">
                                    <circle 
                                        cx="55" 
                                        cy="55" 
                                        r="45" 
                                        fill="transparent" 
                                        stroke="var(--cell-bg-empty, rgba(226, 232, 240, 0.5))" 
                                        strokeWidth="8"
                                    />
                                    <circle 
                                        cx="55" 
                                        cy="55" 
                                        r="45" 
                                        fill="transparent" 
                                        stroke="var(--primary-accent, #2563eb)" 
                                        strokeWidth="8"
                                        strokeDasharray={`${2 * Math.PI * 45}`}
                                        strokeDashoffset={`${2 * Math.PI * 45 * (1 - percentageUsed / 100)}`}
                                        strokeLinecap="round"
                                        style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                                    />
                                </svg>
                                <div className="position-absolute d-flex flex-column align-items-center justify-content-center">
                                    <span className="fw-extrabold fs-4 text-dark lh-1">{percentageUsed}%</span>
                                    <span className="text-muted lh-1 mt-1" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700 }}>Used</span>
                                </div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-7">
                            <div className="d-flex flex-column gap-2">
                                <div className="d-flex justify-content-between align-items-center pb-2 border-bottom border-secondary border-opacity-10">
                                    <span className="small text-muted d-flex align-items-center gap-1">
                                        <Coins size={14} className="text-success" /> Remaining
                                    </span>
                                    <span className="fw-bold text-success font-monospace">{formatUSD(usageData.remaining)}</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center pb-2 border-bottom border-secondary border-opacity-10">
                                    <span className="small text-muted d-flex align-items-center gap-1">
                                        <Activity size={14} className="text-danger" /> Spent
                                    </span>
                                    <span className="fw-bold text-danger font-monospace">{formatUSD(usageData.used)}</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center">
                                    <span className="small text-muted d-flex align-items-center gap-1">
                                        <Sparkles size={14} className="text-primary" /> Allowance
                                    </span>
                                    <span className="fw-bold text-dark font-monospace">{formatUSD(usageData.allowance)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Middle Section: Heatmap */}
                    <div className="mb-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="small fw-bold text-secondary">Usage Heatmap (Last 4 Weeks)</span>
                            <span className="small text-muted" style={{ fontSize: '0.75rem' }}>{totalCalls} calls tracked</span>
                        </div>

                        <div className="p-3 rounded-3 bg-light border border-secondary border-opacity-10 position-relative">
                            <div className="d-flex gap-2 justify-content-between">
                                {/* Weekday Labels */}
                                <div className="d-flex flex-column justify-content-between text-muted font-monospace" style={{ fontSize: '0.6rem', height: '90px', padding: '2px 0' }}>
                                    <span>S</span>
                                    <span>M</span>
                                    <span>T</span>
                                    <span>W</span>
                                    <span>T</span>
                                    <span>F</span>
                                    <span>S</span>
                                </div>

                                {/* Heatmap Grid */}
                                <div className="d-flex gap-1 flex-grow-1 justify-content-end align-items-center" style={{ height: '90px' }}>
                                    {heatmapWeeks.map((week, wIdx) => (
                                        <div key={wIdx} className="d-flex flex-column gap-1 h-100 justify-content-between">
                                            {week.map((cell, cIdx) => (
                                                <div
                                                    key={cIdx}
                                                    onMouseEnter={() => setHoveredCell(cell)}
                                                    onMouseLeave={() => setHoveredCell(null)}
                                                    className="rounded-1 cursor-pointer transition-all hover-scale"
                                                    style={{ 
                                                        width: '11px', 
                                                        height: '11px', 
                                                        backgroundColor: getDensityColor(cell.count),
                                                        border: hoveredCell?.dateStr === cell.dateStr ? '1px solid var(--text-main)' : 'none',
                                                        boxShadow: cell.count >= 10 ? '0 0 4px rgba(37, 99, 235, 0.6)' : 'none'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Live Tooltip inside the box to preserve clean UI boundaries */}
                            <div style={{ height: '18px' }} className="mt-2 d-flex align-items-center justify-content-center text-center">
                                <AnimatePresence mode="wait">
                                    {hoveredCell ? (
                                        <Motion.span 
                                            key={hoveredCell.dateStr}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            className="small fw-bold text-dark font-monospace"
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            {hoveredCell.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: {hoveredCell.count} API call{hoveredCell.count !== 1 ? 's' : ''}
                                        </Motion.span>
                                    ) : (
                                        <span className="text-muted small" style={{ fontSize: '0.7rem' }}>
                                            Hover over cells to see daily request breakdown
                                        </span>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Stats Grid */}
                    <div className="row g-2">
                        <div className="col-6">
                            <div className="p-2 rounded-3 bg-light border border-secondary border-opacity-10 d-flex align-items-center gap-2">
                                <Clock size={16} className="text-muted" />
                                <div className="overflow-hidden">
                                    <div className="small text-muted fw-bold text-uppercase" style={{ fontSize: '0.55rem' }}>Avg Latency</div>
                                    <div className="fw-bold text-dark text-truncate font-monospace" style={{ fontSize: '0.85rem' }}>
                                        {avgLatency > 0 ? `${(avgLatency / 1000).toFixed(2)}s` : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-6">
                            <div className="p-2 rounded-3 bg-light border border-secondary border-opacity-10 d-flex align-items-center gap-2">
                                <Cpu size={16} className="text-muted" />
                                <div className="overflow-hidden">
                                    <div className="small text-muted fw-bold text-uppercase" style={{ fontSize: '0.55rem' }}>Active Engine</div>
                                    <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.85rem' }}>
                                        GLM 4.5
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            )}

            <style>
                {`
                .spin-anim {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                :root {
                    --cell-bg-empty: rgba(226, 232, 240, 0.4);
                }
                .dark-mode {
                    --cell-bg-empty: rgba(51, 65, 85, 0.5);
                }
                `}
            </style>
        </div>
    );
}
