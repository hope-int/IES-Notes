import React from 'react';

const SkeletonLoader = ({ type = 'text', count = 1, className = '', style = {} }) => {
    const skeletons = Array(count).fill(0);

    const getStyles = () => {
        const baseStyle = {
            borderRadius: '12px',
            marginBottom: '1rem',
            ...style
        };

        if (type === 'text') return { ...baseStyle, height: '14px', width: '90%', marginBottom: '0.75rem' };
        if (type === 'title') return { ...baseStyle, height: '20px', width: '60%', marginBottom: '1rem' };
        if (type === 'avatar') return { ...baseStyle, height: '40px', width: '40px', borderRadius: '50%', marginBottom: '0' };
        if (type === 'card') return { ...baseStyle, height: '180px', width: '100%' };

        return baseStyle;
    };

    return (
        <div className={`d-flex flex-column gap-3 ${className}`}>
            {skeletons.map((_, index) => (
                <div
                    key={index}
                    className="glass-card p-3 border-0"
                    style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(5px)' }}
                >
                    <div className="d-flex gap-3 align-items-center mb-3">
                        <div className="shimmer-bg" style={getStyles('avatar')} />
                        <div className="flex-grow-1">
                            <div className="shimmer-bg mb-2" style={{ height: '12px', width: '40%', borderRadius: '4px' }} />
                            <div className="shimmer-bg" style={{ height: '10px', width: '20%', borderRadius: '4px' }} />
                        </div>
                    </div>
                    <div className="shimmer-bg mb-2" style={{ height: '14px', width: '100%', borderRadius: '4px' }} />
                    <div className="shimmer-bg mb-2" style={{ height: '14px', width: '90%', borderRadius: '4px' }} />
                    <div className="shimmer-bg" style={{ height: '14px', width: '40%', borderRadius: '4px' }} />
                </div>
            ))}
        </div>
    );
};

export default SkeletonLoader;
