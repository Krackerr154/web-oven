"use client";

import { useState } from "react";
import { setUserRole, setContactPerson } from "@/app/actions/admin";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { Loader2, ShieldAlert, Star, AlertCircle } from "lucide-react";

export function RoleManagementButtons({
    userId,
    currentRole,
    isContactPerson,
}: {
    userId: string;
    currentRole: "ADMIN" | "USER";
    isContactPerson: boolean;
}) {
    const router = useRouter();
    const toast = useToast();
    const [loading, setLoading] = useState<string | null>(null);

    async function handleRoleToggle() {
        setLoading("role");
        const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
        const result = await setUserRole(userId, newRole);
        setLoading(null);

        if (result.success) {
            toast.success(result.message);
            router.refresh();
        } else {
            toast.error(result.message);
        }
    }

    async function handleSetContact() {
        if (currentRole !== "ADMIN") return;

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
                onClick={handleRoleToggle}
                disabled={loading !== null}
                className={`flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${currentRole === "ADMIN"
                    ? "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700/50"
                    : "bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
                    }`}
            >
                {loading === "role" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                    <ShieldAlert className="h-3 w-3" />
                )}
                {currentRole === "ADMIN" ? "Demote to User" : "Promote to Admin"}
            </button>

            {currentRole === "ADMIN" && (
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
                    {isContactPerson ? "Primary Contact" : "Set as Contact Person"}
                </button>
            )}
        </div>
    );
}
