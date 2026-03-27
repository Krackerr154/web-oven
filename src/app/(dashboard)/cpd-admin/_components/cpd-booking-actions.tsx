"use client";

import { useState } from "react";
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { approveCPDBooking, rejectCPDBooking } from "@/app/actions/admin";
import { useToast } from "@/components/toast";

interface Props {
  bookingId: string;
  userName: string;
}

export function CPDBookingActions({ bookingId, userName }: Props) {
  const { success, error, warning } = useToast();
  const [loadingApprove, setLoadingApprove] = useState(false);
  const [loadingReject, setLoadingReject] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState("");

  async function handleApprove() {
    setLoadingApprove(true);
    const result = await approveCPDBooking(bookingId);
    setLoadingApprove(false);
    if (result.success) {
      success(`Approved booking for ${userName}`);
    } else {
      error(result.message);
    }
  }

  async function handleReject() {
    if (!reason.trim()) {
      warning("Please enter a rejection reason");
      return;
    }
    setLoadingReject(true);
    const result = await rejectCPDBooking(bookingId, reason.trim());
    setLoadingReject(false);
    if (result.success) {
      success(`Rejected booking for ${userName}`);
      setShowRejectForm(false);
      setReason("");
    } else {
      error(result.message);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={loadingApprove || loadingReject}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-500/30"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {loadingApprove ? "Approving…" : "Approve"}
        </button>
        <button
          onClick={() => setShowRejectForm((v) => !v)}
          disabled={loadingApprove || loadingReject}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30"
        >
          <XCircle className="h-3.5 w-3.5" />
          Reject
          {showRejectForm ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {showRejectForm && (
        <div className="flex gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason…"
            className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500/50"
            onKeyDown={(e) => e.key === "Enter" && handleReject()}
          />
          <button
            onClick={handleReject}
            disabled={loadingReject}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loadingReject ? "…" : "Confirm"}
          </button>
        </div>
      )}
    </div>
  );
}
