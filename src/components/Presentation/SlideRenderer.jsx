import React from 'react';

export default function SlideRenderer({ slideData }) {
    // If no data, return empty
    if (!slideData) return null;

    // --------------------------------------------------------
    // LAYOUT 1: The "Apple Keynote" Title Slide
    // --------------------------------------------------------
    if (slideData.layout === "TITLE_SLIDE") {
        return (
            <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
                {/* Decorative Background Glowing Orbs */}
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-500/30 rounded-full blur-[100px]"></div>
                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/30 rounded-full blur-[100px]"></div>

                <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-white tracking-tight mb-8 z-10 drop-shadow-lg max-w-[90%]">
                    {slideData.title}
                </h1>
                <div className="w-48 h-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full z-10"></div>
            </div>
        );
    }

    // --------------------------------------------------------
    // LAYOUT 2: The "Premium 50/50 Split" Two Column
    // --------------------------------------------------------
    if (slideData.layout === "TWO_COLUMN") {
        return (
            <div className="w-full h-full flex bg-slate-50">
                {/* Left Side (Dark branding block) */}
                <div className="w-2/5 bg-slate-900 p-10 md:p-16 flex flex-col justify-center relative overflow-hidden shadow-2xl z-10">
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight z-10">
                        {slideData.title}
                    </h2>
                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-indigo-900/50 to-transparent"></div>
                </div>

                {/* Right Side (Light content block) */}
                <div className="w-3/5 p-10 md:p-16 flex items-center justify-center bg-white">
                    <div className="grid grid-cols-2 gap-8 lg:gap-16 w-full">
                        <ul className="space-y-6 lg:space-y-10">
                            {slideData.bullets_left?.map((bullet, idx) => (
                                <li key={idx} className="text-xl md:text-2xl lg:text-3xl text-slate-700 flex items-start leading-snug">
                                    <span className="text-indigo-600 mr-4 font-black text-3xl md:text-4xl">•</span>
                                    {bullet}
                                </li>
                            ))}
                        </ul>
                        <ul className="space-y-6 lg:space-y-10">
                            {slideData.bullets_right?.map((bullet, idx) => (
                                <li key={idx} className="text-xl md:text-2xl lg:text-3xl text-slate-700 flex items-start leading-snug">
                                    <span className="text-purple-600 mr-4 font-black text-3xl md:text-4xl">•</span>
                                    {bullet}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    // --------------------------------------------------------
    // LAYOUT 3: The "Startup Pitch" Big Stat
    // --------------------------------------------------------
    if (slideData.layout === "BIG_STAT") {
        return (
            <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-12 text-center relative">
                <h2 className="absolute top-12 left-12 text-3xl md:text-4xl font-bold text-slate-400">
                    {slideData.title}
                </h2>

                {/* Glassmorphic Stat Card */}
                <div className="bg-white/60 backdrop-blur-xl border border-white shadow-2xl rounded-3xl p-16 md:p-24 flex flex-col items-center transform transition-transform hover:scale-105">
                    <h1 className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-6 drop-shadow-sm">
                        {slideData.stat || (slideData.bullets ? slideData.bullets[0] : "Data Point")}
                    </h1>
                    <p className="text-2xl md:text-4xl font-medium text-slate-600 max-w-3xl">
                        {slideData.bullets ? slideData.bullets[1] : "Transforming the industry standard."}
                    </p>
                </div>
            </div>
        );
    }

    // --------------------------------------------------------
    // LAYOUT 4: The "Modern Minimalist" Standard Bullets
    // --------------------------------------------------------
    return (
        <div className="w-full h-full bg-white flex flex-col p-12 md:p-20 relative">
            {/* Sleek Top Header */}
            <div className="mb-12 md:mb-20">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight">
                    {slideData.title}
                </h2>
                <div className="w-32 h-2 bg-indigo-500 rounded-full mt-6"></div>
            </div>

            {/* Spaced Out Bullet Points */}
            <div className="flex-1 flex flex-col justify-center max-w-5xl">
                <ul className="space-y-8 md:space-y-12">
                    {slideData.bullets?.map((bullet, idx) => (
                        <li key={idx} className="text-2xl md:text-3xl lg:text-4xl text-slate-600 flex items-start leading-relaxed font-medium">
                            {/* Custom SVG Checkmark instead of a boring dot */}
                            <svg className="w-8 h-8 md:w-10 md:h-10 text-emerald-500 mr-6 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                            </svg>
                            {bullet}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Branding Footer */}
            <div className="absolute bottom-8 right-12 text-slate-300 font-bold text-xl tracking-widest uppercase">
                HOPE Studio
            </div>
        </div>
    );
}
