"use client";

import { useState } from "react";
import { approveUser, rejectUser } from "@/app/actions/admin";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function UserActionButtons({ userId }: { userId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  async function handleApprove() {
    setLoading("approve");
    const result = await approveUser(userId);
    setLoading(null);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function handleReject() {
    setShowRejectConfirm(false);
    setLoading("reject");
    const result = await rejectUser(userId);
    setLoading(null);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleApprove}
          disabled={loading !== null}
          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
        >
          {loading === "approve" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          Approve
        </button>
        <button
          onClick={() => setShowRejectConfirm(true)}
          disabled={loading !== null}
          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
        >
          {loading === "reject" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" />
          )}
          Reject
        </button>
      </div>

      <ConfirmDialog
        open={showRejectConfirm}
        title="Reject User"
        description="Are you sure you want to reject this user? They will not be able to log in."
        confirmLabel="Reject"
        variant="danger"
        onConfirm={handleReject}
        onCancel={() => setShowRejectConfirm(false)}
      />
    </>
  );
}
