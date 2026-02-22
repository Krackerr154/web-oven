"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function markTourCompleted() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { hasSeenTour: true },
        });

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Failed to mark tour as completed:", error);
        return { success: false, message: "Failed to update tour status" };
    }
}
