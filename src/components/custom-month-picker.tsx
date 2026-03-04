"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

type CustomMonthPickerProps = {
    value: string; // Format: "YYYY-MM"
    onChange: (val: string) => void;
    placeholder?: string;
    required?: boolean;
};

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function CustomMonthPicker({ value, onChange, placeholder = "Select Month/Year", required }: CustomMonthPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewYear, setViewYear] = useState(() => {
        if (value) return parseInt(value.split("-")[0], 10);
        return new Date().getFullYear();
    });

    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleMonthSelect = (monthIndex: number) => {
        const monthStr = String(monthIndex + 1).padStart(2, "0");
        onChange(`${viewYear}-${monthStr}`);
        setIsOpen(false);
    };

    const displayValue = value ? (() => {
        const [y, m] = value.split("-");
        const mIdx = parseInt(m, 10) - 1;
        return `${MONTHS[mIdx]} ${y}`;
    })() : "";

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                type="button"
                className={`w-full bg-slate-800 border ${isOpen ? "border-purple-500/50 ring-2 ring-purple-500/50" : "border-slate-700"} rounded-lg px-4 py-2.5 text-left text-white outline-none transition-all flex items-center justify-between ${!value && "text-slate-400"}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>{displayValue || placeholder}</span>
                </div>
            </button>

            {/* hidden input for native form validation if required is true */}
            {required && (
                <input
                    type="text"
                    required
                    value={value}
                    className="absolute opacity-0 w-0 h-0 p-0 m-0 border-0"
                    onChange={() => { }}
                    tabIndex={-1}
                />
            )}

            {isOpen && (
                <div className="absolute z-50 top-calc(100% + 8px) left-0 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            type="button"
                            onClick={() => setViewYear(y => y - 1)}
                            className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <span className="text-white font-medium">{viewYear}</span>
                        <button
                            type="button"
                            onClick={() => setViewYear(y => y + 1)}
                            className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {MONTHS.map((month, idx) => {
                            const isSelected = value === `${viewYear}-${String(idx + 1).padStart(2, "0")}`;
                            return (
                                <button
                                    key={month}
                                    type="button"
                                    onClick={() => handleMonthSelect(idx)}
                                    className={`py-2 rounded-lg text-sm transition-all ${isSelected
                                            ? "bg-purple-600 text-white font-medium shadow-md"
                                            : "text-slate-300 hover:bg-slate-700 hover:text-white"
                                        }`}
                                >
                                    {month}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
