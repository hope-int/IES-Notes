import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { getDeviceId } from '../utils/deviceUtils';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [initializing, setInitializing] = useState(true);
    const [showAdmin, setShowAdmin] = useState(false);
    const [warningMessage, setWarningMessage] = useState(null);
    const [showWarningModal, setShowWarningModal] = useState(false);

    // Using a ref for initializing to check current state in safety timeouts
    const isInitializingRef = useRef(true);

    useEffect(() => {
        isInitializingRef.current = initializing;
    }, [initializing]);

    useEffect(() => {
        checkUserStatus();

        // Safety timeout: Force app to start after 5 seconds even if auth hangs
        const safetyHook = setTimeout(() => {
            if (isInitializingRef.current) {
                console.warn("Auth initialization timed out (15s), forcing app to start.");
                setInitializing(false);
            }
        }, 15000);

        // Listen for Auth changes (for Admins falling back to Supabase auth)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
        });

        return () => {
            subscription.unsubscribe();
            clearTimeout(safetyHook);
        };
    }, []);

    const fetchProfile = async (userId) => {
        const profilePromise = (async () => {
            try { return await supabase.from('profiles').select('*').eq('id', userId).single(); }
            catch (e) { return { error: e }; }
        })();

        const timeoutPromise = new Promise((resolve) =>
            setTimeout(() => resolve({ error: new Error("Profile fetch timeout") }), 20000)
        );

        try {
            const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]);
            if (error) throw error;

            if (profile) {
                setUserProfile(profile);
                if (profile.is_admin) {
                    setShowAdmin(true);
                }
                if (profile.latest_warning_message) {
                    setWarningMessage(profile.latest_warning_message);
                    setShowWarningModal(true);
                }
            }
        } catch (err) {
            console.error("fetchProfile failed or timed out:", err.message);
        }
    };

    const checkUserStatus = async () => {
        try {
            // 1. Check Local Storage (Main Flow)
            const storedProfile = localStorage.getItem('hope_student_profile');
            if (storedProfile) {
                const profile = JSON.parse(storedProfile);
                setUserProfile(profile);
                if (profile.is_admin) setShowAdmin(true);
                if (profile.id) fetchProfile(profile.id).catch(() => { });
                return;
            }

            // 2. Check Supabase Session
            const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));

            if (session) {
                setSession(session);
                await fetchProfile(session.user.id);
            } else {
                // 3. Fallback: Device ID
                const deviceId = getDeviceId();
                if (deviceId) {
                    const devicePromise = supabase.from('user_devices').select('user_id').eq('device_id', deviceId).maybeSingle();
                    const timeoutPromise = new Promise(r => setTimeout(() => r({ error: 'timeout' }), 2000));

                    try {
                        const result = await Promise.race([devicePromise, timeoutPromise]);
                        if (result?.data?.user_id) {
                            await fetchProfile(result.data.user_id);
                        }
                    } catch (e) { }
                }
            }
        } catch (error) {
            console.warn("Auth init bypassed:", error.message);
        } finally {
            setInitializing(false);
        }
    };

    const dismissWarning = async () => {
        if (!userProfile) return;
        setShowWarningModal(false);

        try {
            const { error } = await supabase.from('profiles').update({ latest_warning_message: null }).eq('id', userProfile.id);
            if (error) throw error;
            setWarningMessage(null);
        } catch (err) {
            console.error("Failed to dismiss warning", err);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('hope_student_profile');
        setShowAdmin(false);
        setUserProfile(null);
        setSession(null);
    };

    const handleRegistrationComplete = (profile) => {
        setUserProfile(profile);
        if (profile.is_admin) setShowAdmin(true);
    };

    const value = {
        session,
        setSession,
        userProfile,
        setUserProfile,
        initializing,
        showAdmin,
        setShowAdmin,
        warningMessage,
        showWarningModal,
        fetchProfile,
        dismissWarning,
        handleLogout,
        handleRegistrationComplete,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
