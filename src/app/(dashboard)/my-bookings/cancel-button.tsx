"use client";

import { useState } from "react";
import { cancelBooking } from "@/app/actions/booking";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this booking?")) return;

    setLoading(true);
    const result = await cancelBooking(bookingId);
    setLoading(false);

    if (result.success) {
      router.refresh();
    } else {
      alert(result.message);
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <X className="h-3 w-3" />
      )}
      Cancel
    </button>
  );
}
