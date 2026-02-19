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
  const canSubmit = !loading && !durationWarning && !hasConflict && !tempWarning && !!startDate && !!endDate;

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
    const result = await createBooking(formData);

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
              return (
                <label
                  key={oven.id}
                  className={`relative flex items-center gap-3 p-3 sm:p-4 rounded-lg border cursor-pointer transition-all ${isAvailable
                    ? "border-slate-600 hover:border-orange-500/50 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-500/10"
                    : "border-slate-700 bg-slate-800/30 opacity-50 cursor-not-allowed"
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
                  <Flame className="h-5 w-5 text-orange-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-white">{oven.name}</p>
                    <p className="text-xs text-slate-400">
                      {oven.type === "NON_AQUEOUS" ? "Non-Aqueous" : "Aqueous"}
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

        {/* Duration display */}
        {(startDate || endDate) && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <Clock className="h-4 w-4 text-slate-500 shrink-0" />
            <span className="text-sm text-slate-300">
              Duration: <span className="font-medium text-white">{duration}</span>
            </span>
          </div>
        )}

        {/* Duration warning */}
        {durationWarning && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {durationWarning}
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
              {tempWarning ? (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-400 bg-red-500/10 rounded-md px-2.5 py-1.5 animate-toast-in">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {tempWarning}
                </div>
              ) : selectedOven ? (
                <p className="text-xs text-slate-500 mt-1">
                  Max for {selectedOven.name}: {selectedOven.maxTemp}°C
                </p>
              ) : null}
            </div>

            {/* Flap — button row at 10% increments */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Flap Opening
              </label>
              <div className="flex flex-wrap gap-1.5">
                {FLAP_VALUES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFlap(v)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${flap === v
                        ? "bg-orange-500 text-white shadow-sm"
                        : "bg-slate-900 text-slate-400 border border-slate-600 hover:border-orange-500/50 hover:text-slate-200"
                      }`}
                  >
                    {v}%
                  </button>
                ))}
              </div>
              <input type="hidden" name="flap" value={flap} />
              <p className="text-xs text-slate-500 mt-1.5">
                Damper/vent opening (0% = closed, 100% = fully open)
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
            className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none"
            placeholder="e.g., Drying Ni-BDC MOF samples at 120°C"
          />
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 text-xs text-slate-400 space-y-1">
          <p>• Maximum booking duration: 7 days</p>
          <p>• Maximum 2 active bookings per user</p>
          <p>• Bookings cannot overlap on the same oven</p>
          <p>• Usage temperature cannot exceed oven max temperature</p>
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
