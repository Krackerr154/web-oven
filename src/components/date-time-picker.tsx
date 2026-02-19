"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

type BookingSlot = {
    start: string; // ISO
    end: string;   // ISO
    title: string;
    color: string;
};

type DateTimePickerProps = {
    ovenId: number | null;
    startValue: string;      // "YYYY-MM-DDTHH:mm"
    endValue: string;
    onStartChange: (v: string) => void;
    onEndChange: (v: string) => void;
};

type SelectionStep = "start" | "end";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

// ─── Helpers ─────────────────────────────────────────────────────────

function toWibDate(d: Date): { year: number; month: number; day: number } {
    const s = d.toLocaleString("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
    const [monthStr, dayStr, yearStr] = s.split("/");
    return { year: +yearStr, month: +monthStr, day: +dayStr };
}

function dateKey(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonthDays(year: number, month: number) {
    return new Date(year, month, 0).getDate();
}

/** Get the day-of-week (Mon=0, Sun=6) for the 1st of the month */
function getFirstDayOfWeek(year: number, month: number) {
    const d = new Date(year, month - 1, 1).getDay(); // Sun=0
    return d === 0 ? 6 : d - 1; // convert to Mon=0
}

/** Check if a date key is in the past (before today WIB) */
function isPast(key: string, todayKey: string) {
    return key < todayKey;
}

// ─── Component ───────────────────────────────────────────────────────

export default function DateTimePicker({
    ovenId,
    startValue,
    endValue,
    onStartChange,
    onEndChange,
}: DateTimePickerProps) {
    const now = new Date();
    const todayWib = toWibDate(now);
    const todayKey = dateKey(todayWib.year, todayWib.month, todayWib.day);

    const [viewYear, setViewYear] = useState(todayWib.year);
    const [viewMonth, setViewMonth] = useState(todayWib.month);
    const [step, setStep] = useState<SelectionStep>("start");
    const [bookings, setBookings] = useState<BookingSlot[]>([]);
    const [loading, setLoading] = useState(false);

    // Times (separate from date for the two-step flow)
    const [startTime, setStartTime] = useState("08:00");
    const [endTime, setEndTime] = useState("17:00");
    const [startDateKey, setStartDateKey] = useState("");
    const [endDateKey, setEndDateKey] = useState("");

    // ─── Fetch bookings for selected oven ──────────────────────────
    const fetchBookings = useCallback(async () => {
        if (!ovenId) {
            setBookings([]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/bookings?ovenId=${ovenId}`);
            const data = await res.json();
            setBookings(data);
        } catch {
            setBookings([]);
        } finally {
            setLoading(false);
        }
    }, [ovenId]);

    useEffect(() => {
        fetchBookings();
        // Reset selections when oven changes
        setStartDateKey("");
        setEndDateKey("");
        setStep("start");
        onStartChange("");
        onEndChange("");
    }, [fetchBookings]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Build a map of date → bookings ────────────────────────────
    const bookedDatesMap = useMemo(() => {
        const map = new Map<string, { count: number; totalHours: number; color: string }>();

        for (const b of bookings) {
            const start = new Date(b.start);
            const end = new Date(b.end);

            // Walk each day the booking spans
            const cursor = new Date(start);
            while (cursor < end) {
                const wib = toWibDate(cursor);
                const key = dateKey(wib.year, wib.month, wib.day);

                // Calculate hours occupied on this specific day
                const dayStart = new Date(cursor);
                dayStart.setUTCHours(0, 0, 0, 0);
                // Approximate: mark the date as having a booking
                const existing = map.get(key) || { count: 0, totalHours: 0, color: b.color };
                existing.count++;
                existing.totalHours += Math.min(24, (end.getTime() - cursor.getTime()) / (1000 * 60 * 60));
                existing.color = b.color;
                map.set(key, existing);

                // Move to next day
                cursor.setDate(cursor.getDate() + 1);
                cursor.setHours(0, 0, 0, 0);
            }
        }

        return map;
    }, [bookings]);

    // ─── Month navigation ─────────────────────────────────────────
    function prevMonth() {
        if (viewMonth === 1) {
            setViewMonth(12);
            setViewYear((y) => y - 1);
        } else {
            setViewMonth((m) => m - 1);
        }
    }

    function nextMonth() {
        if (viewMonth === 12) {
            setViewMonth(1);
            setViewYear((y) => y + 1);
        } else {
            setViewMonth((m) => m + 1);
        }
    }

    // ─── Date click handler ────────────────────────────────────────
    function handleDateClick(key: string) {
        if (isPast(key, todayKey)) return;

        if (step === "start") {
            setStartDateKey(key);
            setEndDateKey("");
            onStartChange(`${key}T${startTime}`);
            onEndChange("");
            setStep("end");
        } else {
            // End date must be >= start date
            if (key < startDateKey) {
                // Clicked before start — reset and use as new start
                setStartDateKey(key);
                setEndDateKey("");
                onStartChange(`${key}T${startTime}`);
                onEndChange("");
                return;
            }
            setEndDateKey(key);
            onEndChange(`${key}T${endTime}`);
            setStep("start"); // allow re-selection
        }
    }

    // ─── Time change handlers ─────────────────────────────────────
    function handleStartTimeChange(time: string) {
        setStartTime(time);
        if (startDateKey) {
            onStartChange(`${startDateKey}T${time}`);
        }
    }

    function handleEndTimeChange(time: string) {
        setEndTime(time);
        if (endDateKey) {
            onEndChange(`${endDateKey}T${time}`);
        }
    }

    // ─── Build calendar grid ──────────────────────────────────────
    const totalDays = getMonthDays(viewYear, viewMonth);
    const firstDow = getFirstDayOfWeek(viewYear, viewMonth);

    // Previous month padding
    const prevMonthDays = viewMonth === 1 ? getMonthDays(viewYear - 1, 12) : getMonthDays(viewYear, viewMonth - 1);

    const cells: {
        key: string;
        day: number;
        isCurrentMonth: boolean;
        isPast: boolean;
        booking: { count: number; totalHours: number; color: string } | null;
        isToday: boolean;
        isStart: boolean;
        isEnd: boolean;
        isInRange: boolean;
    }[] = [];

    // Fill leading days from previous month
    for (let i = 0; i < firstDow; i++) {
        const d = prevMonthDays - firstDow + 1 + i;
        const m = viewMonth === 1 ? 12 : viewMonth - 1;
        const y = viewMonth === 1 ? viewYear - 1 : viewYear;
        const key = dateKey(y, m, d);
        cells.push({
            key,
            day: d,
            isCurrentMonth: false,
            isPast: isPast(key, todayKey),
            booking: bookedDatesMap.get(key) || null,
            isToday: key === todayKey,
            isStart: key === startDateKey,
            isEnd: key === endDateKey,
            isInRange: startDateKey && endDateKey ? key > startDateKey && key < endDateKey : false,
        });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
        const key = dateKey(viewYear, viewMonth, d);
        cells.push({
            key,
            day: d,
            isCurrentMonth: true,
            isPast: isPast(key, todayKey),
            booking: bookedDatesMap.get(key) || null,
            isToday: key === todayKey,
            isStart: key === startDateKey,
            isEnd: key === endDateKey,
            isInRange: startDateKey && endDateKey ? key > startDateKey && key < endDateKey : false,
        });
    }

    // Fill trailing days from next month
    const remaining = 42 - cells.length; // 6 rows × 7 days
    for (let d = 1; d <= remaining; d++) {
        const m = viewMonth === 12 ? 1 : viewMonth + 1;
        const y = viewMonth === 12 ? viewYear + 1 : viewYear;
        const key = dateKey(y, m, d);
        cells.push({
            key,
            day: d,
            isCurrentMonth: false,
            isPast: isPast(key, todayKey),
            booking: bookedDatesMap.get(key) || null,
            isToday: key === todayKey,
            isStart: key === startDateKey,
            isEnd: key === endDateKey,
            isInRange: startDateKey && endDateKey ? key > startDateKey && key < endDateKey : false,
        });
    }

    // Check if view month is in the past (can't navigate before current month)
    const canGoPrev = viewYear > todayWib.year || (viewYear === todayWib.year && viewMonth > todayWib.month);

    return (
        <div className="space-y-4">
            {/* Calendar Header */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">
                            {step === "start" ? "Select Start Date" : "Select End Date"}
                        </h3>
                        {loading && (
                            <span className="text-xs text-slate-400 animate-pulse">Loading...</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={prevMonth}
                            disabled={!canGoPrev}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-medium text-slate-200 w-36 text-center">
                            {MONTHS[viewMonth - 1]} {viewYear}
                        </span>
                        <button
                            type="button"
                            onClick={nextMonth}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-0 mb-1">
                    {DAYS.map((d) => (
                        <div key={d} className="text-center text-xs font-medium text-slate-500 py-1.5">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-0">
                    {cells.map((cell) => {
                        const isDisabled = cell.isPast || !ovenId;
                        const isSelected = cell.isStart || cell.isEnd;

                        let cellClass = "relative flex flex-col items-center justify-center h-10 sm:h-11 text-sm rounded-lg transition-all ";

                        if (!cell.isCurrentMonth) {
                            cellClass += "text-slate-600 ";
                        } else if (isDisabled) {
                            cellClass += "text-slate-600 cursor-not-allowed ";
                        } else if (isSelected) {
                            cellClass += "bg-orange-500 text-white font-semibold cursor-pointer ";
                        } else if (cell.isInRange) {
                            cellClass += "bg-orange-500/15 text-orange-200 cursor-pointer hover:bg-orange-500/25 ";
                        } else if (cell.isToday) {
                            cellClass += "text-orange-400 font-semibold ring-1 ring-orange-500/50 cursor-pointer hover:bg-slate-700/50 ";
                        } else {
                            cellClass += "text-slate-300 cursor-pointer hover:bg-slate-700/50 ";
                        }

                        return (
                            <button
                                key={cell.key}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => handleDateClick(cell.key)}
                                className={cellClass}
                            >
                                <span>{cell.day}</span>
                                {/* Booking dot indicator */}
                                {cell.booking && cell.isCurrentMonth && (
                                    <span
                                        className="absolute bottom-1 h-1 w-1 rounded-full"
                                        style={{ backgroundColor: cell.booking.color || "#ea580c" }}
                                        title={`${cell.booking.count} booking(s)`}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        <span>Non-Aqueous booking</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <span>Aqueous booking</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-md bg-slate-700 ring-1 ring-orange-500/50" />
                        <span>Today</span>
                    </div>
                </div>
            </div>

            {/* Time Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Start Date + Time */}
                <div className={`bg-slate-800/50 border rounded-xl p-4 transition-all ${startDateKey
                        ? "border-orange-500/40"
                        : "border-slate-700"
                    }`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-orange-400" />
                        <span className="text-sm font-medium text-slate-300">Start</span>
                    </div>
                    {startDateKey ? (
                        <div className="space-y-2">
                            <p className="text-sm text-white font-medium">
                                {new Date(startDateKey + "T00:00").toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </p>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => handleStartTimeChange(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                            />
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 italic">Click a date on the calendar</p>
                    )}
                </div>

                {/* End Date + Time */}
                <div className={`bg-slate-800/50 border rounded-xl p-4 transition-all ${endDateKey
                        ? "border-orange-500/40"
                        : "border-slate-700"
                    }`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-300">End</span>
                    </div>
                    {endDateKey ? (
                        <div className="space-y-2">
                            <p className="text-sm text-white font-medium">
                                {new Date(endDateKey + "T00:00").toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </p>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) => handleEndTimeChange(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                            />
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 italic">
                            {startDateKey ? "Now click an end date" : "Select start first"}
                        </p>
                    )}
                </div>
            </div>

            {/* Hidden inputs for form submission */}
            <input type="hidden" name="startDate" value={startValue} />
            <input type="hidden" name="endDate" value={endValue} />
        </div>
    );
}
