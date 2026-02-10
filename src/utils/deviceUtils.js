import { v4 as uuidv4 } from 'uuid';

/**
 * Gets or creates a persistent Device ID from LocalStorage.
 * This ID is unique to this browser instance.
 */
export const getDeviceId = () => {
    let deviceId = localStorage.getItem('ies_device_id');
    if (!deviceId) {
        deviceId = uuidv4();
        localStorage.setItem('ies_device_id', deviceId);
    }
    return deviceId;
};

/**
 * Fetches the public IP address of the client using a free API.
 * Uses ipapi.co as a primary source, falls back to ipify.
 */
export const getClientIp = async () => {
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error('IP API failed');
        const data = await response.json();
        return {
            ip: data.ip,
            city: data.city,
            region: data.region,
            country: data.country_name,
            org: data.org
        };
    } catch (error) {
        console.warn("Primary IP fetch failed, trying fallback...", error);
        try {
            const fallback = await fetch('https://api.ipify.org?format=json');
            const data = await fallback.json();
            return { ip: data.ip };
        } catch (err) {
            console.error("All IP fetch methods failed", err);
            return null;
        }
    }
};

/**
 * Gets basic browser/device info (User Agent, Screen, Language).
 */
export const getDeviceInfo = () => {
    return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screen: `${window.screen.width}x${window.screen.height}`
    };
};
