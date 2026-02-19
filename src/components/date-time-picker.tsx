"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Clock, AlertTriangle } from "lucide-react";
import { formatDateTimeWib } from "@/lib/utils";
import TimePicker from "@/components/time-picker";

// ─── Types ───────────────────────────────────────────────────────────

type BookingSlot = {
    start: string;
    end: string;
    title: string;
    ovenId: number;
    color: string;
    extendedProps: {
        ovenName: string;
        ovenType: string;
        userName: string;
        purpose: string;
        usageTemp: number;
        flap: number;
        isOwn: boolean;
    };
};

type OvenInfo = {
    id: number;
    name: string;
    type: string;
};

type DateTimePickerProps = {
    ovenId: number | null;
    ovens: OvenInfo[];
    startValue: string;
    endValue: string;
    onStartChange: (v: string) => void;
    onEndChange: (v: string) => void;
    onConflict?: (hasConflict: boolean) => void;
};

type SelectionStep = "start" | "end";

type DayBookingDetail = {
    userName: string;
    ovenName: string;
    purpose: string;
    usageTemp: number;
    flap: number;
    start: string;
    end: string;
    color: string;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

// Distinct per-oven color palette
const OVEN_COLORS = [
    "#ea580c", "#06b6d4", "#16a34a", "#a855f7",
    "#ec4899", "#14b8a6", "#eab308", "#6366f1",
];

function getOvenColor(ovenId: number, ovens: OvenInfo[]): string {
    const idx = ovens.findIndex((o) => o.id === ovenId);
    return OVEN_COLORS[idx >= 0 ? idx % OVEN_COLORS.length : 0];
}

// ─── Helpers ─────────────────────────────────────────────────────────

function toWibDate(d: Date): { year: number; month: number; day: number } {
    const s = d.toLocaleString("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
    const [monthStr, dayStr, yearStr] = s.split("/");
    return { year: +yearStr, month: +monthStr, day: +dayStr };
}

function toWibHourMinute(d: Date): { hour: number; minute: number } {
    const s = d.toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false });
    const [h, m] = s.split(":");
    return { hour: +h, minute: +m };
}

function dateKey(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonthDays(year: number, month: number) {
    return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
    const d = new Date(year, month - 1, 1).getDay();
    return d === 0 ? 6 : d - 1;
}

function isPastDate(key: string, todayKey: string) {
    return key < todayKey;
}

/** Check if two time ranges overlap */
function rangesOverlap(s1: Date, e1: Date, s2: Date, e2: Date): boolean {
    return s1 < e2 && s2 < e1;
}

// ─── Component ───────────────────────────────────────────────────────

export default function DateTimePicker({
    ovenId,
    ovens,
    startValue,
    endValue,
    onStartChange,
    onEndChange,
    onConflict,
}: DateTimePickerProps) {
    const now = new Date();
    const todayWib = toWibDate(now);
    const nowWibTime = toWibHourMinute(now);
    const todayKey = dateKey(todayWib.year, todayWib.month, todayWib.day);

    // Minimum start time for today: next full hour (or current hour if at :00)
    const minStartTimeToday = useMemo(() => {
        const h = nowWibTime.minute > 0 ? nowWibTime.hour + 1 : nowWibTime.hour;
        if (h >= 24) return "23:00";
        return `${String(h).padStart(2, "0")}:00`;
    }, [nowWibTime.hour, nowWibTime.minute]);

    const [viewYear, setViewYear] = useState(todayWib.year);
    const [viewMonth, setViewMonth] = useState(todayWib.month);
    const [step, setStep] = useState<SelectionStep>("start");
    const [bookings, setBookings] = useState<BookingSlot[]>([]);
    const [loading, setLoading] = useState(false);

    const [startTime, setStartTime] = useState("08:00");
    const [endTime, setEndTime] = useState("17:00");
    const [startDateKey, setStartDateKey] = useState("");
    const [endDateKey, setEndDateKey] = useState("");

    // Hover popover state
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);
    const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
    const calendarRef = useRef<HTMLDivElement>(null);

    // ─── Fetch bookings ────────────────────────────────────────────
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
        setStartDateKey("");
        setEndDateKey("");
        setStep("start");
        onStartChange("");
        onEndChange("");
    }, [fetchBookings]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Build date → booking details map ──────────────────────────
    const bookedDatesMap = useMemo(() => {
        const map = new Map<string, DayBookingDetail[]>();

        for (const b of bookings) {
            const start = new Date(b.start);
            const end = new Date(b.end);
            const color = getOvenColor(b.ovenId, ovens);

            const cursor = new Date(start);
            while (cursor < end) {
                const wib = toWibDate(cursor);
                const key = dateKey(wib.year, wib.month, wib.day);

                const existing = map.get(key) || [];
                // Avoid duplicate entries for same booking on same day
                if (!existing.find((e) => e.start === b.start && e.ovenName === b.extendedProps.ovenName)) {
                    existing.push({
                        userName: b.extendedProps.userName,
                        ovenName: b.extendedProps.ovenName,
                        purpose: b.extendedProps.purpose,
                        usageTemp: b.extendedProps.usageTemp,
                        flap: b.extendedProps.flap,
                        start: b.start,
                        end: b.end,
                        color,
                    });
                }
                map.set(key, existing);

                cursor.setDate(cursor.getDate() + 1);
                cursor.setHours(0, 0, 0, 0);
            }
        }

        return map;
    }, [bookings, ovens]);

    // ─── Conflict detection ────────────────────────────────────────
    const conflictWarning = useMemo(() => {
        if (!startValue || !endValue || !ovenId) return null;
        const selStart = new Date(startValue);
        const selEnd = new Date(endValue);
        if (isNaN(selStart.getTime()) || isNaN(selEnd.getTime())) return null;

        for (const b of bookings) {
            const bStart = new Date(b.start);
            const bEnd = new Date(b.end);
            if (rangesOverlap(selStart, selEnd, bStart, bEnd)) {
                return `Conflicts with booking: ${b.extendedProps.ovenName} by ${b.extendedProps.userName} (${formatDateTimeWib(b.start)} – ${formatDateTimeWib(b.end)})`;
            }
        }
        return null;
    }, [startValue, endValue, ovenId, bookings]);

    // Notify parent about conflict state
    useEffect(() => {
        onConflict?.(!!conflictWarning);
    }, [conflictWarning]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Past time detection ───────────────────────────────────────
    const pastTimeWarning = useMemo(() => {
        if (!startDateKey || startDateKey !== todayKey) return null;
        const [h, m] = startTime.split(":").map(Number);
        if (h < nowWibTime.hour || (h === nowWibTime.hour && m <= nowWibTime.minute)) {
            return "Start time is in the past";
        }
        return null;
    }, [startDateKey, startTime, todayKey, nowWibTime.hour, nowWibTime.minute]);

    // ─── Month navigation ─────────────────────────────────────────
    function prevMonth() {
        if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
        else { setViewMonth((m) => m - 1); }
    }

    function nextMonth() {
        if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
        else { setViewMonth((m) => m + 1); }
    }

    // ─── Date click / hover handlers ───────────────────────────────
    function handleDateClick(key: string) {
        if (isPastDate(key, todayKey)) return;

        if (step === "start") {
            // Auto-set start time to next full hour if today
            const effectiveStartTime = key === todayKey ? minStartTimeToday : startTime;
            if (key === todayKey) setStartTime(effectiveStartTime);

            setStartDateKey(key);
            setEndDateKey("");
            onStartChange(`${key}T${effectiveStartTime}`);
            onEndChange("");
            setStep("end");
        } else {
            if (key < startDateKey) {
                const effectiveStartTime = key === todayKey ? minStartTimeToday : startTime;
                if (key === todayKey) setStartTime(effectiveStartTime);

                setStartDateKey(key);
                setEndDateKey("");
                onStartChange(`${key}T${effectiveStartTime}`);
                onEndChange("");
                return;
            }
            setEndDateKey(key);
            onEndChange(`${key}T${endTime}`);
            setStep("start");
        }
    }

    function handleCellHover(key: string, e: React.MouseEvent | React.TouchEvent) {
        const details = bookedDatesMap.get(key);
        if (!details || details.length === 0) { setHoveredDate(null); return; }

        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const calRect = calendarRef.current?.getBoundingClientRect();
        setHoverPos({
            x: rect.left - (calRect?.left || 0) + rect.width / 2,
            y: rect.top - (calRect?.top || 0) - 8,
        });
        setHoveredDate(key);
    }

    // ─── Time change handlers ─────────────────────────────────────
    function handleStartTimeChange(time: string) {
        // Clamp to minimum allowed time if today
        if (startDateKey === todayKey && time < minStartTimeToday) {
            setStartTime(minStartTimeToday);
            onStartChange(`${startDateKey}T${minStartTimeToday}`);
            return;
        }
        setStartTime(time);
        if (startDateKey) onStartChange(`${startDateKey}T${time}`);
    }

    function handleEndTimeChange(time: string) {
        setEndTime(time);
        if (endDateKey) onEndChange(`${endDateKey}T${time}`);
    }

    // ─── Build calendar grid ──────────────────────────────────────
    const totalDays = getMonthDays(viewYear, viewMonth);
    const firstDow = getFirstDayOfWeek(viewYear, viewMonth);
    const prevMonthDays = viewMonth === 1 ? getMonthDays(viewYear - 1, 12) : getMonthDays(viewYear, viewMonth - 1);

    type CellData = {
        key: string;
        day: number;
        isCurrentMonth: boolean;
        isPast: boolean;
        bookingDetails: DayBookingDetail[];
        isToday: boolean;
        isStart: boolean;
        isEnd: boolean;
        isInRange: boolean;
    };

    const cells: CellData[] = [];

    // Leading days
    for (let i = 0; i < firstDow; i++) {
        const d = prevMonthDays - firstDow + 1 + i;
        const m = viewMonth === 1 ? 12 : viewMonth - 1;
        const y = viewMonth === 1 ? viewYear - 1 : viewYear;
        const key = dateKey(y, m, d);
        cells.push({
            key, day: d, isCurrentMonth: false, isPast: isPastDate(key, todayKey),
            bookingDetails: bookedDatesMap.get(key) || [], isToday: key === todayKey,
            isStart: key === startDateKey, isEnd: key === endDateKey,
            isInRange: !!(startDateKey && endDateKey && key > startDateKey && key < endDateKey),
        });
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
        const key = dateKey(viewYear, viewMonth, d);
        cells.push({
            key, day: d, isCurrentMonth: true, isPast: isPastDate(key, todayKey),
            bookingDetails: bookedDatesMap.get(key) || [], isToday: key === todayKey,
            isStart: key === startDateKey, isEnd: key === endDateKey,
            isInRange: !!(startDateKey && endDateKey && key > startDateKey && key < endDateKey),
        });
    }

    // Trailing days
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        const m = viewMonth === 12 ? 1 : viewMonth + 1;
        const y = viewMonth === 12 ? viewYear + 1 : viewYear;
        const key = dateKey(y, m, d);
        cells.push({
            key, day: d, isCurrentMonth: false, isPast: isPastDate(key, todayKey),
            bookingDetails: bookedDatesMap.get(key) || [], isToday: key === todayKey,
            isStart: key === startDateKey, isEnd: key === endDateKey,
            isInRange: !!(startDateKey && endDateKey && key > startDateKey && key < endDateKey),
        });
    }

    const canGoPrev = viewYear > todayWib.year || (viewYear === todayWib.year && viewMonth > todayWib.month);

    // Hovered day details
    const hoveredDetails = hoveredDate ? bookedDatesMap.get(hoveredDate) || [] : [];

    return (
        <div className="space-y-4">
            {/* Calendar */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-5 relative" ref={calendarRef}>
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
                        <button type="button" onClick={prevMonth} disabled={!canGoPrev}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-medium text-slate-200 w-36 text-center">
                            {MONTHS[viewMonth - 1]} {viewYear}
                        </span>
                        <button type="button" onClick={nextMonth}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-0 mb-1">
                    {DAYS.map((d) => (
                        <div key={d} className="text-center text-xs font-medium text-slate-500 py-1.5">{d}</div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-0">
                    {cells.map((cell) => {
                        const isDisabled = cell.isPast || !ovenId;
                        const isSelected = cell.isStart || cell.isEnd;
                        const hasBookings = cell.bookingDetails.length > 0 && cell.isCurrentMonth;

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
                                onMouseEnter={(e) => handleCellHover(cell.key, e)}
                                onMouseLeave={() => setHoveredDate(null)}
                                onTouchStart={(e) => { if (hasBookings) { e.preventDefault(); handleCellHover(cell.key, e); } }}
                                className={cellClass}
                            >
                                <span>{cell.day}</span>
                                {/* Booking dot indicators — show up to 3 dots for multiple bookings */}
                                {hasBookings && (
                                    <span className="absolute bottom-0.5 flex gap-0.5">
                                        {cell.bookingDetails.slice(0, 3).map((det, i) => (
                                            <span
                                                key={i}
                                                className="h-1 w-1 rounded-full"
                                                style={{ backgroundColor: det.color }}
                                            />
                                        ))}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Hover popover */}
                {hoveredDate && hoveredDetails.length > 0 && (
                    <div
                        className="absolute z-50 bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-xl max-w-xs animate-toast-in pointer-events-none"
                        style={{
                            left: `${Math.max(12, Math.min(hoverPos.x - 120, (calendarRef.current?.offsetWidth || 300) - 260))}px`,
                            top: `${Math.max(0, hoverPos.y - (hoveredDetails.length * 70 + 20))}px`,
                        }}
                    >
                        <p className="text-xs font-medium text-slate-400 mb-2">
                            {new Date(hoveredDate + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            {" · "}{hoveredDetails.length} booking{hoveredDetails.length > 1 ? "s" : ""}
                        </p>
                        <div className="space-y-2">
                            {hoveredDetails.map((det, i) => (
                                <div key={i} className="text-xs space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: det.color }} />
                                        <span className="text-white font-medium truncate">{det.ovenName}</span>
                                        <span className="text-slate-500">·</span>
                                        <span className="text-slate-400 truncate">{det.userName}</span>
                                    </div>
                                    <p className="text-slate-500 pl-3.5">
                                        {formatDateTimeWib(det.start)} → {formatDateTimeWib(det.end)}
                                    </p>
                                    <p className="text-slate-500 pl-3.5 truncate">
                                        {det.purpose} · {det.usageTemp}°C · Flap {det.flap}%
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Legend — per oven colors */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-500">
                    {ovens.map((oven, i) => (
                        <div key={oven.id} className="flex items-center gap-1.5">
                            <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: OVEN_COLORS[i % OVEN_COLORS.length] }}
                            />
                            <span>{oven.name}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-md bg-slate-700 ring-1 ring-orange-500/50" />
                        <span>Today</span>
                    </div>
                </div>
            </div>

            {/* Time Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Start */}
                <div className={`bg-slate-800/50 border rounded-xl p-4 transition-all ${startDateKey ? "border-orange-500/40" : "border-slate-700"
                    }`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-orange-400" />
                        <span className="text-sm font-medium text-slate-300">Start</span>
                    </div>
                    {startDateKey ? (
                        <div className="space-y-2">
                            <p className="text-sm text-white font-medium">
                                {new Date(startDateKey + "T00:00").toLocaleDateString("en-US", {
                                    weekday: "short", month: "short", day: "numeric", year: "numeric",
                                })}
                            </p>
                            <TimePicker
                                value={startTime}
                                onChange={handleStartTimeChange}
                                minTime={startDateKey === todayKey ? minStartTimeToday : undefined}
                            />
                            {/* Past time warning — directly below start time */}
                            {pastTimeWarning && (
                                <div className="flex items-center gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                                    <span className="font-medium">{pastTimeWarning}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 italic">Click a date on the calendar</p>
                    )}
                </div>

                {/* End */}
                <div className={`bg-slate-800/50 border rounded-xl p-4 transition-all ${endDateKey
                    ? conflictWarning ? "border-red-500/40" : "border-orange-500/40"
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
                                    weekday: "short", month: "short", day: "numeric", year: "numeric",
                                })}
                            </p>
                            <TimePicker
                                value={endTime}
                                onChange={handleEndTimeChange}
                            />
                            {/* Overlap / conflict warning — directly below end time */}
                            {conflictWarning && (
                                <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/15 border border-red-500/30 rounded-lg px-3 py-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                                    <div>
                                        <p className="font-medium">Booking Conflict</p>
                                        <p className="text-xs text-red-400 mt-0.5">{conflictWarning}</p>
                                    </div>
                                </div>
                            )}
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
