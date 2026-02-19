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
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

type OvenData = {
  id: number;
  name: string;
  type: string;
  description: string | null;
  maxTemp: number;
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

export function OvenActionButtons({
  oven,
  isMaintenance,
}: {
  oven: OvenData;
  isMaintenance: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(initialConfirm);

  function openConfirm(
    title: string,
    description: string,
    confirmLabel: string,
    variant: "danger" | "warning",
    action: () => Promise<{ success: boolean; message: string }>
  ) {
    setConfirm({ open: true, title, description, confirmLabel, variant, action });
  }

  async function handleConfirm() {
    if (!confirm.action) return;
    const action = confirm.action;
    const isDeletion = confirm.title.includes("Delete");
    setConfirm(initialConfirm);

    if (isDeletion) {
      setDeleting(true);
    } else {
      setLoading(true);
    }

    const result = await action();

    if (isDeletion) {
      setDeleting(false);
    } else {
      setLoading(false);
    }

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
        <EditOvenModal oven={oven} />

        <button
          onClick={() =>
            openConfirm(
              `Delete "${oven.name}"`,
              "All completed/cancelled booking history for this oven will also be removed. This cannot be undone.",
              "Delete Oven",
              "danger",
              () => deleteOven(oven.id)
            )
          }
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
          onClick={() => {
            if (isMaintenance) {
              // No confirmation needed to set available
              setLoading(true);
              clearOvenMaintenance(oven.id).then((result) => {
                setLoading(false);
                if (result.success) {
                  toast.success(result.message);
                  router.refresh();
                } else {
                  toast.error(result.message);
                }
              });
            } else {
              openConfirm(
                "Enable Maintenance Mode",
                "This will AUTO-CANCEL all active bookings on this oven. Are you sure?",
                "Set Maintenance",
                "warning",
                () => setOvenMaintenance(oven.id)
              );
            }
          }}
          disabled={loading}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${isMaintenance
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

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        description={confirm.description}
        confirmLabel={confirm.confirmLabel}
        variant={confirm.variant}
        loading={loading || deleting}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(initialConfirm)}
      />
    </>
  );
}
