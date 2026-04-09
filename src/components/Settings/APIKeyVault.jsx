import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Key, Eye, EyeOff, ChevronUp, ChevronDown,
    Check, AlertCircle, Loader, ExternalLink, Shield,
    Info, ToggleLeft, ToggleRight, Save, RefreshCw, AlertTriangle
} from 'lucide-react';
import {
    loadVaultSettings, saveVaultSettings, testApiKey,
    refreshVault, getOwnerId, DEFAULT_SETTINGS, PROVIDER_MODELS
} from '../../utils/keyVault';

// ─── Badge colors ─────────────────────────────────────────────────────────────
const BADGE = {
    free:    { bg: '#dcfce7', color: '#166534', label: 'Free' },
    paid:    { bg: '#fef9c3', color: '#854d0e', label: 'Paid' },
    default: { bg: '#f1f5f9', color: '#475569', label: 'Default' },
};

const ACCENT = {
    puter:      { bg: '#eef2ff', border: '#a5b4fc', text: '#4338ca' },
    openrouter: { bg: '#fffbeb', border: '#fcd34d', text: '#b45309' },
    groq:       { bg: '#f0fdf4', border: '#6ee7b7', text: '#065f46' },
    gemini:     { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
};

// ─────────────────────────────────────────────────────────────────────────────
export default function APIKeyVault({ isOpen, onClose }) {
    const [settings,      setSettings]      = useState(null);
    const [loading,       setLoading]       = useState(true);
    const [saving,        setSaving]        = useState(false);
    const [saved,         setSaved]         = useState(false);
    const [ownerInfo,     setOwnerInfo]     = useState({ isAuth: false });
    const [showKeys,      setShowKeys]      = useState({});
    const [testStatus,    setTestStatus]    = useState({});  // idle|testing|ok|fail
    const [dirty,         setDirty]         = useState(false);
    const [validationErr, setValidationErr] = useState(null);

    // Lock body scroll when open
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Load on open
    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        setDirty(false);
        setSaved(false);
        setValidationErr(null);
        Promise.all([loadVaultSettings(), getOwnerId()])
            .then(([s, owner]) => {
                setSettings(JSON.parse(JSON.stringify(s)));
                setOwnerInfo(owner);
                // Pre-mark providers that already have a saved key as verified.
                // This prevents blocking re-saves when only model/order changed.
                const preVerified = {};
                (s.providers || []).forEach(p => {
                    if (p.keyRequired && p.key?.trim()) preVerified[p.id] = 'ok';
                });
                setTestStatus(preVerified);
                setLoading(false);
            });
    }, [isOpen]);

    const updateProvider = useCallback((id, field, value) => {
        setSettings(prev => ({
            ...prev,
            providers: prev.providers.map(p =>
                p.id === id ? { ...p, [field]: value } : p
            )
        }));
        setDirty(true);
        setSaved(false);
        setValidationErr(null);
        // Reset test status when key changes
        if (field === 'key') setTestStatus(prev => ({ ...prev, [id]: 'idle' }));
    }, []);

    const moveProvider = (id, dir) => {
        setSettings(prev => {
            const sorted = [...prev.providers].sort((a, b) => a.order - b.order);
            const idx    = sorted.findIndex(p => p.id === id);
            const swap   = idx + dir;
            if (swap < 0 || swap >= sorted.length) return prev;
            const updated = sorted.map((p, i) => {
                if (i === idx)  return { ...p, order: sorted[swap].order };
                if (i === swap) return { ...p, order: sorted[idx].order };
                return p;
            });
            return { ...prev, providers: updated };
        });
        setDirty(true);
    };

    const handleTest = async (provider) => {
        const key = provider.key?.trim();
        if (!key) return;
        setTestStatus(p => ({ ...p, [provider.id]: 'testing' }));
        const ok = await testApiKey(provider.id, key);
        setTestStatus(p => ({ ...p, [provider.id]: ok ? 'ok' : 'fail' }));
    };

    // ── Save with full validation ─────────────────────────────────────────────
    const handleSave = async () => {
        setValidationErr(null);

        // 1. Enabled + key-required + NO key → must add a key or disable the provider
        const enabledNoKey = (settings.providers || []).filter(
            p => p.enabled && p.keyRequired && !p.key?.trim()
        );
        if (enabledNoKey.length > 0) {
            setValidationErr(
                `${enabledNoKey.map(p => p.name).join(', ')} ${enabledNoKey.length > 1 ? 'require' : 'requires'} an API key. Add a key or disable the provider.`
            );
            return;
        }

        // 2. Enabled + key-required + key filled → MUST be tested and confirmed valid
        const needsVerification = (settings.providers || []).filter(p =>
            p.enabled && p.keyRequired && p.key?.trim() && testStatus[p.id] !== 'ok'
        );
        if (needsVerification.length > 0) {
            setValidationErr(
                `Please test & verify: ${needsVerification.map(p => p.name).join(', ')}`
            );
            return;
        }

        // 3. Cannot disable Puter without at least one verified API key
        const puterEnabled = settings.providers.find(p => p.id === 'puter')?.enabled;
        const hasVerifiedKey = settings.providers.some(
            p => p.keyRequired && p.key?.trim() && testStatus[p.id] === 'ok'
        );
        if (!puterEnabled && !hasVerifiedKey) {
            setValidationErr(
                'You must keep Puter enabled (free) OR add a valid key for OpenRouter, Groq, or Gemini.'
            );
            return;
        }

        setSaving(true);
        try {
            await saveVaultSettings(settings);
            await refreshVault();
            setSaved(true);
            setDirty(false);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            console.error(e);
            setValidationErr('Save failed. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
        setTestStatus({});
        setDirty(true);
        setSaved(false);
        setValidationErr(null);
    };

    // ── Derived state ─────────────────────────────────────────────────────────
    const sorted = settings
        ? [...settings.providers].sort((a, b) => a.order - b.order)
        : [];

    // Save button is disabled if there's a key that needs testing
    const hasUntestedKey = (settings?.providers || []).some(
        p => p.enabled && p.keyRequired && p.key?.trim() && testStatus[p.id] !== 'ok'
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="vb"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'rgba(2,6,23,0.6)',
                            backdropFilter: 'blur(8px)',
                            zIndex: 1050,
                        }}
                    />

                    {/* Panel */}
                    <motion.div
                        key="vp"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 360 }}
                        onClick={e => e.stopPropagation()}
                        className="vault-panel"
                        style={{
                            position: 'fixed',
                            zIndex: 1060,
                            bottom: 0, left: 0, right: 0,
                            maxHeight: '92dvh',
                            borderRadius: '20px 20px 0 0',
                            display: 'flex', flexDirection: 'column',
                            background: '#fff',
                            boxShadow: '0 -4px 60px rgba(0,0,0,0.18)',
                        }}
                    >
                        {/* ── Header ── */}
                        <div style={{
                            padding: '16px 20px 14px',
                            borderBottom: '1px solid #f1f5f9',
                            background: 'linear-gradient(135deg,#f8faff,#eef2ff)',
                            borderRadius: '20px 20px 0 0',
                            display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
                        }}>
                            <div style={{
                                position: 'absolute', top: 8, left: '50%',
                                transform: 'translateX(-50%)',
                                width: 36, height: 4, borderRadius: 9, background: '#cbd5e1',
                            }} className="d-md-none" />
                            <div style={{ padding: 8, borderRadius: 10, background: '#e0e7ff', color: '#4338ca', display: 'flex', flexShrink: 0 }}>
                                <Key size={18} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>AI Provider Settings</div>
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Your keys · Your models · Your cost</div>
                            </div>
                            <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 999, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#475569' }}>
                                <X size={15} />
                            </button>
                        </div>

                        {/* ── Anon warning ── */}
                        {!loading && !ownerInfo.isAuth && (
                            <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fcd34d' }}>
                                    <Info size={14} style={{ flexShrink: 0, color: '#d97706', marginTop: 1 }} />
                                    <p style={{ fontSize: 12, color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                                        <strong>Not logged in</strong> — keys are tied to this browser session.
                                        <strong> Log in</strong> to recover your settings from any device.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── Validation error banner ── */}
                        <AnimatePresence>
                            {validationErr && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    style={{ padding: '8px 16px 0', flexShrink: 0, overflow: 'hidden' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5' }}>
                                        <AlertTriangle size={14} style={{ flexShrink: 0, color: '#dc2626' }} />
                                        <p style={{ fontSize: 12, color: '#991b1b', margin: 0, lineHeight: 1.5 }}>{validationErr}</p>
                                        <button onClick={() => setValidationErr(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, marginLeft: 'auto', flexShrink: 0 }}>
                                            <X size={13} />
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ── Scrollable body ── */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <Loader size={26} style={{ color: '#6366f1' }} className="animate-spin" />
                                    <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>Decrypting your settings…</p>
                                </div>
                            ) : (
                                <>
                                    <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                                        ↕ Reorder providers — the app tries them top-to-bottom.
                                        <strong> Puter</strong> is always free (no key needed).
                                    </p>

                                    {sorted.map((prov, idx) => {
                                        const ac      = ACCENT[prov.id] || ACCENT.puter;
                                        const ts      = testStatus[prov.id];
                                        const kv      = showKeys[prov.id];
                                        const models  = PROVIDER_MODELS[prov.id] || [];
                                        const isLast  = idx === sorted.length - 1;
                                        const hasKey  = !!prov.key?.trim();
                                        const keyOk   = ts === 'ok';
                                        const keyFail = ts === 'fail';
                                        const needsTest = hasKey && !keyOk;

                                        return (
                                            <div key={prov.id} style={{
                                                borderRadius: 14,
                                                border: `1.5px solid ${prov.enabled ? (needsTest ? '#f59e0b' : ac.border) : '#e2e8f0'}`,
                                                overflow: 'hidden',
                                                opacity: prov.enabled ? 1 : 0.5,
                                                transition: 'opacity .2s, border-color .2s',
                                                background: '#fff',
                                            }}>
                                                {/* Card header */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: prov.enabled ? ac.bg : '#f8fafc' }}>
                                                    {/* Order arrows */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                                                        {[[-1, ChevronUp], [1, ChevronDown]].map(([d, Icon]) => (
                                                            <button key={d} onClick={() => moveProvider(prov.id, d)}
                                                                disabled={(d === -1 && idx === 0) || (d === 1 && isLast)}
                                                                style={{ width: 24, height: 24, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', opacity: ((d === -1 && idx === 0) || (d === 1 && isLast)) ? 0.3 : 1 }}>
                                                                <Icon size={12} />
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <span style={{ fontSize: 20, flexShrink: 0 }}>{prov.icon}</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{prov.name}</div>
                                                        <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prov.description}</div>
                                                    </div>

                                                    {/* Key verified badge when OK */}
                                                    {keyOk && prov.enabled && (
                                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#dcfce7', color: '#166534', border: '1px solid #86efac', flexShrink: 0 }}>
                                                            ✓ Verified
                                                        </span>
                                                    )}
                                                    {needsTest && prov.enabled && (
                                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d', flexShrink: 0 }}>
                                                            Test required
                                                        </span>
                                                    )}

                                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: ac.bg, color: ac.text, border: `1px solid ${ac.border}`, flexShrink: 0 }}>#{idx + 1}</span>

                                                    <button onClick={() => updateProvider(prov.id, 'enabled', !prov.enabled)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                                                        {prov.enabled ? <ToggleRight size={26} style={{ color: ac.text }} /> : <ToggleLeft size={26} style={{ color: '#94a3b8' }} />}
                                                    </button>
                                                </div>

                                                {/* Expanded section */}
                                                {prov.enabled && (
                                                    <div style={{ background: '#fff', padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                                                        {/* API Key */}
                                                        {prov.keyRequired && (
                                                            <div>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                                    <label style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                                                                        API Key {hasKey && !keyOk && <span style={{ color: '#d97706' }}>— not verified</span>}
                                                                        {keyFail && <span style={{ color: '#dc2626' }}>— invalid</span>}
                                                                    </label>
                                                                    <a href={prov.helpUrl} target="_blank" rel="noreferrer"
                                                                        style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                        Get free key <ExternalLink size={10} />
                                                                    </a>
                                                                </div>

                                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                                    <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
                                                                        <input
                                                                            type={kv ? 'text' : 'password'}
                                                                            autoComplete="off"
                                                                            placeholder={`Paste your ${prov.name} key…`}
                                                                            value={prov.key || ''}
                                                                            onChange={e => updateProvider(prov.id, 'key', e.target.value)}
                                                                            style={{
                                                                                width: '100%', boxSizing: 'border-box',
                                                                                paddingRight: 34, paddingLeft: 10,
                                                                                height: 36, fontSize: 12,
                                                                                fontFamily: 'monospace',
                                                                                border: `1.5px solid ${keyFail ? '#fca5a5' : needsTest ? '#fcd34d' : keyOk ? '#86efac' : '#e2e8f0'}`,
                                                                                borderRadius: 8, background: '#f8fafc',
                                                                                outline: 'none', color: '#0f172a',
                                                                            }}
                                                                        />
                                                                        <button tabIndex={-1} onClick={() => setShowKeys(p => ({ ...p, [prov.id]: !p[prov.id] }))}
                                                                            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex', alignItems: 'center' }}>
                                                                            {kv ? <EyeOff size={14} /> : <Eye size={14} />}
                                                                        </button>
                                                                    </div>

                                                                    {/* Test button */}
                                                                    <button
                                                                        onClick={() => handleTest(prov)}
                                                                        disabled={!hasKey || ts === 'testing'}
                                                                        style={{
                                                                            height: 36, padding: '0 14px', borderRadius: 8,
                                                                            fontSize: 12, fontWeight: 700, flexShrink: 0,
                                                                            cursor: (!hasKey || ts === 'testing') ? 'not-allowed' : 'pointer',
                                                                            display: 'flex', alignItems: 'center', gap: 5,
                                                                            border: '1.5px solid',
                                                                            background: keyOk ? '#dcfce7' : keyFail ? '#fee2e2' : '#f1f5f9',
                                                                            color:      keyOk ? '#166534' : keyFail ? '#991b1b' : '#475569',
                                                                            borderColor: keyOk ? '#86efac' : keyFail ? '#fca5a5' : '#e2e8f0',
                                                                            opacity: !hasKey ? 0.4 : 1,
                                                                        }}>
                                                                        {ts === 'testing' && <Loader size={12} className="animate-spin" />}
                                                                        {keyOk  && <Check size={12} />}
                                                                        {keyFail && <AlertCircle size={12} />}
                                                                        {keyOk ? 'Valid' : keyFail ? 'Invalid' : 'Test Key'}
                                                                    </button>
                                                                </div>

                                                                {/* Contextual hints */}
                                                                {!hasKey && (
                                                                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '5px 0 0' }}>
                                                                        No key — this provider will be skipped unless a key is added.
                                                                    </p>
                                                                )}
                                                                {needsTest && !keyFail && (
                                                                    <p style={{ fontSize: 11, color: '#b45309', margin: '5px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                        <AlertTriangle size={11} /> Click <strong>Test Key</strong> to verify before saving.
                                                                    </p>
                                                                )}
                                                                {keyFail && (
                                                                    <p style={{ fontSize: 11, color: '#dc2626', margin: '5px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                        <AlertCircle size={11} /> Key is invalid or expired. Please check and re-paste it.
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Model selector */}
                                                        {models.length > 0 && (
                                                            <div>
                                                                <label style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.6px', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                                                                    Model
                                                                </label>
                                                                <select value={prov.selectedModel || ''}
                                                                    onChange={e => updateProvider(prov.id, 'selectedModel', e.target.value || null)}
                                                                    style={{ width: '100%', height: 34, padding: '0 10px', fontSize: 12, border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#0f172a', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                                                                    {models.map(m => (
                                                                        <option key={m.value ?? '__def__'} value={m.value ?? ''}>
                                                                            {m.badge === 'free' ? '🟢 ' : m.badge === 'paid' ? '🟡 ' : '⚪ '}
                                                                            {m.label}{m.badge !== 'default' ? ` (${BADGE[m.badge].label})` : ''}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {prov.selectedModel && (
                                                                    <div style={{ marginTop: 5, fontSize: 11, color: ac.text, background: ac.bg, border: `1px solid ${ac.border}`, borderRadius: 6, padding: '4px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        ✓ Using: <strong>{prov.selectedModel}</strong>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Security note */}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                                        <Shield size={13} style={{ color: '#0369a1', flexShrink: 0, marginTop: 1 }} />
                                        <p style={{ fontSize: 11, color: '#0369a1', margin: 0, lineHeight: 1.5 }}>
                                            Keys are <strong>AES-256-GCM encrypted</strong> in your browser before leaving your device.
                                            The server stores only the encrypted ciphertext — your plain key is never transmitted.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* ── Footer ── */}
                        {!loading && (
                            <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                                <button onClick={handleReset}
                                    style={{ height: 36, padding: '0 14px', fontSize: 12, borderRadius: 8, fontWeight: 600, background: '#fff', color: '#64748b', border: '1.5px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <RefreshCw size={13} /> Reset
                                </button>

                                {hasUntestedKey && (
                                    <p style={{ fontSize: 11, color: '#b45309', margin: 0, flex: '1 1 100px', textAlign: 'center' }}>
                                        ⚠️ Test all keys first
                                    </p>
                                )}

                                <button onClick={handleSave} disabled={saving || !dirty || hasUntestedKey}
                                    style={{
                                        height: 36, padding: '0 20px', fontSize: 13, borderRadius: 8, fontWeight: 700,
                                        background: saved ? '#dcfce7' : hasUntestedKey ? '#e2e8f0' : '#6366f1',
                                        color: saved ? '#166534' : hasUntestedKey ? '#94a3b8' : '#fff',
                                        border: 'none', cursor: (saving || !dirty || hasUntestedKey) ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 7,
                                        opacity: (saving || !dirty) ? 0.7 : 1,
                                        transition: 'background .3s, color .3s',
                                    }}>
                                    {saving ? <><Loader size={14} className="animate-spin" /> Saving…</>
                                    : saved  ? <><Check size={14} /> Saved!</>
                                    :           <><Save size={14} /> Save Settings</>}
                                </button>
                            </div>
                        )}
                    </motion.div>

                    {/* Responsive override */}
                    <style>{`
                        @keyframes spin { to { transform: rotate(360deg); } }
                        .animate-spin { animation: spin 0.9s linear infinite; }
                        @media (min-width: 640px) {
                            .vault-panel {
                                bottom: auto !important; left: 50% !important;
                                right: auto !important; top: 50% !important;
                                transform: translate(-50%, -50%) !important;
                                width: 540px !important;
                                max-width: calc(100vw - 32px) !important;
                                max-height: 88dvh !important;
                                border-radius: 20px !important;
                                box-shadow: 0 24px 80px rgba(0,0,0,0.22) !important;
                            }
                        }
                    `}</style>
                </>
            )}
        </AnimatePresence>
    );
}
