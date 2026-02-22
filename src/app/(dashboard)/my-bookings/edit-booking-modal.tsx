"use client";

import { useState, useEffect, useMemo } from "react";
import { updateBooking } from "@/app/actions/booking";
import { useRouter } from "next/navigation";
import { Loader2, Flame, Clock, AlertCircle, AlertTriangle, Edit2 } from "lucide-react";
import DateTimePicker from "@/components/date-time-picker";
import { FlapSlider } from "@/components/flap-slider";
import { formatDuration, toWibDateTimeLocalValue } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/dialog";

type Oven = {
    id: number;
    name: string;
    type: string;
    status: string;
    description: string | null;
    maxTemp: number;
};

export function EditBookingModal({
    booking,
}: {
    booking: {
        id: string;
        createdAt: Date;
        startDate: Date;
        endDate: Date;
        purpose: string;
        usageTemp: number;
        flap: number;
        ovenId: number;
        oven: { name: string; maxTemp: number };
    };
}) {
    const router = useRouter();
    const toast = useToast();

    const [open, setOpen] = useState(false);
    const [ovens, setOvens] = useState<Oven[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Form states initialized with booking data
    const [startDate, setStartDate] = useState(toWibDateTimeLocalValue(booking.startDate));
    const [endDate, setEndDate] = useState(toWibDateTimeLocalValue(booking.endDate));
    const [hasConflict, setHasConflict] = useState(false);
    const [usageTemp, setUsageTemp] = useState(String(booking.usageTemp));
    const [flap, setFlap] = useState(booking.flap);
    const [purpose, setPurpose] = useState(booking.purpose);

    const isLate = new Date().getTime() > new Date(booking.createdAt).getTime() + 15 * 60 * 1000;

    useEffect(() => {
        if (open && ovens.length === 0) {
            fetch("/api/ovens")
                .then((r) => r.json())
                .then(setOvens)
                .catch(() => setError("Failed to load ovens"));
        }
    }, [open, ovens.length]);

    // We only permit editing the existing oven for this user flow, we don't swap ovens.
    const selectedOven = useMemo(
        () => ovens.find((o) => o.id === booking.ovenId) ?? { ...booking.oven, id: booking.ovenId },
        [ovens, booking.oven]
    );

    const duration = useMemo(() => {
        if (!startDate || !endDate) return "—";
        return formatDuration(startDate, endDate);
    }, [startDate, endDate]);

    const durationWarning = useMemo(() => {
        if (!startDate || !endDate) return null;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) return "End date must be after start date";
        const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return "Maximum booking duration is 7 days";
        return null;
    }, [startDate, endDate]);

    const tempWarning = useMemo(() => {
        if (!usageTemp || !selectedOven) return null;
        const t = Number(usageTemp);
        if (isNaN(t)) return null;
        if (t > selectedOven.maxTemp) {
            return `Temperature exceeds ${selectedOven.name} max of ${selectedOven.maxTemp}°C`;
        }
        if (t <= 0) return "Temperature must be greater than 0°C";
        return null;
    }, [usageTemp, selectedOven]);

    const validationIssues = useMemo(() => {
        const issues: { label: string; ok: boolean }[] = [];
        issues.push({ label: "Pick a start date & time", ok: !!startDate });
        issues.push({ label: "Pick an end date & time", ok: !!endDate });

        if (durationWarning) {
            issues.push({ label: durationWarning, ok: false });
        } else if (startDate && endDate) {
            issues.push({ label: "Duration is valid", ok: true });
        }

        if (hasConflict) {
            issues.push({ label: "Booking conflicts with existing reservation", ok: false });
        }

        if (tempWarning) {
            issues.push({ label: tempWarning, ok: false });
        } else if (usageTemp) {
            issues.push({ label: "Temperature is valid", ok: true });
        } else {
            issues.push({ label: "Enter usage temperature", ok: false });
        }

        issues.push({
            label: purpose.trim().length >= 3 ? "Purpose provided" : "Enter a purpose (min 3 characters)",
            ok: purpose.trim().length >= 3,
        });

        return issues;
    }, [startDate, endDate, durationWarning, hasConflict, tempWarning, usageTemp, purpose]);

    const canSubmit = !loading && validationIssues.every((i) => i.ok);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (isLate) {
            setError("The 15-minute edit window has expired.");
            return;
        }

        setError("");
        setLoading(true);

        const result = await updateBooking({
            bookingId: booking.id,
            startDate,
            endDate,
            purpose,
            usageTemp: Number(usageTemp),
            flap,
        });

        setLoading(false);

        if (result.success) {
            toast.success(result.message);
            setOpen(false);
            router.refresh();
        } else {
            setError(result.message);
        }
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                disabled={isLate}
                title={isLate ? "Edit window expired (15m)" : "Edit Booking"}
                className="w-full sm:w-auto text-xs px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors mt-1 mb-1 sm:my-0"
            >
                <Edit2 className="h-3 w-3" />
                Edit
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="mb-4">
                        <DialogTitle>Edit Booking — {booking.oven.name}</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}

                        {isLate && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-300 flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                Editing window has passed (15 minutes from creation). Please contact an admin if you need to make changes.
                            </div>
                        )}

                        {/* Date/Time Picker */}
                        <DateTimePicker
                            ovenId={booking.ovenId}
                            ovens={ovens.length > 0 ? ovens : ([selectedOven] as Oven[])} // Fallback to provided basic info if loading
                            startValue={startDate}
                            endValue={endDate}
                            onStartChange={setStartDate}
                            onEndChange={setEndDate}
                            onConflict={setHasConflict}
                            ignoreBookingId={booking.id}
                        />

                        {(startDate || endDate) && (
                            <div className={`rounded-xl bg-slate-900/40 backdrop-blur-md shadow-lg border ${durationWarning ? "border-amber-500/30" : "border-slate-700/50"}`}>
                                <div className="flex items-center gap-3 px-5 py-4">
                                    <Clock className="h-4 w-4 text-slate-500 shrink-0" />
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

                        {/* Temperature & Flap */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-700/50 rounded-2xl p-4 sm:p-6">
                            <div>
                                <label htmlFor="editUsageTemp" className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Usage Temperature (°C)
                                </label>
                                <input
                                    id="editUsageTemp"
                                    type="number"
                                    required
                                    min={1}
                                    max={selectedOven?.maxTemp ?? 1000}
                                    step={1}
                                    value={usageTemp}
                                    onChange={(e) => setUsageTemp(e.target.value)}
                                    className={`w-full px-3 py-2.5 rounded-lg bg-slate-900 border text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 ${tempWarning ? "border-red-500/60" : "border-slate-600"}`}
                                />
                                {tempWarning && (
                                    <div className="flex items-center gap-2 mt-2 text-sm text-red-300 bg-red-500/15 border border-red-500/30 rounded-lg px-3 py-2">
                                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                                        <span className="font-medium">{tempWarning}</span>
                                    </div>
                                )}
                                {!tempWarning && selectedOven && (
                                    <p className="text-xs text-slate-500 mt-1.5">
                                        Max: {selectedOven.maxTemp}°C
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Damper/Flap Opening
                                </label>
                                <div className="pt-2">
                                    <FlapSlider value={flap} onChange={setFlap} disabled={false} />
                                </div>
                            </div>
                        </div>

                        {/* Purpose */}
                        <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-700/50 rounded-2xl p-4 sm:p-6">
                            <label htmlFor="editPurpose" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Purpose
                            </label>
                            <textarea
                                id="editPurpose"
                                required
                                rows={3}
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none"
                            />
                        </div>

                        <div className="bg-slate-900/60 backdrop-blur-md shadow-inner border border-slate-800 rounded-xl p-4 space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Requirements</p>
                            {validationIssues.map((item, i) => (
                                <div key={i} className={`flex items-center gap-2 text-xs ${item.ok ? "text-green-400" : "text-slate-500"}`}>
                                    <span className={`shrink-0 ${item.ok ? "text-green-400" : "text-red-400"}`}>
                                        {item.ok ? "✓" : "✗"}
                                    </span>
                                    {item.label}
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!canSubmit || isLate}
                                className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit2 className="h-4 w-4" />}
                                Save Changes
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
