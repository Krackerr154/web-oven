"use client";

import { useState, useEffect, useMemo } from "react";
import { createGloveboxBooking, getMyActiveBookingsCount } from "@/app/actions/booking";
import { useRouter } from "next/navigation";
import {
    CalendarPlus, Loader2, AlertCircle, AlertTriangle, CheckCircle2,
    ShieldAlert, Wind, Package, Droplets, Box
} from "lucide-react";
import DateTimePicker from "@/components/date-time-picker";
import { formatDuration } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { Clock } from "lucide-react";
import { BookingRulesModal } from "@/components/booking-rules-modal";

export default function GloveboxBookPage() {
    const router = useRouter();
    const toast = useToast();

    const [instrumentId, setInstrumentId] = useState<number | null>(null);
    const [maxN2FlowRate, setMaxN2FlowRate] = useState<number | null>(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [hasConflict, setHasConflict] = useState(false);

    // Glovebox specific fields
    const [purpose, setPurpose] = useState("");
    const [equipmentBrought, setEquipmentBrought] = useState("");
    const [chemicalsBrought, setChemicalsBrought] = useState("");
    const [n2FlowRate, setN2FlowRate] = useState<string>("");
    const [n2Duration, setN2Duration] = useState<string>("");
    const [specialNotes, setSpecialNotes] = useState("");

    // UI states
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [activeCount, setActiveCount] = useState<number | null>(null);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [showConfirmPopup, setShowConfirmPopup] = useState(false);

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
        if (diffDays > 1) return "Maximum booking duration for the Glovebox is 1 day";
        return null; // Same day / 1 day is fine
    }, [startDate, endDate]);

    const n2FlowRateWarning = useMemo(() => {
        if (!n2FlowRate) return null;
        const flow = Number(n2FlowRate);
        if (isNaN(flow) || flow < 0) return "Flow rate cannot be negative";
        if (maxN2FlowRate !== null && flow > maxN2FlowRate) {
            return `Flow rate exceeds the maximum allowed (${maxN2FlowRate} LPM)`;
        }
        return null;
    }, [n2FlowRate, maxN2FlowRate]);

    const n2DurationWarning = useMemo(() => {
        if (!n2Duration) return null;
        const dur = Number(n2Duration);
        if (isNaN(dur) || dur < 0) return "Duration cannot be negative";
        if (!Number.isInteger(dur)) return "Duration must be a whole number (minutes)";
        return null;
    }, [n2Duration]);

    const validationIssues = useMemo(() => {
        const issues: { label: string; ok: boolean }[] = [];

        // Time
        issues.push({ label: "Pick a start date & time", ok: !!startDate });
        issues.push({ label: "Pick an end date & time", ok: !!endDate });
        if (durationWarning) {
            issues.push({ label: durationWarning, ok: false });
        } else if (startDate && endDate) {
            issues.push({ label: "Duration is valid (≤ 1 day)", ok: true });
        }
        if (hasConflict) issues.push({ label: "Booking conflicts with existing reservation", ok: false });

        // Form
        issues.push({ label: purpose.trim().length >= 3 ? "Job description provided" : "Enter a job description (min 3 chars)", ok: purpose.trim().length >= 3 });
        issues.push({ label: equipmentBrought.trim().length >= 1 ? "Equipment specified" : "Specify equipment brought inside (or '-')", ok: equipmentBrought.trim().length >= 1 });
        issues.push({ label: chemicalsBrought.trim().length >= 1 ? "Chemicals specified" : "Specify chemicals brought inside (or '-')", ok: chemicalsBrought.trim().length >= 1 });

        // Nitrogen
        if (n2FlowRate && n2FlowRateWarning) issues.push({ label: n2FlowRateWarning, ok: false });
        if (n2Duration && n2DurationWarning) issues.push({ label: n2DurationWarning, ok: false });

        return issues;
    }, [
        startDate, endDate, durationWarning, hasConflict,
        purpose, equipmentBrought, chemicalsBrought,
        n2FlowRate, n2Duration, n2FlowRateWarning, n2DurationWarning
    ]);

    const canSubmit = !loading && validationIssues.every((i) => i.ok);

    useEffect(() => {
        fetch("/api/instruments")
            .then((r) => r.json())
            .then((instruments: { id: number; type: string; name: string; maxN2FlowRate: number | null }[]) => {
                const glovebox = instruments.find((i) => i.type === "GLOVEBOX");
                if (glovebox) {
                    setInstrumentId(glovebox.id);
                    setMaxN2FlowRate(glovebox.maxN2FlowRate ?? null);
                } else {
                    setError("Glovebox instrument not found. Please contact an administrator.");
                }
            })
            .catch(() => setError("Failed to load instrument data"));

        getMyActiveBookingsCount().then(setActiveCount);
    }, []);

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

        const result = await createGloveboxBooking({
            instrumentId,
            startDate,
            endDate,
            purpose,
            equipmentBrought,
            chemicalsBrought,
            n2FlowRate: n2FlowRate ? Number(n2FlowRate) : undefined,
            n2Duration: n2Duration ? Number(n2Duration) : undefined,
            specialNotes: specialNotes || undefined,
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
        <div className="space-y-6 animate-fade-in relative max-w-4xl mx-auto">

            {/* ── Post-use reminder confirmation popup ────────────────── */}
            {showConfirmPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4">
                    <div className="bg-slate-800 border border-emerald-500/30 rounded-2xl p-7 max-w-sm w-full shadow-2xl animate-toast-in">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-emerald-500/15 shrink-0">
                                <ShieldAlert className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white">Before You Book</h2>
                                <p className="text-xs text-slate-400">Please acknowledge the strict glovebox rules</p>
                            </div>
                        </div>

                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3.5 mb-5 space-y-2">
                            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Post-use checklist</p>
                            {[
                                "Do NOT leave any trash, tissues, or samples inside.",
                                "Do NOT store any solutions or solvents inside the glovebox.",
                                "Ensure the nitrogen gas supply is completely turned OFF.",
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm text-emerald-100/90 leading-tight">
                                    <span className="text-emerald-400 shadow-sm font-bold mt-0.5 shrink-0">{i + 1}.</span>
                                    {item}
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={handleConfirmedBooking}
                                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
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
                        <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Booking Confirmed!</h2>
                        <p className="text-slate-400 text-sm mb-6">Your glovebox session has been scheduled.</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => router.push("/my-bookings")}
                                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">
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
                                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 shadow-inner">
                        <Box className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Acrylic Glovebox Booking</h1>
                        <p className="text-slate-400 mt-0.5 text-sm">Same-day booking · Online logbook only</p>
                    </div>
                </div>
                <BookingRulesModal variant="glovebox" />
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-6">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}

                {/* ── Section 1: Time & Date ──────────────────────────────── */}
                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider pl-1 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Schedule
                    </h2>

                    <DateTimePicker
                        instrumentId={instrumentId}
                        instruments={instrumentId ? [{ id: instrumentId, name: "Acrylic Glovebox", type: "GLOVEBOX" }] : []}
                        startValue={startDate}
                        endValue={endDate}
                        onStartChange={setStartDate}
                        onEndChange={setEndDate}
                        onConflict={setHasConflict}
                        maxDays={1}
                        accentColor="emerald"
                    />

                    {(startDate || endDate) && (
                        <div className={`rounded-xl bg-slate-900/40 backdrop-blur-md shadow-sm border ${durationWarning ? "border-amber-500/30" : "border-slate-700/50"}`}>
                            <div className="flex items-center gap-3 px-5 py-4">
                                <Clock className="h-4 w-4 text-emerald-500 shrink-0" />
                                <span className="text-sm text-slate-300">
                                    Duration: <span className="font-medium text-white">{duration}</span>
                                </span>
                            </div>
                            {durationWarning && (
                                <div className="flex items-center gap-2 mx-3 mb-3 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                                    <span className="font-medium">{durationWarning}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Section 2: Materials & Purpose ──────────────────────── */}
                <div className="space-y-4 pt-4 border-t border-slate-700/50">
                    <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider pl-1 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Materials & Work Plan
                    </h2>

                    <div className="bg-slate-900/40 backdrop-blur-md shadow-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6 space-y-6">

                        <div>
                            <label htmlFor="purpose" className="block text-sm font-medium text-slate-300 mb-1.5 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                                <span>Deskripsi Pekerjaan (Job Description)</span>
                                <span className="text-xs text-slate-500 font-normal">What are you doing inside?</span>
                            </label>
                            <textarea
                                id="purpose"
                                required
                                rows={2}
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
                                placeholder="e.g., Mixing precursor A and B under inert atmosphere"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="equipment" className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Peralatan yang dibawa masuk
                                </label>
                                <input
                                    id="equipment"
                                    required
                                    type="text"
                                    value={equipmentBrought}
                                    onChange={(e) => setEquipmentBrought(e.target.value)}
                                    placeholder="e.g., Spatula, Beaker 50mL (or '-' if none)"
                                    className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                />
                                <p className="text-xs text-slate-500 mt-1.5 leading-snug">List all equipment brought inside. <strong>You must clean up and take them out after use.</strong></p>
                            </div>

                            <div>
                                <label htmlFor="chemicals" className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Chemicals yang dibawa masuk
                                </label>
                                <input
                                    id="chemicals"
                                    required
                                    type="text"
                                    value={chemicalsBrought}
                                    onChange={(e) => setChemicalsBrought(e.target.value)}
                                    placeholder="e.g., Toluene, KOH (or '-' if none)"
                                    className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                />
                                <p className="text-xs text-slate-500 mt-1.5 leading-snug">List all chemicals used. <strong>No chemical storage is allowed inside the glovebox.</strong></p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Section 3: Nitrogen Usage ───────────────────────────── */}
                <div className="space-y-4 pt-4 border-t border-slate-700/50">
                    <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider pl-1 flex items-center gap-2">
                        <Wind className="w-4 h-4" /> Nitrogen Gas Usage
                    </h2>

                    <div className="bg-slate-900/40 backdrop-blur-md shadow-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="n2flow" className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Laju alir N₂ (LPM) <span className="text-slate-500 font-normal">(Optional)</span>
                                </label>
                                <input
                                    id="n2flow"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={n2FlowRate}
                                    onChange={(e) => setN2FlowRate(e.target.value)}
                                    placeholder={maxN2FlowRate ? `Max ${maxN2FlowRate} LPM` : "e.g., 5.0"}
                                    className={`w-full px-3 py-2.5 rounded-lg bg-slate-900 border text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${n2FlowRateWarning ? "border-red-500/60 focus:border-red-500" : "border-slate-600 focus:border-emerald-500"
                                        }`}
                                />
                                {n2FlowRateWarning ? (
                                    <div className="flex items-center gap-2 mt-2 text-sm text-red-300 bg-red-500/15 border border-red-500/30 rounded-lg px-2 py-1.5">
                                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                                        <span className="font-medium text-xs">{n2FlowRateWarning}</span>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 mt-1.5 leading-snug">Flow rate in Liters Per Minute.</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="n2duration" className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Total Durasi Pengaliran (menit) <span className="text-slate-500 font-normal">(Optional)</span>
                                </label>
                                <input
                                    id="n2duration"
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={n2Duration}
                                    onChange={(e) => setN2Duration(e.target.value)}
                                    placeholder="e.g., 15"
                                    className={`w-full px-3 py-2.5 rounded-lg bg-slate-900 border text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${n2DurationWarning ? "border-red-500/60 focus:border-red-500" : "border-slate-600 focus:border-emerald-500"
                                        }`}
                                />
                                {n2DurationWarning && (
                                    <div className="flex items-center gap-2 mt-2 text-sm text-red-300 bg-red-500/15 border border-red-500/30 rounded-lg px-2 py-1.5">
                                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                                        <span className="font-medium text-xs">{n2DurationWarning}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="notes" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Catatan Khusus (Special Notes) <span className="text-slate-500 font-normal">(Optional)</span>
                            </label>
                            <textarea
                                id="notes"
                                rows={2}
                                value={specialNotes}
                                onChange={(e) => setSpecialNotes(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
                                placeholder="Any irregularities or incidents during usage?"
                            />
                        </div>
                    </div>
                </div>

                {/* Validation checklist */}
                <div className="bg-slate-900/60 backdrop-blur-md shadow-inner border border-slate-800 rounded-xl p-4 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 pl-1">Booking Checklist</p>
                    {validationIssues.map((item, i) => (
                        <div key={i} className={`flex items-center gap-2 text-xs ${item.ok ? "text-emerald-400" : "text-slate-500"}`}>
                            <span className={`shrink-0 ${item.ok ? "text-emerald-400" : "text-red-400"}`}>
                                {item.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            </span>
                            <span className={item.ok ? "opacity-100 font-medium" : "opacity-80"}>{item.label}</span>
                        </div>
                    ))}
                </div>

                {/* Submit button */}
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full py-3.5 mt-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex justify-center items-center shadow-lg shadow-emerald-500/20"
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" /> Saving...
                        </span>
                    ) : (
                        "Book Glovebox"
                    )}
                </button>
            </form>
        </div>
    );
}
