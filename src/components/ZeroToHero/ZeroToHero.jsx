import React, { useState } from 'react';
import Onboarding from './Onboarding';
import HeroChat from './HeroChat';

const ZeroToHero = ({ onBack }) => {
    const [profile, setProfile] = useState(() => {
        try {
            const stored = localStorage.getItem('hope_zero_to_hero_profile');
            return stored ? JSON.parse(stored) : null;
        } catch {
            localStorage.removeItem('hope_zero_to_hero_profile');
            return null;
        }
    });

    const handleOnboardingComplete = (newProfile) => {
        setProfile(newProfile);
        // Profile is already saved to local storage in Onboarding.jsx
    };

    if (!profile) {
        return <Onboarding onComplete={handleOnboardingComplete} onBack={onBack} />;
    }

    return (
        <div className="zth-route vh-100">
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
