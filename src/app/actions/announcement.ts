"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const announcementSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100),
    content: z.string().min(5, "Content must be at least 5 characters"),
    isPinned: z.boolean().default(false),
});

const commentSchema = z.object({
    content: z.string().min(1, "Comment cannot be empty").max(500, "Comment must be under 500 characters"),
});

export type ActionResponse = {
    success: boolean;
    message: string;
};

export async function createAnnouncement(data: {
    title: string;
    content: string;
    isPinned?: boolean;
}): Promise<ActionResponse> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return { success: false, message: "You must be logged in" };
        }

        if (!session.user.roles.includes("ADMIN")) {
            return { success: false, message: "Only administrators can create announcements" };
        }

        const parsed = announcementSchema.safeParse(data);
        if (!parsed.success) {
            return { success: false, message: parsed.error.issues[0].message };
        }

        const { title, content, isPinned } = parsed.data;

        await prisma.announcement.create({
            data: {
                title,
                content,
                isPinned,
                authorId: session.user.id,
            },
        });

        revalidatePath("/announcements");
        revalidatePath("/");

        return { success: true, message: "Announcement posted successfully" };
    } catch (error) {
        console.error("Create announcement error:", error);
        return { success: false, message: "An unexpected error occurred" };
    }
}

export async function deleteAnnouncement(id: string): Promise<ActionResponse> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return { success: false, message: "You must be logged in" };
        }

        if (!session.user.roles.includes("ADMIN")) {
            return { success: false, message: "Only administrators can delete announcements" };
        }

        const announcement = await prisma.announcement.findUnique({
            where: { id },
        });

        if (!announcement) {
            return { success: false, message: "Announcement not found" };
        }

        await prisma.announcement.delete({
            where: { id },
        });

        revalidatePath("/announcements");
        revalidatePath("/");

        return { success: true, message: "Announcement deleted successfully" };
    } catch (error) {
        console.error("Delete announcement error:", error);
        return { success: false, message: "An unexpected error occurred" };
    }
}

export async function toggleReaction(announcementId: string, type: string): Promise<ActionResponse> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return { success: false, message: "You must be logged in to react" };
        }

        if (session.user.status !== "APPROVED") {
            return { success: false, message: "Your account is not approved" };
        }

        const userId = session.user.id;

        // Check if announcement exists
        const announcement = await prisma.announcement.findUnique({
            where: { id: announcementId },
        });

        if (!announcement) {
            return { success: false, message: "Announcement not found" };
        }

        // Check if the reaction already exists
        const existingReaction = await prisma.reaction.findUnique({
            where: {
                announcementId_userId_type: {
                    announcementId,
                    userId,
                    type,
                },
            },
        });

        if (existingReaction) {
            // If it exists, remove it (toggle off)
            await prisma.reaction.delete({
                where: { id: existingReaction.id },
            });
        } else {
            // If it doesn't exist, add it (toggle on)
            await prisma.reaction.create({
                data: {
                    type,
                    announcementId,
                    userId,
                },
            });
        }

        revalidatePath("/announcements");

        return { success: true, message: "Reaction updated" };
    } catch (error) {
        console.error("Toggle reaction error:", error);
        return { success: false, message: "An unexpected error occurred" };
    }
}

export async function createComment(announcementId: string, content: string): Promise<ActionResponse> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return { success: false, message: "You must be logged in to comment" };
        }

        if (session.user.status !== "APPROVED") {
            return { success: false, message: "Your account is not approved" };
        }

        const parsed = commentSchema.safeParse({ content });
        if (!parsed.success) {
            return { success: false, message: parsed.error.issues[0].message };
        }

        // Check if announcement exists
        const announcement = await prisma.announcement.findUnique({
            where: { id: announcementId },
        });

        if (!announcement) {
            return { success: false, message: "Announcement not found" };
        }

        await prisma.announcementComment.create({
            data: {
                content: parsed.data.content,
                announcementId,
                authorId: session.user.id,
            },
        });

        revalidatePath("/announcements");

        return { success: true, message: "Comment posted successfully" };
    } catch (error) {
        console.error("Create comment error:", error);
        return { success: false, message: "An unexpected error occurred" };
    }
}

export async function deleteComment(id: string): Promise<ActionResponse> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return { success: false, message: "You must be logged in" };
        }

        const comment = await prisma.announcementComment.findUnique({
            where: { id },
        });

        if (!comment) {
            return { success: false, message: "Comment not found" };
        }

        // Only allow comment author or admin to delete
        if (comment.authorId !== session.user.id && !session.user.roles.includes("ADMIN")) {
            return { success: false, message: "You don't have permission to delete this comment" };
        }

        await prisma.announcementComment.delete({
            where: { id },
        });

        revalidatePath("/announcements");

        return { success: true, message: "Comment deleted successfully" };
    } catch (error) {
        console.error("Delete comment error:", error);
        return { success: false, message: "An unexpected error occurred" };
    }
}
