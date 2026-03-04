"use client";

import { useTransition } from "react";
import { liftInstrumentBan } from "@/app/actions/admin";
import { useToast } from "@/components/toast";
import { ShieldCheck } from "lucide-react";

export function LiftBanButton({ banId }: { banId: string }) {
    const [isPending, startTransition] = useTransition();
    const toast = useToast();

    function handleLift() {
        startTransition(async () => {
            const result = await liftInstrumentBan(banId);
            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <button
            onClick={handleLift}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1.5 font-medium"
            title="Restore booking access for this instrument"
        >
            <ShieldCheck className="h-3.5 w-3.5" />
            Lift Ban
        </button>
    );
}
