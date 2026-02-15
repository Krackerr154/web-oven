"use client";

import { useState } from "react";
import { setOvenMaintenance, clearOvenMaintenance } from "@/app/actions/admin";
import { useRouter } from "next/navigation";
import { Loader2, Wrench, Power } from "lucide-react";

export function OvenActionButtons({
  ovenId,
  isMaintenance,
}: {
  ovenId: number;
  isMaintenance: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    if (
      !isMaintenance &&
      !confirm(
        "Setting maintenance will AUTO-CANCEL all active bookings on this oven. Continue?"
      )
    ) {
      return;
    }

    setLoading(true);
    const result = isMaintenance
      ? await clearOvenMaintenance(ovenId)
      : await setOvenMaintenance(ovenId);
    setLoading(false);

    if (result.success) {
      router.refresh();
    } else {
      alert(result.message);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
        isMaintenance
          ? "bg-emerald-600 hover:bg-emerald-500 text-white"
          : "bg-amber-600 hover:bg-amber-500 text-white"
      }`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isMaintenance ? (
        <Power className="h-4 w-4" />
      ) : (
        <Wrench className="h-4 w-4" />
      )}
      {isMaintenance ? "Set Available" : "Set Maintenance"}
    </button>
  );
}
