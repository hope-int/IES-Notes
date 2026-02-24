import React from 'react';
import MiniGameLoader from './common/MiniGameLoader';

const AILoader = ({ title, subtitle }) => {
    return (
        <div className="w-100 h-100 d-flex align-items-center justify-content-center">
            <div className="w-100" style={{ maxWidth: '800px' }}>
                <MiniGameLoader loadingText={title || "AI is thinking..."} subText={subtitle || "Hold on tight"} />
            </div>
        </div>
    );
};

export default AILoader;
