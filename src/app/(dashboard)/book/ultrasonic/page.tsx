"use client";

import { useState, useEffect, useMemo } from "react";
import { createUltrasonicBooking, getMyActiveBookingsCount } from "@/app/actions/booking";
import { useRouter } from "next/navigation";
import {
    CalendarPlus, Loader2, AlertCircle, AlertTriangle, CheckCircle2,
    Waves, Thermometer, Wind, ShieldAlert,
} from "lucide-react";
import DateTimePicker from "@/components/date-time-picker";
import { formatDuration } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { Clock } from "lucide-react";
import { BookingRulesModal } from "@/components/booking-rules-modal";

type SonicatorMode = "SONIC" | "HEAT" | "DEGAS";

const MODES: { id: SonicatorMode; label: string; description: string; icon: React.ElementType; color: string; ring: string; bg: string }[] = [
    {
        id: "SONIC",
        label: "Sonication",
        description: "High-frequency vibration for cleaning, dissolving, or dispersing samples",
        icon: Waves,
        color: "text-cyan-400",
        ring: "ring-cyan-500",
        bg: "bg-cyan-500/10 border-cyan-500/40",
    },
    {
        id: "HEAT",
        label: "Heated Bath",
        description: "Temperature-controlled water bath, up to 60°C",
        icon: Thermometer,
        color: "text-orange-400",
        ring: "ring-orange-500",
        bg: "bg-orange-500/10 border-orange-500/40",
    },
    {
        id: "DEGAS",
        label: "Degassing",
        description: "Remove dissolved gases from solvents prior to chromatography or reaction",
        icon: Wind,
        color: "text-purple-400",
        ring: "ring-purple-500",
        bg: "bg-purple-500/10 border-purple-500/40",
    },
];

const ROOM_TEMP = 25;

export default function UltrasonicBathBookPage() {
    const router = useRouter();
    const toast = useToast();

    const [instrumentId, setInstrumentId] = useState<number | null>(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [hasConflict, setHasConflict] = useState(false);
    const [selectedModes, setSelectedModes] = useState<SonicatorMode[]>([]);
    const [bathTemp, setBathTemp] = useState<string>("");
    const [purpose, setPurpose] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [activeCount, setActiveCount] = useState<number | null>(null);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [showConfirmPopup, setShowConfirmPopup] = useState(false);

    const isHeatMode = selectedModes.includes("HEAT");

    const duration = useMemo(() => {
        if (!startDate || !endDate) return "—";
        return formatDuration(startDate, endDate);
    }, [startDate, endDate]);

    const durationWarning = useMemo(() => {
        if (!startDate || !endDate) return null;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) return "End time must be after start time";
        const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 1) return "Maximum booking duration for the ultrasonic bath is 1 day";
        return null;
    }, [startDate, endDate]);

    const tempWarning = useMemo(() => {
        if (!isHeatMode || !bathTemp) return null;
        const t = Number(bathTemp);
        if (isNaN(t)) return null;
        if (t > 60) return "Bath temperature cannot exceed 60°C";
        if (t < 1) return "Enter a temperature above 0°C";
        return null;
    }, [bathTemp, isHeatMode]);

    const validationIssues = useMemo(() => {
        const issues: { label: string; ok: boolean }[] = [];
        issues.push({ label: "Pick a start date & time", ok: !!startDate });
        issues.push({ label: "Pick an end date & time", ok: !!endDate });
        if (durationWarning) {
            issues.push({ label: durationWarning, ok: false });
        } else if (startDate && endDate) {
            issues.push({ label: "Duration is valid (≤ 1 day)", ok: true });
        }
        if (hasConflict) issues.push({ label: "Booking conflicts with existing reservation", ok: false });
        issues.push({ label: "Select at least one mode (Sonic / Heat / Degas)", ok: selectedModes.length > 0 });
        if (isHeatMode && tempWarning) issues.push({ label: tempWarning, ok: false });
        issues.push({ label: purpose.trim().length >= 3 ? "Purpose provided" : "Enter a purpose (min 3 characters)", ok: purpose.trim().length >= 3 });
        return issues;
    }, [startDate, endDate, durationWarning, hasConflict, selectedModes, isHeatMode, tempWarning, purpose]);

    const canSubmit = !loading && validationIssues.every((i) => i.ok);

    useEffect(() => {
        fetch("/api/instruments")
            .then((r) => r.json())
            .then((instruments: { id: number; type: string }[]) => {
                const bath = instruments.find((i) => i.type === "ULTRASONIC_BATH");
                if (bath) setInstrumentId(bath.id);
                else setError("Ultrasonic bath instrument not found. Please contact an administrator.");
            })
            .catch(() => setError("Failed to load instrument data"));

        getMyActiveBookingsCount().then(setActiveCount);
    }, []);

    function toggleMode(mode: SonicatorMode) {
        setSelectedModes((prev) =>
            prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
        );
    }

    // Step 1: intercept form submit — show the post-use reminder confirmation popup
    function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!canSubmit || !instrumentId) return;
        setShowConfirmPopup(true);
    }

    // Step 2: user confirmed — actually create the booking
    async function handleConfirmedBooking() {
        if (!instrumentId) return;
        setShowConfirmPopup(false);
        setError("");
        setLoading(true);

        const result = await createUltrasonicBooking({
            instrumentId,
            startDate,
            endDate,
            purpose,
            sonicatorModes: selectedModes,
            bathTemp: isHeatMode && bathTemp ? Number(bathTemp) : undefined,
        });

        setLoading(false);

        if (result.success) {
            toast.success(result.message);
            setShowSuccessPopup(true);
        } else {
            setError(result.message);
        }
    }

    return (
        <div className="space-y-6 animate-fade-in relative">

            {/* ── Post-use reminder confirmation popup ────────────────── */}
            {showConfirmPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4">
                    <div className="bg-slate-800 border border-amber-500/30 rounded-2xl p-7 max-w-sm w-full shadow-2xl animate-toast-in">
                        {/* Icon */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-amber-500/15 shrink-0">
                                <ShieldAlert className="h-6 w-6 text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white">Before You Book</h2>
                                <p className="text-xs text-slate-400">Please acknowledge the post-use reminders</p>
                            </div>
                        </div>

                        {/* Reminders */}
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3.5 mb-5 space-y-2">
                            <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1">Post-use checklist</p>
                            {[
                                "Drain the water basin completely after use",
                                "Press the Off button on the back of the unit",
                                "Unplug the power cable from the wall",
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm text-amber-100/80">
                                    <span className="text-amber-400 font-bold mt-0.5 shrink-0">{i + 1}.</span>
                                    {item}
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={handleConfirmedBooking}
                                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <CalendarPlus className="h-4 w-4" />
                                I understand — Confirm Booking
                            </button>
                            <button
                                onClick={() => setShowConfirmPopup(false)}
                                className="w-full py-2 rounded-lg text-slate-400 hover:text-white text-sm transition-colors"
                            >
                                Go back
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Success popup ────────────────────────────────────────── */}
            {showSuccessPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-toast-in">
                        <div className="h-16 w-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
                            <CheckCircle2 className="h-8 w-8 text-cyan-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Booking Confirmed!</h2>
                        <p className="text-slate-400 text-sm mb-6">Your ultrasonic bath session has been scheduled.</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => router.push("/my-bookings")}
                                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors">
                                View My Bookings
                            </button>
                            <button onClick={() => router.push("/")}
                                className="w-full py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors">
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Active booking limit popup ───────────────────────────── */}
            {!showSuccessPopup && activeCount !== null && activeCount >= 1 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-toast-in">
                        <div className="h-16 w-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                            <AlertTriangle className="h-8 w-8 text-amber-500" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Booking Limit Reached</h2>
                        <p className="text-slate-400 text-sm mb-6">
                            You already have 1 active booking. Complete or cancel it before booking again.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => router.push("/my-bookings")}
                                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors">
                                View My Bookings
                            </button>
                            <button onClick={() => router.push("/")}
                                className="w-full py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors">
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
                        <Waves className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Ultrasonic Bath Booking</h1>
                        <p className="text-slate-400 mt-0.5 text-sm">Sonicator Branson · Same-day booking · Digital logbook only</p>
                    </div>
                </div>
                <BookingRulesModal variant="ultrasonic" />
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}

                {/* Date/Time Picker */}
                <DateTimePicker
                    instrumentId={instrumentId}
                    instruments={instrumentId ? [{ id: instrumentId, name: "Sonicator Branson", type: "ULTRASONIC_BATH" }] : []}
                    startValue={startDate}
                    endValue={endDate}
                    onStartChange={setStartDate}
                    onEndChange={setEndDate}
                    onConflict={setHasConflict}
                    maxDays={1}
                />

                {/* Duration display */}
                {(startDate || endDate) && (
                    <div className={`rounded-xl bg-slate-900/40 backdrop-blur-md shadow-lg border ${durationWarning ? "border-amber-500/30" : "border-slate-700/50"}`}>
                        <div className="flex items-center gap-3 px-5 py-4">
                            <Clock className="h-4 w-4 text-slate-500 shrink-0" />
                            <span className="text-sm text-slate-300">
                                Duration: <span className="font-medium text-white">{duration}</span>
                            </span>
                            <span className="text-xs text-slate-500 ml-auto">Same day only</span>
                        </div>
                        {durationWarning && (
                            <div className="flex items-center gap-2 mx-3 mb-3 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                                <span className="font-medium">{durationWarning}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Mode selector */}
                <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-700/50 rounded-2xl p-4 sm:p-6">
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                        Operating Mode <span className="text-slate-500 font-normal">(select all that apply)</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {MODES.map((mode) => {
                            const Icon = mode.icon;
                            const isActive = selectedModes.includes(mode.id);
                            return (
                                <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() => toggleMode(mode.id)}
                                    className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${isActive
                                        ? `${mode.bg} ring-2 ${mode.ring} ring-offset-1 ring-offset-slate-900`
                                        : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
                                        }`}
                                >
                                    <div className={`flex items-center gap-2 ${isActive ? mode.color : "text-slate-400"}`}>
                                        <Icon className="h-5 w-5" />
                                        <span className="font-semibold text-sm">{mode.label}</span>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">{mode.description}</p>
                                </button>
                            );
                        })}
                    </div>

                    {/* Bath temperature — only when HEAT is selected */}
                    {isHeatMode && (
                        <div className="mt-5 pt-5 border-t border-slate-700/50">
                            <label htmlFor="bathTemp" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Bath Temperature (°C)
                                <span className="text-slate-500 font-normal ml-2 text-xs">
                                    Default: room temperature (~{ROOM_TEMP}°C)
                                </span>
                            </label>
                            <input
                                id="bathTemp"
                                type="number"
                                min={1}
                                max={60}
                                step={1}
                                value={bathTemp}
                                onChange={(e) => setBathTemp(e.target.value)}
                                placeholder={`~${ROOM_TEMP}°C (room temperature if not set)`}
                                className={`w-full sm:w-60 px-3 py-2.5 rounded-lg bg-slate-900 border text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 ${tempWarning ? "border-red-500/60" : "border-slate-600"
                                    }`}
                            />
                            {tempWarning && (
                                <div className="flex items-center gap-2 mt-2 text-sm text-red-300 bg-red-500/15 border border-red-500/30 rounded-lg px-3 py-2 w-full sm:w-60">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                                    <span className="font-medium">{tempWarning}</span>
                                </div>
                            )}
                            <p className="text-xs text-slate-500 mt-1.5">Max 60°C for the heated bath</p>
                        </div>
                    )}
                </div>

                {/* Purpose */}
                <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-700/50 rounded-2xl p-4 sm:p-6">
                    <label htmlFor="purpose" className="block text-sm font-medium text-slate-300 mb-1.5 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                        <span>Sample / Purpose</span>
                        <span className="text-xs text-slate-500 font-normal">Format: Sample, Solvent, Treatment</span>
                    </label>
                    <textarea
                        id="purpose"
                        required
                        rows={3}
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 resize-none"
                        placeholder="e.g., UiO-66, ethanol + water, sonication for 30min"
                    />
                </div>

                {/* Validation checklist */}
                <div className="bg-slate-900/60 backdrop-blur-md shadow-inner border border-slate-800 rounded-xl p-4 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Booking requirements</p>
                    {validationIssues.map((item, i) => (
                        <div key={i} className={`flex items-center gap-2 text-xs ${item.ok ? "text-green-400" : "text-slate-500"}`}>
                            <span className={`shrink-0 ${item.ok ? "text-green-400" : "text-red-400"}`}>
                                {item.ok ? "✓" : "✗"}
                            </span>
                            {item.label}
                        </div>
                    ))}
                </div>

                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Creating booking...</>
                    ) : (
                        <><CalendarPlus className="h-4 w-4" />Book Ultrasonic Bath</>
                    )}
                </button>
            </form>
        </div>
    );
}
