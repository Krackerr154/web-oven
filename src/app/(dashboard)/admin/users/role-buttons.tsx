"use client";

import { useState } from "react";
import { setUserRoles, setContactPerson } from "@/app/actions/admin";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { Loader2, ShieldAlert, Star } from "lucide-react";

export function RoleManagementButtons({
    userId,
    currentRoles,
    isContactPerson,
}: {
    userId: string;
    currentRoles: ("ADMIN" | "CPD_ADMIN" | "USER")[];
    isContactPerson: boolean;
}) {
    const router = useRouter();
    const toast = useToast();
    const [loading, setLoading] = useState<string | null>(null);

    async function toggleRole(role: "ADMIN" | "CPD_ADMIN" | "USER") {
        setLoading("role");
        const newRoles = currentRoles.includes(role)
            ? currentRoles.filter(r => r !== role)
            : [...currentRoles, role];

        if (newRoles.length === 0) newRoles.push("USER");

        const result = await setUserRoles(userId, newRoles);
        setLoading(null);

        if (result.success) {
            toast.success(result.message);
            router.refresh();
        } else {
            toast.error(result.message);
        }
    }

    async function handleSetContact() {
        if (!currentRoles.includes("ADMIN")) return;

        setLoading("contact");
        const result = await setContactPerson(userId);
        setLoading(null);

        if (result.success) {
            toast.success(result.message);
            router.refresh();
        } else {
            toast.error(result.message);
        }
    }

    return (
        <div className="flex flex-col gap-1.5 mt-2">
            <button
                onClick={() => toggleRole("ADMIN")}
                disabled={loading !== null}
                className={`flex items-center justify-between gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${currentRoles.includes("ADMIN")
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
                    : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-purple-400 hover:border-purple-500/30"
                    }`}
            >
                <div className="flex items-center gap-1.5">
                    {loading === "role" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldAlert className="h-3 w-3" />}
                    <span>Admin</span>
                </div>
                {currentRoles.includes("ADMIN") && <span className="text-[10px] bg-purple-500/30 px-1.5 rounded">Active</span>}
            </button>

            <button
                onClick={() => toggleRole("CPD_ADMIN")}
                disabled={loading !== null}
                className={`flex items-center justify-between gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${currentRoles.includes("CPD_ADMIN")
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                    : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30"
                    }`}
            >
                <div className="flex items-center gap-1.5">
                    {loading === "role" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldAlert className="h-3 w-3" />}
                    <span>CPD Admin</span>
                </div>
                {currentRoles.includes("CPD_ADMIN") && <span className="text-[10px] bg-cyan-500/30 px-1.5 rounded">Active</span>}
            </button>

            {currentRoles.includes("ADMIN") && (
                <button
                    onClick={handleSetContact}
                    disabled={loading !== null || isContactPerson}
                    className={`flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${isContactPerson
                        ? "bg-amber-500/20 border-amber-500/30 text-amber-300 cursor-default"
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-500/30 hover:bg-amber-500/10"
                        }`}
                >
                    {loading === "contact" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isContactPerson ? (
                        <Star className="h-3 w-3 fill-current" />
                    ) : (
                        <Star className="h-3 w-3" />
                    )}
                    {isContactPerson ? "Primary Contact" : "Set as Contact"}
                </button>
            )}
        </div>
    );
}
