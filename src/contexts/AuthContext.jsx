import React, { createContext, useContext, useState, useEffect } from 'react';
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

    useEffect(() => {
        checkUserStatus();

        // Listen for Auth changes (for Admins falling back to Supabase auth)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId) => {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

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
    };

    const checkUserStatus = async () => {
        // 1. Check Local Storage for Student Profile (Main Flow)
        const storedProfile = localStorage.getItem('hope_student_profile');
        if (storedProfile) {
            const profile = JSON.parse(storedProfile);
            setUserProfile(profile);
            // Admin and Warning checks are usually populated, but just in case we fetch fresh or rely on local
            if (profile.is_admin) setShowAdmin(true);
            setInitializing(false);

            // Optionally refresh profile silently in background
            if (profile.id) fetchProfile(profile.id);
            return;
        }

        // 2. Check Supabase Session (For Admins / Fallback)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            setSession(session);
            await fetchProfile(session.user.id);
        } else {
            // 3. Fallback: Auto-Login via Device ID
            const deviceId = getDeviceId();
            if (deviceId) {
                const { data: deviceLink } = await supabase
                    .from('user_devices')
                    .select('user_id')
                    .eq('device_id', deviceId)
                    .maybeSingle();

                if (deviceLink?.user_id) {
                    await fetchProfile(deviceLink.user_id);
                }
            }
        }

        setInitializing(false);
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
