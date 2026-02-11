import React from 'react';
import './index.css'; // Ensure we have the shimmer effect in CSS

const SkeletonLoader = ({ type = 'text', count = 1 }) => {
    const renderSkeleton = () => {
        switch (type) {
            case 'card':
                return (
                    <div className="clay-card p-4 h-100 d-flex flex-column gap-3">
                        <div className="d-flex justify-content-between">
                            <div className="skeleton-box rounded-4" style={{ width: 60, height: 60 }}></div>
                            <div className="skeleton-box rounded-circle" style={{ width: 24, height: 24 }}></div>
                        </div>
                        <div>
                            <div className="skeleton-text mb-2" style={{ width: '70%', height: '1.5rem' }}></div>
                            <div className="skeleton-text" style={{ width: '40%' }}></div>
                        </div>
                    </div>
                );
            case 'feed':
                return (
                    <div className="bg-white border rounded shadow-sm p-3 d-flex gap-3">
                        <div className="skeleton-box rounded-circle flex-shrink-0" style={{ width: 40, height: 40 }}></div>
                        <div className="flex-grow-1">
                            <div className="skeleton-text mb-2" style={{ width: '30%' }}></div>
                            <div className="skeleton-text mb-1" style={{ width: '90%' }}></div>
                            <div className="skeleton-text" style={{ width: '60%' }}></div>
                        </div>
                    </div>
                );
            case 'banner':
                return (
                    <div className="clay-card p-4 h-100">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div className="skeleton-text" style={{ width: '40%', height: '1.5rem' }}></div>
                        </div>
                        <div className="d-flex flex-column gap-2">
                            <div className="skeleton-text" style={{ width: '100%' }}></div>
                            <div className="skeleton-text" style={{ width: '90%' }}></div>
                            <div className="skeleton-text" style={{ width: '95%' }}></div>
                        </div>
                    </div>
                );
            default:
                return <div className="skeleton-text" style={{ width: '100%' }}></div>;
        }
    };

    return (
        <>
            {Array(count).fill(0).map((_, i) => (
                <div key={i} className={type === 'card' ? 'col-12 col-md-6 col-lg-4' : 'w-100 mb-3'}>
                    {renderSkeleton()}
                </div>
            ))}
        </>
    );
};

export default SkeletonLoader;
