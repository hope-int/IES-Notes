import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ImageCropperModal({ src, onCrop, onClose }) {
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const imageRef = useRef(null);
    const containerRef = useRef(null);

    // Reset crop state when image source changes
    useEffect(() => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    }, [src]);

    // Handle mouse/touch drag start
    const handleStart = (e) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setIsDragging(true);
        dragStart.current = {
            x: clientX - position.x,
            y: clientY - position.y
        };
    };

    // Handle mouse/touch move
    const handleMove = (e) => {
        if (!isDragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // Calculate new positions
        let newX = clientX - dragStart.current.x;
        let newY = clientY - dragStart.current.y;

        setPosition({ x: newX, y: newY });
    };

    // Handle drag end
    const handleEnd = () => {
        setIsDragging(false);
    };

    // Draw and crop the image using Canvas
    const handleConfirm = () => {
        const img = imageRef.current;
        if (!img) return;

        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.clearRect(0, 0, 300, 300);

        // Aspect ratio cover math
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        
        // Cover container of size 250px
        const initialScale = Math.max(250 / naturalWidth, 250 / naturalHeight);
        
        // Target draw width & height in canvas coordinates (where scale is normalized to 300px canvas size)
        // Canvas size is 300px, viewport size is 250px. Scale factor = 300 / 250 = 1.2
        const w = naturalWidth * initialScale * zoom * 1.2;
        const h = naturalHeight * initialScale * zoom * 1.2;

        // Position offset in canvas coordinates
        const dx = 150 + (position.x * 1.2) - (w / 2);
        const dy = 150 + (position.y * 1.2) - (h / 2);

        // Draw image on canvas
        ctx.drawImage(img, dx, dy, w, h);

        // Compress image to ensure it is under 100KB
        let quality = 0.85;
        const compress = () => {
            canvas.toBlob((blob) => {
                if (blob.size <= 102400 || quality <= 0.1) {
                    onCrop(blob);
                } else {
                    quality -= 0.05;
                    compress();
                }
            }, 'image/jpeg', quality);
        };
        compress();
    };

    return (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 z-3" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 2000 }}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="clay-card p-4 w-100 bg-dark text-white border-0 shadow-2xl"
                style={{ maxWidth: '420px', borderRadius: '24px' }}
            >
                {/* Header */}
                <div className="d-flex align-items-center justify-content-between mb-4">
                    <h5 className="fw-bold mb-0 text-white">Crop Profile Photo</h5>
                    <button onClick={onClose} className="btn btn-sm btn-link text-white-50 p-0 text-decoration-none">
                        <X size={20} />
                    </button>
                </div>

                {/* Cropping Viewport Container */}
                <div 
                    ref={containerRef}
                    className="position-relative overflow-hidden mx-auto rounded-circle border border-2 border-primary mb-4 bg-secondary d-flex align-items-center justify-content-center"
                    style={{ width: '250px', height: '250px', cursor: 'move', touchAction: 'none' }}
                    onMouseDown={handleStart}
                    onMouseMove={handleMove}
                    onMouseUp={handleEnd}
                    onMouseLeave={handleEnd}
                    onTouchStart={handleStart}
                    onTouchMove={handleMove}
                    onTouchEnd={handleEnd}
                >
                    {/* Shadow overlay showing circle boundary */}
                    <div className="position-absolute top-0 start-0 w-100 h-100 rounded-circle pointer-events-none" style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.4)', zIndex: 2 }}></div>
                    
                    <img
                        ref={imageRef}
                        src={src}
                        alt="Crop source"
                        className="position-absolute pointer-events-none select-none"
                        style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                            transformOrigin: 'center center',
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            transition: isDragging ? 'none' : 'transform 0.05s ease-out'
                        }}
                    />
                </div>

                {/* Controls */}
                <div className="mb-4">
                    <div className="d-flex align-items-center gap-3 justify-content-center mb-3">
                        <ZoomOut size={18} className="text-white-50" />
                        <input
                            type="range"
                            min="1"
                            max="3"
                            step="0.05"
                            className="form-range flex-grow-1"
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            style={{ accentColor: 'var(--primary-accent)' }}
                        />
                        <ZoomIn size={18} className="text-white-50" />
                    </div>
                    
                    <div className="d-flex justify-content-center">
                        <button 
                            onClick={() => { setPosition({ x: 0, y: 0 }); setZoom(1); }}
                            className="btn btn-sm btn-outline-light rounded-pill px-3 fw-bold d-flex align-items-center gap-2"
                        >
                            <RotateCcw size={14} /> Reset View
                        </button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="d-flex gap-2">
                    <button onClick={onClose} className="btn btn-outline-light rounded-pill flex-grow-1 py-3 fw-bold">
                        Cancel
                    </button>
                    <button onClick={handleConfirm} className="btn btn-primary rounded-pill flex-grow-1 py-3 fw-bold d-flex align-items-center justify-content-center gap-2">
                        <Check size={18} /> Apply Photo
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
