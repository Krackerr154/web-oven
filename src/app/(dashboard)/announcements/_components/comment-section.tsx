"use client";

import { useState } from "react";
import { format } from "date-fns";
import { MessageSquare, Trash2 } from "lucide-react";
import { createComment, deleteComment } from "@/app/actions/announcement";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Comment = {
    id: string;
    content: string;
    createdAt: Date;
    author: {
        id: string;
        name: string;
        image: string | null;
    };
};

export function CommentSection({
    announcementId,
    initialComments,
    currentUserId,
    isAdmin,
}: {
    announcementId: string;
    initialComments: Comment[];
    currentUserId: string;
    isAdmin: boolean;
}) {
    const toast = useToast();
    const [comments, setComments] = useState<Comment[]>(initialComments);
    const [newComment, setNewComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const result = await createComment(announcementId, newComment.trim());
            if (result.success) {
                toast.success("Comment posted!");
                setNewComment("");
                // Refresh the page to get the new comment
                window.location.reload();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error("Failed to post comment");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        setIsDeleting(true);
        try {
            const result = await deleteComment(commentId);
            if (result.success) {
                toast.success("Comment deleted");
                setComments(comments.filter((c) => c.id !== commentId));
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error("Failed to delete comment");
        } finally {
            setIsDeleting(false);
            setCommentToDelete(null);
        }
    };

    return (
        <div className="mt-4 pt-4 border-t border-slate-800/50">
            <button
                onClick={() => setShowComments(!showComments)}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors mb-3"
            >
                <MessageSquare className="h-4 w-4" />
                <span>
                    {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
                </span>
            </button>

            {showComments && (
                <div className="space-y-4">
                    <form onSubmit={handleSubmit} className="space-y-2">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write a comment..."
                            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent"
                            rows={3}
                            maxLength={500}
                            disabled={isSubmitting}
                        />
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                                {newComment.length}/500
                            </span>
                            <button
                                type="submit"
                                disabled={!newComment.trim() || isSubmitting}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                {isSubmitting ? "Posting..." : "Post Comment"}
                            </button>
                        </div>
                    </form>

                    <div className="space-y-3">
                        {comments.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">
                                No comments yet. Be the first to comment!
                            </p>
                        ) : (
                            comments.map((comment) => (
                                <div
                                    key={comment.id}
                                    className="p-3 bg-slate-800/30 rounded-lg border border-slate-800/50"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 shrink-0 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden ring-1 ring-slate-700">
                                                {comment.author.image ? (
                                                    <img
                                                        src={comment.author.image}
                                                        alt={comment.author.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-300">
                                                        {comment.author.name.charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-white">
                                                    {comment.author.name}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {format(new Date(comment.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                                </p>
                                            </div>
                                        </div>

                                        {(comment.author.id === currentUserId || isAdmin) && (
                                            <button
                                                onClick={() => setCommentToDelete(comment.id)}
                                                className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                                title="Delete comment"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>

                                    <p className="text-sm text-slate-300 whitespace-pre-wrap">
                                        {comment.content}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!commentToDelete}
                title="Delete Comment"
                description="Are you sure you want to delete this comment?"
                confirmLabel="Delete"
                variant="danger"
                loading={isDeleting}
                onConfirm={() => commentToDelete && handleDelete(commentToDelete)}
                onCancel={() => setCommentToDelete(null)}
            />
        </div>
    );
}
