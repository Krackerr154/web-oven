"use client";

import { useState } from "react";
import { deleteUser } from "@/app/actions/admin";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function DeleteUserButton({ userId }: { userId: string }) {
    const router = useRouter();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    async function handleDelete() {
        setShowConfirm(false);
        setLoading(true);
        const result = await deleteUser(userId);
        setLoading(false);

        if (result.success) {
            toast.success(result.message);
            router.refresh();
        } else {
            toast.error(result.message);
        }
    }

    return (
        <>
            <button
                onClick={() => setShowConfirm(true)}
                disabled={loading}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                title="Delete User"
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Trash2 className="h-4 w-4" />
                )}
            </button>

            <ConfirmDialog
                open={showConfirm}
                title="Delete User"
                description="Are you absolutely sure you want to delete this user? All their bookings will also be permanently deleted. This action cannot be undone."
                confirmLabel="Delete User"
                variant="danger"
                onConfirm={handleDelete}
                onCancel={() => setShowConfirm(false)}
            />
        </>
    );
}
