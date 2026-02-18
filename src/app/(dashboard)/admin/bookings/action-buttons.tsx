"use client";

import { useState, useTransition } from "react";
import {
  cancelBookingByAdmin,
  completeBookingByAdmin,
  removeBookingByAdmin,
} from "@/app/actions/admin";

type Props = {
  bookingId: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED" | "AUTO_CANCELLED";
};

export function BookingActionButtons({ bookingId, status }: Props) {
  const [message, setMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function runAction(action: () => Promise<{ success: boolean; message: string }>, confirmText: string) {
    if (!window.confirm(confirmText)) return;

    setMessage("");
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        {status === "ACTIVE" && (
          <button
            onClick={() =>
              runAction(
                () => cancelBookingByAdmin(bookingId),
                "Cancel this booking as admin?"
              )
            }
            disabled={isPending}
            className="text-xs px-2 py-1 rounded border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
          >
            Cancel
          </button>
        )}

        {(status === "ACTIVE" || status === "AUTO_CANCELLED") && (
          <button
            onClick={() =>
              runAction(
                () => completeBookingByAdmin(bookingId),
                "Mark this booking as completed?"
              )
            }
            disabled={isPending}
            className="text-xs px-2 py-1 rounded border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
          >
            Complete
          </button>
        )}

        <button
          onClick={() =>
            runAction(
              () => removeBookingByAdmin(bookingId),
              "Soft-remove this booking from active views?"
            )
          }
          disabled={isPending}
          className="text-xs px-2 py-1 rounded border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
        >
          Remove
        </button>
      </div>
      {message && <p className="text-[11px] text-slate-400">{message}</p>}
    </div>
  );
}
