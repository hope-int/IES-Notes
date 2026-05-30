import { supabase } from '../supabaseClient';

let isTelemetrySupported = true;

const getDeviceTier = () => {
    const memory = navigator.deviceMemory || 4; // defaults to 4GB
    const cores = navigator.hardwareConcurrency || 4;
    
    if (memory <= 2 || cores <= 2) return 'low-end';
    if (memory <= 4 || cores <= 4) return 'mid-end';
    return 'high-end';
};

const getConnectionQuality = () => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return 'unknown';
    return {
        effectiveType: conn.effectiveType || 'unknown',
        downlink: conn.downlink || 0,
        rtt: conn.rtt || 0
    };
};

export const logAIChatTelemetry = async (telemetryData) => {
    if (!isTelemetrySupported) return;

    const {
        model,
        provider,
        durationMs,
        success,
        fallbackTriggered = false,
        misconceptionHalted = false,
        studentProficiency = null,
        ruralIndicator = false
    } = telemetryData;

    const connection = getConnectionQuality();
    const deviceTier = getDeviceTier();

    const payload = {
        model,
        provider,
        duration_ms: durationMs,
        success,
        fallback_triggered: fallbackTriggered,
        misconception_halted: misconceptionHalted,
        student_proficiency: studentProficiency,
        device_tier: deviceTier,
        connection_effective_type: typeof connection === 'string' ? connection : connection.effectiveType,
        connection_downlink: typeof connection === 'string' ? null : connection.downlink,
        connection_rtt: typeof connection === 'string' ? null : connection.rtt,
        rural_indicator: ruralIndicator,
        created_at: new Date().toISOString()
    };

    console.info('[Telemetry Log]', payload);

    try {
        const { error } = await supabase.from('hope_ai_telemetry').insert(payload);
        if (error) {
            console.warn('[Telemetry] Supabase upload failed (ignoring):', error.message);
            // Disable telemetry if the database schema does not have the table
            if (
                error.message.includes('schema cache') || 
                error.message.includes('does not exist') ||
                error.message.includes('not found')
            ) {
                console.info('[Telemetry] Disabling telemetry uploads for this session (table hope_ai_telemetry is not configured).');
                isTelemetrySupported = false;
            }
        }
    } catch (e) {
        // Graceful fallback for local development without table schema
        isTelemetrySupported = false;
    }
};

