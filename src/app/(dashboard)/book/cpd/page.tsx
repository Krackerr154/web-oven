"use client";

import { useState, useEffect, useMemo } from "react";
import { createCPDBooking, getMyActiveBookingsCount, getMyInstrumentBan } from "@/app/actions/booking";
import { useRouter } from "next/navigation";
import {
    CalendarPlus, Loader2, AlertCircle, AlertTriangle, CheckCircle2,
    ShieldAlert, Snowflake, Beaker, Settings2
} from "lucide-react";
import DateTimePicker from "@/components/date-time-picker";
import { formatDuration } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { Clock } from "lucide-react";
import { BookingRulesModal } from "@/components/booking-rules-modal";

export default function CpdBookPage() {
    const router = useRouter();
    const toast = useToast();

    const [instrumentId, setInstrumentId] = useState<number | null>(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [hasConflict, setHasConflict] = useState(false);
    const [banInfo, setBanInfo] = useState<{ instrumentName: string; reason: string | null } | null>(null);

    // CPD specific fields
    const [purpose, setPurpose] = useState("");
    const [sample, setSample] = useState("");
    const [cpdMode, setCpdMode] = useState<"AUTO" | "MANUAL">("AUTO");
    const [cpdModeDetails, setCpdModeDetails] = useState("");

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
        if (diffDays > 1) return "Maximum booking duration for CPD is 1 day";
        return null;
    }, [startDate, endDate]);

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
        issues.push({ label: sample.trim().length >= 1 ? "Sample described" : "Describe your sample", ok: sample.trim().length >= 1 });
        issues.push({ label: purpose.trim().length >= 3 ? "Purpose / reason provided" : "Enter purpose (min 3 chars)", ok: purpose.trim().length >= 3 });
        issues.push({ label: "CPD mode selected", ok: true }); // always valid, default is AUTO

        return issues;
    }, [
        startDate, endDate, durationWarning, hasConflict,
        sample, purpose
    ]);

    const canSubmit = !loading && validationIssues.every((i) => i.ok);

    useEffect(() => {
        fetch("/api/instruments")
            .then((r) => r.json())
            .then((instruments: { id: number; type: string; name: string }[]) => {
                const cpd = instruments.find((i) => i.type === "CPD");
                if (cpd) {
                    setInstrumentId(cpd.id);
                    getMyInstrumentBan(cpd.type as any).then((ban) => { if (ban) setBanInfo(ban); });
                } else {
                    setError("CPD instrument not found. Please contact an administrator.");
                }
            })
            .catch(() => setError("Failed to load instrument data"));

        getMyActiveBookingsCount().then(setActiveCount);
    }, []);

    function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!canSubmit || !instrumentId) return;
        setShowConfirmPopup(true);
    }

    async function handleConfirmedBooking() {
        if (!instrumentId) return;
        setShowConfirmPopup(false);
        setError("");
        setLoading(true);

        const result = await createCPDBooking({
            instrumentId,
            startDate,
            endDate,
            purpose,
            sample,
            cpdMode,
            cpdModeDetails: cpdModeDetails || undefined,
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

            {/* Ban blocker */}
            {banInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4">
                    <div className="bg-slate-800 border border-red-500/30 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-toast-in">
                        <div className="h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                            <AlertTriangle className="h-8 w-8 text-red-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Access Suspended</h2>
                        <p className="text-slate-400 text-sm mb-2">
                            You have been suspended from booking <strong className="text-red-300">{banInfo.instrumentName}</strong>.
                        </p>
                        {banInfo.reason && (
                            <p className="text-xs text-red-300/80 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                Reason: {banInfo.reason}
                            </p>
                        )}
                        <p className="text-xs text-slate-500 mb-6">Contact an administrator for more information.</p>
                        <button onClick={() => router.push("/")} className="w-full py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors">
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            )}

            {/* ── Post-use reminder confirmation popup ────────────────── */}
            {showConfirmPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4">
                    <div className="bg-slate-800 border border-purple-500/30 rounded-2xl p-7 max-w-sm w-full shadow-2xl animate-toast-in">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-purple-500/15 shrink-0">
                                <ShieldAlert className="h-6 w-6 text-purple-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white">Before You Book</h2>
                                <p className="text-xs text-slate-400">Please acknowledge the CPD post-use rules</p>
                            </div>
                        </div>

                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3.5 mb-5 space-y-2">
                            <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">Post-use checklist</p>
                            {[
                                "Chamber must be clean and dry after use.",
                                "LCO₂ cylinder valve must be closed.",
                                "Sample holder cleaned with ethanol before returning.",
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm text-purple-100/90 leading-tight">
                                    <span className="text-purple-400 shadow-sm font-bold mt-0.5 shrink-0">{i + 1}.</span>
                                    {item}
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={handleConfirmedBooking}
                                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
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
                        <div className="h-16 w-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
                            <CheckCircle2 className="h-8 w-8 text-purple-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Booking Submitted!</h2>
                        <p className="text-slate-400 text-sm mb-6">Your CPD session has been scheduled. Await admin approval.</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => router.push("/my-bookings")}
                                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors">
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
                                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors">
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
                    <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 shrink-0 shadow-inner">
                        <Snowflake className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">CPD Tousimis Booking</h1>
                        <p className="text-slate-400 mt-0.5 text-sm">Critical Point Dryer · Book 1 week in advance</p>
                    </div>
                </div>
                <BookingRulesModal variant="cpd" />
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
                    <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider pl-1 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Schedule
                    </h2>

                    <DateTimePicker
                        instrumentId={instrumentId}
                        instruments={instrumentId ? [{ id: instrumentId, name: "CPD Tousimis", type: "CPD" }] : []}
                        startValue={startDate}
                        endValue={endDate}
                        onStartChange={setStartDate}
                        onEndChange={setEndDate}
                        onConflict={setHasConflict}
                        maxDays={1}
                        accentColor="purple"
                    />

                    {(startDate || endDate) && (
                        <div className={`rounded-xl bg-slate-900/40 backdrop-blur-md shadow-sm border ${durationWarning ? "border-amber-500/30" : "border-slate-700/50"}`}>
                            <div className="flex items-center gap-3 px-5 py-4">
                                <Clock className="h-4 w-4 text-purple-500 shrink-0" />
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

                {/* ── Section 2: Sample & Purpose ──────────────────────── */}
                <div className="space-y-4 pt-4 border-t border-slate-700/50">
                    <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider pl-1 flex items-center gap-2">
                        <Beaker className="w-4 h-4" /> Sample & Purpose
                    </h2>

                    <div className="bg-slate-900/40 backdrop-blur-md shadow-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6 space-y-6">

                        <div>
                            <label htmlFor="sample" className="block text-sm font-medium text-slate-300 mb-1.5 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                                <span>Sample Description</span>
                                <span className="text-xs text-slate-500 font-normal">What material will be processed?</span>
                            </label>
                            <input
                                id="sample"
                                required
                                type="text"
                                value={sample}
                                onChange={(e) => setSample(e.target.value)}
                                placeholder="e.g., MOF, Aerogel, Silica Gel"
                                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                            />
                            <p className="text-xs text-slate-500 mt-1.5 leading-snug">
                                <strong className="text-red-400">Important:</strong> Samples must be acid-free (no HF, HCl, H₂SO₄, HCOOH, CH₃COOH, etc.)
                            </p>
                        </div>

                        <div>
                            <label htmlFor="purpose" className="block text-sm font-medium text-slate-300 mb-1.5 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                                <span>Purpose / Reason</span>
                                <span className="text-xs text-slate-500 font-normal">Why are you using the CPD?</span>
                            </label>
                            <textarea
                                id="purpose"
                                required
                                rows={2}
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none"
                                placeholder="e.g., Supercritical drying of MOF samples for BET analysis"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Section 3: CPD Mode ───────────────────────────── */}
                <div className="space-y-4 pt-4 border-t border-slate-700/50">
                    <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider pl-1 flex items-center gap-2">
                        <Settings2 className="w-4 h-4" /> CPD Mode
                    </h2>

                    <div className="bg-slate-900/40 backdrop-blur-md shadow-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6 space-y-6">

                        {/* Mode selector */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-3">Operating Mode</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setCpdMode("AUTO")}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${cpdMode === "AUTO"
                                        ? "border-purple-500 bg-purple-500/10 text-white shadow-lg shadow-purple-500/10"
                                        : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg ${cpdMode === "AUTO" ? "bg-purple-500/20" : "bg-slate-800"}`}>
                                        <Settings2 className={`h-5 w-5 ${cpdMode === "AUTO" ? "text-purple-400" : "text-slate-500"}`} />
                                    </div>
                                    <span className="text-sm font-semibold">Auto</span>
                                    <span className="text-[11px] text-slate-500 text-center leading-tight">Factory default parameters</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setCpdMode("MANUAL")}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${cpdMode === "MANUAL"
                                        ? "border-purple-500 bg-purple-500/10 text-white shadow-lg shadow-purple-500/10"
                                        : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg ${cpdMode === "MANUAL" ? "bg-purple-500/20" : "bg-slate-800"}`}>
                                        <Settings2 className={`h-5 w-5 ${cpdMode === "MANUAL" ? "text-purple-400" : "text-slate-500"}`} />
                                    </div>
                                    <span className="text-sm font-semibold">Manual</span>
                                    <span className="text-[11px] text-slate-500 text-center leading-tight">Custom parameters</span>
                                </button>
                            </div>
                        </div>

                        {/* Mode details */}
                        <div>
                            <label htmlFor="modeDetails" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Mode Details <span className="text-slate-500 font-normal">(Optional)</span>
                            </label>
                            <input
                                id="modeDetails"
                                type="text"
                                value={cpdModeDetails}
                                onChange={(e) => setCpdModeDetails(e.target.value)}
                                placeholder={cpdMode === "AUTO" ? 'e.g., factory default' : 'e.g., custom purge cycles, specific temperature'}
                                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                            />
                            <p className="text-xs text-slate-500 mt-1.5 leading-snug">Describe your specific CPD parameters or settings if applicable.</p>
                        </div>
                    </div>
                </div>

                {/* Validation checklist */}
                <div className="bg-slate-900/60 backdrop-blur-md shadow-inner border border-slate-800 rounded-xl p-4 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 pl-1">Booking Checklist</p>
                    {validationIssues.map((item, i) => (
                        <div key={i} className={`flex items-center gap-2 text-xs ${item.ok ? "text-purple-400" : "text-slate-500"}`}>
                            <span className={`shrink-0 ${item.ok ? "text-purple-400" : "text-red-400"}`}>
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
                    className="w-full py-3.5 mt-4 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex justify-center items-center shadow-lg shadow-purple-500/20"
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" /> Saving...
                        </span>
                    ) : (
                        "Book CPD Tousimis"
                    )}
                </button>
            </form>
        </div>
    );
}
