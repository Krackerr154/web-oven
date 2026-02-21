"use client";

import { useState } from "react";
import { cancelBooking } from "@/app/actions/booking";
import { useRouter } from "next/navigation";
import { Loader2, X, MessageCircle } from "lucide-react";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/dialog";
import { formatDateTimeWib } from "@/lib/utils";

export function CancelBookingButton({
  booking,
  contactPhone,
}: {
  booking: {
    id: string;
    createdAt: Date;
    startDate: Date;
    endDate: Date;
    oven: { name: string };
    user: { name: string };
  };
  contactPhone: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);
  const [reason, setReason] = useState("");

  const isLate = new Date().getTime() > new Date(booking.createdAt).getTime() + 15 * 60 * 1000;

  async function handleCancel() {
    setShowConfirm(false);
    setLoading(true);
    const result = await cancelBooking(booking.id);
    setLoading(false);

    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  function handleWaRedirect() {
    if (!reason.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }

    if (!contactPhone) {
      toast.error("No Admin Contact Person has been designated. Please reach out to an admin manually.");
      return;
    }

    const text = `*[PEMBATALAN BOOKING]*\n\n${booking.user.name} membatalkan penggunaan ${booking.oven.name} pada ${formatDateTimeWib(booking.startDate)} hingga ${formatDateTimeWib(booking.endDate)}\n\n*Alasan:* ${reason}`;

    // Attempt clipboard copy
    try {
      navigator.clipboard.writeText(text);
      toast.success("Cancellation copied to clipboard!");
    } catch (e) {
      console.error("Clipboard write failed", e);
    }

    const cleanPhone = contactPhone.replace(/\D/g, "").replace(/^0/, "62");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank");
    setShowWaModal(false);
  }

  function handleTriggerClick() {
    if (isLate) {
      setShowWaModal(true);
    } else {
      setShowConfirm(true);
    }
  }

  return (
    <>
      <button
        onClick={handleTriggerClick}
        disabled={loading}
        className="w-full sm:w-auto text-xs px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors mt-1 mb-1 sm:my-0"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isLate ? (
          <MessageCircle className="h-3 w-3" />
        ) : (
          <X className="h-3 w-3" />
        )}
        {isLate ? "Request Cancellation" : "Cancel"}
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

      <Dialog open={showWaModal} onOpenChange={setShowWaModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Cancellation</DialogTitle>
            <DialogDescription>
              The 15-minute cancellation window has passed. You must contact the Admin directly to cancel this booking.
              <br /><br />
              Please provide a reason below, and we will generate a WhatsApp template for you.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <textarea
              className="resize-none w-full min-h-[100px] px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
              placeholder="Why are you canceling?"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <button
              onClick={() => setShowWaModal(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleWaRedirect}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Chat Admin via WA
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
