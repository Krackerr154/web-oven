"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createBooking } from "@/app/actions/booking";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, Flame, Clock } from "lucide-react";
import BookingCalendar from "@/components/booking-calendar";
import { formatDuration } from "@/lib/utils";

type Oven = {
  id: number;
  name: string;
  type: string;
  status: string;
  description: string | null;
  maxTemp: number;
};

export default function BookPage() {
  const router = useRouter();
  const [ovens, setOvens] = useState<Oven[]>([]);
  const [selectedOvenId, setSelectedOvenId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [calendarKey, setCalendarKey] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const startDateRef = useRef<HTMLInputElement>(null);

  const selectedOven = useMemo(
    () => ovens.find((o) => o.id === selectedOvenId) ?? null,
    [ovens, selectedOvenId]
  );

  const duration = useMemo(() => {
    if (!startDate || !endDate) return "—";
    return formatDuration(startDate, endDate);
  }, [startDate, endDate]);

  useEffect(() => {
    fetch("/api/ovens")
      .then((r) => r.json())
      .then(setOvens)
      .catch(() => setError("Failed to load ovens"));
  }, []);

  function handleDateClick(dateStr: string) {
    if (startDateRef.current) {
      startDateRef.current.value = dateStr;
      setStartDate(dateStr);
      startDateRef.current.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createBooking(formData);

    setLoading(false);

    if (result.success) {
      setSuccess(result.message);
      setCalendarKey((k) => k + 1);
      setTimeout(() => router.push("/my-bookings"), 1500);
    } else {
      setError(result.message);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Book an Oven</h1>
        <p className="text-slate-400 mt-1">
          Select an oven and choose your time slot (max 7 days)
        </p>
      </div>

      {/* Calendar View */}
      <BookingCalendar
        key={calendarKey}
        selectedOvenId={selectedOvenId}
        onDateClick={handleDateClick}
      />

      <form
        onSubmit={handleSubmit}
        className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 space-y-5"
      >
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        {/* Oven Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Select Oven
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ovens.map((oven) => {
              const isAvailable = oven.status === "AVAILABLE";
              return (
                <label
                  key={oven.id}
                  className={`relative flex items-center gap-3 p-3 sm:p-4 rounded-lg border cursor-pointer transition-all ${
                    isAvailable
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

        {/* Date Range + Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-slate-300 mb-1.5">
              Start Date & Time
            </label>
            <input
              id="startDate"
              name="startDate"
              type="datetime-local"
              required
              ref={startDateRef}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-slate-300 mb-1.5">
              End Date & Time
            </label>
            <input
              id="endDate"
              name="endDate"
              type="datetime-local"
              required
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Duration
            </label>
            <div className="flex items-center gap-2 h-[42px] px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-300">
              <Clock className="h-4 w-4 text-slate-500 shrink-0" />
              <span className="text-sm font-medium">{duration}</span>
            </div>
          </div>
        </div>

        {/* Temperature & Flap */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              placeholder={selectedOven ? `Max ${selectedOven.maxTemp}°C` : "Select oven first"}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
            />
            {selectedOven && (
              <p className="text-xs text-slate-500 mt-1">
                Max for {selectedOven.name}: {selectedOven.maxTemp}°C
              </p>
            )}
          </div>
          <div>
            <label htmlFor="flap" className="block text-sm font-medium text-slate-300 mb-1.5">
              Flap Opening (%)
            </label>
            <input
              id="flap"
              name="flap"
              type="number"
              required
              min={0}
              max={100}
              step={1}
              defaultValue={0}
              placeholder="0 – 100"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Damper/vent opening percentage (0% = closed, 100% = fully open)
            </p>
          </div>
        </div>

        {/* Purpose */}
        <div>
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
          disabled={loading}
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
