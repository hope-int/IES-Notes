import React, { useState, useEffect, useCallback, useRef } from 'react';

const FormulaBar = ({ activeCellId = 'A1', value = '', onChange }) => {
    // Local state for instant typing response
    const [localValue, setLocalValue] = useState(value);
    const timeoutRef = useRef(null);

    // Update local value when the active cell changes
    useEffect(() => {
        setLocalValue(value);
    }, [value, activeCellId]);

    const handleChange = (e) => {
        const newValue = e.target.value;
        setLocalValue(newValue);

        // Clear existing timeout
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        // Debounce the update to the grid to prevent lag
        timeoutRef.current = setTimeout(() => {
            onChange?.(newValue);
        }, 50); // Small delay to batch keystrokes
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            onChange?.(localValue);
            e.target.blur();
        }
    };

    return (
        <div className="bg-white border-b border-gray-200 px-4 py-1.5 flex gap-2 items-center sticky top-16 z-[90] h-10 shadow-sm">
            {/* Active Cell Display */}
            <div className="min-w-[60px] px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-sm font-medium text-gray-500 text-center">
                {activeCellId}
            </div>

            {/* Divider */}
            <div className="w-[1px] h-4 bg-gray-200 mx-1" />

            {/* Formula Icon */}
            <div className="flex items-center gap-1.5 text-gray-400 select-none">
                <span className="italic font-serif font-bold text-lg">fx</span>
            </div>

            {/* Divider */}
            <div className="w-[1px] h-6 bg-gray-200 mx-1" />

            {/* Input Bar */}
            <div className="flex-1">
                <input
                    type="text"
                    value={localValue}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onBlur={() => onChange?.(localValue)}
                    className="w-full text-sm font-medium text-gray-700 bg-transparent border-none focus:outline-none placeholder:text-gray-300 placeholder:italic"
                    placeholder="Enter value or formula..."
                />
            </div>
        </div>
    );
};

export default React.memo(FormulaBar);
