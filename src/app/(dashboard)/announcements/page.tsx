import { Metadata } from "next";
import { Megaphone, MessageSquare } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateAnnouncementModal } from "./_components/create-announcement-modal";
import { AnnouncementCard } from "./_components/announcement-card";

export const metadata: Metadata = {
    title: "Announcements | AP-Lab",
    description: "Important updates and laboratory announcements",
};

export const revalidate = 0;

export default async function AnnouncementsPage() {
    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id;
    const isAdmin = session?.user?.role === "ADMIN";

    const announcements = await prisma.announcement.findMany({
        orderBy: [
            { isPinned: "desc" },
            { createdAt: "desc" },
        ],
        include: {
            author: {
                select: {
                    id: true,
                    name: true,
                    image: true,
                },
            },
            reactions: {
                select: {
                    id: true,
                    type: true,
                    userId: true,
                },
            },
        },
    });

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-orange-500/20 text-orange-400 shrink-0 shadow-inner">
                        <Megaphone className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Announcements</h1>
                        <p className="text-slate-400 mt-0.5 text-sm">
                            Stay updated with the latest laboratory news and important information
                        </p>
                    </div>
                </div>

                {isAdmin && (
                    <div className="flex items-center gap-3">
                        <CreateAnnouncementModal />
                    </div>
                )}
            </div>

            <div className="space-y-4 pt-2">
                {announcements.length === 0 ? (
                    <div className="text-center py-20 px-4 rounded-2xl border border-slate-800 border-dashed bg-slate-900/30">
                        <div className="mx-auto w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                            <MessageSquare className="h-8 w-8 text-slate-500" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">No Announcements Yet</h3>
                        <p className="text-slate-400 text-sm max-w-sm mx-auto">
                            There are currently no announcements or updates posted by the lab administrators.
                        </p>
                    </div>
                ) : (
                    announcements.map((announcement) => (
                        <AnnouncementCard
                            key={announcement.id}
                            announcement={announcement}
                            currentUserId={currentUserId!}
                            isAdmin={isAdmin}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
