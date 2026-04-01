"use client";

import { useState, useEffect, useMemo } from "react";
import { updateBooking } from "@/app/actions/booking";
import { useRouter } from "next/navigation";
import { Loader2, Clock, AlertCircle, AlertTriangle, Edit2 } from "lucide-react";
import DateTimePicker from "@/components/date-time-picker";
import { FlapSlider } from "@/components/flap-slider";
import { formatDuration, toWibDateTimeLocalValue } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/dialog";

type Instrument = {
    id: number;
    name: string;
    type: string;
    status: string;
    description: string | null;
    maxTemp: number;
};

type BookingData = {
    id: string;
    createdAt: Date;
    startDate: Date;
    endDate: Date;
    purpose: string;
    usageTemp: number | null;
    flap: number | null;
    sonicatorModes: string[];
    equipmentBrought: string | null;
    chemicalsBrought: string | null;
    n2FlowRate: number | null;
    n2Duration: number | null;
    specialNotes: string | null;
    sample: string | null;
    cpdMode: string | null;
    cpdModeDetails: string | null;
    instrumentId: number;
    instrument: { name: string; maxTemp: number; type: string; maxN2FlowRate?: number | null };
};

export function EditBookingModal({ booking }: { booking: BookingData }) {
    const router = useRouter();
    const toast = useToast();

    const [open, setOpen] = useState(false);
    const [instruments, setInstruments] = useState<Instrument[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Common form states
    const [startDate, setStartDate] = useState(toWibDateTimeLocalValue(booking.startDate));
    const [endDate, setEndDate] = useState(toWibDateTimeLocalValue(booking.endDate));
    const [hasConflict, setHasConflict] = useState(false);
    const [purpose, setPurpose] = useState(booking.purpose);

    // Oven fields
    const [usageTemp, setUsageTemp] = useState(String(booking.usageTemp ?? 0));
    const [flap, setFlap] = useState(booking.flap ?? 0);

    // Ultrasonic Bath fields
    const [sonicatorModes, setSonicatorModes] = useState<string[]>(booking.sonicatorModes ?? []);
    const [bathTemp, setBathTemp] = useState(String(booking.usageTemp ?? ""));

    // Glovebox fields
    const [equipmentBrought, setEquipmentBrought] = useState(booking.equipmentBrought ?? "");
    const [chemicalsBrought, setChemicalsBrought] = useState(booking.chemicalsBrought ?? "");
    const [n2FlowRate, setN2FlowRate] = useState(String(booking.n2FlowRate ?? ""));
    const [n2Duration, setN2Duration] = useState(String(booking.n2Duration ?? ""));
    const [specialNotes, setSpecialNotes] = useState(booking.specialNotes ?? "");

    // CPD fields
    const [sample, setSample] = useState(booking.sample ?? "");
    const [cpdMode, setCpdMode] = useState(booking.cpdMode ?? "AUTO");
    const [cpdModeDetails, setCpdModeDetails] = useState(booking.cpdModeDetails ?? "");

    const instrumentType = booking.instrument.type;
    const isLate = new Date().getTime() > new Date(booking.createdAt).getTime() + 60 * 60 * 1000;

    useEffect(() => {
        if (open && instruments.length === 0) {
            fetch("/api/instruments")
                .then((r) => r.json())
                .then(setInstruments)
                .catch(() => setError("Failed to load instruments"));
        }
    }, [open, instruments.length]);

    const selectedInstrument = useMemo(
        () => instruments.find((o) => o.id === booking.instrumentId) ?? { ...booking.instrument, id: booking.instrumentId },
        [instruments, booking.instrument]
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
        const maxDays = instrumentType === "OVEN" ? 7 : 1;
        if (diffDays > maxDays) return `Maximum booking duration is ${maxDays} day(s)`;
        return null;
    }, [startDate, endDate, instrumentType]);

    const tempWarning = useMemo(() => {
        if (instrumentType !== "OVEN" || !usageTemp || !selectedInstrument) return null;
        const t = Number(usageTemp);
        if (isNaN(t)) return null;
        if (t > selectedInstrument.maxTemp) {
            return `Temperature exceeds ${selectedInstrument.name} max of ${selectedInstrument.maxTemp}°C`;
        }
        if (t <= 0) return "Temperature must be greater than 0°C";
        return null;
    }, [usageTemp, selectedInstrument, instrumentType]);

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

        // Instrument-specific validation
        if (instrumentType === "OVEN") {
            if (tempWarning) {
                issues.push({ label: tempWarning, ok: false });
            } else if (usageTemp && Number(usageTemp) > 0) {
                issues.push({ label: "Temperature is valid", ok: true });
            } else {
                issues.push({ label: "Enter usage temperature", ok: false });
            }
        } else if (instrumentType === "ULTRASONIC_BATH") {
            issues.push({
                label: sonicatorModes.length > 0 ? "Mode(s) selected" : "Select at least one mode",
                ok: sonicatorModes.length > 0,
            });
        } else if (instrumentType === "GLOVEBOX") {
            issues.push({
                label: equipmentBrought.trim() ? "Equipment specified" : "Specify equipment brought inside",
                ok: !!equipmentBrought.trim(),
            });
            issues.push({
                label: chemicalsBrought.trim() ? "Chemicals specified" : "Specify chemicals brought inside",
                ok: !!chemicalsBrought.trim(),
            });
        } else if (instrumentType === "CPD") {
            issues.push({
                label: sample.trim() ? "Sample described" : "Describe your sample",
                ok: !!sample.trim(),
            });
            issues.push({
                label: cpdMode ? "CPD mode selected" : "Select CPD mode",
                ok: !!cpdMode,
            });
        }

        issues.push({
            label: purpose.trim().length >= 3 ? "Purpose provided" : "Enter a purpose (min 3 characters)",
            ok: purpose.trim().length >= 3,
        });

        return issues;
    }, [startDate, endDate, durationWarning, hasConflict, tempWarning, usageTemp, purpose, instrumentType, sonicatorModes, equipmentBrought, chemicalsBrought, sample, cpdMode]);

    const canSubmit = !loading && validationIssues.every((i) => i.ok);

    function toggleMode(mode: string) {
        setSonicatorModes((prev) =>
            prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
        );
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (isLate) {
            setError("The 1-hour edit window has expired.");
            return;
        }

        setError("");
        setLoading(true);

        const payload: any = {
            bookingId: booking.id,
            startDate,
            endDate,
            purpose,
        };

        if (instrumentType === "OVEN") {
            payload.usageTemp = Number(usageTemp);
            payload.flap = flap;
        } else if (instrumentType === "ULTRASONIC_BATH") {
            payload.sonicatorModes = sonicatorModes;
            payload.bathTemp = bathTemp ? Number(bathTemp) : undefined;
        } else if (instrumentType === "GLOVEBOX") {
            payload.equipmentBrought = equipmentBrought;
            payload.chemicalsBrought = chemicalsBrought;
            payload.n2FlowRate = n2FlowRate ? Number(n2FlowRate) : undefined;
            payload.n2Duration = n2Duration ? Number(n2Duration) : undefined;
            payload.specialNotes = specialNotes;
        } else if (instrumentType === "CPD") {
            payload.sample = sample;
            payload.cpdMode = cpdMode;
            payload.cpdModeDetails = cpdModeDetails;
        }

        const result = await updateBooking(payload);

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
                title={isLate ? "Edit window expired (1h)" : "Edit Booking"}
                className="w-full sm:w-auto text-xs px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors mt-1 mb-1 sm:my-0"
            >
                <Edit2 className="h-3 w-3" />
                Edit
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="mb-4">
                        <DialogTitle>Edit Booking — {booking.instrument.name}</DialogTitle>
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
                                Editing window has passed (1 hour from creation). Please contact an admin if you need to make changes.
                            </div>
                        )}

                        {/* Date/Time Picker */}
                        <DateTimePicker
                            instrumentId={booking.instrumentId}
                            instruments={instruments.length > 0 ? instruments : ([selectedInstrument] as Instrument[])}
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

                        {/* ── Oven-specific fields ── */}
                        {instrumentType === "OVEN" && (
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
                                        max={selectedInstrument?.maxTemp ?? 1000}
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
                                    {!tempWarning && selectedInstrument && (
                                        <p className="text-xs text-slate-500 mt-1.5">
                                            Max: {selectedInstrument.maxTemp}°C
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
                        )}

                        {/* ── Ultrasonic Bath fields ── */}
                        {instrumentType === "ULTRASONIC_BATH" && (
                            <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-700/50 rounded-2xl p-4 sm:p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Modes</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(["SONIC", "HEAT", "DEGAS"] as const).map((mode) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => toggleMode(mode)}
                                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${sonicatorModes.includes(mode)
                                                    ? "bg-orange-500/20 border-orange-500/40 text-orange-300"
                                                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-orange-300 hover:border-orange-500/30"
                                                    }`}
                                            >
                                                {mode === "SONIC" ? "🔊 Sonic" : mode === "HEAT" ? "🔥 Heat" : "💨 Degas"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {sonicatorModes.includes("HEAT") && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Bath Temperature (°C)</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={60}
                                            value={bathTemp}
                                            onChange={(e) => setBathTemp(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                                            placeholder="1-60"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Glovebox fields ── */}
                        {instrumentType === "GLOVEBOX" && (
                            <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-700/50 rounded-2xl p-4 sm:p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Equipment Brought Inside</label>
                                    <input
                                        type="text"
                                        required
                                        value={equipmentBrought}
                                        onChange={(e) => setEquipmentBrought(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                                        placeholder="List equipment..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Chemicals Brought Inside</label>
                                    <input
                                        type="text"
                                        required
                                        value={chemicalsBrought}
                                        onChange={(e) => setChemicalsBrought(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                                        placeholder="List chemicals or write '-'"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">N₂ Flow Rate (LPM)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step={0.1}
                                            value={n2FlowRate}
                                            onChange={(e) => setN2FlowRate(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                                            placeholder="Optional"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">N₂ Duration (min)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={n2Duration}
                                            onChange={(e) => setN2Duration(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                                            placeholder="Optional"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Special Notes / Irregularities</label>
                                    <textarea
                                        rows={2}
                                        value={specialNotes}
                                        onChange={(e) => setSpecialNotes(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none"
                                        placeholder="Optional notes..."
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── CPD fields ── */}
                        {instrumentType === "CPD" && (
                            <div className="bg-slate-900/40 backdrop-blur-md shadow-lg border border-slate-700/50 rounded-2xl p-4 sm:p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Sample Description</label>
                                    <textarea
                                        rows={2}
                                        required
                                        value={sample}
                                        onChange={(e) => setSample(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none"
                                        placeholder="Describe your sample..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">CPD Mode</label>
                                    <div className="flex gap-3">
                                        {(["AUTO", "MANUAL"] as const).map((mode) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => setCpdMode(mode)}
                                                className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${cpdMode === mode
                                                    ? "bg-orange-500/20 border-orange-500/40 text-orange-300"
                                                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-orange-300 hover:border-orange-500/30"
                                                    }`}
                                            >
                                                {mode === "AUTO" ? "⚡ Auto" : "🔧 Manual"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {cpdMode === "MANUAL" && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Manual Mode Details</label>
                                        <textarea
                                            rows={2}
                                            value={cpdModeDetails}
                                            onChange={(e) => setCpdModeDetails(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none"
                                            placeholder="Describe your manual configuration..."
                                        />
                                    </div>
                                )}
                            </div>
                        )}

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
