"use client";

import { useState, useEffect, useMemo } from "react";
import { createBooking } from "@/app/actions/booking";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, Flame, Clock, AlertCircle, AlertTriangle } from "lucide-react";
import DateTimePicker from "@/components/date-time-picker";
import { formatDuration } from "@/lib/utils";
import { useToast } from "@/components/toast";

type Oven = {
  id: number;
  name: string;
  type: string;
  status: string;
  description: string | null;
  maxTemp: number;
};

const FLAP_VALUES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export default function BookPage() {
  const router = useRouter();
  const toast = useToast();
  const [ovens, setOvens] = useState<Oven[]>([]);
  const [selectedOvenId, setSelectedOvenId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hasConflict, setHasConflict] = useState(false);
  const [usageTemp, setUsageTemp] = useState("");
  const [flap, setFlap] = useState(0);
  const [purpose, setPurpose] = useState("");

  const selectedOven = useMemo(
    () => ovens.find((o) => o.id === selectedOvenId) ?? null,
    [ovens, selectedOvenId]
  );

  const duration = useMemo(() => {
    if (!startDate || !endDate) return "—";
    return formatDuration(startDate, endDate);
  }, [startDate, endDate]);

  // Duration validation
  const durationWarning = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) return "End date must be after start date";
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) return "Maximum booking duration is 7 days";
    return null;
  }, [startDate, endDate]);

  // Temp validation — inline alert
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

  const ovenSelected = selectedOvenId !== null;

  // Live validation — updates automatically as user fills inputs
  const validationIssues = useMemo(() => {
    const issues: { label: string; ok: boolean }[] = [];

    issues.push({ label: "Select an oven", ok: ovenSelected });
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
  }, [ovenSelected, startDate, endDate, durationWarning, hasConflict, tempWarning, usageTemp, purpose]);

  const canSubmit = !loading && validationIssues.every((i) => i.ok);

  useEffect(() => {
    fetch("/api/ovens")
      .then((r) => r.json())
      .then(setOvens)
      .catch(() => setError("Failed to load ovens"));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      ovenId: Number(formData.get("ovenId")),
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      purpose: formData.get("purpose") as string,
      usageTemp: Number(formData.get("usageTemp")),
      flap: Number(formData.get("flap")),
    };
    const result = await createBooking(data);

    setLoading(false);

    if (result.success) {
      toast.success(result.message);
      router.push("/my-bookings");
    } else {
      setError(result.message);
    }
  }

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Book an Oven</h1>
        <p className="text-slate-400 mt-1">
          Select an oven and choose your time slot in WIB (max 7 days)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Oven Selection */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Select Oven
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ovens.map((oven) => {
              const isAvailable = oven.status === "AVAILABLE";
              const isAqueous = oven.type !== "NON_AQUEOUS";
              return (
                <label
                  key={oven.id}
                  className={`relative flex items-center gap-3 p-3 sm:p-4 rounded-lg border cursor-pointer transition-all ${!isAvailable
                    ? "border-slate-700 bg-slate-800/30 opacity-50 cursor-not-allowed"
                    : isAqueous
                      ? "border-slate-600 hover:border-blue-500/50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-500/10"
                      : "border-slate-600 hover:border-orange-500/50 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-500/10"
                    }`}
                >
                  <input
                    type="radio"
                    name="ovenId"
                    value={oven.id}
                    disabled={!isAvailable}
                    required
                    className="sr-only"
                    onChange={() => setSelectedOvenId(oven.id)}
                  />
                  <Flame className={`h-5 w-5 shrink-0 ${isAqueous ? "text-blue-400" : "text-orange-400"}`} />
                  <div className="min-w-0">
                    <p className="font-medium text-white">{oven.name}</p>
                    <p className="text-xs text-slate-400">
                      {isAqueous ? "Aqueous" : "Non-Aqueous"}
                      {" · Max " + oven.maxTemp + "°C"}
                      {!isAvailable && " — Maintenance"}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Date/Time Picker */}
        <DateTimePicker
          ovenId={selectedOvenId}
          ovens={ovens}
          startValue={startDate}
          endValue={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onConflict={setHasConflict}
        />

        {/* Duration display + warning */}
        {(startDate || endDate) && (
          <div className={`rounded-lg bg-slate-800/50 border ${durationWarning ? "border-amber-500/30" : "border-slate-700"}`}>
            <div className="flex items-center gap-3 px-4 py-3">
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
        <div className={`bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 transition-opacity ${ovenSelected ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Temperature */}
            <div>
              <label htmlFor="usageTemp" className="block text-sm font-medium text-slate-300 mb-1.5">
                Usage Temperature (°C)
              </label>
              <input
                id="usageTemp"
                name="usageTemp"
                type="number"
                required
                min={1}
                max={selectedOven?.maxTemp ?? 1000}
                step={1}
                value={usageTemp}
                onChange={(e) => setUsageTemp(e.target.value)}
                placeholder={selectedOven ? `Max ${selectedOven.maxTemp}°C` : "Select oven first"}
                className={`w-full px-3 py-2.5 rounded-lg bg-slate-900 border text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 ${tempWarning ? "border-red-500/60" : "border-slate-600"
                  }`}
              />
              {tempWarning && (
                <div className="flex items-center gap-2 mt-2 text-sm text-red-300 bg-red-500/15 border border-red-500/30 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                  <span className="font-medium">{tempWarning}</span>
                </div>
              )}
              {!tempWarning && selectedOven && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Max for {selectedOven.name}: {selectedOven.maxTemp}°C
                </p>
              )}
            </div>

            {/* Flap — dropdown select */}
            <div>
              <label htmlFor="flap" className="block text-sm font-medium text-slate-300 mb-1.5">
                Flap Opening
              </label>
              <select
                id="flap"
                name="flap"
                value={flap}
                onChange={(e) => setFlap(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
              >
                {FLAP_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}% {v === 0 ? "— Closed" : v === 100 ? "— Fully open" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1.5">
                Damper/vent opening percentage
              </p>
            </div>
          </div>

          {!ovenSelected && (
            <p className="text-xs text-slate-500 italic mt-3">
              ↑ Select an oven above to enable these fields
            </p>
          )}
        </div>

        {/* Purpose */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
          <label htmlFor="purpose" className="block text-sm font-medium text-slate-300 mb-1.5">
            Purpose
          </label>
          <textarea
            id="purpose"
            name="purpose"
            required
            rows={3}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none"
            placeholder="e.g., Drying Ni-BDC MOF samples at 120°C"
          />
        </div>

        {/* Live validation checklist */}
        <div className="bg-slate-900/50 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium text-slate-400 mb-2">Booking requirements</p>
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
          className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating booking...
            </>
          ) : (
            <>
              <CalendarPlus className="h-4 w-4" />
              Create Booking
            </>
          )}
        </button>
      </form>
    </div>
  );
}
