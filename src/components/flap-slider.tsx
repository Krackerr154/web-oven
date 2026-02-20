"use client";

import { useEffect, useRef, useState } from "react";

type FlapSliderProps = {
    value: number;
    onChange: (val: number) => void;
    disabled?: boolean;
};

export function FlapSlider({ value, onChange, disabled = false }: FlapSliderProps) {
    const min = 0;
    const max = 100;
    const step = 10;
    const marks = Array.from({ length: 11 }, (_, i) => i * 10);

    const [isDragging, setIsDragging] = useState(false);

    // Calculate filled percentage
    const fillPercent = ((value - min) / (max - min)) * 100;

    return (
        <div className={`relative w-full py-4 select-none ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
            {/* Value Indicator Popover */}
            <div
                className={`absolute top-0 -mt-2 -ml-3.5 w-7 text-center transition-opacity duration-200 ${isDragging ? "opacity-100" : "opacity-0"
                    }`}
                style={{ left: `calc(${fillPercent}% + ${8 - fillPercent * 0.16}px)` }}
            >
                <div className="bg-orange-500 text-white text-[10px] font-bold py-0.5 rounded shadow-lg relative">
                    {value}%
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-orange-500 h-0 w-0" />
                </div>
            </div>

            {/* Custom Range Input */}
            <div className="relative h-2 bg-slate-700/80 rounded-full">
                {/* Active Track */}
                <div
                    className="absolute top-0 left-0 h-full bg-orange-500 rounded-full transition-all duration-75"
                    style={{ width: `${fillPercent}%` }}
                />

                {/* Tactile Marks under the track */}
                <div className="absolute top-4 left-0 w-full flex justify-between px-1 pointer-events-none">
                    {marks.map((mark) => (
                        <div key={mark} className="flex flex-col items-center">
                            <div className={`h-1.5 w-px mb-1 ${mark <= value ? "bg-orange-500/50" : "bg-slate-600"}`} />
                        </div>
                    ))}
                </div>

                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    disabled={disabled}
                    onMouseDown={() => setIsDragging(true)}
                    onMouseUp={() => setIsDragging(false)}
                    onTouchStart={() => setIsDragging(true)}
                    onTouchEnd={() => setIsDragging(false)}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                />

                {/* Custom Thumb */}
                <div
                    className={`absolute top-1/2 -mt-2.5 h-5 w-5 rounded-full bg-white shadow-md border-2 
                        ${isDragging ? "border-orange-500 scale-110" : "border-slate-300"} 
                        transition-transform duration-75 pointer-events-none flex items-center justify-center`}
                    style={{ left: `calc(${fillPercent}% - 10px)` }}
                >
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                </div>
            </div>

            {/* Labels */}
            <div className="flex justify-between items-center mt-6 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                <span className={value === 0 ? "text-orange-400" : ""}>Closed (0%)</span>
                <span>{value}%</span>
                <span className={value === 100 ? "text-orange-400" : ""}>Open (100%)</span>
            </div>
        </div>
    );
}
