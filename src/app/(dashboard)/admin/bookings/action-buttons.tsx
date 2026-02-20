"use client";

import { useState, useTransition } from "react";
import {
  cancelBookingByAdmin,
  completeBookingByAdmin,
  removeBookingByAdmin,
} from "@/app/actions/admin";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Props = {
  bookingId: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED" | "AUTO_CANCELLED";
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

export function BookingActionButtons({ bookingId, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmState>(initialConfirm);
  const toast = useToast();

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

  return (
    <>
      <div className="flex items-stretch sm:items-center gap-2 flex-wrap w-full sm:w-auto">
        {status === "ACTIVE" && (
          <button
            onClick={() =>
              openConfirm(
                "Cancel Booking",
                "This will cancel the booking as admin. The user will be notified.",
                "Cancel Booking",
                "warning",
                () => cancelBookingByAdmin(bookingId)
              )
            }
            disabled={isPending}
            className="flex-1 sm:flex-none text-center justify-center text-xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        )}

        {(status === "ACTIVE" || status === "AUTO_CANCELLED") && (
          <button
            onClick={() =>
              openConfirm(
                "Complete Booking",
                "Mark this booking as completed?",
                "Complete",
                "warning",
                () => completeBookingByAdmin(bookingId)
              )
            }
            disabled={isPending}
            className="flex-1 sm:flex-none text-center justify-center text-xs px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
          >
            Complete
          </button>
        )}

        <button
          onClick={() =>
            openConfirm(
              "Remove Booking",
              "This will soft-remove the booking from active views. The record is kept for audit purposes.",
              "Remove",
              "danger",
              () => removeBookingByAdmin(bookingId)
            )
          }
          disabled={isPending}
          className="flex-1 sm:flex-none text-center justify-center text-xs px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
        >
          Remove
        </button>
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
