"use client";

import { useState } from "react";
import {
  setOvenMaintenance,
  clearOvenMaintenance,
  deleteOven,
} from "@/app/actions/admin";
import { useRouter } from "next/navigation";
import { Loader2, Wrench, Power, Trash2 } from "lucide-react";
import { EditOvenModal } from "./edit-oven-modal";

type OvenData = {
  id: number;
  name: string;
  type: string;
  description: string | null;
};

export function OvenActionButtons({
  oven,
  isMaintenance,
}: {
  oven: OvenData;
  isMaintenance: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      ? await clearOvenMaintenance(oven.id)
      : await setOvenMaintenance(oven.id);
    setLoading(false);

    if (result.success) {
      router.refresh();
    } else {
      alert(result.message);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${oven.name}"? All completed/cancelled booking history for this oven will also be removed. This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    const result = await deleteOven(oven.id);
    setDeleting(false);

    if (result.success) {
      router.refresh();
    } else {
      alert(result.message);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <EditOvenModal oven={oven} />

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="p-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors disabled:opacity-50"
        title="Delete oven"
      >
        {deleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>

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
    </div>
  );
}
