import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    X, Key, Eye, EyeOff, ChevronUp, ChevronDown,
    Check, AlertCircle, Loader, ExternalLink, Shield,
    Info, ToggleLeft, ToggleRight, Save, RefreshCw, AlertTriangle
} from 'lucide-react';
import {
    loadVaultSettings, saveVaultSettings, testApiKey,
    refreshVault, getOwnerId, DEFAULT_SETTINGS, PROVIDER_MODELS
} from '../../utils/keyVault';

const BADGE = {
    free: { label: 'Free' },
    paid: { label: 'Paid' },
    default: { label: 'Default' },
};

const ACCENT = {
    puter: { bg: 'var(--accent-puter-bg)', border: 'var(--accent-puter-border)', text: 'var(--accent-puter-text)' },
    openrouter: { bg: 'var(--accent-openrouter-bg)', border: 'var(--accent-openrouter-border)', text: 'var(--accent-openrouter-text)' },
    groq: { bg: 'var(--accent-groq-bg)', border: 'var(--accent-groq-border)', text: 'var(--accent-groq-text)' },
    gemini: { bg: 'var(--accent-gemini-bg)', border: 'var(--accent-gemini-border)', text: 'var(--accent-gemini-text)' },
};

const MotionAside = motion.aside;
const MotionDiv = motion.div;

export default function APIKeyVault({ isOpen, onClose }) {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [ownerInfo, setOwnerInfo] = useState({ isAuth: false });
    const [showKeys, setShowKeys] = useState({});
    const [testStatus, setTestStatus] = useState({});
    const [dirty, setDirty] = useState(false);
    const [validationErr, setValidationErr] = useState(null);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return undefined;

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setDirty(false);
            setSaved(false);
            setValidationErr(null);

            try {
                const [storedSettings, owner] = await Promise.all([loadVaultSettings(), getOwnerId()]);
                if (cancelled) return;

                const nextSettings = JSON.parse(JSON.stringify(storedSettings));
                const preVerified = {};
                (nextSettings.providers || []).forEach((provider) => {
                    if (provider.keyRequired && provider.key?.trim()) {
                        preVerified[provider.id] = 'ok';
                    }
                });

                setSettings(nextSettings);
                setOwnerInfo(owner);
                setTestStatus(preVerified);
            } catch (error) {
                console.error('[KeyVault] Failed to load vault settings:', error);
                if (!cancelled) {
                    setSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
                    setOwnerInfo({ isAuth: false });
                    setTestStatus({});
                    setValidationErr('Settings could not be loaded. Defaults are shown for this session.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    const updateProvider = useCallback((id, field, value) => {
        setSettings(prev => ({
            ...prev,
            providers: prev.providers.map(provider =>
                provider.id === id ? { ...provider, [field]: value } : provider
            )
        }));
        setDirty(true);
        setSaved(false);
        setValidationErr(null);
        if (field === 'key') setTestStatus(prev => ({ ...prev, [id]: 'idle' }));
    }, []);

    const moveProvider = (id, direction) => {
        setSettings(prev => {
            const sortedProviders = [...prev.providers].sort((a, b) => a.order - b.order);
            const index = sortedProviders.findIndex(provider => provider.id === id);
            const swapIndex = index + direction;

            if (swapIndex < 0 || swapIndex >= sortedProviders.length) return prev;

            const updated = sortedProviders.map((provider, currentIndex) => {
                if (currentIndex === index) return { ...provider, order: sortedProviders[swapIndex].order };
                if (currentIndex === swapIndex) return { ...provider, order: sortedProviders[index].order };
                return provider;
            });

            return { ...prev, providers: updated };
        });
        setDirty(true);
    };

    const handleTest = async (provider) => {
        const key = provider.key?.trim();
        if (!key) return;

        setTestStatus(prev => ({ ...prev, [provider.id]: 'testing' }));
        const ok = await testApiKey(provider.id, key);
        setTestStatus(prev => ({ ...prev, [provider.id]: ok ? 'ok' : 'fail' }));
    };

    const handleSave = async () => {
        setValidationErr(null);

        const enabledNoKey = (settings.providers || []).filter(
            provider => provider.enabled && provider.keyRequired && !provider.key?.trim()
        );
        if (enabledNoKey.length > 0) {
            setValidationErr(
                `${enabledNoKey.map(provider => provider.name).join(', ')} ${enabledNoKey.length > 1 ? 'require' : 'requires'} an API key. Add a key or disable the provider.`
            );
            return;
        }

        const needsVerification = (settings.providers || []).filter(provider =>
            provider.enabled && provider.keyRequired && provider.key?.trim() && testStatus[provider.id] !== 'ok'
        );
        if (needsVerification.length > 0) {
            setValidationErr(`Please test and verify: ${needsVerification.map(provider => provider.name).join(', ')}`);
            return;
        }

        const puterEnabled = settings.providers.find(provider => provider.id === 'puter')?.enabled;
        const hasVerifiedKey = settings.providers.some(
            provider => provider.keyRequired && provider.key?.trim() && testStatus[provider.id] === 'ok'
        );
        if (!puterEnabled && !hasVerifiedKey) {
            setValidationErr('Keep Puter enabled or add one verified key for OpenRouter, Groq, or Gemini.');
            return;
        }

        setSaving(true);
        try {
            await saveVaultSettings(settings);
            await refreshVault();
            setSaved(true);
            setDirty(false);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error(error);
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

    const sorted = useMemo(() => (
        settings ? [...settings.providers].sort((a, b) => a.order - b.order) : []
    ), [settings]);

    const hasUntestedKey = (settings?.providers || []).some(
        provider => provider.enabled && provider.keyRequired && provider.key?.trim() && testStatus[provider.id] !== 'ok'
    );

    const enabledCount = sorted.filter(provider => provider.enabled).length;
    const verifiedCount = sorted.filter(provider =>
        provider.enabled && provider.keyRequired && provider.key?.trim() && testStatus[provider.id] === 'ok'
    ).length;
    const routeLabel = sorted.filter(provider => provider.enabled).map(provider => provider.name).join(' -> ') || 'No active route';

    return (
        <AnimatePresence>
            {isOpen && (
                <MotionAside
                    key="provider-float"
                    initial={{ opacity: 0, y: -12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 360 }}
                    className="provider-float-panel"
                    role="region"
                    aria-label="AI Provider Settings"
                >
                    <span className="provider-float-glare" aria-hidden="true" />

                    <header className="provider-float-header">
                        <div className="provider-title-lockup">
                            <span className="provider-title-icon">
                                <Key size={18} />
                            </span>
                            <div>
                                <span>AI Provider Settings</span>
                                <h2>Provider Vault</h2>
                            </div>
                        </div>

                        <button className="provider-close-button" onClick={onClose} aria-label="Close provider settings">
                            <X size={17} />
                        </button>
                    </header>

                    <div className="provider-route-strip">
                        <div>
                            <strong>{loading ? 'Loading route...' : routeLabel}</strong>
                            <span>{enabledCount} active providers · {verifiedCount} verified keys</span>
                        </div>
                    </div>

                    <AnimatePresence>
                        {!loading && !ownerInfo.isAuth && (
                            <MotionDiv
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="provider-inline-alert is-info"
                            >
                                <Info size={15} />
                                <p>Guest mode. Keys stay tied to this browser until you log in.</p>
                            </MotionDiv>
                        )}

                        {validationErr && (
                            <MotionDiv
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="provider-inline-alert is-error"
                            >
                                <AlertTriangle size={15} />
                                <p>{validationErr}</p>
                                <button onClick={() => setValidationErr(null)} aria-label="Dismiss error">
                                    <X size={13} />
                                </button>
                            </MotionDiv>
                        )}
                    </AnimatePresence>

                    <div className="provider-float-body">
                        {loading ? (
                            <div className="provider-loading-state">
                                <Loader size={24} className="animate-spin" />
                                <span>Decrypting settings</span>
                            </div>
                        ) : (
                            <>
                                <div className="provider-help-line">
                                    <span>Drag priority with arrows. Puter works free without a key.</span>
                                </div>

                                <div className="provider-card-list">
                                    {sorted.map((provider, index) => {
                                        const accent = ACCENT[provider.id] || ACCENT.puter;
                                        const status = testStatus[provider.id];
                                        const keyVisible = showKeys[provider.id];
                                        const models = PROVIDER_MODELS[provider.id] || [];
                                        const isLast = index === sorted.length - 1;
                                        const hasKey = !!provider.key?.trim();
                                        const keyOk = status === 'ok';
                                        const keyFail = status === 'fail';
                                        const needsTest = hasKey && !keyOk;

                                        return (
                                            <article
                                                key={provider.id}
                                                className={`provider-card ${provider.enabled ? 'is-enabled' : 'is-disabled'} ${needsTest && provider.enabled ? 'needs-test' : ''}`}
                                                style={{
                                                    '--provider-bg': accent.bg,
                                                    '--provider-border': accent.border,
                                                    '--provider-text': accent.text,
                                                }}
                                            >
                                                <div className="provider-card-head">
                                                    <div className="provider-order-controls" aria-label={`${provider.name} priority controls`}>
                                                        <button
                                                            onClick={() => moveProvider(provider.id, -1)}
                                                            disabled={index === 0}
                                                            aria-label={`Move ${provider.name} up`}
                                                        >
                                                            <ChevronUp size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => moveProvider(provider.id, 1)}
                                                            disabled={isLast}
                                                            aria-label={`Move ${provider.name} down`}
                                                        >
                                                            <ChevronDown size={13} />
                                                        </button>
                                                    </div>

                                                    <span className="provider-avatar" aria-hidden="true">{provider.icon}</span>

                                                    <div className="provider-copy">
                                                        <h3>{provider.name}</h3>
                                                        <p>{provider.description}</p>
                                                    </div>

                                                    <div className="provider-status-stack">
                                                        {provider.enabled && keyOk && <span className="provider-chip is-ok"><Check size={11} /> Verified</span>}
                                                        {provider.enabled && needsTest && <span className="provider-chip is-warning">Test</span>}
                                                        <span className="provider-chip">#{index + 1}</span>
                                                    </div>

                                                    <button
                                                        className="provider-toggle-button"
                                                        onClick={() => updateProvider(provider.id, 'enabled', !provider.enabled)}
                                                        aria-label={`${provider.enabled ? 'Disable' : 'Enable'} ${provider.name}`}
                                                        aria-pressed={provider.enabled}
                                                    >
                                                        {provider.enabled ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                                                    </button>
                                                </div>

                                                {provider.enabled && (
                                                    <div className="provider-card-body">
                                                        {provider.keyRequired && (
                                                            <section className="provider-key-section">
                                                                <div className="provider-field-header">
                                                                    <label htmlFor={`provider-key-${provider.id}`}>
                                                                        API Key
                                                                        {hasKey && !keyOk && <span className="is-warning-text"> not verified</span>}
                                                                        {keyFail && <span className="is-error-text"> invalid</span>}
                                                                    </label>
                                                                    <a href={provider.helpUrl} target="_blank" rel="noreferrer">
                                                                        Get key <ExternalLink size={11} />
                                                                    </a>
                                                                </div>

                                                                <div className="provider-key-row">
                                                                    <div className={`provider-key-input ${keyOk ? 'is-ok' : ''} ${keyFail ? 'is-error' : ''} ${needsTest && !keyFail ? 'needs-test' : ''}`}>
                                                                        <input
                                                                            id={`provider-key-${provider.id}`}
                                                                            type={keyVisible ? 'text' : 'password'}
                                                                            autoComplete="off"
                                                                            placeholder={`${provider.name} key`}
                                                                            value={provider.key || ''}
                                                                            onChange={event => updateProvider(provider.id, 'key', event.target.value)}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            tabIndex={-1}
                                                                            onClick={() => setShowKeys(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                                                                            aria-label={keyVisible ? 'Hide key' : 'Show key'}
                                                                        >
                                                                            {keyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                                                                        </button>
                                                                    </div>

                                                                    <button
                                                                        className={`provider-test-button ${keyOk ? 'is-ok' : ''} ${keyFail ? 'is-error' : ''}`}
                                                                        onClick={() => handleTest(provider)}
                                                                        disabled={!hasKey || status === 'testing'}
                                                                    >
                                                                        {status === 'testing' && <Loader size={13} className="animate-spin" />}
                                                                        {keyOk && <Check size={13} />}
                                                                        {keyFail && <AlertCircle size={13} />}
                                                                        {keyOk ? 'Valid' : keyFail ? 'Invalid' : 'Test'}
                                                                    </button>
                                                                </div>

                                                                {!hasKey && <p className="provider-field-note">Skipped until a key is added.</p>}
                                                                {needsTest && !keyFail && (
                                                                    <p className="provider-field-note is-warning-text">
                                                                        <AlertTriangle size={12} /> Verify this key before saving.
                                                                    </p>
                                                                )}
                                                                {keyFail && (
                                                                    <p className="provider-field-note is-error-text">
                                                                        <AlertCircle size={12} /> Key is invalid or expired.
                                                                    </p>
                                                                )}
                                                            </section>
                                                        )}

                                                        {models.length > 0 && (
                                                            <section className="provider-model-section">
                                                                <div className="provider-field-header">
                                                                    <label htmlFor={`provider-model-${provider.id}`}>Model</label>
                                                                </div>
                                                                <select
                                                                    id={`provider-model-${provider.id}`}
                                                                    value={provider.selectedModel || ''}
                                                                    onChange={event => updateProvider(provider.id, 'selectedModel', event.target.value || null)}
                                                                >
                                                                    {models.map(model => (
                                                                        <option key={model.value ?? '__default__'} value={model.value ?? ''}>
                                                                            {model.label}{model.badge !== 'default' ? ` (${BADGE[model.badge]?.label || model.badge})` : ''}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {provider.selectedModel && (
                                                                    <div className="provider-selected-model">
                                                                        Using <strong>{provider.selectedModel}</strong>
                                                                    </div>
                                                                )}
                                                            </section>
                                                        )}
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>

                                <div className="provider-security-note">
                                    <Shield size={15} />
                                    <p>Keys are encrypted in the browser before sync. Plain keys are not stored on the server.</p>
                                </div>
                            </>
                        )}
                    </div>

                    {!loading && (
                        <footer className="provider-float-footer">
                            <button className="provider-reset-button" onClick={handleReset}>
                                <RefreshCw size={14} /> Reset
                            </button>

                            {hasUntestedKey && <span className="provider-footer-warning">Test keys first</span>}

                            <button
                                className={`provider-save-button ${saved ? 'is-saved' : ''}`}
                                onClick={handleSave}
                                disabled={saving || !dirty || hasUntestedKey}
                            >
                                {saving ? <><Loader size={14} className="animate-spin" /> Saving</>
                                    : saved ? <><Check size={14} /> Saved</>
                                    : <><Save size={14} /> Save</>}
                            </button>
                        </footer>
                    )}
                </MotionAside>
            )}
        </AnimatePresence>
    );
}
