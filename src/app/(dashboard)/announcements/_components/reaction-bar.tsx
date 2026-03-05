"use client";

import { useOptimistic, startTransition } from "react";
import { toggleReaction } from "@/app/actions/announcement";

// Using a partial type so we don't have to import strict Prisma models if not needed
type ReactionLite = {
    id: string;
    type: string;
    userId: string;
};

const REACTION_TYPES = [
    { type: "LIKE", emoji: "👍" },
    { type: "HEART", emoji: "❤️" },
    { type: "CELEBRATE", emoji: "🎉" },
];

export function ReactionBar({
    announcementId,
    initialReactions,
    currentUserId,
}: {
    announcementId: string;
    initialReactions: ReactionLite[];
    currentUserId: string;
}) {
    const [optimisticReactions, addOptimisticReaction] = useOptimistic<
        ReactionLite[],
        { type: string; userId: string }
    >(initialReactions, (state, newReaction) => {
        const exists = state.find(
            (r) => r.userId === newReaction.userId && r.type === newReaction.type
        );
        if (exists) {
            return state.filter((r) => r.id !== exists.id); // Toggle off
        }
        return [
            ...state,
            {
                id: `optimistic-${Date.now()}`,
                type: newReaction.type,
                userId: newReaction.userId,
            },
        ]; // Toggle on
    });

    const handleReact = (type: string) => {
        startTransition(() => {
            addOptimisticReaction({ type, userId: currentUserId });
            toggleReaction(announcementId, type);
        });
    };

    return (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800/50">
            {REACTION_TYPES.map(({ type, emoji }) => {
                const count = optimisticReactions.filter((r) => r.type === type).length;
                const hasReacted = optimisticReactions.some(
                    (r) => r.type === type && r.userId === currentUserId
                );

                return (
                    <button
                        key={type}
                        onClick={() => handleReact(type)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${hasReacted
                                ? "bg-slate-700/80 text-white ring-1 ring-slate-500"
                                : "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300"
                            }`}
                        title={`React with ${type.toLowerCase()}`}
                    >
                        <span className="text-base">{emoji}</span>
                        {count > 0 && <span>{count}</span>}
                    </button>
                );
            })}
        </div>
    );
}
