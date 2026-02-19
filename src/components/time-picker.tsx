"use client";

import { useState, useRef, useEffect } from "react";
import { Clock } from "lucide-react";

type TimePickerProps = {
    value: string;               // "HH:MM"
    onChange: (time: string) => void;
    minTime?: string;            // "HH:MM" — hours before this are disabled
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function TimePicker({ value, onChange, minTime }: TimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const [selHour, selMinute] = value.split(":").map(Number);
    const minH = minTime ? parseInt(minTime.split(":")[0]) : -1;
    const minM = minTime ? parseInt(minTime.split(":")[1]) : 0;

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClick);
            return () => document.removeEventListener("mousedown", handleClick);
        }
    }, [isOpen]);

    function selectHour(h: number) {
        let m = selMinute;
        // Clamp minute if new hour is the minimum hour
        if (minTime && h === minH && m < minM) {
            // Snap to nearest valid minute
            m = MINUTES.find((v) => v >= minM) ?? 55;
        }
        onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }

    function selectMinute(m: number) {
        onChange(`${String(selHour).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        setIsOpen(false); // Close after picking minute
    }

    function isHourDisabled(h: number) {
        if (minH < 0) return false;
        return h < minH;
    }

    function isMinuteDisabled(m: number) {
        if (minH < 0) return false;
        if (selHour < minH) return true;
        if (selHour === minH) return m < minM;
        return false;
    }

    const pad = (n: number) => String(n).padStart(2, "0");

    return (
        <div ref={ref} className="relative">
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-900 border text-sm transition-all ${isOpen
                    ? "border-orange-500 ring-2 ring-orange-500/40"
                    : "border-slate-600 hover:border-slate-500"
                    }`}
            >
                <Clock className="h-4 w-4 text-orange-400 shrink-0" />
                <span className="font-mono font-semibold text-white tracking-wider text-base">
                    {pad(selHour)}:{pad(selMinute)}
                </span>
                <span className="text-slate-500 text-xs ml-auto">WIB</span>
            </button>

            {/* Dropdown popup */}
            {isOpen && (
                <div className="absolute z-50 mt-2 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
                    {/* Large time display */}
                    <div className="px-4 pt-4 pb-3 border-b border-slate-700/60 text-center">
                        <div className="text-3xl font-mono font-bold text-white tracking-widest">
                            {pad(selHour)}
                            <span className="text-orange-500 animate-pulse">:</span>
                            {pad(selMinute)}
                        </div>
                    </div>

                    <div className="p-4 space-y-3">
                        {/* Hour grid */}
                        <div>
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-2">Hour</p>
                            <div className="grid grid-cols-6 gap-1">
                                {HOURS.map((h) => {
                                    const disabled = isHourDisabled(h);
                                    const selected = h === selHour;
                                    return (
                                        <button
                                            key={h}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => selectHour(h)}
                                            className={`py-1.5 rounded-md text-xs font-medium transition-all ${selected
                                                ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
                                                : disabled
                                                    ? "text-slate-700 cursor-not-allowed"
                                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                                }`}
                                        >
                                            {pad(h)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-slate-700/60" />

                        {/* Minute grid */}
                        <div>
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-2">Minute</p>
                            <div className="grid grid-cols-6 gap-1">
                                {MINUTES.map((m) => {
                                    const disabled = isMinuteDisabled(m);
                                    const selected = m === selMinute;
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => selectMinute(m)}
                                            className={`py-1.5 rounded-md text-xs font-medium transition-all ${selected
                                                ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
                                                : disabled
                                                    ? "text-slate-700 cursor-not-allowed"
                                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                                }`}
                                        >
                                            :{pad(m)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
