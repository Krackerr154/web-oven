"use client";

import { useState, useTransition } from "react";
import {
  updateBookingByAdmin,
  cancelBookingByAdmin,
  completeBookingByAdmin,
  removeBookingByAdmin,
} from "@/app/actions/admin";
import { toWibDateTimeLocalValue } from "@/lib/utils";

type Props = {
  booking: {
    id: string;
    startDate: Date;
    endDate: Date;
    purpose: string;
    usageTemp: number;
    flap: number;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED" | "AUTO_CANCELLED";
  };
};

export function BookingManagementForm({ booking }: Props) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function runAction(action: () => Promise<{ success: boolean; message: string }>, confirmText: string) {
    if (!window.confirm(confirmText)) return;

    setMessage("");
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
    });
  }

  function handleSubmit(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      const result = await updateBookingByAdmin(formData);
      setMessage(result.message);
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-white">Admin Management</h2>

      <form action={handleSubmit} className="space-y-3">
        <input type="hidden" name="bookingId" value={booking.id} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400">Start (WIB)</label>
            <input
              name="startDate"
              type="datetime-local"
              defaultValue={toWibDateTimeLocalValue(booking.startDate)}
              required
              className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">End (WIB)</label>
            <input
              name="endDate"
              type="datetime-local"
              defaultValue={toWibDateTimeLocalValue(booking.endDate)}
              required
              className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Usage Temp (°C)</label>
            <input
              name="usageTemp"
              type="number"
              defaultValue={booking.usageTemp}
              min={1}
              required
              className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Flap (%)</label>
            <input
              name="flap"
              type="number"
              defaultValue={booking.flap}
              min={0}
              max={100}
              required
              className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400">Purpose</label>
          <textarea
            name="purpose"
            rows={3}
            defaultValue={booking.purpose}
            required
            className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="text-xs px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50"
        >
          Save Booking Changes
        </button>
      </form>

      <div className="pt-3 border-t border-slate-700/60 flex flex-wrap gap-2">
        {booking.status === "ACTIVE" && (
          <button
            onClick={() => runAction(() => cancelBookingByAdmin(booking.id), "Cancel this booking as admin?")}
            disabled={isPending}
            className="text-xs px-3 py-2 rounded border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
          >
            Cancel Booking
          </button>
        )}

        {(booking.status === "ACTIVE" || booking.status === "AUTO_CANCELLED") && (
          <button
            onClick={() => runAction(() => completeBookingByAdmin(booking.id), "Mark this booking as completed?")}
            disabled={isPending}
            className="text-xs px-3 py-2 rounded border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
          >
            Mark Completed
          </button>
        )}

        <button
          onClick={() => runAction(() => removeBookingByAdmin(booking.id), "Soft-remove this booking from active views?")}
          disabled={isPending}
          className="text-xs px-3 py-2 rounded border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
        >
          Soft Remove
        </button>
      </div>

      {message && <p className="text-xs text-slate-300">{message}</p>}
    </div>
  );
}
