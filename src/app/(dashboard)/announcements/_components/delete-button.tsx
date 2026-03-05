"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteAnnouncement } from "@/app/actions/announcement";

export function DeleteAnnouncementButton({ id }: { id: string }) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this announcement?")) return;

        setIsDeleting(true);
        try {
            await deleteAnnouncement(id);
        } catch (error) {
            console.error("Failed to delete", error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <button
            onClick={handleDelete}
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
    );
}
