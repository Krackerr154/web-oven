"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { banUserFromInstrumentCategory, liftInstrumentBan } from "@/app/actions/admin";
import { useToast } from "@/components/toast";
import { ShieldBan, ShieldCheck } from "lucide-react";

type Instrument = { id: number; name: string; type: string };
type Ban = {
    id: string;
    reason: string | null;
    instrumentType: "OVEN" | "ULTRASONIC_BATH" | "GLOVEBOX";
    bannedBy: { name: string };
    createdAt: Date;
};

export function BanUserButton({
    userId,
    instruments,
    activeBans,
}: {
    userId: string;
    instruments: Instrument[];
    activeBans: Ban[];
}) {
    const [open, setOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<"OVEN" | "ULTRASONIC_BATH" | "GLOVEBOX" | "">("");
    const [reason, setReason] = useState("");
    const [isPending, startTransition] = useTransition();
    const [mounted, setMounted] = useState(false);
    const toast = useToast();

    useEffect(() => {
        setMounted(true);
    }, []);

    // Derive categories from instruments
    const allCategories = Array.from(new Set(instruments.map((i) => i.type as "OVEN" | "ULTRASONIC_BATH" | "GLOVEBOX")));
    const bannedCategories = activeBans.map((b) => b.instrumentType);
    const availableCategories = allCategories.filter((c) => !bannedCategories.includes(c));

    function handleBan() {
        if (!selectedCategory) return;
        startTransition(async () => {
            const result = await banUserFromInstrumentCategory(
                userId,
                selectedCategory,
                reason || undefined
            );
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                setSelectedCategory("");
                setReason("");
            } else {
                toast.error(result.message);
            }
        });
    }

    function handleLift(banId: string) {
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
        <>
            <button
                onClick={() => setOpen(true)}
                className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                title="Instrument Bans"
            >
                <ShieldBan className="h-3.5 w-3.5" />
            </button>

            {open && mounted && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-toast-in space-y-4">
                        <h2 className="text-lg font-bold text-white">Instrument Bans</h2>

                        {/* Active bans */}
                        {activeBans.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Active Bans</p>
                                {activeBans.map((ban) => (
                                    <div
                                        key={ban.id}
                                        className="flex items-center justify-between gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm text-red-200 font-medium">
                                                {ban.instrumentType.replace(/_/g, " ")}
                                            </p>
                                            {ban.reason && (
                                                <p className="text-xs text-red-300/70 truncate">{ban.reason}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleLift(ban.id)}
                                            disabled={isPending}
                                            className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1"
                                        >
                                            <ShieldCheck className="h-3 w-3" />
                                            Lift
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Ban new instrument category */}
                        {availableCategories.length > 0 ? (
                            <div className="space-y-3 pt-2 border-t border-slate-700/60">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ban from Category</p>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value as any)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                                >
                                    <option value="">Select category...</option>
                                    {availableCategories.map((c) => (
                                        <option key={c} value={c}>
                                            {c.replace(/_/g, " ")}
                                        </option>
                                    ))}
                                </select>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={2}
                                    placeholder="Reason for ban (optional)"
                                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                                />
                                <button
                                    onClick={handleBan}
                                    disabled={isPending || !selectedCategory}
                                    className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                                >
                                    Ban User
                                </button>
                            </div>
                        ) : (
                            activeBans.length === 0 && (
                                <p className="text-sm text-slate-500 text-center">No categories available to ban</p>
                            )
                        )}

                        <button
                            onClick={() => setOpen(false)}
                            className="w-full py-2 rounded-lg text-slate-400 hover:text-white text-sm transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
