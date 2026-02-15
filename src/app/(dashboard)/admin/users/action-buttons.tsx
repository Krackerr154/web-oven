"use client";

import { useState } from "react";
import { approveUser, rejectUser } from "@/app/actions/admin";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";

export function UserActionButtons({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleApprove() {
    setLoading("approve");
    const result = await approveUser(userId);
    setLoading(null);
    if (result.success) router.refresh();
    else alert(result.message);
  }

  async function handleReject() {
    if (!confirm("Are you sure you want to reject this user?")) return;
    setLoading("reject");
    const result = await rejectUser(userId);
    setLoading(null);
    if (result.success) router.refresh();
    else alert(result.message);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleApprove}
        disabled={loading !== null}
        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
      >
        {loading === "approve" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3" />
        )}
        Approve
      </button>
      <button
        onClick={handleReject}
        disabled={loading !== null}
        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
      >
        {loading === "reject" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <X className="h-3 w-3" />
        )}
        Reject
      </button>
    </div>
  );
}
