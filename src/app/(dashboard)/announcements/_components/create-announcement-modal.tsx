"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { createAnnouncement } from "@/app/actions/announcement";

export function CreateAnnouncementModal() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [isPinned, setIsPinned] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !content) {
            setError("Title and content are required.");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const result = await createAnnouncement({ title, content, isPinned });
            if (result.success) {
                setIsOpen(false);
                setTitle("");
                setContent("");
                setIsPinned(false);
                router.refresh();
            } else {
                setError(result.message);
            }
        } catch (err) {
            setError("Failed to create announcement. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-2.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
                <Plus className="h-4 w-4" /> Create Post
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-bold text-white mb-6">Create Announcement</h2>

                {error && (
                    <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            placeholder="e.g., Important Rules Update"
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Content
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={5}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                            placeholder="Write the contents of your announcement here..."
                            disabled={isLoading}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isPinned"
                            checked={isPinned}
                            onChange={(e) => setIsPinned(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/50 bg-slate-700"
                            disabled={isLoading}
                        />
                        <label htmlFor="isPinned" className="text-sm font-medium text-slate-300">
                            Pin to top
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors font-medium"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors font-medium flex items-center justify-center min-w-[120px]"
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
