"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Fuse from "fuse.js";
import { revalidatePath } from "next/cache";

export type GlasswareItem = {
    id: string;
    customId: string | null;
    name: string;
    type: string;
    brand: string | null;
    size: string;
    unit: string;
    quantity: number;
    availableQuantity: number;
    condition: string | null;
    location: string | null;
    notes: string | null;
    ownerId: string | null;
    owner: { name: string | null; phone: string } | null;
    activeLoans: {
        id: string;
        quantity: number;
        purpose: string | null;
        borrowedAt: Date;
        user: { name: string | null; email: string };
    }[];
    updatedAt: Date;
};

/**
 * Fetch all glassware or perform a fuzzy search across the database entries.
 */
export async function getAllGlassware(query?: string): Promise<GlasswareItem[]> {
    try {
        const glassware = await prisma.glassware.findMany({
            include: {
                owner: {
                    select: { name: true, phone: true }
                },
                loans: {
                    where: { status: "BORROWED" },
                    include: {
                        user: { select: { name: true, email: true } }
                    }
                }
            },
            orderBy: { name: 'asc' },
        });

        // Map Prisma object to standard item
        const mappedData: GlasswareItem[] = glassware.map((g) => {
            const borrowedCount = g.loans.reduce((acc, loan) => acc + loan.quantity, 0);
            return {
                id: g.id,
                customId: g.customId,
                name: g.name,
                type: g.type,
                brand: g.brand,
                size: g.size,
                unit: g.unit,
                quantity: g.quantity,
                availableQuantity: Math.max(0, g.quantity - borrowedCount),
                condition: g.condition,
                location: g.location,
                notes: g.notes,
                ownerId: g.ownerId,
                owner: g.owner ? { name: g.owner.name, phone: g.owner.phone } : null,
                activeLoans: g.loans.map(l => ({
                    id: l.id,
                    quantity: l.quantity,
                    purpose: l.purpose,
                    borrowedAt: l.borrowedAt,
                    user: {
                        name: l.user.name,
                        email: l.user.email
                    }
                })),
                updatedAt: g.updatedAt,
            };
        });

        if (!query || query.trim() === "") {
            return mappedData;
        }

        // Setup Fuse for fuzzy search
        const fuse = new Fuse(mappedData, {
            keys: [
                "name",
                "customId",
                "type",
                "brand",
                "location",
                { name: "size", weight: 0.5 },
                { name: "unit", weight: 0.5 },
            ],
            threshold: 0.3, // 0.0 is perfect match, 1.0 is match anything
            ignoreLocation: true,
        });

        const results = fuse.search(query);
        return results.map((result) => result.item);
    } catch (error) {
        console.error("Error fetching glassware:", error);
        return [];
    }
}

/**
 * Add a new glassware item to the database (Admin only)
 */
export async function addGlassware(data: {
    customId?: string;
    name: string;
    type: string;
    brand?: string;
    size: string;
    unit: string;
    quantity: number;
    condition?: string;
    location?: string;
    notes?: string;
}): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "ADMIN") {
            return { success: false, message: "Unauthorized. Admin access required." };
        }

        await prisma.glassware.create({
            data: {
                customId: data.customId || null,
                name: data.name,
                type: data.type,
                brand: data.brand || null,
                size: data.size,
                unit: data.unit,
                quantity: data.quantity,
                condition: data.condition || null,
                location: data.location || null,
                notes: data.notes || null,
            }
        });

        revalidatePath("/admin/glassware");
        return { success: true };
    } catch (error) {
        console.error("Error adding glassware:", error);
        return { success: false, message: "Internal server error" };
    }
}

/**
 * Delete a glassware item from the database (Admin only)
 */
export async function deleteGlassware(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "ADMIN") {
            return { success: false, message: "Unauthorized. Admin access required." };
        }

        await prisma.glassware.delete({
            where: { id }
        });

        revalidatePath("/admin/glassware");
        revalidatePath("/glassware");
        return { success: true };
    } catch (error) {
        console.error("Error deleting glassware:", error);
        return { success: false, message: "Internal server error while deleting" };
    }
}

/**
 * Add a new user-owned glassware item to the database (Any signed-in user)
 */
export async function addUserGlassware(data: {
    name: string;
    type: string;
    brand?: string;
    size: string;
    unit: string;
    quantity: number;
    condition?: string;
    location?: string;
    notes?: string;
}): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, message: "Unauthorized." };
        }

        await prisma.glassware.create({
            data: {
                name: data.name,
                type: data.type,
                brand: data.brand || null,
                size: data.size,
                unit: data.unit,
                quantity: data.quantity,
                condition: data.condition || null,
                location: data.location || null,
                notes: data.notes || null,
                ownerId: session.user.id, // Explicitly tied to the requested user
            }
        });

        revalidatePath("/glassware");
        revalidatePath("/admin/glassware");
        return { success: true };
    } catch (error) {
        console.error("Error adding user glassware:", error);
        return { success: false, message: "Internal server error" };
    }
}

/**
 * Borrow Lab-Owned Glassware
 */
export async function borrowGlassware(glasswareId: string, quantity: number, purpose: string): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, message: "Unauthorized." };
        }

        // 1. Verify Glassware exists and is Lab Owned
        const item = await prisma.glassware.findUnique({
            where: { id: glasswareId },
            include: { loans: { where: { status: "BORROWED" } } }
        });

        if (!item) return { success: false, message: "Glassware not found." };
        if (item.ownerId !== null) return { success: false, message: "Cannot borrow user-owned glassware through this system. Contact the owner directly." };

        // 2. Check Available Quantity
        const borrowedCount = item.loans.reduce((acc, loan) => acc + loan.quantity, 0);
        const available = item.quantity - borrowedCount;

        if (quantity > available) {
            return { success: false, message: `Only ${available} available to borrow.` };
        }
        if (quantity <= 0) {
            return { success: false, message: "Quantity must be greater than zero." };
        }

        // 3. Create Loan Record
        await prisma.glasswareLoan.create({
            data: {
                glasswareId,
                userId: session.user.id,
                quantity,
                purpose,
                status: "BORROWED"
            }
        });

        revalidatePath("/glassware");
        revalidatePath("/glassware/borrowed");
        revalidatePath("/admin/glassware");

        return { success: true };
    } catch (error) {
        console.error("Error borrowing glassware:", error);
        return { success: false, message: "Internal server error." };
    }
}

/**
 * Return Borrowed Glassware
 */
export async function returnGlassware(loanId: string): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, message: "Unauthorized." };
        }

        const loan = await prisma.glasswareLoan.findUnique({
            where: { id: loanId }
        });

        if (!loan) return { success: false, message: "Loan record not found." };
        if (loan.userId !== session.user.id && session.user.role !== "ADMIN") {
            return { success: false, message: "Unauthorized. You did not borrow this item." };
        }
        if (loan.status === "RETURNED") return { success: false, message: "Already returned." };

        // Mark as returned
        await prisma.glasswareLoan.update({
            where: { id: loanId },
            data: {
                status: "RETURNED",
                returnedAt: new Date()
            }
        });

        revalidatePath("/glassware");
        revalidatePath("/glassware/borrowed");
        revalidatePath("/admin/glassware");

        return { success: true };
    } catch (error) {
        console.error("Error returning glassware:", error);
        return { success: false, message: "Internal server error." };
    }
}
