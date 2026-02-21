"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const profileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(8, "Phone must be at least 8 characters"),
});

export async function updateProfile(data: { name: string; email: string; phone: string }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    try {
        const parsed = profileSchema.safeParse(data);
        if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };

        const { name, email, phone } = parsed.data;

        // Check uniqueness excluding current user
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { phone }],
                NOT: { id: session.user.id },
            },
        });

        if (existingUser) {
            return {
                success: false,
                message: existingUser.email === email ? "Email already in use by another account" : "Phone number already in use",
            };
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: { name, email, phone },
        });

        revalidatePath("/profile");
        return { success: true, message: "Profile updated successfully" };
    } catch (error) {
        console.error("Profile update error:", error);
        return { success: false, message: "Failed to update profile. Please try again." };
    }
}

export async function updateAvatar(base64Image: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { image: base64Image },
        });

        revalidatePath("/profile");
        return { success: true, message: "Avatar updated successfully" };
    } catch (error) {
        console.error("Avatar update error:", error);
        return { success: false, message: "Failed to update avatar" };
    }
}
