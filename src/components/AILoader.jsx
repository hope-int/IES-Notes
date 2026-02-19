import React from 'react';

const AILoader = ({ title, subtitle }) => {
    return (
        <div className="d-flex flex-column align-items-center justify-content-center text-center p-5 w-100 h-100">
            <div style={{ width: '300px', height: '300px', overflow: 'hidden', borderRadius: '16px' }}>
                <iframe
                    src="https://lottie.host/embed/d5c4af6d-58ad-4fb6-83db-572b77cde514/yKBB2efFCu.lottie"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="AI Loading Animation"
                    scrolling="no"
                ></iframe>
            </div>
            {title && <h3 className="fw-bold mt-3 mb-2">{title}</h3>}
            {subtitle && <p className="text-muted" style={{ maxWidth: '400px' }}>{subtitle}</p>}
        </div>
    );
};

export default AILoader;
