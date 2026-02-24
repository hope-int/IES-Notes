import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';

export default function SlideRenderer({ slideData }) {
    if (!slideData) return null;

    const { title, bullets, design = {} } = slideData;
    const {
        bgType = 'solid',
        colors = { primary: '#3b82f6', secondary: '#eff6ff', accent: '#60a5fa' },
        layoutHints = 'center-card',
        decorations = [],
        icon = 'Sparkles'
    } = design;

    // Resolve Icon
    const IconComponent = LucideIcons[icon] || LucideIcons.Sparkles;

    // Background Styles
    const getBackground = () => {
        if (bgType === 'gradient') return `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`;
        if (bgType === 'mesh') return `radial-gradient(at 0% 0%, ${colors.primary} 0px, transparent 50%), radial-gradient(at 100% 100%, ${colors.secondary} 0px, transparent 50%), radial-gradient(at 50% 0%, ${colors.accent} 0px, transparent 50%)`;
        if (bgType === 'glass') return `transparent`;
        return colors.secondary || '#ffffff';
    };

    // Layout Containers
    const containerClasses = useMemo(() => {
        const base = "w-full h-full relative overflow-hidden flex flex-col p-12 md:p-20 transition-all duration-700";
        if (layoutHints === 'center-card') return `${base} items-center justify-center text-center`;
        if (layoutHints === 'split-vertical') return `${base} items-start justify-center`;
        if (layoutHints === 'hero-stat') return `${base} items-center justify-center bg-slate-900 text-white`;
        if (layoutHints === 'grid-3x1') return `${base} items-start`;
        return base;
    }, [layoutHints]);

    return (
        <div className={containerClasses} style={{ background: getBackground() }}>
            {/* Dynamic Decorations */}
            {decorations.includes('floating-orbs') && (
                <>
                    <motion.div
                        animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="absolute -top-20 -left-20 w-80 h-80 rounded-full blur-[100px] opacity-30"
                        style={{ background: colors.primary }}
                    />
                    <motion.div
                        animate={{ x: [0, -40, 0], y: [0, 60, 0] }}
                        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                        className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full blur-[100px] opacity-20"
                        style={{ background: colors.accent }}
                    />
                </>
            )}

            {decorations.includes('grid-pattern') && (
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `radial-gradient(${colors.primary} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
            )}

            {decorations.includes('border-glow') && (
                <div className="absolute inset-4 border-2 rounded-[2rem] opacity-20" style={{ borderColor: colors.primary, boxShadow: `0 0 40px ${colors.primary}` }} />
            )}

            {/* Slide Content */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="z-10 w-full max-w-5xl"
            >
                {/* Header Section */}
                <div className={`flex flex-col ${layoutHints === 'center-card' ? 'items-center' : 'items-start'} mb-12`}>
                    <div className="flex items-center gap-4 mb-4">
                        <IconComponent className="w-10 h-10" style={{ color: bgType === 'hero-stat' ? '#fff' : colors.primary }} />
                        {layoutHints === 'hero-stat' && <div className="h-1px w-12 bg-white/30" />}
                    </div>
                    <h1 className={`!text-4xl md:!text-6xl !font-black !tracking-tighter !leading-tight ${bgType === 'hero-stat' ? 'text-white' : 'text-slate-900'}`}>
                        {title}
                    </h1>
                    <div className="w-24 h-2 rounded-full mt-6" style={{ background: colors.accent }} />
                </div>

                {/* Bullets Section */}
                <div className={`grid gap-6 ${layoutHints === 'grid-3x1' ? 'grid-cols-3' : 'grid-cols-1'} mt-8`}>
                    {bullets?.map((bullet, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 + (idx * 0.1), duration: 0.5 }}
                            className={`flex items-start gap-4 !p-6 !rounded-3xl !backdrop-blur-md !border !transition-all hover:!scale-[1.02] ${bgType === 'hero-stat' ? '!bg-white/5 !border-white/10' : '!bg-white/40 !border-white/60 !shadow-sm'}`}
                        >
                            <span className="!flex !items-center !justify-center !w-8 !h-8 !rounded-full !bg-white/50 !text-slate-900 !font-bold !text-sm !shrink-0">
                                {idx + 1}
                            </span>
                            <p className={`!text-lg md:!text-xl !font-medium !leading-relaxed ${bgType === 'hero-stat' ? 'text-white/90' : 'text-slate-700'}`}>
                                {bullet}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* Context Footer */}
            <div className={`absolute bottom-8 left-12 !text-[10px] !font-black !uppercase !tracking-[0.3em] !opacity-30 ${bgType === 'hero-stat' ? 'text-white' : 'text-slate-900'}`}>
                HOPE Studio • Contextual Engine v2.0
            </div>
        </div>
    );
}
