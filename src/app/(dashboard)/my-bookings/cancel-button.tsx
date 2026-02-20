"use client";

import { useState } from "react";
import { cancelBooking } from "@/app/actions/booking";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleCancel() {
    setShowConfirm(false);
    setLoading(true);
    const result = await cancelBooking(bookingId);
    setLoading(false);

    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={loading}
        className="w-full sm:w-auto text-xs px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors mt-1 mb-1 sm:my-0"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <X className="h-3 w-3" />
        )}
        Cancel
      </button>

      <ConfirmDialog
        open={showConfirm}
        title="Cancel Booking"
        description="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmLabel="Cancel Booking"
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
