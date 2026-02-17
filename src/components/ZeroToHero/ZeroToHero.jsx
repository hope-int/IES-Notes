import React, { useState, useEffect } from 'react';
import Onboarding from './Onboarding';
import HeroChat from './HeroChat';

const ZeroToHero = ({ onBack }) => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('hope_zero_to_hero_profile');
        if (stored) {
            setProfile(JSON.parse(stored));
        }
        setLoading(false);
    }, []);

    const handleOnboardingComplete = (newProfile) => {
        setProfile(newProfile);
        // Profile is already saved to local storage in Onboarding.jsx
    };

    if (loading) return null;

    if (!profile) {
        return <Onboarding onComplete={handleOnboardingComplete} />;
    }

    return (
        <div className="vh-100 bg-white">
            <HeroChat
                profile={profile}
                onBack={onBack}
                onResetProfile={() => {
                    localStorage.removeItem('hope_zero_to_hero_profile');
                    setProfile(null);
                }}
            />
        </div>
    );
};

export default ZeroToHero;
