"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteAnnouncement } from "@/app/actions/announcement";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function DeleteAnnouncementButton({ id }: { id: string }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteAnnouncement(id);
        } catch (error) {
            console.error("Failed to delete", error);
        } finally {
            setIsDeleting(false);
            setIsDialogOpen(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsDialogOpen(true)}
                disabled={isDeleting}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Delete Announcement"
            >
                {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Trash2 className="h-4 w-4" />
                )}
            </button>

            <ConfirmDialog
                open={isDialogOpen}
                title="Delete Announcement"
                description="Are you sure you want to delete this announcement?"
                confirmLabel="Delete"
                variant="danger"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setIsDialogOpen(false)}
            />
        </>
    );
}
