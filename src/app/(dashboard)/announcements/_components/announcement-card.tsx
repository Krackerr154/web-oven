import { format } from "date-fns";
import { Pin } from "lucide-react";
import { ReactionBar } from "./reaction-bar";
import { DeleteAnnouncementButton } from "./delete-button";

type AnnouncementWithDetails = {
    id: string;
    title: string;
    content: string;
    isPinned: boolean;
    createdAt: Date;
    author: {
        id: string;
        name: string;
        image: string | null;
    };
    reactions: {
        id: string;
        type: string;
        userId: string;
    }[];
};

export function AnnouncementCard({
    announcement,
    currentUserId,
    isAdmin,
}: {
    announcement: AnnouncementWithDetails;
    currentUserId: string;
    isAdmin: boolean;
}) {
    return (
        <div
            className={`relative p-5 sm:p-6 rounded-2xl border transition-all ${announcement.isPinned
                    ? "bg-slate-800/80 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.05)]"
                    : "bg-slate-900/60 border-slate-800/60 hover:border-slate-700/80"
                }`}
        >
            {announcement.isPinned && (
                <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-lg shadow-orange-500/10">
                    <Pin className="h-3 w-3 fill-orange-400" />
                    Pinned
                </div>
            )}

            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden ring-2 ring-slate-800">
                        {announcement.author.image ? (
                            <img
                                src={announcement.author.image}
                                alt={announcement.author.name}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span className="text-sm font-bold text-slate-300">
                                {announcement.author.name.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">{announcement.author.name}</h3>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                Admin
                            </span>
                        </div>
                        <p className="text-xs text-slate-400">
                            {format(new Date(announcement.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                    </div>
                </div>

                {isAdmin && <DeleteAnnouncementButton id={announcement.id} />}
            </div>

            <div className="mb-2">
                <h4 className="text-lg font-bold text-white leading-tight">
                    {announcement.title}
                </h4>
            </div>

            <div className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                {announcement.content}
            </div>

            <ReactionBar
                announcementId={announcement.id}
                initialReactions={announcement.reactions}
                currentUserId={currentUserId}
            />
        </div>
    );
}
