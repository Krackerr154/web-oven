"use client";

import { useState, useTransition } from "react";
import {
  updateBookingByAdmin,
  cancelBookingByAdmin,
  completeBookingByAdmin,
  removeBookingByAdmin,
} from "@/app/actions/admin";
import { toWibDateTimeLocalValue } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

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

type ConfirmState = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant: "danger" | "warning";
  action: (() => Promise<{ success: boolean; message: string }>) | null;
};

const initialConfirm: ConfirmState = {
  open: false,
  title: "",
  description: "",
  confirmLabel: "",
  variant: "danger",
  action: null,
};

export function BookingManagementForm({ booking }: Props) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const [confirm, setConfirm] = useState<ConfirmState>(initialConfirm);

  function openConfirm(
    title: string,
    description: string,
    confirmLabel: string,
    variant: "danger" | "warning",
    action: () => Promise<{ success: boolean; message: string }>
  ) {
    setConfirm({ open: true, title, description, confirmLabel, variant, action });
  }

  function handleConfirm() {
    if (!confirm.action) return;
    const action = confirm.action;
    setConfirm(initialConfirm);
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateBookingByAdmin(formData);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
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
            className="text-xs px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50 transition-colors"
          >
            Save Booking Changes
          </button>
        </form>

        <div className="pt-3 border-t border-slate-700/60 flex flex-wrap gap-2">
          {booking.status === "ACTIVE" && (
            <button
              onClick={() =>
                openConfirm(
                  "Cancel Booking",
                  "This will cancel the booking as admin.",
                  "Cancel Booking",
                  "warning",
                  () => cancelBookingByAdmin(booking.id)
                )
              }
              disabled={isPending}
              className="text-xs px-3 py-2 rounded border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 disabled:opacity-50 transition-colors"
            >
              Cancel Booking
            </button>
          )}

          {(booking.status === "ACTIVE" || booking.status === "AUTO_CANCELLED") && (
            <button
              onClick={() =>
                openConfirm(
                  "Complete Booking",
                  "Mark this booking as completed?",
                  "Complete",
                  "warning",
                  () => completeBookingByAdmin(booking.id)
                )
              }
              disabled={isPending}
              className="text-xs px-3 py-2 rounded border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
            >
              Mark Completed
            </button>
          )}

          <button
            onClick={() =>
              openConfirm(
                "Remove Booking",
                "This will soft-remove the booking from active views. Kept for audit purposes.",
                "Remove",
                "danger",
                () => removeBookingByAdmin(booking.id)
              )
            }
            disabled={isPending}
            className="text-xs px-3 py-2 rounded border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
          >
            Soft Remove
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        description={confirm.description}
        confirmLabel={confirm.confirmLabel}
        variant={confirm.variant}
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(initialConfirm)}
      />
    </>
  );
}
