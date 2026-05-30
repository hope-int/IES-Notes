import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

// Shared cache to avoid re-requesting read URLs on every render
const pfpCache = {};

export default function UserAvatar({ profile, size = 40, fontSize, className = '' }) {
    const [resolvedUrl, setResolvedUrl] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const avatarUrl = profile?.avatar_url;

        if (!avatarUrl) {
            setResolvedUrl(null);
            return;
        }

        // 1. Check if it's already a full HTTP URL or data URL
        if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
            setResolvedUrl(avatarUrl);
            return;
        }

        // 2. Resolve Puter filesystem path
        if (avatarUrl.startsWith('/pfps/')) {
            // Check cache first
            if (pfpCache[avatarUrl]) {
                setResolvedUrl(pfpCache[avatarUrl]);
                return;
            }

            const fetchPuterUrl = async () => {
                if (loading) return;
                setLoading(true);
                try {
                    // Wait for window.puter to load if it's not ready
                    const getUrl = async () => {
                        if (window.puter && window.puter.fs) {
                            return await window.puter.fs.getReadURL(avatarUrl);
                        }
                        return null;
                    };

                    let url = await getUrl();
                    // Retry once after a delay if puter wasn't ready yet
                    if (!url) {
                        await new Promise(r => setTimeout(r, 1000));
                        url = await getUrl();
                    }

                    if (url && isMounted) {
                        pfpCache[avatarUrl] = url;
                        setResolvedUrl(url);
                    }
                } catch (err) {
                    console.warn("Failed to resolve Puter PFP URL", err);
                } finally {
                    if (isMounted) setLoading(false);
                }
            };

            fetchPuterUrl();
        }

        return () => {
            isMounted = false;
        };
    }, [profile?.avatar_url]);

    const name = profile?.full_name || 'Student';
    const initial = name.charAt(0).toUpperCase();

    // Generate deterministic background color based on name
    const getHashColor = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash % 360);
        return `linear-gradient(135deg, hsl(${h}, 70%, 55%) 0%, hsl(${(h + 40) % 360}, 75%, 45%) 100%)`;
    };

    const gradientBg = getHashColor(name);

    if (resolvedUrl) {
        return (
            <img
                src={resolvedUrl}
                alt={name}
                className={`rounded-circle object-fit-cover shadow-sm ${className}`}
                style={{
                    width: size,
                    height: size,
                    border: '2px solid var(--border-color, #e2e8f0)',
                    transition: 'all 0.2s ease-in-out'
                }}
            />
        );
    }

    return (
        <div
            className={`rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm ${className}`}
            style={{
                width: size,
                height: size,
                background: gradientBg,
                fontSize: fontSize || `${size * 0.4}px`,
                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '2px solid var(--border-color, #e2e8f0)',
                userSelect: 'none'
            }}
        >
            {initial || <User size={size * 0.5} />}
        </div>
    );
}
