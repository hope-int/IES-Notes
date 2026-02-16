import React from 'react';

const SkeletonLoader = ({ type = 'text', count = 1, className = '', style = {} }) => {
    const skeletons = Array(count).fill(0);

    const getStyles = () => {
        const baseStyle = {
            backgroundColor: '#e2e8f0',
            borderRadius: '4px',
            animation: 'skeleton-pulse 1.5s infinite ease-in-out',
        };

        if (type === 'text') return { ...baseStyle, height: '1em', width: '100%', marginBottom: '0.5em' };
        if (type === 'title') return { ...baseStyle, height: '2em', width: '70%', marginBottom: '1em' };
        if (type === 'image') return { ...baseStyle, height: '200px', width: '100%', marginBottom: '1rem', ...style };
        if (type === 'avatar') return { ...baseStyle, height: '40px', width: '40px', borderRadius: '50%', ...style };
        if (type === 'card') return { ...baseStyle, height: '200px', width: '100%', borderRadius: '12px', ...style };

        return baseStyle;
    };

    return (
        <>
            <style>
                {`
                @keyframes skeleton-pulse {
                    0% { opacity: 0.6; }
                    50% { opacity: 0.3; }
                    100% { opacity: 0.6; }
                }
                `}
            </style>
            <div className={className} style={{ width: '100%' }}>
                {skeletons.map((_, index) => (
                    <div key={index} style={getStyles()} className="skeleton-item" />
                ))}
            </div>
        </>
    );
};

export default SkeletonLoader;
